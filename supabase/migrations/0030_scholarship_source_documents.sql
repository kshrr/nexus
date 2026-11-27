-- Official PDFs a scholarship's requirements refer to (an approved-university
-- list, a yearly advertisement), for students to open in a new tab.
--
-- The crawler stores them as record.source_documents = [{label, url}] in the
-- admin-only discovery staging row, which every run refreshes. Rather than add
-- a column that every publish/monitor/approve function would have to copy,
-- this read-only function serves them for a PUBLISHED scholarship only.
--
-- Rules, re-applied here even though the crawler already enforces them:
--   * the scholarship must be published (linked from a non-ignored discovery)
--     and visible as active or expired — not flagged or archived
--   * each URL must be public https, a .pdf path, and on the SAME host as the
--     scholarship's source page: a harvested link to another site shown inside
--     a trusted UI is a phishing vector
--   * at most 5 documents, labels 1-200 characters
create function public.scholarship_source_documents(p_scholarship_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with docs as (
    select doc, ord, s.source_url
      from public.scholarships s
      join public.scholarship_discoveries d
        on d.scholarship_id = s.id and d.review_state <> 'ignored'
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof((d.extracted_record || d.approved_overrides) -> 'source_documents') = 'array'
             then (d.extracted_record || d.approved_overrides) -> 'source_documents'
             else '[]'::jsonb end
      ) with ordinality as x(doc, ord)
     where s.id = p_scholarship_id
       and s.status in ('active', 'expired')
  ), valid as (
    select distinct on (doc ->> 'url') doc ->> 'url' as url, left(trim(doc ->> 'label'), 200) as label, ord
      from docs
     where jsonb_typeof(doc) = 'object'
       and public.discovery_https_url(doc ->> 'url')
       and lower(split_part(split_part(doc ->> 'url', '?', 1), '#', 1)) like '%.pdf'
       and lower(split_part(split_part(doc ->> 'url', '://', 2), '/', 1))
           = lower(split_part(split_part(source_url, '://', 2), '/', 1))
       and length(trim(coalesce(doc ->> 'label', ''))) between 1 and 200
     order by doc ->> 'url', ord
  )
  select coalesce(
           (select jsonb_agg(jsonb_build_object('label', label, 'url', url) order by ord)
              from (select * from valid order by ord limit 5) v),
           '[]'::jsonb)
$$;

revoke all on function public.scholarship_source_documents(uuid) from public;
grant execute on function public.scholarship_source_documents(uuid) to anon, authenticated;
