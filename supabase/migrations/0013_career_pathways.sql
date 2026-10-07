-- =============================================================================
-- 0013_career_pathways.sql
--
-- Completes the deliberately thin Stage 7 career knowledge base without
-- duplicating the existing careers, courses or scholarships catalogs.
-- Existing RLS from 0006 already grants public reads and admin-only writes to
-- careers, career_pathway_stages and career_courses.
-- =============================================================================

alter table public.careers
  add column if not exists slug text,
  add column if not exists responsibilities text[] not null default '{}',
  add column if not exists useful_subjects text[] not null default '{}',
  add column if not exists education_routes text[] not null default '{}';

update public.careers
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null;

alter table public.careers alter column slug set not null;
create unique index if not exists uq_careers_slug on public.careers (slug);
create index if not exists idx_careers_field on public.careers (field);

-- Archived careers and their relationship rows are not published content.
-- Administrators retain visibility through is_admin(); students and anonymous
-- readers see only active records. Write policies remain the admin-only rules
-- established in 0006.
drop policy if exists careers_select on public.careers;
create policy careers_select on public.careers
  for select using (is_active or public.is_admin());

drop policy if exists career_pathway_stages_select on public.career_pathway_stages;
create policy career_pathway_stages_select on public.career_pathway_stages
  for select using (
    public.is_admin() or exists (
      select 1 from public.careers c
      where c.id = career_pathway_stages.career_id and c.is_active
    )
  );

drop policy if exists career_courses_select on public.career_courses;
create policy career_courses_select on public.career_courses
  for select using (
    public.is_admin() or exists (
      select 1 from public.careers c
      where c.id = career_courses.career_id and c.is_active
    )
  );

create or replace function public.ensure_career_slug()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'));
  end if;
  return new;
end;
$$;

drop trigger if exists trg_careers_slug on public.careers;
create trigger trg_careers_slug
  before insert or update on public.careers
  for each row execute function public.ensure_career_slug();

-- Curated additions requested by the student experience. These are concise
-- descriptions of work and study direction, not claims about licensing or
-- guaranteed entry. Formal requirements remain with institutions/regulators.
insert into public.careers
  (id, name, slug, field, description, responsibilities, required_skills,
   useful_subjects, education_routes, riasec_profile, is_active)
values
  ('b0000000-0000-4000-8000-000000000013', 'Cybersecurity Analyst', 'cybersecurity-analyst',
   'Computing & Technology',
   'Helps organisations protect systems and information by identifying risks, monitoring threats and improving security controls.',
   '{Monitor systems for suspicious activity,Investigate security incidents,Test and improve security controls,Explain risks to technical and non-technical teams}',
   '{Network security,Problem solving,Scripting,Risk communication}',
   '{MATH,ADD_MATH,ICT,SAINS_KOMP,BI}',
   '{Foundation or matriculation in computing or science,STPM or STAM followed by a relevant degree,Diploma in IT or computer science,Computer science or cybersecurity degree}',
   'IRC', true),
  ('b0000000-0000-4000-8000-000000000014', 'Data Analyst', 'data-analyst',
   'Computing & Technology',
   'Examines data to find patterns, answer practical questions and communicate evidence for better decisions.',
   '{Prepare and check datasets,Analyse trends and patterns,Create charts and reports,Present findings to decision makers}',
   '{Data analysis,Spreadsheets or SQL,Data visualisation,Communication}',
   '{MATH,ADD_MATH,SAINS_KOMP,ICT,BI}',
   '{Foundation or matriculation in science or computing,STPM followed by a quantitative degree,Diploma in IT or data-related studies,Data science statistics or computer science degree}',
   'ICR', true)
on conflict (id) do update set
  name = excluded.name, slug = excluded.slug, field = excluded.field,
  description = excluded.description, responsibilities = excluded.responsibilities,
  required_skills = excluded.required_skills, useful_subjects = excluded.useful_subjects,
  education_routes = excluded.education_routes, riasec_profile = excluded.riasec_profile,
  is_active = excluded.is_active;

-- Enrich and normalise the careers already seeded for Find Your Path. Keeping
-- the same UUIDs means saved items and recommendation targets remain valid.
update public.careers set
  field = 'Healthcare',
  responsibilities = '{Assess patients and symptoms,Plan and explain treatment,Keep accurate clinical records,Work with a healthcare team}',
  useful_subjects = '{BIOLOGY,CHEMISTRY,PHYSICS,MATH,BI}',
  education_routes = '{Recognised pre-university science route,Medicine degree,Supervised clinical training}'
where name = 'Medical Doctor';

update public.careers set
  field = 'Healthcare',
  responsibilities = '{Review and dispense medicines,Check prescriptions and interactions,Counsel patients on safe medicine use,Maintain accurate records}',
  useful_subjects = '{BIOLOGY,CHEMISTRY,MATH,BI}',
  education_routes = '{Recognised pre-university science route,Pharmacy degree,Supervised practice where formally required}'
