# 31 for 31

A website for Last Podcast On The Left's 31 for 31 movies to watch this October 2024

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

`npm run dev` also starts the local Supabase stack if it isn't already up — see "Development" below for the full local setup, which you'll need to do once before this works.

## Development

Development runs against a local Supabase stack (Postgres, Auth, PostgREST) in Docker — not the production database. Requires [Docker](https://www.docker.com/) running locally.

1. Copy `.env.example` to `.env.local`.
2. `npm run db:start` — starts the local stack (first run pulls Docker images, takes a minute). Prints an API URL and anon/service_role keys; paste those into `.env.local` as `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`. You only need to run this by hand for the initial key-copying step — from then on `npm run dev` starts the stack for you (see below).
3. `npm run db:reset` — applies every migration in `supabase/migrations/` to a fresh local database and runs `supabase/seed.sql`, which seeds a ready-to-go local admin account (`dev@example.com` / `devpassword` by default — set `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` in `.env.local` to match, or edit the seed to use different ones).
4. `npm run migrate:data` — imports `src/data.json`'s films/services into the local database (the same script originally used to migrate production; it just acts on whatever `.env.local` currently points at).
5. `npm run db:placeholders` — optional. The scraper only fills in streaming offers once a year's real titles are published, so next year's placeholder films arrive with none. In dev the release gate is bypassed and the homepage opens on the newest year, which means a fresh local database lands on a list with nothing to click. This gives every film in an offer-less year one offer of each type (free / subscription / rent / buy), sampled from real rows so they render like the real thing. Local-only — it refuses to run against anything but `127.0.0.1`. Idempotent, and it skips years that already have offers, so a genuinely un-streamable film in a scraped year (Thanksgiving in 2025) keeps its empty state.
6. `npm run dev`, then use the **Dev login** button on `/login`. Signs in as the seeded user — `/admin` works immediately, since that user is pre-bootstrapped as admin by the seed. No manual dashboard steps for local dev.

`npm run db:stop` shuts the stack down. `npm run db:reset` is safe to run anytime you want a clean slate — this is a fully disposable local database.

**`npm run dev` starts the local stack for you.** It runs `scripts/dev-supabase.mjs` first, which brings Supabase up if it isn't already running, and is a no-op when it is. This exists because a stopped stack doesn't fail loudly — the app boots fine and then misbehaves in ways that don't point at the cause (films silently missing from the list, the dev login erroring). If Docker itself isn't running it says so and tells you to start it, rather than surfacing a Docker socket error.

Use `npm run dev:app` to skip that check and run Vite alone — the right choice when `.env.local` points at a real Supabase project rather than the local stack. (The check skips itself automatically in that case anyway, since there'd be no local stack to start.)

**Schema changes**: `npx supabase migration new <name>`, edit the generated file, `npm run db:reset` to verify it applies cleanly, then `npx supabase db push` to ship it to production once you're confident (one-time setup: `npx supabase login && npx supabase link --project-ref <ref>`). This replaces pasting SQL directly into the production dashboard.

**Type generation**: `npm run db:types` regenerates `src/database.generated.types.ts` from the local schema. Hand-written convenience types (`WatchedFilms`, etc.) live in `src/database.types.ts`, which re-exports from the generated file — don't hand-edit the generated one, it'll be overwritten.

**Still real**: the [31for31scraper](https://31for31scraper.vercel.app) API (`SCRAPER_API_KEY`) is a separate external service, unaffected by any of this — admin actions that call it hit the real thing even in local dev.

**Working against production directly** (rare — e.g. re-running `scripts/migrate-data-to-supabase.mjs` after a schema change ships): swap `.env.local`'s Supabase values for the production project's (Project Settings → API in the dashboard). Anything you do while pointed at production is real, shared data — not a sandbox.

**Secrets stay out of the repo.** Every `.env*` file is gitignored except `.env.example`, which contains nothing but empty quotes. Nothing here needs a real credential to develop or test against: `npm test` mocks `src/lib/server/supabaseAdmin.ts` at the module boundary, so the suite passes on a machine with no `.env` file of any kind — which is exactly how CI runs it.

`.gitignore` deliberately carries no `!.env.test` exception. It used to, and that was a trapdoor: this repo is public, so a real service-role key written to a tracked file is both instant and irreversible, and nothing about the mistake is loud at the time you make it. If you fork this and want a committed env file for integration tests, re-add the exception knowingly and keep real keys out of it. The local stack's keys (printed by `npm run db:start`) are safe to share — they're identical on every Supabase install — but a production project's are not, and the two are indistinguishable at a glance.

## Admin page

`/admin` is a role-gated area for managing film/streaming-offer data. Access is controlled by an `is_admin` flag on Supabase's `profiles` table — unrelated to the `DEV_LOGIN_EMAIL` login above.

### One-time setup

Local dev gets this for free from `npm run db:reset` (see "Development" above — the seed creates a pre-bootstrapped local admin, no manual steps). For a **production** Supabase project that doesn't have this yet:

1. Apply every migration in `supabase/migrations/` in order — `npx supabase link --project-ref <ref> && npx supabase db push`, or paste each file into the SQL editor manually. Creates `profiles`, `films`, and `services`, plus a trigger that auto-creates a `profiles` row for every new auth user.
2. Log in once (magic link) so the trigger creates your `profiles` row, then find your uuid under Authentication → Users in the Supabase dashboard and run:
   ```sql
   insert into public.profiles (id, is_admin)
   values ('<your uuid>', true)
   on conflict (id) do update set is_admin = true;
   ```
   Use `insert ... on conflict`, not a plain `update` — an `update` silently matches zero rows (no error) if the trigger hasn't created your `profiles` row yet, which is easy to miss. Verify it worked with `select id, is_admin from public.profiles where id = '<your uuid>';` before moving on.
3. Set `SUPABASE_SERVICE_ROLE_KEY` (that project's value, Project Settings → API → `service_role` secret) wherever the app runs — not just where you use the admin pages. It's used to bypass RLS for admin CRUD *and* for self-service account deletion on `/account`, so it's required in every environment (see "User accounts" below).
4. Run `npm run migrate:data`, pointed at that project, to import `src/data.json`'s films/services. Idempotent, so safe to re-run, but only needs to happen once per project.

After that, the homepage reads films/services from Supabase instead of `src/data.json` (`data.json` is still used for the page's `textContent` copy — that part hasn't moved).

### Dev bypass

In `npm run dev`, an "Admin (dev)" link appears in the header for any logged-in user regardless of `is_admin` — `requireAdmin()` skips the role check when `dev` is true (still requires being logged in). Production builds (`npm run build` / `preview`) always enforce the real `is_admin` check.

### Editing films

`/admin/films` add/edit/delete calls the [31for31scraper](https://31for31scraper.vercel.app) API rather than writing to Supabase directly, so it needs `SCRAPER_API_KEY` in `.env.local` (must match that service's own `ADMIN_API_KEY`). **Known limitation:** the scraper's write endpoints currently persist only to its own `data.json`, which is read-only on Vercel production — writes succeed against the scraper but won't take effect until the scraper migrates its storage to Supabase. Called out in the admin UI itself, not just here.

## User accounts

Accounts are optional. The film list and streaming links work fully logged out — an account exists only so a user's watched films persist between visits. Signed-in users get `/account`, which lists everything stored about them (their email address and their watched films) and lets them delete the account themselves, without an admin in the loop.

### Deletion is self-service, and only ever self

**If you fork this, read this before touching the delete action.**

`/account`'s `deleteAccount` action deletes a Supabase auth user using the service-role key, which is capable of deleting *any* user. The only thing that stops it doing so is that the action reads no identifier from the request at all:

```ts
const { user } = await safeGetSession()
if (!user) throw redirect(303, '/login')
await supabaseAdmin.auth.admin.deleteUser(user.id)
```

`user.id` comes from `safeGetSession()`, which validates the JWT via `getUser()` (see `src/hooks.server.ts`) rather than trusting the session cookie as-is. There is no email, id, or any other parameter in the form body — so there is no attacker-controlled input, and therefore no authorization check that can be written incorrectly. The property is structural, not a guard clause.

Adding an identifier parameter to that action — a hidden form field, a query param, "just for admins" — converts it into an endpoint that deletes arbitrary accounts on request, protected by nothing. Don't. `src/routes/account/page.server.test.ts` posts `email`, `id`, and `user_id` for a different user and asserts the caller's own id is still the only one deleted; keep that test.

Deleting the auth user is the whole operation: `profiles` and `progress` both foreign-key to `auth.users(id)` with `ON DELETE CASCADE`, so their rows go with it. Nothing else needs cleaning up.

### `SUPABASE_SERVICE_ROLE_KEY` is required in every environment

Not just where you intend to use `/admin`. Because account deletion runs through it, the key is now load-bearing for a **user-facing** route. `src/lib/server/supabaseAdmin.ts` throws at import time when the variable is unset, so a deployment missing it does not degrade gracefully — `/account` errors for logged-in users. Set it wherever the app runs.

### The login page makes privacy promises on your behalf

`/login` tells users their email is used only for the sign-in link, is never sold or shared, and that they will never receive marketing email. That copy lives in `src/data.json` under `textContent.login`. If you fork this and intend to do anything else with user email addresses, change the copy to match what you actually do.

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
