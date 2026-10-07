-- =============================================================================
-- 0010_scholarship_operations.sql
--
-- Operational rules for the scholarship module:
--   * is_manual is set automatically on any human write   (architecture.md §10.7, AC-45)
--   * every administrator write is audited                (FR-SEC-09, AC-46)
--   * past deadlines are expired by a schedulable function (D-25)
--
-- No scholarship records are seeded. Scholarship data is either crawler-provided
-- (Stage 9) or entered by an administrator through /admin/scholarships (FR14);
-- inventing records here would put fabricated deadlines and eligibility rules in
-- front of students.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- is_manual — protects an administrator's correction from the weekly crawler.
--
-- auth.uid() is non-null only for a real signed-in actor. The crawler writes
-- under the service role (no calling user), so its upserts leave the flag alone
-- and, per architecture.md §10.3, skip rows where is_manual is already true.
-- -----------------------------------------------------------------------------
create or replace function public.mark_manual_scholarship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.is_manual := true;
  end if;
  return new;
end;
$$;

create trigger trg_scholarships_mark_manual
  before insert or update on public.scholarships
  for each row execute function public.mark_manual_scholarship();

-- -----------------------------------------------------------------------------
-- audit trail for administrator writes (FR-SEC-09 / NFR09 / AC-46)
--
-- Only writes made by an identifiable actor are recorded. Crawler activity has
-- no calling user and is accounted for in crawl_logs instead (§3.7), so this
-- does not fill the audit trail with one row per scraped record.
-- -----------------------------------------------------------------------------
create or replace function public.log_admin_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_row   jsonb;
  v_id    uuid;
begin
  if v_actor is null then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  if tg_op = 'DELETE' then
    v_row := to_jsonb(old);
  else
    v_row := to_jsonb(new);
  end if;

  begin
    v_id := nullif(v_row ->> 'id', '')::uuid;
  exception when others then
    v_id := null;
  end;

  insert into public.audit_log (actor_user_id, action, target_table, target_id, metadata)
  values (
    v_actor,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    v_id,
    jsonb_strip_nulls(jsonb_build_object(
      'name',  v_row ->> 'name',
      'label', v_row ->> 'label',
      'scholarship_id', v_row ->> 'scholarship_id'
    ))
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;

create trigger trg_audit_scholarships
  after insert or update or delete on public.scholarships
  for each row execute function public.log_admin_write();

create trigger trg_audit_scholarship_criteria
  after insert or update or delete on public.scholarship_criteria
  for each row execute function public.log_admin_write();

create trigger trg_audit_courses
  after insert or update or delete on public.courses
  for each row execute function public.log_admin_write();

create trigger trg_audit_universities
  after insert or update or delete on public.universities
  for each row execute function public.log_admin_write();

create trigger trg_audit_careers
  after insert or update or delete on public.careers
  for each row execute function public.log_admin_write();

-- -----------------------------------------------------------------------------
-- expire_past_deadlines()  — D-25.
--
-- Expired records drop out of the default list but stay reachable by direct
-- link (architecture.md §10.2). Schedule with pg_cron, or call from the crawler
-- workflow:
--   select cron.schedule('expire-scholarships', '10 0 * * *',
--                        $$ select public.expire_past_deadlines() $$);
--
-- The trigger above is suspended for this statement: expiry is a system action,
-- not an administrator correction, and must not set is_manual.
-- -----------------------------------------------------------------------------
create or replace function public.expire_past_deadlines()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  alter table public.scholarships disable trigger trg_scholarships_mark_manual;

  update public.scholarships
     set status = 'expired'
   where status = 'active'
     and deadline is not null
     and deadline < current_date;
  get diagnostics v_count = row_count;

  alter table public.scholarships enable trigger trg_scholarships_mark_manual;
  return v_count;
end;
$$;

revoke all on function public.expire_past_deadlines() from public, anon, authenticated;
