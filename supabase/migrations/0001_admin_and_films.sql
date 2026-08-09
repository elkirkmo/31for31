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

-- bootstrap (run manually, once, AFTER the intended admin has logged in at
-- least once so the trigger has created their profiles row):
-- update public.profiles set is_admin = true where id = '<uuid from auth.users>';
