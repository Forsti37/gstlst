# Setup

## Local development

```bash
npm ci
npm run dev
```

The app shell runs without Supabase. To connect a project, copy `.env.example` to `.env.development.local` and fill it in.

## Supabase

1. Create two free projects, `gstlst-dev` and `gstlst-prod`, both in the EU (Frankfurt) region.
2. Accept the data processing agreement (DPA) in the organization settings.
3. Note each project's URL and publishable key under Project Settings → API.

## Google OAuth (needed from phase 2)

1. In the Google Cloud Console, create an OAuth client of type "Web application".
2. Add `https://<project-ref>.supabase.co/auth/v1/callback` as a redirect URI for both projects.
3. Enter the client ID and secret under Authentication → Providers → Google in Supabase.
4. Under Authentication → URL Configuration, allow `https://forsti37.github.io/gstlst/` (prod) and `http://localhost:5173/gstlst/` (dev).

## GitHub secrets

Set these under Settings → Secrets and variables → Actions. The deploy and keep-alive workflows use them:

| Secret | Value |
| --- | --- |
| `SUPABASE_PROD_URL` | URL of the prod project |
| `SUPABASE_PROD_PUBLISHABLE_KEY` | Publishable key of the prod project |

The keep-alive workflow skips itself until they exist.

## Keep-alive caveat

GitHub disables scheduled workflows in public repositories after 60 days without repository activity. It warns by email first. If that happens during a quiet stretch, re-enable the workflow under Actions or push a commit.
