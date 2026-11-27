-- Register UUM, UniSZA and UTeM as university course sources.
-- Destinations mirror scraper/course_sources.json exactly (the ingest function
-- validates every source URL against this registry). No course rows are created
-- here; the course crawler adds them through ingest_course_source after review rules.

insert into public.universities(name,type,state) values('Universiti Utara Malaysia','public','Kedah') on conflict(name) do nothing;
insert into public.course_source_registry select 'uum','Universiti Utara Malaysia','Kedah',id,array['degree'],'2026/2027','{"www.uum.edu.my": {"path": "/index\\.php/admissions/application-guidelines/undergraduate-local(?:/local/bachelor-[a-z0-9-]+)?", "query": ""}}'::jsonb from public.universities where name='Universiti Utara Malaysia'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;

insert into public.universities(name,type,state) values('Universiti Sultan Zainal Abidin','public','Terengganu') on conflict(name) do nothing;
insert into public.course_source_registry select 'unisza','Universiti Sultan Zainal Abidin','Terengganu',id,array['foundation','diploma','degree'],'2026/2027','{"www.unisza.edu.my": {"path": "/(?:wp-sitemap-posts-our-faculties-1\\.xml|our-faculties/(?:bachelor-|b-tech-|diploma-|foundation-)[a-z0-9-]+)", "query": ""}}'::jsonb from public.universities where name='Universiti Sultan Zainal Abidin'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;

insert into public.universities(name,type,state) values('Universiti Teknikal Malaysia Melaka','public','Melaka') on conflict(name) do nothing;
insert into public.course_source_registry select 'utem','Universiti Teknikal Malaysia Melaka','Melaka',id,array['diploma','degree'],'2026/2027','{"www.utem.edu.my": {"path": "/en/(?:undergraduate\\.html|downloads/kemasukan/[0-9]+-sesi-[0-9]{8}-[a-z0-9-]+(?:/file)?\\.html)", "query": ""}}'::jsonb from public.universities where name='Universiti Teknikal Malaysia Melaka'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
