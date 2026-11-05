-- Automatic UM course ingestion. Existing IDs and manual catalogue rows survive.
alter table public.courses
  add column source_url text,
  add column source_programme_key text,
  add column source_content_hash text,
  add column last_checked_at timestamptz,
  add column programme_overview text,
  add column career_prospects text[] not null default '{}',
  add column entry_requirement_sections jsonb not null default '[]' check(jsonb_typeof(entry_requirement_sections)='array'),
  add column sync_mode text not null default 'manual' check(sync_mode in ('manual','automatic'));
create unique index uq_course_source_key on public.courses(university_id,source_programme_key) where source_programme_key is not null;

create table public.course_crawl_runs (
 id uuid primary key default gen_random_uuid(), source text not null check(source='um'),
 request_id uuid unique, triggered_by text not null check(triggered_by in ('manual','schedule')),
 triggered_by_user uuid references public.profiles(id) on delete set null,
 started_at timestamptz not null default now(), finished_at timestamptz,
 status text not null default 'running' check(status in ('running','completed','partial','failed')),
 found integer not null default 0 check(found>=0), fetched integer not null default 0 check(fetched>=0),
 inserted integer not null default 0 check(inserted>=0), updated integer not null default 0 check(updated>=0),
 unchanged integer not null default 0 check(unchanged>=0), protected_manual integer not null default 0 check(protected_manual>=0),
 incomplete integer not null default 0 check(incomplete>=0), fetch_failed integer not null default 0 check(fetch_failed>=0),
 coverage_complete boolean not null default false, errors jsonb not null default '[]' check(jsonb_typeof(errors)='array')
);
create unique index uq_course_running_source on public.course_crawl_runs(source) where status='running';
create index idx_course_runs_recent on public.course_crawl_runs(started_at desc);
create table public.course_source_records (
 id uuid primary key default gen_random_uuid(), source text not null check(source='um'),
 programme_key text not null check(length(programme_key) between 1 and 300),
 canonical_url text not null check(canonical_url like 'https://study.um.edu.my/%'),
 candidate jsonb not null default '{}' check(jsonb_typeof(candidate)='object'),
 evidence jsonb not null default '{}' check(jsonb_typeof(evidence)='object'),
 issues jsonb not null default '[]' check(jsonb_typeof(issues)='array'),
 course_id uuid references public.courses(id) on delete restrict,
 outcome text not null check(outcome in ('published','unchanged','protected_manual','incomplete','fetch_failed')),
 last_attempt_at timestamptz not null default now(), last_success_at timestamptz,
 last_error text, run_id uuid references public.course_crawl_runs(id),
 unique(source,programme_key)
);
create index idx_course_source_outcome on public.course_source_records(outcome,last_attempt_at desc);
alter table public.course_source_records enable row level security;
alter table public.course_crawl_runs enable row level security;
revoke all on public.course_source_records,public.course_crawl_runs from public,anon,authenticated;
grant select on public.course_source_records,public.course_crawl_runs to authenticated;
grant select,insert,update on public.course_source_records,public.course_crawl_runs,public.courses,public.universities to service_role;
create policy course_sources_admin_read on public.course_source_records for select to authenticated using(public.is_admin());
create policy course_runs_admin_read on public.course_crawl_runs for select to authenticated using(public.is_admin());

create or replace function public.protect_course_manual_edit()
returns trigger language plpgsql set search_path=public as $$
begin
 if auth.role()='authenticated' and
   row(new.name,new.field_of_study,new.university_id,new.pathway_type,new.duration_months,new.entry_requirements,
       new.required_subject_codes,new.programme_overview,new.career_prospects,new.entry_requirement_sections,new.is_active)
   is distinct from
   row(old.name,old.field_of_study,old.university_id,old.pathway_type,old.duration_months,old.entry_requirements,
       old.required_subject_codes,old.programme_overview,old.career_prospects,old.entry_requirement_sections,old.is_active)
 then
  new.sync_mode:='manual'; new.source_content_hash:=null;
  -- The current admin editor writes flat guidance. Do not display the old
  -- source sections above that correction; explicit section edits survive.
  if new.entry_requirements is distinct from old.entry_requirements and
     new.entry_requirement_sections is not distinct from old.entry_requirement_sections
  then new.entry_requirement_sections:='[]'::jsonb; end if;
 end if;
 return new;
end; $$;
create trigger trg_course_manual_edit before update on public.courses for each row execute function public.protect_course_manual_edit();

