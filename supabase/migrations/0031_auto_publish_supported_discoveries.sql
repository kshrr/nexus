-- Two kinds of discovery deserve different handling:
--
--   * supported providers (JPA, PETRONAS, YSD, Khazanah, MARA, YTM, YTN,
--     Yayasan Sarawak, Yayasan Sabah, BNM): the official page, read by a parser
--     written and tested for that exact page. The crawler records which parser
--     produced the candidate in evidence.parser.
--   * general web search: unknown sites read by generic extraction.
--
-- Supported-provider candidates that the database itself judges ready are now
-- published by the crawler (service role) without an admin click; anything
-- with review reasons, pending admin edits or an unconfirmed application link
-- stays in the queue. Web-search candidates are never auto-published, can be
-- filtered by source, are listed after supported ones, and can be ignored in
-- bulk.

create function public.discovery_from_supported_parser(p_evidence jsonb) returns boolean
language sql immutable set search_path = public as $$
  select coalesce(p_evidence ->> 'parser', '') <> ''
     and coalesce((p_evidence ->> 'official_source')::boolean, false)
$$;

-- ---------------------------------------------------------------------------
-- Crawler-side publication of a ready supported-provider candidate.
-- Runs as service_role: auth.uid() is null, so mark_manual_scholarship leaves
-- is_manual false (the record stays crawler-managed and monitored), and
-- admin edits made later are still protected as before.
-- ---------------------------------------------------------------------------
create function public.scraper_auto_publish_discovery(p_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare d public.scholarship_discoveries; rec jsonb; crit jsonb; v_id uuid; v_status text;
begin
  select * into d from public.scholarship_discoveries where id = p_id for update;
  if not found then return jsonb_build_object('outcome', 'missing'); end if;
  if d.scholarship_id is not null then
    return jsonb_build_object('outcome', 'already_published', 'scholarship_id', d.scholarship_id);
  end if;
  -- An alias row means an admin linked this candidate to another discovery.
  if exists (select 1 from public.scholarship_discovery_aliases a
              where a.identity_key = d.identity_key and a.discovery_id <> d.id) then
    return jsonb_build_object('outcome', 'needs_review');
  end if;

  rec := d.extracted_record || d.review_overrides;
  crit := case when d.criteria_overridden then d.draft_criteria else d.extracted_criteria end;
  if d.review_state <> 'ready'
     or d.pending_review
     or not public.discovery_from_supported_parser(d.evidence)
     or cardinality(public.discovery_record_reasons(rec, crit)) > 0
     or (rec ->> 'application_link' is not null
         and not coalesce((d.evidence ->> 'trusted_application')::boolean, false)) then
    return jsonb_build_object('outcome', 'needs_review');
  end if;

  select id into v_id from public.scholarships where source_hash = d.identity_key for update;
  if v_id is null then
    v_id := gen_random_uuid();
    v_status := case when nullif(rec ->> 'deadline', '')::date < current_date then 'expired' else rec ->> 'status' end;
    insert into public.scholarships(id, name, provider, description, funding_amount, education_levels,
                                    field_of_study, deadline, application_link, status, source_url,
                                    source_hash, last_scraped_at)
    values (v_id, rec ->> 'name', rec ->> 'provider', rec ->> 'description', rec ->> 'funding_amount',
            array(select jsonb_array_elements_text(rec -> 'education_levels')),
            array(select jsonb_array_elements_text(rec -> 'field_of_study')),
            nullif(rec ->> 'deadline', '')::date, rec ->> 'application_link', v_status,
            rec ->> 'source_url', d.identity_key, d.last_checked_at);
    insert into public.scholarship_criteria(scholarship_id, criterion_type, operator, value, label, is_checkable)
    select v_id, c ->> 'criterion_type', c ->> 'operator', c -> 'value', c ->> 'label',
           coalesce((c ->> 'is_checkable')::boolean, false)
      from jsonb_array_elements(crit) c;
  end if;

  update public.scholarship_discoveries
     set scholarship_id = v_id, monitoring_enabled = true, official_source_confirmed = true,
         approved_source_url = rec ->> 'source_url', approved_application_url = rec ->> 'application_link',
         approved_overrides = review_overrides, approved_criteria = draft_criteria,
         approved_criteria_overridden = criteria_overridden, pending_review = false,
         approved_by = null, approved_at = now(), revision = revision + 1
   where id = p_id;
  perform public.discovery_audit('auto_publish', p_id,
    jsonb_build_object('scholarship_id', v_id, 'parser', d.evidence ->> 'parser'));
  return jsonb_build_object('outcome', 'published', 'scholarship_id', v_id);
end $$;

-- ---------------------------------------------------------------------------
-- Admin bulk action: ignore every unpublished web-search candidate. Ignored
-- candidates stay ignored when rediscovered (scraper_stage_discovery keeps the
-- state) and can be restored one by one from the Ignored filter.
-- ---------------------------------------------------------------------------
create function public.ignore_unsupported_discoveries() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  with changed as (
    update public.scholarship_discoveries
       set review_state = 'ignored', revision = revision + 1
     where scholarship_id is null
       and review_state <> 'ignored'
       and not public.discovery_from_supported_parser(evidence)
    returning id
  )
  select count(*) into n from changed;
  perform public.discovery_audit('ignore_unsupported', null, jsonb_build_object('count', n));
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- Listing with a source filter; supported providers first. The original
-- six-argument signature stays (as a wrapper) so an admin page deployed before
-- or after this migration keeps working.
-- ---------------------------------------------------------------------------
create function public.list_scholarship_discoveries(p_tab text, p_search text, p_provider text,
  p_review_state text, p_page integer, p_page_size integer, p_source text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if p_tab not in ('discover', 'added') or p_page < 1 or p_page_size not between 1 and 100
     or coalesce(p_source, 'all') not in ('all', 'supported', 'search') then
    raise exception 'INVALID_SETTINGS';
  end if;
  with filtered as (
    select d.*, public.discovery_from_supported_parser(d.evidence) as from_supported_provider
      from public.scholarship_discoveries d
     where ((p_tab = 'discover' and d.scholarship_id is null) or (p_tab = 'added' and d.scholarship_id is not null))
       and not exists (select 1 from public.scholarship_discovery_aliases a
                        where a.identity_key = d.identity_key and a.discovery_id <> d.id)
       and (coalesce(p_search, '') = '' or strpos(lower(d.name || ' ' || d.provider), lower(p_search)) > 0)
       and (coalesce(p_provider, '') = '' or d.provider = p_provider)
       and (p_review_state = 'all' or d.review_state = p_review_state)
  ), sourced as (
    select * from filtered f
     where coalesce(p_source, 'all') = 'all'
        or (p_source = 'supported' and f.from_supported_provider)
        or (p_source = 'search' and not f.from_supported_provider)
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(to_jsonb(page) order by page.from_supported_provider desc, page.last_discovered_at desc, page.id)
        from (select f.*, s.status as publication_status, s.is_manual
                from sourced f left join public.scholarships s on s.id = f.scholarship_id
               order by f.from_supported_provider desc, f.last_discovered_at desc, f.id
               limit p_page_size offset (p_page - 1) * p_page_size) page), '[]'::jsonb),
    'total', (select count(*) from sourced),
    'supported_total', (select count(*) from filtered where from_supported_provider),
    'search_total', (select count(*) from filtered where not from_supported_provider),
    'providers', coalesce((select jsonb_agg(provider order by provider)
                             from (select distinct provider from public.scholarship_discoveries where provider <> '') p), '[]'::jsonb)
  ) into result;
  return result;
