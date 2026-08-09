-- Migration unit 1: schema_changes
-- Transaction mode: transactional
-- Boundary reason: default

SET check_function_bodies = false;

DROP EXTENSION pg_net;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT DELETE, INSERT, SELECT, UPDATE ON TABLES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT, USAGE ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

GRANT ALL ON FUNCTION public.handle_new_user() TO anon;

GRANT ALL ON FUNCTION public.handle_new_user() TO authenticated;

GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;

GRANT ALL ON FUNCTION public.is_admin() TO anon;

GRANT ALL ON FUNCTION public.is_admin() TO authenticated;

GRANT ALL ON FUNCTION public.is_admin() TO service_role;

GRANT DELETE, INSERT, UPDATE ON public.films TO anon;

GRANT DELETE, INSERT, UPDATE ON public.films TO authenticated;

GRANT DELETE, INSERT, UPDATE ON public.profiles TO anon;

GRANT DELETE, INSERT, UPDATE ON public.profiles TO authenticated;

CREATE TABLE public.progress (
  user_id uuid  NOT NULL,
  watched jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE public.progress
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.progress
  ADD CONSTRAINT progress_pkey PRIMARY KEY (user_id);

ALTER TABLE public.progress
  ADD CONSTRAINT progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

GRANT ALL ON public.progress TO anon;

GRANT ALL ON public.progress TO authenticated;

GRANT ALL ON public.progress TO service_role;

CREATE POLICY "Users can insert their own progress" ON public.progress
  FOR INSERT
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can update their own progress" ON public.progress
  FOR UPDATE
  USING ((auth.uid() = user_id))
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can view their own progress" ON public.progress
  FOR SELECT
  USING ((auth.uid() = user_id));

GRANT DELETE, INSERT, UPDATE ON public.services TO anon;

GRANT DELETE, INSERT, UPDATE ON public.services TO authenticated;
