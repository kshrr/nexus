# NEXUS — FYP REQUIREMENTS ANALYSIS

**Source document:** *Nexus: Intelligent Educational and Career Advisory System* — Kauthar binti Mohd Suhair (1230516), USIM, BSc Computer Science (Information Security and Assurance), June 2026.

**Basis of this analysis:** Chapters 1–5 in full, including Table 2.1, Tables 3.1–3.5, Table 4.1, the use case detail tables in 4.2.2–4.2.3, the UI mockups (Figures 4.2–4.10) and the ERD (Figure 4.11).

**Revision 2 — security-hardened.** This version adds a security engineering layer appropriate to an Information Security and Assurance degree: fourteen new security functional requirements (§3.12), three new non-functional requirements (§4.3), a STRIDE threat model, a risk register, an assurance evidence plan and a PDPA 2010 mapping (§13.3–13.7). Content added in this revision is marked **[ADDED — NOT IN REPORT]** and must be written back into the thesis before it can be claimed. §19 lists exactly where.

**A note on source fidelity.** The ERD (Figure 4.11), the use case diagram (Figure 4.1) and several use case tables are images. Text recovered from them is partially garbled, and several use case tables have lost their headers. Where I have relied on a recovered image, I mark it `[FROM FIGURE — VERIFY]`. Everything in Section 12 that derives from the ERD carries this caveat. You should visually re-check Figure 4.11 against my reading before any schema work begins.

---

# 1. SYSTEM PURPOSE

## 1.1 Problem statement

The report identifies four distinct problems (§1.2):

1. **Fragmentation.** Information on courses, fees, admission requirements and scholarships is dispersed across many websites, forcing manual gathering and comparison. Presentation is unstructured.
2. **Absence of personalisation.** Existing platforms give general information without regard to interest, personality, academic strengths or career goals. Students therefore choose by trend or peer influence rather than compatibility.
3. **Scholarship complexity.** Each scholarship has its own eligibility criteria, academic requirements and qualification stages (the report gives IQ tests and essay rounds as examples). Presented unstructured, these are hard to interpret, so students overlook suitable scholarships.
4. **Non-SPM pathways underserved.** Diploma, STPM, STAM, matriculation and foundation students face the same uncertainty, and existing solutions do not address them.

The gap analysis (§2.5.2) adds a fourth software-relevant gap: **cross-feature isolation** — activity in one section of an existing platform has no influence on what a student sees in another.

## 1.2 Proposed solution

A web-based Intelligent Decision Support System that unifies career profiling, academic performance analysis, course/career recommendation and scholarship discovery, with an AI chatbot as a cross-cutting assistant.

The report frames it as **two entry paths** (§1.1):

- **Undecided students** → RIASEC assessment + academic analysis → recommended careers, courses, scholarships.
- **Decided students** → Career Pathways → roadmap, programmes, universities, scholarships for a named profession.

## 1.3 Target users

**Primary — students.** SPM, STPM, STAM, matriculation, diploma and foundation leavers (§1.5.1, §4.1.1). Assumed non-technical, varying digital literacy.

**Secondary — administrators.** Manage and maintain system data; interact with backend management functions rather than advisory features (§4.1.1).

> **Scope tension.** Research Objective 1 and Research Question 1 both restrict the problem to students "after completing their SPM examinations", while §1.5.1 and §4.1.1 name six education levels. See Conflict C-01.

## 1.4 System objectives

From §4.1.2 and RO2:

- Centralised platform delivering genuinely personalised guidance, not information display.
- Integrate psychometric profiling + academic performance analysis + rule-based recommendation.
- Improve accessibility of guidance for students without access to counsellors, informed family or support networks.

## 1.5 System scope (§4.1.3)

Career profiling via RIASEC; academic trend analysis for post-secondary school students across up to three examination periods; personalised course and career field recommendations from RIASEC + academic data; scholarship browsing and eligibility matching; conversational assistance; automated data acquisition; basic administrative data management and monitoring.

## 1.6 System boundaries — explicitly out of scope

| Boundary | Source |
| --- | --- |
| Does not process or submit applications; links out to external portals only | §4.1.3 |
| Not an admission portal; no placement or scholarship-award guarantees | §1.5.5 |
| No machine learning or adaptive algorithms; fixed rule configuration only | §4.1.3 |
| Academic trend analysis excluded for pre-university programmes (grading not standardised) | §4.1.3 |
| Chatbot supports English and Bahasa Malaysia only; no Mandarin or Tamil | §4.1.3 |
| Does not replace professional counselling | §4.1.3 |
| Malaysian higher education only; MQA-accredited programmes | §1.5.1 |
| Recommendations support self-discovery, not definitive conclusions | §1.5.5 |

## 1.7 MUST / SHOULD / OUT

**MUST do** (carries an FR ID in Table 3.1, or is required for an FR to function):
registration with email verification; JWT login; multi-step profile setup and later editing; 36-item RIASEC assessment with scoring, Holland Code and radar chart; academic analysis with Strong/Average/Weak classification; knowledge-based career recommendation; knowledge-based course recommendation; scholarship search and filtering; rule-based scholarship matching with eligibility checklist; Career Pathways; AI chatbot; user dashboard; admin panel with scraper log view and manual trigger; scheduled web scraper.

**SHOULD do** (described in narrative or sprint plans, no FR ID):
saved items/bookmarking; application status tracking; course comparison tool; deadline colour flags; suggested chatbot prompts; token-streaming chatbot responses; recent-activity feed; profile completion indicator; academic performance line charts.

**Outside scope:** everything in the boundaries table above.

## 1.8 Expected outcomes

A functional, deployed web platform demonstrating the five feature areas; validated by unit, integration and functional testing plus a UAT session with a student group (§5.2).

---

# 2. ACTORS

The use case diagram (Figure 4.1) did not survive text extraction. Actors below are derived from §4.1.1, Table 3.1 and the security design in §3.3.2C.

## 2.1 Guest / Unauthenticated Visitor `INFERRED`

Not named as an actor in the report, but necessary: the landing page, register and login pages are public routes (§3.4.1 Sprint 1), and §3.3.2C grants read-only public access to shared tables.

- **Responsibilities:** none.
- **Permissions:** view landing page; register; log in; request password reset `INFERRED`.
- **Accessible modules:** public marketing pages only.
- **Restrictions:** no personal data; all dashboard, assessment and recommendation routes redirect to login (§3.3.3D). Whether an unauthenticated visitor may browse the scholarship list is **NOT SPECIFIED** — see Conflict C-09.

## 2.2 Unverified Student `INFERRED` (implied by §3.3.2C)

- **Role:** account created but email not yet confirmed.
- **Permissions:** enter verification code; request a new code.
- **Restrictions:** explicitly *not issued a usable session* until email is confirmed (§3.3.2C). Cannot reach profile setup or any student feature.

## 2.3 Student (primary actor)

- **Role:** the advisory consumer.
- **Responsibilities:** complete profile; take RIASEC assessment; enter academic results; review recommendations; explore scholarships and pathways.
- **Permissions:** full CRUD on own profile, own academic results, own RIASEC results, own saved items and own chat messages. Read-only on shared reference data (courses, universities, scholarships).
- **Accessible modules:** User Management, Find Your Path (RIASEC + Academic Analysis + Career/Course Recommendation), Scholarship Discovery, Career Pathways, AI Chatbot, Dashboard.
- **Restrictions:** RLS confines every read and write to their own authenticated identity (§3.3.2C). No write access to shared tables. No admin panel access. Academic Analysis is gated on being a post-secondary-school student (FR06).

## 2.4 Administrator (secondary actor)

- **Role:** data steward and system monitor.
- **Responsibilities (§4.1.1):** monitor system activities; manage scholarship and educational data; review scraper logs; trigger data refreshes; ensure information accuracy and currency.
- **Permissions:** write access to shared tables — courses, universities, scholarships (§3.3.2C); manual entry and correction of records (FR14); view crawl logs; trigger the scraper manually.
- **Accessible modules:** Admin panel only. "Unlike students, administrators interact primarily with the backend management functions of the platform rather than the advisory features" (§4.1.1).
- **Restrictions:** The report never grants admins access to individual student records, RIASEC results or chat logs. **Absence of a stated permission is not a denial** — but given this is an Information Security FYP, the safe reading is that admin access to student PII is *not* required and should not be built. See Missing Information M-14.

## 2.5 Non-actors

**The web scraper** is a scheduled Edge Function, not an actor with a login. **Gemini** is an external service invoked server-side. Neither authenticates as a user.

---

# 3. FUNCTIONAL REQUIREMENTS

The report's own Table 3.1 contains fifteen requirements (FR01–FR15). Below I decompose them into implementable units and cross-reference each to its source. Items marked `INFERRED` appear in mockups, narrative or the ERD but have no requirement statement.

## 3.1 Authentication & Account (FR01, FR02)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-AUTH-01 | Auth | Create account with email address and password | Guest | Email, password (+ full name per UC basic path step 4) | Validate format; check email not already registered; create Supabase Auth user in unverified state | Unverified account; verification screen | MUST |
| FR-AUTH-02 | Auth | Send a 6-digit verification code to the registered email | System | New account email | Supabase Auth email OTP mechanism (§3.3.2C) | Email delivered | MUST |
| FR-AUTH-03 | Auth | Validate the entered code, mark account verified, redirect to profile setup | Unverified Student | 6-digit code | Compare against issued code; check expiry; invalidate on use | Verified account; redirect | MUST |
| FR-AUTH-04 | Auth | Expire codes after exactly 10 minutes and invalidate immediately on consumption | System | Code, timestamp | Fixed expiry window; single-use enforcement | Reuse and delayed guessing prevented | MUST |
| FR-AUTH-05 | Auth | Withhold a usable session until email is confirmed | System | Account state | Session issuance gated on verified flag | No session for unverified accounts | MUST |
| FR-AUTH-06 | Auth | Authenticate registered users and maintain a JWT-based session | Student | Email, password | Supabase Auth; bcrypt comparison | JWT session in memory or HTTP-only cookie | MUST |
| FR-AUTH-07 | Auth | Log out and terminate session | Student | Logout action | Clear session | Redirect to public area | MUST |
| FR-AUTH-08 | Auth | Redirect unauthenticated access to protected routes to the login page | System | Route request, session state | React Router protected-route guard | Redirect | MUST |
| FR-AUTH-09 | Auth | Display specific errors: duplicate email, password requirements (inline), network failure retry, expired code with re-request | System | Failure condition | Branch on error type | Message per UC exception path | MUST |
| FR-AUTH-10 | Auth | Redirect an already-logged-in user hitting registration to the dashboard | System | Session state | Route guard | Redirect | SHOULD |
| FR-AUTH-11 | Auth | Password reset — `INFERRED` | Student | Email | Not described | Not described | SHOULD |

> FR-AUTH-11 appears only as a "Forgot Password?" link in the Figure 4.3 mockup. No FR, no use case, no flow. Treat as a gap (M-01).

## 3.2 Profile (FR03, FR04)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-PROF-01 | Profile | Present a multi-step profile form covering four stages: personal information, education level, academic grades across up to three examination periods, career goals | Student | Form fields | Sequential wizard | Completed profile | MUST |
| FR-PROF-02 | Profile | Validate each step before allowing progression | Student | Step input | Per-step validation | Block or advance | MUST |
| FR-PROF-03 | Profile | Persist to the profiles and academic results tables | System | Validated data | Two-table write | Stored profile | MUST |
| FR-PROF-04 | Profile | Allow update of profile, academic results and career goals at any time after setup | Student | Edits | Update + trigger recalculation | Updated profile | MUST |
| FR-PROF-05 | Profile | Make the profile available application-wide without repeated fetches | System | Stored profile | React Context shared state | Cached profile | SHOULD |
| FR-PROF-06 | Profile | Capture education level as a selectable value | Student | Selection | Store | education_level | MUST |
| FR-PROF-07 | Profile | Capture primary career interest / target industry | Student | Selection | Store | career_goal | MUST |

> The Figure 4.3 mockup labels the wizard "STEP 1 OF 2" while §3.4.1 Sprint 2 describes four stages. See Conflict C-06. The mockup offers education levels *SPM / Foundation / University*, which does not match the six levels in §1.5.1. See Conflict C-02.

## 3.3 RIASEC Assessment (FR05)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-RIASEC-01 | Find Your Path | Present 36 interest inventory items, six per dimension | Student | — | Load question bank | Assessment form | MUST |
| FR-RIASEC-02 | Find Your Path | Capture one response per item on a like/dislike scale | Student | Per-item selection | Store response | Response set | MUST |
| FR-RIASEC-03 | Find Your Path | Prevent submission while items remain unanswered; highlight the unanswered items | Student | Submit action | Completeness check | Block + highlight | MUST |
| FR-RIASEC-04 | Find Your Path | Calculate a score for each of the six dimensions | System | 36 responses | Scoring function | Six dimension scores | MUST |
| FR-RIASEC-05 | Find Your Path | Identify the three highest-scoring dimensions and form a three-letter Holland Code | System | Six scores | Rank, take top 3 | Holland Code (e.g. ICR, EAS) | MUST |
| FR-RIASEC-06 | Find Your Path | Save dimension scores and Holland Code to the database | System | Scores, code | Insert/update | Persisted result | MUST |
| FR-RIASEC-07 | Find Your Path | Display a radar chart of all six dimension scores | Student | Stored scores | Recharts radar | Chart | MUST |
| FR-RIASEC-08 | Find Your Path | Display written descriptions of dominant personality types, suitable career fields and suitable academic areas | Student | Holland Code | Lookup interpretation text | Narrative block | MUST |
| FR-RIASEC-09 | Find Your Path | On retake, overwrite previous results | Student | New responses | Update in place | Replaced result | MUST |
| FR-RIASEC-10 | Find Your Path | Store the question bank in a server-side configuration file, updatable without code changes | Admin/Dev | Config file | Server-side load | Protected question bank | MUST |
| FR-RIASEC-11 | Find Your Path | Display retry prompt on save failure | System | Network error | Error branch | Retry prompt | MUST |
| FR-RIASEC-12 | Find Your Path | Show progress ("Question N of 36", % complete) and a Previous control — `INFERRED` (Figure 4.6) | Student | Position | Counter | Progress bar | SHOULD |
| FR-RIASEC-13 | Find Your Path | Skip Question control — `INFERRED` (Figure 4.6) | Student | Skip action | — | — | **CONFLICTED — see C-04** |

## 3.4 Academic Analysis (FR06)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-ACAD-01 | Find Your Path | Restrict the feature to post-secondary school students | System | education_level | Eligibility gate | Feature shown or hidden | MUST |
| FR-ACAD-02 | Find Your Path | Accept subject grades across multiple examination periods | Student | Subject + exam type + grade | Store rows | Academic result set | MUST |
| FR-ACAD-03 | Find Your Path | Classify each subject as Strong, Average or Weak | System | Grades per subject | Classification rule | Subject strength profile | MUST |
| FR-ACAD-04 | Find Your Path | Display a card grid, one card per subject, showing strength label, average grade and number of examinations counted | Student | Strength profile | Render | Card grid | MUST |
| FR-ACAD-05 | Find Your Path | Display a written summary of top academic fields and weaker areas relevant to course choice | Student | Strength profile | Summarise | Narrative block | MUST |
| FR-ACAD-06 | Find Your Path | Visualise performance across examinations with interactive charts | Student | Grade history | Recharts line chart | Trend chart | SHOULD |
| FR-ACAD-07 | Find Your Path | Save the subject strength profile to the database | System | Classification output | Persist | Stored profile | MUST |
| FR-ACAD-08 | Find Your Path | Feed the subject strength profile into the recommendation engine | System | Strength profile | Pass to engine | Engine input | MUST |
| FR-ACAD-09 | Find Your Path | Export profile — `INFERRED` (Figure 4.7 "Export Profile") | Student | — | Not described | Not described | SHOULD NOT (see §18) |

