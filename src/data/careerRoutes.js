/**
 * Malaysian education routes from a student's current level to each career.
 *
 * Deterministic, reviewed content in the same spirit as recommend/rules.json:
 * nothing here is generated, and the route map only arranges these facts.
 *
 * Rules for editing this file
 *  - Every stage cites at least one source in SOURCES. Prefer official bodies
 *    (KPM, MPM, UPU, MQA, MMC, BEM, LAM, LJM, MIA, Pharmacy Board, MAHPC).
 *  - Durations are typical full-time ranges, shown as "typical". Where official
 *    sources disagree or are dated, omit the number and name the body to check
 *    (housemanship, architect practical experience).
 *  - Route availability is a planning aid, not an entry decision. `check` means
 *    the route exists but is restricted or institution-specific.
 *  - Update CHECKED_ON whenever facts are re-checked.
 */

export const CHECKED_ON = '2026-11-25';

/** @typedef {'common' | 'possible' | 'check'} RouteStatus */

export const SOURCES = Object.freeze({
  govFormSix: {
    title: 'Form Six (STPM)',
    publisher: 'Malaysian Government Portal (malaysia.gov.my)',
    url: 'https://www.malaysia.gov.my/en/categories/school--education/pre-university-programme/form-six',
  },
  govMatric: {
    title: 'Matriculation Programme (KPM)',
    publisher: 'Malaysian Government Portal (malaysia.gov.my)',
    url: 'https://www.malaysia.gov.my/en/categories/school--education/pre-university-programme/matriculation-programme-moe',
  },
  govFoundation: {
    title: 'Foundation programmes (Asasi)',
    publisher: 'Malaysian Government Portal (malaysia.gov.my)',
    url: 'https://www.malaysia.gov.my/en/categories/school--education/pre-university-programme/foundation-programmes-asasi',
  },
  govDiploma: {
    title: 'Diploma programmes',
    publisher: 'Malaysian Government Portal (malaysia.gov.my)',
    url: 'https://www.malaysia.gov.my/en/topics/diploma-programmes',
  },
  ecctisMalaysia: {
    title: 'Malaysian qualifications: degree length and diploma advanced standing',
    publisher: 'Ecctis (UK qualification recognition), Technical Annex',
    url: 'https://assets.ecctis.com/uploads/2026/04/Technical-Annex-1.pdf',
  },
  mmuCreditTransfer: {
    title: 'Credit Transfer Policy (example of an institution’s own rules)',
    publisher: 'Multimedia University',
    url: 'https://creative.mmu.edu.my/wp-content/uploads/2022/11/i649_Credit-Transfer-Policy_03032022-1.pdf',
  },
  mmcEntry: {
    title: 'Minimum Qualification for Entry into Medical Programme',
    publisher: 'Malaysian Medical Council',
    url: 'https://mmc.gov.my/wp-content/uploads/2023/09/Minimum-Qualification-for-Entry-into-Medical-Programme-Edition-1-2021-Effective-31-July-2023.pdf',
  },
  umMbbs: {
    title: 'MBBS entry requirements (local applicants)',
    publisher: 'Faculty of Medicine, Universiti Malaya',
    url: 'https://medicine.um.edu.my/pdf/undergraduate/MBBS-local.pdf',
  },
  mmcProvisional: {
    title: 'Guidelines for provisional registration',
    publisher: 'Malaysian Medical Council',
    url: 'https://mmc.gov.my/wp-content/uploads/2026/02/GUIDELINES-AND-PROCEDURES-FOR-APPLICATION-OF-PROVISIONAL-REGISTRATION.pdf',
  },
  mmcHouseOfficers: {
    title: 'A Guidebook for House Officers',
    publisher: 'Malaysian Medical Council',
    url: 'https://mmc.gov.my/wp-content/uploads/2025/09/A-Guidebook-for-House-Officers.pdf',
  },
  bemRegister: {
    title: 'Registration: Graduate Engineer and Professional Engineer',
    publisher: 'Board of Engineers Malaysia',
    url: 'https://bem.org.my/Landing/register',
  },
  pharmacyBoard: {
    title: 'Pharmacy Board of Malaysia',
    publisher: 'Pharmaceutical Services Programme, Ministry of Health',
    url: 'https://pharmacy.moh.gov.my/en/bahagian/lembaga-farmasi-malaysia',
  },
  pharmacyPrp: {
    title: 'Registration of Pharmacists Act 1951 (provisional registration)',
    publisher: 'Pharmacy Board of Malaysia',
    url: 'https://pharmacy.moh.gov.my/sites/default/files/document-upload/registration-pharmacists-act-1951-act-371_2.pdf',
  },
  lamHandbook: {
    title: 'Handbook for LAM Part I and Part II',
    publisher: 'Lembaga Arkitek Malaysia',
    url: 'https://lam.gov.my/sites/default/files/2025-01/LAMHandbookPartIandII_0.pdf',
  },
  lamRegistration: {
    title: 'Registration as an Architect',
    publisher: 'Lembaga Arkitek Malaysia',
    url: 'https://www.lam.gov.my/node/133',
  },
  nursingBoard: {
    title: 'Nursing Board: examination and registration FAQ',
    publisher: 'Nursing Division, Ministry of Health',
    url: 'https://hq.moh.gov.my/nursing/en/faq/',
  },
  miaCharteredAccountant: {
    title: 'Become a Chartered Accountant (Malaysia)',
    publisher: 'Malaysian Institute of Accountants',
    url: 'https://mia.org.my/?p=5772',
  },
  ukmDpp: {
    title: 'Diploma Pascasiswazah Pendidikan (formerly DPLI): FAQ',
    publisher: 'Universiti Kebangsaan Malaysia',
    url: 'https://www.ukm.my/studyukm/wp-content/uploads/2026/06/Soalan-Lazim-DPP-250626.pdf',
  },
  mahpcDeadline: {
    title: 'Allied health professionals must register with MAHPC',
    publisher: 'The Star (report on MAHPC registration)',
    url: 'https://www.thestar.com.my/news/nation/2025/06/23/allied-health-professionals-must-register-by-dec-31-next-year',
  },
  mahpcInfo: {
    title: 'MAHPC information',
    publisher: 'Malaysian Allied Health Professions Council, Ministry of Health',
    url: 'https://hq.moh.gov.my/alliedhealth/index.php/ms/site-mahpc/info-mahpc',
  },
  barPupillage: {
    title: 'Become a Member: Pupillage',
    publisher: 'Malaysian Bar',
    url: 'https://www.malaysianbar.org.my/list/members/become-a-member/pupillage',
  },
  barAdmission: {
    title: 'Become a Member: Admission',
    publisher: 'Malaysian Bar',
    url: 'https://www.malaysianbar.org.my/list/members/become-a-member/admission',
  },
});

