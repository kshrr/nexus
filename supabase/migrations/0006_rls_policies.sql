-- =============================================================================
-- 0006_rls_policies.sql
-- Row-Level Security for EVERY table (architecture.md §4). Deny by default:
-- RLS is enabled everywhere; access exists only where a policy grants it.
--
-- The browser is untrusted. React route guards are UX only. Every rule below is
-- the actual enforcement boundary.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Baseline privileges. RLS filters rows; the role still needs the table-level
-- privilege. Grants here are least-privilege per table group.
-- -----------------------------------------------------------------------------
grant usage on schema public to anon, authenticated;

-- =============================================================================
-- profiles  (architecture.md §4.3)
-- =============================================================================
alter table public.profiles enable row level security;
grant select, insert, update, delete on public.profiles to authenticated;

create policy profiles_select on public.profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_insert on public.profiles
  for insert with check (id = auth.uid());

create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete on public.profiles
  for delete using (id = auth.uid());

-- Role immutability (architecture.md §4.3 — privilege escalation RR-10 / AC-08).
-- The trigger is the unambiguous, testable control; the policy WITH CHECK is not
-- relied on alone.
create trigger trg_protect_role
  before update on public.profiles
  for each row
  when (old.role is distinct from new.role)
  execute function public.assert_admin();

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- Student-owned tables  (architecture.md §4.4)
-- Identical shape: the row owner has full CRUD on their own rows; admins are
-- deliberately excluded (no requirement grants admins access to advisory data).
-- =============================================================================
do $$
declare
  t text;
  owned text[] := array[
    'riasec_results', 'riasec_responses', 'academic_results', 'subject_strengths',
    'recommendations', 'saved_items', 'chat_messages'
  ];
begin
  foreach t in array owned loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);

    execute format($f$
      create policy %1$s_select on public.%1$I
        for select using (user_id = auth.uid());
    $f$, t);

    execute format($f$
      create policy %1$s_insert on public.%1$I
        for insert with check (user_id = auth.uid());
    $f$, t);

    -- WITH CHECK on UPDATE matters: USING alone would let a user move their own
    -- row to another user's user_id (architecture.md §4.4).
    execute format($f$
      create policy %1$s_update on public.%1$I
        for update using (user_id = auth.uid())
        with check (user_id = auth.uid());
    $f$, t);

    execute format($f$
      create policy %1$s_delete on public.%1$I
        for delete using (user_id = auth.uid());
    $f$, t);
  end loop;
end;
$$;

-- =============================================================================
-- consent_records  (architecture.md §3.1 — append-only, owner-scoped)
-- =============================================================================
alter table public.consent_records enable row level security;
grant select, insert on public.consent_records to authenticated;
revoke update, delete on public.consent_records from anon, authenticated;

create policy consent_records_select on public.consent_records
  for select using (user_id = auth.uid());

create policy consent_records_insert on public.consent_records
  for insert with check (user_id = auth.uid());
-- No UPDATE or DELETE policy: the trail is immutable.

-- =============================================================================
-- Reference tables  (architecture.md §4.5)
-- Public SELECT; writes are admin-only. The crawler writes under the service
-- role and bypasses these (intentional — TB-5 scopes that key).
-- =============================================================================
do $$
declare
  t text;
  refs text[] := array[
    'subjects', 'universities', 'courses', 'careers',
    'career_pathway_stages', 'career_courses',
    'scholarships', 'scholarship_criteria'
  ];
begin
  foreach t in array refs loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('grant select on public.%I to anon, authenticated;', t);
    execute format('grant insert, update, delete on public.%I to authenticated;', t);

    execute format($f$
      create policy %1$s_select on public.%1$I for select using (true);
    $f$, t);

    execute format($f$
      create policy %1$s_insert on public.%1$I
        for insert with check (public.is_admin());
    $f$, t);

    execute format($f$
      create policy %1$s_update on public.%1$I
        for update using (public.is_admin()) with check (public.is_admin());
    $f$, t);

    execute format($f$
      create policy %1$s_delete on public.%1$I
        for delete using (public.is_admin());
    $f$, t);
  end loop;
end;
$$;

create trigger trg_scholarships_updated_at
  before update on public.scholarships
  for each row execute function public.set_updated_at();

-- =============================================================================
-- crawl_logs  (architecture.md §4.6)
-- SELECT: admin only. INSERT: service role only (no policy). No UPDATE/DELETE.
-- =============================================================================
alter table public.crawl_logs enable row level security;
grant select on public.crawl_logs to authenticated;
revoke insert, update, delete on public.crawl_logs from anon, authenticated;

create policy crawl_logs_select on public.crawl_logs
  for select using (public.is_admin());

-- =============================================================================
-- audit_log  (architecture.md §4.7)
-- SELECT: admin only. INSERT: authenticated, but only as themselves.
-- NO UPDATE policy. NO DELETE policy. Append-only by absence.
-- =============================================================================
alter table public.audit_log enable row level security;
grant select, insert on public.audit_log to authenticated;
-- Append-only: no role may UPDATE or DELETE through the API (architecture.md §4.7).
revoke update, delete on public.audit_log from anon, authenticated;

create policy audit_log_select on public.audit_log
  for select using (public.is_admin());

create policy audit_log_insert on public.audit_log
  for insert with check (actor_user_id = auth.uid());

-- =============================================================================
-- rate_limit_events  (architecture.md §4.8)
-- No policies at all. Service role / Edge Functions only. Never browser-reachable.
-- =============================================================================
alter table public.rate_limit_events enable row level security;
revoke all on public.rate_limit_events from anon, authenticated;

-- =============================================================================
-- Auth: create the profile row on sign-up (architecture.md §5.1)
-- =============================================================================
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
