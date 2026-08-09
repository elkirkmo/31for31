-- profiles: admin role, one row per auth user (auto-created via trigger)
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- security definer function breaks the recursive-RLS cycle (a policy on
-- profiles that queries profiles directly recurses into itself)
create function public.is_admin()
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

create policy "profiles_select_own"   on public.profiles for select using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles for select using (public.is_admin());
create policy "profiles_update_admin" on public.profiles for update
  using (public.is_admin()) with check (public.is_admin());

-- films
create table public.films (
  id            bigint generated always as identity primary key,
  year          smallint not null,
  sort_order    integer not null default 0,  -- preserves data.json array order
  date          text not null,                -- display string, e.g. "10/1/2025"
  title         text not null,
  justwatch_url text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (year, title)
);
alter table public.films enable row level security;
create policy "films_public_read" on public.films for select using (true);
create policy "films_admin_write" on public.films for all
  using (public.is_admin()) with check (public.is_admin());
create index films_year_idx on public.films (year);

-- services: per-film streaming offers
create table public.services (
  id         bigint generated always as identity primary key,
  film_id    bigint not null references public.films(id) on delete cascade,
  name       text not null,
  type       text not null check (type in ('free','subscription','rent','buy','cinema','unknown')),
  price      numeric,
  currency   text,
  link       text,
  icon       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.services enable row level security;
create policy "services_public_read" on public.services for select using (true);
create policy "services_admin_write" on public.services for all
  using (public.is_admin()) with check (public.is_admin());
create index services_film_id_idx on public.services (film_id);

-- bootstrap (run manually, once). Uses insert ... on conflict rather than a
-- plain update: an update silently matches zero rows if the trigger hasn't
-- created the profiles row yet (e.g. run before the intended admin has ever
-- logged in), which is easy to miss.
-- insert into public.profiles (id, is_admin)
-- values ('<uuid from auth.users>', true)
-- on conflict (id) do update set is_admin = true;

-- ── explicit grants ────────────────────────────────────────────────
-- Newer Supabase projects (and the local CLI, as of the config's
-- `auto_expose_new_tables` note) no longer auto-expose new public-schema
-- tables to the API roles without explicit GRANTs. The hosted project this
-- app runs on predates that default, so these were working by accident;
-- granting explicitly here makes local and remote behave the same and
-- doesn't depend on a legacy default that's already being phased out.
grant select on public.profiles to anon, authenticated;
grant all on public.profiles to service_role;

grant select on public.films to anon, authenticated;
grant all on public.films to service_role;

grant select on public.services to anon, authenticated;
grant all on public.services to service_role;

grant usage on sequence public.films_id_seq to service_role;
grant usage on sequence public.services_id_seq to service_role;
