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

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

> To deploy your app, you may need to install an [adapter](https://kit.svelte.dev/docs/adapters) for your target environment.
