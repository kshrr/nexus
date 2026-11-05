-- Source-scoped career content. Forward-only; legacy text stays pending until reviewed.
create or replace function public.valid_career_interest_code(v text) returns boolean
language sql immutable set search_path=public as $$
 select v is null or (v ~ '^[RIASEC]{1,6}$' and length(v)=(select count(distinct x) from regexp_split_to_table(v,'') x));
$$;
alter table public.careers drop constraint careers_riasec_profile_check;
alter table public.careers alter column riasec_profile type text using btrim(riasec_profile::text);
alter table public.careers alter column riasec_profile drop not null;
alter table public.careers alter column riasec_profile set default null;
alter table public.careers add constraint careers_interest_code_valid check(public.valid_career_interest_code(riasec_profile));
alter table public.careers add column reference_occupations jsonb not null default '[]';
alter table public.careers add column content_review jsonb not null default '{"status":"pending","checked_on":null,"limitations":[],"sections":{}}';
alter table public.career_pathway_stages add column content_review jsonb not null default '{"status":"pending","kind":"nexus_planning","checked_on":null,"limitations":[],"sources":[]}';

create or replace function public.career_valid_date(v text) returns boolean
language plpgsql immutable set search_path=public as $$
begin
 return coalesce(v ~ '^\d{4}-\d{2}-\d{2}$' and to_char(v::date,'YYYY-MM-DD')=v,false);
