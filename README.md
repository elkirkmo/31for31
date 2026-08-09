# 31 for 31

A website for Last Podcast On The Left's 31 for 31 movies to watch this October 2024

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

## Development

Development runs against a local Supabase stack (Postgres, Auth, PostgREST) in Docker — not the production database. Requires [Docker](https://www.docker.com/) running locally.

1. Copy `.env.example` to `.env.local`.
2. `npm run db:start` — starts the local stack (first run pulls Docker images, takes a minute). Prints an API URL and anon/service_role keys; paste those into `.env.local` as `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`.
3. `npm run db:reset` — applies every migration in `supabase/migrations/` to a fresh local database and runs `supabase/seed.sql`, which seeds a ready-to-go local admin account (`dev@example.com` / `devpassword` by default — set `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` in `.env.local` to match, or edit the seed to use different ones).
4. `npm run migrate:data` — imports `src/data.json`'s films/services into the local database (the same script originally used to migrate production; it just acts on whatever `.env.local` currently points at).
5. `npm run dev`, then use the **Dev login** button on `/login`. Signs in as the seeded user — `/admin` works immediately, since that user is pre-bootstrapped as admin by the seed. No manual dashboard steps for local dev.

`npm run db:stop` shuts the stack down. `npm run db:reset` is safe to run anytime you want a clean slate — this is a fully disposable local database.

**Schema changes**: `npx supabase migration new <name>`, edit the generated file, `npm run db:reset` to verify it applies cleanly, then `npx supabase db push` to ship it to production once you're confident (one-time setup: `npx supabase login && npx supabase link --project-ref <ref>`). This replaces pasting SQL directly into the production dashboard.

**Type generation**: `npm run db:types` regenerates `src/database.generated.types.ts` from the local schema. Hand-written convenience types (`WatchedFilms`, etc.) live in `src/database.types.ts`, which re-exports from the generated file — don't hand-edit the generated one, it'll be overwritten.

**Still real**: the [31for31scraper](https://31for31scraper.vercel.app) API (`SCRAPER_API_KEY`) is a separate external service, unaffected by any of this — admin actions that call it hit the real thing even in local dev.

**Working against production directly** (rare — e.g. re-running `scripts/migrate-data-to-supabase.mjs` after a schema change ships): swap `.env.local`'s Supabase values for the production project's (Project Settings → API in the dashboard). Anything you do while pointed at production is real, shared data — not a sandbox.

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
3. Set `SUPABASE_SERVICE_ROLE_KEY` (that project's value, Project Settings → API → `service_role` secret) wherever the admin pages run against it — the admin pages use it to bypass RLS.
4. Run `npm run migrate:data`, pointed at that project, to import `src/data.json`'s films/services. Idempotent, so safe to re-run, but only needs to happen once per project.

After that, the homepage reads films/services from Supabase instead of `src/data.json` (`data.json` is still used for the page's `textContent` copy — that part hasn't moved).

### Dev bypass

In `npm run dev`, an "Admin (dev)" link appears in the header for any logged-in user regardless of `is_admin` — `requireAdmin()` skips the role check when `dev` is true (still requires being logged in). Production builds (`npm run build` / `preview`) always enforce the real `is_admin` check.

### Editing films

`/admin/films` add/edit/delete calls the [31for31scraper](https://31for31scraper.vercel.app) API rather than writing to Supabase directly, so it needs `SCRAPER_API_KEY` in `.env.local` (must match that service's own `ADMIN_API_KEY`). **Known limitation:** the scraper's write endpoints currently persist only to its own `data.json`, which is read-only on Vercel production — writes succeed against the scraper but won't take effect until the scraper migrates its storage to Supabase. Called out in the admin UI itself, not just here.

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