## 3.5 Recommendation Engine (FR07, FR08)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-REC-01 | Recommendation | Trigger recommendation generation from a "View Path Recommendation" control | Student | Click | Invoke engine | Results page | MUST |
| FR-REC-02 | Recommendation | Retrieve the user's Holland Code, subject strength profile and career goals | System | user_id | Three reads | Engine input set | MUST |
| FR-REC-03 | Recommendation | Evaluate every rule in the JSON rule base against the user's data | System | Rules + user data | Rule evaluation loop | Per-rule condition results | MUST |
| FR-REC-04 | Recommendation | Calculate a match score per rule based on how many conditions are satisfied | System | Condition results | Count satisfied / total | Match score | MUST |
| FR-REC-05 | Recommendation | Return a ranked list of recommended career fields | System | Scored rules | Sort descending | Ranked careers | MUST |
| FR-REC-06 | Recommendation | Return a ranked list of recommended courses | System | Scored rules | Sort descending | Ranked courses | MUST |
| FR-REC-07 | Recommendation | Display each recommendation as a card showing course name, university, pathway type, entry requirements and a transparent list of reasons it was suggested | Student | Ranked results | Render | Recommendation cards | MUST |
| FR-REC-08 | Recommendation | Recalculate when the student updates academic results or retakes the RIASEC assessment | System | Change event | Re-run engine | Refreshed recommendations | MUST |
| FR-REC-09 | Recommendation | When no rules match, display a message encouraging the user to complete or update their RIASEC assessment and academic results | System | Empty result set | Empty-state branch | Guidance message | MUST |
| FR-REC-10 | Recommendation | Store the rule base in a server-side JSON configuration file, updatable without modifying application code | Admin/Dev | Config file | Server-side load | Protected rule base | MUST |
| FR-REC-11 | Recommendation | Persist recommendation records | System | Results | Insert | Saved recommendations | MUST |
| FR-REC-12 | Recommendation | Hold a predefined RIASEC profile for each career pathway in the system and compare the student's results against it | System | Career profiles + student scores | Comparison | Compatible careers | MUST |
| FR-REC-13 | Recommendation | Display a match percentage per career field — `INFERRED` (Figure 4.10 shows "92% Match") | Student | Match score | Convert to % | Percentage badge | **NO FORMULA — see M-06** |

## 3.6 Scholarship Discovery (FR09, FR10)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-SCH-01 | Scholarship | Allow browsing of the scholarship database | Student | — | Query | Scholarship list | MUST |
| FR-SCH-02 | Scholarship | Filter by field of study, provider and academic level | Student | Filter selections | Filtered query | Filtered list | MUST |
| FR-SCH-03 | Scholarship | Keyword search — `INFERRED` (§1.7 says "search and filter") | Student | Query string | Text search | Results | SHOULD |
| FR-SCH-04 | Scholarship | Display a detail view with overview, benefits and coverage, application timeline and external link | Student | scholarship_id | Fetch detail | Detail page | MUST |
| FR-SCH-05 | Scholarship | Match users to scholarships using rule-based criteria against their profile | System | Profile + scholarship criteria | Rule matching | Match set | MUST |
| FR-SCH-06 | Scholarship | Display a checklist of satisfied and unsatisfied eligibility requirements | Student | Match result | Per-criterion evaluation | Checklist with pass/fail marks | MUST |
| FR-SCH-07 | Scholarship | Rank scholarships by suitability and eligibility | System | Match results | Sort | Ranked list | MUST |
| FR-SCH-08 | Scholarship | Present a personalised "Recommended For You" section | Student | Match results | Top-N selection | Recommended block | MUST |
| FR-SCH-09 | Scholarship | Flag scholarships with deadlines within 7 days in red and within 30 days in amber | System | deadline, current date | Date arithmetic | Colour flag | MUST |
| FR-SCH-10 | Scholarship | Link out to the external application portal | Student | Click | Open link | External navigation | MUST |
| FR-SCH-11 | Scholarship | Show "How to improve eligibility?" guidance — `INFERRED` (Figure 4.5) | Student | Unsatisfied criteria | Not described | Not described | SHOULD |
| FR-SCH-12 | Scholarship | Paginate results ("Load More Opportunities") — `INFERRED` (Figure 4.4) | Student | Scroll/click | Offset query | Next page | SHOULD |

> The report references a scholarship **"confidence score"** once, in §3.3.4 (testing). It appears nowhere in FR10, the use cases, the sprint descriptions or the mockups. See Conflict C-11.

## 3.7 Career Pathways (FR11)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-PATH-01 | Career Pathways | Allow the user to search for a specific profession | Student | Profession name | Lookup | Profession record | MUST |
| FR-PATH-02 | Career Pathways | Display the profession's description and required skills | Student | Profession record | Render | Overview + skills | MUST |
| FR-PATH-03 | Career Pathways | Display a step-by-step academic roadmap from the student's *current* education level to the profession | Student | Profession + education_level | Roadmap assembly | Staged roadmap | MUST |
| FR-PATH-04 | Career Pathways | Recommend relevant degree programmes and universities for the pathway | Student | Profession | Lookup/match | Programme list | MUST |
| FR-PATH-05 | Career Pathways | Show scholarships related to the chosen pathway | Student | Profession field | Match | Scholarship list | MUST |
| FR-PATH-06 | Career Pathways | Display market data — salary range, top industries, market share — `INFERRED` (Figure 4.9) | Student | Profession | Lookup | Market insights panel | SHOULD NOT (see §18) |

> Career Pathways is the weakest-specified major module. It is a headline feature in the Abstract, §1.7 and FR11, and it has a mockup (Figure 4.9) — yet it is **entirely absent from Table 4.1** (the definitive function list) and from the module summary in §3.6. There is no use case table for it, no sprint that builds it, and no ERD entity for roadmaps. See Conflict C-03 and Missing Information M-08.

## 3.8 AI Chatbot (FR12)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-CHAT-01 | Chatbot | Provide a floating button in the bottom-right corner, visible on any page | Student | — | Render | Persistent control | MUST |
| FR-CHAT-02 | Chatbot | Open a side panel showing conversation history and a text input field | Student | Click | Open panel | Chat UI | MUST |
| FR-CHAT-03 | Chatbot | Display suggested prompts / quick-reply FAQ buttons at the start of each session | Student | — | Load prompt set | Prompt chips | MUST |
| FR-CHAT-04 | Chatbot | Send the student's message to a Supabase Edge Function | Student | Message text | HTTPS call | Request dispatched | MUST |
| FR-CHAT-05 | Chatbot | Assemble context: the inquiry, the last ten conversation turns, and a profile summary including Holland Code and top recommendations | System | Message + user_id | Context assembly | Prompt payload | MUST |
| FR-CHAT-06 | Chatbot | Apply a system prompt instructing the model to act as a Malaysian educational advisor, focus answers on the Malaysian education system, and reply in the language of the user's input | System | Payload | Prompt construction | Constrained request | MUST |
| FR-CHAT-07 | Chatbot | Respond in English or Bahasa Malaysia depending on the user's input | System | Detected language | Model behaviour | Localised reply | MUST |
| FR-CHAT-08 | Chatbot | Stream the response back token by token | System | Model stream | Progressive render | Streaming reply | MUST |
| FR-CHAT-09 | Chatbot | Keep the Gemini API key server-side only; never expose it to the frontend | System | Env var | Edge Function isolation | Protected credential | MUST |
| FR-CHAT-10 | Chatbot | Help the student understand their RIASEC profile and interpret recommendation results | Student | Question | Context-grounded response | Explanation | MUST |
| FR-CHAT-11 | Chatbot | Act as a navigation assistant — guide users to relevant pages and explain available features | Student | Question | Context-grounded response | Guidance | MUST |
| FR-CHAT-12 | Chatbot | On Gemini unavailability, display "The assistant is temporarily unavailable. Please try again shortly." | System | API error | Error branch | Message | MUST |
| FR-CHAT-13 | Chatbot | On network failure, display a connection error and allow retry | System | Network error | Error branch | Retry control | MUST |
| FR-CHAT-14 | Chatbot | Persist chat messages — `INFERRED` from the ERD `messages` table `[FROM FIGURE — VERIFY]` | System | Message, sender, timestamp | Insert | Stored history | **CONFLICTED — see C-08** |

## 3.9 Dashboard & Personal Items (FR13)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-DASH-01 | Dashboard | Display a personalised summary of RIASEC results, top career and course recommendations, saved items and upcoming scholarship deadlines | Student | user_id | Aggregate reads | Dashboard | MUST |
| FR-DASH-02 | Dashboard | Allow bookmarking of courses and scholarships | Student | Save action | Insert into saved items | Bookmark | SHOULD |
| FR-DASH-03 | Dashboard | Allow updating the application status of a saved opportunity over time | Student | Status change | Update | Tracked application | SHOULD |
| FR-DASH-04 | Dashboard | Provide a comparison tool for comparing several courses | Student | Selected courses | Side-by-side render | Comparison view | SHOULD |
| FR-DASH-05 | Dashboard | Display profile completion percentage — `INFERRED` (Figure 4.10) | Student | Profile state | Completeness calc | Percentage | SHOULD |
| FR-DASH-06 | Dashboard | Display a recent activity feed — `INFERRED` (Figure 4.10) | Student | Event log | Query | Activity list | SHOULD |
| FR-DASH-07 | Dashboard | Provide quick actions (Search Scholarships, Take Assessment) — `INFERRED` (Figure 4.10) | Student | Click | Navigate | Route change | SHOULD |

> FR-DASH-02/03/04 are described in §3.3.3A and Sprint 6 but have **no FR ID** in Table 3.1. FR13 mentions only the bookmarked scholarship list. Application tracking and the comparison tool have no ERD support.

## 3.10 Administration (FR14)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-ADMIN-01 | Admin | Restrict the admin panel to authorised users only | System | Role claim | Role check + RLS | Access granted or denied | MUST |
| FR-ADMIN-02 | Admin | Allow manual entry and correction of scholarship records | Admin | Record fields | Insert/update | Updated scholarship | MUST |
| FR-ADMIN-03 | Admin | Allow manual entry and correction of course records | Admin | Record fields | Insert/update | Updated course | MUST |
| FR-ADMIN-04 | Admin | Display the scraper run log: updates, execution times and source errors | Admin | — | Query crawl logs | Log table | MUST |
| FR-ADMIN-05 | Admin | Provide a button to trigger the scraper manually | Admin | Click | Invoke Edge Function | Run started | MUST |
| FR-ADMIN-06 | Admin | Allow review and removal of entries flagged as outdated | Admin | Flagged records | Review action | Removed or retained | SHOULD |
| FR-ADMIN-07 | Admin | Monitor system activities | Admin | — | **NOT SPECIFIED** | **NOT SPECIFIED** | — |

> FR-ADMIN-07 is stated in §4.1.1 in exactly those words and nowhere elaborated. Do not build it without clarification (M-13).

## 3.11 Automated Data Acquisition (FR15)

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-CRAWL-01 | Crawler | Retrieve data from a predefined list of public Malaysian educational websites on a weekly schedule | System | Source list | Scheduled Edge Function | Raw HTML | MUST |
| FR-CRAWL-02 | Crawler | Extract scholarship name, provider, funding amount, eligibility conditions, deadlines and application links | System | HTML | Axios fetch + Cheerio parse | Structured records | MUST |
| FR-CRAWL-03 | Crawler | Validate and transform extracted data into structured format before storage | System | Raw extraction | Validation + transformation | Clean records | MUST |
| FR-CRAWL-04 | Crawler | Update existing records rather than duplicating them | System | Record + existing row | Upsert on a match key | Deduplicated data | MUST |
| FR-CRAWL-05 | Crawler | Flag outdated information for review or removal | System | Stale records | Staleness check | Flagged rows | SHOULD |
| FR-CRAWL-06 | Crawler | Write a log entry per run recording records touched, execution time, status and any errors | System | Run outcome | Insert into crawl logs | Log row | MUST |
| FR-CRAWL-07 | Crawler | Execute server-side within Supabase Edge Functions so credentials are never client-exposed | System | Env vars | Deno runtime isolation | Protected execution | MUST |
| FR-CRAWL-08 | Crawler | Retrieve **course/programme** data as well as scholarship data | System | Source list | As above | Course records | **CONFLICTED — see C-10** |

## 3.12 Security Functions **[ADDED — NOT IN REPORT]**

These are user-visible or operator-visible security *functions*, distinct from the passive controls in §13.1. They need FR IDs because they have inputs, processing and outputs, and because an examiner marking security will look for them in Table 3.1 — not buried in a methodology paragraph.

| ID | Module | Requirement | Actor | Input | Processing | Output | Priority |
| --- | --- | --- | --- | --- | --- | --- | --- |
| FR-SEC-01 | Security | Limit failed login attempts per account and per IP; apply exponential backoff or temporary lockout on exceeding the threshold | System | Credentials, attempt counter | Counter increment; threshold comparison | Access delayed or blocked; user informed | MUST |
| FR-SEC-02 | Security | Limit OTP verification attempts per issued code; invalidate the code after N failures and require a fresh one | System | Code, attempt counter | Attempt tracking against the issued code | Code invalidated; re-request prompt | MUST |
| FR-SEC-03 | Security | Rate-limit registration and OTP resend per email address and per IP | System | Request metadata | Sliding window counter | Request throttled | MUST |
| FR-SEC-04 | Security | Rate-limit chatbot requests per authenticated user | System | user_id, timestamp | Window counter | Throttle message | MUST |
| FR-SEC-05 | Security | Execute all Edge Function database queries under the calling user's JWT rather than the service role, so RLS applies to server-side code | System | Caller JWT | Supabase client instantiated with the caller token | RLS-enforced query | MUST |
| FR-SEC-06 | Security | Sanitise all crawler-extracted text fields before database insertion — strip HTML, control characters and instruction-like sequences | System | Raw extracted string | Sanitisation pipeline | Clean stored value | MUST |
| FR-SEC-07 | Security | Structurally separate untrusted data from instructions in the Gemini prompt, delimiting scraped and user-supplied content and instructing the model to treat it as data only | System | Context payload | Prompt construction with delimiters and an untrusted-data directive | Hardened prompt | MUST |
| FR-SEC-08 | Security | Validate chatbot output before rendering: reject or strip links to domains outside an allowlist | System | Model response | Output filter | Safe rendered response | SHOULD |
| FR-SEC-09 | Security | Record an audit entry for every administrator write, role change and manual scraper trigger, capturing actor, action, target and timestamp | System | Admin action | Insert into audit log | Immutable audit trail | MUST |
| FR-SEC-10 | Security | Present a privacy notice at registration and require explicit consent before an account is created | Guest | Consent checkbox | Store consent flag, version and timestamp | Consented account | MUST |
| FR-SEC-11 | Security | Allow a student to permanently delete their account and all associated personal data | Student | Delete request + confirmation | Cascading delete across all user-owned tables | Account and data removed | MUST |
| FR-SEC-12 | Security | Allow a student to export their own stored data in a machine-readable format | Student | Export request | Aggregate user-owned rows | Downloadable file | SHOULD |
| FR-SEC-13 | Security | Assign the administrator role only through a controlled server-side procedure; provide no self-service path to administrator | Admin/Dev | Role grant | Manual database or migration-level grant | Role assigned | MUST |
| FR-SEC-14 | Security | Apply security response headers on all frontend responses: Content-Security-Policy, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy | System | HTTP response | Header injection at the hosting layer | Hardened response | MUST |

> **Why these belong in Table 3.1 and not only in Chapter 3 prose.** Your current Table 3.1 contains fifteen FRs, none of which is a security function. An examiner scanning your requirements table for evidence of security engineering finds nothing. Adding FR16–FR29 (or a separate FR-SEC series) makes the security work visible at the requirements level, where it is graded.

---

# 4. NON-FUNCTIONAL REQUIREMENTS

Table 3.2 contains **six** NFRs — NFR01, NFR02, NFR03, NFR04, NFR06, NFR07. **NFR05 is missing entirely**, and §3.6 claims eight NFRs were identified. See Conflict C-13.

## 4.1 Stated in the report

| ID | Category | Requirement | Testable? |
| --- | --- | --- | --- |
| NFR01a | Security | All user data must be protected by Supabase Row-Level Security policies | Yes |
| NFR01b | Session mgmt | User sessions must be managed using JSON Web Tokens | Yes |
| NFR01c | Secrets | API keys shall never be exposed in client-side code | Yes — bundle inspection |
| NFR01d | Security | Email verification codes must expire after 10 minutes and must not be reusable once consumed | Yes |
| NFR02a | Performance | Page load must not exceed **4 seconds** on a standard mobile internet connection | Yes |
| NFR02b | Performance | The recommendation engine must return results within **3 seconds** | Yes |
| NFR02c | Performance | The chatbot must deliver its response within **2 seconds** | Ambiguous — see C-12 |
| NFR03a | Reliability | Handle failed API calls, missing data and invalid inputs gracefully without crashing | Yes |
| NFR03b | Reliability | Error messages must be clear and informative to the user | Partly |
| NFR04a | Usability | The interface must be intuitive and navigable without prior training | UAT only |
| NFR04b | Usability | All forms must include inline validation with descriptive error messages | Yes |
| NFR04c | Usability | Must support users across digital literacy levels | UAT only |
| NFR06 | Responsiveness | Fully functional and visually consistent across mobile (375px) and desktop (1280px) | Yes |
| NFR07 | Maintainability | The RIASEC question bank and recommendation rule base must be stored in separate configuration files, updatable without modifying application code | Yes |

Additional quality constraints stated outside Table 3.2:

