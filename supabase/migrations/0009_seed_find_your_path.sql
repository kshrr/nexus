-- =============================================================================
-- 0009_seed_find_your_path.sql
--
-- Reference data the recommendation engine resolves its rule outputs against:
-- universities, courses, careers (with RIASEC profiles), and the career/course
-- join.
--
-- OPEN DECISION — D-19 / M-16. architecture.md calls for a "manual,
-- MQA-accredited subset" but the report names no dataset. The rows below are a
-- small DEMONSTRATION set: every course field_of_study is one that a documented
-- rule emits, and the entries anchored on names the docs themselves use
-- (Bachelor of Pharmacy at USM, Pharmacist = ICR). Programme details and the
-- per-career RIASEC profiles must be verified against MQA / provider sources
-- before they are presented as fact in the thesis.
--
-- Fixed UUIDs make the seed idempotent across `supabase db reset` and re-runs.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- universities
-- -----------------------------------------------------------------------------
insert into public.universities (id, name, type, state, is_active) values
  ('a0000000-0000-4000-8000-000000000001', 'Universiti Sains Malaysia',        'public', 'Pulau Pinang', true),
  ('a0000000-0000-4000-8000-000000000002', 'Universiti Malaya',                'public', 'Kuala Lumpur', true),
  ('a0000000-0000-4000-8000-000000000003', 'Universiti Teknologi Malaysia',    'public', 'Johor',        true),
  ('a0000000-0000-4000-8000-000000000004', 'Universiti Putra Malaysia',        'public', 'Selangor',     true),
  ('a0000000-0000-4000-8000-000000000005', 'Universiti Teknologi MARA',        'public', 'Selangor',     true)
on conflict (id) do update
  set name = excluded.name, type = excluded.type, state = excluded.state;

-- -----------------------------------------------------------------------------
-- careers  (riasec_profile backs the §9.6 secondary signal)
-- -----------------------------------------------------------------------------
insert into public.careers (id, name, field, description, required_skills, riasec_profile, is_active) values
  ('b0000000-0000-4000-8000-000000000001', 'Medical Doctor', 'Healthcare',
   'Diagnoses and treats illness and injury, working with patients in clinics, hospitals or the community.',
   '{Clinical reasoning,Communication,Attention to detail,Resilience}', 'ISR', true),
  ('b0000000-0000-4000-8000-000000000002', 'Pharmacist', 'Healthcare',
   'Prepares and dispenses medicines, advises on safe use, and checks prescriptions for interactions and errors.',
   '{Pharmacology,Precision,Patient counselling,Record keeping}', 'ICR', true),
  ('b0000000-0000-4000-8000-000000000003', 'Biomedical Scientist', 'Healthcare',
   'Runs laboratory investigations that support diagnosis and medical research.',
   '{Laboratory technique,Data analysis,Method design}', 'IRC', true),
  ('b0000000-0000-4000-8000-000000000004', 'Civil Engineer', 'Engineering',
   'Designs and oversees construction of infrastructure such as roads, bridges, drainage and buildings.',
   '{Structural analysis,Project management,CAD,Site supervision}', 'RIC', true),
  ('b0000000-0000-4000-8000-000000000005', 'Software Engineer', 'Technology',
   'Designs, builds and maintains software systems.',
   '{Programming,Problem solving,Systems design,Testing}', 'IRC', true),
  ('b0000000-0000-4000-8000-000000000006', 'Data Scientist', 'Technology',
   'Turns data into decisions using statistics, programming and domain knowledge.',
   '{Statistics,Programming,Data visualisation,Communication}', 'ICR', true),
  ('b0000000-0000-4000-8000-000000000007', 'Architect', 'Built environment',
   'Designs buildings and spaces, balancing how they look, how they are used and how they are built.',
   '{Design,Spatial reasoning,Technical drawing,Regulations}', 'AIR', true),
  ('b0000000-0000-4000-8000-000000000008', 'Graphic Designer', 'Creative',
   'Communicates ideas visually through typography, imagery, layout and colour.',
   '{Visual composition,Typography,Design software,Client briefing}', 'AES', true),
  ('b0000000-0000-4000-8000-000000000009', 'Multimedia Designer', 'Creative',
   'Produces interactive and moving-image work across web, video, animation and games.',
   '{Animation,Interaction design,Video editing,Storyboarding}', 'ARE', true),
  ('b0000000-0000-4000-8000-000000000010', 'Nurse', 'Healthcare',
   'Provides and coordinates direct patient care in hospitals, clinics and the community.',
   '{Patient care,Clinical observation,Teamwork,Empathy}', 'SIA', true),
  ('b0000000-0000-4000-8000-000000000011', 'Accountant', 'Business & finance',
   'Prepares, examines and reports on financial records for organisations.',
   '{Financial reporting,Accuracy,Regulation,Analysis}', 'CEI', true),
  ('b0000000-0000-4000-8000-000000000012', 'Secondary School Teacher', 'Education',
   'Plans and delivers lessons, assesses progress and supports students through secondary school.',
   '{Subject knowledge,Explanation,Classroom management,Assessment}', 'SAE', true)
on conflict (id) do update
  set name = excluded.name, field = excluded.field, description = excluded.description,
      required_skills = excluded.required_skills, riasec_profile = excluded.riasec_profile;

