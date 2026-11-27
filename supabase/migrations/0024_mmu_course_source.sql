-- Register Multimedia University (MMU) as a course source (November 2026).
-- Destinations mirror scraper/course_sources.json exactly (the ingest function
-- validates every source URL against this registry). No course rows are created
-- here; the course crawler adds them through ingest_course_source.

insert into public.universities(name,type,state) values('Multimedia University','private','Selangor') on conflict(name) do nothing;
insert into public.course_source_registry select 'mmu','Multimedia University','Selangor',id,array['foundation','diploma','degree'],'2026/2027','{"www.mmu.edu.my": {"path": "/(?:courses-sitemap\\.xml|(?:programmes-by-faculty-all/programmes-by-faculty-[a-z]+|pogrammes-all/programmes-new)/(?:bachelor|diploma|foundation)-[a-z0-9-]+)", "query": ""}}'::jsonb from public.universities where name='Multimedia University'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
