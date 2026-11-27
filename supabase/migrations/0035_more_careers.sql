-- Six more careers (November 2026): Mechanical Engineer, Electrical Engineer, Lawyer,
-- Psychologist, Chef and Physiotherapist. Same evidence policy as 0019
-- (docs/career-malaysia-audit.md):
--  * overview, responsibilities and skills are short Nexus paraphrases of the Malaysian
--    PERKESO / MYFutureJobs occupation profile, used only within its stated scope;
--  * study options cite the Malaysian body for the route (BEM, Malaysian Bar, MAHPC) plus
--    MQA and UPU, and say where a source could not be fully checked;
--  * O*NET is used ONLY for the occupational RIASEC interest code.
-- Checked 25 November 2026. Inserts only careers whose slug is not already present, so a
-- replay or an administrator-created career with the same slug is left untouched.

create or replace function pg_temp.c35_source(title text, publisher text, url text, scope text,
  jurisdiction text default 'Malaysia', access_note text default '') returns jsonb
language sql as $$
 select jsonb_build_object('source_id', url, 'title', title, 'publisher', publisher, 'url', url,
   'jurisdiction', jurisdiction, 'scope', scope, 'access_note', access_note, 'effective_on', null);
$$;
create or replace function pg_temp.c35_section(sources jsonb, kind text default 'source_informed',
  limitation text default null) returns jsonb
language sql as $$
 select jsonb_build_object('status', case when limitation is null then 'source_checked' else 'limited' end,
   'kind', kind, 'checked_on', '2026-11-25',
   'limitations', case when limitation is null then '[]'::jsonb else jsonb_build_array(limitation) end,
   'sources', sources);
$$;