| Source | Constraint |
| --- | --- |
| §4.2.3 UC | Below 375px, display a notice recommending the user switch to a supported device |
| §4.2.3 UC | Touch interactions on mobile must function equivalently to mouse interactions on desktop |
| §3.3.2A | Consistency of navigation, typography, colour and button styles across all pages |
| §3.3.2A | Clarity: structured presentation, clear headings, spacing, visual hierarchy to prevent cognitive overload |
| §3.3.2A | Professional, clean visual design with a warm colour palette |
| §3.3.3D | Reduce unnecessary database requests via shared state management |
| §3.4.1 | Database schema managed through Supabase CLI migrations so it can be rebuilt from scratch |

## 4.2 Categories the report does NOT cover

| Category | Status |
| --- | --- |
| **Accessibility** (WCAG, contrast, keyboard nav, screen readers) | **NOT SPECIFIED IN REPORT.** §4.1.1 and NFR04c mention "accessible" and "digital literacy levels" but never in an assistive-technology sense. |
| **Privacy** (retention, deletion, consent, PDPA 2010) | **NOT SPECIFIED IN REPORT.** No privacy policy, no account deletion, no data export, no consent capture — despite collecting minors' academic records. This is a notable omission for an Information Security FYP. See M-03. |
| **Data integrity** (constraints, referential integrity, validation rules) | **NOT SPECIFIED IN REPORT** as an NFR. Input validation is mentioned as a security control only. |
| **Availability / uptime target** | **NOT SPECIFIED IN REPORT.** §3.3.5 mentions Supabase automated backups. |
| **Scalability / concurrent users** | **NOT SPECIFIED IN REPORT.** §2.6.7 mentions scalability as an architectural benefit, with no target. |
| **Auditability / logging** | Only the crawl log is specified. No auth or admin action audit trail. |

## 4.3 Proposed additional NFRs **[ADDED — NOT IN REPORT]**

Table 3.2 skips NFR05 and stops at NFR07, while §3.6 claims eight NFRs exist. Use the vacancy: fill NFR05 and add NFR08–NFR09. This resolves Conflict C-13 and closes the three most conspicuous category gaps in one edit.

| ID | Category | Proposed requirement | How it is verified |
| --- | --- | --- | --- |
| **NFR05** | **Privacy** | Personal data collected shall be limited to what each feature requires. Students shall be able to view, export and permanently delete their own data. A privacy notice shall be presented and consent recorded before account creation. Data shall be retained no longer than the stated retention period. | Consent record present; deletion verified to remove all user-owned rows across every table; retention policy documented |
| **NFR08** | **Data integrity** | All user input shall be validated against a defined schema at both client and server. Referential integrity shall be enforced by foreign key constraints. Every user-owned table shall carry a NOT NULL `user_id` foreign key. | Constraint definitions in migration files; negative tests submitting malformed and out-of-range input |
| **NFR09** | **Auditability** | All administrator write operations, role changes and manual scraper triggers shall be logged with actor, action, target and timestamp. Audit records shall not be modifiable through the application. | Audit table inspection after a scripted admin session; RLS policy preventing update and delete on the audit table |

**Accessibility** is deliberately left out of the NFR set. You have finite time, WCAG conformance is expensive to verify properly, and it is not what this degree is marked on. NFR04c's "digital literacy levels" already covers the usability intent. Do not claim accessibility conformance you cannot evidence.

---

# 5. MODULES

The report is internally inconsistent about how many modules exist. The Abstract says **four core modules** plus a chatbot: User Management, Find Your Path, Scholarship Discovery, Career Pathways. §1.5.2 says **five main features**. Table 4.1 lists **seven** function groups and omits Career Pathways. §3.6 lists six development areas.

I use the following eight-module decomposition, which is the union of everything with FR support.

## M1 — User Management

- **Purpose:** identity, verification, session and profile.
- **Features:** registration; email OTP verification; login/logout; JWT session; four-stage profile wizard; profile editing.
- **Inputs:** email, password, full name, personal information, education level, subject grades per examination, career goal.
- **Outputs:** verified account; complete student profile; active session; application-wide profile context.
- **Business logic:** account created unverified; no session until verified; code valid 10 minutes, single use; each wizard step validated before progression.
- **User flow:** Landing → Register → Verify code → Profile setup (4 steps) → Dashboard.
- **Dependencies:** Supabase Auth; profiles and academic results tables.
- **Data required:** users/profiles, academic results.

## M2 — Find Your Path (container)

- **Purpose:** the core intelligent advisory function (§4.1.1). A hub page offering two entry points: RIASEC Assessment and Academic Analysis (Figure 4.5).
- **Business logic:** both sub-modules feed the recommendation engine; recommendations require RIASEC complete AND academic results recorded (use case precondition).
- **Dependencies:** M3, M4, M5.

## M3 — RIASEC Assessment

- **Purpose:** psychometric interest mapping (layer one of the two-layer model in §2.3.3).
- **Features:** 36-item inventory; six dimension scores; three-letter Holland Code; radar chart; written interpretation; retake.
- **Inputs:** 36 item responses.
- **Outputs:** six dimension scores; Holland Code; radar chart; narrative of dominant types, suitable career fields, suitable academic areas.
- **Business logic:** score each dimension from its six items; top three dimensions by score form the code; retake overwrites.
- **User flow:** Find Your Path → RIASEC Assessment → 36 items → Submit → Results page.
- **Dependencies:** server-side question bank config; Recharts; RIASEC results table.

## M4 — Academic Analysis (Academic Trend Analyzer)

- **Purpose:** academic data synthesis (layer two of §2.3.3) — identify consistent strengths and weaknesses.
- **Features:** grade entry per examination period; Strong/Average/Weak classification; subject card grid; written summary; trend visualisation.
- **Inputs:** subject, exam_type, grade.
- **Outputs:** per-subject classification with average grade and examination count; top academic fields summary; trend chart; persisted subject strength profile.
- **Business logic:** classification derived from grades across examinations (formula conflicted — see §7).
- **Restriction:** post-secondary school students only.
- **Dependencies:** academic results table; Recharts.

## M5 — Recommendation Engine (Career + Course)

- **Purpose:** the primary decision-support component.
- **Features:** rule evaluation; match scoring; ranking; transparent reason lists; recalculation on input change.
- **Inputs:** Holland Code, subject strength profile, career goals.
- **Outputs:** ranked career fields; ranked courses with course name, university, pathway type, entry requirements, reasons.
- **Business logic:** evaluate every rule in the JSON rule base; score by conditions satisfied; rank; return.
- **Dependencies:** M3, M4, M1; server-side JSON rule base; courses table; career RIASEC profiles.

## M6 — Scholarship Discovery

- **Purpose:** manual browsing plus personalised eligibility matching.
- **Features:** list, filter, search, detail view, eligibility checklist, ranking, deadline flags, external links, "Recommended For You".
- **Inputs:** student profile; filter selections; scholarship records.
- **Outputs:** filtered list; ranked matches; per-criterion checklist; colour-coded deadline flags.
- **Business logic:** pull active scholarships; filter against student attributes; rank by suitability; render checklist; flag ≤7 days red, ≤30 days amber.
- **Dependencies:** scholarships table; crawler; admin panel; student profile.

## M7 — Career Pathways

- **Purpose:** goal-directed path for students who already know their target profession.
- **Features:** profession search; description and required skills; staged academic roadmap from current education level; recommended programmes and universities; related scholarships.
- **Inputs:** profession name; student's current education level.
- **Outputs:** roadmap with stages; programme list; scholarship list.
- **Business logic:** **NOT SPECIFIED IN REPORT.** No rule for roadmap construction, no data model for stages, no sprint that builds it.
- **Dependencies:** careers/professions data; courses; scholarships.

## M8 — AI Chatbot

- **Purpose:** cross-cutting assistant — explains recommendations, answers educational questions, aids navigation.
- **Features:** floating button; side panel; suggested prompts; streaming responses; bilingual.
- **Inputs:** message text; last 10 turns; profile summary with Holland Code and top recommendations.
- **Outputs:** streamed advisory response.
- **Business logic:** Edge Function assembles context + system prompt → Gemini → stream to client. The chatbot **does not generate or alter recommendations**; it explains those produced by M5.
- **Dependencies:** Gemini API; Edge Function; profile, RIASEC, recommendations data.

## M9 — Administration & Data Acquisition

- **Purpose:** keep reference data accurate and current.
- **Features:** role-gated admin panel; manual CRUD on scholarships and courses; crawl log viewer; manual scraper trigger; weekly scheduled scraper.
- **Business logic:** upsert not duplicate; log every run; flag stale entries.
- **Dependencies:** Edge Functions; scheduler; crawl logs table; role claim.

---

# 6. FIND YOUR PATH / RIASEC — ASSESSMENT SPECIFICATION

## 6.1 Number of questions

**36 items**, six per dimension. Stated consistently in §3.3.3A, §3.4.1 Sprint 2 and Table 4.1. Confirmed by the Figure 4.6 mockup ("Question 12 of 36").

## 6.2 Question type

Interest inventory items describing activities. The one visible example (Figure 4.6): *"I like to work with my hands to build or repair things."* Based on the principles of the Self-Directed Search (§2.3.3).

**The 36 items themselves are NOT SPECIFIED IN REPORT.** Only one sample exists.

## 6.3 Answer format — **THREE CONFLICTING SPECIFICATIONS**

| Source | Format |
| --- | --- |
| §3.4.1 Sprint 2 | Three-point: "like, feel neutral about, or dislike" |
| §4.2.2 use case, step 4 | "selecting either from Strongly Like or Strongly Dislike" — reads as binary or as the endpoints of an unstated scale |
| Figure 4.6 mockup | Five-point: Strongly Dislike, Dislike, Neutral, Like, Strongly Like |

This is unresolved and material: it determines the score range, and therefore every threshold in the rule base. See Conflict C-04.

## 6.4 RIASEC categories

Realistic, Investigative, Artistic, Social, Enterprising, Conventional. Six items each.

## 6.5 Scoring method

The report states only that the system "will calculate a score for each dimension based on their responses" (§3.4.1) and "calculates a score for each of the six RIASEC dimensions based on responses" (§4.2.2).

- Point values per response option: **NOT SPECIFIED IN REPORT**
- Aggregation (sum, mean, weighted): **NOT SPECIFIED IN REPORT**
- Normalisation or percentage conversion: **NOT SPECIFIED IN REPORT**
- Score range: **NOT SPECIFIED IN REPORT**

Do not invent this. It must be defined before Sprint 2, and it must be defined *jointly* with the answer format (6.3).

## 6.6 Holland Code generation

**Rule, stated exactly:** "The three dimensions with the highest scores will form the student's three-letter Holland Code, representing their dominant personality profile" (§3.4.1). Restated in §4.2.2 step 7. Examples given: ICR (Investigative-Conventional-Realistic), EAS (Enterprising-Artistic-Social) (§2.3.3).

- Letter ordering: implicitly descending by score. Not stated explicitly.
- **Tie-breaking: NOT SPECIFIED IN REPORT.** With 36 items and six dimensions, ties are likely, not rare. This is a required decision (M-04).

## 6.7 Storage

"In addition to determining the primary personality type, the system saves the complete RIASEC profile which allows a more extensive analysis of personality patterns such as congruence, consistency and distinction" (§2.3.3).

The full six scores plus the Holland Code are saved (§3.4.1, §4.2.2 step 8). Note: **congruence, consistency and distinction are named but never defined, computed or displayed anywhere else in the report.** Do not build them (they belong in SHOULD NOT).

## 6.8 Interpretation and result presentation

The results page displays:

1. A **Recharts radar chart** showing scores across all six dimensions.
2. A **written description** of the dominant personality types, the career fields that suit them, and the academic areas that suit them (§3.4.1).

The interpretation text content itself is **NOT SPECIFIED IN REPORT**. Whether it is per-letter, per-code (up to 120 three-letter permutations), or generated is **NOT SPECIFIED**.

## 6.9 Retake behaviour

"User retakes the assessment and previous results are overwritten with the new scores" (§4.2.2 alternative path). No history is retained. This contradicts the "congruence, consistency and distinction" ambition in §2.3.3, which would require longitudinal data.

## 6.10 Completeness enforcement

"User submits without answering all items: System highlights unanswered items and prevents submission" (§4.2.2 exception path). This **directly contradicts** the "Skip Question" control in Figure 4.6. See Conflict C-04b.

## 6.11 Relationship between RIASEC and recommendations

Per §2.3.3, a **two-layered process**:

- **Layer 1 — psychometric interest mapping.** Structured interest assessment → Holland Code + full profile.
- **Layer 2 — academic data synthesis.** RIASEC profile combined with actual subject grades and performance patterns from the trend analyzer.

The worked example given in the report: *"students with strong artistic characteristic who performs well in mathematics may receive recommendations for programmes like architecture, multimedia technology or design engineering since it require both creativity and analytical skills."*

Downstream consumers of the Holland Code: the recommendation engine (FR07, FR08) and the AI chatbot context (§3.4.3).

---

# 7. ACADEMIC ANALYSIS

## 7.1 Which students

**Post-secondary school students only.** FR06: "For post-secondary school students only." §4.1.3 gives the rationale: "the grading systems and scoring used in pre-university programmes are not standardized and therefore unsuitable for consistent trend evaluation."

Read together with the examination examples in §1.7 (Form 4, Form 5, Trial SPM, actual SPM), this means the feature analyses **SPM-track results only**. A student who has completed STPM, STAM, matriculation, diploma or foundation cannot use it — even though all six groups are named as target users.

**Implication:** for five of the six target user groups, Find Your Path degrades to RIASEC-only, and the recommendation engine loses one of its two documented inputs. The use case precondition requires *both* RIASEC completion *and* recorded academic results, which those students cannot satisfy. See Conflict C-05 — this is the most serious conflict in the document.

## 7.2 Examination periods — **CONFLICTED**

| Source | Count |
| --- | --- |
| §3.4.1 Sprint 2 | "academic grades across up to three examination periods" |
| §3.4.2 Sprint 3 | "across multiple examination periods" |
| §4.1.3 | "across up to three examination periods" |
| FR06 | "across multiple examination" |
| §1.7 | four examples: Form 4, Form 5, Trial SPM, and actual SPM |
| §2.5.2 | four: SPM result, trial SPM, Form 5 final exam, Form 4 final exam |
| §3.3.3A | "three different examination periods" |
| Figure 4.7 mockup | three columns: Form 4 Final, SPM Trial, SPM Actual |

The binding constraint appears to be **three**, with §1.7 and §2.5.2 erroneously listing four. See Conflict C-07.

## 7.3 Subjects captured

**No fixed subject list exists in the report.** §2.6.4 gives "school subject domains such as mathematics, science, english, accounting, history and others". Figure 4.7 shows Mathematics, Additional Mathematics, Physics, English. Sprint 4's rule example references Biology and Chemistry.

Whether the subject list is fixed, admin-managed, or free-text is **NOT SPECIFIED IN REPORT** (M-05).

## 7.4 Grade capture

Grades are entered as **letter grades** — Figure 4.7 shows A+, A, A-, B+, B. The SPM grade scale (A+ through G) is never enumerated, and **no grade-to-numeric mapping is specified** (M-05). This mapping is a prerequisite for any averaging.

## 7.5 Strong / Average / Weak logic — **CONFLICTED**

| Source | Rule |
| --- | --- |
| FR06 | "classify each subject as Strong, Average, or Weak **based on consistency of performance**" |
| §3.4.2 Sprint 3 | "Each subject is classified as Strong, Average, or Weak **based on the average of the student's scores**" |

These are different algorithms. Consistency is a variance measure; average is a central-tendency measure. A student scoring A, C, A is *inconsistent* but *above average*. See Conflict C-07b.

**Thresholds are NOT SPECIFIED IN REPORT** under either interpretation. There is no boundary between Strong and Average, or Average and Weak.

**Handling of a subject present in some examinations but not others: NOT SPECIFIED IN REPORT.**

## 7.6 Presentation

- **Card grid**, one card per subject, showing the strength label, the average grade, and the number of examinations included in the calculation (§3.4.2).
- **Written summary** below the grid highlighting top academic fields and noting weaker areas relevant to future course choices (§3.4.2).
- **Interactive charts** for cross-examination comparison (§3.3.3A); Recharts line charts (§2.6.2).
- Figure 4.7 additionally shows a "Strong Subjects" preview strip, a results timeline table, and a narrative insight ("Consistent Growth Detected... favorable for STEM-related degrees"). The rule that produces such an insight is **NOT SPECIFIED IN REPORT**.

## 7.7 Effect on recommendations

The subject strength profile is saved to the database and "fed directly into the recommendation engine" (§3.4.2). Within the rule base, subject strengths appear as rule conditions — the documented example requires *a "Strong" rating in Biology and Chemistry*.

Documented directional rules (§2.6.4, illustrative rather than exhaustive):

