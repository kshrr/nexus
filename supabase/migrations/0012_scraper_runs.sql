-- =============================================================================
-- 0012_scraper_runs.sql
--
-- Server-side support for the targeted scholarship scraper:
--   * a 'running' state on crawl_logs, so an in-flight run is visible
--   * begin/finish helpers that make concurrent runs impossible
--   * an upsert that uses the PARTIAL unique index correctly and enforces
--     manual protection inside the database rather than in the scraper
--
-- WHY THE UPSERT LIVES HERE AND NOT IN PYTHON
--
-- `uq_scholarships_source_hash` is a PARTIAL index (WHERE source_hash IS NOT
-- NULL). PostgREST's upsert emits a plain `ON CONFLICT (source_hash)`, which
-- PostgreSQL rejects with "no unique or exclusion constraint matching the ON
-- CONFLICT specification" because it cannot infer a partial index without the
-- predicate. Writing the statement here lets it carry the matching
-- `WHERE source_hash IS NOT NULL`.
--
-- Putting the manual-protection check in the same statement also removes a
-- race: a check-then-write from the scraper could read is_manual = false, an
-- administrator could save an edit, and the scraper would then overwrite it.
-- Here the decision and the write are one atomic statement.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 'running' is a real state, not an absence of one.
-- -----------------------------------------------------------------------------
alter table public.crawl_logs drop constraint if exists crawl_logs_status_check;
alter table public.crawl_logs
  add constraint crawl_logs_status_check
  check (status in ('running', 'success', 'partial', 'failed'));

-- Counters are unknown until a run finishes; 'running' rows carry zeroes.
comment on column public.crawl_logs.status is
  'running | success | partial | failed. A run inserts a running row, then finishes it.';

-- A run older than this with no result is presumed dead (the CI job was
-- cancelled, the container died) and no longer blocks a new one.
create or replace function public.crawl_run_stale_after()
returns interval language sql immutable as $$ select interval '30 minutes' $$;

