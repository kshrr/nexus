-- =============================================================================
-- 0004_security_tables.sql
-- Consent trail, crawler run log, append-only audit log, rate-limit counters.
-- Schema from architecture.md §3.1 (consent_records) and §3.7.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- consent_records  (append-only history; profiles.consent_* holds current value)
-- -----------------------------------------------------------------------------
create table public.consent_records (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  policy_version text not null,
  consented_at   timestamptz not null default now()
);

create index idx_consent_records_user on public.consent_records (user_id);

-- -----------------------------------------------------------------------------
-- crawl_logs  (one row per crawler run — FR15)
-- -----------------------------------------------------------------------------
create table public.crawl_logs (
  id                uuid primary key default gen_random_uuid(),
  started_at        timestamptz,
  finished_at       timestamptz,
  duration_ms       integer,
  status            text not null check (status in ('success', 'partial', 'failed')),
  records_inserted  integer not null default 0,
  records_updated   integer not null default 0,
  records_failed    integer not null default 0,
  error_message     text,
  triggered_by      text not null check (triggered_by in ('schedule', 'manual')),
  triggered_by_user uuid references public.profiles (id)
);

create index idx_crawl_logs_started on public.crawl_logs (started_at desc);

-- -----------------------------------------------------------------------------
-- audit_log  (append-only by absence of UPDATE/DELETE policy — architecture.md §4.7)
-- ON DELETE SET NULL so the trail survives account deletion.
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references public.profiles (id) on delete set null,
  action         text not null,
  target_table   text,
  target_id      uuid,
  metadata       jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

create index idx_audit_log_actor on public.audit_log (actor_user_id, created_at desc);
create index idx_audit_log_target on public.audit_log (target_table, target_id);

-- -----------------------------------------------------------------------------
-- rate_limit_events  (architecture.md §3.7 — never reachable from the browser)
-- identifier = hashed email, IP, or user_id.
-- -----------------------------------------------------------------------------
create table public.rate_limit_events (
  identifier     text not null,
  endpoint       text not null,
  window_start   timestamptz not null,
  attempt_count  integer not null default 1,
  primary key (identifier, endpoint, window_start)
);

create index idx_rate_limit_window on public.rate_limit_events (window_start);