- Strong mathematics + strong science → engineering, computer science, data science
- Stronger creative abilities → design-related fields
- Strong artistic RIASEC + strong mathematics → architecture, multimedia technology, design engineering (§2.3.3)
- Strong Biology + strong Chemistry + interest in health sciences + a particular RIASEC type → health science courses (§3.4.2)

---

# 8. RECOMMENDATION ENGINE

## 8.1 Classification

**Knowledge-based / rule-based.** This is stated unambiguously and repeatedly:

- §2.6.4: "Nexus employs a knowledge-based recommendation system... a knowledge-based approach uses predefined rules and domain knowledge... rather than popularity or ratings from other users."
- FR07, FR08: "using a knowledge-based rule engine."
- §3.4.2: "The recommendation engine evaluates a set of predefined rules that is stored in a JSON configuration file against the student's profile."
- §4.1.3, explicitly excluding the alternative: "The recommendation engine operates on a rule-based approach using a fixed configuration file and does not employ machine learning or adaptive algorithms that evolve from user interaction data."

**It is not AI-generated and not hybrid.** Gemini is confined to the chatbot. Nothing in the report gives the chatbot authority over recommendation logic — §2.6.5 and §3.3.3B describe it as *explaining* recommendations, and the chatbot use case receives "previous recommendations" as read-only context. Any implementation that has Gemini produce recommendations would contradict §4.1.3 directly and would undermine RO3 (accuracy testing against deterministic expected outputs, per §3.3.4).

The report's rationale, worth preserving: *"recommendations need to be logical and explained based on established guidelines rather than popularity or ratings from other users."*

## 8.2 Pipeline

```
INPUTS
  ├─ Holland Code (3 letters) + six dimension scores        [M3]
  ├─ Subject strength profile (Strong/Average/Weak per subject)  [M4]
  └─ Career goals / stated interests                        [M1 profile]

PROCESSING
  1. Retrieve the three inputs for the authenticated user   (§4.2.2 step 3)
  2. Load the JSON rule base from server-side config        (NFR07)
  3. Evaluate every rule against the user's data            (§4.2.2 step 4)

RULES
  Each rule = { conditions[], outputs[] }
  Documented condition types:
    - requires a particular RIASEC type
    - requires a "Strong" rating in named subjects (e.g. Biology AND Chemistry)
    - requires an expressed interest in a field (e.g. health sciences)
  Outputs: corresponding course(s)                          (§3.4.2)

MATCHING
  match_score = f(number of conditions satisfied)           (§4.2.2 step 5)
  Exact formula: NOT SPECIFIED IN REPORT

RANKING
  Sort descending by match score                            (§3.4.2, §4.2.2 step 6)
  Tie-breaking: NOT SPECIFIED IN REPORT
  Minimum threshold to display: NOT SPECIFIED IN REPORT
  Number of results returned: NOT SPECIFIED IN REPORT

OUTPUT
  Ranked career fields  (FR07)
  Ranked courses        (FR08)
  Per card: type of suitable career, course name, university,
            pathway type, entry requirements,
            transparent list of reasons it was suggested    (§3.4.2, §4.2.2 step 7)
  Persisted for the user's reference                        (§4.2.2 postcondition)
```

## 8.3 The two-stage description in §2.6.4 vs the one-pass engine in §3.4.2

§2.6.4 describes a **sequential** process:

1. *Career* stage — each career pathway has a **predefined RIASEC profile**; the student's RIASEC results are compared against these profiles to find compatible careers.
2. *Programme* stage — academic performance is then analysed and matched against **the academic requirements of different programmes**.
3. *Scholarship* stage — matching based on the recommended programmes, academic achievements, field of study and eligibility requirements.

§3.4.2 describes a **single unified rule base** where one rule can combine a RIASEC condition and subject conditions and an interest condition, emitting course outputs directly.

These are two different architectures. Under §2.6.4 you need career-to-RIASEC profile records and programme-to-academic-requirement records as *data*. Under §3.4.2 you need one JSON rule file. See Conflict C-14 — this needs resolving before any data modelling.

## 8.4 Recalculation and empty state

- Updating academic results or retaking RIASEC causes recalculation (§4.2.2 alternative path).
- No rules match → "System displays a message encouraging the user to complete or update their RIASEC assessment and academic results" (§4.2.2 exception path).

## 8.5 Preconditions

"User is logged in, has completed the RIASEC assessment, and has academic results recorded in their profile" (§4.2.2 precondition). All three are required. This is the source of the non-SPM blocker in §7.1.

## 8.6 Scholarship matching (related but distinct logic)

Runs on "a similar matching logic but focuses on financial aid" (§3.4.2). Detailed in §9 below.

---

# 9. SCHOLARSHIP SYSTEM

## 9.1 Scholarship fields

**From the ERD (Figure 4.11)** `[FROM FIGURE — VERIFY]`: `scholarship_id` (PK), `scholar_name`, `provider`, `deadline`, `link`, `description`.

**From the crawler spec (§3.4.3 Sprint 6, §2.6.6)** the following are also extracted: **funding amount**, **eligibility conditions**, **field of study**, **application links**.

**From the mockups (Figures 4.4, 4.5):** education level, field of study, scholarship type, benefits list, eligibility checklist items, application timeline stages (Application Open, Shortlisting, Interview, Result Announcement).

The ERD is therefore **incomplete relative to the crawler and the UI**. Funding amount, eligibility criteria, education level, field of study and scholarship type all have no ERD home. See M-09.

## 9.2 Search and filtering

| Source | Filters |
| --- | --- |
| FR09 | field of study, provider, academic level |
| §1.7 | education level, field of study, provider |
| §1.5.2 | courses, institutions, **budget** |
| Figure 4.4 | Education Level, Field of Study, Scholarship Type |

**Take FR09 as authoritative** (it is the requirement statement). "Budget" (§1.5.2) and "Scholarship Type" (mockup) are unsupported additions. See Conflict C-09b.

Free-text search is implied by §1.7 ("search and filter") but has no FR.

## 9.3 Eligibility criteria and checking

FR10: "match users to scholarships based on their profile using rule-based criteria and display a checklist of satisfied and unsatisfied eligibility requirements."

Matching inputs — **two different lists**:

| Source | Inputs |
| --- | --- |
| §3.4.2 Sprint 4 | demographic details, academic results, field of interest, **financial background** |
| §2.6.4 | recommended programmes, academic achievements, field of study, eligibility requirements |

**"Financial background" is never collected anywhere.** Profile setup (§3.4.1) captures personal information, education level, academic grades and career goals only. There is no income field in the ERD, no form step, no FR. See Conflict C-11b.

Figure 4.5 shows checklist items of the form: Malaysian Citizen ✓, Degree Level ✓, Computer Science Field ✓, Leadership Experience ✗, Minimum CGPA 3.75 ✗ — plus a "How to improve eligibility?" affordance.

**The eligibility rule encoding format is NOT SPECIFIED IN REPORT.** Scholarship criteria arrive as scraped free text; how they become machine-checkable conditions is the single largest unspecified mechanism in the scholarship module (M-07, CRITICAL).

## 9.4 Deadline handling

**Rule, stated exactly (§3.4.2):** "scholarships with deadlines approaching within seven days are flagged in red, while those within thirty days are highlighted in amber."

- Behaviour for already-passed deadlines: **NOT SPECIFIED IN REPORT.** §3.4.2 refers to "active scholarships", implying a status concept.
- Rolling or unspecified deadlines: **NOT SPECIFIED IN REPORT.**

## 9.5 Scholarship status

The only status language is "the system pulls **active** scholarships from the database" (§3.4.2) and the crawler flagging "outdated information... for review or removal" (§2.6.6). **No status field exists in the ERD** and no status values are enumerated. See M-09.

## 9.6 Ranking

"Each scholarship is ranked according to suitability and eligibility based on these criteria" (§3.4.2). Formula: **NOT SPECIFIED IN REPORT.**

The term **"confidence score"** appears once (§3.3.4: "the scholarship eligibility calculator will be tested against varying conditions to confirm that confidence scores and checklists are calculated accurately") and is defined nowhere. See Conflict C-11.

## 9.7 Data acquisition — source of each field

| Information | Static DB | Crawler | Administrator | User input |
| --- | --- | --- | --- | --- |
| Scholarship name, provider | — | ✓ primary | ✓ manual entry/correction | — |
| Funding amount | — | ✓ | ✓ | — |
| Eligibility conditions | — | ✓ | ✓ | — |
| Deadline | — | ✓ | ✓ | — |
| Application link | — | ✓ | ✓ | — |
| Description | — | ✓ (implied) | ✓ | — |
| Course/programme records | — | Conflicted (C-10) | ✓ | — |
| University records | ✓ (implied by ERD) | Conflicted | ✓ | — |
| RIASEC question bank | ✓ server-side config | — | — | — |
| Recommendation rule base | ✓ server-side JSON | — | — | — |
| Career RIASEC profiles | ✓ (per §2.6.4) | — | — | — |
| Student profile, grades, goals | — | — | — | ✓ |
| RIASEC responses | — | — | — | ✓ |
| Saved items, application status | — | — | — | ✓ |

## 9.8 Crawler requirements

| Aspect | Specification |
| --- | --- |
| Trigger | Weekly schedule + manual admin button |
| Sources | "a predefined list of public Malaysian educational websites" — **the list itself is NOT SPECIFIED** |
| Fetch | Axios HTTP requests (§2.6.6) |
| Parse | Cheerio HTML extraction (§2.6.6) |
| Runtime | Supabase Edge Functions (§2.6.6, §3.4.3) |
| Write behaviour | Upsert — "existing records are updated rather than duplicated" |
| Match key for upsert | **NOT SPECIFIED IN REPORT** |
| Validation | "validated and transformed into a structured format" — rules NOT SPECIFIED |
| Staleness | "outdated information can be flagged for review or removal" — criteria NOT SPECIFIED |
| Logging | Per-run entry: records touched, execution time, status, error message, duration |

> **Language conflict:** §1.5.3 specifies "Python-based web crawling tools"; §2.6.6 specifies JavaScript/Axios/Cheerio; Table 3.4 lists no Python at all. See Conflict C-10b. The JavaScript/Edge Function answer is the coherent one — Supabase Edge Functions run Deno, not Python.

> **Gemini-for-parsing conflict:** §1.5.3 states Gemini is used for "interpreting unstructured scholarship data". Nothing else in the report supports this — §2.6.6 assigns all extraction to Cheerio, and Table 3.4 scopes Gemini to "AI-powered chatbot and intelligent advisory services". See Conflict C-15.

---

# 10. AI CHATBOT

## 10.1 Purpose

Interactive virtual advisor and navigation assistant. Two documented roles (§3.3.3B):

1. **Advisory** — guidance on career pathways, course selection, scholarship opportunities, general educational enquiries; helping students understand their RIASEC profile and interpret recommendation results.
2. **Navigation** — guiding users to relevant pages, explaining features, helping complete tasks, reducing the learning curve for new users.

## 10.2 Supported questions

Careers, courses, scholarships, educational pathways, RIASEC profile interpretation, recommendation rationale, platform navigation and features. Suggested prompts are shown at session start; FAQ quick-reply buttons are provided.