-- -----------------------------------------------------------------------------
-- begin_crawl_run — claims the right to run, or refuses (§13 concurrency)
--
-- Returns the new crawl_logs id, or NULL when a run is already in flight. The
-- caller must treat NULL as "do not proceed"; that is the whole concurrency
-- control, and it is enforced in the database so it holds no matter whether
-- the second run came from the weekly schedule or an admin button.
-- -----------------------------------------------------------------------------
create or replace function public.begin_crawl_run(
  p_triggered_by      text,
  p_triggered_by_user uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_triggered_by not in ('schedule', 'manual') then
    raise exception 'triggered_by must be schedule or manual';
  end if;

  -- Serialise the check-and-claim. Without this, two runs starting in the same
  -- instant would both see no active run and both proceed.
  perform pg_advisory_xact_lock(hashtext('nexus.crawl_run'));

  if exists (
    select 1 from public.crawl_logs
    where status = 'running'
      and started_at > now() - public.crawl_run_stale_after()
  ) then
    return null;
  end if;

  insert into public.crawl_logs (started_at, status, triggered_by, triggered_by_user)
  values (now(), 'running', p_triggered_by, p_triggered_by_user)
  returning id into v_id;

  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- finish_crawl_run — records the outcome (§14 logging)
-- -----------------------------------------------------------------------------
create or replace function public.finish_crawl_run(
  p_id               uuid,
  p_status           text,
  p_inserted         integer default 0,
  p_updated          integer default 0,
  p_failed           integer default 0,
  p_error_message    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_status not in ('success', 'partial', 'failed') then
    raise exception 'a finished run must be success, partial or failed';
  end if;

  update public.crawl_logs
     set status           = p_status,
         finished_at      = now(),
         duration_ms      = greatest(0, (extract(epoch from (now() - started_at)) * 1000)::integer),
         records_inserted = p_inserted,
         records_updated  = p_updated,
         records_failed   = p_failed,
         -- Truncated: a log row is not a place for an unbounded stack trace,
         -- and it must never carry a credential.
         error_message    = left(p_error_message, 2000)
   where id = p_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- scraper_upsert_scholarship — one record, atomically (§6, §7)
--
-- Decides and returns exactly one of:
--   'skipped_manual'  the record is administrator-managed; nothing is touched
--   'unchanged'       the source data is identical; last_scraped_at only
--   'updated'         crawler-managed fields refreshed
--   'inserted'        new record
--
-- Criteria are replaced wholesale on insert/update, never on a manual or
-- unchanged record.
-- -----------------------------------------------------------------------------
create or replace function public.scraper_upsert_scholarship(
  p_record   jsonb,
  p_criteria jsonb default '[]'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash     text := p_record ->> 'source_hash';
  v_existing public.scholarships%rowtype;
  v_id       uuid;
  v_changed  boolean;
  -- Captured immediately: `found` is reset by every later statement, so it
  -- cannot be trusted at the end of the function.
  v_is_new   boolean;
begin
  if v_hash is null or v_hash = '' then
    raise exception 'scraper_upsert_scholarship requires a source_hash';
  end if;

  select * into v_existing from public.scholarships where source_hash = v_hash;
  v_is_new := not found;

  -- ---- 1. manual protection (§7) -----------------------------------------
  -- The administrator's edit wins, always. Only the scrape timestamp moves, so
  -- the admin can still see the source was checked.
  if not v_is_new and v_existing.is_manual then
    update public.scholarships
       set last_scraped_at = coalesce((p_record ->> 'last_scraped_at')::timestamptz, now())
     where id = v_existing.id;
    return 'skipped_manual';
  end if;

  -- ---- 2. unchanged? ------------------------------------------------------
  if not v_is_new then
    v_changed :=
         v_existing.name             is distinct from (p_record ->> 'name')
      or v_existing.provider         is distinct from (p_record ->> 'provider')
      or v_existing.description      is distinct from (p_record ->> 'description')
      or v_existing.funding_amount   is distinct from (p_record ->> 'funding_amount')
      or v_existing.deadline         is distinct from (p_record ->> 'deadline')::date
      or v_existing.application_link is distinct from (p_record ->> 'application_link')
      or v_existing.status           is distinct from (p_record ->> 'status')
      or v_existing.field_of_study   is distinct from
           (select coalesce(array_agg(value::text order by ordinality), '{}')
              from jsonb_array_elements_text(coalesce(p_record -> 'field_of_study', '[]'::jsonb))
                   with ordinality)
      or v_existing.education_levels is distinct from
           (select coalesce(array_agg(value::text order by ordinality), '{}')
              from jsonb_array_elements_text(coalesce(p_record -> 'education_levels', '[]'::jsonb))
                   with ordinality);

    if not v_changed then
      update public.scholarships
         set last_scraped_at = coalesce((p_record ->> 'last_scraped_at')::timestamptz, now())
       where id = v_existing.id;
      return 'unchanged';
    end if;
  end if;

  -- ---- 3. insert or update ------------------------------------------------
  -- The ON CONFLICT target repeats the partial index predicate; a plain
  -- `on conflict (source_hash)` fails against this schema.
  insert into public.scholarships (
    name, provider, description, funding_amount, field_of_study, education_levels,
    deadline, application_link, status, source_url, source_hash, last_scraped_at
  )
  values (
    p_record ->> 'name',
    p_record ->> 'provider',
    p_record ->> 'description',
    p_record ->> 'funding_amount',
    (select coalesce(array_agg(value::text order by ordinality), '{}')
       from jsonb_array_elements_text(coalesce(p_record -> 'field_of_study', '[]'::jsonb))
            with ordinality),
    (select coalesce(array_agg(value::text order by ordinality), '{}')
       from jsonb_array_elements_text(coalesce(p_record -> 'education_levels', '[]'::jsonb))
            with ordinality),
    nullif(p_record ->> 'deadline', '')::date,
    p_record ->> 'application_link',
    coalesce(p_record ->> 'status', 'active'),
    p_record ->> 'source_url',
    v_hash,
    coalesce((p_record ->> 'last_scraped_at')::timestamptz, now())
  )
  on conflict (source_hash) where source_hash is not null
  do update set
    name             = excluded.name,
    provider         = excluded.provider,
    description      = excluded.description,
    funding_amount   = excluded.funding_amount,
    field_of_study   = excluded.field_of_study,
    education_levels = excluded.education_levels,
    deadline         = excluded.deadline,
    application_link = excluded.application_link,
    status           = excluded.status,
    source_url       = excluded.source_url,
    last_scraped_at  = excluded.last_scraped_at
  returning id into v_id;

  -- ---- 4. replace criteria ------------------------------------------------
  delete from public.scholarship_criteria where scholarship_id = v_id;

  insert into public.scholarship_criteria
    (scholarship_id, criterion_type, operator, value, label, is_checkable)
  select
    v_id,
    c ->> 'criterion_type',
    c ->> 'operator',
    c -> 'value',
    c ->> 'label',
    coalesce((c ->> 'is_checkable')::boolean, false)
  from jsonb_array_elements(coalesce(p_criteria, '[]'::jsonb)) as c
  where coalesce(c ->> 'label', '') <> '';

  return case when v_is_new then 'inserted' else 'updated' end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Privileges.
--
-- The scraper authenticates as the service role, which bypasses RLS and needs
-- no grant. These are revoked from browser-reachable roles so no signed-in
-- student — or a compromised admin session — can drive the scraper's write path
-- directly. An administrator triggers a run through the Edge Function, which
-- checks is_admin() server-side, never by calling these.
-- -----------------------------------------------------------------------------
revoke all on function public.begin_crawl_run(text, uuid) from public, anon, authenticated;
revoke all on function public.finish_crawl_run(uuid, text, integer, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.scraper_upsert_scholarship(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.crawl_run_stale_after() from public, anon, authenticated;

-- EXECUTE on a function is granted to PUBLIC by default, so the revokes above
-- take it away from service_role as well -- it is an ordinary role, not a
-- superuser, and it does NOT bypass privilege checks (it bypasses RLS, which is
-- a different thing). The scraper must therefore be granted back explicitly, or
-- every run fails with "permission denied for function".
grant execute on function public.begin_crawl_run(text, uuid) to service_role;
grant execute on function public.finish_crawl_run(uuid, text, integer, integer, integer, text)
  to service_role;
grant execute on function public.scraper_upsert_scholarship(jsonb, jsonb) to service_role;
grant execute on function public.crawl_run_stale_after() to service_role;