where name = 'Pharmacist';

update public.careers set
  field = 'Science',
  responsibilities = '{Prepare and analyse laboratory samples,Operate laboratory equipment,Record and interpret results,Follow quality and safety procedures}',
  useful_subjects = '{BIOLOGY,CHEMISTRY,MATH,BI}',
  education_routes = '{Foundation matriculation or STPM in science,Diploma in laboratory or biomedical studies,Biomedical science or related degree}'
where name = 'Biomedical Scientist';

update public.careers set
  field = 'Engineering',
  responsibilities = '{Develop infrastructure designs,Analyse structures and materials,Coordinate projects and site work,Check safety and technical standards}',
  useful_subjects = '{MATH,ADD_MATH,PHYSICS,REKA_CIPTA,BI}',
  education_routes = '{Foundation matriculation or STPM in science,Diploma in civil engineering,Civil engineering degree}'
where name = 'Civil Engineer';

update public.careers set
  field = 'Computing & Technology',
  responsibilities = '{Translate needs into software designs,Write and review code,Test and debug systems,Maintain and improve applications}',
  useful_subjects = '{MATH,ADD_MATH,SAINS_KOMP,ICT,BI}',
  education_routes = '{Foundation or matriculation in computing or science,STPM followed by a computing degree,Diploma in IT or computer science,Computer science or software engineering degree}'
where name = 'Software Engineer';

update public.careers set
  field = 'Computing & Technology',
  responsibilities = '{Explore complex datasets,Build statistical or predictive models,Evaluate model quality,Communicate findings responsibly}',
  useful_subjects = '{MATH,ADD_MATH,SAINS_KOMP,ICT,BI}',
  education_routes = '{Foundation matriculation or STPM in science,Diploma in computing or statistics,Data science computer science or statistics degree}'
where name = 'Data Scientist';

update public.careers set
  field = 'Creative & Design',
  responsibilities = '{Develop design concepts,Prepare drawings and models,Coordinate technical requirements,Present and refine proposals}',
  useful_subjects = '{MATH,PHYSICS,PSV,REKA_CIPTA,BI}',
  education_routes = '{Foundation or STPM with a suitable portfolio,Diploma in architecture or built environment,Architecture degree and any formally required professional stages}'
where name = 'Architect';

update public.careers set
  field = 'Creative & Design',
  responsibilities = '{Interpret a communication brief,Develop visual concepts,Create layouts and digital assets,Refine work using feedback}',
  useful_subjects = '{PSV,REKA_CIPTA,ICT,BI}',
  education_routes = '{Foundation or STPM with a portfolio,Diploma in graphic design,Graphic design or visual communication degree}'
where name = 'Graphic Designer';

update public.careers set
  field = 'Creative & Design',
  responsibilities = '{Plan visual and interactive content,Create animation video or interface assets,Edit and test media,Collaborate with creative and technical teams}',
  useful_subjects = '{PSV,ICT,SAINS_KOMP,REKA_CIPTA,BI}',
  education_routes = '{Foundation or STPM with a portfolio,Diploma in multimedia or digital media,Multimedia animation or interaction design degree}'
where name = 'Multimedia Designer';

update public.careers set
  field = 'Healthcare',
  responsibilities = '{Monitor and support patients,Deliver planned care,Maintain clinical records,Coordinate with patients families and care teams}',
  useful_subjects = '{BIOLOGY,CHEMISTRY,SCIENCE,BM,BI}',
  education_routes = '{Diploma in nursing,Recognised nursing degree,Supervised clinical education required by the programme}'
where name = 'Nurse';

update public.careers set
  field = 'Business & Finance',
  responsibilities = '{Prepare and review financial records,Analyse costs and performance,Support audit and compliance work,Explain financial information}',
  useful_subjects = '{PRINSIP_AKAUN,MATH,EKONOMI,PERNIAGAAN,BI}',
  education_routes = '{Foundation matriculation or STPM in a suitable stream,Diploma in accounting or finance,Accounting finance or business degree,Professional qualifications where chosen}'
where name = 'Accountant';

update public.careers set
  field = 'Education',
  responsibilities = '{Plan and deliver lessons,Assess learning and give feedback,Support student development,Work with colleagues and families}',
  useful_subjects = '{BM,BI,MATH,SEJARAH}',
  education_routes = '{STPM STAM matriculation or foundation,Diploma in a relevant education route,Education degree or subject degree with an approved teaching route}'
where name = 'Secondary School Teacher';

