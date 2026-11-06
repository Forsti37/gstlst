# GSTLST – Spec & Build Prompts

Nov 5, 2026 · @Daniel

## Overview

An installable web app (PWA) where ravers check in to events and the DJ sets they saw, rate them and share them with friends – Untappd for electronic music. App name: **GSTLST**, repo and URL slug **gstlst** (reads as "guestlist"). Tagline: **Every set counts.**

**Phase 1:** friends beta with about 10 people, invite-only, hosted on GitHub Pages at `forsti37.github.io/gstlst`. **Later:** own domain, public launch, possibly app stores via Capacitor. No business model – the app is purely for ravers. **Running costs: 0 €.**

### Decisions

| Topic | Decision |
| --- | --- |
| Execution | Claude Code (Cursor possible), this spec + phase prompts |
| Language | Everything in English: spec, code, comments, commits. UI via i18n, English default, German second |
| Scope | All electronic genres, DnB-first in data and badges |
| Frontend | React + Vite + TypeScript + Tailwind, PWA |
| Backend | Supabase free tier + GitHub Pages, 0 € |
| Login | Google only |
| Push | Web Push from the MVP (iOS only when installed to the home screen) |
| Offline | Check-ins are queued offline and synced later |
| Media | Photos only, heavily compressed, EXIF stripped; no videos |
| Check-in | Event checked in once, sets linked below it and rated individually |
| Rating | 0–5 in 0.5 steps; required for sets; optional for events, plus optional sub-ratings (sound, crowd, location, lineup) |
| Setlists | Out of scope for now |
| Comments on others' check-ins | Out of scope for now (own check-in text stays) |
| Reactions | Bassface 😤, Dance 💃, Fire 🔥 |
| Friendship | Mutual; permanent link and QR code per username |
| Feed | Friends and Public, switched by swipe, login required |
| Privacy default | Friends |
| Admin | Daniel only; moderator role assignable in the admin dashboard; later verified promoters and artist claims |
| Data import | Daniel's sheet only, dates as yyyy-mm-dd |
| Compliance | GDPR from day one, minimum age 16, photos visible only after approval |
| Brand | Independent (not LIVID), monochrome with red and blue accents, dark mode by default |

## Tech Stack & Architecture

Decision: **Supabase free tier + GitHub Pages, 0 € running costs.** It is the cheapest option with the least custom building. Everything that would cost money is cut or avoided: no videos, no outgoing email (Google login only), no custom domain until launch.

### Cost comparison

| Option | Running cost | Catch |
| --- | --- | --- |
| **Supabase Free + GitHub Pages** (chosen) | 0 € | Pauses after 7 days without activity (a free keep-alive cron fixes this). 500 MB database, 1 GB file storage (about 3,000 compressed photos). Built-in email sends only 2 mails per hour → Google login, no emails |
| Cloudflare (Pages, Workers, D1, R2) | 0 € | 10 GB photo storage with free egress, but no ready-made auth and SQLite instead of Postgres (no `pg_trgm`, no RLS) → much more custom code. R2 requires a credit card on file |
| Firebase Spark | 0 € | File storage and Cloud Functions only on the Blaze plan with a payment method → no photos, no push sending |
| Own server (e.g. PocketBase) | 0 € only on a free VM | Maintenance, backups and security are on you |

**Student discounts:** The GitHub Student Developer Pack mainly gives a free domain for the first year (e.g. via Namecheap, Name.com or get.tech); after that the regular renewal price applies. The 100 USD Azure credit is not needed. The DigitalOcean credit left the pack in July 2026.

**If storage runs out:** move photos to Cloudflare R2 (10 GB free, no egress fees); everything else stays on Supabase.

### Why Supabase over Firebase

| Criterion | Supabase | Firebase |
| --- | --- | --- |
| Data model | Postgres with foreign keys and constraints. An artist merge is one `UPDATE` | Documents, denormalization needed. A merge rewrites many documents |
| Stats & explorer | SQL with views, materialized views, window functions | No joins, only simple aggregations. A pivot needs precomputed counters |
| Fuzzy duplicate search | `pg_trgm` + `unaccent` built in | External service needed |
| Permissions | Row Level Security in SQL | Security Rules, a separate DSL |
| Offline | Own queue in IndexedDB | Built-in offline cache |
| Push | `web-push` + VAPID in an Edge Function | FCM, but sending needs Cloud Functions (Blaze plan) |
| Lock-in | Plain Postgres, self-hostable | Proprietary |

