-- =============================================================================
-- 0005_functions.sql
-- SQL functions + trigger functions. Created before 0006 so policies and
-- triggers can reference them. Definitions from architecture.md §3.8, §4.2, §4.3, §5.1.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_admin()  — architecture.md §4.2
-- SECURITY DEFINER is required: a policy ON profiles cannot itself read profiles
-- without infinite recursion. search_path is pinned to prevent hijacking.
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- -----------------------------------------------------------------------------
-- assert_admin()  — trigger guard for role immutability (architecture.md §4.3)
-- Raises unless the current user is an admin. Used by trg_protect_role (0006).
-- -----------------------------------------------------------------------------
create or replace function public.assert_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'insufficient privilege: role can only be changed by an administrator'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- grade_to_points(grade)  — architecture.md §8.2 (D-06). IMMUTABLE.
-- -----------------------------------------------------------------------------
create or replace function public.grade_to_points(p_grade text)
returns numeric
language sql
immutable
as $$
  select case p_grade
    when 'A+' then 9
    when 'A'  then 8
    when 'A-' then 7
    when 'B+' then 6
    when 'B'  then 5
    when 'C+' then 4
    when 'C'  then 3
    when 'D'  then 2
    when 'E'  then 1
    when 'G'  then 0
  end::numeric;
$$;

-- -----------------------------------------------------------------------------
-- deadline_urgency(deadline)  — architecture.md §3.8 / §10.2.
-- Thresholds 7 / 30 are fixed by the report — do not change.
-- STABLE (not IMMUTABLE): depends on current_date.
-- -----------------------------------------------------------------------------
create or replace function public.deadline_urgency(p_deadline date)
returns text
language sql
stable
as $$
  select case
    when p_deadline is null then 'none'
    when p_deadline - current_date <= 7  then 'critical'
    when p_deadline - current_date <= 30 then 'warning'
    else 'normal'
  end;
$$;

-- -----------------------------------------------------------------------------
-- compute_subject_strengths(user_id)  — architecture.md §3.8, §8.1, §8.3 (D-07/D-08).
-- Deletes and recomputes subject_strengths for one user from average points.
-- SECURITY INVOKER: runs under the caller's RLS, so it can only ever read the
-- caller's own academic_results and write the caller's own subject_strengths.
-- -----------------------------------------------------------------------------
create or replace function public.compute_subject_strengths(p_user_id uuid default auth.uid())
returns void
language plpgsql
as $$
begin
  if auth.uid() is not null and p_user_id is distinct from auth.uid() then
    raise exception 'not authorised to compute strengths for another user'
      using errcode = '42501';
  end if;

  delete from public.subject_strengths where user_id = p_user_id;

  insert into public.subject_strengths
    (user_id, subject_code, strength, average_points, exam_count, computed_at)
  select
    ar.user_id,
    ar.subject_code,
    case
      when avg(public.grade_to_points(ar.grade)) >= 7.0 then 'strong'
      when avg(public.grade_to_points(ar.grade)) >= 4.0 then 'average'
      else 'weak'
    end,
    round(avg(public.grade_to_points(ar.grade)), 2),
    count(*),
    now()
  from public.academic_results ar
  where ar.user_id = p_user_id
  group by ar.user_id, ar.subject_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- handle_new_user()  — architecture.md §5.1.
-- Creates the profiles row on auth.users insert so no orphan auth user exists.
-- SECURITY DEFINER: runs in the auth insert context.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role, profile_completed)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), 'New user'),
    new.email,
    'student',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- set_updated_at()  — generic updated_at maintenance trigger.
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Execute privileges
-- -----------------------------------------------------------------------------
revoke all on function public.assert_admin()             from public;
revoke all on function public.handle_new_user()          from public;
revoke all on function public.set_updated_at()            from public;

grant execute on function public.is_admin()                       to anon, authenticated;
grant execute on function public.grade_to_points(text)            to anon, authenticated;
grant execute on function public.deadline_urgency(date)           to anon, authenticated;
grant execute on function public.compute_subject_strengths(uuid)  to authenticated;
