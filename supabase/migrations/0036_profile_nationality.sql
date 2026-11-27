-- Optional, self-declared nationality on the student profile.
--
-- ui-specifications.md §9.1 originally ruled out collecting nationality. It is
-- now collected ONLY as an optional answer the student can skip or clear, so
-- scholarship requirements of the form "Malaysian citizen" can be checked:
--   'malaysian' | 'non_malaysian' | null (not answered — reported as "can't
--   check", never as a failure)
-- No IC number, date of birth, income or state of origin is collected.
-- The column lives on profiles, so the existing owner-only RLS applies: only
-- the student can read or change it (admins are excluded, §4.4). It is not in
-- the chatbot context allowlist.
alter table public.profiles
  add column nationality text
  check (nationality is null or nationality in ('malaysian', 'non_malaysian'));

comment on column public.profiles.nationality is
  'Optional self-declared nationality for scholarship citizenship checks; null = not answered.';
