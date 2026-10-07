# NEXUS — UI/UX DESIGN SPECIFICATION

**Version:** 1.0
**Depends on:** `NEXUS_Requirements_Analysis.md` (Rev 2), `NEXUS_Technical_Specification.md` (v1.0)
**Audience:** frontend implementer / Claude Code
**Constraint:** every screen here implements a documented requirement. Nothing decorative was added that carries no function.

---

## 0. DESIGN DIRECTION

### 0.1 What this product actually is

A seventeen-year-old has just finished SPM. They are being told, by a website, what to do with the next four years of their life. They have no counsellor. Their parents may not have gone to university. They are deciding whether to apply for a scholarship worth more than their family's annual income.

That is the design problem. Not "an education dashboard." The register is closer to a **public institution** than a consumer app — the visual language of a well-made government service or a university handbook, not a SaaS product. Confident, legible, unhurried, and honest about what it does not know.

Two design consequences follow directly:

1. **Every recommendation must show its reasoning on the same screen as the recommendation.** The report requires this (§3.4.2, "a transparent list of reasons"). Design-wise it means a recommendation card is never just a title and a score — the *why* is primary content, not a disclosure toggle.
2. **Uncertainty is displayed, not hidden.** Degraded-mode recommendations, unverifiable eligibility criteria, AI-generated chat responses. Each gets a visible, designed treatment rather than a suppressed one. A system that overstates its confidence to a student making an irreversible decision is doing harm, however good it looks.

### 0.2 Structural concept: the pathway line

Malaysian post-secondary education is literally a branching route map — SPM feeds STPM, matriculation, foundation or diploma, which feed degree programmes. The system's own name is Nexus.

So the one structural device used throughout is a **route line**: a vertical rule with stage markers, used *only* where content is genuinely sequential — the profile wizard, assessment progress, career roadmaps, scholarship application timelines. Numbered stage markers appear in these places because the content really is a sequence.

It is not used on dashboards, lists or grids. A structural device that appears everywhere stops encoding anything.

### 0.3 Palette

The report specifies "a professional and clean appearance suitable for an educational platform with a combination warm colour palette" (§3.3.2A). Warm is the brief. But the default warm palette — cream background, terracotta accent — is the single most recognisable generated-design signature right now, so the warmth is taken somewhere else: a pale oat ground, umber-brown text instead of tinted black, deep pine green for action, and amber reserved almost entirely for opportunity and deadline states.

```
--ink-900   #241F1A   Primary text. Warm umber-black, NOT #111 or #0B0B0B
--ink-700   #4A423A   Secondary text
--ink-500   #7A6F63   Tertiary text, placeholders
--ink-300   #C4B9AC   Borders, dividers
--ink-100   #E8E1D7   Subtle fills, table stripes
--paper     #FAF7F2   Page background. Warm, low-chroma oat
--surface   #FFFFFF   Cards, inputs, panels

--pine-700  #1F4438   Primary action, active nav, focus ring
--pine-500  #2F6A55   Hover
--pine-100  #DCE8E2   Selected backgrounds, subtle success fill

--amber-600 #B26B00   Opportunity, warning deadline (30 days)
--amber-100 #FBEDD6   Warning fill

--rust-600  #A33A22   Critical deadline (7 days), destructive, error
--rust-100  #F8E2DC   Error fill

--slate-600 #4B5A66   Neutral informational, "cannot verify" state
--slate-100 #E3E8EC   Neutral fill
```

**RIASEC dimension colours.** Six dimensions need distinguishable, non-semantic colours for the radar chart and dimension badges. These do not carry meaning beyond identity, and are chosen to remain distinguishable in the most common colour-vision deficiencies:

```
R Realistic      #6B7F3E   olive
I Investigative  #2F6A55   pine
A Artistic       #8A4B7D   plum
S Social         #B26B00   amber
E Enterprising   #A33A22   rust
C Conventional   #4B5A66   slate
```

Never rely on these alone — every dimension is always labelled with its letter and name.

### 0.4 Typography

```
Headings:  'Source Serif 4', Georgia, serif
Body/UI:   'IBM Plex Sans', system-ui, sans-serif
```

A serif for headings and a sans for interface is the register of educational publishing and public institutions, which is the trust signal this product needs. Source Serif 4 and IBM Plex Sans are both open-licensed, both have wide weight ranges, both have excellent screen legibility at small sizes, and neither reads as a startup default the way Inter does.

IBM Plex Sans has tabular figures — use `font-variant-numeric: tabular-nums` on all grades, scores, dates and counts so columns align.

**No monospace anywhere.** Monospace for small data labels is a generated-design tell and there is no code in this interface.

```
Type scale (1.25 ratio, 16px base)

display   36 / 1.15   Source Serif 4  600   page titles only, one per page
h1        30 / 1.2    Source Serif 4  600
h2        24 / 1.25   Source Serif 4  600   section headings
h3        20 / 1.3    IBM Plex Sans   600   card titles — sans, for density
h4        16 / 1.4    IBM Plex Sans   600
body      16 / 1.6    IBM Plex Sans   400   default
body-sm   14 / 1.55   IBM Plex Sans   400   secondary, metadata
caption   13 / 1.45   IBM Plex Sans   500   labels, badges, table headers
```

Prose line length capped at **68 characters**. Headings are sentence case throughout — no all-caps labels, no tracked-out eyebrows above headings.

### 0.5 Spacing, radius, elevation

4px base scale: `4 8 12 16 24 32 48 64 96`.

**Radius is tiered, not uniform.** Uniform radius on every element is the SaaS-card signature and it flattens hierarchy.

```
--r-input   3px    inputs, selects, textareas — near-square reads precise
--r-card    8px    cards, panels
--r-modal   12px   modals, chat panel — larger surfaces, softer
--r-pill    999px  badges, chips, avatars only
```

**Borders separate; shadows only lift.** Cards use `1px solid var(--ink-300)` and no shadow. Shadow appears only on things that float above the page:

```
--shadow-overlay  0 4px 16px rgba(36,31,26,0.10)   dropdowns, popovers
--shadow-panel    0 8px 32px rgba(36,31,26,0.14)   chat panel, modals
```

Identical soft shadows under every card is the other half of the SaaS-card signature. Avoid it.

### 0.6 Motion

Two transitions only: `120ms ease-out` for hover and focus, `200ms ease-out` for panel and modal entry. No scroll-triggered reveals. No staggered card entrances. The single orchestrated moment in the product is the **RIASEC results reveal** — the radar chart draws its polygon once, over 600ms, when results first load. That is the one place a moment of ceremony is earned. Everything wrapped in `@media (prefers-reduced-motion: reduce)`.

---

# 1. INFORMATION ARCHITECTURE

## 1.1 Sitemap

```
PUBLIC
├── /                        Landing
├── /scholarships            Scholarship list        (public browse)
├── /scholarships/:id        Scholarship detail      (public; checklist gated)
├── /login
├── /register
├── /verify
├── /reset-password
└── /privacy                 Privacy notice

STUDENT  (session + profile complete)
├── /profile-setup           Wizard (session only, pre-profile)
├── /dashboard               Home
├── /find-your-path          Hub
│   ├── /assessment          RIASEC, 36 items
│   ├── /results             RIASEC results
│   └── /academic            Academic analysis
├── /recommendations         Careers + courses
├── /careers                 Career browse/search
├── /careers/:id             Career detail + roadmap
├── /saved                   Saved items + application tracking
└── /profile                 Profile & settings

ADMIN  (role = admin)
├── /admin                   Admin home
├── /admin/scholarships
├── /admin/courses
├── /admin/crawler
└── /admin/audit

GLOBAL
└── Chat panel               Overlay on all student pages
```

