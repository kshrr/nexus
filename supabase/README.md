# Nexus — database & security (Phase 2)

Everything here is derived from `docs/architecture.md` §3–§5. The schema's source
of truth is the numbered migrations in `migrations/`.

## Layout

```
supabase/
├── config.toml                  project id + db version (auth is configured in the dashboard)
├── migrations/
│   ├── 0001_extensions.sql      platform extensions
│   ├── 0002_core_tables.sql     profiles, RIASEC, academic, recommendations, saved, chat, subjects
│   ├── 0003_reference_tables.sql universities, courses, careers, pathway stages, scholarships, criteria
│   ├── 0004_security_tables.sql consent_records, crawl_logs, audit_log, rate_limit_events
│   ├── 0005_functions.sql       is_admin, assert_admin, grade_to_points, deadline_urgency,
│   │                            compute_subject_strengths, handle_new_user, set_updated_at
│   ├── 0006_rls_policies.sql    RLS enabled + policies on EVERY table, triggers, grants
│   ├── 0007_seed_reference_data.sql SPM subject list + admin bootstrap helper
│   └── 0008_auth_consent.sql   handle_new_user() also persists registration consent (FR-SEC-10)
└── tests/
    ├── auth-shim.sql            local-only Supabase platform stand-in (roles + auth schema)
    ├── schema.test.mjs          migration / relationship / constraint / index / function checks
    ├── rls.test.mjs             deliverable A-01 — the RLS assurance matrix (architecture.md §4.9)
    └── profile.test.mjs         auth + profile-ownership: sign-up trigger, consent, role immutability
```

## Running the tests (no Docker required)

The tests apply every migration into an in-process PostgreSQL (PGlite) on top of
`auth-shim.sql`, then exercise RLS as the real `anon` / `authenticated` roles.

```bash
npm run db:test          # schema checks + RLS matrix + profile/auth checks
npm run db:test:schema
npm run db:test:rls
```

Frontend auth/profile unit + integration tests: `npm run test` (Vitest).

Both suites exit non-zero on any failure and are safe to wire into CI.

## Deploying to a real Supabase project

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push                 # applies migrations/ in order
# then, once, from the Supabase SQL editor (service-role context):
select public.grant_admin_by_email('you@example.com');
```

`0001` enables `pgcrypto`, which Supabase provides; the local test harness skips
that statement because PGlite has no contrib modules (UUID generation uses the
built-in `gen_random_uuid()` either way).

## Security model (enforced in the database, not the browser)

| Guarantee | Mechanism | Test |
| --- | --- | --- |
| A student cannot read/modify another student's advisory data | owner-only RLS on 7 tables (`user_id = auth.uid()`), `WITH CHECK` on UPDATE | rls #1–11 |
| A student cannot become an admin | `trg_protect_role` BEFORE UPDATE + `assert_admin()`; no app code path writes `role` | rls #12 |
| Admins cannot read student RIASEC / academic / chat data | admins deliberately excluded from owner-only policies (architecture.md §4.4) | rls #22–23 |
| Anonymous users cannot touch personal data | no `anon` grants on `profiles` / owned tables | rls #14, #16 |
| Normal users cannot modify scholarships / courses / careers | reference tables: public `SELECT`, writes gated on `is_admin()` | rls #17–19 |
| Admin writes are authorised and attributable | `is_admin()` policies + `audit_log` (append-only: no UPDATE/DELETE, privileges revoked) | rls #20–21, #24–27 |
| Rate-limit state is never browser-reachable | RLS on, zero policies, grants revoked from `anon`/`authenticated` | rls #30–31 |