/**
 * Pre-university stages shared by every career. `years` is [min, max], typical
 * full time. `apply` says where students usually apply.
 */
export const PRE_UNIVERSITY = Object.freeze({
  foundation: {
    label: 'Foundation / Asasi',
    years: [1, 1],
    duration: 'About 1 year',
    apply: 'UPU for public university Asasi; private foundations apply to the institution',
    note: 'Usually leads into degrees at the same university. Check that other institutions accept the award before relying on it.',
    sources: ['govFoundation'],
  },
  matriculation: {
    label: 'Matriculation (KPM)',
    years: [1, 2],
    duration: '1 or 2 years',
    apply: 'KPM matriculation application (separate from UPU)',
    note: 'A Ministry of Education programme for SPM leavers aiming for a bachelor’s degree. Places are limited and streams include science and accounting; check eligibility on the official KPM page.',
    sources: ['govMatric'],
  },
  stpm: {
    label: 'Form Six (STPM)',
    years: [1.5, 1.5],
    duration: '1.5 years (3 semesters)',
    apply: 'Form Six placement after SPM; STPM is examined by the Malaysian Examinations Council',
    note: 'Widely accepted for degree entry at public and private universities. Choose subjects that match the degree you are aiming for.',
    sources: ['govFormSix'],
  },
  diploma: {
    label: 'Diploma',
    years: [2.5, 3],
    duration: 'Typically 2.5–3 years (varies by programme)',
    apply: 'UPU for public institutions; private institutions directly',
    note: 'Can lead straight to work or on to a degree. Universities may grant credit transfer that shortens the degree; how much is decided by each institution.',
    sources: ['govDiploma', 'ecctisMalaysia', 'mmuCreditTransfer'],
  },
});

