-- Malaysian career content checked 15 October 2026; see docs/career-malaysia-audit.md.
-- O*NET is retained ONLY as occupational RIASEC interest evidence, with its original check date.
-- Apply after 0017 and 0018. Do not amend earlier migrations or reset a hosted database.
-- Only intact 0018-reviewed seeds are replaced. Administrator changes are preserved.

create or replace function pg_temp.my_career_source(title text,publisher text,url text,scope text,access_note text default '',effective_on text default null) returns jsonb
language sql as $$
 select jsonb_build_object('source_id',url,'title',title,'publisher',publisher,'url',url,
  'jurisdiction','Malaysia','scope',scope,'access_note',access_note,'effective_on',effective_on);
$$;
create or replace function pg_temp.my_career_section(sources jsonb,kind text default 'source_informed',limitation text default null) returns jsonb
language sql as $$
 select jsonb_build_object('status',case when limitation is null then 'source_checked' else 'limited' end,
  'kind',kind,'checked_on','2026-10-15','limitations',case when limitation is null then '[]'::jsonb else jsonb_build_array(limitation) end,'sources',sources);
$$;

create temporary table my_career_candidates(n int primary key,payload jsonb) on commit preserve rows;
insert into my_career_candidates values
(1,$my${
 "description":"Assesses and treats patients, advises on prevention and coordinates continuing care in Malaysia. The work and training differ between general practice and medical specialties.",
 "responsibilities":["Examine patients and assess illnesses","Discuss treatment and preventive care","Prepare clinical reports and coordinate care"],
 "skills":["Clinical decision making","Patient communication","Care planning"],
 "sources":[["Generalist Medical Practitioners (MASCO 2211)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2211/generalist-medical-practitioners","Malaysian general medical work and skills; specialist duties and recognition are separate."]],
 "routes":[["Medical education and recognised qualifications","Malaysian Medical Council","https://mmc.gov.my/medical-education-recognition-2/","Recognition and current versus upcoming entry guidance; institutional admission remains separate."],["Medical registration types","Malaysian Medical Council","https://mmc.gov.my/registrations/","Provisional and full registration; separate specialist and practising requirements."]],
 "study":["Compare recognised Malaysian medical programmes and their actual science-subject admission requirements.","Check MMC recognition, provisional registration, housemanship and full registration separately."],
 "stages":[["Check medical admission and recognition","Compare the institution admission criteria with currently effective MMC guidance. Confirm recognition of the exact medical qualification."],["Complete a recognised medical qualification","Complete the academic and clinical requirements of the selected programme. Admission does not guarantee a training placement."],["Apply for provisional registration and housemanship","Check MMC provisional registration and approved supervised training requirements for your circumstances."],["Meet full registration and practising requirements","Check full registration and the Annual Practising Certificate. Specialist registration is a separate route."]]
}$my$::jsonb),
(2,$my${
 "description":"Checks and dispenses medicines and advises on their safe use in Malaysian healthcare and pharmacy settings. Hospital, community and industrial roles have different responsibilities.",
 "responsibilities":["Check prescriptions and medicine instructions","Dispense medicines and explain their use","Maintain dispensing records and medicine storage"],
 "skills":["Prescription evaluation","Patient counselling","Accurate record keeping"],
 "sources":[["Pharmacists (MASCO 2262)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2262/pharmacists","Malaysian pharmacy tasks and related skills; not a registration decision."]],
 "routes":[["Recognised pharmacy degrees","Pharmacy Board Malaysia / MOH","https://pharmacy.moh.gov.my/en/content/list-recognized-pharmacy-degree-pharmacy-board-malaysia.html","Check recognition of the exact qualification."],["Qualifying Examination to Practice Pharmacy","Pharmacy Board Malaysia / MOH","https://pharmacy.moh.gov.my/en/content/qualifying-examination-practice-pharmacy.html","QETPP applicant categories and registration prerequisite; updated 18 June 2026."],["PRP training in health clinics","Pharmacy Board Malaysia / MOH","https://pharmacy.moh.gov.my/sites/default/files/document-upload/general-guide-health-clinics.pdf","Supervised PRP training example for approved health-clinic premises; not all training settings."]],
 "study":["Compare Pharmacy Board-recognised pharmacy qualifications and each institution admission criteria.","Plan for the applicable QETPP, provisional registration, approved PRP training and full-registration process."],
 "stages":[["Check pharmacy admission and degree recognition","Check the programme entry criteria and Pharmacy Board recognition before accepting a place."],["Complete the recognised pharmacy programme","Meet the selected programme academic and practical requirements."],["Check QETPP and provisional registration","Follow the examination and registration category applicable to your nationality and qualification."],["Complete approved PRP training","Meet the supervised training and assessment requirements at an approved premise."],["Apply for full registration","Check the current full-registration and practice requirements with Pharmacy Board Malaysia."]]
}$my$::jsonb),
(3,$my${
 "description":"Applies biomedical laboratory and research skills to investigating health and disease. Malaysian biomedical research, industry and regulated clinical laboratory practice are distinct routes.",
 "responsibilities":["Investigate biological samples within the role scope","Use biomedical laboratory methods","Interpret and communicate research or laboratory findings"],
 "skills":["Laboratory techniques","Scientific analysis","Research communication"],
 "sources":[["Biomedical Science programme and career scope","Universiti Malaya","https://study.um.edu.my/Bachelor-of-Biomedical-Science","Institution-specific biomedical disciplines and research/career examples; not recognition of all biomedical degrees.","Official programme text was available through search; direct page retrieval failed during this check."]],
 "routes":[["MAHPC registration and recognised-qualification resources","Malaysian Allied Health Professions Council / MOH","https://hq.moh.gov.my/alliedhealth/index.php/ms/site-mahpc/info-mahpc","Official entry point for profession-specific recognition, registration and practising resources.","The landing page was accessible; linked qualification documents remain unverified."]],
 "limited":"A biomedical degree does not by itself establish eligibility for a regulated clinical profession. The specific qualification-to-MAHPC-registration mapping remains unverified.",
 "study":["Compare biomedical science programmes, laboratory training and research opportunities in Malaysia.","For clinical practice, check the actual profession, recognised qualification and registration directly with MAHPC."],
 "stages":[["Choose research, industry or clinical laboratory work","Identify the actual role before choosing a programme. A broad biomedical title is not a clinical registration category."],["Compare Malaysian programme content","Review laboratory disciplines, research training and the institution admission criteria. UM is one programme example."],["Check profession-specific recognition","For regulated clinical work, obtain current MAHPC confirmation for the exact qualification and profession."],["Build relevant laboratory experience","Compare supervised training, research projects and employer requirements for the chosen branch. No clinical eligibility is promised."]]
}$my$::jsonb),
(4,$my${
 "description":"Plans and designs civil infrastructure and coordinates construction, maintenance and safety work in Malaysia. Professional responsibilities depend on the engineer registration category.",
 "responsibilities":["Develop infrastructure designs and specifications","Coordinate site work and construction materials","Review quality, safety and maintenance needs"],
 "skills":["Engineering design","Construction planning","Technical communication"],
 "sources":[["Civil Engineers (MASCO 2142)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2142/civil-engineers","Malaysian civil engineering work and skills; registration category controls professional permissions.","Official profile text was readable through search; direct retrieval was intermittent."]],
 "routes":[["Engineering registration and recognised qualifications","Board of Engineers Malaysia","https://bem.org.my/landing/register","Graduate Engineer, Professional Engineer and practising-certificate categories have separate requirements."]],
 "study":["Check recognition of the exact civil engineering degree and intake with BEM/EAC.","Distinguish the engineering degree route from engineering technology and diploma qualifications."],
 "stages":[["Check engineering admission and recognition","Verify the exact programme, award and applicable BEM/EAC recognition."],["Complete a recognised engineering qualification","Meet academic and practical requirements. A diploma or technology degree is not automatically the same registration route."],["Apply for Graduate Engineer registration","Check the academic eligibility and current application requirements with BEM."],["Plan professional development and assessment","If pursuing Professional Engineer status, meet BEM experience and assessment requirements. Check the separate practising-certificate category where relevant."]]
}$my$::jsonb),
(5,$my${
 "description":"Builds and improves software for organisational or user needs. Malaysian software roles may involve application development, debugging, technical documentation and work with project teams.",
 "responsibilities":["Translate requirements into software features","Develop and debug applications","Document software and coordinate project delivery"],
 "skills":["Programming","Software debugging","Requirements analysis"],
 "sources":[["Software Developer","PERKESO / MYFutureJobs","https://myfuturejobs.gov.my/software-developer/","Malaysian employment-service description, competencies and related title Software Engineer; not a mandatory qualification route."]],
 "study":["Compare Malaysian computing and software engineering programmes, their admission criteria and MQR records.","Explore diploma or degree study and practical software projects suited to the intended role."],
 "stages":[["Choose a software study direction","Compare programming, software engineering and application-development content in Malaysian programmes."],["Check programme entry and accreditation","Use the institution entry criteria and MQR record; programme names alone do not establish admission."],["Develop and document working software","Practise programming, debugging and requirements analysis through projects or suitable supervised experience."],["Compare Malaysian junior developer roles","Use actual role descriptions to identify expected skills and any internship or graduate requirements."]]
}$my$::jsonb),
(6,$my${
 "description":"Combines and checks data, develops analytical models and explains findings to support decisions. Malaysian data science roles vary across research, business and technical teams.",
 "responsibilities":["Prepare consistent datasets from different sources","Build and evaluate analytical models","Present findings to technical and non-technical audiences"],
 "skills":["Data cleaning","Statistical modelling","Data visualisation"],
 "sources":[["Data Scientist","PERKESO / MYFutureJobs","https://myfuturejobs.gov.my/data-scientist/","Data science work, competencies and knowledge described by Malaysia employment service; not a guaranteed job outcome."]],
 "study":["Compare Malaysian data science, statistics and computing programmes, including mathematics and programming content.","Check actual entry criteria and MQR accreditation; develop analytical projects with clear explanations."],
 "stages":[["Compare quantitative and computing study","Investigate data science, statistics or computing programmes relevant to the work you want to explore."],["Check Malaysian programme admission","Verify subject, qualification and other entry conditions with the institution and check the MQR record."],["Practise the data analysis cycle","Work on collecting, cleaning, modelling and presenting data; document assumptions and limitations."],["Explore graduate data roles","Compare Malaysian employer descriptions for data science, analytics and related roles; titles and requirements vary."]]
}$my$::jsonb),
(7,$my${
 "description":"Develops building designs, drawings and specifications and coordinates clients and construction teams in Malaysia. An architecture qualification and registered Architect status are separate milestones.",
 "responsibilities":["Interpret project briefs and develop building designs","Prepare drawings and construction specifications","Coordinate project requirements and inspect work"],
 "skills":["Architectural design","Technical drawing","Client communication"],
 "sources":[["Building Architects (MASCO 2161)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2161/building-architects","Building architecture work and skills; excludes a blanket landscape or naval architecture mapping."]],
 "routes":[["Graduate Architect registration requirements","Lembaga Arkitek Malaysia","https://classic.lam.gov.my/index.php/requirements-registration-graduate-architects","LAM Part I and Part II qualifications or applicable examination route for Graduate Architect registration."],["Architect registration requirements","Lembaga Arkitek Malaysia","https://classic.lam.gov.my/index.php/registration-requirement-architects","Separate practical experience, Part III and Architect registration requirements."]],
 "study":["Compare architecture programmes against LAM Part I and Part II recognition and the institution admission criteria.","Plan separately for Graduate Architect registration, practical experience, Part III and Architect registration."],
 "stages":[["Check admission and LAM recognition","Verify the recognised Part I and Part II route or applicable LAM examination route for the selected qualification."],["Meet Part I and Part II requirements","Complete the relevant recognised qualifications or examinations; an undergraduate award alone is not registered Architect status."],["Apply for Graduate Architect registration","Confirm the current LAM academic and application requirements."],["Meet experience and Part III requirements","Follow LAM practical experience and professional examination requirements."],["Apply for Architect registration","Check LAM final registration conditions before using registered professional status."]]
}$my$::jsonb),
(8,$my${
 "description":"Creates visual communication for print and digital media, translating a client brief into layouts, text and images. Malaysian design roles can span advertising, publishing and online communication.",
 "responsibilities":["Understand the client brief and intended audience","Develop visual concepts and layouts","Prepare artwork for the chosen publication format"],
 "skills":["Visual concept development","Graphic design software","Interpreting briefs"],
 "sources":[["Graphic Designer","PERKESO / MYFutureJobs","https://myfuturejobs.gov.my/graphic-designer/","Graphic design work, competencies and publishing knowledge; no universal degree or portfolio requirement."]],
 "study":["Compare Malaysian graphic design or visual communication programmes and their portfolio or admission criteria.","Explore diploma, degree or relevant skills study; verify accreditation and the actual award."],
 "stages":[["Explore visual communication study","Compare graphic design, typography, digital tools and publishing content across suitable programmes."],["Check entry and portfolio conditions","Confirm the institution qualification and portfolio requirements and check MQR accreditation where applicable."],["Develop a range of design projects","Practise interpreting briefs and preparing print or digital artwork; use feedback to improve a portfolio."],["Compare Malaysian design opportunities","Explore actual junior design, studio and agency roles and their individual requirements."]]
}$my$::jsonb),
(9,$my${
 "description":"Creates digital visual content for multimedia productions. Animation, visual effects and interface design are different specialisms; the work depends on the Malaysian studio or production role.",
 "responsibilities":["Develop digital content concepts","Plan production tasks and visual assets","Refine content with feedback from the team"],
 "skills":["Digital content creation","Production planning","Creative collaboration"],
 "sources":[["Animation and Visual Effects Professionals (MASCO 2541)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2541/animation-and-visual-effects-professionals","Animation and visual-effects branch example; does not establish the duties of every multimedia or interface role."]],
 "study":["Choose an animation, visual-effects, multimedia or interface focus before comparing Malaysian programmes.","Check programme content, accreditation and portfolio conditions for the chosen specialism."],
 "stages":[["Choose your multimedia specialism","Distinguish animation and visual-effects production from interactive or interface work."],["Compare Malaysian programme content","Check digital media or related programmes, entry conditions and accreditation for the branch you choose."],["Create a focused portfolio or showreel","Practise a small production workflow and demonstrate your contribution; the expected format varies by role."],["Explore studio and digital production roles","Compare real Malaysian vacancies and internship descriptions for the chosen specialism."]]
}$my$::jsonb),
(10,$my${
 "description":"Provides nursing care and health advice as part of Malaysian healthcare teams. The role and permitted practice depend on nursing preparation, registration and the clinical setting.",
 "responsibilities":["Provide patient care within the nursing role","Communicate care needs and health advice","Work with colleagues to coordinate patient support"],
 "skills":["Nursing care","Patient communication","Team coordination"],
 "sources":[["Nursing Professionals (MASCO 2221)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2221/nursing-professionals","General nursing care and communication only; broad profile entries do not authorise prescribing or medical diagnosis."]],
 "routes":[["Nursing registration and practice FAQ","Nursing Board Malaysia / MOH","https://hq.moh.gov.my/nursing/en/faq/","Approved nursing education, examinations, registration and practising-certificate information."]],
 "study":["Compare approved Malaysian nursing diploma or degree programmes and their actual admission conditions.","Check Nursing Board examination, registration and practising-certificate requirements for your route."],
 "stages":[["Check approved nursing programme admission","Verify nursing approval and the exact diploma or degree entry criteria. STAM acceptance must be checked for the particular programme."],["Complete nursing and clinical education","Meet the programme academic and supervised clinical requirements; a general healthcare award is not an interchangeable nursing qualification."],["Meet examination and registration requirements","Check the Nursing Board process and requirements applicable to your training and circumstances."],["Check the required practising certificate","Confirm current practice conditions with the Nursing Board before taking up nursing practice."]]
}$my$::jsonb),
(11,$my${
 "description":"Maintains and analyses accounting information, supports financial reporting and helps organisations plan budgets in Malaysia. Professional membership and permissions for particular services require separate checks.",
 "responsibilities":["Prepare and analyse accounting reports","Support budgeting and financial controls","Investigate discrepancies in financial information"],
 "skills":["Accounting analysis","Budget planning","Financial communication"],
 "sources":[["Accountants and Auditors (MASCO 2411)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2411/accountants-and-auditors","Accounting tasks and skills; broad occupation grouping does not confer membership or public-practice permissions."]],
 "routes":[["MIA membership application checklist","Malaysian Institute of Accountants","https://mia.org.my/storage/2025/11/CA-Application-Checklist_24Oct2025_Final.pdf","Source to consult directly for the applicable membership qualification and experience route.","Direct checklist retrieval failed again on 15 October 2026; detailed eligibility is not certified."]],
 "limited":"Detailed MIA membership and public-practice eligibility require direct confirmation. The official checklist could not be retrieved; a finance or business degree is not treated as an accounting membership qualification.",
 "study":["Compare accounting study and professional qualification routes against current MIA guidance.","Distinguish employment preparation, MIA membership and permission to provide regulated professional services."],
 "stages":[["Identify your intended accounting role","Distinguish employment duties from professional membership and public-practice permissions."],["Confirm the applicable qualification route","Check the exact academic, examination or professional-membership route directly with MIA."],["Check experience and membership conditions","Obtain current MIA guidance for the intended route; the inaccessible checklist has not been treated as verified eligibility."],["Plan the application after confirming eligibility","Prepare the evidence required by MIA. Completing a general finance or business award does not automatically establish membership."]]
}$my$::jsonb),
(12,$my${
 "description":"Teaches subject lessons, assesses learning and supports classroom and co-curricular activities in Malaysian secondary schools. Appointment requirements differ between school sectors and teaching subjects.",
 "responsibilities":["Plan lessons for the applicable curriculum","Teach classes and assess student progress","Discuss learning with colleagues and parents"],
 "skills":["Lesson planning","Classroom communication","Learning assessment"],
 "sources":[["Secondary School Teachers (MASCO 2331)","ILMIA / Department of Statistics Malaysia","https://www.ilmia.gov.my/bda-myjobprofile/job/2331/secondary-school-teachers","Malaysian secondary teaching tasks and skills; school appointment is a separate process."]],
 "routes":[["Education service DG9 appointment qualifications","Suruhanjaya Perkhidmatan Awam Malaysia","https://www.spa.gov.my/syarat-permohonan/ijazah-sarjana-muda-sarjana-doktor-falsafah/pegawai-perkhidmatan-pendidikan-gred-dg9","Government education-service qualification routes; not a recruitment notice or guaranteed secondary-school appointment."]],
 "study":["Compare a recognised education degree with an appropriate subject degree plus recognised teaching qualification.","Check subject specialisation, school sector and current appointment conditions separately."],
 "stages":[["Choose a teaching subject and school sector","Identify secondary teaching subjects and compare government, private and other school expectations."],["Check admission to suitable teacher preparation","Compare recognised education study or an appropriate subject degree with recognised teaching preparation."],["Complete the applicable teaching qualification","Meet the programme academic and practical requirements and verify recognition for the intended appointment."],["Follow the relevant appointment process","For government service, check the current qualification and recruitment requirements. Qualification does not guarantee a post or school placement."]]
}$my$::jsonb),
(13,$my${
 "description":"Identifies information-system risks and helps organisations protect access to data and services in Malaysia. Security assessment, monitoring and advisory roles can require different skills.",
 "responsibilities":["Assess system weaknesses and security risks","Evaluate controls and security policies","Document findings and explain protective measures"],
 "skills":["Risk analysis","Security assessment","Technical reporting"],
 "sources":[["ICT Security Consultant","PERKESO / MYFutureJobs","https://myfuturejobs.gov.my/ict-security-consultant/","Related security assessment and advisory occupation; not a universal profile of every cybersecurity specialism.","Official profile text was readable through search; direct retrieval was intermittent."]],
 "study":["Compare Malaysian computing, information-security or related programmes and the security skills they teach.","Investigate role-specific projects, supervised experience and any employer certification requirements."],
 "stages":[["Choose a security study direction","Compare computing fundamentals, networks, security assessment and risk-management content."],["Check Malaysian study options","Confirm actual entry criteria, qualification level and MQR accreditation for the programme."],["Practise security work with permission","Use authorised labs or supervised projects to assess risks, test controls and explain findings."],["Compare junior security roles","Explore Malaysian employer requirements for assessment, operations or advisory work; one certification is not a universal entry route."]]
}$my$::jsonb),
(14,$my${
 "description":"Checks and interprets data to answer organisational questions and presents results through reports or dashboards. Malaysian data analyst roles vary by business purpose and technical environment.",
 "responsibilities":["Clean and validate organisational datasets","Analyse information against business questions","Prepare reports and visual explanations"],
 "skills":["Data quality checking","Statistical analysis","Dashboard communication"],
 "sources":[["Data Analyst","PERKESO / MYFutureJobs","https://myfuturejobs.gov.my/data-analyst/","Data analysis tasks, knowledge and competencies; business intelligence is one possible branch."]],
 "study":["Compare Malaysian analytics, statistics, business or computing programmes against the role you want to explore.","Check admission and accreditation, and practise working with data and communicating findings."],
 "stages":[["Compare analytical study directions","Investigate quantitative, business analytics and computing options rather than assuming a single compulsory degree."],["Check the actual programme route","Confirm qualification and subject conditions with the Malaysian institution and check accreditation."],["Build a small analytical project","Practise data validation, analysis and visual reporting; explain the business question and limits of the data."],["Explore Malaysian analyst opportunities","Compare real employer requirements for analyst, reporting and business-intelligence roles."]]
}$my$::jsonb);

