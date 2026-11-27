-- Hide the hand-entered demonstration courses from 0009 (November 2026). The course
-- catalogue now comes from official university sources only. Rows are hidden, not
-- deleted, so saved items and past recommendations that reference them still resolve.
-- Their career links are removed so career pages list only published official courses.
-- Universities left with no active course and no registered course source (the 0009
-- demonstration universities and the retired UniMAP, USIM and UUM sources) are hidden.

update public.courses set is_active = false
where id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000012');

delete from public.career_courses
where course_id in ('c0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000010', 'c0000000-0000-4000-8000-000000000011', 'c0000000-0000-4000-8000-000000000012');

update public.universities u set is_active = false
where u.name in ('Universiti Sains Malaysia', 'Universiti Putra Malaysia', 'Universiti Teknologi MARA',
                 'Universiti Malaysia Perlis', 'Universiti Sains Islam Malaysia', 'Universiti Utara Malaysia')
  and not exists (select 1 from public.courses c where c.university_id = u.id and c.is_active)
  and not exists (select 1 from public.course_source_registry r where r.university_id = u.id);
