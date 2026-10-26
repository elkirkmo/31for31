-- Liked films, per user, alongside `watched` and in the same shape:
-- {"2024": ["Trick R Treat", ...]}, titles keyed by year.
--
-- Written by the scraper's /me/liked endpoint *as the user* (their access
-- token, forwarded to PostgREST), so the existing progress policies -- a user
-- can select/insert/update only their own row -- are what authorise it. The
-- table-level grants to `authenticated` already cover a new column.
alter table public.progress
  add column liked jsonb not null default '{}'::jsonb;
