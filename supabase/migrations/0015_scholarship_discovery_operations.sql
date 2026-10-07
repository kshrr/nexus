-- All browser writes go through authorised, transactional review operations.
create function public.discovery_https_url(p_url text) returns boolean
language sql immutable set search_path=public as $$
 select coalesce(length(p_url)<=2000 and p_url ~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*(:443)?([/?#]|$)'
 and p_url !~ '[[:space:]<>\\]' and p_url !~* '^https://(localhost|[^/]*\.local)(:|/|$)'
 and p_url !~ '^https://[0-9.]+(:|/|$)',false)
$$;

create function public.discovery_record_reasons(p_record jsonb,p_criteria jsonb) returns text[]
language plpgsql immutable set search_path=public as $$
declare r text[]:='{}'; c jsonb; levels jsonb;
begin
 if jsonb_typeof(p_record) is distinct from 'object' then return array['Programme details are missing']; end if;
 if length(trim(coalesce(p_record->>'name',''))) not between 4 and 500 then r:=array_append(r,'Confirm programme name'); end if;
 if length(trim(coalesce(p_record->>'provider',''))) not between 2 and 500 then r:=array_append(r,'Confirm provider'); end if;
 if length(trim(coalesce(p_record->>'description',''))) not between 20 and 12000 then r:=array_append(r,'Add a useful programme description'); end if;
 if not public.discovery_https_url(p_record->>'source_url') then r:=array_append(r,'Confirm an official public HTTPS source'); end if;
 if coalesce(p_record->>'status','') not in ('active','expired') then r:=array_append(r,'Confirm application status'); end if;
 levels:=p_record->'education_levels';
 if jsonb_typeof(levels) is distinct from 'array' then r:=array_append(r,'Confirm education levels');
 elsif jsonb_array_length(levels)=0 or exists(select 1 from jsonb_array_elements_text(levels) l where l not in ('spm','stpm','stam','matriculation','foundation','diploma')) then r:=array_append(r,'Confirm recognised education levels'); end if;
 if p_record->>'application_link' is not null and not public.discovery_https_url(p_record->>'application_link') then r:=array_append(r,'Confirm application destination'); end if;
 if coalesce(length(p_record->>'funding_amount'),0)>2000 then r:=array_append(r,'Funding text is too long'); end if;
 if jsonb_typeof(p_record->'field_of_study') is distinct from 'array' then r:=array_append(r,'Confirm fields of study'); end if;
 if p_record::text ~ '<[A-Za-z/][^>]*>' then r:=array_append(r,'Remove HTML from programme details'); end if;
 begin perform nullif(p_record->>'deadline','')::date; exception when others then r:=array_append(r,'Confirm closing date'); end;
 if jsonb_typeof(p_criteria) is distinct from 'array' then r:=array_append(r,'Confirm criteria');
 else
  if jsonb_array_length(p_criteria)>100 then r:=array_append(r,'Too many criteria'); end if;
  for c in select value from jsonb_array_elements(p_criteria) loop
   if coalesce(c->>'criterion_type','') not in ('citizenship','education_level','field_of_study','min_grade','subject_grade','age','other')
    or coalesce(c->>'operator','') not in ('eq','in','gte','lte','contains')
    or length(trim(coalesce(c->>'label',''))) not between 1 and 2000
    or not(c ? 'value') or c->'value'='null'::jsonb
    or (c ? 'is_checkable' and jsonb_typeof(c->'is_checkable')<>'boolean') then r:=array_append(r,'Confirm criteria'); exit; end if;
  end loop;
 end if;
 return r;
end $$;

create function public.set_discovery_ignored(p_id uuid,p_ignored boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 update public.scholarship_discoveries set review_state=case when p_ignored then 'ignored' else 'needs_review' end,revision=revision+1 where id=p_id;
 perform public.discovery_audit('ignore',p_id,jsonb_build_object('ignored',p_ignored));
end $$;
create function public.set_discovery_monitoring(p_id uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 update public.scholarship_discoveries set monitoring_enabled=p_enabled,revision=revision+1 where id=p_id and scholarship_id is not null;
 if not found then raise exception 'NOT_READY'; end if;
 perform public.discovery_audit('monitoring',p_id,jsonb_build_object('enabled',p_enabled));
end $$;

create function public.list_scholarship_discoveries(p_tab text,p_search text,p_provider text,p_review_state text,p_page integer,p_page_size integer) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb; total integer; providers jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_tab not in ('discover','added') or p_page<1 or p_page_size not between 1 and 100 then raise exception 'INVALID_SETTINGS'; end if;
 select count(*) into total from public.scholarship_discoveries d
 where ((p_tab='discover' and d.scholarship_id is null) or (p_tab='added' and d.scholarship_id is not null))
 and not exists(select 1 from public.scholarship_discovery_aliases a where a.identity_key=d.identity_key and a.discovery_id<>d.id)
 and (coalesce(p_search,'')='' or strpos(lower(d.name||' '||d.provider),lower(p_search))>0)
 and (coalesce(p_provider,'')='' or d.provider=p_provider) and (p_review_state='all' or d.review_state=p_review_state);
 select coalesce(jsonb_agg(to_jsonb(page)),'[]') into result from (
 select d.*,s.status as publication_status,s.is_manual from public.scholarship_discoveries d left join public.scholarships s on s.id=d.scholarship_id
 where ((p_tab='discover' and d.scholarship_id is null) or (p_tab='added' and d.scholarship_id is not null))
 and not exists(select 1 from public.scholarship_discovery_aliases a where a.identity_key=d.identity_key and a.discovery_id<>d.id)
 and (coalesce(p_search,'')='' or strpos(lower(d.name||' '||d.provider),lower(p_search))>0)
 and (coalesce(p_provider,'')='' or d.provider=p_provider) and (p_review_state='all' or d.review_state=p_review_state)
 order by d.last_discovered_at desc,d.id limit p_page_size offset (p_page-1)*p_page_size) page;
 select coalesce(jsonb_agg(provider order by provider),'[]') into providers from(select distinct provider from public.scholarship_discoveries where provider<>'') p;
 return jsonb_build_object('items',result,'total',total,'providers',providers);
end $$;

create function public.save_scholarship_discovery_settings(p_settings jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 begin
 update public.scholarship_discovery_settings set queries=case when p_settings ? 'queries' then array(select jsonb_array_elements_text(p_settings->'queries')) else queries end,
 region=coalesce(p_settings->>'region',region),target_count=coalesce((p_settings->>'target_count')::integer,target_count),
 max_search_requests=coalesce((p_settings->>'max_search_requests')::integer,max_search_requests),max_pages=coalesce((p_settings->>'max_pages')::integer,max_pages),
 max_pages_per_host=coalesce((p_settings->>'max_pages_per_host')::integer,max_pages_per_host),work_seconds=coalesce((p_settings->>'work_seconds')::integer,work_seconds),updated_at=now()
 where id returning to_jsonb(scholarship_discovery_settings) into result;
 exception when others then raise exception 'INVALID_SETTINGS'; end;
 perform public.discovery_audit('settings',null);
 return result;
end $$;

create function public.link_discovery_alias(p_id uuid,p_duplicate_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare target public.scholarship_discoveries; duplicate public.scholarship_discoveries;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 if p_id=p_duplicate_id then return p_id; end if;
 perform 1 from public.scholarship_discoveries where id in(p_id,p_duplicate_id) order by id for update;
 select * into target from public.scholarship_discoveries where id=p_id;
 select * into duplicate from public.scholarship_discoveries where id=p_duplicate_id;
 if target.id is null or duplicate.id is null then raise exception 'INVALID_SOURCE'; end if;
 if duplicate.scholarship_id is not null and (target.scholarship_id is null or duplicate.scholarship_id<>target.scholarship_id) then raise exception 'INVALID_SOURCE: conflicting publications'; end if;
 insert into public.scholarship_discovery_aliases values(duplicate.identity_key,p_id)
 on conflict(identity_key) do update set discovery_id=excluded.discovery_id;
 update public.scholarship_discovery_aliases set discovery_id=p_id where discovery_id=p_duplicate_id;
 update public.scholarship_discoveries set review_state='ignored',monitoring_enabled=false,revision=revision+1 where id=p_duplicate_id;
 perform public.discovery_audit('alias',p_id,jsonb_build_object('duplicate_id',p_duplicate_id));
 return p_id;
end $$;

create function public.scraper_record_discovery_error(p_id uuid,p_error text) returns void
language sql security definer set search_path=public as $$
 update public.scholarship_discoveries set last_error=left(p_error,500),last_checked_at=now() where id=p_id
$$;

create function public.scraper_monitor_discovery(p_id uuid,p_candidate jsonb) returns text
language plpgsql security definer set search_path=public as $$
declare d public.scholarship_discoveries; s public.scholarships; rec jsonb; crit jsonb; old_criteria jsonb; outcome text;
begin
 select * into d from public.scholarship_discoveries where id=p_id for update;
 if not found or not d.monitoring_enabled or d.scholarship_id is null or d.review_state='ignored' then return 'not_selected'; end if;
 select * into s from public.scholarships where id=d.scholarship_id for update;
 if not found then return 'not_selected'; end if;
 if p_candidate->>'identity_key'<>d.identity_key and not exists(select 1 from public.scholarship_discovery_aliases where identity_key=p_candidate->>'identity_key' and discovery_id=p_id) then
  perform public.scraper_record_discovery_error(p_id,'Programme identity changed; review the source'); return 'needs_review'; end if;
 perform public.scraper_stage_discovery(p_candidate);
 select * into d from public.scholarship_discoveries where id=p_id;
 if s.is_manual or s.status='archived' then return 'skipped_manual'; end if;
 rec:=d.extracted_record||d.approved_overrides; crit:=case when d.approved_criteria_overridden then d.approved_criteria else d.extracted_criteria end;
 if cardinality(public.discovery_record_reasons(rec,crit))>0 or cardinality(public.discovery_unresolved_reasons(p_candidate,d.approved_overrides,d.approved_source_url,d.approved_application_url))>0
  or rec->>'source_url' is distinct from d.approved_source_url
  or rec->>'application_link' is distinct from d.approved_application_url then
  update public.scholarship_discoveries set review_state='needs_review',review_reasons=review_reasons||'"Source or application details need review"'::jsonb where id=p_id;
  return 'needs_review'; end if;
 if not d.pending_review then update public.scholarship_discoveries set review_state='ready',review_reasons='[]' where id=p_id; end if;
 if s.source_hash is null then
  if exists(select 1 from public.scholarships where source_hash=d.identity_key and id<>s.id) then raise exception 'INVALID_SOURCE: identity already published'; end if;
  update public.scholarships set source_hash=d.identity_key where id=s.id returning * into s;
 end if;
 if nullif(rec->>'deadline','')::date<current_date then rec:=rec||'{"status":"expired"}'; end if;
 rec:=rec||jsonb_build_object('source_hash',s.source_hash,'last_scraped_at',now());
 select coalesce(jsonb_agg(to_jsonb(c)-array['id','scholarship_id'] order by c.label,c.criterion_type),'[]') into old_criteria from public.scholarship_criteria c where scholarship_id=s.id;
 outcome:=public.scraper_upsert_scholarship(rec,crit);
 if outcome='unchanged' and old_criteria is distinct from (select coalesce(jsonb_agg(value order by value->>'label',value->>'criterion_type'),'[]') from jsonb_array_elements(crit)) then
  delete from public.scholarship_criteria where scholarship_id=s.id;
  insert into public.scholarship_criteria(scholarship_id,criterion_type,operator,value,label,is_checkable)
  select s.id,c->>'criterion_type',c->>'operator',c->'value',c->>'label',coalesce((c->>'is_checkable')::boolean,false) from jsonb_array_elements(crit)c;
  outcome:='updated'; end if;
 return outcome;
end $$;

create table public.scholarship_publication_guards (
 transaction_id bigint not null, scholarship_id uuid not null, actor_user_id uuid not null,
 allow_update boolean not null default false,
 primary key(transaction_id,scholarship_id,actor_user_id)
);
alter table public.scholarship_publication_guards enable row level security;
revoke all on public.scholarship_publication_guards from public,anon,authenticated,service_role;
create or replace function public.mark_manual_scholarship() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is not null then
  if exists(select 1 from public.scholarship_publication_guards
    where transaction_id=txid_current() and scholarship_id=new.id and actor_user_id=auth.uid()
    and (tg_op='INSERT' or (allow_update and tg_op='UPDATE'))) then
    if tg_op='INSERT' then new.is_manual:=false; else new.is_manual:=old.is_manual; end if;
  else new.is_manual:=true; end if;
 end if;
 return new;
end $$;
create function public.mark_manual_scholarship_criteria() returns trigger
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if tg_op='DELETE' then v_id:=old.scholarship_id; else v_id:=new.scholarship_id; end if;
 if auth.uid() is not null and not exists(select 1 from public.scholarship_publication_guards where transaction_id=txid_current() and scholarship_id=v_id and actor_user_id=auth.uid()) then
  update public.scholarships set is_manual=true where id=v_id;
 end if;
 if tg_op='DELETE' then return old; end if; return new;
end $$;
create trigger trg_criteria_mark_manual after insert or update or delete on public.scholarship_criteria
for each row execute function public.mark_manual_scholarship_criteria();

create function public.discovery_audit(p_action text,p_id uuid,p_metadata jsonb default '{}') returns void
language sql security definer set search_path=public as $$
 insert into public.audit_log(actor_user_id,action,target_table,target_id,metadata)
 values(auth.uid(),'discovery.'||p_action,'scholarship_discoveries',p_id,p_metadata)
$$;

create function public.scraper_stage_discovery(p_candidate jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.scholarship_discoveries; v_id uuid; v_new boolean; rec jsonb; crit jsonb; reasons text[]; state text; existing public.scholarships;
begin
 if coalesce(p_candidate->>'identity_key','')='' or not public.discovery_https_url(p_candidate->>'canonical_url') then raise exception 'INVALID_SOURCE'; end if;
 select discovery_id into v_id from public.scholarship_discovery_aliases where identity_key=p_candidate->>'identity_key';
 if v_id is null then select id into v_id from public.scholarship_discoveries where identity_key=p_candidate->>'identity_key'; end if;
 v_new:=v_id is null;
 rec:=coalesce(p_candidate->'record','{}'); crit:=coalesce(p_candidate->'criteria','[]');
 reasons:=public.discovery_record_reasons(rec,crit);
 if p_candidate->>'review_state'<>'ready' or jsonb_array_length(coalesce(p_candidate->'review_reasons','[]'))>0 then reasons:=array_append(reasons,'Review extracted evidence'); end if;
 if not coalesce((p_candidate->'evidence'->>'official_source')::boolean,false) then reasons:=array_append(reasons,'Confirm official source'); end if;
 state:=case when cardinality(reasons)=0 then 'ready' else 'needs_review' end;
 if v_new then
  select * into existing from public.scholarships where source_hash=p_candidate->>'identity_key';
  insert into public.scholarship_discoveries(identity_key,canonical_url,programme_key,name,provider,extracted_record,extracted_criteria,evidence,review_reasons,review_state,last_checked_at,scholarship_id,monitoring_enabled)
   values(p_candidate->>'identity_key',p_candidate->>'canonical_url',coalesce(p_candidate->>'programme_key',''),left(coalesce(rec->>'name',''),500),left(coalesce(rec->>'provider',''),500),rec,crit,coalesce(p_candidate->'evidence','{}'),to_jsonb(reasons),state,now(),existing.id,coalesce(existing.id is not null and not existing.is_manual and existing.status in ('active','expired'),false))
   on conflict(identity_key) do update set last_discovered_at=now() returning id into v_id;
 else
  select * into d from public.scholarship_discoveries where id=v_id for update;
  update public.scholarship_discoveries set extracted_record=rec,extracted_criteria=crit,evidence=coalesce(p_candidate->'evidence','{}'),last_discovered_at=now(),last_checked_at=now(),last_error=null,
   name=left(coalesce(d.review_overrides->>'name',rec->>'name',''),500),provider=left(coalesce(d.review_overrides->>'provider',rec->>'provider',''),500),
   review_reasons=case when d.pending_review then d.review_reasons else to_jsonb(reasons) end,review_state=case when d.review_state='ignored' then 'ignored' when d.pending_review then d.review_state else state end,revision=revision+1 where id=v_id;
 end if;
 return jsonb_build_object('id',v_id,'outcome',case when v_new then 'created' else 'updated' end);
end $$;

create function public.save_discovery_review(p_id uuid,p_revision integer,p_record jsonb,p_criteria jsonb,p_official_source_confirmed boolean,p_approved_application_url text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d public.scholarship_discoveries; reasons text[]; overrides jsonb;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into d from public.scholarship_discoveries where id=p_id for update;
 if not found then raise exception 'INVALID_SOURCE'; end if;
 if d.revision<>p_revision then raise exception 'STALE_REVIEW'; end if;
 reasons:=public.discovery_record_reasons(p_record,p_criteria);
 if not p_official_source_confirmed then reasons:=array_append(reasons,'Confirm official source'); end if;
 if p_record->>'application_link' is distinct from p_approved_application_url then reasons:=array_append(reasons,'Confirm application destination'); end if;
 select coalesce(jsonb_object_agg(key,value),'{}') into overrides from jsonb_each(p_record)
 where key in ('name','provider','description','funding_amount','field_of_study','education_levels','deadline','application_link','status','source_url') and value is distinct from d.extracted_record->key;
 update public.scholarship_discoveries set draft_record=p_record,draft_criteria=p_criteria,review_overrides=overrides,criteria_overridden=p_criteria is distinct from d.extracted_criteria,
  name=left(coalesce(p_record->>'name',''),500),provider=left(coalesce(p_record->>'provider',''),500),official_source_confirmed=p_official_source_confirmed,
  draft_application_url=p_approved_application_url,pending_review=d.scholarship_id is not null,
  review_reasons=to_jsonb(reasons),review_state=case when cardinality(reasons)=0 then 'ready' else 'needs_review' end,revision=revision+1 where id=p_id returning * into d;
 perform public.discovery_audit('review',p_id);
 return to_jsonb(d);
end $$;

create function public.publish_scholarship_discovery(p_id uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path=public as $$
declare d public.scholarship_discoveries; rec jsonb; crit jsonb; v_id uuid; v_status text;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into d from public.scholarship_discoveries where id=p_id for update;
 if not found then raise exception 'INVALID_SOURCE'; end if;
 if d.scholarship_id is not null then return d.scholarship_id; end if;
 if d.revision<>p_revision then raise exception 'STALE_REVIEW'; end if;
 rec:=d.extracted_record||d.review_overrides; crit:=case when d.criteria_overridden then d.draft_criteria else d.extracted_criteria end;
 if d.review_state<>'ready' or cardinality(public.discovery_record_reasons(rec,crit))>0
  or not(d.official_source_confirmed or coalesce((d.evidence->>'official_source')::boolean,false)) then raise exception 'NOT_READY'; end if;
 if rec->>'application_link' is not null and rec->>'application_link' is distinct from d.draft_application_url
  and not coalesce((d.evidence->>'trusted_application')::boolean,false) then raise exception 'NOT_READY: confirm application destination'; end if;
 select id into v_id from public.scholarships where source_hash=d.identity_key for update;
 if v_id is null then
  v_id:=gen_random_uuid();
  insert into public.scholarship_publication_guards(transaction_id,scholarship_id,actor_user_id) values(txid_current(),v_id,auth.uid());
  v_status:=case when nullif(rec->>'deadline','')::date<current_date then 'expired' else rec->>'status' end;
  insert into public.scholarships(id,name,provider,description,funding_amount,education_levels,field_of_study,deadline,application_link,status,source_url,source_hash,last_scraped_at)
  values(v_id,rec->>'name',rec->>'provider',rec->>'description',rec->>'funding_amount',array(select jsonb_array_elements_text(rec->'education_levels')),array(select jsonb_array_elements_text(rec->'field_of_study')),nullif(rec->>'deadline','')::date,rec->>'application_link',v_status,rec->>'source_url',d.identity_key,d.last_checked_at);
  insert into public.scholarship_criteria(scholarship_id,criterion_type,operator,value,label,is_checkable)
  select v_id,c->>'criterion_type',c->>'operator',c->'value',c->>'label',coalesce((c->>'is_checkable')::boolean,false) from jsonb_array_elements(crit)c;
  delete from public.scholarship_publication_guards where transaction_id=txid_current() and scholarship_id=v_id and actor_user_id=auth.uid();
 end if;
 update public.scholarship_discoveries set scholarship_id=v_id,monitoring_enabled=true,official_source_confirmed=true,approved_source_url=rec->>'source_url',approved_application_url=rec->>'application_link',approved_overrides=review_overrides,approved_criteria=draft_criteria,approved_criteria_overridden=criteria_overridden,pending_review=false,approved_by=auth.uid(),approved_at=now(),revision=revision+1 where id=p_id;
 perform public.discovery_audit('publish',p_id,jsonb_build_object('scholarship_id',v_id));
 return v_id;
end $$;

-- Explicit execution grants: RLS bypass is not permission to call a function.
revoke all on function public.discovery_https_url(text), public.discovery_record_reasons(jsonb,jsonb), public.discovery_audit(text,uuid,jsonb), public.mark_manual_scholarship_criteria() from public,anon,authenticated,service_role;
revoke all on function public.scraper_stage_discovery(jsonb),public.scraper_monitor_discovery(uuid,jsonb),public.scraper_record_discovery_error(uuid,text) from public,anon,authenticated;
grant execute on function public.scraper_stage_discovery(jsonb),public.scraper_monitor_discovery(uuid,jsonb),public.scraper_record_discovery_error(uuid,text) to service_role;
revoke all on function public.save_discovery_review(uuid,integer,jsonb,jsonb,boolean,text),public.publish_scholarship_discovery(uuid,integer),public.list_scholarship_discoveries(text,text,text,text,integer,integer),public.set_discovery_ignored(uuid,boolean),public.set_discovery_monitoring(uuid,boolean),public.link_discovery_alias(uuid,uuid),public.save_scholarship_discovery_settings(jsonb) from public,anon;
grant execute on function public.save_discovery_review(uuid,integer,jsonb,jsonb,boolean,text),public.publish_scholarship_discovery(uuid,integer),public.list_scholarship_discoveries(text,text,text,text,integer,integer),public.set_discovery_ignored(uuid,boolean),public.set_discovery_monitoring(uuid,boolean),public.link_discovery_alias(uuid,uuid),public.save_scholarship_discovery_settings(jsonb) to authenticated;

create function public.begin_discovery_crawl_run(p_triggered_by text,p_triggered_by_user uuid,p_mode text,p_request_id uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if p_mode not in ('discovery','monitoring','combined') then raise exception 'INVALID_SETTINGS'; end if;
 v_id:=public.begin_crawl_run(p_triggered_by,p_triggered_by_user);
 if v_id is not null then update public.crawl_logs set mode=p_mode,request_id=p_request_id where id=v_id; end if;
 return v_id;
end $$;
create function public.finish_discovery_crawl_run(p_id uuid,p_stats jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform public.finish_crawl_run(p_id,p_stats->>'status',0,coalesce((p_stats->>'publications_updated')::integer,0),coalesce((p_stats->>'failed')::integer,0),left(array_to_string(array(select jsonb_array_elements_text(coalesce(p_stats->'errors','[]'))),'; '),2000));
 update public.crawl_logs set leads_found=coalesce((p_stats->>'leads_found')::integer,0),candidates_created=coalesce((p_stats->>'candidates_created')::integer,0),candidates_updated=coalesce((p_stats->>'candidates_updated')::integer,0),monitored=coalesce((p_stats->>'monitored')::integer,0),publications_updated=coalesce((p_stats->>'publications_updated')::integer,0),records_unchanged=coalesce((p_stats->>'unchanged')::integer,0),records_skipped_manual=coalesce((p_stats->>'skipped_manual')::integer,0) where id=p_id;
end $$;
create function public.scraper_selected_discoveries(p_cursor timestamptz,p_after_id uuid,p_cutoff timestamptz,p_limit integer default 100) returns jsonb
language sql security definer set search_path=public as $$
 select coalesce(jsonb_agg(to_jsonb(page)),'[]') from (
 select d.*,coalesce((select jsonb_agg(a.identity_key) from public.scholarship_discovery_aliases a where a.discovery_id=d.id),'[]') aliases
 from public.scholarship_discoveries d where monitoring_enabled and scholarship_id is not null and review_state<>'ignored'
 and coalesce(last_checked_at,'1970-01-01'::timestamptz)<=p_cutoff
 and (coalesce(last_checked_at,'1970-01-01'::timestamptz),id)>(p_cursor,p_after_id)
 order by coalesce(last_checked_at,'1970-01-01'::timestamptz),id limit least(greatest(p_limit,1),100)) page
$$;
revoke all on function public.begin_discovery_crawl_run(text,uuid,text,uuid),public.finish_discovery_crawl_run(uuid,jsonb),public.scraper_selected_discoveries(timestamptz,uuid,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.begin_discovery_crawl_run(text,uuid,text,uuid),public.finish_discovery_crawl_run(uuid,jsonb),public.scraper_selected_discoveries(timestamptz,uuid,timestamptz,integer) to service_role;

create function public.discovery_unresolved_reasons(p_candidate jsonb,p_overrides jsonb,p_source text,p_application text) returns text[]
language plpgsql immutable set search_path=public as $$
declare reason text; field_name text; unresolved text[]:='{}';
begin
 for reason in select jsonb_array_elements_text(coalesce(p_candidate->'review_reasons','[]')) loop
  if reason='Confirm official source' and p_candidate->'record'->>'source_url'=p_source then continue; end if;
  if reason='Confirm application destination' and p_candidate->'record'->>'application_link' is not distinct from p_application then continue; end if;
  field_name:=case reason when 'Confirm provider' then 'provider' when 'Add programme description' then 'description' when 'Confirm education levels' then 'education_levels' when 'Confirm recognised education levels' then 'education_levels' when 'Confirm application status' then 'status' when 'Confirm closing date' then 'deadline' when 'Confirm programme name' then 'name' else null end;
  if field_name is not null and p_overrides ? field_name then continue; end if;
  unresolved:=array_append(unresolved,reason);
 end loop;
 return unresolved;
end $$;
revoke all on function public.discovery_unresolved_reasons(jsonb,jsonb,text,text) from public,anon,authenticated,service_role;

create function public.approve_scholarship_discovery_changes(p_id uuid,p_revision integer) returns uuid
language plpgsql security definer set search_path=public as $$
declare d public.scholarship_discoveries; s public.scholarships; rec jsonb; crit jsonb; observed text;
begin
 if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
 select * into d from public.scholarship_discoveries where id=p_id for update;
 if not found or d.scholarship_id is null then raise exception 'NOT_READY'; end if;
 if d.revision<>p_revision then raise exception 'STALE_REVIEW'; end if;
 if not d.pending_review then return d.scholarship_id; end if;
 rec:=d.extracted_record||d.review_overrides;crit:=case when d.criteria_overridden then d.draft_criteria else d.extracted_criteria end;
 if d.review_state<>'ready' or not d.official_source_confirmed or cardinality(public.discovery_record_reasons(rec,crit))>0 or rec->>'application_link' is distinct from d.draft_application_url then raise exception 'NOT_READY'; end if;
 select * into s from public.scholarships where id=d.scholarship_id for update;
 if s.is_manual or s.status='archived' then raise exception 'NOT_READY: publication has protected manual edits'; end if;
 if nullif(rec->>'deadline','')::date<current_date then rec:=rec||'{"status":"expired"}'; end if;
 rec:=rec||jsonb_build_object('source_hash',s.source_hash,'last_scraped_at',now());
 insert into public.scholarship_publication_guards(transaction_id,scholarship_id,actor_user_id,allow_update) values(txid_current(),s.id,auth.uid(),true);
 if s.source_hash is null then
  if exists(select 1 from public.scholarships where source_hash=d.identity_key and id<>s.id) then raise exception 'INVALID_SOURCE: identity already published'; end if;
  update public.scholarships set source_hash=d.identity_key where id=s.id returning * into s;
  rec:=rec||jsonb_build_object('source_hash',s.source_hash);
 end if;
 perform public.scraper_upsert_scholarship(rec,crit);
 -- Criteria-only approvals are content changes even when other fields are equal.
 delete from public.scholarship_criteria where scholarship_id=s.id;
 insert into public.scholarship_criteria(scholarship_id,criterion_type,operator,value,label,is_checkable)
 select s.id,c->>'criterion_type',c->>'operator',c->'value',c->>'label',coalesce((c->>'is_checkable')::boolean,false) from jsonb_array_elements(crit)c;
 delete from public.scholarship_publication_guards where transaction_id=txid_current() and scholarship_id=s.id and actor_user_id=auth.uid();
 observed:=d.evidence->>'observed_identity_key';
 if observed is not null and observed<>d.identity_key and d.evidence->>'source_url'=rec->>'source_url' then
  if exists(select 1 from public.scholarship_discoveries where identity_key=observed and scholarship_id is not null and scholarship_id<>s.id) then raise exception 'INVALID_SOURCE: conflicting publication'; end if;
  insert into public.scholarship_discovery_aliases(identity_key,discovery_id) values(observed,p_id) on conflict(identity_key) do update set discovery_id=excluded.discovery_id;
 end if;
 update public.scholarship_discoveries set approved_overrides=review_overrides,approved_criteria=draft_criteria,approved_criteria_overridden=criteria_overridden,approved_source_url=rec->>'source_url',approved_application_url=rec->>'application_link',pending_review=false,approved_by=auth.uid(),approved_at=now(),revision=revision+1 where id=p_id;
 perform public.discovery_audit('approve_changes',p_id,jsonb_build_object('scholarship_id',s.id));
 return s.id;
end $$;
revoke all on function public.approve_scholarship_discovery_changes(uuid,integer) from public,anon;
grant execute on function public.approve_scholarship_discovery_changes(uuid,integer) to authenticated;
