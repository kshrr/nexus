-- Keep already-published courses out of the attention list when their page
-- cannot be re-checked in one run (November 2026). Some university sites drop a
-- few connections from GitHub's US runners each run. Such a course keeps its
-- last good source record (outcome, candidate, evidence, issues) and the result
-- still reports outcome 'fetch_failed' with its course_id, so the crawler can
-- count it as kept. A programme that was never published still records
-- 'fetch_failed' and needs attention. Body otherwise identical to 0020.

create or replace function public.ingest_course_source(
 p_source text,p_programme_key text,p_source_url text,p_record jsonb,p_evidence jsonb,p_issues jsonb,
 p_error text,p_run_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
 source_row course_source_records%rowtype; course_row courses%rowtype;
 source_def course_source_registry%rowtype; university_uuid uuid; course_uuid uuid; source_uuid uuid; matches integer;
 result_outcome text; record_outcome text; problems jsonb:=coalesce(p_issues,'[]'::jsonb);
 career_values text[]; subject_values text[]; months integer;
begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
 select * into source_def from course_source_registry where source=p_source;
 if not found or p_programme_key is null or length(p_programme_key) not between 1 and 300
 or not is_valid_course_source_url(p_source,p_source_url) then raise exception 'INVALID_SOURCE'; end if;
 if jsonb_typeof(coalesce(p_record,'{}')) is distinct from 'object' or jsonb_typeof(problems) is distinct from 'array'
 or jsonb_typeof(coalesce(p_evidence,'{}')) is distinct from 'object' or length(p_record::text)>200000
 then raise exception 'INVALID_CANDIDATE'; end if;
 perform pg_advisory_xact_lock(hashtext('nexus:course:'||p_source));
 if not exists(select 1 from course_crawl_runs where id=p_run_id and source=p_source and status='running'
               and started_at>now()-interval '30 minutes') then raise exception 'INVALID_RUN'; end if;
 select * into source_row from course_source_records where source=p_source and programme_key=p_programme_key for update;
 if source_row.id is null and p_error is null then
   select count(*) into matches from course_source_records s where s.source=p_source and s.canonical_url=p_source_url
     and s.candidate->>'pathway_type'=p_record->>'pathway_type'
     and lower(btrim(s.candidate->>'name'))=lower(btrim(p_record->>'name'));
   if matches=1 then
     select * into source_row from course_source_records s where s.source=p_source and s.canonical_url=p_source_url
       and s.candidate->>'pathway_type'=p_record->>'pathway_type' and lower(btrim(s.candidate->>'name'))=lower(btrim(p_record->>'name')) for update;
     p_programme_key:=source_row.programme_key;
   elsif matches>1 then problems:=problems||'"ambiguous_programme_identity"'::jsonb; end if;
 end if;
 course_uuid:=source_row.course_id;
 if p_error is not null then result_outcome:='fetch_failed';
 else
  if p_record->>'university_name' is distinct from source_def.name or not coalesce(p_record->>'pathway_type'=any(source_def.levels),false)
  then raise exception 'INVALID_SOURCE'; end if;
  if jsonb_typeof(p_record->'name') is distinct from 'string' or length(btrim(coalesce(p_record->>'name','')))<3
   or length(p_record->>'name')>500 then problems:=problems||'"missing_degree_name"'::jsonb; end if;
  if p_record->>'field_of_study' not in ('Islamic Studies','Malay Studies','Arts and Social Sciences','Built Environment',
     'Business and Economics','Computer Science','Creative Arts','Dentistry','Education','Engineering','Languages and Linguistics',
     'Law','Medicine','Nursing','Pharmacy','Science','Sports and Exercise Sciences','Architecture','Design','Biomedical Science','Data Science','Accounting','Communication and Media','Counselling')
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
  if p_record->>'source_academic_session' is not null and
     (p_record->>'source_academic_session' !~ '^20[0-9]{2}/20[0-9]{2}$' or p_record->>'source_academic_session'<source_def.session)
   then problems:=problems||'"historical_source_session"'::jsonb; end if;
  if jsonb_typeof(coalesce(p_record->'source_evidence','{}')) is distinct from 'object' then problems:=problems||'"invalid_source_evidence"'::jsonb; end if;
  if p_record->'source_evidence' ? 'sessions' then
    if jsonb_typeof(p_record->'source_evidence'->'sessions') is distinct from 'array' then
      problems:=problems||'"invalid_source_evidence"'::jsonb;
    elsif exists(select 1 from jsonb_array_elements_text(p_record->'source_evidence'->'sessions') value
       where value !~ '^20[0-9]{2}/20[0-9]{2}$' or value<source_def.session or
         (p_record->>'source_academic_session' is not null and value is distinct from p_record->>'source_academic_session')) then
      problems:=problems||'"conflicting_source_session"'::jsonb;
    end if;
  end if;
  if exists(select 1 from jsonb_array_elements(coalesce(p_record->'entry_requirement_sections','[]')) s
     where s ? 'source_url' and not is_valid_course_source_url(p_source,s->>'source_url'))
     then problems:=problems||'"invalid_requirement_source"'::jsonb; end if;
  if course_uuid is not null and not exists(select 1 from courses where id=course_uuid and university_id=source_def.university_id and pathway_type=p_record->>'pathway_type') then raise exception 'INVALID_SOURCE'; end if;
  if jsonb_array_length(problems)>0 then result_outcome:='incomplete';
  else
   university_uuid:=source_def.university_id;
   select count(*) into matches from courses where university_id=university_uuid and pathway_type=p_record->>'pathway_type'
      and lower(regexp_replace(btrim(name),'\s+',' ','g'))=lower(regexp_replace(btrim(p_record->>'name'),'\s+',' ','g'))
      and (course_uuid is null or id<>course_uuid);
   if (course_uuid is not null and matches>0) or matches>1 then
      result_outcome:='incomplete'; problems:=problems||'"ambiguous_programme_identity"'::jsonb;
   else
    if course_uuid is null and matches=1 then
      select * into course_row from courses where university_id=university_uuid and pathway_type=p_record->>'pathway_type'
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
          programme_overview,career_prospects,entry_requirement_sections,source_url,source_programme_key,source_content_hash,last_checked_at,sync_mode,source_academic_session,source_evidence)
      values(p_record->>'name',p_record->>'field_of_study',university_uuid,p_record->>'pathway_type',months,p_record->>'entry_requirements',subject_values,
          p_record->>'programme_overview',career_values,p_record->'entry_requirement_sections',p_source_url,p_programme_key,p_record->>'source_content_hash',now(),'automatic',p_record->>'source_academic_session',coalesce(p_record->'source_evidence','{}'::jsonb))
      returning id into course_uuid;
      result_outcome:='inserted';
     elsif course_row.source_content_hash is not distinct from p_record->>'source_content_hash' then
      update courses set last_checked_at=now() where id=course_uuid; result_outcome:='unchanged';
     else
      update courses set source_academic_session=p_record->>'source_academic_session',source_evidence=coalesce(p_record->'source_evidence','{}'::jsonb),name=p_record->>'name',field_of_study=p_record->>'field_of_study',duration_months=months,
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
 if result_outcome='fetch_failed' and course_uuid is not null and source_row.id is not null then
  -- A published course whose page could not be re-checked keeps its last good
  -- record and stays out of the attention list; the next run re-checks it.
  record_outcome:=case when source_row.outcome in ('fetch_failed','published') then 'unchanged' else source_row.outcome end;
  p_record:=source_row.candidate; p_evidence:=source_row.evidence; problems:=source_row.issues;
 end if;
 insert into course_source_records(source,programme_key,canonical_url,candidate,evidence,issues,course_id,outcome,last_attempt_at,last_success_at,last_error,run_id)
 values(p_source,p_programme_key,p_source_url,coalesce(p_record,'{}'),coalesce(p_evidence,'{}'),problems,course_uuid,record_outcome,now(),
     case when result_outcome in ('inserted','updated','unchanged','protected_manual') then now() else null end,left(p_error,2000),p_run_id)
 on conflict(source,programme_key) do update set canonical_url=excluded.canonical_url,candidate=excluded.candidate,evidence=excluded.evidence,
  issues=excluded.issues,course_id=excluded.course_id,outcome=excluded.outcome,last_attempt_at=excluded.last_attempt_at,
  last_success_at=coalesce(excluded.last_success_at,course_source_records.last_success_at),last_error=excluded.last_error,run_id=excluded.run_id
 returning id into source_uuid;
 return jsonb_build_object('outcome',result_outcome,'course_id',course_uuid,'source_record_id',source_uuid);
end; $$;
