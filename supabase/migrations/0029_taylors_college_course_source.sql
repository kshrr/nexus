-- Register Taylor's College as a course source (November 2026): Taylor's foundation
-- and diploma programmes, on a separate site from Taylor's University. Destinations
-- mirror scraper/course_sources.json exactly. No course rows are created here.

insert into public.universities(name,type,state) values('Taylor''s College','college','Selangor') on conflict(name) do nothing;
update public.universities set is_active = true where name = 'Taylor''s College';
insert into public.course_source_registry select 'taylors_college','Taylor''s College','Selangor',id,array['foundation','diploma'],'2026/2027','{"college.taylors.edu.my": {"path": "/(?:en\\.sitemap\\.xml|en/study/explore-all-programmes/school-of-(?:pre-university|diploma)-studies/(?:foundation|diploma)/(?:foundation|diploma)-[a-z0-9-]+\\.html)", "query": ""}}'::jsonb from public.universities where name='Taylor''s College'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
