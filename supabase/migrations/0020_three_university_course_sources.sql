-- Extend the existing catalogue sync without changing IDs or manual ownership.
create table public.course_source_registry (
 source text primary key, name text not null, state text not null,
 university_id uuid not null unique references public.universities(id),
 levels text[] not null, session text not null, destinations jsonb not null
);
alter table public.course_source_registry enable row level security;
revoke all on public.course_source_registry from public,anon,authenticated;
grant select on public.course_source_registry to authenticated,service_role;
create policy course_registry_admin_read on public.course_source_registry for select to authenticated using(public.is_admin());
alter table public.courses add column source_academic_session text, add column source_evidence jsonb not null default '{}' check(jsonb_typeof(source_evidence)='object');
alter table public.course_crawl_runs add column pathway_counts jsonb not null default '{}' check(jsonb_typeof(pathway_counts)='object'), add column coverage_issues jsonb not null default '[]' check(jsonb_typeof(coverage_issues)='array');
alter table public.course_crawl_runs drop constraint course_crawl_runs_source_check;
alter table public.course_source_records drop constraint course_source_records_source_check;
alter table public.course_source_records drop constraint course_source_records_canonical_url_check;
insert into public.universities(name,type,state) values('Universiti Malaya','public','Kuala Lumpur') on conflict(name) do nothing;
insert into public.course_source_registry select 'um','Universiti Malaya','Kuala Lumpur',id,array['foundation','diploma','degree'],'2026/2027','{"study.um.edu.my": {"path": "/(?:undergraduate-faculties|programmes|page-faculty-foundation|diploma-faculty-centre|dip-faculty-of-(?:medicine|nursing)|universiti-malaya-centre-for-continuing-education|academy-of-islamic-studies-courses|malay-studies-courses|faculty-[A-Za-z0-9-]+|bachelors?-[A-Za-z0-9-]+|foundation-[A-Za-z0-9-]+|diploma-[A-Za-z0-9-]+)", "query": ""}}'::jsonb from public.universities where name='Universiti Malaya';
insert into public.universities(name,type,state) values('Universiti Malaysia Perlis','public','Perlis') on conflict(name) do nothing;
insert into public.course_source_registry select 'unimap','Universiti Malaysia Perlis','Perlis',id,array['diploma','degree'],'2026/2027','{"www.unimap.edu.my": {"path": "/(?:index\\.php/(?:en|ms)/(?:syarat-kemasukan|kemasukan/pra-siswazah)|images/kemasukan/[^?#]+\\.pdf)", "query": ""}, "admission.unimap.edu.my": {"path": "/(?:|index\\.php|local\\.php|international\\.php|programme\\.php|images/[^?#]+\\.pdf)", "query": "id"}}'::jsonb from public.universities where name='Universiti Malaysia Perlis';
insert into public.universities(name,type,state) values('Universiti Sains Islam Malaysia','public','Negeri Sembilan') on conflict(name) do nothing;
insert into public.course_source_registry select 'usim','Universiti Sains Islam Malaysia','Negeri Sembilan',id,array['foundation','degree'],'2026/2027','{"admission.usim.edu.my": {"path": "/(?:academic-programmes|tamhidi|undergraduate|download)/?|/wp-content/uploads/[0-9]{4}/[0-9]{2}/[^?#]+\\.pdf", "query": "pid"}, "tamhidi.usim.edu.my": {"path": "/wp-content/uploads/[0-9]{4}/[0-9]{2}/[^?#]+\\.pdf", "query": ""}}'::jsonb from public.universities where name='Universiti Sains Islam Malaysia';

