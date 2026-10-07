# Nexus

Scholarship and career guidance for Malaysian students, built as a final-year project.

Nexus brings career exploration, course recommendations and scholarship discovery into one web application. Recommendations use explicit rules and student profile data; a separate AI chat assistant provides conversational guidance.

## Features

- **Find Your Path:** RIASEC interest assessment, academic analysis and explained career and course recommendations.
- **Scholarships:** programme browsing, eligibility matching, scholarship details and saved opportunities.
- **Career exploration:** career and course pages with pathways and fit information.
- **AI guidance:** a server-side Gemini integration with streaming chat and controlled profile context.
- **Admin tools:** scholarship management, web discovery, review before publication, monitoring and audit history.

## Built with

React 18 · Vite · React Router · Tailwind CSS · Motion · GSAP · Supabase Auth, PostgreSQL and Edge Functions · Python · Brave Search API · Gemini

## Run locally

Requires Node.js 20+ and npm. Python 3.12 is recommended for the scraper.

```powershell
npm.cmd ci
Copy-Item .env.example .env
# Set your own Supabase URL and public anon key in .env.
npm.cmd run dev
```

Open the address printed by Vite (normally http://localhost:5174).

To view the public landing page without backend setup, skip copying the environment file and run the dev server. Authentication and data features require your own Supabase project. This repository does not include access to the original database or user data.

## Backend setup

1. Create your own Supabase project and configure email authentication.
2. Install and sign in to the Supabase CLI, link your project, then apply the numbered migrations in [supabase/migrations](supabase/migrations) in order. Inspect the migration preview before applying changes to an existing database.
3. Deploy the Edge Functions needed for scoring, recommendations, scholarship matching, chat and crawler dispatch. See [the function guide](supabase/functions/README.md).
4. For admin access, register an account and run the documented `grant_admin_by_email` helper through the database administrator connection. Browser users cannot grant themselves the admin role.

Seed migrations provide assessment and reference data. Actual discovered scholarships depend on accessible sources and admin publication; discovery is not a guaranteed weekly quota.

## Scholarship discovery

Brave Search finds leads across multiple providers. The Python scraper fetches permitted public pages and stages candidates for admin review. **Add to Nexus** publishes a reviewed programme and enables monitoring. Unselected discoveries remain outside the public catalogue, and manual edits are protected from crawler updates.

The [workflow example](scraper/crawler.workflow.example.yml) supports **manual runs only**. This portfolio repository has no active scraper workflow. To enable it against your own backend, copy the example into `.github/workflows/crawler.yml` and configure these Actions secrets:

```powershell
New-Item -ItemType Directory -Force .github/workflows
Copy-Item scraper/crawler.workflow.example.yml .github/workflows/crawler.yml
```

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `BRAVE_SEARCH_API_KEY`

Admin-triggered runs also need Edge secrets `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO` and `GITHUB_WORKFLOW_REF`. Chat requires `GEMINI_API_KEY` in the Edge runtime. See [scraper setup](scraper/README.md) and [discovery deployment](docs/scholarship-discovery-deployment.md).

## Validation

```powershell
npm.cmd run verify
python -m pip install -r scraper/requirements.txt
python -m pytest scraper/tests -q
```

Verification runs lint, frontend and shared-function tests, a production build, bundle secret checks and database tests. Database tests use PGlite; hosted PostgreSQL concurrency and live provider behaviour require separate checks.

## Project structure

| Directory | Purpose |
| --- | --- |
| `src/` | Public, student and admin interfaces |
| `supabase/migrations/` | Database schema, access policies and operations |
| `supabase/functions/` | Scoring, recommendations, matching, chat and crawler dispatch |
| `scraper/` | Search, extraction, monitoring and tests |
| `docs/` | Requirements, architecture and deployment notes |

## Portfolio notes

This is a fresh source snapshot with a new Git history. It includes no private repository history, production environment files, linked Supabase metadata or database exports. Backend deployment is separate from cloning the source.

The landing photograph is credited in [image attribution](src/assets/images/README.md). No live demo URL is included until a public deployment is available.
