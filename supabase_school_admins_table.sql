-- =====================================================================
-- AEGIS DATABASE MIGRATION: DEDICATED SCHOOL ADMINS TABLE & RBAC
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create school_admins table
CREATE TABLE IF NOT EXISTS public.school_admins (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role_settings TEXT DEFAULT 'ADMIN',
  permissions JSONB DEFAULT '{"all": true}'::jsonb,
  status TEXT DEFAULT 'ACTIVE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Migrate existing school admins from users table
-- This preserves existing administrative credentials and institution mappings.
INSERT INTO public.school_admins (user_id, school_id, role_settings, permissions, status)
SELECT id, school_id, 'ADMIN', '{"all": true}'::jsonb, 'ACTIVE'
FROM public.users
WHERE role = 'ADMIN' AND school_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.school_admins ENABLE ROW LEVEL SECURITY;

-- 4. Define school-scoped SELECT policy
-- Admins and school members can only view administrative records of their own school
DROP POLICY IF EXISTS "Users can view their school admins" ON public.school_admins;
CREATE POLICY "Users can view their school admins" 
ON public.school_admins FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

-- 5. Verify constraint and migration results
SELECT COUNT(*) as migrated_admins_count FROM public.school_admins;
