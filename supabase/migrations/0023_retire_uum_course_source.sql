-- Retire the UUM course source (November 2026). www.uum.edu.my refuses
-- connections from the United States, where GitHub-hosted runners run, so the
-- scheduled sync cannot reach it. Same treatment as 0022: any scraped UUM
-- courses are hidden (not deleted) and its sync history is removed. The
-- university row is kept.

update public.courses set is_active = false
where id in (
  select course_id from public.course_source_records
  where source = 'uum' and course_id is not null
);

delete from public.course_source_records where source = 'uum';
delete from public.course_crawl_runs where source = 'uum';
delete from public.course_source_registry where source = 'uum';
