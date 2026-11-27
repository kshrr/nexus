-- Universiti Teknologi MARA is no longer part of Nexus.
--
-- It was seeded in 0009 (id a0000000-0000-4000-8000-000000000005). Deactivate rather than
-- delete: courses.university_id references universities, and an inactive row keeps history and
-- audit trails intact. Public pages and the landing-page map only read is_active = true rows.
-- Its courses are deactivated too, so none stay visible under an inactive university.
-- Safe to re-run.
update public.courses
   set is_active = false
 where university_id = 'a0000000-0000-4000-8000-000000000005'
   and is_active;

update public.universities
   set is_active = false
 where id = 'a0000000-0000-4000-8000-000000000005'
   and is_active;