const COMPUTING_ROUTES = {
  foundation: { status: 'common', label: 'Foundation in Science, Computing or IT' },
  matriculation: { status: 'common', label: 'Matriculation (science stream)' },
  stpm: { status: 'common', label: 'STPM (science or mathematics subjects)' },
  diploma: { status: 'common', label: 'Diploma in Computer Science or IT' },
};

/**
 * Per-career route profiles, keyed by career slug.
 * - `routes`: which pre-university stages apply, with a career-specific label.
 * - `degree`: the bachelor's stage.
 * - `afterDegree`: professional steps between graduating and the career.
 * - `workAfterDiploma`: a realistic exit to work after a diploma, if any.
 */
export const CAREER_ROUTES = Object.freeze({
  'software-engineer': {
    routes: COMPUTING_ROUTES,
    degree: {
      label: 'Degree in Computer Science or Software Engineering',
      years: [3, 4],
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Junior developer or IT support roles are possible with a diploma; many software engineer roles ask for a degree.',
    },
  },
  'data-analyst': {
    routes: COMPUTING_ROUTES,
    degree: {
      label: 'Degree in Data Science, Statistics, Computer Science or Business Analytics',
      years: [3, 4],
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Data or reporting assistant roles are possible with a diploma; analyst roles usually ask for a degree.',
    },
  },
  'data-scientist': {
    routes: COMPUTING_ROUTES,
    degree: {
      label: 'Degree in Data Science, Computer Science, Statistics or Mathematics',
      years: [3, 4],
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [
      {
        label: 'Build experience (postgraduate study optional)',
        note: 'Many data scientist roles expect analytics experience or a master’s degree on top of the bachelor’s.',
        sources: [],
      },
    ],
    workAfterDiploma: null,
  },
  'cybersecurity-analyst': {
    routes: COMPUTING_ROUTES,
    degree: {
      label: 'Degree in Cybersecurity, Computer Science or Information Security',
      years: [3, 4],
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [
      {
        label: 'Industry certifications (optional)',
        note: 'Security certifications are commonly added alongside work experience; they are not a legal requirement.',
        sources: [],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'IT support or network technician roles are possible with a diploma; analyst roles usually ask for a degree.',
    },
  },
  'civil-engineer': {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Engineering or Science' },
      matriculation: { status: 'common', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM (science: Mathematics and Physics)' },
      diploma: { status: 'common', label: 'Diploma in Civil Engineering' },
    },
    degree: {
      label: 'Bachelor of Civil Engineering (EAC-accredited)',
      years: [4, 4],
      note: 'Choose a programme accredited by the Engineering Accreditation Council so you can register with BEM.',
      sources: ['bemRegister'],
    },
    afterDegree: [
      {
        label: 'Register as a Graduate Engineer (BEM)',
        note: 'Registration with the Board of Engineers Malaysia after an accredited engineering degree.',
        sources: ['bemRegister'],
      },
      {
        label: 'Professional Engineer (Ir.)',
        duration: 'At least 3 years as a Graduate Engineer',
        note: 'After the required practical experience and BEM’s professional assessment.',
        sources: ['bemRegister'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Technician or assistant engineer roles; registering as an engineer needs an accredited degree.',
    },
  },
  architect: {
    routes: {
      foundation: {
        status: 'common',
        label: 'Foundation in Art & Design, Architecture or Science',
      },
      matriculation: { status: 'possible', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM' },
      diploma: { status: 'common', label: 'Diploma in Architecture' },
    },
    degree: {
      label: 'LAM-recognised degree in Architecture (Part I)',
      years: [3, 3],
      note: 'A LAM-recognised bachelor’s exempts you from the LAM Part I examination. Many programmes ask for a portfolio.',
      sources: ['lamHandbook'],
    },
    afterDegree: [
      {
        label: 'Practical experience, then Master of Architecture (Part II)',
        duration: 'Master’s: about 2 years',
        note: 'A LAM-recognised Part II qualification lets you register as a Graduate Architect.',
        sources: ['lamHandbook'],
      },
      {
        label: 'LAM Part III and registration as an Architect',
        note: 'Pass Part III after the practical experience LAM requires (check the current handbook for the minimum).',
        sources: ['lamRegistration'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Architectural assistant or drafting roles; the title “Architect” needs LAM registration.',
    },
  },
  'graphic-designer': {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Art & Design' },
      matriculation: {
        status: 'check',
        label: 'Matriculation',
        note: 'Matriculation streams focus on science and accounting; check that the design degree accepts your stream.',
      },
      stpm: { status: 'possible', label: 'STPM (include Visual Arts if available)' },
      diploma: { status: 'common', label: 'Diploma in Graphic Design' },
    },
    degree: {
      label: 'Degree in Graphic or Communication Design',
      years: [3, 3],
      note: 'Most programmes assess a portfolio.',
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Common in design: many designers start work with a diploma and a strong portfolio.',
    },
  },
  'multimedia-designer': {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Art & Design or IT' },
      matriculation: {
        status: 'check',
        label: 'Matriculation',
        note: 'Matriculation streams focus on science and accounting; check that the multimedia degree accepts your stream.',
      },
      stpm: { status: 'possible', label: 'STPM' },
      diploma: { status: 'common', label: 'Diploma in Multimedia or Creative Media' },
    },
    degree: {
      label: 'Degree in Multimedia, Animation or Creative Media',
      years: [3, 3],
      note: 'Most programmes assess a portfolio.',
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Common in multimedia: many start work with a diploma and a strong portfolio.',
    },
  },
  'secondary-school-teacher': {
    routes: {
      foundation: { status: 'common', label: 'Foundation (Asasi) matching your teaching subject' },
      matriculation: { status: 'common', label: 'Matriculation' },
      stpm: { status: 'common', label: 'STPM' },
      diploma: { status: 'possible', label: 'Diploma in your intended teaching subject' },
    },
    degree: {
      label: 'Bachelor of Education (or a degree in your teaching subject)',
      years: [4, 4],
      note: 'With a non-education degree, add the postgraduate teaching diploma below.',
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [
      {
        label: 'Diploma Pascasiswazah Pendidikan (if your degree is not in education)',
        duration: 'About 1 year',
        note: 'Formerly called DPLI. Needs a recognised bachelor’s degree; check minimum CGPA with the university.',
        sources: ['ukmDpp'],
      },
      {
        label: 'Apply to teach in government schools (SPP)',
        note: 'Government school posts are applied for through the Education Service Commission (SPP).',
        sources: [],
      },
    ],
    workAfterDiploma: null,
  },
  accountant: {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Business or Accounting' },
      matriculation: { status: 'common', label: 'Matriculation (accounting stream)' },
      stpm: { status: 'common', label: 'STPM (Accounting and Mathematics subjects)' },
      diploma: { status: 'common', label: 'Diploma in Accounting' },
    },
    degree: {
      label: 'MIA-accredited accounting degree',
      years: [3, 4],
      note: 'Choose a degree accredited by MIA for Chartered Accountant admission. Professional qualifications (for example ACCA) are an alternative route.',
      sources: ['miaCharteredAccountant'],
    },
    afterDegree: [
      {
        label: 'Chartered Accountant, C.A.(M), with MIA',
        duration: 'At least 3 years of relevant experience',
        note: 'MIA’s practical experience programme (CARE) under a Chartered Accountant’s supervision.',
        sources: ['miaCharteredAccountant'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Accounts assistant or clerk roles; the Chartered Accountant title needs MIA admission.',
    },
  },
  'medical-doctor': {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Science or Medicine' },
      matriculation: { status: 'common', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM (Biology, Chemistry, Physics or Mathematics)' },
      diploma: {
        status: 'check',
        label: 'Diploma in a health science',
        note: 'Some medical schools list diploma entry, with strict grade and subject requirements. Check the specific medical school before choosing this route.',
      },
    },
    degree: {
      label: 'Medical degree (MBBS or MD) recognised by MMC',
      years: [5, 5],
      note: 'Entry is highly competitive and must meet MMC’s minimum entry qualifications.',
      sources: ['mmcEntry', 'umMbbs'],
    },
    afterDegree: [
      {
        label: 'Provisional registration and housemanship',
        note: 'Supervised training as a house officer under provisional registration with MMC. Check MMC for the current duration and postings.',
        sources: ['mmcProvisional', 'mmcHouseOfficers'],
      },
      {
        label: 'Full registration with MMC',
        note: 'Granted after housemanship is completed satisfactorily.',
        sources: ['mmcProvisional'],
      },
    ],
    workAfterDiploma: null,
  },
  pharmacist: {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Science' },
      matriculation: { status: 'common', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM (Chemistry and Biology)' },
      diploma: {
        status: 'possible',
        label: 'Diploma in Pharmacy',
        note: 'Check that the pharmacy degree accepts your diploma and grades.',
      },
    },
    degree: {
      label: 'Bachelor of Pharmacy recognised by the Pharmacy Board',
      years: [4, 4],
      sources: ['pharmacyBoard'],
    },
    afterDegree: [
      {
        label: 'Provisionally Registered Pharmacist (PRP) training',
        duration: 'At least 1 year',
        note: 'Supervised employment at approved premises before full registration.',
        sources: ['pharmacyPrp'],
      },
      {
        label: 'Full registration with the Pharmacy Board',
        note: 'Includes the Board’s registration requirements, such as its examination.',
        sources: ['pharmacyBoard'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Pharmacy assistant roles; practising as a pharmacist needs the degree and registration.',
    },
  },
  nurse: {
    routes: {
      foundation: { status: 'possible', label: 'Foundation in Science (towards a nursing degree)' },
      matriculation: { status: 'possible', label: 'Matriculation (science stream)' },
      stpm: { status: 'possible', label: 'STPM (science subjects)' },
      diploma: {
        status: 'common',
        label: 'Diploma in Nursing',
        note: 'The most common route. About 3 years, followed by the Nursing Board examination.',
      },
    },
    degree: {
      label: 'Bachelor of Nursing',
      years: [4, 4],
      note: 'Optional after a diploma, or a direct route after pre-university.',
      sources: ['nursingBoard'],
    },
    afterDegree: [
      {
        label: 'Nursing Board examination and registration',
        note: 'Pass the Malaysian Nursing Board examination, register, then hold an Annual Practising Certificate.',
        sources: ['nursingBoard'],
      },
    ],
    workAfterDiploma: {
      label: 'Register and work as a nurse',
      note: 'After the Diploma in Nursing and the Nursing Board examination, you can register and work as a nurse.',
      sources: ['nursingBoard'],
    },
  },
  'biomedical-scientist': {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Science' },
      matriculation: { status: 'common', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM (Biology and Chemistry)' },
      diploma: {
        status: 'possible',
        label: 'Diploma in Medical Laboratory Technology or a related science',
      },
    },
    degree: {
      label: 'Degree in Biomedical Science',
      years: [3, 4],
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [
      {
        label: 'Register with MAHPC where required',
        note: 'Allied health practitioners must register with the Malaysian Allied Health Professions Council; check which category covers your role.',
        sources: ['mahpcDeadline'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Laboratory technician roles; check MAHPC registration for your category.',
    },
  },
  'mechanical-engineer': {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Engineering or Science' },
      matriculation: { status: 'common', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM (science: Mathematics and Physics)' },
      diploma: { status: 'common', label: 'Diploma in Mechanical Engineering' },
    },
    degree: {
      label: 'Bachelor of Mechanical Engineering (EAC-accredited)',
      years: [4, 4],
      note: 'Choose a programme accredited by the Engineering Accreditation Council so you can register with BEM.',
      sources: ['bemRegister'],
    },
    afterDegree: [
      {
        label: 'Register as a Graduate Engineer (BEM)',
        note: 'Registration with the Board of Engineers Malaysia after an accredited engineering degree.',
        sources: ['bemRegister'],
      },
      {
        label: 'Professional Engineer (Ir.)',
        duration: 'At least 3 years as a Graduate Engineer',
        note: 'After the required practical experience and BEM’s professional assessment.',
        sources: ['bemRegister'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Technician or assistant engineer roles; registering as an engineer needs an accredited degree.',
    },
  },
  'electrical-engineer': {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Engineering or Science' },
      matriculation: { status: 'common', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM (science: Mathematics and Physics)' },
      diploma: { status: 'common', label: 'Diploma in Electrical or Electronic Engineering' },
    },
    degree: {
      label: 'Bachelor of Electrical Engineering (EAC-accredited)',
      years: [4, 4],
      note: 'Choose a programme accredited by the Engineering Accreditation Council so you can register with BEM.',
      sources: ['bemRegister'],
    },
    afterDegree: [
      {
        label: 'Register as a Graduate Engineer (BEM)',
        note: 'Registration with the Board of Engineers Malaysia after an accredited engineering degree.',
        sources: ['bemRegister'],
      },
      {
        label: 'Professional Engineer (Ir.)',
        duration: 'At least 3 years as a Graduate Engineer',
        note: 'After the required practical experience and BEM’s professional assessment.',
        sources: ['bemRegister'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Electrical technician or assistant engineer roles; registering as an engineer needs an accredited degree.',
    },
  },
  lawyer: {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Law or Arts' },
      matriculation: {
        status: 'possible',
        label: 'Matriculation',
        note: 'Check that the law faculty accepts your matriculation stream.',
      },
      stpm: { status: 'common', label: 'STPM (arts or social science subjects)' },
      diploma: {
        status: 'possible',
        label: 'Diploma in Law',
        note: 'Check how much credit the law degree grants for your diploma.',
      },
    },
    degree: {
      label: 'Bachelor of Laws (LLB)',
      years: [3, 4],
      note: 'Choose a law degree accepted for admission to the Malaysian Bar; some qualifications also need the CLP examination.',
      sources: ['ecctisMalaysia', 'barAdmission'],
    },
    afterDegree: [
      {
        label: 'Pupillage in chambers',
        note: 'Supervised training under a practising lawyer. Confirm the current pupillage period with the Malaysian Bar.',
        sources: ['barPupillage'],
      },
      {
        label: 'Admission as an Advocate and Solicitor',
        note: 'Called to the Bar by the High Court after pupillage.',
        sources: ['barAdmission'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Legal assistant or paralegal roles; practising as a lawyer needs a law degree and admission to the Bar.',
    },
  },
  psychologist: {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Arts or Science' },
      matriculation: { status: 'common', label: 'Matriculation' },
      stpm: { status: 'common', label: 'STPM' },
      diploma: { status: 'possible', label: 'Diploma in Psychology or a related field' },
    },
    degree: {
      label: 'Degree in Psychology',
      years: [3, 4],
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [
      {
        label: 'Postgraduate training for clinical or counselling roles',
        duration: 'Master’s: about 2 years',
        note: 'Clinical and counselling practice usually needs a recognised master’s on top of the bachelor’s.',
        sources: [],
      },
      {
        label: 'Register for your role where required',
        note: 'Clinical psychologists register with MAHPC; counselling roles have their own board. Check which applies to you.',
        sources: ['mahpcDeadline', 'mahpcInfo'],
      },
    ],
    workAfterDiploma: null,
  },
  chef: {
    routes: {
      foundation: {
        status: 'possible',
        label: 'Foundation (then a culinary or hospitality degree)',
      },
      matriculation: {
        status: 'check',
        label: 'Matriculation',
        note: 'Rarely used for culinary studies; check that the programme accepts it.',
      },
      stpm: { status: 'possible', label: 'STPM (then a culinary or hospitality degree)' },
      diploma: {
        status: 'common',
        label: 'Diploma in Culinary Arts',
        note: 'The most common route into professional kitchens.',
      },
    },
    degree: {
      label: 'Degree in Culinary Arts or Hospitality (optional)',
      years: [3, 3],
      note: 'Useful for senior and management roles; many chefs start work straight after the diploma.',
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Commis chef and other kitchen roles, building up to chef de partie, sous chef and head chef with experience.',
    },
  },
  physiotherapist: {
    routes: {
      foundation: { status: 'common', label: 'Foundation in Science' },
      matriculation: { status: 'common', label: 'Matriculation (science stream)' },
      stpm: { status: 'common', label: 'STPM (Biology and Chemistry or Physics)' },
      diploma: {
        status: 'common',
        label: 'Diploma in Physiotherapy',
        note: 'A common route; diploma holders can work as physiotherapists once registered.',
      },
    },
    degree: {
      label: 'Bachelor of Physiotherapy',
      years: [4, 4],
      note: 'Optional after a diploma, or a direct route after pre-university.',
      sources: ['ecctisMalaysia'],
    },
    afterDegree: [
      {
        label: 'Register with MAHPC',
        note: 'Physiotherapists must register with the Malaysian Allied Health Professions Council before practising.',
        sources: ['mahpcDeadline', 'mahpcInfo'],
      },
    ],
    workAfterDiploma: {
      label: 'Work after the diploma',
      note: 'Physiotherapist roles after registering with MAHPC; a degree helps for senior roles.',
    },
  },
});

export const STATUS_LABELS = Object.freeze({
  common: 'Common route',
  possible: 'Possible route',
  check: 'Check carefully',
});
