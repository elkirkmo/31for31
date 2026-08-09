-- Runs after migrations on `supabase db reset` / first `supabase start`.
-- Seeds a fixed local-only admin account so local dev never needs the
-- manual production bootstrap dance (see README "Admin page" section).
--
-- These are throwaway local credentials, not secrets -- set
-- DEV_LOGIN_EMAIL / DEV_LOGIN_PASSWORD in .env.local to match so the
-- existing dev-login button (src/routes/login/+page.server.ts) signs in
-- as this user:
--   DEV_LOGIN_EMAIL=dev@example.com
--   DEV_LOGIN_PASSWORD=devpassword

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change,
  email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-1111-1111-111111111111',
  'authenticated',
  'authenticated',
  'dev@example.com',
  extensions.crypt('devpassword', extensions.gen_salt('bf')),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
);

insert into auth.identities (
  id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values (
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  '11111111-1111-1111-1111-111111111111',
  format('{"sub":"%s","email":"%s"}', '11111111-1111-1111-1111-111111111111', 'dev@example.com')::jsonb,
  'email',
  now(),
  now(),
  now()
);

-- handle_new_user() (from the admin_and_films migration) already created a
-- profiles row for this user via the auth.users trigger -- just flip it.
update public.profiles set is_admin = true
where id = '11111111-1111-1111-1111-111111111111';