create temporary table c35_careers(n int primary key, payload jsonb) on commit drop;
insert into c35_careers values
(15, $c${
 "name":"Mechanical Engineer","slug":"mechanical-engineer","field":"Engineering",
 "description":"Researches, plans and designs mechanical products and systems, and supervises how they are made, installed, operated and repaired.",
 "responsibilities":["Design and adjust mechanical products and systems","Supervise fabrication, installation and repair","Research and analyse engineering data"],
 "skills":["Engineering design","Technical drawing software","Mechanics","Scientific research"],
 "subjects":["MATH","ADD_MATH","PHYSICS","CHEMISTRY","REKA_CIPTA"],
 "study":["Choose an engineering degree accredited by the Engineering Accreditation Council so you can register with BEM.","Register as a Graduate Engineer, then work towards Professional Engineer (Ir.)."],
 "source":["Mechanical Engineer","https://myfuturejobs.gov.my/mechanical-engineer/","Occupational description, skills and knowledge areas; professional registration is separate."],
 "routes":[["Registration: Graduate Engineer and Professional Engineer","Board of Engineers Malaysia","https://bem.org.my/Landing/register","Graduate and Professional Engineer registration; programme admission is decided by each institution."]],
 "onet":["17-2141.00","Mechanical Engineers","RIC","direct"]
}$c$::jsonb),
(16, $c${
 "name":"Electrical Engineer","slug":"electrical-engineer","field":"Engineering",
 "description":"Designs and develops electrical systems and equipment, from power stations and power distribution to the components inside household appliances.",
 "responsibilities":["Design and develop electrical systems and equipment","Plan and maintain power generation and distribution","Check designs against regulations and safety rules"],
 "skills":["Electrical principles","Engineering design","Technical drawing software","Regulatory compliance"],
 "subjects":["MATH","ADD_MATH","PHYSICS","CHEMISTRY","ICT"],
 "study":["Choose an engineering degree accredited by the Engineering Accreditation Council so you can register with BEM.","Register as a Graduate Engineer, then work towards Professional Engineer (Ir.)."],
 "source":["Electrical Engineer","https://myfuturejobs.gov.my/electrical-engineer/","Occupational description, skills and knowledge areas; professional registration is separate."],
 "routes":[["Registration: Graduate Engineer and Professional Engineer","Board of Engineers Malaysia","https://bem.org.my/Landing/register","Graduate and Professional Engineer registration; programme admission is decided by each institution."]],
 "onet":["17-2071.00","Electrical Engineers","RIC","direct"]
}$c$::jsonb),
(17, $c${
 "name":"Lawyer","slug":"lawyer","field":"Social Sciences",
 "description":"Advises clients on the law and represents them in legal proceedings, researching and interpreting cases to build arguments in courts and other settings.",
 "responsibilities":["Advise clients on their legal position","Research, interpret and prepare cases","Represent clients in court and negotiations"],
 "skills":["Legal research and interpretation","Persuasive argument","Negotiation","Confidentiality and professional ethics"],
 "subjects":["BM","BI","SEJARAH","EKONOMI"],
 "study":["Study a law degree (LLB) recognised for admission to the Malaysian Bar.","Complete pupillage in chambers before applying for admission as an Advocate and Solicitor."],
 "source":["Lawyer","https://myfuturejobs.gov.my/lawyer/","Occupational description and skills; admission to practise is separate."],
 "routes":[["Become a Member: Pupillage","Malaysian Bar","https://www.malaysianbar.org.my/list/members/become-a-member/pupillage","Pupillage before admission; detailed rules and forms require a member login."],["Become a Member: Admission","Malaysian Bar","https://www.malaysianbar.org.my/list/members/become-a-member/admission","Admission as an Advocate and Solicitor; detailed rules and forms require a member login."]],
 "limited":"The Bar's detailed pupillage and admission documents need a member login, and the Legal Profession Qualifying Board site was unreachable. Confirm which law degrees qualify, whether the CLP applies to you and the pupillage period with the Malaysian Bar.",
 "onet":["23-1011.00","Lawyers","ECI","direct"]
}$c$::jsonb),
(18, $c${
 "name":"Psychologist","slug":"psychologist","field":"Social Sciences",
 "description":"Studies human behaviour and mental processes and helps clients with mental health and life difficulties through assessment, counselling and therapy.",
 "responsibilities":["Assess clients and interpret psychological tests","Provide counselling and therapy","Monitor progress and refer clients when needed"],
 "skills":["Psychological assessment","Counselling","Active listening","Professional ethics"],
 "subjects":["BI","BIOLOGY","MATH","SCIENCE"],
 "study":["Start with a psychology degree; clinical and counselling practice usually needs postgraduate training.","Check registration for your intended role (for example clinical psychology with MAHPC)."],
 "source":["Psychologist","https://myfuturejobs.gov.my/psychologist/","Occupational description and skills. The profile follows an international skills catalogue; prescribing medication is not part of a psychologist's role in Malaysia and is not used here."],
 "routes":[["Allied health professionals must register with MAHPC","The Star (report on MAHPC registration)","https://www.thestar.com.my/news/nation/2025/06/23/allied-health-professionals-must-register-by-dec-31-next-year","Registration duty for allied health professionals; check the category for your role."],["MAHPC information","Malaysian Allied Health Professions Council, Ministry of Health","https://hq.moh.gov.my/alliedhealth/index.php/ms/site-mahpc/info-mahpc","Qualification and registration resources for allied health professions."]],
 "limited":"Profession-specific registration documents (for example clinical psychology) could not be checked automatically. Counselling and clinical routes differ; confirm the qualification and registration with MAHPC or the relevant board.",
 "onet":["19-3033.00","Clinical and Counseling Psychologists","SI","related"]
}$c$::jsonb),
(19, $c${
 "name":"Chef","slug":"chef","field":"Creative & Design",
 "description":"Plans and prepares food in professional kitchens, creating menus and dishes while running a safe, hygienic and well-organised kitchen team.",
 "responsibilities":["Plan menus and prepare dishes","Keep food safety and hygiene standards","Lead and instruct kitchen staff"],
 "skills":["Cooking and finishing techniques","Food safety and hygiene","Menu planning","Kitchen team leadership"],
 "subjects":["BI","SCIENCE","PERNIAGAAN","MATH"],
 "study":["A diploma in culinary arts is the common route into professional kitchens.","A degree in culinary arts or hospitality management is optional for senior or management roles."],
 "source":["Chef","https://myfuturejobs.gov.my/chef/","Occupational description, skills and kitchen roles; no professional licence is described."],
 "routes":[],
 "onet":["35-1011.00","Chefs and Head Cooks","ERC","direct"]
}$c$::jsonb),
(20, $c${
 "name":"Physiotherapist","slug":"physiotherapist","field":"Healthcare",
 "description":"Helps people develop, maintain or restore movement and physical function, relieving pain and treating or preventing conditions caused by injury, disease or impairment.",
 "responsibilities":["Assess patients and plan treatment","Deliver therapy and rehabilitation","Teach patients and carers to manage their condition"],
 "skills":["Physiotherapy assessment","Rehabilitation techniques","Human anatomy and physiology","Patient communication"],
 "subjects":["BIOLOGY","CHEMISTRY","PHYSICS","MATH","BI"],
 "study":["Study a diploma or degree in physiotherapy at an accredited programme.","Register with the Malaysian Allied Health Professions Council before practising."],
 "source":["Physiotherapist","https://myfuturejobs.gov.my/physiotherapist/","Occupational description, skills and knowledge areas; registration to practise is separate."],
 "routes":[["Allied health professionals must register with MAHPC","The Star (report on MAHPC registration)","https://www.thestar.com.my/news/nation/2025/06/23/allied-health-professionals-must-register-by-dec-31-next-year","Registration duty for allied health professionals; check the category for your role."],["MAHPC information","Malaysian Allied Health Professions Council, Ministry of Health","https://hq.moh.gov.my/alliedhealth/index.php/ms/site-mahpc/info-mahpc","Qualification and registration resources for allied health professions."]],
 "limited":"Physiotherapy-specific registration documents could not be checked automatically. Confirm the recognised qualification and registration requirements with MAHPC.",
 "onet":["29-1123.00","Physical Therapists","SIR","related"]
}$c$::jsonb);