-- Ensure old rows receive stable slugs after upserts above.
update public.careers
set slug = trim(both '-' from regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'))
where slug is null or slug = '';

-- Reuse existing course records. Cybersecurity and data analysis deliberately
-- map to the broader computing/data programmes already in Nexus rather than
-- creating duplicate programme records.
insert into public.career_courses (career_id, course_id)
select c.id, p.id
from public.careers c
join public.courses p on
  (c.name = 'Cybersecurity Analyst' and p.field_of_study = 'Computer Science') or
  (c.name = 'Data Analyst' and p.field_of_study in ('Data Science', 'Computer Science'))
on conflict (career_id, course_id) do nothing;

-- One concise, adaptive roadmap for every supported current education level.
-- Multiple routes are named explicitly; the final UI also carries a guidance
-- disclaimer so these stages cannot be mistaken for formal entry requirements.
insert into public.career_pathway_stages
  (career_id, from_education_level, stage_order, stage_title, stage_description, focus_points)
select c.id, levels.level, stage.stage_order,
  case stage.stage_order
    when 1 then case levels.level
      when 'spm' then 'Build your SPM foundation'
      when 'stpm' then 'Use your STPM foundation'
      when 'stam' then 'Use your STAM foundation'
      when 'matriculation' then 'Complete matriculation strongly'
      when 'foundation' then 'Complete foundation strongly'
      when 'diploma' then 'Build on your diploma'
    end
    when 2 then 'Choose a suitable education route'
    when 3 then 'Study a related field'
    when 4 then 'Build evidence of your skills'
    when 5 then 'Explore ' || c.name || ' opportunities'
  end,
  case stage.stage_order
    when 1 then 'Focus on useful subjects and transferable skills while checking the latest programme entry information.'
    when 2 then case levels.level
      when 'spm' then 'Compare foundation, matriculation, STPM, STAM and diploma options. More than one route may lead forward.'
      when 'diploma' then 'Compare degree progression, credit transfer and suitable entry-level opportunities for your diploma.'
      else 'Compare relevant degrees and diplomas. Entry routes vary by institution and programme.'
    end
    when 3 then 'Choose a programme whose content, entry requirements and learning style support this career direction.'
    when 4 then 'Use projects, practical work, placements or volunteering to practise the skills employers and further study value.'
    when 5 then 'Research real role descriptions, speak with people in the field and verify any formal professional requirements.'
  end,
  case stage.stage_order
    when 1 then c.useful_subjects
    when 2 then c.education_routes
    when 3 then array['Compare course content', 'Check current entry requirements', 'Consider several institutions']::text[]
    when 4 then c.required_skills
    when 5 then array['Explore related roles', 'Build a portfolio or CV', 'Verify formal requirements']::text[]
  end
from public.careers c
cross join (values ('spm'), ('stpm'), ('stam'), ('matriculation'), ('foundation'), ('diploma')) levels(level)
cross join (values (1), (2), (3), (4), (5)) stage(stage_order)
where c.is_active
on conflict (career_id, from_education_level, stage_order) do update set
  stage_title = excluded.stage_title,
  stage_description = excluded.stage_description,
  focus_points = excluded.focus_points;

-- New careers created from the admin catalog get an honest starter roadmap
-- instead of a blank detail page. Administrators can then refine the route and
-- course mappings without hand-creating thirty rows.
create or replace function public.initialise_career_pathway()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.career_pathway_stages
    (career_id, from_education_level, stage_order, stage_title, stage_description, focus_points)
  select new.id, levels.level, stage.stage_order,
    case stage.stage_order
      when 1 then 'Start from ' || upper(levels.level)
      when 2 then 'Choose a suitable education route'
      when 3 then 'Study a related field'
      when 4 then 'Build evidence of your skills'
      when 5 then 'Explore ' || new.name || ' opportunities'
    end,
    case stage.stage_order
      when 1 then 'Build a strong foundation and check the latest programme entry information.'
      when 2 then 'Compare several valid routes; institutions may accept different qualifications.'
      when 3 then 'Choose a programme whose content and learning style support this career direction.'
      when 4 then 'Use projects, practical work, placements or volunteering to practise relevant skills.'
      when 5 then 'Research real roles and verify any formal professional requirements.'
    end,
    case stage.stage_order
      when 1 then new.useful_subjects
      when 2 then new.education_routes
      when 3 then array['Compare course content', 'Check current entry requirements']::text[]
      when 4 then new.required_skills
      when 5 then array['Explore related roles', 'Build a portfolio or CV']::text[]
    end
  from (values ('spm'), ('stpm'), ('stam'), ('matriculation'), ('foundation'), ('diploma')) levels(level)
  cross join (values (1), (2), (3), (4), (5)) stage(stage_order)
  on conflict (career_id, from_education_level, stage_order) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_initialise_career_pathway on public.careers;
create trigger trg_initialise_career_pathway
  after insert on public.careers
  for each row execute function public.initialise_career_pathway();

-- Complete audit coverage for the two admin-maintained relationship tables.
drop trigger if exists trg_audit_career_pathway_stages on public.career_pathway_stages;
create trigger trg_audit_career_pathway_stages
  after insert or update or delete on public.career_pathway_stages
  for each row execute function public.log_admin_write();

drop trigger if exists trg_audit_career_courses on public.career_courses;
create trigger trg_audit_career_courses
  after insert or update or delete on public.career_courses
  for each row execute function public.log_admin_write();