## 1.2 Public navigation

Horizontal bar, 64px, `--surface` on `--paper`, 1px bottom border.

```
[Nexus]          Scholarships   Careers   How it works        [Sign in] [Get started]
```

Wordmark left in Source Serif 4 600. Links centre-left. `Sign in` is a tertiary button, `Get started` is primary. No `→` appended to any button label.

## 1.3 Student navigation

**Desktop (≥1024px): persistent left rail, 240px.** A rail rather than a top bar because the student's position in a multi-stage journey should be visible at all times — this is a wayfinding product.

```
┌──────────────────┐
│ Nexus            │
│                  │
│ ▸ Dashboard      │
│                  │
│ FIND YOUR PATH   │  ← group label, caption size, --ink-500,
│ ▸ Overview       │     sentence case, not tracked-out caps
│ ▸ Assessment  ✓  │
│ ▸ Academic    ✓  │
│ ▸ Recommendations│
│                  │
│ ▸ Scholarships   │
│ ▸ Careers        │
│ ▸ Saved       3  │
│                  │
│ ─────────────    │
│ ▸ Profile        │
│ ▸ Sign out       │
└──────────────────┘
```

Completion ticks next to Assessment and Academic are the only progress indicators in the rail. They are real state (from `riasec_results` and `subject_strengths`), not decoration. `Saved` shows a count only when non-zero.

Active item: `--pine-100` fill, `--pine-700` text, 3px left border in `--pine-700`.

## 1.4 Admin navigation

Deliberately **not** the student shell. Different top bar, `--ink-900` background, white text, a persistent `Admin` label. Two reasons: it prevents an admin control ever appearing inside a student view, and it makes the privilege boundary visible to whoever is using it.

```
[Nexus Admin]   Scholarships   Courses   Crawler   Audit log        admin@… ▾
```

## 1.5 Mobile navigation (<768px)

Bottom tab bar, 5 items, 56px, safe-area padded. Bottom rather than a hamburger because these five are used constantly and thumb reach matters on the devices Malaysian students actually use.

```
 Home    Path    Scholarships    Careers    Profile
```

`Saved`, `Sign out` and settings move into `Profile`. The chat launcher sits above the tab bar at bottom-right, offset 72px up so it never overlaps.

## 1.6 Page hierarchy

```
Level 1  Dashboard, Find Your Path, Scholarships, Careers, Saved, Profile
Level 2  Assessment, Results, Academic, Recommendations, Scholarship detail,
         Career detail
Level 3  (none)
```

Three levels maximum. Every Level 2 page has a back link to its Level 1 parent — text link with a left chevron, top-left above the page title, not a floating icon button.

---

# 2. DESIGN SYSTEM

## 2.1 Buttons

Height 40px default, 44px on touch. Horizontal padding 16px. `--r-input`. `font-weight 500`. Label is a verb phrase describing what happens: `Save results`, not `Submit`.

| Variant | Fill | Text | Border | Use |
| --- | --- | --- | --- | --- |
| `primary` | `--pine-700` | white | none | One per view. The main action |
| `secondary` | `--surface` | `--ink-900` | 1px `--ink-300` | Alternative actions |
| `tertiary` | transparent | `--pine-700` | none | Low-emphasis, inline |
| `destructive` | `--surface` | `--rust-600` | 1px `--rust-600` | Delete, remove |
| `link` | none | `--pine-700`, underlined | none | Inline in prose |

States: hover darkens one step; focus shows `2px solid --pine-700` at `2px` offset; disabled drops to 40% opacity with `cursor: not-allowed`; loading replaces the label with a spinner and keeps the button's width so layout does not shift.

Sizes: `sm` 32px, `md` 40px, `lg` 48px (used only for the landing page and wizard advance).

## 2.2 Forms

```
Label          caption, 500, --ink-700, 6px below
Input          40px, --surface, 1px --ink-300, --r-input, 12px padding, body
Focus          border --pine-700 + 3px --pine-100 ring
Error          border --rust-600, message below in --rust-600 body-sm
Hint           --ink-500 body-sm, below label, above input
Disabled       --ink-100 fill, --ink-500 text
```

Rules that matter more than the styling:

- **Validate on blur, never on keystroke.** Validating as a 17-year-old types their email reads as nagging.
- **Never clear entered data on a failed submit.**
- Error text says what to do: *"Enter an email address like name@example.com"*, not *"Invalid email."*
- Required fields marked with the word `Required` in the label row, not an asterisk. Asterisks are unlabelled to screen readers unless you do extra work.
- Every input has a real `<label for>`. No placeholder-as-label anywhere.

## 2.3 Cards

```
--surface, 1px --ink-300, --r-card, 20px padding, no shadow
```

Three variants, differentiated by content structure rather than by adding decoration:

- **`plain`** — content container. No header treatment.
- **`titled`** — h3 title row, optional right-aligned action, 1px `--ink-300` divider below, then body.
- **`stat`** — a single number in display size with a caption label beneath. **Used sparingly.** See §4.2.

Interactive cards (scholarship, course, career) get `cursor: pointer`, a 120ms border darken to `--ink-500` on hover, and a visible focus ring. They are `<article>` elements containing a real link on the title, not `<div onClick>` — keyboard and screen reader users need the link.

## 2.4 Badges

`--r-pill`, caption size, 500 weight, 2px/10px padding.

| Badge | Fill / text | Use |
| --- | --- | --- |
| `neutral` | `--ink-100` / `--ink-700` | Field of study, provider, pathway type |
| `success` | `--pine-100` / `--pine-700` | Strong subject, satisfied criterion |
| `warning` | `--amber-100` / `--amber-600` | Deadline within 30 days |
| `critical` | `--rust-100` / `--rust-600` | Deadline within 7 days, weak subject |
| `info` | `--slate-100` / `--slate-600` | Cannot verify, informational |

Every badge carries text. Colour never carries meaning alone.

## 2.5 Alerts

Full-width block, `--r-card`, 16px padding, 4px left border in the accent colour, tinted fill, icon at 20px.

Four kinds: `info` (slate), `success` (pine), `warning` (amber), `error` (rust).

Alert copy has a bold first sentence stating what happened, then a plain sentence on what to do. Alerts do not apologise.

## 2.6 Charts (Recharts)

Charts are data, not decoration.

**RIASEC radar** — six axes, letter and full name at each. Polygon: `--pine-700` stroke 2px, 15% opacity fill. Grid `--ink-300` at 0.5px. Axis ticks at 0/6/12/18/24. Draws once on first load (§0.6), never re-animates on rerender.

**Academic trend line** — x-axis the three exam periods, y-axis grade points 0–9 labelled with letter grades not numbers (a student thinks in A/B/C). One line per subject, max 6 lines, `--ink-300` dashed reference at the 7.0 Strong threshold. Line colours from a 6-step sequential ramp, each line directly labelled at its right end rather than relying on a legend.

Both charts have an accessible text alternative immediately beneath — for the radar, the six scores as a definition list; for the trend, a compact table. This is not optional: a chart is the primary output of two of the system's modules, and it must be readable without sight.