exception when others then return false; end;
$$;
create or replace function public.career_text_array(v jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
begin
 if jsonb_typeof(v) is distinct from 'array' then return false; end if;
 return not exists(select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'string' or btrim(x#>>'{}')='');
end;
$$;
create or replace function public.career_valid_sources(v jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare s jsonb; k text; ids text[]='{}';
begin
 if jsonb_typeof(v) is distinct from 'array' then return false; end if;
 for s in select * from jsonb_array_elements(v) loop
  if jsonb_typeof(s) <> 'object' then return false; end if;
  foreach k in array array['source_id','title','publisher','jurisdiction','scope'] loop
   if jsonb_typeof(s->k) is distinct from 'string' or btrim(s->>k)='' then return false; end if;
  end loop;
  if (s->>'source_id')=any(ids) then return false; end if; ids=array_append(ids,s->>'source_id');
  if jsonb_typeof(s->'access_note') is distinct from 'string' or
     not coalesce(s->>'url' ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]+)?([/?#]|$)',false) or
     not coalesce(s->'effective_on'='null'::jsonb or public.career_valid_date(s->>'effective_on'),false) then return false; end if;
 end loop;
 return true;
exception when others then return false; end;
$$;
create or replace function public.valid_stage_content_review(v jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
begin
 if jsonb_typeof(v) is distinct from 'object' or not coalesce(v->>'status' in ('pending','source_checked','limited'),false) or
    not coalesce(v->>'kind' in ('source_informed','nexus_planning'),false) or
    not public.career_text_array(v->'limitations') or not public.career_valid_sources(v->'sources') then return false; end if;
 if v->>'status'='pending' then return coalesce(v->'checked_on'='null'::jsonb,false); end if;
 return public.career_valid_date(v->>'checked_on') and
    (v->>'status'<>'limited' or jsonb_array_length(v->'limitations')>0) and
    (v->>'kind'='nexus_planning' or jsonb_array_length(v->'sources')>0);
exception when others then return false; end;
$$;
create or replace function public.valid_career_content_review(v jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare k text; s jsonb;
begin
 if jsonb_typeof(v) is distinct from 'object' or not coalesce(v->>'status' in ('pending','source_checked','limited'),false) or
    not public.career_text_array(v->'limitations') or jsonb_typeof(v->'sections') is distinct from 'object' then return false; end if;
 for k,s in select * from jsonb_each(v->'sections') loop
  if k not in ('overview','responsibilities','skills','subjects','study_options','interests') or not public.valid_stage_content_review(s) then return false; end if;
 end loop;
 if v->>'status'='pending' then return coalesce(v->'checked_on'='null'::jsonb,false); end if;
 return public.career_valid_date(v->>'checked_on') and v->'sections'<>'{}'::jsonb and
   (v->>'status'<>'limited' or jsonb_array_length(v->'limitations')>0);
exception when others then return false; end;
$$;
create or replace function public.valid_career_reference_occupations(v jsonb,r jsonb) returns boolean
language plpgsql immutable set search_path=public as $$
declare e jsonb; k text; ids text[]='{}';
begin
 if jsonb_typeof(v) is distinct from 'array' then return false; end if;
 for e in select * from jsonb_array_elements(v) loop
  if jsonb_typeof(e)<>'object' then return false; end if;
  foreach k in array array['reference_id','name','scope_note','interest_source_id'] loop
   if jsonb_typeof(e->k) is distinct from 'string' or btrim(e->>k)='' then return false; end if;
  end loop;
  if e->>'reference_id'=any(ids) then return false; end if; ids=array_append(ids,e->>'reference_id');
  if not coalesce(e->>'mapping_kind' in ('direct','related','example'),false) or e->>'interest_code' is null or
    not public.valid_career_interest_code(e->>'interest_code') or
    not exists(select 1 from jsonb_array_elements(coalesce(r#>'{sections,interests,sources}','[]')) s where s->>'source_id'=e->>'interest_source_id') then return false; end if;
 end loop;
 return true;
exception when others then return false; end;
$$;
alter table public.careers add constraint careers_review_valid check(public.valid_career_content_review(content_review));
alter table public.careers add constraint careers_references_valid check(public.valid_career_reference_occupations(reference_occupations,content_review));
alter table public.career_pathway_stages add constraint career_stages_review_valid check(public.valid_stage_content_review(content_review));

create or replace function public.career_review_substance(v jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select jsonb_build_object('limitations',v->'limitations','sections',coalesce((select jsonb_object_agg(key,value-'status'-'checked_on') from jsonb_each(v->'sections')),'{}'::jsonb));
$$;
create or replace function public.pending_career_review(v jsonb) returns jsonb
language sql immutable set search_path=public as $$
 select v||jsonb_build_object('status','pending','checked_on',null,'sections',coalesce((select jsonb_object_agg(key,value||jsonb_build_object('status','pending','checked_on',null)) from jsonb_each(v->'sections')),'{}'::jsonb));
$$;
create or replace function public.invalidate_career_content_review() returns trigger
language plpgsql set search_path=public as $$
begin
 if not public.valid_career_content_review(new.content_review) or not public.valid_career_reference_occupations(new.reference_occupations,new.content_review) then
  raise exception 'Invalid career evidence' using errcode='23514';
 end if;
 if row(new.name,new.field,new.description,new.responsibilities,new.required_skills,new.useful_subjects,new.education_routes,new.riasec_profile,new.reference_occupations)
    is distinct from row(old.name,old.field,old.description,old.responsibilities,old.required_skills,old.useful_subjects,old.education_routes,old.riasec_profile,old.reference_occupations)
    or public.career_review_substance(new.content_review) is distinct from public.career_review_substance(old.content_review) then
   new.content_review=public.pending_career_review(new.content_review);
   update public.career_pathway_stages set content_review=content_review||jsonb_build_object('status','pending','checked_on',null) where career_id=old.id;
 end if;
 return new;
end;
$$;
create trigger trg_career_review_invalidation before update on public.careers for each row execute function public.invalidate_career_content_review();
create or replace function public.invalidate_career_stage_review() returns trigger
language plpgsql set search_path=public as $$
begin
 if not public.valid_stage_content_review(new.content_review) then raise exception 'Invalid pathway evidence' using errcode='23514'; end if;
 if row(new.career_id,new.stage_order,new.stage_title,new.stage_description,new.focus_points,new.from_education_level)
    is distinct from row(old.career_id,old.stage_order,old.stage_title,old.stage_description,old.focus_points,old.from_education_level)
    or new.content_review-'status'-'checked_on' is distinct from old.content_review-'status'-'checked_on' then
   new.content_review=new.content_review||jsonb_build_object('status','pending','checked_on',null);
 end if;
 return new;
end;
$$;
create trigger trg_career_stage_review_invalidation before update on public.career_pathway_stages for each row execute function public.invalidate_career_stage_review();
drop trigger if exists trg_initialise_career_pathway on public.careers;

-- Deterministic baseline comparison excludes review state, row IDs and timestamps of stages.
create or replace function public.career_content_snapshot(c public.careers) returns jsonb
language sql stable set search_path=public as $$
 select jsonb_build_object('career',to_jsonb(c)-'content_review'-'reference_occupations','stages',coalesce((select jsonb_agg(to_jsonb(s)-'id'-'content_review' order by s.from_education_level,s.stage_order) from public.career_pathway_stages s where s.career_id=c.id),'[]'::jsonb));
$$;
