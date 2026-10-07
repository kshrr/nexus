-- =============================================================================
-- 0002_core_tables.sql
-- User identity + assessment + academic + recommendations + saved items + chat.
-- Schema from architecture.md §3.1, §3.2, §3.4 (saved_items), §3.5, §3.6.
--
-- Enumerated values (architecture.md §3.9) are enforced with CHECK constraints
-- rather than native ENUM types, matching the spec wording and keeping later
-- value additions a one-line migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- profiles  (extends auth.users — NO password column; Supabase Auth owns creds)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  full_name          text not null check (char_length(full_name) between 1 and 120),
  email              text not null,
  role               text not null default 'student' check (role in ('student', 'admin')),
  education_level     text check (education_level in
                         ('spm', 'stpm', 'stam', 'matriculation', 'foundation', 'diploma')),
  career_goal        text check (career_goal is null or char_length(career_goal) <= 200),
  target_industry    text,
  profile_completed  boolean not null default false,
  consent_version    text,
  consent_at         timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.profiles is
  'Application profile for each auth.users row. role is read by RLS via public.is_admin(); it must never be writable by the row owner (see 0006 trg_protect_role).';

-- Fast admin lookups for is_admin() and admin-list screens.
create index idx_profiles_role on public.profiles (role) where role = 'admin';

-- -----------------------------------------------------------------------------
-- subjects  (reference table; academic tables FK to it, so it lives here)
-- architecture.md §3.2
-- -----------------------------------------------------------------------------
create table public.subjects (
  code     text primary key,
  name     text not null,
  domain   text not null,   -- science | mathematics | languages | humanities | commerce | technical | arts | religious
  is_core  boolean not null default false
);

comment on column public.subjects.domain is
  'Matched by rule conditions that target a field rather than a named subject (architecture.md §3.2).';

-- -----------------------------------------------------------------------------
-- riasec_results  (one active row per user — retake overwrites)
-- architecture.md §3.2
-- -----------------------------------------------------------------------------
create table public.riasec_results (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  realistic_score      smallint not null check (realistic_score between 0 and 24),
  investigative_score  smallint not null check (investigative_score between 0 and 24),
  artistic_score       smallint not null check (artistic_score between 0 and 24),
  social_score         smallint not null check (social_score between 0 and 24),
  enterprising_score   smallint not null check (enterprising_score between 0 and 24),
  conventional_score   smallint not null check (conventional_score between 0 and 24),
  holland_code         char(3) not null check (holland_code ~ '^[RIASEC]{3}$'),
  completed_at         timestamptz not null default now()
);

comment on table public.riasec_results is
  'user_id as PK enforces overwrite-on-retake structurally (upsert on conflict). Score range 0-24 follows architecture.md §7.2.';

-- -----------------------------------------------------------------------------
-- riasec_responses  (item-level; needed to recompute scores / evidence testing)
-- architecture.md §3.2
-- -----------------------------------------------------------------------------
create table public.riasec_responses (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  question_id     smallint not null check (question_id between 1 and 36),
  response_value  smallint not null check (response_value between 0 and 4),
  answered_at     timestamptz not null default now(),
  primary key (user_id, question_id)
);

-- -----------------------------------------------------------------------------
-- academic_results
-- architecture.md §3.2
-- -----------------------------------------------------------------------------
create table public.academic_results (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  exam_type     text not null check (exam_type in ('form4_final', 'spm_trial', 'spm_actual')),
  subject_code  text not null references public.subjects (code),
  grade         text not null check (grade in
                  ('A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G')),
  created_at    timestamptz not null default now(),
  unique (user_id, exam_type, subject_code)
);

create index idx_academic_user on public.academic_results (user_id);

-- -----------------------------------------------------------------------------
-- subject_strengths  (materialised output of the classifier — architecture.md §3.2, §8)
-- -----------------------------------------------------------------------------
create table public.subject_strengths (
  user_id         uuid not null references public.profiles (id) on delete cascade,
  subject_code    text not null references public.subjects (code),
  strength        text not null check (strength in ('strong', 'average', 'weak')),
  average_points  numeric(4, 2) not null,
  exam_count      smallint not null check (exam_count > 0),
  computed_at     timestamptz not null default now(),
  primary key (user_id, subject_code)
);

-- -----------------------------------------------------------------------------
-- recommendations  (architecture.md §3.5)
-- target_id is polymorphic (careers.id | courses.id) — no FK possible.
-- -----------------------------------------------------------------------------
create table public.recommendations (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  rec_type       text not null check (rec_type in ('career', 'course')),
  target_id      uuid not null,
  match_score    numeric(5, 2) not null check (match_score between 0 and 100),
  rank           smallint not null,
  reasons        jsonb not null,   -- array of { condition, satisfied, text }
  rule_id        text not null,
  degraded_mode  boolean not null default false,
  generated_at   timestamptz not null default now()
);

create index idx_recommendations_user on public.recommendations (user_id, rec_type, rank);

-- -----------------------------------------------------------------------------
-- saved_items  (architecture.md §3.4)
-- Polymorphic item_id (scholarship | course | career) — no FK; accepted trade-off.
-- -----------------------------------------------------------------------------
create table public.saved_items (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles (id) on delete cascade,
  item_type           text not null check (item_type in ('scholarship', 'course', 'career')),
  item_id             uuid not null,
  application_status  text check (application_status in
                        ('saved', 'preparing', 'submitted', 'accepted', 'rejected'))
                        default 'saved',
  saved_at            timestamptz not null default now(),
  unique (user_id, item_type, item_id)
);

-- -----------------------------------------------------------------------------
-- chat_messages  (architecture.md §3.6 — persisted; 12-month retention job later)
-- -----------------------------------------------------------------------------
create table public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  sender      text not null check (sender in ('user', 'assistant')),
  message     text not null check (char_length(message) <= 4000),
  created_at  timestamptz not null default now()
);

create index idx_chat_messages_user on public.chat_messages (user_id, created_at desc);
