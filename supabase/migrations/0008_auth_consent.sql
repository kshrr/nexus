-- =============================================================================
-- 0008_auth_consent.sql
-- FR-SEC-10 / NFR05: capture privacy consent at registration.
--
-- Registration does not issue a session (architecture.md §5.1 step 3), so the
-- client cannot write consent_records itself immediately after sign-up. Instead
-- the consent version + timestamp are passed in the sign-up metadata and the
-- handle_new_user() trigger persists them:
--   * profiles.consent_version / consent_at  (current value)
--   * consent_records                          (append-only history)
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_consent_version text := nullif(btrim(new.raw_user_meta_data ->> 'consent_version'), '');
  v_consent_at      timestamptz;
begin
  begin
    v_consent_at := (new.raw_user_meta_data ->> 'consent_at')::timestamptz;
  exception when others then
    v_consent_at := now();
  end;

  insert into public.profiles (id, full_name, email, role, profile_completed,
                               consent_version, consent_at)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'New user'),
    new.email,
    'student',
    false,
    v_consent_version,
    case when v_consent_version is not null then coalesce(v_consent_at, now()) end
  )
  on conflict (id) do nothing;

  if v_consent_version is not null then
    insert into public.consent_records (user_id, policy_version, consented_at)
    values (new.id, v_consent_version, coalesce(v_consent_at, now()));
  end if;

  return new;
end;
$$;
