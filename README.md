# Nexus

**Live site:** [Add Vercel URL after production deployment](https://vercel.com/)

Nexus is a final-year project for Malaysian students exploring courses, careers, scholarships and their interests. It is still in development; features and data may change.

## Tech stack

React 18, Vite 5, Tailwind CSS 3, React Router 7, Supabase Auth and PostgreSQL, Vercel Functions, Gemini API, and a separate Python scraper. Career and course recommendations use explicit rules; Gemini powers the optional advisory chat.

## Local setup (Windows PowerShell)

Install Node.js 22 and npm. The Python scraper is optional for running the website.

```powershell
npm.cmd ci
Copy-Item .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.
npm.cmd run dev
```

Vite prints the local URL (normally `http://localhost:5174`). The public pages can render without Supabase settings; sign-in, database features and chat need a configured Supabase project. `npm.cmd run build` creates the deployable `dist/` directory.

The local Vite server serves the frontend only. To test `/api/chat` locally, use `vercel dev` after linking a Vercel project and setting its local environment variables. The production Vercel deployment serves both the frontend and `/api/chat`.

## Environment variable names

Copy `.env.example` for the names. Never put real values in Git. Set these in Vercel **Production and Preview** environments:

| Name | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` | Public Supabase project URL; included in browser code |
| `VITE_SUPABASE_ANON_KEY` | Public anon key; included in browser code and used by the server function with each user's JWT |
| `GEMINI_API_KEY` | Server-side Gemini key for `/api/chat`; never use a `VITE_` prefix |

`VITE_APP_NAME` and `VITE_APP_ENV` are optional browser settings. `GEMINI_MODEL` and `GEMINI_FALLBACK_MODEL` are optional server settings; the chat function has defaults. Do not add a Supabase service role key to Vercel for this app. Supabase Row Level Security protects user data.

## Deploy to Vercel

1. Push the `deploy/vercel` branch to the public `kshrr/nexus` repository and review its Preview deployment.
2. In Vercel, import `kshrr/nexus` as a new project. Use the repository root as the Root Directory, Vite as the framework, `npm run build` as the Build Command, `dist` as the Output Directory, and Node.js 22.x.
3. Add the three required environment variable names above in Project Settings → Environment Variables for Production and Preview, using your own values. Redeploy after adding or changing variables.
4. Keep `main` as the Production Branch. Merge the reviewed deployment branch into `main` when ready to make it the live production site. Other branches receive Preview URLs.
5. In Supabase Dashboard → Authentication → URL Configuration, set **Site URL** to the production site origin. Add exact Redirect URLs for `<production-origin>/verify` and `<production-origin>/reset-password`. For the Preview URL you intend to test, add its `/verify` and `/reset-password` URLs too. For local email flows, add `http://localhost:5174/verify` and `http://localhost:5174/reset-password`. Deploy the remaining Supabase Edge Functions and migrations separately; `/api/chat` handles Gemini on Vercel.
6. Replace the live-site placeholder above with the production URL after checking the live deployment.

`vercel.json` keeps browser routes working on refresh and routes `/api/chat` to the server function. The Python scraper is not part of the Vercel build; see [scraper setup](scraper/README.md) for its separate operation.

## Live verification

Check the homepage, refresh a nested page, sign in and load Supabase data, send English and Bahasa Melayu chat messages, and confirm a rate-limited response shows a friendly message. In browser developer tools, chat requests should go to `/api/chat`; the Gemini key must not appear in Network responses or built JavaScript assets.