alter table public.course_crawl_runs add foreign key(source) references public.course_source_registry(source);
alter table public.course_source_records add foreign key(source) references public.course_source_registry(source);
create function public.is_valid_course_source_url(p_source text,p_url text)
returns boolean language plpgsql stable security definer set search_path=public as $$
declare parts text[]; rule jsonb; pathname text; query text;
begin
 if p_url is null or length(p_url)>2000 or p_url ~ '[[:space:]\\]' then return false; end if;
 parts:=regexp_match(p_url,'^https://([^/?#]+)(/[^?#]*)?(?:\?([^#]*))?$');
 if parts is null then return false; end if;
 select destinations->parts[1] into rule from course_source_registry where source=p_source;
 if rule is null then return false; end if;
 pathname:=coalesce(nullif(rtrim(parts[2],'/'),''),'/'); query:=coalesce(parts[3],'');
 if pathname !~* ('^(?:'||(rule->>'path')||')$') then return false; end if;
 if query='' then return not (p_source='unimap' and pathname='/programme.php'); end if;
 if rule->>'query'='pid' then return pathname in ('/academic-programmes','/tamhidi') and query ~ '^pid=[1-9][0-9]{0,8}$'; end if;
 if rule->>'query'='id' then return pathname='/programme.php' and query ~ '^id=UR[0-9]{7}$'; end if;
 return false;
end; $$;
drop function public.list_course_sources(text,integer,integer);
create or replace function public.begin_course_crawl_run(p_source text,p_triggered_by text,p_user uuid default null,p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if auth.role()<>'service_role' then raise exception 'FORBIDDEN'; end if;
 if not exists(select 1 from course_source_registry where source=p_source) or p_triggered_by not in ('manual','schedule') then raise exception 'INVALID_SOURCE'; end if;
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
 pathway_counts=coalesce(p_summary->'pathway_counts','{}'::jsonb),coverage_issues=coalesce(p_summary->'coverage_issues','[]'::jsonb),unchanged=coalesce((p_summary->>'unchanged')::integer,0),protected_manual=coalesce((p_summary->>'protected_manual')::integer,0),
 incomplete=coalesce((p_summary->>'incomplete')::integer,0),fetch_failed=coalesce((p_summary->>'fetch_failed')::integer,0),
 coverage_complete=coalesce((p_summary->>'coverage_complete')::boolean,false),errors=p_summary->'errors'
 where id=p_run_id and status='running';
 if not found then raise exception 'INVALID_RUN'; end if;
end; $$;

create or replace function public.list_course_sources(p_outcome text default 'all',p_page integer default 1,p_page_size integer default 20,p_source text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb; total_count integer;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_outcome not in ('all','attention','published','unchanged','protected_manual','incomplete','fetch_failed')
 or p_page<1 or p_page_size<1 or p_page_size>50 then raise exception 'INVALID_FILTER'; end if;
 select count(*) into total_count from course_source_records where (p_source is null or source=p_source) and (p_outcome='all' or outcome=p_outcome or (p_outcome='attention' and outcome in ('protected_manual','incomplete','fetch_failed')));
 select coalesce(jsonb_agg(row_data),'[]') into result from (
  select s.*,c.sync_mode,c.name as course_name from course_source_records s left join courses c on c.id=s.course_id
   where (p_source is null or s.source=p_source) and (p_outcome='all' or outcome=p_outcome or (p_outcome='attention' and outcome in ('protected_manual','incomplete','fetch_failed')))
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
     and last_success_at is not null and source in (select source from course_source_registry)) then raise exception 'INVALID_SOURCE'; end if;
 update courses set sync_mode=p_mode where id=p_course_id;
 if not found then raise exception 'COURSE_NOT_FOUND'; end if;
end; $$;


create function public.list_course_sync_runs(p_request_ids uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path=public as $$
declare recent jsonb; correlated jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if cardinality(p_request_ids)>30 then raise exception 'INVALID_REQUEST_IDS'; end if;
 select coalesce(jsonb_agg(r),'[]') into recent from (select distinct on(source) * from course_crawl_runs order by source,started_at desc,id) r;
 select coalesce(jsonb_agg(r),'[]') into correlated from course_crawl_runs r where request_id=any(p_request_ids);
 return jsonb_build_object('latest',recent,'correlated',correlated);
end; $$;
revoke all on function public.list_course_sources(text,integer,integer,text),public.list_course_sync_runs(uuid[]),public.is_valid_course_source_url(text,text) from public,anon;
grant execute on function public.list_course_sources(text,integer,integer,text),public.list_course_sync_runs(uuid[]) to authenticated;
grant execute on function public.is_valid_course_source_url(text,text) to service_role;
