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
3. Enter the client ID and secret under Authentication → Sign In / Providers → Google in Supabase, and turn off the Email provider there: GSTLST logs in with Google only.
4. Under Authentication → URL Configuration, allow `https://forsti37.github.io/gstlst/` (prod) and `http://localhost:5173/gstlst/` (dev).

## GitHub secrets

Set these under Settings → Secrets and variables → Actions. The deploy and keep-alive workflows use them:

| Secret | Value |
| --- | --- |
| `SUPABASE_PROD_URL` | URL of the prod project |
| `SUPABASE_PROD_PUBLISHABLE_KEY` | Publishable key of the prod project |

The keep-alive workflow skips itself until they exist.

## Database

The Supabase CLI is a dev dependency, so log in once and link the project in your own terminal:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
```

```bash
npm run db:push    # apply supabase/migrations to the linked project
npm run db:test    # run the pgTAP tests, rolled back after each run, no Docker needed
npm run db:types   # regenerate src/lib/database.types.ts
```

Run the migrations on prod before setting the GitHub secrets: the keep-alive workflow calls the `keep_alive` function from them.

## Importing the sheet

The input stays in the gitignored `data/` folder, because the repo is public:

- `dnb events - Data.csv`: the sheet
- `event-dates.csv`: `year,promoter,event,city,location,date_start,date_end,confidence,source,note`, one row per event
- `import-overrides.json`: optional `cityCountries`, `venues`, `b2b`, `groups` and `series`

The script only writes `data/import.sql` and `data/import-review.md`. Read the review list, then apply the SQL. Repeating an import doesn't create duplicates.

```bash
npm run import:sheet -- --dev-admin
```

```bash
npx supabase db query --remote -f data/import.sql
```

`--dev-admin` creates a placeholder admin for the dev project. On prod, log in with Google first and pass `--admin <your profile id>` instead.

## The first admin

Nobody can sign up without an invite, and only admins create invites, so the first one comes from SQL:

```bash
npx supabase db query --remote "insert into public.invite_codes (code) values (encode(extensions.gen_random_bytes(6), 'hex')) returning code"
```

Sign up with that code, then give your profile the admin role:

```bash
npx supabase db query --remote "update public.profiles set role = 'admin' where username = '<your username>'"
```

From then on, create invites under Settings → Admin → Invite codes.

## Push notifications

Each project needs its own VAPID key pair and shared secret:

1. Generate a VAPID key pair, and a random shared secret.
2. Set the function secrets `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `PUSH_SHARED_SECRET` on the project.
3. Store the function URL as `push_function_url` and the secret as `push_shared_secret` in the project's Vault. The cron job does nothing without them.
4. Deploy the function:

```bash
npx supabase functions deploy send-push --use-api --no-verify-jwt --project-ref <project-ref>
```

5. Put the public key into `VITE_VAPID_PUBLIC_KEY`: in `.env.development.local` for dev, and as the GitHub secret `VAPID_PUBLIC_KEY` for prod.

## Keep-alive caveat

GitHub disables scheduled workflows in public repositories after 60 days without repository activity. It warns by email first. If that happens during a quiet stretch, re-enable the workflow under Actions or push a commit.