do $$
declare
  item record; d jsonb; route jsonb; occupational jsonb; routes jsonb; interests jsonb;
  limitation text; review jsonb;
begin
  for item in select * from c35_careers order by n loop
    d = item.payload;
    if exists(select 1 from public.careers where slug = d->>'slug') then continue; end if;
    limitation = d->>'limited';
    occupational = jsonb_build_array(pg_temp.c35_source(d#>>'{source,0}', 'PERKESO / MYFutureJobs',
      d#>>'{source,1}', d#>>'{source,2}'));
    routes = '[]';
    for route in select * from jsonb_array_elements(d->'routes') loop
      routes = routes || jsonb_build_array(pg_temp.c35_source(route->>0, route->>1, route->>2, route->>3));
    end loop;
    routes = routes || jsonb_build_array(
      pg_temp.c35_source('Malaysian Qualifications Register', 'Malaysian Qualifications Agency',
        'https://www.mqa.gov.my/mqr/english/ecarianakr.cfm',
        'Lookup of accredited programmes; does not decide admission or credit transfer.'),
      pg_temp.c35_source('UPU admission information', 'Ministry of Higher Education', 'https://upu.mohe.gov.my/',
        'Public-institution application information and programme requirement links. Check the institution directly for other routes.'));
    interests = jsonb_build_array(pg_temp.c35_source(d#>>'{onet,1}', 'O*NET OnLine',
      'https://www.onetonline.org/link/summary/' || (d#>>'{onet,0}'),
      'Occupational RIASEC interest code only. U.S. reference occupation; not Malaysian work, admission or registration guidance.',
      'United States'));
    interests = jsonb_set(interests, '{0,source_id}', to_jsonb(d#>>'{onet,0}'));
    review = jsonb_build_object(
      'status', case when limitation is null then 'source_checked' else 'limited' end,
      'checked_on', '2026-11-25',
      'limitations', case when limitation is null then '[]'::jsonb else jsonb_build_array(limitation) end,
      'sections', jsonb_build_object(
        'overview', pg_temp.c35_section(occupational),
        'responsibilities', pg_temp.c35_section(occupational),
        'skills', pg_temp.c35_section(occupational),
        'subjects', pg_temp.c35_section(occupational, 'nexus_planning'),
        'study_options', pg_temp.c35_section(routes, 'nexus_planning', limitation),
        'interests', pg_temp.c35_section(interests)));
    insert into public.careers (id, name, slug, field, description, responsibilities, required_skills,
      useful_subjects, education_routes, riasec_profile, reference_occupations, content_review, is_active)
    values (('b0000000-0000-4000-8000-' || lpad(item.n::text, 12, '0'))::uuid,
      d->>'name', d->>'slug', d->>'field', d->>'description',
      array(select jsonb_array_elements_text(d->'responsibilities')),
      array(select jsonb_array_elements_text(d->'skills')),
      array(select jsonb_array_elements_text(d->'subjects')),
      array(select jsonb_array_elements_text(d->'study')),
      d#>>'{onet,2}',
      jsonb_build_array(jsonb_build_object('reference_id', d#>>'{onet,0}', 'name', d#>>'{onet,1}',
        'interest_code', d#>>'{onet,2}', 'mapping_kind', d#>>'{onet,3}',
        'scope_note', 'U.S. reference occupation used only for its RIASEC interest code.',
        'interest_source_id', d#>>'{onet,0}')),
      review, true)
    on conflict (id) do nothing;
  end loop;
end $$;
