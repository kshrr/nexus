-- Register Taylor's University as a course source (November 2026).
-- Destinations mirror scraper/course_sources.json exactly (the ingest function
-- validates every source URL against this registry): the XML sitemap and the
-- bachelor and diploma programme pages. No course rows are created here.

insert into public.universities(name,type,state) values('Taylor''s University','private','Selangor') on conflict(name) do nothing;
update public.universities set is_active = true where name = 'Taylor''s University';
insert into public.course_source_registry select 'taylors','Taylor''s University','Selangor',id,array['diploma','degree'],'2026/2027','{"university.taylors.edu.my": {"path": "/(?:en\\.sitemap\\.xml|en/study/explore-all-programmes/[a-z0-9-]+/undergraduate/(?:bachelor|diploma)-[a-z0-9-]+\\.html)", "query": ""}}'::jsonb from public.universities where name='Taylor''s University'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
