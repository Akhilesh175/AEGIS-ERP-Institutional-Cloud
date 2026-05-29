-- =====================================================================
-- AEGIS DATABASE MIGRATION: SECURE & STANDARDIZED EMAIL ADDRESS STORAGE
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create email address type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_address_type') THEN
    CREATE TYPE email_address_type AS ENUM ('LOGIN', 'CONTACT', 'PERSONAL', 'WORK');
  END IF;
END
$$;

-- 2. Create the email_addresses table
CREATE TABLE IF NOT EXISTS public.email_addresses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE, -- NULL for SUPER_ADMIN
  email_type email_address_type DEFAULT 'CONTACT' NOT NULL,
  email TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false NOT NULL,
  is_verified BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent exact duplicate emails globally
  CONSTRAINT unique_email UNIQUE (email),
  
  -- Database-level email formatting validation constraint (RFC 5322 regex check)
  CONSTRAINT chk_email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  
  -- Database-level lowercase normalization constraint to prevent duplicate bypasses
  CONSTRAINT chk_email_lowercase CHECK (email = LOWER(email))
);

-- 3. High Performance Unique Indexes
-- Enforce at most one primary email address per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_primary_email 
ON public.email_addresses (user_id) 
WHERE (is_primary = true);

-- Enforce at most one login email address per user
CREATE UNIQUE INDEX IF NOT EXISTS unique_login_email 
ON public.email_addresses (user_id) 
WHERE (email_type = 'LOGIN');

-- 4. High Performance Query Indexes
CREATE INDEX IF NOT EXISTS idx_email_addresses_user ON public.email_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_email_addresses_school ON public.email_addresses(school_id);
CREATE INDEX IF NOT EXISTS idx_email_addresses_email ON public.email_addresses(email);

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.email_addresses ENABLE ROW LEVEL SECURITY;

-- 6. Define Select RLS Policy (School Isolation)
DROP POLICY IF EXISTS "Users can view email addresses in their school" ON public.email_addresses;
CREATE POLICY "Users can view email addresses in their school"
ON public.email_addresses FOR SELECT USING (
  -- Super Admin can view all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR 
  -- Users can view their own email addresses
  user_id = auth.uid()
  OR
  -- Users can view other email addresses inside their school
  school_id = get_auth_user_school_id()
);

-- 7. Define Mutation RLS Policy (Write / Update Restrictions)
DROP POLICY IF EXISTS "Users can manage their own email addresses or school admins can update them" ON public.email_addresses;
CREATE POLICY "Users can manage their own email addresses or school admins can update them"
ON public.email_addresses FOR ALL USING (
  -- Super Admin can manage all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR
  -- Users can manage their own
  user_id = auth.uid()
  OR
  -- School Admins can manage emails inside their school
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('ADMIN') 
    AND school_id = get_auth_user_school_id()
  )
);

-- 8. Automatically Migrate Existing Users Login Emails
-- Extract legacy email fields, convert to lower case, validate, and seed them as Primary Login emails
DO $$
DECLARE
  r RECORD;
  v_clean_email TEXT;
BEGIN
  FOR r IN SELECT id, email, school_id FROM public.users WHERE email IS NOT NULL AND email <> '' LOOP
    -- Trim whitespace and force lowercase
    v_clean_email := LOWER(TRIM(r.email));
    
    -- Verify format matches constraint
    IF v_clean_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
      -- Double check no conflicting record exists
      IF NOT EXISTS (SELECT 1 FROM public.email_addresses WHERE email = v_clean_email) THEN
        INSERT INTO public.email_addresses (user_id, school_id, email_type, email, is_primary, is_verified)
        VALUES (r.id, r.school_id, 'LOGIN', v_clean_email, true, true);
      END IF;
    END IF;
  END LOOP;
END
$$;

-- 9. Grant SQL Access Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_addresses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_addresses TO service_role;
