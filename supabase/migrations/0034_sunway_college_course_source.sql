-- Register Sunway College as a course source (November 2026): its diplomas, the
-- Sunway foundations and Monash University Foundation Year. Destinations mirror
-- scraper/course_sources.json exactly. No course rows are created here.

insert into public.universities(name,type,state) values('Sunway College','college','Selangor') on conflict(name) do nothing;
update public.universities set is_active = true where name = 'Sunway College';
insert into public.course_source_registry select 'sunway_college','Sunway College','Selangor',id,array['foundation','diploma'],'2026/2027','{"sunwaycollege.edu.my": {"path": "/(?:sitemap\\.xml|programmes/diploma-studies/[a-z0-9-]+/diploma-[a-z0-9-]+|programmes/pre-university-foundation/(?:sunway-foundation-[a-z0-9-]+|monash-university-foundation-year))", "query": ""}}'::jsonb from public.universities where name='Sunway College'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
