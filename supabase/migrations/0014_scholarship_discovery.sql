-- Discovery is staging, never a student-facing source of scholarship data.
create function public.valid_discovery_queries(p_queries text[]) returns boolean
language sql immutable set search_path=public as $$
  select coalesce(cardinality(p_queries) between 1 and 6 and
    not exists(select 1 from unnest(p_queries) q where q is null or length(trim(q)) not between 1 and 580 or q ~ '\{(?!year\})'),false)
$$;

create table public.scholarship_discovery_settings (
  id boolean primary key default true check(id),
  queries text[] not null check(public.valid_discovery_queries(queries)),
  region text not null default 'Malaysia' check(length(trim(region)) between 1 and 100),
  target_count integer not null default 20 check(target_count between 1 and 1000),
  max_search_requests integer not null default 12 check(max_search_requests between 1 and 12),
  max_pages integer not null default 100 check(max_pages between 1 and 100),
  max_pages_per_host integer not null default 5 check(max_pages_per_host between 1 and 5),
  work_seconds integer not null default 1080 check(work_seconds between 1 and 1080),
  updated_at timestamptz not null default now()
);
insert into public.scholarship_discovery_settings(queries) values(array[
 'Malaysia scholarship applications {year}', 'biasiswa permohonan {year}',
 'undergraduate scholarships Malaysian students {year}', 'SPM scholarship sponsorship {year}',
 'Malaysian foundation scholarship {year}', 'university scholarships Malaysia {year}'
]);

create table public.scholarship_discoveries (
  id uuid primary key default gen_random_uuid(),
  identity_key text not null unique check(length(identity_key) between 1 and 200),
  canonical_url text not null check(length(canonical_url)<=2000 and canonical_url like 'https://%'),
  programme_key text not null default '' check(length(programme_key)<=500),
  name text not null default '' check(length(name)<=500),
  provider text not null default '' check(length(provider)<=500),
  extracted_record jsonb not null default '{}',
  extracted_criteria jsonb not null default '[]' check(jsonb_typeof(extracted_criteria)='array'),
  draft_record jsonb,
  draft_criteria jsonb,
  review_overrides jsonb not null default '{}',
  criteria_overridden boolean not null default false,
  approved_overrides jsonb not null default '{}',
  approved_criteria jsonb,
  approved_criteria_overridden boolean not null default false,
  draft_application_url text,
  pending_review boolean not null default false,
  evidence jsonb not null default '{}',
  review_reasons jsonb not null default '[]',
  review_state text not null default 'needs_review' check(review_state in ('needs_review','ready','ignored')),
  first_discovered_at timestamptz not null default now(),
  last_discovered_at timestamptz not null default now(),
  last_checked_at timestamptz,
  last_error text,
  scholarship_id uuid references public.scholarships(id) on delete restrict,
  monitoring_enabled boolean not null default false,
  official_source_confirmed boolean not null default false,
  approved_source_url text,
  approved_application_url text,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  revision integer not null default 1,
  check(not monitoring_enabled or scholarship_id is not null)
);
create index idx_discovery_catalogue on public.scholarship_discoveries(review_state,last_discovered_at desc);
create index idx_discovery_monitor on public.scholarship_discoveries(monitoring_enabled,last_checked_at);
create index idx_discovery_provider on public.scholarship_discoveries(provider);
create table public.scholarship_discovery_aliases (
  identity_key text primary key,
  discovery_id uuid not null references public.scholarship_discoveries(id) on delete restrict
);
alter table public.scholarship_discoveries enable row level security;
alter table public.scholarship_discovery_aliases enable row level security;
alter table public.scholarship_discovery_settings enable row level security;
revoke all on public.scholarship_discoveries,public.scholarship_discovery_aliases,public.scholarship_discovery_settings from public,anon,authenticated;
grant select on public.scholarship_discoveries,public.scholarship_discovery_aliases,public.scholarship_discovery_settings to authenticated;
grant select,insert,update on public.scholarship_discoveries,public.scholarship_discovery_aliases,public.scholarship_discovery_settings to service_role;
grant select on public.scholarships,public.scholarship_criteria,public.crawl_logs to service_role;
create policy discovery_admin_read on public.scholarship_discoveries for select to authenticated using(public.is_admin());
create policy discovery_alias_admin_read on public.scholarship_discovery_aliases for select to authenticated using(public.is_admin());
create policy discovery_settings_admin_read on public.scholarship_discovery_settings for select to authenticated using(public.is_admin());

alter table public.crawl_logs
 add column mode text not null default 'combined' check(mode in ('discovery','monitoring','combined')),
 add column request_id uuid,
 add column leads_found integer not null default 0,
 add column candidates_created integer not null default 0,
 add column candidates_updated integer not null default 0,
 add column monitored integer not null default 0,
 add column publications_updated integer not null default 0,
 add column records_unchanged integer not null default 0,
 add column records_skipped_manual integer not null default 0;
create unique index idx_crawl_request on public.crawl_logs(request_id) where request_id is not null;

-- Existing selected crawler data is preserved, not reinserted or republished.
insert into public.scholarship_discoveries(identity_key,canonical_url,programme_key,name,provider,
 extracted_record,extracted_criteria,scholarship_id,monitoring_enabled,review_state,
 official_source_confirmed,approved_source_url,approved_application_url,last_checked_at,evidence)
select coalesce(s.source_hash,encode(sha256(convert_to(s.source_url||'|'||s.name,'UTF8')),'hex')),
 s.source_url,s.name,s.name,s.provider,
 to_jsonb(s)-array['id','is_manual','created_at','updated_at'],
 coalesce((select jsonb_agg(to_jsonb(c)-array['id','scholarship_id']) from public.scholarship_criteria c where c.scholarship_id=s.id),'[]'),
 s.id,true,'ready',true,s.source_url,s.application_link,s.last_scraped_at,
 jsonb_build_object('origin','existing crawler publication')
from public.scholarships s where not s.is_manual and s.status in ('active','expired')
 and s.source_url ~ '^https://[^/@[:space:]]+(/|$)'
on conflict(identity_key) do nothing;