-- -----------------------------------------------------------------------------
-- courses  (field_of_study MUST match the course_fields a rule emits)
-- -----------------------------------------------------------------------------
insert into public.courses
  (id, name, field_of_study, university_id, pathway_type, duration_months,
   entry_requirements, required_subject_codes, is_active) values
  ('c0000000-0000-4000-8000-000000000001', 'Bachelor of Pharmacy', 'Pharmacy',
   'a0000000-0000-4000-8000-000000000001', 'degree', 48,
   '5 credits at SPM including Biology and Chemistry, plus a recognised pre-university qualification.',
   '{BIOLOGY,CHEMISTRY,MATH}', true),
  ('c0000000-0000-4000-8000-000000000002', 'Bachelor of Medicine and Surgery', 'Medicine',
   'a0000000-0000-4000-8000-000000000002', 'degree', 60,
   'Excellent results in Biology, Chemistry and Physics or Mathematics, plus an interview.',
   '{BIOLOGY,CHEMISTRY,PHYSICS}', true),
  ('c0000000-0000-4000-8000-000000000003', 'Bachelor of Biomedical Science', 'Biomedical Science',
   'a0000000-0000-4000-8000-000000000004', 'degree', 48,
   'Credits in Biology and Chemistry, plus a recognised pre-university qualification.',
   '{BIOLOGY,CHEMISTRY}', true),
  ('c0000000-0000-4000-8000-000000000004', 'Bachelor of Civil Engineering', 'Engineering',
   'a0000000-0000-4000-8000-000000000003', 'degree', 48,
   'Credits in Additional Mathematics and Physics, plus a recognised pre-university qualification.',
   '{ADD_MATH,PHYSICS,MATH}', true),
  ('c0000000-0000-4000-8000-000000000005', 'Bachelor of Mechanical Engineering', 'Engineering',
   'a0000000-0000-4000-8000-000000000003', 'degree', 48,
   'Credits in Additional Mathematics and Physics, plus a recognised pre-university qualification.',
   '{ADD_MATH,PHYSICS,MATH}', true),
  ('c0000000-0000-4000-8000-000000000006', 'Bachelor of Computer Science', 'Computer Science',
   'a0000000-0000-4000-8000-000000000002', 'degree', 48,
   'Credit in Additional Mathematics, plus a recognised pre-university qualification.',
   '{ADD_MATH,MATH}', true),
  ('c0000000-0000-4000-8000-000000000007', 'Bachelor of Computer Science (Software Engineering)', 'Computer Science',
   'a0000000-0000-4000-8000-000000000001', 'degree', 48,
   'Credit in Additional Mathematics, plus a recognised pre-university qualification.',
   '{ADD_MATH,MATH}', true),
  ('c0000000-0000-4000-8000-000000000008', 'Bachelor of Data Science', 'Data Science',
   'a0000000-0000-4000-8000-000000000004', 'degree', 48,
   'Credit in Additional Mathematics, plus a recognised pre-university qualification.',
   '{ADD_MATH,MATH}', true),
  ('c0000000-0000-4000-8000-000000000009', 'Bachelor of Science (Architecture)', 'Architecture',
   'a0000000-0000-4000-8000-000000000001', 'degree', 36,
   'Credits in Mathematics and Physics, a portfolio, plus a recognised pre-university qualification.',
   '{MATH,PHYSICS,PSV}', true),
  ('c0000000-0000-4000-8000-000000000010', 'Bachelor of Design (Graphic Design)', 'Design',
   'a0000000-0000-4000-8000-000000000005', 'degree', 36,
   'A portfolio, plus a recognised pre-university qualification.',
   '{PSV}', true),
  ('c0000000-0000-4000-8000-000000000011', 'Bachelor of Multimedia Technology', 'Multimedia Technology',
   'a0000000-0000-4000-8000-000000000005', 'degree', 36,
   'Credit in Mathematics and a portfolio, plus a recognised pre-university qualification.',
   '{MATH,PSV,ICT}', true),
  ('c0000000-0000-4000-8000-000000000012', 'Bachelor of Industrial Design', 'Design Engineering',
   'a0000000-0000-4000-8000-000000000003', 'degree', 48,
   'Credits in Mathematics and Physics and a portfolio, plus a recognised pre-university qualification.',
   '{MATH,PHYSICS,PSV}', true)
on conflict (id) do update
  set name = excluded.name, field_of_study = excluded.field_of_study,
      university_id = excluded.university_id, pathway_type = excluded.pathway_type,
      duration_months = excluded.duration_months,
      entry_requirements = excluded.entry_requirements,
      required_subject_codes = excluded.required_subject_codes;

-- -----------------------------------------------------------------------------
-- career_courses  (which programmes lead to which career)
-- -----------------------------------------------------------------------------
insert into public.career_courses (career_id, course_id) values
  ('b0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000002'),
  ('b0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001'),
  ('b0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003'),
  ('b0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000004'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000006'),
  ('b0000000-0000-4000-8000-000000000005', 'c0000000-0000-4000-8000-000000000007'),
  ('b0000000-0000-4000-8000-000000000006', 'c0000000-0000-4000-8000-000000000008'),
  ('b0000000-0000-4000-8000-000000000007', 'c0000000-0000-4000-8000-000000000009'),
  ('b0000000-0000-4000-8000-000000000008', 'c0000000-0000-4000-8000-000000000010'),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000011'),
  ('b0000000-0000-4000-8000-000000000009', 'c0000000-0000-4000-8000-000000000012')
on conflict (career_id, course_id) do nothing;