No pie charts. No donut charts. No gradient fills.

## 2.7 Accessibility baseline

- Body text ≥4.5:1, large text and UI borders ≥3:1. All tokens above meet this on `--paper` and `--surface`.
- Visible focus on every interactive element. Never `outline: none` without a replacement.
- Full keyboard operation. Modal and chat panel trap focus, close on `Esc`, restore focus to the trigger.
- Form errors announced via `aria-live="polite"`; error text linked by `aria-describedby`.
- Chat responses stream into an `aria-live="polite"` region.
- Skip-to-content link as first focusable element.
- Touch targets ≥44×44px.
- Language: `<html lang="en">`, with `lang="ms"` on Bahasa Malaysia chat responses so screen readers pronounce them correctly.

> Build to this floor, but per the requirements analysis, **do not claim WCAG conformance in the thesis** unless you audit and evidence it.

---

# 3. PAGE SPECIFICATIONS

## 3.1 Landing `/` — Public

**Purpose:** explain what Nexus does and who it is for, in under fifteen seconds, then get the student to register.

**Hero.** Not a big number with a gradient. The most characteristic thing in this product's world is *the decision itself*, so the hero is the question the student is actually asking, set large in Source Serif 4, with the two paths beneath it — which is the report's own §1.1 framing.

```
┌────────────────────────────────────────────────────────┐
│  [Nexus]        Scholarships  Careers  How it works    │
│                                    [Sign in] [Get started]
├────────────────────────────────────────────────────────┤
│                                                        │
│   You finished SPM.                                    │
│   What comes next?                                     │
│                                                        │
│   Nexus helps Malaysian students find courses,         │
│   careers and scholarships that fit their interests    │
│   and their results.                                   │
│                                                        │
│   ┌─────────────────────┐  ┌─────────────────────┐    │
│   │ I'm not sure yet    │  │ I know what I want  │    │
│   │ Take the interest   │  │ Search a career and │    │
│   │ assessment and see  │  │ see the exact path  │    │
│   │ what fits you.      │  │ to get there.       │    │
│   │ [Start]             │  │ [Explore careers]   │    │
│   └─────────────────────┘  └─────────────────────┘    │
└────────────────────────────────────────────────────────┘
```

**Below the fold:** How it works (three route-line stages: build your profile → take the assessment → get matched); a live scholarship strip pulling three real records with real deadlines from the database; the FAQ accordion from Figure 4.2; footer with the privacy link.

**States:** the scholarship strip has loading skeletons and hides entirely if the query fails — a failed strip must never block the page.

**Mobile:** the two path cards stack. Hero type drops to 30px. Nav collapses to wordmark + `Sign in`.

## 3.2 Register `/register` — Public

Single column, 400px, centred, vertically offset to 15vh (not centred — centred forms push content below the fold on short viewports).

Fields: Full name · Email · Password (with a live requirements hint, not a strength meter — a hint is actionable, a meter is judgemental) · Consent checkbox linking to `/privacy`.

**Actions:** `Create account` (primary, full width) · `Sign in instead` (link).

**States**
- Loading: button spinner, inputs locked.
- Error — duplicate email: *"An account with this email already exists."* plus a sign-in link. (Report wording, §4.2.2.)
- Error — weak password: inline under the field.
- Error — network: *"Couldn't reach the server. Check your connection and try again."*
- Success: straight to `/verify`, no toast.

**Consent is not pre-ticked and the form cannot submit without it.** This is FR-SEC-10.

**Mobile:** full width, 20px gutters.

## 3.3 Verify email `/verify` — Public

Six separate digit inputs, 48×56px, auto-advancing, paste-aware (pasting a 6-digit code fills all six). A countdown showing time remaining on the code. `Resend code` disabled for 60s after each send.

**States**
- Error — wrong code: *"That code isn't right. 3 attempts remaining."* Digits clear, focus returns to the first.
- Error — expired: *"This code has expired. Request a new one."* with the resend enabled immediately.
- Error — attempts exhausted: *"Too many attempts. Request a new code to continue."*
- Success: redirect to `/profile-setup`.

## 3.4 Profile setup `/profile-setup` — Auth

Four steps on the **route line** — a genuine sequence, so numbered stage markers are correct here.

```
 ●───────○───────○───────○
 About   Level   Results  Goals
 you
```

Desktop: route line horizontal above the form. Mobile: `Step 2 of 4` text plus a 4px progress bar, since four labelled stages will not fit at 375px.

**Step 1 — About you.** Full name (prefilled). That is all. No date of birth, no IC number, no phone, no address. The system does not need them, and this is a minor's data.

**Step 2 — Education level.** Six radio cards: SPM · STPM · STAM · Matriculation · Foundation · Diploma. Each with a one-line description. Selection is a card, not a dropdown — six options with explanations do not belong in a select.

**Step 3 — Your results.** Rendered **only if SPM was selected.** Others see:

> **We'll skip this step.** Nexus analyses results for SPM leavers only, because pre-university grading isn't standardised across programmes. Your recommendations will be based on your interests and goals.

That is an honest statement of Conflict C-05 rather than a silently missing step.

For SPM: `GradeEntryTable` — rows are subjects (add from a searchable list), columns are Form 4 Final / SPM Trial / SPM Actual, cells are grade selects. Empty cells allowed. A running count: *"6 subjects, 14 grades entered."*

**Step 4 — Your goals.** Career goal (free text, 200 char) and target industry (select). Both optional, marked `Optional`.

**Actions:** `Back` (secondary) · `Continue` (primary) · `Save and finish later` (link, from step 2 onward).

**States:** Continue disabled until the step validates. Errors inline. Success → `/dashboard` with a toast: *"Profile saved."*

## 3.5 Find Your Path `/find-your-path` — Student

A hub, matching Figure 4.5. Two large cards, each showing real completion state.

```
┌───────────────────────────┐  ┌───────────────────────────┐
│ Interest assessment       │  │ Academic analysis         │
│                           │  │                           │
│ 36 questions, about 8     │  │ See which subjects you're │
│ minutes. Finds the work   │  │ consistently strong in,   │
│ environments that suit    │  │ across three exam periods.│
│ how you think.            │  │                           │
│                           │  │                           │
│ ✓ Completed 12 Aug        │  │ Not started               │
│ [View results] [Retake]   │  │ [Add your results]        │
└───────────────────────────┘  └───────────────────────────┘

  Both complete → [ See my recommendations ]  (primary, full width)
```

The recommendations button is disabled with an explanatory line until the RIASEC precondition is met — *"Complete the interest assessment first."* Never a disabled control with no explanation.

Non-SPM students see the academic card in an informational state explaining the restriction, and the recommendations button unlocks on RIASEC alone.

**Mobile:** cards stack full width.

## 3.6 Assessment `/find-your-path/assessment` — Student

**Introduction screen first** (not straight into question 1):

> **Before you start**
> 36 short questions about activities you might enjoy. There are no right answers, and this isn't a test of ability — it's about what interests you.
> Takes about 8 minutes. You'll need to answer all 36 before you can see results.
> [Start assessment]

**Question screen.** One question at a time, generously spaced, centred at 560px max.

```
        ────────────────────────────────  33%
        Question 12 of 36

        "I like to work with my hands to
         build or repair things."

        ○ Strongly dislike
        ○ Dislike
        ○ Neutral
        ○ Like
        ○ Strongly like

        [Back]                    [Next]
```

