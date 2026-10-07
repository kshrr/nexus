-- =============================================================================
-- auth-shim.sql  — LOCAL TEST ONLY. Never run against a real Supabase project.
--
-- Recreates the slice of the Supabase platform the migrations assume:
--   * roles anon / authenticated / service_role
--   * the auth schema, auth.users, and auth.uid() / auth.role() / auth.jwt()
--
-- The test harness (rls.test.mjs) loads this into an in-process PGlite database
-- before applying supabase/migrations/*, so RLS can be exercised as a real
-- unprivileged role would experience it.
-- =============================================================================

create role anon          nologin noinherit;
create role authenticated nologin noinherit;
create role service_role  nologin noinherit bypassrls;

create schema if not exists auth;

create table auth.users (
  id                    uuid primary key default gen_random_uuid(),
  email                 text unique,
  raw_user_meta_data    jsonb not null default '{}',
  created_at            timestamptz not null default now()
);
grant usage on schema auth to anon, authenticated, service_role;

-- Supabase reads the verified JWT claims from the `request.jwt.claims` GUC.
create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), ''),
    '{}'
  )::jsonb;
$$;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', current_setting('role', true));
$$;

grant execute on function auth.jwt(), auth.uid(), auth.role() to anon, authenticated, service_role;