create or replace function public.begin_course_crawl_run(p_source text,p_triggered_by text,p_user uuid default null,p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
 if p_source<>'um' or p_triggered_by not in ('manual','schedule') then raise exception 'INVALID_SOURCE'; end if;
 perform pg_advisory_xact_lock(hashtext('nexus:course:'||p_source));
 update course_crawl_runs set status='failed',finished_at=now(),errors='["Run exceeded its lease; recovered by the next job."]'
 where source=p_source and status='running' and started_at<now()-interval '30 minutes';
 if exists(select 1 from course_crawl_runs where source=p_source and status='running') or
    (p_request_id is not null and exists(select 1 from course_crawl_runs where request_id=p_request_id)) then return null; end if;
 insert into course_crawl_runs(source,triggered_by,triggered_by_user,request_id)
 values(p_source,p_triggered_by,p_user,p_request_id) returning id into result;
 return result;
end; $$;

create or replace function public.ingest_course_source(
 p_source text,p_programme_key text,p_source_url text,p_record jsonb,p_evidence jsonb,p_issues jsonb,
 p_error text,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 source_row course_source_records%rowtype; course_row courses%rowtype;
 university_uuid uuid; course_uuid uuid; source_uuid uuid; matches integer;
 result_outcome text; record_outcome text; problems jsonb:=coalesce(p_issues,'[]'::jsonb);
 career_values text[]; subject_values text[]; months integer;
begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
 if p_source is distinct from 'um' or p_programme_key is null or p_programme_key !~* '^bachelors?-[a-z0-9-]+$'
 or length(p_programme_key)>300 or p_source_url is distinct from 'https://study.um.edu.my/'||p_programme_key
 then raise exception 'INVALID_SOURCE'; end if;
 if jsonb_typeof(coalesce(p_record,'{}')) is distinct from 'object' or jsonb_typeof(problems) is distinct from 'array'
 or jsonb_typeof(coalesce(p_evidence,'{}')) is distinct from 'object' or length(p_record::text)>200000
 then raise exception 'INVALID_CANDIDATE'; end if;
 perform pg_advisory_xact_lock(hashtext('nexus:course:um'));
 if not exists(select 1 from course_crawl_runs where id=p_run_id and source=p_source and status='running'
               and started_at>now()-interval '30 minutes') then raise exception 'INVALID_RUN'; end if;
 select * into source_row from course_source_records where source=p_source and programme_key=p_programme_key for update;
 course_uuid:=source_row.course_id;
 if p_error is not null then result_outcome:='fetch_failed';
 else
  if p_record->>'university_name' is distinct from 'Universiti Malaya' or p_record->>'pathway_type' is distinct from 'degree'
  then raise exception 'INVALID_SOURCE'; end if;
  if jsonb_typeof(p_record->'name') is distinct from 'string' or length(btrim(coalesce(p_record->>'name','')))<8
   or length(p_record->>'name')>500 or p_record->>'name' !~* '^bachelor\M' then problems:=problems||'"missing_degree_name"'::jsonb; end if;
  if p_record->>'field_of_study' not in ('Islamic Studies','Malay Studies','Arts and Social Sciences','Built Environment',
     'Business and Economics','Computer Science','Creative Arts','Dentistry','Education','Engineering','Languages and Linguistics',
     'Law','Medicine','Nursing','Pharmacy','Science','Sports and Exercise Sciences','Architecture','Design','Biomedical Science','Data Science')
     or nullif(p_record->>'field_of_study','') is null then problems:=problems||'"unmapped_field"'::jsonb; end if;
  if jsonb_typeof(p_record->'entry_requirements') is distinct from 'string' or nullif(btrim(p_record->>'entry_requirements'),'') is null
     or length(p_record->>'entry_requirements')>64000 then problems:=problems||'"missing_entry_requirements"'::jsonb; end if;
  if jsonb_typeof(p_record->'entry_requirement_sections') is distinct from 'array' then problems:=problems||'"missing_requirement_sections"'::jsonb;
  elsif jsonb_array_length(p_record->'entry_requirement_sections')=0 or jsonb_array_length(p_record->'entry_requirement_sections')>100
    or exists(select 1 from jsonb_array_elements(p_record->'entry_requirement_sections') s
       where jsonb_typeof(s)<>'object' or s->>'applicant_category' not in ('Local','International')
       or nullif(s->>'applicant_category','') is null or nullif(btrim(s->>'heading'),'') is null
       or nullif(btrim(s->>'text'),'') is null or length(s->>'text')>16000)
    then problems:=problems||'"invalid_requirement_sections"'::jsonb;
  end if;
  if coalesce(p_record->>'source_content_hash','') !~ '^[0-9a-f]{64}$' then problems:=problems||'"missing_content_hash"'::jsonb; end if;
  if p_record->'duration_months' is not null and p_record->'duration_months'<>'null'::jsonb then
    if p_record->>'duration_months' !~ '^[0-9]+$' or length(p_record->>'duration_months')>3 then problems:=problems||'"invalid_duration"'::jsonb;
    else months:=(p_record->>'duration_months')::integer;
     if months<1 or months>240 then problems:=problems||'"invalid_duration"'::jsonb; end if;
    end if;
  end if;
  if jsonb_typeof(p_record->'career_prospects') is distinct from 'array' or
     jsonb_typeof(p_record->'required_subject_codes') is distinct from 'array' then problems:=problems||'"invalid_lists"'::jsonb; end if;
  if jsonb_array_length(problems)>0 then result_outcome:='incomplete';
  else
   insert into universities(name,type,state) values('Universiti Malaya','public','Kuala Lumpur') on conflict(name) do nothing;
   select id into university_uuid from universities where name='Universiti Malaya';
   select count(*) into matches from courses where university_id=university_uuid and pathway_type='degree'
      and lower(regexp_replace(btrim(name),'\s+',' ','g'))=lower(regexp_replace(btrim(p_record->>'name'),'\s+',' ','g'))
      and (course_uuid is null or id<>course_uuid);
   if (course_uuid is not null and matches>0) or matches>1 then
      result_outcome:='incomplete'; problems:=problems||'"ambiguous_programme_identity"'::jsonb;
   else
    if course_uuid is null and matches=1 then
      select * into course_row from courses where university_id=university_uuid and pathway_type='degree'
        and lower(regexp_replace(btrim(name),'\s+',' ','g'))=lower(regexp_replace(btrim(p_record->>'name'),'\s+',' ','g')) for update;
      course_uuid:=course_row.id;
    elsif course_uuid is not null then select * into course_row from courses where id=course_uuid for update;
    end if;
    if course_uuid is not null and course_row.source_programme_key is not null and course_row.source_programme_key<>p_programme_key then
      result_outcome:='incomplete'; problems:=problems||'"conflicting_source_identity"'::jsonb;
    elsif course_uuid is not null and course_row.sync_mode='manual' then result_outcome:='protected_manual';
    else
     select coalesce(array_agg(value),'{}') into career_values from jsonb_array_elements_text(p_record->'career_prospects');
     select coalesce(array_agg(value),'{}') into subject_values from jsonb_array_elements_text(p_record->'required_subject_codes');
     if course_uuid is null then
      insert into courses(name,field_of_study,university_id,pathway_type,duration_months,entry_requirements,required_subject_codes,
          programme_overview,career_prospects,entry_requirement_sections,source_url,source_programme_key,source_content_hash,last_checked_at,sync_mode)
      values(p_record->>'name',p_record->>'field_of_study',university_uuid,'degree',months,p_record->>'entry_requirements',subject_values,
          p_record->>'programme_overview',career_values,p_record->'entry_requirement_sections',p_source_url,p_programme_key,p_record->>'source_content_hash',now(),'automatic')
      returning id into course_uuid;
      result_outcome:='inserted';
     elsif course_row.source_content_hash is not distinct from p_record->>'source_content_hash' then
      update courses set last_checked_at=now() where id=course_uuid; result_outcome:='unchanged';
     else
      update courses set name=p_record->>'name',field_of_study=p_record->>'field_of_study',duration_months=months,
       entry_requirements=p_record->>'entry_requirements',programme_overview=p_record->>'programme_overview',career_prospects=career_values,
       entry_requirement_sections=p_record->'entry_requirement_sections',source_url=p_source_url,source_programme_key=p_programme_key,
       source_content_hash=p_record->>'source_content_hash',last_checked_at=now(),
       required_subject_codes=case when cardinality(subject_values)>0 then subject_values else required_subject_codes end
      where id=course_uuid; result_outcome:='updated';
     end if;
    end if;
   end if;
  end if;
 end if;
 record_outcome:=case when result_outcome in ('inserted','updated') then 'published' else result_outcome end;
 insert into course_source_records(source,programme_key,canonical_url,candidate,evidence,issues,course_id,outcome,last_attempt_at,last_success_at,last_error,run_id)
 values(p_source,p_programme_key,p_source_url,coalesce(p_record,'{}'),coalesce(p_evidence,'{}'),problems,course_uuid,record_outcome,now(),
     case when result_outcome in ('inserted','updated','unchanged','protected_manual') then now() else null end,left(p_error,2000),p_run_id)
 on conflict(source,programme_key) do update set canonical_url=excluded.canonical_url,candidate=excluded.candidate,evidence=excluded.evidence,
  issues=excluded.issues,course_id=excluded.course_id,outcome=excluded.outcome,last_attempt_at=excluded.last_attempt_at,
  last_success_at=coalesce(excluded.last_success_at,course_source_records.last_success_at),last_error=excluded.last_error,run_id=excluded.run_id
 returning id into source_uuid;
 return jsonb_build_object('outcome',result_outcome,'course_id',course_uuid,'source_record_id',source_uuid);
end; $$;

create or replace function public.finish_course_crawl_run(p_run_id uuid,p_summary jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
 if coalesce(p_summary->>'status','') not in ('completed','partial','failed') or jsonb_typeof(p_summary->'errors') is distinct from 'array'
 then raise exception 'INVALID_SUMMARY'; end if;
 update course_crawl_runs set status=p_summary->>'status',finished_at=now(),
 found=coalesce((p_summary->>'found')::integer,0),fetched=coalesce((p_summary->>'fetched')::integer,0),
 inserted=coalesce((p_summary->>'inserted')::integer,0),updated=coalesce((p_summary->>'updated')::integer,0),
 unchanged=coalesce((p_summary->>'unchanged')::integer,0),protected_manual=coalesce((p_summary->>'protected_manual')::integer,0),
 incomplete=coalesce((p_summary->>'incomplete')::integer,0),fetch_failed=coalesce((p_summary->>'fetch_failed')::integer,0),
 coverage_complete=coalesce((p_summary->>'coverage_complete')::boolean,false),errors=p_summary->'errors'
 where id=p_run_id and status='running';
 if not found then raise exception 'INVALID_RUN'; end if;
end; $$;

create or replace function public.list_course_sources(p_outcome text default 'all',p_page integer default 1,p_page_size integer default 20)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; total_count integer;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_outcome not in ('all','attention','published','unchanged','protected_manual','incomplete','fetch_failed')
 or p_page<1 or p_page_size<1 or p_page_size>50 then raise exception 'INVALID_FILTER'; end if;
 select count(*) into total_count from course_source_records where p_outcome='all' or outcome=p_outcome
   or (p_outcome='attention' and outcome in ('protected_manual','incomplete','fetch_failed'));
 select coalesce(jsonb_agg(row_data),'[]') into result from (
  select s.*,c.sync_mode,c.name as course_name from course_source_records s left join courses c on c.id=s.course_id
   where p_outcome='all' or outcome=p_outcome or (p_outcome='attention' and outcome in ('protected_manual','incomplete','fetch_failed'))
   order by last_attempt_at desc,s.id limit p_page_size offset (p_page-1)*p_page_size
 ) row_data;
 return jsonb_build_object('items',result,'total',total_count);
end; $$;

create or replace function public.set_course_sync_mode(p_course_id uuid,p_mode text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_mode not in ('manual','automatic') then raise exception 'INVALID_MODE'; end if;
 if p_mode='automatic' and not exists(select 1 from course_source_records where course_id=p_course_id
     and last_success_at is not null and source='um') then raise exception 'INVALID_SOURCE'; end if;
 update courses set sync_mode=p_mode where id=p_course_id;
 if not found then raise exception 'COURSE_NOT_FOUND'; end if;
end; $$;

revoke all on function public.begin_course_crawl_run(text,text,uuid,uuid),public.ingest_course_source(text,text,text,jsonb,jsonb,jsonb,text,uuid),public.finish_course_crawl_run(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.begin_course_crawl_run(text,text,uuid,uuid),public.ingest_course_source(text,text,text,jsonb,jsonb,jsonb,text,uuid),public.finish_course_crawl_run(uuid,jsonb) to service_role;
revoke all on function public.list_course_sources(text,integer,integer),public.set_course_sync_mode(uuid,text) from public,anon;
grant execute on function public.list_course_sources(text,integer,integer),public.set_course_sync_mode(uuid,text) to authenticated;