Five radio rows, each a 48px-tall full-width target with the label inside — not a bare radio dot. Selecting auto-advances after 250ms, but `Next` remains available for anyone who prefers explicit control and for keyboard users.

**No Skip control.** Figure 4.6 shows one, but §4.2.2 requires submission to be blocked on unanswered items (Conflict C-04b). The requirement wins; a skip button that leads to a blocked submit is worse than no skip button.

**Progress bar** is 4px, `--pine-700` on `--ink-100`, with the count in text beside it. Bar alone is not accessible.

**Completion.** After question 36: a review screen listing any unanswered items as links, or if complete, `See my results` (primary, lg). On submit, a full-screen state: *"Working out your profile…"* — under 2s in practice.

**Mobile:** identical structure, 20px gutters, `Back`/`Next` become a fixed bottom bar.

**States:** save failure → alert with `Try again`, answers preserved in memory.

## 3.7 RIASEC results `/find-your-path/results` — Student

The one screen that gets a moment of ceremony.

```
┌──────────────────────────────────────────────────────┐
│  Your interest profile                               │
│                                                      │
│      ┌─────────┐    Investigative · Social · Artistic│
│      │  I S A  │                                     │
│      └─────────┘    You're drawn to work that        │
│      Holland Code   involves understanding how       │
│                     things work, helping people,     │
│                     and creating something new.      │
├──────────────────────────────────────────────────────┤
│  [radar chart]           Investigative      21 / 24  │
│                          Social             18 / 24  │
│                          Artistic           16 / 24  │
│                          Enterprising       11 / 24  │
│                          Conventional        9 / 24  │
│                          Realistic           6 / 24  │
├──────────────────────────────────────────────────────┤
│  What this means                                     │
│  [Investigative]  traits · career fields · subjects  │
│  [Social]         traits · career fields · subjects  │
│  [Artistic]       traits · career fields · subjects  │
├──────────────────────────────────────────────────────┤
│  Next: add your SPM results for stronger matches     │
│  [Add academic results]   [See recommendations]      │
└──────────────────────────────────────────────────────┘
```

The Holland Code is set in Source Serif 4 at display size inside a bordered plate — it is the single most identity-carrying output of the whole system and deserves the emphasis.

The score list beside the chart is the chart's text alternative and is always visible, not hidden behind a toggle.

Three description blocks, one per dominant letter, each covering personality traits, suitable career fields and suitable academic areas — exactly what §3.4.1 requires.

**States:** empty (no assessment) → invitation with a `Start assessment` CTA. Loading → skeleton with the chart area reserved so layout does not jump.

**Mobile:** chart above the score list. Description blocks become an accordion, first one open.

## 3.8 Academic analysis `/find-your-path/academic` — Student

Three regions, top to bottom.

**1. Results table** (editable) — subjects × three exam periods. On mobile, one card per subject with three labelled grade fields.

**2. Subject strength grid** — `SubjectCard` per subject:

```
┌──────────────────┐
│ Mathematics      │
│ Strong           │  ← success badge
│ A  ·  3 exams    │  ← average grade, exam count
└──────────────────┘
```

Average grade and exam count are both required by §3.4.2. The exam count matters: it tells the student a `Strong` from one exam is weaker evidence than a `Strong` from three, without the system having to say so.

Grid: 4 columns desktop, 2 tablet, 1 mobile.

**3. Trend chart and summary** — line chart per §2.6, then the written summary of top fields and weaker areas.

**States:** empty → the entry table with a prompt and no grid. Saving → inline *"Saving…"* then *"Saved"*, no toast (in-place edits get in-place confirmation).

**Gated:** non-SPM students see only the explanatory alert from §3.4 step 3.

## 3.9 Recommendations `/recommendations` — Student

**The most important screen in the product.** Its job is not to look impressive; it is to be believable and to show its working.

```
┌─────────────────────────────────────────────────────────┐
│  Your recommendations                    [Regenerate]   │
│  Based on your interest profile (ISA) and your results. │
│  Updated 2 Sept 2026                                    │
├─────────────────────────────────────────────────────────┤
│  Why these suggestions                                  │
│  Your top interests are Investigative, Social and       │
│  Artistic. You're consistently strong in Biology,       │
│  Chemistry and Mathematics. These pathways ask for      │
│  both.                                                  │
├─────────────────────────────────────────────────────────┤
│  Careers                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Pharmacist                        Match  85%    │   │
│  │ Healthcare · Investigative                      │   │
│  │                                                 │   │
│  │ Why this was suggested                          │   │
│  │  ✓ Investigative interests                      │   │
│  │  ✓ Strong in Biology                            │   │
│  │  ✓ Strong in Chemistry                          │   │
│  │  ✗ Interest in health sciences not stated       │   │
│  │                                                 │   │
│  │ [View pathway]                    [Save]        │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│  Courses                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Bachelor of Pharmacy              Match  85%    │   │
│  │ Universiti Sains Malaysia · Degree · 4 years    │   │
│  │ Entry: 5 credits including Biology & Chemistry  │   │
│  │  ✓ Strong in Biology   ✓ Strong in Chemistry    │   │
│  │ [View details]                    [Save]        │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

Design decisions worth defending:

- **Unsatisfied conditions are shown, not hidden.** A card at 85% shows the one condition that failed. This is what makes the transparency claim in §3.4.2 real rather than cosmetic, and it tells the student exactly what to change.
- **Match % is a plain number in tabular figures**, not a progress ring or a gauge. A ring implies precision the rule engine does not have.
- Course cards carry name, university, pathway type, entry requirements and reasons — every field §3.4.2 specifies.

**Degraded mode** (no academic results) shows a persistent info alert above the lists:

> **These are based on your interests only.** You haven't added exam results, so we couldn't check subject strengths. [Add your results]

**States**
- Loading: three skeleton cards per section, 3s budget (NFR02b).
- Empty (no rules matched): *"We couldn't match your profile to any pathways yet. Adding your exam results or retaking the assessment will give us more to work with."* with both CTAs. Report wording, §4.2.2.
- Empty (precondition unmet): names exactly which input is missing.
- Error: alert with `Try again`.

**Mobile:** single column, reason lists always expanded — collapsing the reasoning would defeat the screen's purpose.

## 3.10 Scholarship list `/scholarships` — Public

Two columns desktop: 240px filter rail, then results.

```
┌──────────┬────────────────────────────────────────────┐
│ Filters  │  [Search scholarships          ]           │
│          │  47 scholarships                Sort ▾     │
│ Level    │                                            │
│ □ SPM    │  Recommended for you            [View all] │
│ □ Degree │  ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│          │  │ PETRONAS │ │ Khazanah │ │ JPA PIDN │   │
│ Field    │  │ 5 of 6 ✓ │ │ 4 of 6 ✓ │ │ 6 of 6 ✓ │   │
│ □ Eng    │  │ 12 days  │ │ 30 Sept  │ │ 3 days ▲ │   │
│          │  └──────────┘ └──────────┘ └──────────┘   │
│ Provider │                                            │
│ □ JPA    │  All scholarships                          │
│ □ MARA   │  ┌────────────────────────────────────┐   │
│          │  │ MARA Young Talent                  │   │
│ [Clear]  │  │ MARA · Degree · Engineering        │   │
│          │  │ Closes 15 Oct 2026                 │   │
│          │  │                          [Save]    │   │
│          │  └────────────────────────────────────┘   │
└──────────┴────────────────────────────────────────────┘
```

**Card anatomy.** Name (h3, link) · provider · level and field badges · deadline with urgency treatment · eligibility summary (`5 of 6 requirements met`) for authenticated users only · save button.

**Deadline treatment** — three visual levels, per §3.4.2's exact thresholds:

| Condition | Display |
| --- | --- |
| ≤7 days | `critical` badge, rust: `Closes in 3 days` |
| ≤30 days | `warning` badge, amber: `Closes in 12 days` |
| >30 days | plain text, `--ink-500`: `Closes 15 Oct 2026` |
| No deadline | `neutral` badge: `Rolling intake` |

**Comparison.** The requirement is that comparison be easy, not that a comparison tool exists. This is achieved through **uniform card anatomy in a consistent field order** — every card puts eligibility in the same place, deadline in the same place, provider in the same place. A student scanning a column compares by position. A separate compare-mode is not built (it has no FR).

**Anonymous:** the recommended section is replaced by a bordered prompt — *"Sign in to see which scholarships you qualify for."*

**States:** loading skeletons; empty → *"No scholarships match these filters"* + `Clear filters`; error → alert with retry.

**Mobile:** filters collapse into a `Filters (2)` button opening a full-screen sheet with `Apply` / `Clear`. Cards full width. Recommended section becomes a horizontal snap-scroll carousel.

## 3.11 Scholarship detail `/scholarships/:id` — Public

Two columns desktop: content 1fr, eligibility sidebar 340px sticky.

Left: name, provider, deadline · overview · benefits and coverage · application timeline (route line — a real sequence) · `Apply on provider's site` (primary, external, `rel="noopener noreferrer"`, with an external-link icon and the host name shown).