Sources: [Supabase free tier](https://freetier.co/directory/companies/supabase), [Supabase pause rule](https://www.itpathsolutions.com/supabase-free-tier-limits), [Supabase email limit](https://rapidevelopers.com/supabase-tutorial/how-to-change-smtp-settings-in-supabase), [Firebase Storage + Blaze](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024), [Cloudflare free limits](https://freetier.co/cloudflare-free-tier), [GitHub Student Pack 2026](https://capitalandcompute.net/blog/github-student-developer-pack-2026/), [Student free domains](https://domainoffer.net/blog/student-free-domains).

### Stack

- **Frontend:** React + Vite + TypeScript (strict), Tailwind, TanStack Query, React Router, i18next (English default, German).
- **PWA:** `vite-plugin-pwa` (Workbox), manifest with icons and splash screens, install onboarding for iOS (Share → Add to Home Screen).
- **Offline:** check-in queue in IndexedDB (Dexie), synced when back online or on the next app start (iOS has no Background Sync).
- **Charts:** ECharts or Recharts. **Map:** MapLibre GL with OpenFreeMap tiles (free, no API key).
- **Wrapped export:** `html-to-image` → 9:16 PNG, Web Share API for Instagram stories.
- **Photos:** `browser-image-compression` (max. \~1600 px, WebP, EXIF stripped). No videos.
- **Backend:** Supabase with Postgres (`pg_trgm`, `unaccent`, `pg_cron`), Auth (Google only; Apple later, needs a paid Apple Developer account), Storage (private bucket, signed URLs), Edge Functions (push sending, feedback → GitHub issue); GPS verification and invite redemption are database functions; invites are redeemed atomically in the `complete_signup` database function. Region: EU (Frankfurt).
- **Hosting:** GitHub Pages via GitHub Actions at `forsti37.github.io/gstlst`. SPA routing via a `404.html` fallback so deep links like `/u/daniel` work. Later a custom domain via CNAME (first year free via the GitHub Student Developer Pack).
- **Keep-alive:** a GitHub Actions cron running a lightweight query every 3 days, against the 7-day pause.
- **Environments:** two Supabase projects (dev, prod – both free tier), migrations and seeds via the Supabase CLI in the repo, generated TypeScript types.
- **Tests:** Vitest, Playwright for the core flows, pgTAP for RLS policies.

## Data Model

The core chain is series → event → floor → set → set artists. A user check-in hangs off the event; set check-ins hang off the event check-in. All master data has a status (`pending`, `approved`, `rejected`) and a creator.

### Master data

| Table | Purpose | Key columns |
| --- | --- | --- |
| `venues` | Location | name, city, country\_code, lat, lng, venue\_type (club, warehouse, open\_air, festival\_site, castle, pool, boat, other), status |
| `promoters` | Promoter or collective | name, slug, instagram\_url, status |
| `event_series` | Recurring series (Beatpatrol, Error) | name, slug, default\_promoter\_id |
| `events` | One specific edition | series\_id?, name, date\_start, date\_end (multi-day), venue\_id, status, lifecycle (scheduled, cancelled, postponed – cancelled and postponed events are neither visible nor available for check-in) |
| `event_promoters` | n:m for co-hosts | event\_id, promoter\_id |
| `floors` | Floors or stages of an event | event\_id, name, sort |
| `artists` | Person or group | name, slug, kind (person, group), country\_code (admin-maintained), instagram\_url, avatar\_path? (only with permission), claimed\_by\_user\_id?, status |
| `artist_aliases` | Spellings | artist\_id, alias (unique, normalized) |
| `artist_members` | Group → persons | group\_id, member\_id |
| `genres` | Curated tree | name, parent\_id (Electronic → Drum & Bass → Neurofunk) |
| `sets` | One performance | event\_id, floor\_id?, set\_type (solo, b2b, b2b2b, f2f, live, hybrid), start\_at?, end\_at?, status |
| `artist_default_genres` | Artist → genres | artist\_id, genre\_id |
| `event_event_tags` | Event → tags | event\_id, tag\_id |
| `set_artists` | Who plays | set\_id, artist\_id, role (dj, live, mc) |
| `tags` | Curated tags | name, scope (set, event), status (users can propose, admin approves) |

### User data

| Table | Purpose | Key columns |
| --- | --- | --- |
| `profiles` | User | username (unique, used in link and QR), display\_name, avatar\_path, home\_city?, birth\_year (minimum age 16), role (user, moderator, admin), language, privacy jsonb |
| `friendships` | Mutual | user\_a, user\_b, status (pending, accepted), requested\_by |
| `invite_codes` | Beta access | code, created\_by, max\_uses, used\_count, expires\_at |
| `event_checkins` | I was there | user\_id, event\_id, rating? (0–5, 0.5 steps), rating\_sound?, rating\_crowd?, rating\_location?, rating\_lineup?, text?, visibility, verified\_gps, verified\_admin, imported, created\_at, client\_uuid (offline dedupe) |
| `set_checkins` | A set seen | event\_checkin\_id, set\_id, rating (required, except for imported history), text?, imported |
| `set_checkin_genres` / `set_checkin_tags` | Genre override and tags of a set check-in | set\_checkin\_id, genre\_id / tag\_id |
| `checkin_companions` | "with @lisa" | event\_checkin\_id, user\_id, status (tagged, adopted) |
| `media` | Photo | owner\_id, event\_checkin\_id, set\_checkin\_id?, storage\_path, moderation\_status |
| `reactions` | Bassface, Dance, Fire | user\_id, target\_type (event\_checkin, set\_checkin), target\_id, kind – unique per user and target |
| `going` | Attending upcoming events | user\_id, event\_id |
| `wishlist_artists` | "Want to see" | user\_id, artist\_id, created\_at |
| `private_checkin_data` | Strictly private spending | event\_checkin\_id, ticket\_price, other\_spend, currency (default EUR). RLS: owner only; never in feeds, exports, Wrapped links or admin views |
| `blocks` | Blocked users | blocker\_id, blocked\_id. Hides both sides from each other and ends a friendship |
| `badge_definitions` / `user_badges` | Badges | see Badges |
| `checkin_fun_facts` | Computed per check-in | checkin\_id, kind, payload jsonb |
| `notifications` / `push_subscriptions` | Notifications | recipient, type, payload, read\_at / endpoint, keys |
| `change_requests` | Corrections to existing data | entity\_type, entity\_id, diff jsonb, status, reviewed\_by |
| `reports` | Reports | reporter\_id, target\_type, target\_id, reason |
| `admin_audit_log` | Traceability | actor\_id, action, entity\_type, entity\_id, diff, created\_at |
| `feedback` | Beta feedback | user\_id, text, app\_version, device, github\_issue\_url |

### Rules

- **Pending is usable right away:** whoever creates an artist or event can check in to it immediately. Others see it only after approval; in the feed the check-in shows an "under review" label.
- **Duplicate protection:** when creating, the app shows matches via `pg_trgm` similarity on names and aliases ("Did you mean A.M.C.?"). Names are normalized for comparison (lowercase, no accents, punctuation and "&" unified).
- **Merge:** an admin function `merge_artist(from, to)` re-points all `set_artists`, keeps the old name as an alias and deletes the duplicate. Same for venues, promoters and events.
- **Counting:** a B2B counts as "seen" for every artist involved. A group set counts for the group and additionally for each member (Camo & Krooked → also Camo and Krooked). Members' solo sets and specific B2B combinations stay queryable via `set_artists`.
- **RLS:** all logged-in users read `approved`; `pending` only the creator, moderators and admins. Check-ins and media follow visibility (public, friends, private), blocks and moderation status. Writes to master data only as `pending` or via `change_requests`.
- **Stats:** a materialized view of facts in a schema the API does not expose, with every read going through functions that apply the viewer's rights. Check-ins mark it as outdated, and a `pg_cron` job refreshes it within a minute. The explorer calls an RPC with whitelisted dimensions and filters, never free-form SQL from the client.
- **Import:** a script reads Daniel's sheet as CSV with the columns Jahr, Promoter, Event, Ort, Location, Artist, Lat, Long (decimal comma in coordinates), a separate list with the exact date of every event, and optional corrections. An event without a valid date stops the import. It creates venues, promoters, series, events, sets and artists plus Daniel's event and set check-ins, which are marked as imported and have no rating, and writes a review list of anomalies (different coordinates per venue, venues sharing coordinates, events without artists, similar names). All of this lives in the gitignored `data/` folder because the repo is public.

## Features

A check-in must work at 3 a.m., one-handed, with bad reception, in under 30 seconds. Everything else comes second.

### Check-in flow

1. **Find the event:** suggestions by proximity (GPS) and date first ("happening near you now"), then search. Not found → create the event (name, date, venue with search, promoter, optional series) → `pending`.
2. **Event check-in:** optional event rating plus optional sub-ratings (sound, crowd, location, lineup), text, tag friends. Event tags belong to the event itself and are proposed on the event page. GPS verification runs in the background if the location is within \~500 m of the venue and the date matches.
3. **Pick sets:** the event lineup as a list grouped by floor; with a timetable, sorted by time with "playing now" highlighted. Multi-select. Missing set → create it: search or create artist(s), set type (solo, B2B, B2B2B, F2F, live, hybrid), optional MC, floor.
4. **Per set:** rating (required, 0.5 steps), tags, genre override (prefilled from artist defaults), text, photo.
5. **Add more later:** more sets can be added to the existing event check-in during the night – no second event check-in.
6. **Finish:** fun facts and new badges are shown. Offline, everything goes into the queue and uploads at the next online moment.

Retroactive check-ins for past events use the same flow, just without GPS verification. A check-in counts as live until 12 hours after the event ends. Check-ins and ratings can be edited or deleted later; GPS verification survives edits. Optional and strictly private: ticket price and other spending, visible only to the user.

### Event page

- Info, venue with map, promoter, series with past editions, event tags (proposed by users, approved by the admin).
- Lineup by floor, timetable (if approved) with a "Check in" button next to every set.
- Who went or is going (friends first), approved photos, average ratings per set.
- Anyone can propose a timetable or lineup additions → approval.
- Cancelled or postponed events are hidden completely.

### Artist, venue and promoter pages

- **Artist:** name, aliases, group members or groups, genres, Instagram link, number of check-ins and average rating, most frequent B2B partners, "you've seen them X times", top fans (public profiles only), country of origin (admin-maintained). Image: generated avatar unless a real photo was uploaded with permission (see Legal).
- **Venue:** map, events, top artists there, resident (user with the most check-ins, public profiles only), average sub-ratings and an app-wide "best sound" ranking.
- **Promoter:** events, series.

### Admin & moderation

- Queues for new data points, corrections (`change_requests`), timetables, proposed tags, photos and reports.
- Approve, reject with a reason, edit before approval, merge with duplicate suggestions.
- Mark check-ins as verified manually (for leaderboards).
- Set events to cancelled or postponed, maintain artist countries, aliases, genres and tags.
- Create and edit badges (rule editor).
- Roles: admin (everything, assigns roles in the dashboard), moderator (queues, no role assignment). For the beta Daniel is the only admin and there are no moderators. Later: verified promoter (own events and lineups without approval) and verified artist (claiming their own profile).
- Admin dashboard: active users, check-ins per week, queue lengths. Every admin action goes to `admin_audit_log`.
- In-app feedback button that creates a GitHub issue via an Edge Function (text, app version, device).

### Feed & social

- Two feeds, switched by horizontal swipe: **Friends** (chronological) and **Public** (ranked by recency and proximity, public and approved check-ins only). Both require login. Proximity = city of the user's last check-in, current GPS only if permitted.
- Feed card = one event check-in with its sets below, ratings, photo carousel, badges, reactions. Fun facts do not appear in the feed.
- **Reactions:** one per user and target, on the event check-in and on individual sets, changeable. The list of who reacted is visible.
- Mutual friendships. Add via the `/u/{username}` link or QR code (permanent per username), plus search.
- Tagged friends get a request and can adopt the check-in with one tap (event and sets prefilled, own rating required).
- **Going** for upcoming events, with the list of friends going too. **Wishlist** ("want to see") for artists.
- Friends leaderboards per month and year (most events, sets, unique artists). Only verified check-ins count (GPS or admin).
- Compare with friends: sets and events seen together, taste match in percent (overlap of artists and genres).
- **Block:** hides both sides from each other and ends a friendship. Muting comes later.

### Notifications

- Web Push plus an in-app inbox. A cron job checks every minute for waiting notifications and calls the send-push Edge Function.
- Triggers: friend checks in (bundled per event: "Max is at Beatpatrol – 5 sets"), reaction to my check-in, friend request, being tagged, data point approved or rejected, new badge, a friend is going to an event I'm going to, a wishlist artist plays nearby or was seen by a friend.
- Bundling: follow-up check-ins to the same event within 60 minutes update the existing notification instead of sending a new one.
- Settings per type, plus quiet hours.

### Profile & stats

- Headline numbers: events, sets, unique artists, venues, cities, countries, promoters, average rating, verified check-ins.
- Genre split by sets and by events, top artists, top venues, top promoters, most frequent B2B combinations.
- Map of all visited venues, calendar heatmap, streaks (consecutive weekends).
- Travel km: visible only from 10 check-ins, calculated from a freely chosen home region (city only, with coordinates taken from the known venues of that city), shown only as a total – never per event, so the home location can't be inferred.
- **Explorer:** free grouping (artist, genre, subgenre, venue, city, country, promoter, series, set type, tag, month, year, weekday), filters and time range; output as table and chart.

### Privacy

- Profile: public, friends (default), private. Private means only the user, friends included. The profile setting is the upper limit for all areas.
- Configurable per area: stats, check-in list, photos, badges, map.
- Overridable per check-in: a check-in without its own visibility follows the settings, and an explicit visibility wins, even on a private profile.
- Private profiles don't appear in search or the public feed; friendship only via link or QR.
- Usernames are permanent, because the link and QR code hang on them.
- Signing in with Google alone gives no access to any data: only a profile, created with a valid invite, does.

### Wrapped

- Periods: year, month, season, custom range, per festival or event. The yearly Wrapped unlocks in early December; the rest of December is added afterwards.
- 9:16 story slides with swipe and a progress bar. Every slide and a summary can be shared as PNG, and as a link `/wrapped/{username}/{period}` that respects privacy settings.
- Content: headline numbers, top artist with count, top venue, genre mix, highest-rated set, longest night, most active month, map of cities and countries, new artists, Rave Buddy No. 1 (who you went out with most), badges of the period, rave persona.
- **Collage:** grid of all own approved photos of the period, filled up with generated tiles (artist name, date, venue) for check-ins without a photo.
- **Spending slide:** only in the user's own view, never in exports or links.
- **Community Wrapped:** unlocked by the admin at year end (most-seen artist in the app, top venue, best-sound venue).
- **Tone:** scene slang, a bit cheeky, not cringe. Texts in one file per language so they're easy to edit.
- **Rave personas** (examples): The Warehouse Rat, Neuro Purist, Liquid Soul, Jump-Up Menace, Festival Tourist, Closing Crew, Genre Hopper, Local Hero (almost always the same city), Road Warrior (many cities).

## Tags, Fun Facts & Reactions

Tags describe what happened (set by users). Fun facts describe what a check-in means for you (computed automatically). Badges are collectible achievements with levels (own chapter).

### Set tags (seed)

Opening, Closing, Headliner, Vinyl, Showcase, Secret/Surprise Set, Extended Set, All Night Long, Warm-up, Debut (artist's first gig), Farewell/Last Gig, Classics Set, Special Guest, Album/EP Launch, Dubplates.

Opening, Closing and Headliner are derived from the timetable and lineup when available; otherwise the user sets them. Users can propose new tags; the admin approves them.

### Event tags (seed)

Festival, Private Party, Open Air, Club Night, Warehouse, Boat Party, Daytime, Afterhour, Free Party, Pre-Party, Label Night, Charity, Theme Party (Halloween, New Year's Eve), Mixed Indoor/Outdoor, Multi-day.

Event tags are a property of the event, not of the individual check-in: users propose them, the admin approves them.

### Fun facts (computed per check-in)

- First time seen / seen for the 5th, 10th, 25th time.
- First time at this venue, in this city, in this country.
- First event of the year, 50th event overall (milestones).
- First set in a new subgenre.
- You are the first of your friends to see this artist.
- First time seeing this artist in X months.
- Same artist twice in one month or on the same weekend.
- Both members of a duo now also seen solo.
- Highest rating you have ever given this artist.
- New personal record: most sets in one night.
- Same series for the Xth year in a row.

Fun facts use the same rule engine as badges (without levels), are visible only to the user (after the check-in and in their own history) and use a plain tone, e.g. "Seen for the 5th time".

### Reactions

One reaction per user and target (event check-in or individual set), changeable at any time; the list of who reacted is visible.

| Reaction | Meaning | Emoji |
| --- | --- | --- |
| Bassface | Main reaction, "hard" | 😤 |
| Dance | "Would've loved to dance to that" | 💃 |
| Fire | The classic | 🔥 |

## Badges

Badges are configured as rules in the admin area, not in code. After each check-in a Postgres function evaluates only the affected rules and awards new levels.

### Rule engine

Each badge definition has a name, description, icon, category, an optional validity window (for limited badges) and a rule as JSON:

```json
{
  "metric": "count_distinct",
  "subject": "artist",
  "scope": "set_checkins",
  "filter": { "genre": "neurofunk", "verified_only": false },
  "window": { "type": "all_time" },
  "levels": [5, 10, 25, 50, 100],
  "level_names": ["Neuro Nerd", "Neuro Head", "Neuro Fiend", "Neuro Addict", "Neuro Overlord"]
}
```

Building blocks:

- **metric:** `count`, `count_distinct`, `streak` (consecutive weekends or days), `same_night` (count within one night), `exists` (a specific event happened).
- **subject:** event, set, artist, venue, city, country, promoter, series, genre, friend.
- **filter:** genre/subgenre, tag, set\_type, venue\_type, event\_tag, weekday, month, date (e.g. 12-31), distance to home region, verified check-ins only, specific entity (artist id, series id).
- **window:** all\_time, calendar year, rolling 30/365 days, fixed range.
- **levels / level\_names:** thresholds and a name per level. Each new level = one notification.

Rules that can't be expressed this way get a named SQL function (`custom: "duo_completionist"`).

### Catalog (seed)

| Category | Badge | Condition | Levels |
| --- | --- | --- | --- |
| Starter | First Drop | First check-in | 1 |
| Starter | Raver | Total events | 5, 10, 25, 50, 100, 250 |
| Starter | Set Collector | Total sets | 10, 25, 50, 100, 250, 500, 1000 |
| Starter | Artist Hunter | Unique artists | 10, 25, 50, 100, 250, 500 |
| Genre | Liquid Soul | Unique artists with liquid sets | 5, 10, 25, 50, 100 |
| Genre | Neuro Nerd | Same for neurofunk | 5, 10, 25, 50, 100 |
| Genre | Jump-Up Junkie | Same for jump up | 5, 10, 25, 50, 100 |
| Genre | Jungle Massive | Same for jungle | 5, 10, 25, 50, 100 |
| Genre | Roller Coaster | Same for rollers/minimal | 5, 10, 25, 50, 100 |
| Genre | Halftime Hero | Same for halftime | 5, 10, 25 |
| Genre | Bunker Kid | Same for techno | 5, 10, 25, 50, 100 |
| Genre | House Head | Same for house | 5, 10, 25, 50, 100 |
| Genre | Wobble Warrior | Same for dubstep | 5, 10, 25, 50 |
| Genre | Genre Hopper | Unique subgenres | 5, 10, 15, 20 |
| Set format | Back to Back | B2B sets seen | 5, 10, 25 |
| Set format | Triple Threat | B2B2B set seen | 1 |
| Set format | Fight Night | F2F sets seen | 3, 10, 25 |
| Set format | Live Wire | Live sets seen | 5, 10, 25 |
| Set format | Vinyl Junkie | Sets tagged Vinyl | 5, 10, 25 |
| Set format | Showcase Collector | Sets tagged Showcase | 5, 10, 25 |
| Set format | MC Massive | Sets with an MC | 10, 25, 50 |
| Set format | Headliner Hunter | Sets tagged Headliner | 10, 25, 50 |
| Time | Closing Crew | Sets tagged Closing | 5, 10, 25, 50 |
| Time | Early Bird | Sets tagged Opening | 5, 10, 25 |
| Time | Night Shift | Sets in one night | 5, 8, 12 |
| Time | Weekend Warrior | Consecutive weekends with a check-in | 3, 5, 10 |
| Time | Double Header | Two events on one day or night | 1, 5 |
| Time | Marathon | All days of a multi-day festival checked in | 1, 3, 10 |
| Time | Monday Blues | Event between Monday and Thursday | 1, 5, 10 |
| Time | Afterhour Survivor | Events tagged Afterhour | 3, 10 |
| Season | Spooky Bass | Event between Oct 25 and Nov 2 | 1 per year |
| Season | Silent Night? Nope | Event between Dec 20 and Dec 26 | 1 per year |
| Season | Countdown | Event on Dec 31 | 1, 3, 5 years |
| Season | Summer of Bass | Open-air events between June and August | 3, 5, 10 |
| Season | Winter Raver | Events between December and February | 5, 10 |
| Places | Regular | Check-ins at the same venue | 5, 10, 25 (level 3: "Part of the Furniture") |
| Places | Venue Hopper | Unique venues | 5, 10, 25, 50 |
| Places | City Tripper | Unique cities | 3, 5, 10, 20 |
| Places | Border Crosser | Unique countries | 2, 3, 5, 10 |
| Places | State Capitals | Events in all 9 Austrian state capitals | 3, 6, 9 |
| Places | Castle Raver | Venues of type castle | 1, 3, 5 |
| Places | Splash Zone | Venues of type pool or boat | 1, 3 |
| Places | Warehouse Rat | Venues of type warehouse | 5, 10, 25 |
| Places | Road Trip | Event more than 200 km from the home region | 1, 5, 10 |
| Loyalty | Superfan | Same artist seen | 3, 5, 10, 20 |
| Loyalty | Tradition | Same series in consecutive years | 2, 3, 5 |
| Loyalty | Promoter Loyalist | Events by the same promoter | 5, 10, 25 |
| Loyalty | Duo Completionist | A duo plus both members solo seen | 1, 3 |
| Discovery | Digger | Artists nobody in the app had checked in before you | 1, 5, 10, 25 |
| Discovery | Called It | Artist seen who later got 25+ check-ins in the app | 1, 3, 5 |
| Discovery | Local Support | Sets by artists from your country | 10, 25, 50 |
| Community | Crew Love | Event checked in with 3+ friends | 1, 5, 10 |
| Community | Plus One | Friends added via your QR or link | 3, 10, 25 |
| Community | Hype Machine | Reactions given | 25, 100, 500 |
| Community | Crowd Favourite | Reactions received | 25, 100, 500 |
| Community | Data Hero | Approved new data points or corrections | 1, 10, 25, 50 |
| Community | Timetable Wizard | Approved timetables | 1, 5, 10 |
| Verified | Proof of Rave | GPS- or admin-verified check-ins | 5, 10, 25, 50, 100 |
| Limited | Beta Raver | Account created during the friends beta | 1 |
| Limited | Wrapped {year} | Yearly Wrapped viewed and shared | 1 per year |
| Limited | Event specials | Created by the admin for a specific event, e.g. 10 years of Beatpatrol | 1 |

Genre badges are generated per subgenre in the genre tree; the table shows names for the main ones.

### Display & behavior

- **Unified style:** monochrome symbol with a red-blue offset, the level shown as the frame (thin → thick → double).
- **No secret badges:** all are visible, with progress ("7/10 closing sets").
- **A name per level** via `level_names`, maintained by the admin in the editor.
- **Revoking:** when a check-in is deleted or edited, the affected badges are recalculated. A lost level disappears without a notification.

## Branding

Name: **GSTLST**. Tagline: **Every set counts.** No Instagram account for now.

### Name

- **Idea:** "guestlist" without vowels. You read and say it as "guestlist", but it isn't the generic word – it looks like a door stamp or a club code.
- **Spelling:** wordmark always in capitals, `GSTLST`; slug, repo and URLs in lowercase, `gstlst`.
- **Logo:** the GSTLST wordmark inside a round entry stamp, printed with the red-blue offset (logo idea 1).
- **Check before launch:** a quick search found no app or brand called GSTLST (only an unrelated fashion app named STLST), but domain availability and trademarks still need a proper check at a registrar and the EUIPO before going public.

### Domains

Until launch the app stays on `forsti37.github.io/gstlst` (0 €). Later: one free domain for the first year via the GitHub Student Developer Pack; afterwards a regular renewal, e.g. `.app` (about 14 USD/year at Cloudflare cost price, enforces HTTPS) or `.club` (about 12 USD/year). Avoid `.live` promos (cheap first year, expensive renewal) and `.fm` (from about 68 USD/year). Sources: [Cloudflare TLD prices](https://github.com/baboon-king/cf-cheap-tlds), [.fm prices](https://tldes.com/fm), [student domains](https://domainoffer.net/blog/student-free-domains).

### Logo ideas

Red and blue as the left and right stereo channels: shapes are printed with a slight red-blue offset, like a smudged entry stamp or a strobe afterimage. This is the brand's recurring motif.

1. **Stamp:** a round entry hand-stamp with the name, red and blue slightly offset on top of each other.
2. **Speaker check:** a speaker cone seen from the front, a check mark in the middle as the check-in.
3. **Bassface glyph:** a face made of three strokes, the mouth is a waveform.
4. **Wave pin:** a location pin whose inner shape is a waveform.
5. **Wristband letter:** a festival wristband forms the first letter.

App icon: black background, white symbol, red and blue as a 2–3 px offset. For the beta Claude Code generates an SVG placeholder icon based on idea 1: the GSTLST wordmark as a round entry stamp.

### Design system

- **Dark mode by default**, true black for OLED; light mode optional.
- **Colors:** background #000000, surfaces #0E0E10 / #1A1A1D, text #F5F5F5 / #9A9AA0. Red #FF2D3D for own actions (check-in button, own stats). Blue #2D6BFF for social (friends, reactions, feed switch). Both together only in brand moments (logo, Wrapped).
- **Type:** Inter for UI, a condensed grotesque (e.g. Archivo Narrow or Anton) for big numbers and Wrapped headlines.
- **Interaction:** bottom navigation (Feed, Discover, Check-in in the middle, Inbox, Profile), all targets at least 48 px, key actions within thumb reach, haptic feedback on check-in.
- **Motion:** short transitions, respect `prefers-reduced-motion`; no flashing effects.

## Legal & Compliance

Everything is GDPR-compliant from day one; it costs little in the beta and saves a rebuild before launch. Not legal advice – someone qualified should review it before the public launch.

### Instagram profile pictures

- The copyright of a profile photo belongs to the photographer or artist. Linking to the profile is fine; copying or embedding the image is not.
- Instagram forbids automated scraping, and its image URLs expire quickly anyway.
- **Solution:** Instagram link on the artist profile (maintained by the admin). As the image, a generated avatar in brand style (initials with the red-blue offset). A real photo only if the artist uploads it after claiming the profile, or gives permission via DM – then the admin uploads it and records the source.

### GDPR

- Supabase project in the EU region (Frankfurt); accept Supabase's data processing agreement (DPA).
- **Data minimization for GPS:** coordinates are only sent to a server function that computes "near the venue: yes/no". Only the result is stored, never the location.
- Strip EXIF/GPS from all photos before upload.
- Home region as city only, used only for travel km, shown only aggregated.
- Private spending data is visible only to its owner (separate table, owner-only RLS).
- Account deletion (incl. photos, check-ins, reactions; created master data stays, anonymized) and data export as JSON in the settings.
- No tracking, no analytics cookies → no cookie banner needed.
- Privacy policy and imprint/disclosure under Austrian law as separate pages, in English and German.
- Terms of use: rules for photos, reporting process, right to remove content.

### Age

- Minimum age 16. Birth year is asked at sign-up; under 16 → no account.
- A note that the app does not replace age checks at events.

### Photos

- Every photo is first visible only to its uploader and goes into the moderation queue. Others see it only after approval.
- Report button on every photo and profile. Reported content is hidden until reviewed.
- Later: automatic pre-screening with an NSFW detection model so the queue stays manageable with more users.
- **No videos:** this saves storage and avoids music-rights issues a small app has no licenses for.
- People in the crowd: a hint at upload, no close-ups of strangers without their consent.

## Phase Plan & Prompts

Nine phases up to the full friends beta; after phase 3 the app is usable by the 10 testers. Workflow: export this document as Markdown and put it into the repo as `docs/SPEC.md`. Every prompt points to it, so Claude Code or Cursor doesn't need everything in the prompt itself.

| Phase | Content | Done when |
| --- | --- | --- |
| 0 | Repo, stack, PWA shell, CI/CD, design tokens, i18n | Empty app is installable from GitHub Pages |
| 1 | Database schema, RLS, seeds, sheet import | Daniel's history is clean in the DB, review list generated |
| 2 | Google auth, invite codes, profile, friends, privacy, GDPR basics | Testers can sign up and add each other |
| 3 | Check-in flow incl. creation, offline queue, photos, GPS verification | First real rave check-in works |
| 4 | Admin and moderation area, dashboard, feedback | Pending data and photos can be approved and merged |
| 5 | Feed, reactions, push, going, wishlist, tagging, blocking | Friends see each other live |
| 6 | Profile stats, explorer, map, leaderboards, comparison | Profile page complete |
| 7 | Badge and fun fact engine | Badges are awarded automatically |
| 8 | Wrapped incl. collage and sharing | Yearly Wrapped shareable |
| later | Domain, promoter/artist claims, Capacitor, setlists, muting | – |

### Prompt phase 0 – setup

```text
You are building GSTLST, an installable web app (PWA) where ravers check in to events and DJ sets – like Untappd, but for electronic music. The full specification is in docs/SPEC.md. Read it completely before you start and follow it. If anything in the spec is unclear or contradictory, ask me instead of guessing. Everything you write – code, comments, commits, docs – is in English. Running costs must stay at 0 €; do not add any paid service.

Phase 0:
1. Create a Vite + React + TypeScript (strict) project with Tailwind, React Router, TanStack Query, i18next (English default, German second) and vite-plugin-pwa.
2. Create a CLAUDE.md with: project goal in 3 sentences, pointer to docs/SPEC.md, folder structure, conventions (TypeScript strict, no any, features in src/features/<feature>, all UI text via i18n, mobile-first, min. 48px touch targets, English everywhere), commands for dev/test/build/deploy.
3. Design tokens from SPEC.md "Design system" as CSS variables and Tailwind theme. Dark mode is the default.
4. App shell: bottom navigation (Feed, Discover, Check-in in the middle, Inbox, Profile) with empty placeholder pages.
5. PWA manifest, service worker, placeholder app icon as SVG (logo idea 1: the GSTLST wordmark as a round entry stamp with red-blue offset) plus generated PNG icons and iOS splash screens.
6. Install onboarding: detect iOS Safari and explain "Share → Add to Home Screen"; use the native install prompt on Android.
7. GitHub Actions workflow: build + deploy to GitHub Pages for the repo forsti37/gstlst (base path /gstlst/), SPA fallback via 404.html.
8. GitHub Actions keep-alive cron that runs a lightweight query against the Supabase prod project every 3 days.
9. Prepare the Supabase client (env vars for dev and prod), no schema yet.
10. Set up Vitest and Playwright with one example test each.

At the end: summarize what was built, what I have to do manually (create Supabase projects in the EU region, set up Google OAuth, enable GitHub Pages, set secrets) and how to test it.
```

### Prompt phase 1 – database & import

```text
Read docs/SPEC.md, chapters "Data Model" and "Legal & Compliance". Implement phase 1:
1. Supabase migrations for all tables in the spec including enums, foreign keys, indexes, status columns and created_by.
2. Extensions pg_trgm and unaccent, a normalize_name() function and trigram indexes on artist, venue and promoter names and aliases. An RPC search_entities(type, query) returns matches with a similarity score.
3. RLS policies exactly as specified (approved readable by all logged-in users, pending only by creator/moderators/admins, check-ins and photos by visibility, blocks and moderation status, private_checkin_data owner-only). pgTAP tests for the key policies.
4. Merge functions merge_artist, merge_venue, merge_promoter, merge_event (admin only), writing to admin_audit_log.
5. Seeds: genre tree (Electronic → Drum & Bass with Liquid, Neurofunk, Jump Up, Dancefloor, Jungle, Rollers/Minimal, Deep, Halftime, Crossbreed, Techstep, Drumfunk; plus Techno, House, Dubstep, Trance, Hardstyle, Bass House and Breaks with sensible subgenres), set tags and event tags from the spec.
6. Import script (Node) for my CSV with the columns Jahr, Promoter, Event, Ort, Location, Artist, Lat, Long (coordinates use a decimal comma) plus a separate date list. It creates venues, promoters, series, events, sets and my imported check-ins. Detect names containing " & " as possible groups, but list them in the review file so I can decide duo vs. B2B. Everything imported is approved and owned by the admin user (from an env var).
7. The script writes data/import-review.md (gitignored, the repo is public) with: venues with differing coordinates, different venues sharing coordinates, events without artists, similarly spelled names (trigram > 0.6), and rows with missing or invalid dates.
8. Generate TypeScript types from the schema.

At the end: summary, open points, and how to run the import locally and against dev.
```

### Prompt phase 2 – accounts, friends, privacy

```text
Read docs/SPEC.md ("Feed & social", "Privacy", "Legal & Compliance"). Implement phase 2:
1. Sign-up only with a valid invite code. Login with Google only (no email/password, no magic links – the app must never send emails). On first login: username (unique, a-z, 0-9, _ and .), display name, birth year (under 16 → stop with a friendly explanation), acceptance of terms and privacy policy.
2. Edit profile: avatar (compressed, EXIF stripped), display name, home region (city only, optional), language (English/German).
3. Friends: send/accept/decline/remove requests, search by username. Public profile URL /u/{username} plus a QR code (shareable and saveable as an image). Opening the URL while logged in shows "Add as friend".
4. Block users: hides both sides from each other and ends the friendship; enforced in RLS.
5. Privacy settings: profile public/friends/private (default friends), configurable per area (stats, check-ins, photos, badges, map). Enforced in RLS and queries, not just in the UI.
6. Admin can create invite codes (max uses, expiry date).
7. GDPR: JSON data export, account deletion with confirmation (cascade as in the spec), pages for privacy policy, imprint/disclosure and terms of use with placeholder text in English and German.

At the end: summary, open points, test instructions.
```

### Prompt phase 3 – check-in

```text
Read docs/SPEC.md ("Check-in flow", "Event page", "Data Model / Rules", "Photos"). Implement phase 3. Goal: a check-in at 3 a.m., one-handed, with bad reception, in under 30 seconds.
1. Event selection: today's/yesterday's events nearby first (GPS if permitted), then search via search_entities. Create events with venue search/creation, promoter, series, date (multi-day possible), floors. Show duplicate suggestions before creating. Cancelled and postponed events are neither visible nor available for check-in.
2. Event check-in as specified (optional rating and sub-ratings for sound, crowd, location, lineup; text; tag friends), then the lineup grouped by floor with multi-select; create sets with artist search/creation, set type, MC, floor.
3. Per set: rating 0–5 in 0.5 steps (required), tags, genres prefilled from artist defaults, text, photo.
4. Add more sets later to the existing event check-in.
5. Pending entries are usable by their creator immediately and carry an "under review" label.
6. Offline: all writes (incl. photos) go into an IndexedDB queue (Dexie) with client_uuid; sync on the online event and on app start, idempotent on the server. Visible status "waiting to upload".
7. Photos: compressed client-side to max. 1600px, WebP, EXIF stripped; upload to a private bucket; moderation_status pending, visible only to the owner until approved. No videos.
8. GPS verification via a database function: receives coordinates, checks distance to the venue (< 500 m) and date, stores only verified_gps true/false.
9. Event page with lineup, timetable (if available) and a check-in button per set; propose timetables and event tags.
10. Edit and delete check-ins and ratings (GPS verification survives edits). Live window: until 12 h after the event ends. Optional private spending in private_checkin_data (owner-only).

At the end: summary, open points, test instructions including an offline test.
```

### Prompt phase 4 – admin & moderation

```text
Read docs/SPEC.md ("Admin & moderation", "Data Model / Rules"). Implement phase 4: an admin area (roles admin and moderator) with queues for new data points, change_requests, timetables, proposed tags, photos and reports. Actions: approve, reject with a reason, edit before approval, merge with duplicate suggestions (trigram similarity), verify check-ins manually, maintain genres, tags, aliases and artist countries, set events to cancelled or postponed. Role management in the dashboard (admin only can assign the moderator role). Creators get a notification about each decision. Every admin action is written to admin_audit_log. Also: an admin dashboard (active users, check-ins per week, queue lengths) and an in-app feedback button that creates a GitHub issue in forsti37/gstlst via an Edge Function (text, app version, device).
```

### Prompt phase 5 – feed, reactions, push

```text
Read docs/SPEC.md ("Feed & social", "Notifications", "Reactions"). Implement phase 5:
1. Feed with two tabs (Friends, Public), switched by horizontal swipe, infinite scroll, pull-to-refresh, login required. Public ranking by recency and proximity (city of the user's last check-in, current GPS only if permitted).
2. Feed card as specified, incl. the pending label and badges. Fun facts are not shown in the feed, only to the user themselves.
3. Reactions Bassface 😤, Dance 💃, Fire 🔥: one per user and target, changeable. Targets are event check-ins and individual set check-ins. The list of who reacted is visible.
4. Tag friends and adopt a tagged check-in.
5. Going for upcoming events with the list of friends going. Wishlist ("want to see") for artists, with a notification when they play nearby or a friend has seen them.
6. Web Push: VAPID, push_subscriptions, an Edge Function for sending, bundling per event (60-minute window), in-app inbox, settings per type and quiet hours. Ask for push permission only after the first check-in, and on iOS only in the installed app.
```

### Prompt phase 6 – stats

```text
Read docs/SPEC.md ("Profile & stats", "Privacy"). Implement phase 6: profile page with all headline numbers and analyses from the spec, map (MapLibre + OpenFreeMap tiles), calendar heatmap, streaks, travel km following the privacy rules in the spec. Explorer as an RPC with whitelisted dimensions and filters, output as table and chart. Friends leaderboards (verified check-ins only), top fans per artist and resident per venue (public profiles only), average sub-ratings per venue and an app-wide "best sound" ranking, comparison with friends (sets seen together, taste match). Privacy settings are enforced server-side. Stats via materialized views refreshed after check-ins and via pg_cron.
```

### Prompt phase 7 – badges & fun facts

```text
Read docs/SPEC.md ("Badges", "Fun facts"). Implement phase 7: rule engine with JSON rules as in the spec (incl. level_names), evaluated in Postgres after each check-in only for affected rules, with levels, limited time windows and custom rules as named SQL functions. Admin editor for badges with a live preview ("who would have it right now?"). Seed the full catalog from the spec, icons as unified SVG placeholders (monochrome, red-blue offset, level shown as the frame). No secret badges; progress is visible. When a check-in is deleted or edited, badges are recalculated and removed without notification if needed. Fun facts use the same engine without levels, plain tone, visible only to the user. Badge page in the profile, new badges shown after check-in, notification per new level. One-time backfill for existing check-ins without a notification flood.
```

### Prompt phase 8 – Wrapped

```text
Read docs/SPEC.md ("Wrapped", "Design system"). Implement phase 8: Wrapped for year, month, season, custom range and per event. 9:16 story slides with swipe and a progress bar; content and rave personas as specified, incl. the "Rave Buddy No. 1" slide; collage of all approved photos with generated tiles for check-ins without a photo. Export every slide and a summary as PNG via html-to-image, share via the Web Share API, plus a link /wrapped/{username}/{period} that respects privacy settings. The spending slide appears only in the user's own view, never in exports or links. Admin function to unlock a Community Wrapped at year end. All texts in i18n files; tone: scene slang, a bit cheeky, not cringe. The yearly Wrapped unlocks on December 1st with a note that the rest of December is added later.
```

## Open Questions

None. The name is set to GSTLST and every decision is in this spec – it is ready for Claude Code or Cursor.
