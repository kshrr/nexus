-- Retire the UniMAP and USIM course sources (November 2026). Their adapters no
-- longer work: UniMAP's requirement documents refuse automated access and USIM's
-- programme catalogue page no longer renders a programme list. Only sources with
-- a working adapter stay in the registry.
--
-- Courses previously published from these sources are hidden from students
-- (is_active=false), not deleted, so the rows can be restored if a working
-- adapter is added later. University rows are kept.

update public.courses set is_active = false
where id in (
  select course_id from public.course_source_records
  where source in ('unimap', 'usim') and course_id is not null
);

delete from public.course_source_records where source in ('unimap', 'usim');
delete from public.course_crawl_runs where source in ('unimap', 'usim');
delete from public.course_source_registry where source in ('unimap', 'usim');