Right sidebar — **the eligibility checklist**, three states:

```
┌────────────────────────────────┐
│ Eligibility check              │
│ You meet 4 of 6 requirements   │
│                                │
│ ✓ Malaysian citizen            │
│ ✓ Degree level                 │
│ ✓ Computer Science field       │
│ ✓ Minimum 5 credits            │
│ ✗ Minimum CGPA 3.75            │
│   You haven't added a CGPA     │
│ — Leadership experience        │
│   We can't check this. See the │
│   provider's page.             │
└────────────────────────────────┘
```

**The third state is the important one.** Criteria with `is_checkable = false` render as a grey dash with an explanation — never as a red ✗. Showing a false failure could stop a student applying for something they qualify for. That is a real harm, and it is a design decision, not an implementation detail.

The count reads `4 of 6` and counts only checkable criteria.

**Anonymous:** sidebar replaced by a sign-in prompt.

**Mobile:** sidebar moves above the overview — eligibility is what the student came for.

## 3.12 Careers `/careers` and `/careers/:id` — Student

**List:** search field, category chips (Healthcare, Engineering, Technology, Business, Education, Creative, Science, Law), career cards showing name, field, one-line description, and — where the career appears in the student's recommendations — a `Recommended for you` badge with the match reason.

**Detail:**

```
Pharmacist
Healthcare · Investigative-Conventional-Realistic

[Overview]  [Skills]  [Pathway]        ← tabs (accordion on mobile)

Why this fits you
  ✓ Your Investigative interests match this career's profile
  ✓ You're strong in Biology and Chemistry

Your pathway from SPM                    ← route line, real sequence
 ●  Stage 1 · SPM
    Credits in Biology, Chemistry, Mathematics
 │
 ●  Stage 2 · Pre-university (1–2 years)
    Matriculation, STPM or Foundation in Science
 │
 ●  Stage 3 · Degree (4 years)
    Bachelor of Pharmacy
 │
 ●  Stage 4 · Professional
    Provisionally Registered Pharmacist, one year

Courses that lead here          [3 courses]
Scholarships for this field     [7 scholarships]
```

The roadmap starts from **the student's own education level** (`from_education_level`), per FR11. A diploma student sees a three-stage path, not a five-stage one.

**Not built:** salary ranges, industry market share, "view mentors" from Figure 4.9. No data source, no requirement, and inventing salary figures for a student's life decision would be irresponsible.

**States:** empty roadmap for an unauthored (career, level) pair → *"We haven't mapped this pathway for your education level yet."* Honest, not a blank panel.

## 3.13 Dashboard `/dashboard` — Student

See §4 for full treatment.

## 3.14 Saved `/saved` — Student

Tabs: Scholarships · Courses · Careers. Each item shows the saved record plus an `application_status` select (Saved / Preparing / Submitted / Accepted / Rejected) and a remove action. Scholarships sort by deadline ascending, so the most urgent is first.

**Empty:** *"Nothing saved yet. Save scholarships and courses to track them here."* with a link to `/scholarships`.

## 3.15 Profile `/profile` — Student

See §9.

## 3.16 Privacy `/privacy` — Public

Prose page, 68ch. What is collected, why, how long it is kept, that chat messages go to Google Gemini, and how to delete an account. Written in plain language a 17-year-old will read — not legal boilerplate. Linked from registration, the footer and the profile page.

---

# 4. DASHBOARD

## 4.1 Purpose

One question: **what should I do next?**

## 4.2 What it does not do

The report's Figure 4.10 mockup shows a metric row — profile completion, Holland Code, saved count, upcoming deadlines. Two of those four are real signals. Two are counts of things the student already knows.

The brief says not to invent statistics to look impressive. Applied strictly, that removes the four-stat row. **There is no stat row.** Instead the dashboard leads with a next-action block, because that is the actual job.

## 4.3 Layout

```
┌─────────────────────────────────────────────────────────┐
│  Good evening, Kauthar                                  │
├─────────────────────────────────────────────────────────┤
│  YOUR NEXT STEP                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Add your SPM results                              │ │
│  │ You've completed the interest assessment. Adding  │ │
│  │ your results will sharpen your recommendations.   │ │
│  │ [Add results]                                     │ │
│  └───────────────────────────────────────────────────┘ │
├──────────────────────────────┬──────────────────────────┤
│  Your profile                │  Closing soon            │
│  ┌──────────────────────┐    │  ┌────────────────────┐ │
│  │   I S A              │    │  │ PETRONAS           │ │
│  │   Investigative      │    │  │ 3 days   ▲critical │ │
│  │   Social · Artistic  │    │  │ 5 of 6 met         │ │
│  │   [Full results]     │    │  ├────────────────────┤ │
│  └──────────────────────┘    │  │ JPA PIDN           │ │
│                              │  │ 12 days  ▲warning  │ │
│  Strongest subjects          │  └────────────────────┘ │
│  Biology A · Chemistry A-    │  [All scholarships]     │
│  Mathematics A+              │                          │
├──────────────────────────────┴──────────────────────────┤
│  Your top recommendations                    [View all] │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │ Pharmacist   │ │ Biomedical   │ │ Bachelor of  │    │
│  │ 85% · 3 of 4 │ │ 78% · 3 of 4 │ │ Pharmacy 85% │    │
│  └──────────────┘ └──────────────┘ └──────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## 4.4 The next-step block

Single most important element. One action, chosen by a deterministic ladder:

```
1  profile incomplete            → "Finish your profile"
2  no RIASEC                     → "Take the interest assessment"
3  SPM student, no grades        → "Add your SPM results"
4  no recommendations generated  → "See your recommendations"
5  saved scholarship ≤7 days     → "PETRONAS closes in 3 days"
6  nothing outstanding           → "Explore careers"  (low-emphasis)
```

Rule 5 outranks 4 because a deadline is time-critical and a recommendation is not.

At state 6 the block loses its border and primary button and becomes a quiet line of text. A dashboard that manufactures urgency when there is none trains the student to ignore it.

## 4.5 Sections

- **Your profile** — Holland Code plate, top three dimensions, link to full results. Empty state invites the assessment.
- **Strongest subjects** — up to three `strong` subjects with average grades. Hidden entirely for non-SPM students, with no explanatory clutter.
- **Closing soon** — saved scholarships plus high-eligibility matches, deadline ascending, maximum three, only those within 30 days. If none: *"No deadlines in the next 30 days."*
- **Top recommendations** — three cards, compact, match % and satisfied-condition count.

Every section has a real empty state that invites the specific action that would fill it.

## 4.6 Mobile

Single column, order: greeting → next step → closing soon → profile → strongest subjects → recommendations. Deadlines move above the profile summary because urgency beats identity on a small screen.

---

# 5. FIND YOUR PATH — FLOW SUMMARY

Covered in §3.5–3.9. The flow as a whole:

```
Hub  ──▸ Assessment intro ──▸ 36 questions ──▸ Review ──▸ Results
 │                                                          │
 └──▸ Academic analysis ──▸ Strength grid ───────────────────┤
                                                            ▼
                                                  Recommendations
                                                  (careers + courses,
                                                   each with reasons)
