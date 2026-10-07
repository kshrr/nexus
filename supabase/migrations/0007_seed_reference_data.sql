-- =============================================================================
-- 0007_seed_reference_data.sql
-- The minimum reference data the schema needs to be exercised:
--   * SPM subject list (academic_results / subject_strengths FK target)
--   * admin bootstrap helper (architecture.md §5.7 / D-38)
--
-- Courses, universities, careers, scholarships and the RIASEC question bank are
-- deliberately NOT seeded here — that content is authored in later stages
-- (docs/implementation-plan.md §8.B). Seeding is idempotent so `db reset` and
-- re-runs are safe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- subjects — standard SPM subjects with a coarse domain for rule matching.
-- Domains: science | mathematics | languages | humanities | commerce |
--          technical | arts | religious
-- -----------------------------------------------------------------------------
insert into public.subjects (code, name, domain, is_core) values
  ('BM',            'Bahasa Melayu',                 'languages',   true),
  ('BI',            'English',                       'languages',   true),
  ('SEJARAH',       'Sejarah',                       'humanities',  true),
  ('MATH',          'Mathematics',                   'mathematics', true),
  ('ADD_MATH',      'Additional Mathematics',        'mathematics', false),
  ('PHYSICS',       'Physics',                       'science',     false),
  ('CHEMISTRY',     'Chemistry',                     'science',     false),
  ('BIOLOGY',       'Biology',                       'science',     false),
  ('SCIENCE',       'Science',                       'science',     false),
  ('PAI',           'Pendidikan Islam',              'religious',   false),
  ('PM',            'Pendidikan Moral',              'humanities',  false),
  ('GEOGRAFI',      'Geografi',                      'humanities',  false),
  ('EKONOMI',       'Ekonomi',                       'commerce',    false),
  ('PERNIAGAAN',    'Perniagaan',                    'commerce',    false),
  ('PRINSIP_AKAUN', 'Prinsip Perakaunan',            'commerce',    false),
  ('ICT',           'Information & Communication Technology', 'technical', false),
  ('SAINS_KOMP',    'Computer Science',              'technical',   false),
  ('REKA_CIPTA',    'Reka Cipta',                    'technical',   false),
  ('PSV',           'Pendidikan Seni Visual',        'arts',        false),
  ('BC',            'Bahasa Cina',                   'languages',   false),
  ('BT',            'Bahasa Tamil',                  'languages',   false),
  ('BArab',         'Bahasa Arab',                   'languages',   false)
on conflict (code) do update
  set name = excluded.name, domain = excluded.domain, is_core = excluded.is_core;

-- -----------------------------------------------------------------------------
-- Admin bootstrap  (architecture.md §5.7 / D-38)
-- There is NO application code path that writes profiles.role. The first admin
-- is granted here, out of band.
--
-- Usage after deploy: run in the Supabase SQL editor (service-role context)
--   select public.grant_admin_by_email('you@example.com');
--
-- The function is SECURITY DEFINER and its EXECUTE privilege is revoked from
-- anon and authenticated, so it can only be called from a trusted context.
-- -----------------------------------------------------------------------------
create or replace function public.grant_admin_by_email(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from auth.users where lower(email) = lower(p_email);
  if v_id is null then
    raise exception 'no auth user with email %', p_email;
  end if;

  -- The role-immutability trigger (trg_protect_role) refuses any role change
  -- unless the caller is already an admin. Bootstrapping the FIRST admin is the
  -- one legitimate exception; suspend the trigger only for this statement.
  alter table public.profiles disable trigger trg_protect_role;
  update public.profiles set role = 'admin' where id = v_id;
  alter table public.profiles enable trigger trg_protect_role;

  insert into public.audit_log (actor_user_id, action, target_table, target_id, metadata)
  values (v_id, 'role.grant_admin', 'profiles', v_id,
          jsonb_build_object('email', p_email, 'via', 'grant_admin_by_email'));
end;
$$;

revoke all on function public.grant_admin_by_email(text) from public, anon, authenticated;

-- Example (leave commented — fill in the real address once, post-deploy):
-- select public.grant_admin_by_email('admin@nexus.example');
