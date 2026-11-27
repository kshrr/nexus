-- Register Universiti Teknologi Malaysia (UTM) as a course source (November 2026).
-- Destinations mirror scraper/course_sources.json exactly (the ingest function
-- validates every source URL against this registry): the entry-requirements page,
-- the programmes sitemap, bachelor programme pages and the session requirement book.
-- The university row already exists from 0009; no course rows are created here.

insert into public.universities(name,type,state) values('Universiti Teknologi Malaysia','public','Johor') on conflict(name) do nothing;
update public.universities set is_active = true where name = 'Universiti Teknologi Malaysia';
insert into public.course_source_registry select 'utm','Universiti Teknologi Malaysia','Johor',id,array['degree'],'2026/2027','{"admission.utm.my": {"path": "/(?:entry-requirements-ug-malaysian|wp-sitemap-posts-programmes-1\\.xml|programmes/bachelor-[a-z0-9-]+|wp-content/uploads/sites/461/[0-9]{4}/[0-9]{2}/[A-Za-z0-9_-]*SYARAT-KEMASUKAN[A-Za-z0-9_-]*\\.pdf)", "query": ""}}'::jsonb from public.universities where name='Universiti Teknologi Malaysia'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