end $$;

create or replace function public.list_scholarship_discoveries(p_tab text, p_search text, p_provider text,
  p_review_state text, p_page integer, p_page_size integer) returns jsonb
language sql security definer set search_path = public as $$
  select public.list_scholarship_discoveries(p_tab, p_search, p_provider, p_review_state, p_page, p_page_size, 'all')
$$;

-- Record auto-published programmes in the run log's inserted count.
create or replace function public.finish_discovery_crawl_run(p_id uuid, p_stats jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.finish_crawl_run(p_id, p_stats ->> 'status',
    coalesce((p_stats ->> 'auto_published')::integer, 0),
    coalesce((p_stats ->> 'publications_updated')::integer, 0),
    coalesce((p_stats ->> 'failed')::integer, 0),
    left(array_to_string(array(select jsonb_array_elements_text(coalesce(p_stats -> 'errors', '[]'))), '; '), 2000));
  update public.crawl_logs
     set leads_found = coalesce((p_stats ->> 'leads_found')::integer, 0),
         candidates_created = coalesce((p_stats ->> 'candidates_created')::integer, 0),
         candidates_updated = coalesce((p_stats ->> 'candidates_updated')::integer, 0),
         monitored = coalesce((p_stats ->> 'monitored')::integer, 0),
         publications_updated = coalesce((p_stats ->> 'publications_updated')::integer, 0),
         records_unchanged = coalesce((p_stats ->> 'unchanged')::integer, 0),
         records_skipped_manual = coalesce((p_stats ->> 'skipped_manual')::integer, 0)
   where id = p_id;
end $$;

revoke all on function public.discovery_from_supported_parser(jsonb) from public, anon, authenticated;
revoke all on function public.scraper_auto_publish_discovery(uuid) from public, anon, authenticated;
grant execute on function public.scraper_auto_publish_discovery(uuid) to service_role;
revoke all on function public.ignore_unsupported_discoveries() from public, anon;
grant execute on function public.ignore_unsupported_discoveries() to authenticated;
revoke all on function public.list_scholarship_discoveries(text, text, text, text, integer, integer, text) from public, anon;
grant execute on function public.list_scholarship_discoveries(text, text, text, text, integer, integer, text) to authenticated;