do $$
declare
 candidate record; c public.careers; cid uuid; previous public.career_content_migration_outcomes;
 baseline public.career_content_migration_outcomes; current_hash text; data jsonb; item jsonb;
 occupational_sources jsonb; route_sources jsonb; interest_review jsonb; sections jsonb; reviewed jsonb;
 stage_review jsonb; level text; start_note text; seq int; limitation text;
 mk constant text = '0019-malaysian-career-content';
begin
 for candidate in select * from my_career_candidates order by n loop
  cid = ('b0000000-0000-4000-8000-' || lpad(candidate.n::text,12,'0'))::uuid;
  select * into c from public.careers where id=cid for update;
  if not found then
   insert into public.career_content_migration_outcomes values(mk,cid,'missing','Original career absent; no replacement inserted.',null,now()) on conflict do nothing;
   continue;
  end if;
  select * into previous from public.career_content_migration_outcomes where migration_key=mk and career_id=cid;
  current_hash = md5(public.career_reviewed_snapshot(c)::text);
  if previous.status='updated' and previous.reviewed_hash=current_hash then continue; end if;
  insert into public.career_content_migration_backups(migration_key,career_id,career_record,stage_records)
   select mk,cid,to_jsonb(c),coalesce((select jsonb_agg(to_jsonb(s) order by s.from_education_level,s.stage_order)
    from public.career_pathway_stages s where s.career_id=cid),'[]') on conflict do nothing;
  select * into baseline from public.career_content_migration_outcomes
   where migration_key='0018-reviewed-career-content' and career_id=cid;
  if previous.career_id is not null or baseline.status is distinct from 'updated'
    or baseline.reviewed_hash is distinct from current_hash then
   update public.careers set content_review=public.pending_career_review(content_review) where id=cid;
   update public.career_pathway_stages set content_review=content_review||jsonb_build_object('status','pending','checked_on',null) where career_id=cid;
   insert into public.career_content_migration_outcomes values(mk,cid,'skipped','Career or pathway differs from the reviewed 0018 seed; preserved for manual Malaysian-content review.',null,now())
    on conflict(migration_key,career_id) do update set status='skipped',reason=excluded.reason,reviewed_hash=null,recorded_at=now();
   continue;
  end if;
  data=candidate.payload; limitation=data->>'limited'; occupational_sources='[]'; route_sources='[]';
  for item in select * from jsonb_array_elements(data->'sources') loop
   occupational_sources=occupational_sources||jsonb_build_array(pg_temp.my_career_source(item->>0,item->>1,item->>2,item->>3,coalesce(item->>4,'')));
  end loop;
  for item in select * from jsonb_array_elements(coalesce(data->'routes','[]')) loop
   route_sources=route_sources||jsonb_build_array(pg_temp.my_career_source(item->>0,item->>1,item->>2,item->>3,coalesce(item->>4,'')));
  end loop;
  route_sources=route_sources||jsonb_build_array(
   pg_temp.my_career_source('Malaysian Qualifications Register','Malaysian Qualifications Agency','https://www.mqa.gov.my/mqr/english/ecarianakr.cfm','Lookup of accredited programmes; does not decide admission, credit transfer or professional recognition.'),
   pg_temp.my_career_source('UPU admission information','Ministry of Higher Education','https://upu.mohe.gov.my/','Public-institution application information and programme requirement links. Check the institution directly for other application routes.'));
  if candidate.n=1 then
   route_sources=route_sources||jsonb_build_array(jsonb_set(
    pg_temp.my_career_source('Upcoming medical entry guidance','Malaysian Medical Council','https://mmc.gov.my/medical-education-recognition-2/','MMC lists requirements enforced from 1 January 2027; not current on the check date.','','2027-01-01'),
    '{source_id}','"mmc-upcoming-2027"'::jsonb));
  end if;
  -- The interest codes and reference mappings are unchanged; retain their actual check date.
  interest_review=c.content_review#>'{sections,interests}';
  interest_review=jsonb_set(interest_review,'{sources}',(select jsonb_agg(
   jsonb_set(s,'{scope}',to_jsonb('Occupational RIASEC interest code only. U.S. reference occupation; not Malaysian work, admission or registration guidance.'::text)))
   from jsonb_array_elements(interest_review->'sources') s));
  sections=jsonb_build_object(
   'overview',pg_temp.my_career_section(occupational_sources),
   'responsibilities',pg_temp.my_career_section(occupational_sources),
   'skills',pg_temp.my_career_section(occupational_sources),
   'subjects',pg_temp.my_career_section(occupational_sources,'nexus_planning'),
   'study_options',pg_temp.my_career_section(route_sources,'nexus_planning',limitation),
   'interests',interest_review);
  reviewed=jsonb_build_object('status',case when limitation is null then 'source_checked' else 'limited' end,
   'checked_on','2026-10-15','limitations',case when limitation is null then '[]'::jsonb else jsonb_build_array(limitation) end,'sections',sections);
  -- Save final substance pending, then stamp its reviewed state separately.
  update public.careers set description=data->>'description',
   responsibilities=array(select jsonb_array_elements_text(data->'responsibilities')),
   required_skills=array(select jsonb_array_elements_text(data->'skills')),
   education_routes=array(select jsonb_array_elements_text(data->'study')),
   content_review=public.pending_career_review(reviewed) where id=cid;
  update public.careers set content_review=reviewed where id=cid;
  delete from public.career_pathway_stages where career_id=cid;
  stage_review=pg_temp.my_career_section(route_sources,'nexus_planning',limitation);
  foreach level in array array['spm','stpm','stam','matriculation','foundation','diploma'] loop
   start_note=case level
    when 'spm' then 'After SPM, compare suitable pre-university, foundation or diploma options against your subject results and the eventual programme requirements. Do not assume direct degree entry.'
    when 'stpm' then 'With STPM, check the selected programme subject combinations, grades and any language or selection requirements with the institution.'
    when 'stam' then 'With STAM, first confirm that the selected programme explicitly accepts your qualification and subjects. Acceptance for one programme does not establish entry to another.'
    when 'matriculation' then 'With matriculation, check your stream, subjects and results against the selected programme requirements and application category.'
    when 'foundation' then 'With foundation, confirm that the receiving institution accepts your exact award and subject combination. Progression between institutions is not automatic.'
    when 'diploma' then 'With a diploma, check whether the award is relevant to the intended study or professional route. Admission and credit transfer require separate institutional decisions.' end;
   insert into public.career_pathway_stages(career_id,from_education_level,stage_order,stage_title,stage_description,focus_points,content_review)
    values(cid,level,1,'Check your '||upper(level)||' starting route',start_note,
     array['Check the actual programme requirements','Use UPU where applicable, or apply through the institution'],stage_review);
   seq=1;
   for item in select * from jsonb_array_elements(data->'stages') loop
    seq=seq+1;
    insert into public.career_pathway_stages(career_id,from_education_level,stage_order,stage_title,stage_description,focus_points,content_review)
     values(cid,level,seq,item->>0,item->>1,'{}'::text[],stage_review);
   end loop;
  end loop;
  select * into c from public.careers where id=cid;
  insert into public.career_content_migration_outcomes values(mk,cid,'updated','Malaysian career content and education routes applied; O*NET retained for RIASEC interests only.',md5(public.career_reviewed_snapshot(c)::text),now());
 end loop;
end;
$$;
drop table my_career_candidates;
