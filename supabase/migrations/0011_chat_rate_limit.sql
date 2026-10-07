-- =============================================================================
-- 0011_chat_rate_limit.sql
--
-- Rate limiting for the chatbot (FR-SEC-04: 20 messages / hour / user) and the
-- chat retention job (D-31: 12 months).
--
-- WHY A SECURITY DEFINER FUNCTION
-- architecture.md §4.8 puts `rate_limit_events` out of reach of the browser
-- entirely — RLS on, zero policies, grants revoked. But §12.1 / FR-SEC-05 also
-- require fn:chat to query as the CALLING USER, not the service role. Those two
-- rules together mean the Edge Function cannot touch the table directly.
--
-- This function is the bridge: it runs as its owner so it can write the
-- counter, while the identifier is taken from auth.uid() INSIDE the function
-- and never from a caller-supplied argument, so one student cannot consume or
-- inspect another student's quota.
-- =============================================================================

create or replace function public.consume_rate_limit(
  p_endpoint       text,
  p_limit          integer,
  p_window_seconds integer default 3600
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid    uuid := auth.uid();
  v_window timestamptz;
  v_count  integer;
begin
  if v_uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;
  if p_limit is null or p_limit < 1 or p_window_seconds is null or p_window_seconds < 1 then
    raise exception 'invalid rate limit parameters';
  end if;

  -- Fixed window: bucket "now" down to the start of the current period.
  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_events (identifier, endpoint, window_start, attempt_count)
  values (v_uid::text, p_endpoint, v_window, 1)
  on conflict (identifier, endpoint, window_start)
  do update set attempt_count = public.rate_limit_events.attempt_count + 1
  returning attempt_count into v_count;

  return jsonb_build_object(
    'allowed',   v_count <= p_limit,
    'count',     v_count,
    'remaining', greatest(p_limit - v_count, 0),
    'reset_at',  v_window + make_interval(secs => p_window_seconds)
  );
end;
$$;

-- Callable by a signed-in user; the table itself stays unreachable.
revoke all on function public.consume_rate_limit(text, integer, integer) from public, anon;
grant execute on function public.consume_rate_limit(text, integer, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Housekeeping. Schedule both with pg_cron:
--   select cron.schedule('purge-rate-limits', '0 * * * *',
--                        $$ select public.purge_rate_limit_events() $$);
--   select cron.schedule('purge-chat', '30 3 * * *',
--                        $$ select public.purge_old_chat_messages() $$);
-- -----------------------------------------------------------------------------
create or replace function public.purge_rate_limit_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from public.rate_limit_events where window_start < now() - interval '7 days';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- D-31: chat history is persisted with a stated 12-month retention period.
-- The period is named in the privacy notice, so it must actually be enforced.
create or replace function public.purge_old_chat_messages()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  delete from public.chat_messages where created_at < now() - interval '12 months';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.purge_rate_limit_events() from public, anon, authenticated;
revoke all on function public.purge_old_chat_messages() from public, anon, authenticated;
