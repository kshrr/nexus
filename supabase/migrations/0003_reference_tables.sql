-- =============================================================================
-- 0003_reference_tables.sql
-- Publicly-readable reference data: universities, courses, careers, career
-- pathway stages, the career/course join, scholarships and their criteria.
-- Schema from architecture.md §3.3, §3.4.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- universities
-- -----------------------------------------------------------------------------
create table public.universities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  type       text check (type in ('public', 'private', 'polytechnic', 'college')),
  state      text,
  is_active  boolean not null default true
);

-- -----------------------------------------------------------------------------
-- courses
-- -----------------------------------------------------------------------------
create table public.courses (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  field_of_study         text not null,
  university_id          uuid references public.universities (id),
  pathway_type           text check (pathway_type in
                            ('foundation', 'diploma', 'matriculation', 'stpm', 'degree')),
  duration_months        smallint check (duration_months is null or duration_months > 0),
  entry_requirements     text not null,
  required_subject_codes text[] not null default '{}',
  is_active              boolean not null default true
);

create index idx_courses_field on public.courses (field_of_study);
create index idx_courses_required_subjects on public.courses using gin (required_subject_codes);

-- -----------------------------------------------------------------------------
-- careers  (each carries a predefined RIASEC profile — architecture.md §2.6.4)
-- -----------------------------------------------------------------------------
create table public.careers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null unique,
  field           text not null,
  description     text not null,
  required_skills text[] not null default '{}',
  riasec_profile  char(3) not null check (riasec_profile ~ '^[RIASEC]{3}$'),
  is_active       boolean not null default true
);

-- -----------------------------------------------------------------------------
-- career_pathway_stages  (FR11 roadmap — one roadmap per (career, start level))
-- -----------------------------------------------------------------------------
create table public.career_pathway_stages (
  id                   uuid primary key default gen_random_uuid(),
  career_id            uuid not null references public.careers (id) on delete cascade,
  from_education_level text not null check (from_education_level in
                         ('spm', 'stpm', 'stam', 'matriculation', 'foundation', 'diploma')),
  stage_order          smallint not null,
  stage_title          text not null,
  stage_description    text not null,
  focus_points         text[] not null default '{}',
  unique (career_id, from_education_level, stage_order)
);

-- -----------------------------------------------------------------------------
-- career_courses  (many-to-many, backs FR-PATH-04)
-- -----------------------------------------------------------------------------
create table public.career_courses (
  career_id  uuid not null references public.careers (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  primary key (career_id, course_id)
);

-- -----------------------------------------------------------------------------
-- scholarships
-- is_manual protects admin corrections from the weekly crawler overwrite.
-- -----------------------------------------------------------------------------
create table public.scholarships (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  provider          text not null,
  description       text,
  funding_amount    text,                       -- free text; providers vary
  field_of_study    text[] not null default '{}',
  education_levels  text[] not null default '{}',
  deadline          date,                        -- nullable: rolling intakes exist
  application_link  text check (application_link is null or application_link like 'https://%'),
  status            text not null default 'active'
                      check (status in ('active', 'expired', 'flagged', 'archived')),
  source_url        text,
  source_hash       text,                        -- natural key for crawler upsert
  last_scraped_at   timestamptz,
  is_manual         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index uq_scholarships_source_hash
  on public.scholarships (source_hash) where source_hash is not null;
create index idx_scholarships_deadline on public.scholarships (deadline);
create index idx_scholarships_status on public.scholarships (status);
create index idx_scholarships_field on public.scholarships using gin (field_of_study);
create index idx_scholarships_levels on public.scholarships using gin (education_levels);

-- -----------------------------------------------------------------------------
-- scholarship_criteria  (machine-checkable eligibility — FR10, architecture.md §3.4)
-- is_checkable = false  -> rendered as "cannot verify", never as a failure.
-- -----------------------------------------------------------------------------
create table public.scholarship_criteria (
  id             uuid primary key default gen_random_uuid(),
  scholarship_id uuid not null references public.scholarships (id) on delete cascade,
  criterion_type text not null check (criterion_type in
                   ('citizenship', 'education_level', 'field_of_study',
                    'min_grade', 'subject_grade', 'age', 'other')),
  operator       text not null check (operator in ('eq', 'in', 'gte', 'lte', 'contains')),
  value          jsonb not null,
  label          text not null,     -- human-readable checklist line
  is_checkable   boolean not null default true
);

create index idx_scholarship_criteria_scholarship
  on public.scholarship_criteria (scholarship_id);
