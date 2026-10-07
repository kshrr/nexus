-- =============================================================================
-- 0001_extensions.sql
-- Platform extensions. On Supabase these are provisioned in the `extensions`
-- schema; this file makes the dependency explicit and keeps a from-scratch
-- rebuild honest (architecture.md §2, §3.4.1).
-- =============================================================================

-- gen_random_uuid() is built into PostgreSQL 13+ (Supabase runs 15), so no
-- extension is strictly required for UUID primary keys. pgcrypto is still
-- enabled for digest()/hmac() should a later migration need them.
create extension if not exists pgcrypto;

-- Case-insensitive text is not used by the current schema; email uniqueness is
-- owned by Supabase Auth (auth.users), not the application tables.
