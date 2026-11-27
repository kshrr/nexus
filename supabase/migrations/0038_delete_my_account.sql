-- Let a signed-in student permanently delete their own account.
--
-- Deleting an auth user needs elevated rights, so this is a SECURITY DEFINER function that only ever
-- acts on auth.uid() (the caller) and takes no arguments. Removing the auth user cascades to the
-- profile and, through it, to results, saved items, recommendations, chat history and consent records.
--
-- Administrators are refused: they own crawl logs and shared catalogue records, and an admin account
-- should be removed deliberately by another admin, not by accident from a profile page.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  caller uuid := auth.uid();
  caller_role text;
begin
  if caller is null then
    raise exception 'Sign in to delete your account.' using errcode = '28000';
  end if;

  select role into caller_role from public.profiles where id = caller;
  if caller_role = 'admin' then
    raise exception 'Admin accounts cannot be deleted from here.' using errcode = '42501';
  end if;

  delete from auth.users where id = caller;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

comment on function public.delete_my_account() is
  'Permanently deletes the calling student''s auth user and, by cascade, all of their data. Refuses admins.';
