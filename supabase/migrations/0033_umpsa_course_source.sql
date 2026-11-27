-- Numbered 0033 (not 0031): the scholarship work had already claimed 0030 and 0031.
-- Register Universiti Malaysia Pahang Al-Sultan Abdullah (UMPSA) as a course source
-- (November 2026): diploma and bachelor programmes from admission.umpsa.edu.my.
-- Destinations mirror scraper/course_sources.json exactly. No course rows are created here.

insert into public.universities(name,type,state) values('Universiti Malaysia Pahang Al-Sultan Abdullah','public','Pahang') on conflict(name) do nothing;
update public.universities set is_active = true where name = 'Universiti Malaysia Pahang Al-Sultan Abdullah';
insert into public.course_source_registry select 'umpsa','Universiti Malaysia Pahang Al-Sultan Abdullah','Pahang',id,array['diploma','degree'],'2026/2027','{"admission.umpsa.edu.my": {"path": "/(?:ug-programme|undergraduate-study/[a-z0-9-]+/[a-z0-9-]+)", "query": ""}}'::jsonb from public.universities where name='Universiti Malaysia Pahang Al-Sultan Abdullah'
 on conflict(source) do update set name=excluded.name,state=excluded.state,levels=excluded.levels,session=excluded.session,destinations=excluded.destinations;