The specific prompt set is **NOT SPECIFIED IN REPORT** (the Figure 4.2 landing page shows landing-page FAQs — What is Nexus? / How does it work? / Is it free to use? / How does Nexus provide recommendations? / How do I start? — which may or may not be the chatbot's prompt set).

## 10.3 Student context and accessible data

Per §3.4.3 Sprint 5, the Edge Function receives:

- the student's inquiry;
- **the last ten turns** of the conversation;
- **a summary of the student's profile**, including their **Holland Code** and **top recommendations**.

§2.6.5 states more broadly that the chatbot "is integrated with the Nexus database and recommendation engine... to access relevant information such as RIASEC assessment results, academic profiles, programme data, and scholarship listings."

**Conflict of degree:** Sprint 5 describes a bounded, pre-assembled context payload. §2.6.5 describes database-wide access. The security-correct reading is Sprint 5's — a fixed, minimal, server-assembled context. See Conflict C-16 and note that it has direct security consequences (a chatbot with broad DB access under a service role bypasses RLS).

## 10.4 Gemini integration requirements

| Requirement | Source |
| --- | --- |
| Google Gemini API | §2.6.5, Table 3.4 |
| Invoked via Supabase Edge Function, never from the client | §3.3.3B, §3.4.3 |
| API key stored as a server-side environment variable only | §3.3.2C, NFR01c |
| System prompt: act as a Malaysian educational advisor; focus answers on the Malaysian education system | §3.4.3 |
| Respond in English or Bahasa Malaysia depending on the user's input | §3.4.3, FR12 |
| Response streams token by token to the browser | §3.4.3 |

## 10.5 Backend requirements

Edge Function that: authenticates the caller; retrieves profile, Holland Code and top recommendations; assembles the last ten turns; composes the system prompt; calls Gemini; streams the response back.

## 10.6 Security requirements

- API key never in the frontend bundle (NFR01c, §3.3.2C).
- All sensitive operations server-side; "no sensitive operation is ever performed client-side" (§3.3.2C).
- Deno Edge runtime "does not expose server-side code or credentials to the client" (§3.3.2C).
- Chatbot reads must respect the requesting student's identity — implied by RLS, not stated for the chatbot specifically. **This is the gap in C-16.**

## 10.7 What the chatbot must NOT claim

**NOT SPECIFIED IN REPORT as chatbot-specific constraints.** No guardrails, refusal policy, disclaimer requirements or hallucination controls are documented.

However, the system-level limitations in §1.5.5 apply to all system output and should be reflected in the system prompt: Nexus is a guidance tool, not an admission portal; it does not guarantee university placements or successful scholarship applications; recommendations support self-discovery rather than definitive conclusions about career suitability; it does not replace professional counselling (§4.1.3).

Additionally, the chatbot **must not generate or alter recommendations** — that is M5's function (§4.1.3 forbids non-rule-based recommendation). This constraint is implied by the architecture, not stated as a prohibition. It should be made explicit (M-11).

## 10.8 Error handling

| Condition | Behaviour |
| --- | --- |
| Gemini API unavailable | Display: "The assistant is temporarily unavailable. Please try again shortly." |
| Network failure | Display a connection error; allow retry |
| Rate limiting / quota exhaustion | **NOT SPECIFIED IN REPORT** |
| Malformed or empty model response | **NOT SPECIFIED IN REPORT** |
| Stream interruption mid-response | **NOT SPECIFIED IN REPORT** |
| Off-topic or out-of-scope questions | **NOT SPECIFIED IN REPORT** |

## 10.9 History persistence

Use case postcondition: "Conversation history is retained during the **active session**."
ERD: a `messages` table with `user_id`, `sender`, `message`, `chat_time` `[FROM FIGURE — VERIFY]`.
§2.6.3: the database stores "chatbot interactions".

Session-scoped versus persisted is unresolved. See Conflict C-08.

---

# 11. ADMIN SYSTEM

## 11.1 Admin pages

Derived from FR14 and §4.1.1. No admin mockup exists in the report.

| Page | Purpose |
| --- | --- |
| Admin login / entry | Role-gated access (mechanism NOT SPECIFIED — separate login or role-based redirect from the standard login?) |
| Scholarship management | List, create, edit, correct scholarship records |
| Course management | List, create, edit, correct course records |
| Crawler monitor | View run logs; trigger a manual refresh |

## 11.2 Admin permissions

**Granted:** write access to shared tables (courses, universities, scholarships) per §3.3.2C; manual entry and correction of records (FR14); view crawl logs; trigger the scraper.

**Not granted anywhere in the report:** user account management, viewing or editing student profiles, viewing RIASEC results, viewing chat logs, editing the recommendation rule base, editing the RIASEC question bank, managing the crawler source list, managing other administrators, role assignment.

The `role` field in the users table `[FROM FIGURE — VERIFY]` implies role assignment must happen somewhere. **How the first administrator is created is NOT SPECIFIED IN REPORT** (M-14, CRITICAL — it is a bootstrap and a security question).

## 11.3 Scholarship and course management

FR14: "allowing manual entry and correction of records". Whether deletion is permitted is **NOT SPECIFIED**. §2.6.6's "flagged for review or removal" and FR-ADMIN-06 imply a removal capability.

## 11.4 Crawler logs

Per §3.4.3 Sprint 6 and the ERD, each run records: updates (records touched), execution time, status, error message, duration. The admin panel "displays this log and includes a button to trigger the scraper manually."

Log retention, pagination and filtering: **NOT SPECIFIED IN REPORT.**

## 11.5 Data management

Rule base and question bank live in **server-side configuration files** (NFR07, §3.3.2C), explicitly so they can be updated without modifying application code and so business logic is protected "from inspection or manipulation." They are **not** admin-editable through the UI as specified. Building a rule-base editor would contradict §3.3.2C's protection rationale — see §18 SHOULD NOT.

---

# 12. DATABASE REQUIREMENTS

> Everything in this section that derives from Figure 4.11 is marked `[ERD]` and needs visual verification. The extracted figure text was heavily garbled; in particular the `courses` entity appears to have absorbed fields belonging to a separate careers/professions entity.

## 12.1 EXPLICITLY REQUIRED entities

### E1 — `users` / `profiles` `[ERD]`
| Attribute | Notes |
| --- | --- |
| `user_id` | PK |
| `email` | |
| `password` | ⚠ **See security note below** |
| `role` | Student / Admin — values not enumerated |
| `fullname` | |
| `education_level` | |
| `career_goal` | |
| `created_at` | |

> ⚠ **Security concern.** A `password` column in an application table conflicts with §3.3.2C, which states passwords are hashed by Supabase Auth using bcrypt. Supabase Auth stores credentials in `auth.users`; the application profile table must not hold a password column. For an Information Security FYP this discrepancy is worth correcting explicitly and, ideally, discussing in the thesis.

> The report also names "personal information" in profile setup without enumerating fields (M-02).

### E2 — `riasec_results` `[ERD]`
`user_id` (FK), `realistic_score`, `investigative_score`, `artistic_score`, `social_score`, `enterprising_score`, `conventional_score`, `completed_at`.

> The ERD shows **no `holland_code` column**, yet §3.4.1 and §4.2.2 both state the Holland Code is saved. Either add the column or derive it. See M-09.

### E3 — `academic_results` `[ERD]`
`user_id` (FK), `exam_type`, `subject`, `grade`.

> One row per subject per examination. No PK visible.

### E4 — `scholarships` `[ERD]`
`scholarship_id` (PK), `scholar_name`, `provider`, `deadline`, `link`, `description`.

> Missing relative to FR09/FR10/crawler: `funding_amount`, `eligibility_criteria`, `field_of_study`, `education_level`, `status`, `scholarship_type`, `last_scraped_at`, `source_url`.

### E5 — `courses` `[ERD]`
`course_name`, `field_of_study`, `university`, `duration`, `qualifications` (entry requirements).

### E6 — `careers` / professions `[ERD — likely merged with E5 in extraction]`
`required_skills`, `pathway`. Needed by FR07 and FR11.

### E7 — `saved_items` `[ERD]`
`user_id` (FK), `scholarship_id` (FK), `saved_at`.

> Only scholarships. §3.3.3A and Sprint 6 say students can bookmark **courses or scholarships** — the ERD supports scholarships only. See M-09.

### E8 — `messages` `[ERD]`
`user_id` (FK), `sender`, `message`, `chat_time`.

### E9 — `crawl_logs` `[ERD]`
`execution_time`, `records_updated`, `status`, `error_message`, `duration`.

## 12.2 TECHNICALLY NECESSARY (required for stated FRs, absent from the ERD)

| Entity | Required by | Why |
| --- | --- | --- |
| `recommendations` | FR-REC-11, §2.6.3, §4.2.2 postcondition | "recommendation records" are stated as stored; the dashboard shows "top recommendations"; the chatbot receives them as context |
| `subject_strengths` | FR-ACAD-07 | "This subject strength profile is saved to the database" (§3.4.2) |
| `riasec_responses` | FR-RIASEC-04 | Item-level responses; needed to recompute or audit scores. *Possibly* avoidable if only aggregates are stored |
| `universities` | §3.3.2C names `universities` as a shared table | Currently only a text field on `courses` |
| `application_tracking` | FR-DASH-03 | "update their application status over time" (Sprint 6) |
| `career_riasec_profiles` | FR-REC-12 | "Each career pathway stored within the system is assigned a predefined RIASEC profile" (§2.6.4) |
| `scholarship_criteria` | FR-SCH-06 | Machine-checkable eligibility conditions; a free-text column cannot produce a checklist |
| `crawler_sources` | FR-CRAWL-01 | "a predefined list of public Malaysian educational websites" |
| Primary keys on E2, E3, E7, E8, E9 | Data integrity | None visible in the ERD |

## 12.3 OPTIONAL

| Entity | Rationale |
| --- | --- |
| `career_pathway_stages` | Only if FR11 is built as specified; roadmap structure is undefined (M-08) |
| `activity_log` | Supports the Figure 4.10 recent-activity feed |
| `riasec_interpretations` | Interpretation text could equally live in the server-side config file |
| `course_comparisons` | The comparison tool is likely client-side state only |

## 12.3b Security entities **[ADDED — NOT IN REPORT]**

| Entity | Attributes | Required by |
| --- | --- | --- |
| `audit_log` | `id`, `actor_user_id`, `action`, `target_table`, `target_id`, `timestamp`, `metadata` | FR-SEC-09, NFR09. RLS must permit insert and select, and deny update and delete |
| `rate_limit_events` | `id`, `identifier` (email/IP/user_id), `endpoint`, `attempt_count`, `window_start` | FR-SEC-01 to FR-SEC-04. May instead be held in an edge KV store rather than PostgreSQL |
| `consent_records` | `user_id`, `policy_version`, `consented_at` | FR-SEC-10, NFR05 |

Additionally: **remove the `password` column from E1** (R-02) and add a **NOT NULL `user_id` foreign key plus an RLS policy on every user-owned table** (NFR08).

## 12.4 Relationships

```
users 1 ──── 0..1 riasec_results
users 1 ──── 0..* academic_results
users 1 ──── 0..* subject_strengths
users 1 ──── 0..* recommendations
users 1 ──── 0..* saved_items
users 1 ──── 0..* messages
users 1 ──── 0..* application_tracking

scholarships 1 ──── 0..* saved_items
scholarships 1 ──── 0..* scholarship_criteria

universities 1 ──── 0..* courses
careers   * ──── * courses            (pathway association)
careers   1 ──── 1  career_riasec_profiles

crawler_sources 1 ──── 0..* crawl_logs
```

## 12.5 Constraints implied by the report

- `email` UNIQUE (FR-AUTH-01 checks "the email is not already registered").
- Every student-owned table needs `user_id` NOT NULL + FK + an RLS policy on it (§3.3.2C).
- `riasec_results`: one active row per user (retake overwrites — FR-RIASEC-09).
- Scholarship upsert requires a natural key or unique constraint (FR-CRAWL-04) — **key NOT SPECIFIED**.
- `role` should be constrained to an enumerated set — values **NOT SPECIFIED**.
- All schema changes via Supabase CLI migrations (§3.4.1).

---

# 13. SECURITY REQUIREMENTS

## 13.1 EXPLICIT SECURITY REQUIREMENTS

Every item below is stated in §3.3.2C, NFR01, Table 3.5 or the §4.2.3 security use case.

### Authentication
| # | Requirement |
| --- | --- |
| S-01 | Supabase Auth manages identity |
| S-02 | Passwords hashed with bcrypt via Supabase Auth; plaintext passwords never stored |
| S-03 | Accounts created in an unverified state; no usable session issued until email is confirmed |
| S-04 | 6-digit email OTP issued and validated by Supabase Auth's built-in mechanism, not a custom code generator |
| S-05 | Verification codes expire after a fixed 10-minute window |
| S-06 | Codes are invalidated immediately once consumed, preventing reuse or delayed guessing |
| S-07 | Password minimum requirements enforced with inline validation |

### Session management
| # | Requirement |
| --- | --- |
| S-08 | Sessions managed using JSON Web Tokens |
| S-09 | Tokens stored **in memory or secure HTTP-only cookies**, explicitly **not in localStorage**, which is stated as vulnerable to XSS |

### Authorization & access control
| # | Requirement |
| --- | --- |
| S-10 | Row-Level Security policies applied to **all** tables in the PostgreSQL database |
| S-11 | Each policy written in PostgreSQL native policy syntax |
| S-12 | A student can only read or modify data tied to their own authenticated identity |
| S-13 | Shared tables (courses, universities, scholarships): read-only public access |
| S-14 | All write operations on shared tables restricted to authenticated admin only |
| S-15 | Admin-level write operations restricted to users holding the administrator role |
| S-16 | Protected routes enforced client-side; unauthenticated users redirected to login |

### Secret management
| # | Requirement |
| --- | --- |
| S-17 | API keys for Gemini and any scraped sources stored **exclusively** as server-side environment variables in the Edge Function runtime |
| S-18 | API keys never included in the frontend JavaScript bundle |
| S-19 | Vercel environment variables store keys and configuration outside the codebase |
| S-20 | Deno Edge runtime does not expose server-side code or credentials to the client |

### Business logic protection
| # | Requirement |
| --- | --- |
| S-21 | The recommendation rule base is stored in server-side configuration files, not embedded in client code, to protect it from inspection or manipulation |
| S-22 | The RIASEC question bank is likewise stored server-side |
| S-23 | No sensitive operation is ever performed client-side |

### Input validation
| # | Requirement |
| --- | --- |
| S-24 | Input validation applied on **both** the client side and the server side to prevent injection attacks |
| S-25 | User input validated and sanitised to reduce the risk of malicious or invalid data being processed |

### Transport
| # | Requirement |
| --- | --- |
| S-26 | All data exchanged between frontend and Supabase backend transmitted over HTTPS |
| S-27 | Vercel enforces HTTPS on all connections by default |

### Deployment security
| # | Requirement |
| --- | --- |
| S-28 | GitHub Actions automates deployment with branch protection rules preventing direct pushes to the production branch |

## 13.2 The structural weakness in the current security design

Before listing additions, name the problem plainly, because it shapes everything below.

Every one of S-01 through S-28 is a control **Supabase, Vercel or GitHub provides**. You selected a Backend-as-a-Service and inherited its defaults. Bcrypt hashing, JWT issuance, RLS enforcement, TLS termination, OTP generation, secret storage — none of these is your engineering. Table 3.5 currently reads as a vendor feature list.

Two consequences for marking:

1. **No security engineering is demonstrated.** Enabling a platform feature is a configuration decision, not a design decision. There is no threat model justifying *why* these controls and not others, and no analysis of what they fail to cover.
2. **No assurance is demonstrated.** "Assurance" means evidence that controls work as claimed. The report asserts that RLS protects all tables and never verifies it. There is no test that attempts a violation, no scan, no residual risk statement.

The additions in §13.3–13.7 address both. They are chosen to be small to build and substantial to write about.

## 13.3 THREE OWNED SECURITY PROBLEMS **[ADDED — NOT IN REPORT]**

These are vulnerabilities arising from *your* architecture, not the platform's. Each is demonstrable, fixable and re-testable — which is the shape of evidence a security thesis needs.

### V-01 — Indirect prompt injection via the crawler → chatbot path

**This is the strongest security contribution available in your design, and I would build the security half of your thesis around it.**

Your architecture already contains this data flow:

```
Untrusted third-party website
  → crawler: Axios fetch + Cheerio extraction        (§2.6.6)
  → scholarships table                               (§3.4.3 Sprint 6)
  → chatbot context assembly                         (§2.6.5: "scholarship listings")
  → Gemini prompt
  → student
```

Attacker-controllable text reaches an LLM prompt with no sanitisation boundary. A scholarship description containing instruction-like text — directing the model to misreport eligibility, emit an off-platform link, or disclose the system prompt — may be followed. This is OWASP LLM01 (Prompt Injection), indirect variant.

It is strong FYP material because it is specific to Nexus, currently unmitigated, demonstrable with a controlled proof-of-concept, and fixable with measures you implement and then re-test. It gives you a clean before/after evidence narrative that no amount of platform configuration can provide.

**Mitigations:** FR-SEC-06 (sanitise at ingestion), FR-SEC-07 (structural instruction/data separation with explicit untrusted-data delimiters), FR-SEC-08 (output link allowlisting), plus minimising which scraped fields enter the prompt at all.

**Evidence plan:** host a controlled test page containing an injected payload; run the crawler against it; query the chatbot; capture the compromised response; apply mitigations; re-run; capture the safe response. Both screenshots go in Chapter 5.

> ⚠ Keep the PoC entirely within your own test fixture. Do not inject payloads into real scholarship provider websites, and note that constraint in the thesis — examiners reward stated ethical boundaries.

### V-02 — RLS bypass through service-role Edge Functions

Supabase Edge Functions commonly authenticate with the `service_role` key, which **bypasses every RLS policy**. If your chatbot or recommendation function uses it, S-10 through S-12 have a hole: a function-level flaw — an IDOR on a `user_id` parameter, for instance — would let one student's context be assembled from another student's records, and RLS would not intervene.

This is Conflict C-16 restated as a vulnerability class. Writing it up as *an architectural risk I identified, quantified and mitigated by propagating the caller's JWT into the Edge Function's database client* demonstrates that you understand why RLS works, not merely that you enabled it.

**Mitigation:** FR-SEC-05. Where a service role is genuinely unavoidable (the scheduled crawler has no calling user), document why, and scope its permissions to the specific tables it needs.

**Evidence plan:** two test cases — Student A calling the chatbot function with Student B's `user_id`, before and after the fix.

### V-03 — OTP brute force

S-04 through S-06 specify a 6-digit code, a 10-minute window and single use. There is **no attempt limiting anywhere in the report**. The keyspace is 10⁶ and the window is 600 seconds.

Do the arithmetic explicitly in the thesis: at *r* requests per second against an unthrottled endpoint, expected attempts to success is 5×10⁵, so the window is sufficient whenever *r* exceeds roughly 833/s — trivially achievable from a single host. Quantified risk reads far better than "we added rate limiting."

**Mitigation:** FR-SEC-02 (per-code attempt cap), FR-SEC-03 (per-email and per-IP request throttling).

**Evidence plan:** scripted attempt loop against your own staging endpoint, before and after. Measure attempts-until-block.

## 13.4 SUPPORTING HARDENING CONTROLS **[ADDED — NOT IN REPORT]**

| # | Control | Addresses | Effort |
| --- | --- | --- | --- |
| R-01 | Login rate limiting and lockout with exponential backoff | FR-SEC-01; credential stuffing | Low |
| R-02 | Remove the `password` column from the application users table | Contradicts your own §3.3.2C; an examiner will spot it | Trivial |
| R-03 | CSRF protection if HTTP-only cookies are used for sessions | S-09 permits cookies; cookie sessions need it | Low |
| R-04 | Content-Security-Policy and security response headers | FR-SEC-14; the report names XSS only in the localStorage context | Low |
| R-05 | Server-side schema validation on every Edge Function input | S-24 claims server-side validation; make it concrete and testable | Medium |
| R-06 | Audit log table with RLS preventing update and delete | FR-SEC-09, NFR09 | Low |
| R-07 | Controlled admin bootstrap; no self-service admin path | M-14, FR-SEC-13 | Low |
| R-08 | Dependency vulnerability scanning in the existing GitHub Actions pipeline | Complements S-28; produces a screenshot for Chapter 5 | Trivial |
| R-09 | Crawler politeness: robots.txt compliance, rate limiting, identifying User-Agent | Legal and ethical exposure the report does not address at all | Low |
| R-10 | Secret rotation procedure documented for the Gemini key | Operational security; currently no lifecycle stated | Trivial |

## 13.5 THREAT MODEL **[ADDED — NOT IN REPORT]**

Produce a data flow diagram with trust boundaries drawn on it. Your three-tier architecture diagram (§3.3.2B) already exists — add boundaries between: browser ↔ Vercel, Vercel ↔ Supabase, Edge Function ↔ Gemini, crawler ↔ external websites. The crawler boundary is the important one and is currently invisible.

Then apply STRIDE per element. A worked subset:

| Element | Threat | STRIDE | Existing control | Gap |
| --- | --- | --- | --- | --- |
| Login endpoint | Credential stuffing | Spoofing | S-02, S-07 | No rate limiting → R-01 |
| OTP verification | Code brute force | Spoofing | S-05, S-06 | No attempt cap → V-03 |
| JWT session | Token theft via XSS | Spoofing | S-09 (no localStorage) | No CSP → R-04 |
| Student data tables | Cross-user read | Information disclosure | S-10, S-12 | Service-role bypass → V-02 |
| Edge Function inputs | Injection via unvalidated parameters | Tampering | S-24 | Unspecified server-side schema → R-05 |
| Crawler ingestion | Malicious content in scraped fields | Tampering | *none* | → FR-SEC-06 |
| Gemini prompt | Indirect prompt injection | Tampering, Information disclosure | *none* | → V-01 |
| Chatbot output | Phishing link injection into a trusted UI | Tampering | *none* | → FR-SEC-08 |
| Admin writes | Unauthorised or unattributable data change | Repudiation, Elevation | S-14, S-15 | No audit trail → R-06 |
| Role assignment | Privilege escalation to admin | Elevation | *none* | → FR-SEC-13 |
| Rule base / question bank | Business logic disclosure | Information disclosure | S-21, S-22 | Adequately covered |
| Gemini API key | Credential exfiltration | Information disclosure | S-17, S-18, S-20 | No rotation procedure → R-10 |
| Chatbot endpoint | Cost exhaustion through request flooding | Denial of service | *none* | → FR-SEC-04 |
| Scholarship data | Stale or poisoned records shown as authoritative | Tampering | FR-CRAWL-03 (validation, unspecified) | Validation rules undefined → M-12 |

## 13.6 RISK REGISTER **[ADDED — NOT IN REPORT]**

Likelihood and impact on a 1–5 scale; risk = L × I. Residual is post-control. Tune the numbers to your own judgement — the point is that the reasoning is visible.

| ID | Asset | Threat | L | I | Risk | Control | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RR-01 | Student academic records | Cross-user disclosure via service-role bypass | 3 | 5 | 15 | FR-SEC-05, RLS test suite | 4 |
| RR-02 | Chatbot integrity | Indirect prompt injection from scraped content | 4 | 4 | 16 | FR-SEC-06/07/08 | 6 |
| RR-03 | User accounts | OTP brute force → account takeover | 3 | 5 | 15 | FR-SEC-02, FR-SEC-03 | 3 |
| RR-04 | User accounts | Credential stuffing | 3 | 4 | 12 | FR-SEC-01, S-02 | 4 |
| RR-05 | Gemini API key | Exfiltration and abuse | 2 | 4 | 8 | S-17, S-18, S-20, R-10 | 2 |
| RR-06 | Session tokens | Theft via XSS | 2 | 5 | 10 | S-09, R-04 | 4 |
| RR-07 | Reference data | Unauthorised or unattributable admin modification | 2 | 3 | 6 | S-14, S-15, FR-SEC-09 | 2 |
| RR-08 | Platform availability | Chatbot cost exhaustion | 3 | 3 | 9 | FR-SEC-04 | 3 |
| RR-09 | Student personal data | Unlawful retention; no deletion path | 4 | 4 | 16 | FR-SEC-10/11/12, NFR05 | 4 |
| RR-10 | Privilege model | Escalation to administrator | 2 | 5 | 10 | FR-SEC-13, S-15 | 3 |
| RR-11 | Scholarship data | Poisoned records presented as authoritative | 3 | 3 | 9 | FR-SEC-06, FR-CRAWL-03 | 4 |
| RR-12 | Legal position | Scraping without permission | 3 | 3 | 9 | R-09 | 4 |

RR-02 and RR-09 carry the highest inherent risk. That is a useful finding to state, because RR-02 is your signature technical contribution and RR-09 is your compliance contribution.

## 13.7 ASSURANCE EVIDENCE PLAN **[ADDED — NOT IN REPORT]**

"Assurance" in your degree title means this section. Everything here produces an artefact you can put in Chapter 5.

### A-01 — Automated RLS test suite **(highest value per hour)**

Authenticate as Student A. For every user-owned table, attempt to read, update and delete rows belonging to Student B. Assert failure in all cases. Repeat for anonymous access. Repeat for a student attempting writes on shared tables.

Roughly 150 lines. Output is a pass/fail table that goes straight into Chapter 5 as your primary assurance evidence. Right now you assert RLS works; this proves it.

### A-02 — OWASP Top 10 (2021) self-assessment

Assess your own system honestly against all ten categories, including what you did *not* mitigate. Stating an unmitigated risk with a reason marks better than an unconvincing claim of full coverage.

### A-03 — Automated scan

OWASP ZAP baseline scan against your Vercel deployment. Free, an afternoon's work, produces a report. Include the findings and your triage of them.

### A-04 — Penetration test cases

Manual, scoped to your own system: IDOR attempts against Edge Function parameters, JWT tampering, RLS bypass attempts, the OTP brute-force script, the prompt injection PoC. Document method, result and mitigation for each.

### A-05 — Security requirements traceability matrix

| Threat | Control | Requirement ID | Test case | Evidence |
| --- | --- | --- | --- | --- |
| … | … | S-xx / FR-SEC-xx | A-0x-nn | Screenshot / log |

This single table is the clearest demonstration of "assurance" available to you. It ties Chapter 3's design to Chapter 5's results.

### A-06 — Residual risk statement

What remains unmitigated and why. Honest limitations mark well.

## 13.8 PDPA 2010 COMPLIANCE **[ADDED — NOT IN REPORT]**

You are a Malaysian student, building for Malaysian students, collecting names, emails, education level, academic grades, career aspirations and chat logs from people who may be under 18. The report contains **no privacy provision whatsoever**. This is the most exposed gap in the document for this degree, and closing it is close to free marks.

Map the seven PDPA principles onto design decisions:

| Principle | Design response in Nexus |
| --- | --- |
| **General** (consent) | FR-SEC-10: privacy notice and explicit consent captured at registration, with version and timestamp |
| **Notice and choice** | Privacy notice page stating what is collected, why, retention period, and third-party disclosure to Google (Gemini) |
| **Disclosure** | Data disclosed only to Gemini, and only the bounded context payload defined in FR-CHAT-05. State this explicitly — it is also the argument for resolving C-16 toward the bounded design |
| **Security** | S-01 to S-28 plus §13.3–13.4 |
| **Retention** | Stated retention period; FR-SEC-11 deletion; crawler data is not personal data |
| **Data integrity** | NFR08 |
| **Access** | FR-SEC-12 export; profile editing (FR04); FR-SEC-11 deletion |

Add a short paragraph on **minors**: acknowledge that SPM leavers may be 17, state what you do about it (minimise collection, no financial data, no third-party sharing beyond the AI provider), and note parental consent as a limitation you did not implement. Naming a limitation you consciously accepted is stronger than silence.

> This also resolves Conflict C-11b cleanly: **drop "financial background" from scholarship matching**. It has no collection point, no ERD field, and collecting household income from minors is the single worst privacy decision available to you. Removing it simplifies the system and strengthens the privacy chapter.

---

# 14. COMPLETE PAGE INVENTORY

| # | Page | Role | Purpose | Required functionality | Required data | Navigation |
| --- | --- | --- | --- | --- | --- | --- |
| P-01 | Landing | Guest | Introduce the platform; drive registration | Hero, feature overview, how-it-works, FAQ accordion, footer | Static | → P-02, P-03 |
| P-02 | Register | Guest | Create an account | Form (name, email, password), inline validation, duplicate-email error | — | → P-04 |
| P-03 | Login | Guest | Authenticate | Form, "Remember me", "Forgot Password?" link | — | → P-11 or P-05 |
| P-04 | Email Verification | Unverified | Enter the 6-digit code | Code input, resend, expiry error | Issued code | → P-05 |
| P-05 | Profile Setup (wizard) | Student | Capture profile | Multi-step form, per-step validation | Profile, academic results | → P-11 |
| P-06 | Find Your Path (hub) | Student | Entry point for the two advisory tools | Two cards: RIASEC Assessment, Academic Analysis; "View Path Recommendation" | Completion state | → P-07, P-08, P-10 |
| P-07 | RIASEC Assessment | Student | Take the 36-item inventory | Item display, response capture, progress, previous, submit guard | Question bank | → P-09 |
| P-08 | Academic Analysis | Student | Enter and review academic performance | Grade entry, subject card grid, results timeline, trend chart, summary | Academic results, strength profile | → P-07 or P-10 |
| P-09 | Assessment Analysis & Results | Student | Show RIASEC outcome | Radar chart, Holland Code, personality descriptions, strength profile panel, performance trends | RIASEC results, strength profile | → P-10 |
| P-10 | Recommendations | Student | Show ranked careers and courses | Explanation panel, career cards with match %, course cards with reasons, suggested educational path, links to pathways | Recommendations, courses, careers | → P-12, P-13 |
| P-11 | Dashboard | Student | Consolidated overview | Profile completion, Holland Code, saved count, upcoming deadlines, course recommendations, matching career fields, recent activity, quick actions | Aggregate | → all |
| P-12 | Career Pathways (search) | Student | Find a profession | Search/browse professions | Careers | → P-13 |
| P-13 | Career Pathway (detail) | Student | Roadmap for one profession | Overview, skills, staged roadmap, market data, programme list, scholarships | Career, courses, scholarships | → P-14, P-15 |
| P-14 | Scholarships (list) | Student | Browse and filter | Filter sidebar, "Recommended For You", result cards with deadline flags, pagination | Scholarships, match results | → P-15 |
| P-15 | Scholarship (detail) | Student | Full scholarship information | Overview, benefits, eligibility checklist, "how to improve eligibility", application timeline, external link, save | Scholarship, criteria, profile | → external |
| P-16 | Saved Items / Applications | Student | Manage bookmarks and track applications | List, status update, remove | Saved items, tracking | → P-15 |
| P-17 | Profile / Settings | Student | Edit profile and academic results | Edit forms, logout | Profile | → P-11 |
| P-18 | Admin — Scholarships | Admin | Manage scholarship records | Table, create, edit, correct | Scholarships | → P-20 |
| P-19 | Admin — Courses | Admin | Manage course records | Table, create, edit, correct | Courses | → P-20 |
| P-20 | Admin — Crawler Monitor | Admin | Monitor and control the scraper | Run log table, manual trigger button | Crawl logs | → P-18 |
| P-21 | Below-375px notice | Any | Recommend a supported device | Static notice | — | — |
| P-22 | Password reset | Guest | `INFERRED` from the mockup link only | Not specified | — | — |
| — | AI Chatbot | Student | Global overlay, **not a page** | Floating button + side panel, available on every authenticated page | Profile summary, last 10 turns | — |

**Pages with report mockups:** P-01 (Fig 4.2), P-02/P-03/P-05 (Fig 4.3), P-14/P-15 (Figs 4.4, 4.5), P-06 (Fig 4.5), P-07 (Fig 4.6), P-08 (Fig 4.7), P-09/P-10 (Figs 4.8), P-13 (Fig 4.9), P-11 (Fig 4.10).

**Pages with no mockup:** P-04, P-12, P-16, P-17, P-18, P-19, P-20, P-21, P-22.

---

# 15. USER JOURNEYS

## J1 — New student
Landing → Register (name, email, password) → account created unverified, 6-digit code emailed → Verification screen → enter code within 10 minutes → account verified → redirected to Profile Setup → Step 1 personal information → Step 2 education level → Step 3 academic grades across up to three examinations → Step 4 career goals → profile saved to profiles + academic results → Dashboard.

*Exception branches:* duplicate email → error; weak password → inline validation; network failure → retry prompt; code expired → error + request new code.

## J2 — Existing student
Landing → Login → JWT session issued → Dashboard showing profile completion, Holland Code, saved scholarships, upcoming deadlines, course recommendations, recent activity → navigate to any module.

*If already logged in and hitting Register:* redirect to Dashboard.

## J3 — Completing Find Your Path
Dashboard → Find Your Path hub → choose RIASEC Assessment → 36 items presented, progress shown → respond to every item (submission blocked while any remain unanswered) → Submit → six dimension scores computed → top three form the Holland Code → saved → Results page with radar chart plus written descriptions of dominant types, suitable career fields, suitable academic areas.

*Parallel branch:* Find Your Path hub → Academic Analysis → enter grades per examination → subjects classified Strong/Average/Weak → card grid with label, average grade, examination count → written summary of top fields and weak areas → trend chart → strength profile saved.

*Retake:* previous RIASEC results are overwritten.

## J4 — Receiving recommendations
Precondition: logged in, RIASEC complete, academic results recorded.
Find Your Path → "View Path Recommendation" → system retrieves Holland Code, subject strength profile, career goals → evaluates every rule in the JSON rule base → computes a match score per rule from conditions satisfied → returns a ranked list → displays cards showing suitable career type, course name, university, pathway type, entry requirements and the reasons each was suggested.

*Alternative:* student updates academic results or retakes RIASEC → recommendations recalculated.
*Exception:* no rules match → message encouraging the student to complete or update their RIASEC assessment and academic results.

## J5 — Searching scholarships
Dashboard or navbar → Scholarships → "Recommended For You" block plus full list → apply filters (field of study, provider, academic level) → deadline flags rendered (red ≤7 days, amber ≤30 days) → load more → open a scholarship → detail page with overview, benefits, timeline → external application link.

## J6 — Checking eligibility
Scholarship detail → Eligibility Check panel → system compares profile against the scholarship's rule-based criteria → checklist renders each condition as satisfied or unsatisfied → "How to improve eligibility?" guidance → optionally save to bookmarks → optionally track application status.

## J7 — Using the chatbot
Any authenticated page → floating button, bottom-right → side panel opens with conversation history and input field → suggested prompts displayed → student types a question or taps a quick-reply → Edge Function receives inquiry + last ten turns + profile summary (Holland Code, top recommendations) → system prompt applied (Malaysian educational advisor; English or BM per input; Malaysian education focus) → Gemini responds → answer streams token by token into the panel.

*Exceptions:* Gemini unavailable → "The assistant is temporarily unavailable. Please try again shortly."; network failure → connection error with retry.

## J8 — Administrator
Login with an administrator role → Admin panel → **Scholarship management:** review records, manually enter or correct entries → **Course management:** same → **Crawler monitor:** review the run log (records updated, execution time, status, errors), trigger a manual refresh when data looks stale, review entries the crawler flagged as outdated and remove or retain them.

> The admin authentication path (shared login with role redirect, or a separate route) is **NOT SPECIFIED IN REPORT**.

---

# 16. REQUIREMENT CONFLICTS

Fifteen substantive conflicts, ordered by implementation risk. I am not resolving any of them — each needs your decision, and several need your supervisor's.

---

### C-01 — Target user scope: SPM-only vs six education levels
**Conflicting text.** RO1 and RQ1: "after completing their **SPM** examinations." §1.5.1 and §4.1.1: "SPM, STPM, STAM, Matriculation, Diploma or Foundation."
**Conflict.** The research objectives the thesis will be assessed against are narrower than the system's stated user base.
**Impact.** Determines the profile education-level enumeration, the reference data you must gather, and what UAT must cover.
**Clarify.** Either widen RO1/RQ1 to match §1.5.1, or narrow §1.5.1 to SPM leavers. The former is easier — RO1 is a literature-review objective and rewording it costs nothing.

---

### C-02 — Education level values
**Conflicting text.** §1.5.1 lists six levels. Figure 4.3 offers three: **SPM / Foundation / University**.
**Conflict.** The mockup omits STPM, STAM, Matriculation and Diploma, and adds "University", which is not in §1.5.1 at all.
**Impact.** Directly sets the `education_level` enumeration, which gates Academic Analysis (FR-ACAD-01) and drives Career Pathways roadmap start points (FR-PATH-03).
**Clarify.** Fix the canonical enumeration before Sprint 2. Decide whether "University" (an existing undergraduate) is a supported user at all.

---

### C-03 — Career Pathways: headline feature or omitted module?
**Conflicting text.** Present in: Abstract ("four core modules... **Career Pathways**"), §1.1, §1.5.2, §1.7, FR11, Figure 4.9, §5.2.2. Absent from: **Table 4.1** (the definitive function-and-feature list), §3.6's module summary, all six sprint descriptions, the ERD, and the use case tables.
**Conflict.** A module with an FR ID and a UI mockup has no development slot, no data model and no place in the function list.
**Impact.** Severe. FR11 is the *only* requirement serving the "students with clear goals" half of the two-path design in §1.1. Dropping it halves the system's premise; keeping it means designing an entire module (professions data, roadmap stage model, skills, programme mapping) with zero specification.
**Clarify.** This is the single most important decision in the document. Either (a) commit to Career Pathways, specify it fully, and allocate sprint time — or (b) formally descope it and amend the Abstract, §1.1, §1.5.2, §1.7, §5.2.2 and FR11.

---

### C-04 — RIASEC answer format: three-way vs binary vs five-point
**Conflicting text.** §3.4.1: "like, feel neutral about, or dislike" (3 options). §4.2.2 step 4: "selecting either from Strongly Like or Strongly Dislike" (reads as 2). Figure 4.6: five radio options.
**Conflict.** Three incompatible instrument designs.
**Impact.** Sets the per-item point values, the dimension score range (e.g. 0–6 vs 6–30), and therefore every numeric threshold in the rule base. Cannot write the scoring function without resolving this.
**Clarify.** Pick one and propagate. The five-point scale in the mockup is the most defensible psychometrically and gives the rule base more resolution.

### C-04b — Skip vs mandatory completion
**Conflicting text.** §4.2.2 exception path: "System highlights unanswered items and **prevents submission**." Figure 4.6: a **"Skip Question"** button.
**Conflict.** Mutually exclusive.
**Impact.** If skipping is allowed, the scoring function needs a missing-data rule (which the report does not provide), and dimensions become non-comparable when they have unequal item counts.
**Clarify.** Recommend removing the Skip control and keeping the mandatory-completion rule, since it has requirement backing and the mockup does not.

---

### C-05 — Academic Analysis excludes five of six target user groups
**Conflicting text.** §1.5.1/§4.1.1 name six groups as primary users. FR06 and §4.1.3 restrict Academic Analysis to post-secondary school students, on the stated basis that pre-university grading is not standardised. The recommendation use case precondition requires "academic results recorded in their profile."
**Conflict.** STPM, STAM, matriculation, diploma and foundation students are invited in but cannot satisfy the precondition for the system's core output.
**Impact.** Severe and cross-cutting. Either (a) those students never get recommendations, (b) the engine must degrade to RIASEC-only, contradicting the two-layer model in §2.3.3 and §2.6.4, or (c) the user base narrows to SPM leavers.
**Clarify.** Decide the degraded-mode behaviour explicitly. Note that a documented RIASEC-only fallback path is a legitimate and defensible design — but it must be *specified*, not improvised, and it needs its own rule-matching semantics.

---

### C-06 — Profile wizard: two steps or four?
**Conflicting text.** §3.4.1 Sprint 2: "four stages — personal information, education level, academic grades, career goals." FR03: four areas. Figure 4.3: "**STEP 1 OF 2**", combining education level and career interest on one screen.
**Impact.** Minor, but affects validation checkpoints and where academic grade entry lives (the mockup's two-step flow has no room for it — possibly it was moved to the Academic Analysis page).
**Clarify.** Confirm whether grade entry happens during onboarding or on P-08.

---

### C-07 — Examination periods: three or four?
**Conflicting text.** "up to three examination periods" (§3.4.1, §4.1.3), "three different examination periods" (§3.3.3A), "multiple examination" (FR06, §3.4.2), versus four named examples in §1.7 (Form 4, Form 5, Trial SPM, actual SPM) and §2.5.2.
**Impact.** Determines the exam_type enumeration and the grade-entry UI column count. Figure 4.7 shows three columns, supporting the "three" reading — but then §1.7's four-item list is simply wrong and should be corrected in the thesis.
**Clarify.** Fix the number and the exact enumeration of period names.

### C-07b — Strong/Average/Weak: average or consistency?
**Conflicting text.** FR06: "based on **consistency** of performance." §3.4.2 Sprint 3: "based on the **average** of the student's scores."
**Impact.** Different algorithms producing different classifications for the same data. Also inconsistent with §2.3.3 and §2.5.2, which emphasise "consistent strength" and "determining students' consistency."
**Clarify.** A defensible resolution is a two-factor rule (average determines the band, variance flags inconsistency) — but the report does not say this, and inventing it would be exactly what your brief forbids. Get it specified.

---

### C-08 — Chatbot history: session-scoped or persisted?
**Conflicting text.** §4.2.2 postcondition: "Conversation history is retained during the **active session**." ERD: a `messages` table with `chat_time`. §2.6.3: the database stores "chatbot interactions."
**Impact.** Determines whether a `messages` table exists, whether it needs an RLS policy, and whether it falls under data-retention obligations. Persisted student conversations are personal data.
**Clarify.** Also decide retention period if persisted — relevant to R-11.

---

### C-09 — Is scholarship browsing public?
**Conflicting text.** §3.3.2C: shared tables including scholarships have "read-only **public** access". Figure 4.2's landing page shows a "Scholarships" nav item to an unauthenticated visitor. But no use case describes guest scholarship browsing, and §3.3.3D gates "the dashboard and the RIASEC assessment" only.
**Impact.** Affects route protection, RLS policy for anonymous role, and the conversion funnel.
**Clarify.** Recommend allowing public browse but requiring login for eligibility matching, since matching needs a profile.

### C-09b — Scholarship filter set
**Conflicting text.** FR09: field of study, provider, academic level. §1.7: education level, field of study, provider. §1.5.2: courses, institutions, **budget**. Figure 4.4: Education Level, Field of Study, **Scholarship Type**.
**Impact.** Determines required scholarship columns and index design. "Budget" has no supporting data field anywhere.
**Clarify.** Take FR09 as canonical and drop "budget" and "scholarship type" unless you add the columns.

---

### C-10 — Does the crawler collect course data?
**Conflicting text.** FR15: "a web scraper that retrieves and updates **scholarship** data." §3.4.3 Sprint 6: "retrieve **scholarship** data." Versus §1.5.4: "details like **courses, fee structure and entry requirements**"; §2.6.6: "**programme names**, fields of study, admission requirements, scholarship eligibility criteria..."; §3.3.3C: "visits a set list of **scholarship and course** websites."
**Impact.** Roughly doubles crawler scope. Course data structure differs substantially from scholarship data.
**Clarify.** FR15 is the requirement statement and is scholarship-only. Recommend confirming that and having admins seed course data manually — it is far more tractable for an FYP.

### C-10b — Crawler technology: Python or JavaScript?
**Conflicting text.** §1.5.3: "custom automated data acquisition engine utilizing **Python**-based web crawling tools." §2.6.6: "**JavaScript**-based web scraping... **Axios**... **Cheerio**... executed through **Supabase Edge Functions**." Table 3.4 lists no Python.
**Impact.** Supabase Edge Functions run Deno (TypeScript/JavaScript). Python cannot run there. §1.5.3 appears to be a stale early draft.
**Clarify.** Correct §1.5.3 in the thesis. The JavaScript answer is the only architecturally coherent one.

---

### C-11 — Scholarship "confidence score"
**Conflicting text.** §3.3.4: "the scholarship eligibility calculator will be tested... to confirm that **confidence scores** and checklists are calculated accurately." Nowhere else in the document.
**Conflict.** A test target exists for an output that is never specified. FR10 mentions only a checklist; §3.4.2 mentions ranking "according to suitability and eligibility."
**Impact.** You cannot write the unit test described in §3.3.4 without defining this.
**Clarify.** Either define a confidence/eligibility score formula, or remove the term from §3.3.4 and test the checklist and ranking instead.

### C-11b — "Financial background" is never collected
**Conflicting text.** §3.4.2: scholarships are filtered against "the student's demographic details, academic results, field of interest, and **financial background**." Profile setup (§3.4.1, FR03) captures personal information, education level, academic grades and career goals — no financial data. The ERD has no income field.
**Impact.** A documented matching input has no source. Also a privacy consideration: collecting household income from minors raises PDPA questions the report does not address.
**Clarify.** Either add the field (and the privacy handling), or remove it from the matching criteria.

---

### C-12 — Chatbot 2-second response requirement vs streaming
**Conflicting text.** NFR02c: "The chatbot must deliver its response within **2 seconds**." §3.4.3: "The response **streams back to the browser token by token**."
**Conflict.** "Deliver its response" is undefined against a streaming architecture — first token, or complete response? A complete Gemini response through an Edge Function within 2s is not reliably achievable.
**Impact.** An untestable or unachievable NFR is a liability in the testing chapter.
**Clarify.** Restate as time-to-first-token (2s is reasonable) and state a separate, looser target for full completion.

---

### C-13 — NFR count and numbering
**Conflicting text.** §3.6: "Fourteen functional requirements and **eight** non-functional requirements were identified." Table 3.1 contains **fifteen** FRs (FR01–FR15). Table 3.2 contains **six** NFRs, skipping **NFR05** and stopping at NFR07.
**Impact.** Documentation defect. An examiner will notice.
**Clarify.** Correct the count to fifteen FRs. Decide whether NFR05 was lost (accessibility? privacy? data integrity? — all three are absent) and whether two further NFRs are missing to reach eight.

---

### C-14 — Recommendation architecture: sequential three-stage vs single rule base
**Conflicting text.** §2.6.4 describes careers matched via per-career predefined RIASEC profiles, *then* programmes matched via academic strengths against programme requirements, *then* scholarships. §3.4.2 describes one JSON rule base whose rules combine RIASEC + subject + interest conditions and emit courses directly.
**Impact.** Fundamental. The first requires career-RIASEC and programme-requirement data structures; the second requires one config file. They imply different entities, different match-score semantics, and different explanations on the recommendation card.
**Clarify.** Resolve before database design. Note that a hybrid is possible (rule base for courses, career-RIASEC profiles for careers) — Table 3.1's split between FR07 (career) and FR08 (course) may hint at this — but the report does not say so.

---

### C-15 — Gemini's role in scholarship data parsing
**Conflicting text.** §1.5.3: "Nexus integrates Generative AI APIs specifically Gemini API to handle natural language processing for interactive chatbot **and interpreting unstructured scholarship data**." §2.6.6 assigns all extraction to Cheerio. Table 3.4 scopes Gemini to "AI-powered chatbot and intelligent advisory services."
**Impact.** Using an LLM to convert scraped free-text eligibility criteria into structured, machine-checkable conditions would actually solve M-07 elegantly — but it is unbudgeted, unspecified, and introduces prompt-injection exposure from scraped content (R-04).
**Clarify.** Decide deliberately. If yes, specify it properly and treat it as a security topic in the thesis. If no, correct §1.5.3.

---

### C-16 — Chatbot data access: bounded context vs whole-database
**Conflicting text.** §3.4.3 Sprint 5: the Edge Function receives "the inquiry along with the last ten turns of the conversation and a **summary of the student's profile**, including their Holland Code and top recommendations." §2.6.5: the chatbot "is integrated with the Nexus database and recommendation engine. This allows it to **access** relevant information such as RIASEC assessment results, academic profiles, programme data, and scholarship listings."
**Impact.** Direct security consequence. A chatbot function holding broad database access typically runs under a service-role key that **bypasses RLS**, undermining S-10 through S-12. The bounded-payload design does not.
**Clarify.** Specify exactly which fields enter the prompt and confirm the function queries under the caller's JWT, not a service role. This is a strong thesis discussion point for an ISA project.

---

### C-17 — Thesis title inconsistency
**Conflicting text.** Cover page and §5: "Nexus: **Intelligent Educational and Career** Advisory System." §1.6: "Nexus: **Scholarship and Career** Advisory System."
**Impact.** Cosmetic but visible.

### C-18 — Gantt chart dates
**Conflicting text.** §1.6: "over a period of 10 months starting from April 2026 and ending in **January 2027**... The final stage is documentation and project presentation in **January of 2026**."
**Impact.** Cosmetic; correct to January 2027.

---

# 17. MISSING INFORMATION

| ID | Missing item | Needed for | Priority |
| --- | --- | --- | --- |
| M-01 | Password reset flow — trigger, token, expiry, UI | FR-AUTH-11; the mockup already advertises it | **IMPORTANT** |
| M-02 | Exact "personal information" fields collected at profile setup (name? DOB? IC? phone? state? school?) | Database schema; PDPA exposure assessment | **CRITICAL** |
| M-03 | Privacy policy, consent capture, retention period, account deletion, data export | PDPA 2010 compliance; ISA thesis credibility | **CRITICAL** |
| M-04 | RIASEC per-response point values, aggregation formula, score range, tie-breaking rule for the Holland Code | FR-RIASEC-04/05; blocks Sprint 2 | **CRITICAL** |
| M-05 | Subject list (fixed/admin-managed/free-text), grade scale enumeration, grade-to-numeric mapping, Strong/Average/Weak thresholds, missing-subject handling | FR-ACAD-02/03; blocks Sprint 3 | **CRITICAL** |
| M-06 | Match score formula, whether conditions are weighted, minimum display threshold, result count, tie-breaking, and how a score becomes the "92% Match" shown in Figure 4.10 | FR-REC-04/05/13; blocks Sprint 4 | **CRITICAL** |
| M-07 | Eligibility criteria encoding — how scraped free text becomes machine-checkable conditions; the criterion type taxonomy (citizenship, CGPA, level, field, age, income...) | FR-SCH-05/06; blocks the eligibility checklist entirely | **CRITICAL** |
| M-08 | Career Pathways: profession data model, roadmap stage structure, how a roadmap is assembled from a start education level, source of "required skills" | FR11/FR-PATH-01–05 | **CRITICAL** (if C-03 resolves toward keeping the module) |
| M-09 | Complete scholarship schema: funding amount, eligibility criteria, field of study, education level, status, source URL, last-scraped timestamp; plus the missing `holland_code` column and course bookmarking in `saved_items` | FR-SCH-*, FR-DASH-02 | **CRITICAL** |
| M-10 | The 36 RIASEC items themselves, and the interpretation text for Holland Codes | FR-RIASEC-01/08 | **CRITICAL** |
| M-11 | Chatbot guardrails — refusal behaviour, disclaimers, prohibition on inventing recommendations, handling of off-topic questions, prompt-injection defence | FR-CHAT-06/10; §10.7 | **IMPORTANT** |
| M-12 | Crawler source list, upsert match key, validation rules, staleness criteria, failure/retry policy, robots.txt and ToS position | FR-CRAWL-01/03/04/05 | **IMPORTANT** |
| M-13 | What "monitor system activities" means concretely | FR-ADMIN-07 | **IMPORTANT** |
| M-14 | Admin bootstrap — how the first admin account is created and how the role claim is set and protected; whether admins can view student data | FR-ADMIN-01; security posture | **CRITICAL** |
| M-15 | Rule base JSON schema — rule shape, condition operators, output shape, reason-string generation | FR-REC-03/07/10 | **CRITICAL** |
| M-16 | Course/university reference data source and initial seed volume | FR-REC-06; recommendations are empty without courses | **CRITICAL** |
| M-17 | Session duration, refresh token behaviour, "Remember me for 30 days" semantics | S-08/S-09; the mockup advertises 30 days | **IMPORTANT** |
| M-18 | Application tracking status values and lifecycle | FR-DASH-03 | **IMPORTANT** |
| M-19 | Comparison tool scope — how many courses, which attributes | FR-DASH-04 | **OPTIONAL** |
| M-20 | Recent-activity event taxonomy | FR-DASH-06 | **OPTIONAL** |
| M-21 | Empty-state and loading behaviour across all pages | NFR03/NFR04 | **IMPORTANT** |
| M-22 | Accessibility target (WCAG level, contrast, keyboard nav) | Absent NFR | **IMPORTANT** |
| M-23 | UAT participant count, questionnaire instrument, success criteria | RO3; §5.2.3 | **IMPORTANT** |
| M-24 | "Export Profile" behaviour shown in Figure 4.7 | FR-ACAD-09 | **OPTIONAL** |
| M-25 | Market data source for Figure 4.9 salary ranges and industry share | FR-PATH-06 | **OPTIONAL** |
| M-26 | Rate limiting and lockout policy | R-01/R-02 | **IMPORTANT** |

---

# 18. SCOPE CONTROL

## MUST IMPLEMENT

Each item carries an FR ID in Table 3.1 or is a hard prerequisite for one.

1. Registration with email + password; account created unverified (FR01)
2. 6-digit email OTP, 10-minute expiry, single-use; no session until verified (FR01, NFR01)
3. JWT login, logout, session management, protected routes (FR02)
4. Multi-step profile setup with per-step validation (FR03)
5. Profile, academic results and career goal editing (FR04)
6. 36-item RIASEC assessment: scoring, Holland Code, radar chart, written interpretation, retake (FR05)
7. Academic Analysis: grade entry, Strong/Average/Weak classification, subject card grid, written summary (FR06)
8. Knowledge-based career recommendation from JSON rule base, ranked (FR07)
9. Knowledge-based course recommendation from JSON rule base, ranked, with transparent reasons (FR08)
10. Scholarship browse and filter by field of study, provider, academic level (FR09)
11. Rule-based scholarship matching with satisfied/unsatisfied eligibility checklist (FR10)
12. Career Pathways: profession search, description, skills, roadmap, programmes, scholarships (FR11) — **subject to resolving C-03**
13. AI chatbot via Edge Function with profile context, bilingual, error handling (FR12)
14. User dashboard aggregating RIASEC results, top recommendations, saved scholarships (FR13)
15. Admin panel: role-gated, manual record entry/correction, crawl log view, manual trigger (FR14)
16. Weekly scheduled scholarship scraper with upsert and logging (FR15)
17. All explicit security controls S-01 through S-28
18. Responsive layout at 375px and 1280px (NFR06)
19. Server-side configuration files for the question bank and rule base (NFR07)
20. Deadline flagging: red ≤7 days, amber ≤30 days
21. Seed data: courses, universities, careers with RIASEC profiles, and a starting scholarship set

**Security additions — now MUST, not SHOULD [ADDED]:**

22. Rate limiting and lockout on login, registration, OTP verify and chatbot endpoints (FR-SEC-01 to FR-SEC-04)
23. JWT propagation into Edge Functions; eliminate service-role use wherever a calling user exists (FR-SEC-05)
24. Crawler output sanitisation before database insert (FR-SEC-06)
25. Prompt hardening with instruction/data separation in the chatbot Edge Function (FR-SEC-07)
26. Audit log for admin writes, role changes and manual scraper triggers (FR-SEC-09)
27. Privacy notice, consent capture, account deletion (FR-SEC-10, FR-SEC-11)
28. Controlled admin role assignment with no self-service path (FR-SEC-13)
29. Security response headers including CSP (FR-SEC-14)
30. Remove the `password` column from the users table (R-02)
31. **Automated RLS test suite** (A-01) — this is a deliverable, not a nice-to-have. It is your primary assurance evidence
32. Threat model, risk register and traceability matrix as thesis artefacts (§13.5, §13.6, A-05)

## SHOULD IMPLEMENT

Described in the report but without FR backing; drop these first under time pressure.

1. Saved items / bookmarking (Sprint 6)
2. Application status tracking (Sprint 6)
3. Course comparison tool (§3.3.3A)
4. Academic performance line charts (§2.6.2, §3.3.3A)
5. Chatbot suggested prompts and FAQ quick-replies (§3.4.3)
6. Token-by-token streaming (§3.4.3) — a fallback to non-streaming is acceptable
7. Profile completion percentage (Figure 4.10)
8. Recent activity feed (Figure 4.10)
9. Scholarship keyword search (§1.7)
10. "How to improve eligibility?" guidance (Figure 4.5)
11. Scholarship list pagination (Figure 4.4)
12. Below-375px device notice (§4.2.3)
13. Password reset (M-01)
14. Rate limiting on auth and chatbot endpoints (R-01) — *promote to MUST if your supervisor expects security depth commensurate with the ISA programme*
15. Crawler staleness flagging and admin review queue (FR-ADMIN-06)
16. Application timeline display on scholarship detail (Figure 4.5)

## SHOULD NOT IMPLEMENT

Not required, and each would materially expand scope.

1. **Any ML or adaptive recommendation** — explicitly excluded by §4.1.3
2. **Gemini-generated recommendations** — would contradict the knowledge-based architecture and undermine RO3 testing
3. **RIASEC congruence, consistency and distinction indices** — named once in §2.3.3, never specified, and incompatible with the overwrite-on-retake rule
4. **Application submission or portal integration** — explicitly out of scope (§4.1.3)
5. **Mandarin or Tamil chatbot support** — explicitly out of scope (§4.1.3)
6. **Academic analysis for STPM/STAM/matriculation/diploma/foundation** — explicitly out of scope (§4.1.3), pending C-05
7. **Admin UI for editing the rule base or question bank** — contradicts the §3.3.2C rationale for keeping them server-side and uninspectable
8. **Admin access to student profiles, RIASEC results or chat logs** — never granted; unnecessary; expands the breach surface
9. **Market data panel** (salary ranges, industry share, mentors) from Figure 4.9 — no data source, no FR
10. **"Export Profile"** from Figure 4.7 — no specification
11. **Course scraping** — FR15 covers scholarships only; admin seeding is sufficient
12. **Counsellor or institution user roles** — only two actors exist
13. **Notifications** (email or push deadline alerts) — nothing in the report requires them; the dashboard covers deadline awareness
14. **Social features** — reviews, ratings, forums, sharing. §2.6.4 explicitly rejects popularity-based signals
15. **Multi-institution or international expansion** — §1.5.1 limits scope to Malaysia and MQA-accredited programmes
16. **Mobile native app** — the report specifies a responsive web application
17. **Payment or premium tiers**

---

# NEXUS REQUIREMENTS SUMMARY

Nexus is a responsive React single-page web application, backed by Supabase (PostgreSQL, Auth, Edge Functions) and deployed on Vercel, that gives Malaysian post-examination students personalised educational and career guidance through a **deterministic, rule-based** decision-support pipeline. Students register, verify by email OTP, and build a profile of personal details, education level, subject grades and career goals. They then take a 36-item RIASEC interest inventory yielding six dimension scores and a three-letter Holland Code, and — if they are post-secondary school students — record grades across up to three examination periods, which the system classifies per subject as Strong, Average or Weak. A knowledge-based rule engine, driven by a **server-side JSON rule base**, evaluates the Holland Code, subject strength profile and stated interests, scores each rule by conditions satisfied, and returns ranked career fields and courses with a transparent list of reasons for each. Students browse and filter a scholarship database, kept current by a weekly Edge-Function web scraper and correctable by administrators, and receive rule-based eligibility matching that shows exactly which conditions they satisfy and which they do not, with deadlines flagged red inside seven days and amber inside thirty. A Gemini-powered chatbot, invoked only through an Edge Function so its API key never reaches the client, answers questions in English or Bahasa Malaysia using a bounded profile context, explains recommendations and assists navigation — but does **not** generate recommendations. Administrators manage scholarship and course records, review crawler run logs and trigger manual refreshes. Every table is protected by Row-Level Security so a student reaches only their own data.

**1. System scope** — §1.5–1.7 above. Guidance only: no applications, no ML, no guarantees, Malaysia and MQA-accredited programmes only, English and Bahasa Malaysia only.

**2. Actors** — Guest `INFERRED`, Unverified Student `INFERRED`, Student, Administrator. The scraper and Gemini are services, not actors.

**3. Modules** — M1 User Management, M2 Find Your Path (container), M3 RIASEC Assessment, M4 Academic Analysis, M5 Recommendation Engine, M6 Scholarship Discovery, M7 Career Pathways *(pending C-03)*, M8 AI Chatbot, M9 Administration & Data Acquisition.

**4. Functional requirements** — 15 report FRs decomposed into 85 implementable requirements across §3.1–3.11, each traced to source and marked `INFERRED` where not explicitly stated.

**5. Non-functional requirements** — 14 stated sub-requirements across security, performance, reliability, usability, responsiveness and maintainability, plus seven design-derived constraints. Accessibility, privacy, data integrity, availability, scalability and auditability are **absent from the report**.

**6. Recommendation logic** — Knowledge-based and rule-based, not AI-generated, not hybrid. Inputs: Holland Code, subject strength profile, career goals. Processing: evaluate every rule in a server-side JSON rule base; score by conditions satisfied; rank descending. Outputs: ranked career fields and courses with course name, university, pathway type, entry requirements and reasons. Recalculated on input change. **Every numeric detail — point values, weights, thresholds, tie-breaks — is unspecified.**

**7. Database entities** — Explicitly required (from the ERD): users, riasec_results, academic_results, scholarships, courses, careers, saved_items, messages, crawl_logs. Technically necessary but absent: recommendations, subject_strengths, riasec_responses, universities, application_tracking, career_riasec_profiles, scholarship_criteria, crawler_sources, plus primary keys on five entities. Optional: career_pathway_stages, activity_log, riasec_interpretations.

**8. Pages** — 22 pages (P-01 to P-22) plus a global chatbot overlay. Ten have mockups; nine — including all three admin pages — do not.

**9. User flows** — J1 to J8 in §15.

**10. Security requirements** — 28 explicit controls (S-01 to S-28) covering authentication, sessions, RLS, secret management, business-logic protection, input validation, transport and deployment — all of them inherited platform features rather than engineered defences. Revision 2 adds: 14 security functional requirements (FR-SEC-01 to FR-SEC-14); 3 new NFRs covering privacy, data integrity and auditability; three owned vulnerabilities with proof-of-concept and mitigation plans (V-01 indirect prompt injection via the crawler→chatbot path, V-02 service-role RLS bypass, V-03 OTP brute force); 10 supporting hardening controls; a STRIDE threat model over 14 elements; a 12-entry risk register; a six-part assurance evidence plan; and a PDPA 2010 mapping. V-01 is the strongest available contribution and should anchor the security half of the thesis.

**11. Ambiguities** — 18 conflicts (C-01 to C-18). The three that block architectural design are **C-03** (is Career Pathways in or out?), **C-05** (five of six user groups cannot use Academic Analysis, yet recommendations require it), and **C-14** (two incompatible recommendation architectures). **C-04** blocks Sprint 2 and **C-07b** blocks Sprint 3.

**12. Missing information** — 26 gaps (M-01 to M-26); eleven CRITICAL. The four that will stall implementation soonest are the RIASEC scoring formula (M-04), the grade-to-strength rules (M-05), the match-score formula (M-06) and the eligibility-criteria encoding (M-07).

**13. Scope** — 21 MUST, 16 SHOULD, 17 SHOULD NOT, per §18.

---

## Recommended next actions before architectural design

1. **Resolve C-03, C-05 and C-14 with your supervisor.** These three change the entity model, not just the implementation. Nothing downstream is stable until they are settled.
2. **Specify M-04, M-05, M-06 and M-07.** These are the four formulas the system runs on. All four are currently blank, and each blocks a specific sprint.
3. **Correct the documentation defects** — C-13 (FR/NFR counts and the missing NFR05), C-17 (title), C-18 (Gantt dates), C-10b (Python vs JavaScript). Cheap to fix, and each is visible to an examiner.
4. **Add the missing NFR categories** — privacy, data integrity and auditability (§4.3). For an Information Security and Assurance thesis, the absence of any privacy or PDPA requirement is the most exposed gap in the document, and it is also the easiest to turn into a strength.

---

# 19. THESIS CHANGE MAP **[ADDED — REVISION 2]**

Where in the report each addition goes. Ordered by chapter. Effort is writing time, not development time.

## Chapter 1 — Introduction

| Location | Change | Effort |
| --- | --- | --- |
| §1.3 Research Objectives | **Add RO4:** "To evaluate the security posture of the developed system through threat modelling, control implementation and verification testing." Without this, security work has no objective to be assessed against — and Chapter 5 is organised by objective, so security currently has nowhere to report results | 15 min |
| §1.4 Research Questions | **Add RQ4** mirroring RO4: "How effectively does the implemented security design mitigate the threats identified for the system?" | 10 min |
| §1.5.2 System Functionalities | Add a sixth item: security and privacy controls as a first-class system capability | 15 min |
| §1.5.3 System Technicalities | **Correct** "Python-based web crawling tools" → JavaScript/Axios/Cheerio (C-10b). Also reconsider the Gemini "interpreting unstructured scholarship data" claim (C-15) | 10 min |
| §1.5.5 Limitations | Add the security scope boundary: what you tested, what you did not (e.g. no formal penetration test by a third party, no parental consent mechanism) | 20 min |
| §1.6 Gantt | **Correct** "January of 2026" → 2027 (C-18). Add a security testing activity to M6 | 10 min |
| §1.7 Expected Outputs | Add a fifth output: security and privacy assurance artefacts | 15 min |

## Chapter 2 — Literature Review

| Location | Change | Effort |
| --- | --- | --- |
| **New §2.6.8** *Security Considerations in AI-Integrated Educational Systems* | The single biggest structural gap. Chapter 2 currently contains **no security literature at all** for a security degree. Cover: OWASP Top 10 (2021); OWASP Top 10 for LLM Applications (2025), particularly LLM01 prompt injection and LLM06 sensitive information disclosure; Row-Level Security and the BaaS shared-responsibility model; PDPA 2010; prior work on securing student data in educational platforms. Aim for 4–6 pages | 2–3 days |
| §2.4–2.5 Platform review | Add a **security/privacy dimension** to the comparison. None of UniEnrol, Afterschool.my or Schola is evaluated on data protection. Adding one row to Table 2.1 and a paragraph each strengthens your gap analysis and justifies RO4 | Half a day |
| §2.5.2 Gap Analysis | Add a fourth gap: existing platforms handle sensitive student data without documented protection. This is what makes your security work a *contribution* rather than an add-on | 1 hour |

## Chapter 3 — Methodology

| Location | Change | Effort |
| --- | --- | --- |
| §3.3.1B Requirement Gathering | Add a fifth method: **threat modelling** (STRIDE) as a requirements-elicitation technique. This is how FR-SEC-01 to FR-SEC-14 were derived — say so, or they look arbitrary | 1 hour |
| §3.3.2C Security and Privacy Design | **Restructure substantially.** Currently three bullet lists of platform features. Reframe as: (a) trust boundaries and data flow, (b) threat model summary, (c) controls mapped to threats, (d) residual risks. Move the DFD-with-boundaries here. This is the section where the "vendor feature list" impression is currently created | 2 days |
| **New §3.3.2D** *Threat Model* | The full STRIDE table (§13.5) plus the annotated DFD | 1 day |
| **New §3.3.2E** *Risk Register* | The 12-entry register (§13.6) | Half a day |
| §3.3.4 Test | Add a **fourth testing level: security testing**. Currently you have unit, integration and functional. Describe the RLS test suite, the penetration test cases and the automated scan. Also **remove or define** the undefined "confidence scores" reference (C-11) | 1 day |
| §3.4 Table 3.1 | **Add FR16–FR29** from §3.12. Correct the FR count claim | Half a day |
| §3.4 Table 3.2 | **Fill NFR05** with Privacy; **add NFR08** Data Integrity and **NFR09** Auditability (§4.3). This makes §3.6's "eight non-functional requirements" true (C-13) | 2 hours |
| §3.4.1 Sprint 1 | Add: audit log table, rate limiting infrastructure, RLS test suite scaffolding | 1 hour |
| §3.4.3 Sprint 6 | Add: crawler sanitisation, prompt hardening, security scan, penetration test cases | 1 hour |
| §3.5.3 Table 3.5 | **Expand.** Add OWASP ZAP, dependency scanning, the rate limiter, and your test tooling. Retitle the column "Application in Nexus" to distinguish platform-provided from self-implemented — the distinction is what earns marks | 2 hours |
| §3.6 Conclusion | Correct FR/NFR counts; add a paragraph on the security methodology | 30 min |

## Chapter 4 — Design and Analysis

| Location | Change | Effort |
| --- | --- | --- |
| §4.1.1A Users | Note the privilege separation rationale: administrators have no access to student advisory data. Currently implicit | 30 min |
| §4.1.3 Project Scope | State the security scope explicitly, and the PDPA position | 1 hour |
| §4.2.1 Figure 4.1 Use Case | Add security use cases: verify email, delete account, admin audit. Consider a misuse-case diagram — cheap to draw, distinctive, and directly demonstrates security thinking | Half a day |
| §4.2.2 Use case tables | Add tables for the FR-SEC requirements, at minimum: account deletion, admin audit, rate-limited authentication | 1 day |
| §4.2.3 NFR use cases | Add use case tables for NFR05, NFR08, NFR09 | Half a day |
| §4.2.4 User Interfaces | Add mockups for: privacy notice and consent at registration, account deletion confirmation, admin audit log view. Also **P-22 password reset**, which your Figure 4.3 already advertises but never specifies (M-01) | 1 day |
| §4.2.5 Figure 4.11 ERD | **Remove the `password` column** (R-02). **Add** `audit_log`, `consent_records`, and the missing fields from §12.2 and §12.3b. Add `holland_code` to the RIASEC entity. Draw all foreign keys explicitly | 1 day |
| **New §4.2.6** *Security Architecture* | Annotated DFD with trust boundaries; control placement; the RLS policy model; the Edge Function authentication model (JWT vs service role, and why) | 1–2 days |

## Chapter 5 — Expected Result

| Location | Change | Effort |
| --- | --- | --- |
| **New §5.2.4** *Research Objective 4* | Expected outputs for the security objective: threat model, implemented controls, RLS test results, penetration test findings, OWASP assessment, residual risk statement | Half a day |
| §5.2.3 RO3 | Add security testing to the evaluation methods | 1 hour |
| §5.3 Summary | Reflect the security outcomes | 30 min |

## New appendices

| Appendix | Content |
| --- | --- |
| A | Security requirements traceability matrix (A-05) |
| B | RLS test suite results table |
| C | OWASP Top 10 (2021) self-assessment |
| D | Penetration test cases and results, including the V-01 prompt injection PoC |
| E | Privacy notice / PDPA compliance statement |

## If you only do four things

Ranked by marks per hour:

1. **§3.3.2C restructure + new §3.3.2D threat model + §3.3.2E risk register.** Pure writing, no code. Retrospectively justifies every control you already have and removes the "vendor feature list" impression. *~3 days.*
2. **New §2.6.8 security literature review.** Chapter 2 having zero security sources in a security degree is the most visible structural weakness in the document. *~3 days.*
3. **The RLS test suite (A-01) + its results appendix.** Small code, high evidential value. Converts an assertion into assurance. *~1 day.*
4. **RO4 + RQ4 + §5.2.4.** Fifteen minutes of editing that gives all the security work a formal home in the assessment structure. Without it, examiners have no rubric slot to award security marks against. *~1 day including Chapter 5.*

The V-01 prompt injection study is the highest-ceiling item — it is what makes the project distinctive rather than merely compliant — but it depends on the chatbot and crawler both working, so schedule it in Sprint 6 and treat it as an upside rather than a dependency.

> **A scheduling caution.** Do not let security scope creep consume build time. A partially working Nexus with an excellent security chapter will mark worse than a complete Nexus with a good one. The controls above were chosen to be small to implement; the analysis is where the effort belongs.
