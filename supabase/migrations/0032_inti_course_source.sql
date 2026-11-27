-- Numbered 0032 (not 0030): the scholarship work had already claimed 0030 and 0031.
-- Register INTI International University & Colleges as a course source (November 2026):
-- foundation, diploma and bachelor programmes from newinti.edu.my (offered across the
-- university and its Subang and Penang colleges; campuses are kept as evidence).
-- Destinations mirror scraper/course_sources.json exactly. No course rows are created here.

insert into public.universities(name,type,state) values('INTI International University & Colleges','private','Negeri Sembilan') on conflict(name) do nothing;
update public.universities set is_active = true where name = 'INTI International University & Colleges';
insert into public.course_source_registry select 'inti','INTI International University & Colleges','Negeri Sembilan',id,array['foundation','diploma','degree'],'2026/2027','{"newinti.edu.my": {"path": "/(?:wp-sitemap-posts-product-1\\.xml|programme/(?:foundation|diploma|bachelor)[a-z0-9-]*)", "query": ""}}'::jsonb from public.universities where name='INTI International University & Colleges'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
