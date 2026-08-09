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

There's no local/mocked Supabase instance — `.env.local` points at the real hosted Supabase project, so data written while developing lands in the production database.

To log in without going through the magic-link email flow, a **Dev login** button appears on the `/login` page whenever the app is running in dev mode (`npm run dev`). It signs in using the `DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` values in your `.env.local` (copy `.env.example` to get started) — that user must already exist in the Supabase project's Auth users table (create it via the Supabase dashboard if it's missing). Without those env vars set, the button shows a "Dev login is not configured" error instead of crashing.

Because this hits the real database, toggling "watched" checkboxes while developing persists to the same `progress` table used in production, scoped to the dev user's row. Keep that in mind when testing — it's real, shared data, not a sandbox.

## Admin page

`/admin` is a role-gated area for managing film/streaming-offer data. Access is controlled by an `is_admin` flag on Supabase's `profiles` table — unrelated to the `DEV_LOGIN_EMAIL` login above.

### One-time setup (per Supabase project)

1. Run `supabase/migrations/0001_admin_and_films.sql` in the Supabase SQL editor. Creates `profiles`, `films`, and `services`, plus a trigger that auto-creates a `profiles` row for every new auth user.
2. Log in once (magic link or the dev login button) so the trigger creates your `profiles` row, then find your uuid under Authentication → Users in the Supabase dashboard and run:
   ```sql
   insert into public.profiles (id, is_admin)
   values ('<your uuid>', true)
   on conflict (id) do update set is_admin = true;
   ```
   Use `insert ... on conflict`, not a plain `update` — an `update` silently matches zero rows (no error) if the trigger hasn't created your `profiles` row yet, which is easy to miss. Verify it worked with `select id, is_admin from public.profiles where id = '<your uuid>';` before moving on.
3. Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` (Supabase dashboard → Project Settings → API → `service_role` secret) — the admin pages use it to bypass RLS.
4. Run `npm run migrate:data` once to import `src/data.json`'s films/services into the new tables. Idempotent, so safe to re-run, but only needs to happen once per project.

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