```

**The explanation requirement, restated for the implementer:** at three separate points the student is told *why* — the "Why these suggestions" panel at the top of `/recommendations`, the per-card reason list including failures, and the "Why this fits you" block on career detail. All three read from the same `reasons[]` array returned by `fn:recommend`. None of them is collapsible by default.

---

# 6. SCHOLARSHIP DISCOVERY — FLOW SUMMARY

Covered in §3.10–3.11.

```
List ──filter/search──▸ Card ──▸ Detail ──▸ Eligibility checklist
  │                                              │
  └──▸ Recommended for you (authenticated)       └──▸ Provider site (external)
```

Comparison is achieved through positional consistency (§3.10), not a dedicated compare tool.

---

# 7. CAREER PATHWAYS — FLOW SUMMARY

Covered in §3.12. The relationship to interests and academic strengths is surfaced in the "Why this fits you" block, populated from `recommendations.reasons` when the career was rule-matched, and from `careers.riasec_profile` letter overlap when it surfaced as a secondary signal — labelled differently in each case so the student knows which is which.

---

# 8. AI CHATBOT

## 8.1 Not a ChatGPT clone

Three things make it an integrated advisor rather than a general chat product: it is a **side panel**, never a page; it opens with **contextual suggestions derived from the student's actual state**; and it **shows what it knows about the student**, so its personalisation is legible rather than uncanny.

## 8.2 Launcher

Bottom-right, 56px circle, `--pine-700`, chat icon, `--shadow-overlay`. `aria-label="Open Nexus advisor"`. Mobile: offset 72px above the tab bar. Not rendered on public pages.

## 8.3 Panel

Right-side, 400px, full height, `--shadow-panel`, `--r-modal` on the left corners. Mobile: full-screen sheet from the bottom.

```
┌──────────────────────────────────────┐
│ Nexus advisor                    ✕   │
│ AI assistant · can make mistakes     │  ← permanent disclosure
├──────────────────────────────────────┤
│ What I know about you           ▾    │
│ Holland Code ISA · SPM leaver ·      │  ← collapsed by default
│ Strong in Biology, Chemistry ·       │
│ 3 saved scholarships                 │
├──────────────────────────────────────┤
│                                      │
│  Hi Kauthar. I can explain your      │
│  recommendations, help you compare   │
│  scholarships, or answer questions   │
│  about Malaysian education.          │
│                                      │
│  Try asking:                         │
│  ┌────────────────────────────────┐ │
│  │ Why was Pharmacy recommended?  │ │
│  ├────────────────────────────────┤ │
│  │ What does my ISA code mean?    │ │
│  ├────────────────────────────────┤ │
│  │ What's the difference between  │ │
│  │ matriculation and STPM?        │ │
│  └────────────────────────────────┘ │
│                                      │
├──────────────────────────────────────┤
│ [Ask a question…              ] [→]  │
└──────────────────────────────────────┘
```

## 8.4 Contextual student information

The `What I know about you` disclosure is a deliberate transparency device and has no equivalent in a general chat product. It lists exactly the fields sent to Gemini per §12.2 of the technical spec — Holland Code, education level, subject strength labels, top recommendations, saved count.

It builds trust two ways: the student understands why answers are personalised, and it makes the data-minimisation claim visible rather than asserted. It is also directly useful for the privacy chapter of the thesis.

## 8.5 Suggested questions

Generated from state, not a static list:

| State | Suggestions |
| --- | --- |
| Has recommendations | *"Why was [top career] recommended?"* |
| Has Holland Code | *"What does my [code] code mean?"* |
| Viewing a scholarship | *"What do I need for this scholarship?"* |
| Has weak subjects | *"What if I'm not strong in [subject]?"* |
| New user | *"How does Nexus work?"* · *"What is a Holland Code?"* |

Three at a time, refreshed as state changes.

## 8.6 Messages

Student messages: right-aligned, `--pine-100`, `--r-modal` with a squared bottom-right. Assistant messages: left-aligned, `--surface`, 1px `--ink-300`, small Nexus mark. Never an anthropomorphic avatar or a name like "Alex" — this is a system, and saying so is part of the honesty.

## 8.7 States

- **Loading:** three-dot pulse in an assistant bubble. Replaced by streaming tokens (§3.4.3). Cursor block while streaming.
- **Streaming:** into an `aria-live="polite"` region. `Stop` button replaces `Send`.
- **Error — Gemini unavailable:** *"The assistant is temporarily unavailable. Please try again shortly."* Report wording, §4.2.2, verbatim.
- **Error — network:** *"Couldn't send that. Check your connection."* + `Retry`.
- **Error — rate limited:** *"You've reached the message limit for now. Try again in an hour."*
- **Empty response:** *"I couldn't generate a response. Try rephrasing your question."*

## 8.8 Safety and accuracy messaging

Three layers, each doing distinct work:

1. **Permanent header line** — `AI assistant · can make mistakes`. Always visible, no dismissal.
2. **First-session notice**, once per account:
   > This assistant uses AI to answer questions about your profile and Malaysian education. It can be wrong. Always check scholarship details on the provider's official site before applying.
3. **Inline footer on scholarship-related answers** — *"Check the provider's page for the final word."*

Layer 3 exists because scholarship data is crawled from third-party sites and may be stale or, per vulnerability V-01, manipulated. The chatbot's system prompt forbids ruling on eligibility (§12.3 of the technical spec) — this is the UI half of the same control.

---

# 9. PROFILE

## 9.1 Data collected

Nothing beyond what a feature consumes. Every field below maps to a requirement.

| Field | Used by | Required |
| --- | --- | --- |
| Full name | Greeting, personalisation | Yes |
| Email | Authentication | Yes (from auth) |
| Education level | Academic gate, roadmap start, scholarship filter | Yes |
| Career goal | Rule `interest` conditions | Optional |
| Target industry | Rule `interest` conditions | Optional |
| Subject grades | Strength classification | SPM only |

**Not collected:** date of birth, IC number, phone, address, school, household income, gender, race.

Household income deserves a note: §3.4.2 of the report lists "financial background" as a scholarship matching input. It is not collected here, per decision D-24 — there is no collection point in the report, no ERD field, and gathering income data from students who may be minors is the worst privacy decision available in this project. **Remove it from §3.4.2 of the thesis.**

## 9.2 Layout

Tabs: Account · Education · Results · Privacy.

- **Account** — name, email (read-only, with a note that it cannot be changed), change password.
- **Education** — education level, career goal, target industry. Changing education level warns that recommendations will regenerate.
- **Results** — the same grade table as §3.8, editable, with an inline note that changes update strength classification.
- **Privacy** — consent record and date, link to the privacy notice, `Download my data`, `Delete my account`.

## 9.3 Account deletion

`Delete my account` is a `destructive` button, not primary. Opens a modal requiring the word `DELETE` typed exactly. The modal lists precisely what is removed: profile, assessment results, exam results, recommendations, saved items, chat history. Irreversible, and says so.

---

# 10. ADMIN

Different visual register from the student app (§1.4): denser, table-first, `--ink-900` top bar. Admins are working, not being guided.

## 10.1 Admin home `/admin`

Four operational facts, no charts:

```
Last crawler run     2 Sept 2026, 03:00   Success
Records updated      47
Flagged for review   3                    [Review]
Active scholarships  156
```

Then the five most recent audit entries.

`Flagged for review` is the important one — it surfaces records the crawler's sanitiser marked suspicious (§10.4 of the technical spec). Reviewing them is a security control with a UI, and it is worth a screenshot in the thesis.

## 10.2 Scholarship management `/admin/scholarships`

Table: Name · Provider · Deadline · Status · Source · Updated · Actions. Filters by status including `flagged`. Search by name and provider.

Row actions: Edit · Manage criteria · Archive.

**Edit form** — all scholarship fields, plus a prominent switch:

> **Protect from crawler updates**
> When on, the weekly crawler won't overwrite this record.

This is `is_manual`. It needs a plain-language label because without it every admin correction is silently reverted at 03:00 on the next run.

**Criteria editor** — repeating rows of `criterion_type` · `operator` · `value` · `label` · `Checkable`. The `Checkable` toggle is explained inline: *"Turn off for requirements Nexus can't verify from a student's profile, like interviews or essays."*

## 10.3 Course management `/admin/courses`

Three tabs: Courses · Universities · Careers. Standard tables with create and edit forms.

## 10.4 Crawler `/admin/crawler`

```
┌──────────────────────────────────────────────────────┐
│ Crawler                          [Run now]           │
│ Next scheduled run: Monday 9 Sept, 03:00             │
├──────────────────────────────────────────────────────┤
│ Started        Status   Ins  Upd  Fail  Duration     │
│ 2 Sep 03:00    Success   3   47    0    2m 14s       │
│ 26 Aug 03:00   Partial   1   38    4    3m 02s   ▸   │
└──────────────────────────────────────────────────────┘
```

Failed and partial rows expand to show `error_message`. `Run now` opens a confirmation modal — it dispatches a live job and writes to the audit log.

## 10.5 Audit log `/admin/audit`

Table: When · Who · Action · Target. Filters by actor, action type, date range. **Read-only, with no delete control anywhere in the UI** — matching the append-only database policy (§4.7 of the technical spec). The absence of a delete button is itself the design.

---

# 11. RESPONSIVE STRATEGY

Three breakpoints. `375` (mobile), `768` (tablet), `1280` (desktop). NFR06 requires 375 and 1280 specifically; 768 exists so tablets are not served a stretched phone layout.

| Page | Desktop ≥1280 | Tablet 768–1279 | Mobile <768 |
| --- | --- | --- | --- |
| **Shell** | 240px left rail, persistent | Rail collapses to 64px icons, labels on hover | Rail removed; bottom tab bar, 5 items |
| **Landing** | Two path cards side by side; hero 36px | Cards side by side, narrower; hero 30px | Cards stack; hero 30px; nav to wordmark + Sign in |
| **Register / Login** | 400px centred, 15vh offset | Same | Full width, 20px gutters, 8vh offset |
| **Profile setup** | Horizontal route line, 4 labelled stages | Same, tighter | "Step 2 of 4" + progress bar; grade table → per-subject cards |
| **Dashboard** | 2-col grid; next-step full width | 2-col, narrower right column | Single column; deadlines above profile summary |
| **Assessment** | 560px centred; Back/Next inline | Same | Full width; Back/Next fixed bottom bar |
| **RIASEC results** | Chart left, scores right; 3 description blocks in a row | Chart above scores; blocks stacked | Chart full width; scores below; descriptions accordion, first open |
| **Academic** | 4-col strength grid; full trend chart | 2-col grid | 1-col grid; grade table → per-subject cards; trend chart scrolls horizontally with a visible hint |
| **Recommendations** | 2-col card grid per section | 2-col | 1-col; reason lists stay expanded |
| **Scholarship list** | 240px filter rail + results | Filter rail collapses to a `Filters (n)` button | Full-screen filter sheet; recommended → snap carousel |
| **Scholarship detail** | Content + 340px sticky eligibility sidebar | Sidebar drops below content | Eligibility **above** overview |
| **Career detail** | Tabs; roadmap vertical route line | Tabs | Tabs → accordion; roadmap markers shrink to 24px |
| **Chat** | 400px right panel, page remains usable | 400px panel, dims page | Full-screen bottom sheet, drag-to-dismiss |
| **Admin tables** | Full table, all columns | Secondary columns hidden | Card-per-row; admin is desktop-first and this is acceptable |

**Cross-cutting mobile rules:** no horizontal page scroll at 375px; 44px minimum targets; fixed bottom bars respect `env(safe-area-inset-bottom)`; primary action reachable in the lower third; below 375px show the notice specified in §4.2.3 of the report.

---

# 12. COMPONENT LIBRARY

## 12.1 Primitives — `components/ui/`

| Component | Purpose | Props | States | Usage |
| --- | --- | --- | --- | --- |
| `Button` | Actions | `variant` (primary/secondary/tertiary/destructive/link), `size` (sm/md/lg), `loading`, `disabled`, `fullWidth`, `iconLeft` | default, hover, focus, active, disabled, loading | One primary per view |
| `Input` | Text entry | `label`, `hint`, `error`, `required`, `type`, `value`, `onChange`, `onBlur` | default, focus, error, disabled | Always with a real label |
| `Select` | Choice from a list | `label`, `options`, `placeholder`, `error` | as Input | ≥5 options; fewer → RadioGroup |
| `RadioGroup` | Exclusive choice | `label`, `options`, `layout` (list/cards), `value` | as Input | `cards` for education level, assessment scale |
| `Checkbox` | Boolean / multi | `label`, `checked`, `error` | default, checked, indeterminate, error | Filters, consent |
| `Card` | Container | `variant` (plain/titled/stat), `title`, `action`, `interactive`, `as` | default, hover, focus | `interactive` requires a real link inside |
| `Badge` | Compact status | `variant` (neutral/success/warning/critical/info), `children` | static | Always has text |
| `Alert` | Block message | `variant` (info/success/warning/error), `title`, `children`, `action`, `dismissible` | default, dismissed | Bold first sentence + what to do |
| `Modal` | Focused task | `open`, `onClose`, `title`, `size`, `children` | open, closing | Traps focus, Esc closes |
| `Toast` | Transient confirm | `variant`, `message`, `duration` | entering, visible, leaving | Background saves only |
| `Spinner` | Indeterminate wait | `size` | — | Inside buttons only |
| `Skeleton` | Content placeholder | `variant` (text/card/chart), `lines` | — | Must match final layout |
| `Tabs` | Section switching | `tabs`, `active`, `onChange` | — | Becomes accordion <768px |
| `ProgressBar` | Determinate progress | `value`, `max`, `label` | — | Always paired with text |
| `EmptyState` | No content | `title`, `description`, `action`, `illustration` | — | Always offers an action |

## 12.2 Layout — `components/layout/`

`AppShell` (rail/tabbar + main + chat launcher), `PublicHeader`, `AdminShell`, `PageHeader` (back link, title, description, actions), `Section`, `SideRail`, `BottomTabBar`.

## 12.3 Domain components

### RIASEC — `components/riasec/`

| Component | Props | Notes |
| --- | --- | --- |
| `QuestionCard` | `question`, `value`, `onChange`, `index`, `total` | 5 full-width option rows, 48px each |
| `AssessmentProgress` | `current`, `total` | Bar + text, never bar alone |
| `RiasecRadarChart` | `scores`, `animate` | Draws once; text alternative rendered as sibling |
| `HollandCodePlate` | `code`, `size` | Serif display, bordered plate |
| `DimensionBadge` | `letter`, `score`, `max` | Colour + letter + name |
| `DimensionDescription` | `letter`, `content` | Traits / career fields / academic areas |

### Academic — `components/academic/`

| Component | Props | Notes |
| --- | --- | --- |
| `GradeEntryTable` | `subjects`, `examTypes`, `grades`, `onChange`, `onAddSubject` | Per-subject cards <768px |
| `SubjectCard` | `subject`, `strength`, `averageGrade`, `examCount` | Exam count always shown |
| `AcademicTrendChart` | `series`, `thresholdLine` | Direct end labels, no legend |
| `StrengthSummary` | `strong[]`, `weak[]` | Written summary |

### Recommendations — `components/recommendations/`

| Component | Props | Notes |
| --- | --- | --- |
| `RecommendationExplanation` | `hollandCode`, `strengths`, `degradedMode` | Top-of-page panel |
| `CareerCard` | `career`, `matchScore`, `reasons`, `onSave`, `saved` | Reasons never collapsed |
| `CourseCard` | `course`, `university`, `pathwayType`, `entryRequirements`, `matchScore`, `reasons` | All §3.4.2 fields |
| `ReasonList` | `reasons[]` | `{satisfied: bool, text}` — renders ✓ and ✗ |
| `MatchScore` | `score` | Plain tabular number, no ring |
| `DegradedModeNotice` | — | Persistent info alert |

### Scholarship — `components/scholarship/`

| Component | Props | Notes |
| --- | --- | --- |
| `ScholarshipCard` | `scholarship`, `eligibility`, `onSave`, `saved` | Fixed field order — this is the comparison mechanism |
| `ScholarshipFilters` | `filters`, `onChange`, `onClear` | Sheet <768px |
| `DeadlineBadge` | `deadline` | Three bands + rolling |
| `EligibilityChecklist` | `criteria[]`, `authenticated` | Three states; `unknown` never renders as ✗ |
| `EligibilitySummary` | `met`, `total` | Counts checkable only |
| `ApplicationTimeline` | `stages[]` | Route line |

### Career — `components/career/`

`CareerCard`, `CareerCategoryChips`, `PathwayRoadmap` (`stages[]`, `fromLevel`), `FitExplanation` (`reasons[]`, `source`: `'rule' | 'profile'` — labels differ so the student knows which signal produced it).

### Chat — `components/chat/`

| Component | Props | Notes |
| --- | --- | --- |
| `ChatLauncher` | `unread` | Hidden on public pages |
| `ChatPanel` | `open`, `onClose` | Focus trap; full-screen <768px |
| `ContextDisclosure` | `context` | The transparency device, §8.4 |
| `SuggestedQuestions` | `suggestions[]`, `onSelect` | State-derived, 3 at a time |
| `MessageList` | `messages[]`, `streaming` | `aria-live="polite"` |
| `MessageBubble` | `sender`, `content`, `streaming` | No avatar, no persona name |
| `AiDisclosure` | `variant` (`header`/`firstSession`/`inline`) | Three layers, §8.8 |

### Admin — `components/admin/`

`DataTable` (`columns`, `rows`, `sort`, `emptyState` — card-per-row <768px), `CrawlLogTable` (expandable errors), `AuditTable` (**read-only, no row actions by design**), `CriteriaEditor`, `ManualProtectionToggle`.

## 12.4 Component rules

1. No component fetches its own data. Pages fetch; components receive props. Keeps loading and error states in one place per page.
2. Every list component takes an `emptyState` prop. Empty is a designed state, not a blank div.
3. Every interactive component forwards `ref` and spreads `...rest` so `aria-*` can always be applied.
4. No component sets its own outer margin. Spacing is the parent's job.

---

# 13. ACCESSIBILITY STRATEGY

Beyond the baseline in §2.7:

**Charts** (§2.6) — both RIASEC and academic charts have persistent text alternatives, not `aria-label` summaries. These are primary outputs of the system, not illustrations.

**The assessment** — 36 questions must be completable by keyboard alone. Arrow keys move within the radio group, Enter advances, Shift+Tab returns. Auto-advance is announced via `aria-live` so a screen reader user knows the question changed.

**Streaming chat** — `aria-live="polite"` on the message region, `aria-busy` during streaming. Announcing every token would be unusable, so announce on completion.

**Colour independence** — deadline urgency, subject strength, eligibility status and RIASEC dimensions all carry text or an icon alongside colour. Test by rendering the app in greyscale; every status must remain readable.

**Forms** — errors linked by `aria-describedby`, `aria-invalid` on failing fields, error summary at the top of multi-error forms with links to each field.

**Language** — `lang="ms"` on Bahasa Malaysia chat responses.

**What not to claim.** Build to this floor, but do not state WCAG 2.1 AA conformance in the thesis without an audit. An unevidenced conformance claim is worse than an honest statement of the floor you built to.

---

# 14. IMPLEMENTATION NOTES

**Tailwind config.** Put every token in §0.3–0.5 into `theme.extend` — colours, `fontFamily`, `fontSize` with line-heights, `borderRadius`, `boxShadow`. Use only these. No arbitrary values (`text-[17px]`) outside genuine one-offs.

**Fonts.** Self-host Source Serif 4 and IBM Plex Sans as woff2 subsets rather than loading from Google Fonts — faster on Malaysian mobile connections, and it removes a third-party request from the privacy notice. `font-display: swap`.

**Build order.** `ui/` primitives → `layout/` → auth pages → profile setup → dashboard shell → domain components per feature stage. This matches the nine implementation stages in the technical specification, so frontend and backend advance together.

**Performance (NFR02a, 4s on mobile).** Route-level code splitting; lazy-load Recharts (only three pages need it); lazy-load the chat panel on first open; subset fonts; no image over 200KB.

**What is deliberately not built:** course comparison tool (no FR), notifications (no FR), salary and market data (no data source), profile completion percentage (a count the student already knows), activity feed (no event taxonomy defined). Each is listed in the requirements analysis §18 as SHOULD NOT.
