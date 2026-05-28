-- =====================================================================
-- AEGIS DATABASE FIX: REGISTRATION & ACCESS CONTROL RLS POLICIES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Helper function to fetch the auth user's school_id bypassing RLS
-- SECURITY DEFINER ensures it runs with high owner (postgres) privileges.
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. Ensure RLS is enabled on all core user/profile tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parents ENABLE ROW LEVEL SECURITY;

-- 3. USERS SELECT policy (Prevent recursion and enforce school isolation)
DROP POLICY IF EXISTS "Users can view other users in their school" ON public.users;
CREATE POLICY "Users can view other users in their school" 
ON public.users FOR SELECT USING (
  id = auth.uid() OR 
  school_id = get_auth_user_school_id()
);

-- 4. STUDENTS SELECT policy
DROP POLICY IF EXISTS "Users can view their school students" ON public.students;
CREATE POLICY "Users can view their school students" 
ON public.students FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 5. TEACHERS SELECT policy
DROP POLICY IF EXISTS "Users can view their school teachers" ON public.teachers;
CREATE POLICY "Users can view their school teachers" 
ON public.teachers FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 6. PARENTS SELECT policy
DROP POLICY IF EXISTS "Users can view their school parents" ON public.parents;
CREATE POLICY "Users can view their school parents" 
ON public.parents FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 7. Grant access privileges on public schema to all roles
GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO postgres;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon;
