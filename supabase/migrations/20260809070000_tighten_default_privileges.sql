-- `supabase db pull` surfaced that this project's default privileges
-- automatically grant SELECT/INSERT/UPDATE/DELETE to anon and
-- authenticated on every NEW public-schema table -- not just read
-- access. RLS already blocks unauthorized writes on every table today,
-- but this means RLS is the *only* backstop: a future table created
-- without RLS enabled (an easy mistake) would be fully readable and
-- writable by anyone, logged in or not. Tighten the default so future
-- tables require explicit grants -- matching Supabase's current cloud
-- default (see supabase/config.toml's auto_expose_new_tables note) --
-- and revoke the excess write grants already sitting on our existing
-- tables from that old default.

alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated;

-- Existing tables: keep the public-read grants that are actually used
-- (films/services SELECT for the site, profiles SELECT for a user's own
-- row via profiles_select_own), drop the write grants RLS was silently
-- backstopping alone -- all writes to these three go through the
-- service-role client (src/lib/server/supabaseAdmin.ts), never the
-- user's own session, so anon/authenticated never legitimately need
-- insert/update/delete here.
revoke insert, update, delete on public.films from anon, authenticated;
revoke insert, update, delete on public.services from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;

-- progress: authenticated users insert/update their own row directly
-- (see the toggleWatched action, which uses the user's own session, not
-- the service-role client) per its existing RLS policies. anon can
-- never satisfy auth.uid() = user_id, so it never legitimately needs
-- any grant here. delete was granted but has no RLS policy at all for
-- it -- drop it rather than leave an ungated grant sitting unused.
revoke all on public.progress from anon, authenticated;
grant select, insert, update on public.progress to authenticated;
