-- =====================================================================
-- AEGIS DATABASE MIGRATION: SECURE & STANDARDIZED PHONE NUMBER STORAGE
-- Run this in your Supabase SQL Editor
-- =====================================================================

-- 1. Create phone number type enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'phone_number_type') THEN
    CREATE TYPE phone_number_type AS ENUM ('PRIMARY', 'EMERGENCY', 'HOME', 'WORK');
  END IF;
END
$$;

-- 2. Create the phone_numbers table
CREATE TABLE IF NOT EXISTS public.phone_numbers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE, -- NULL for SUPER_ADMIN
  phone_type phone_number_type DEFAULT 'PRIMARY' NOT NULL,
  country_code VARCHAR(10) NOT NULL,
  national_number VARCHAR(20) NOT NULL,
  full_number VARCHAR(30) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent duplicate number types for the same user
  CONSTRAINT unique_user_phone_type UNIQUE (user_id, phone_type),
  
  -- Enforce globally unique phone numbers
  CONSTRAINT unique_full_phone_number UNIQUE (full_number),
  
  -- Database-level ITU-T E.164 Standard Validations
  -- Country code: starts with '+' followed by 1 to 4 digits (e.g. +1, +91)
  CONSTRAINT chk_country_code CHECK (country_code ~ '^\+[0-9]{1,4}$'),
  
  -- National number: 6 to 15 digits
  CONSTRAINT chk_national_number CHECK (national_number ~ '^[0-9]{6,15}$'),
  
  -- Full number: must be the direct concatenation of country_code + national_number
  CONSTRAINT chk_full_number_match CHECK (full_number = country_code || national_number)
);

-- 3. High Performance Indexes
CREATE INDEX IF NOT EXISTS idx_phone_numbers_user ON public.phone_numbers(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_school ON public.phone_numbers(school_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_full ON public.phone_numbers(full_number);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;

-- 5. Define Select RLS Policy (School Isolation)
DROP POLICY IF EXISTS "Users can view phone numbers in their school" ON public.phone_numbers;
CREATE POLICY "Users can view phone numbers in their school"
ON public.phone_numbers FOR SELECT USING (
  -- Super Admin can view all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR 
  -- Users can view their own phone numbers
  user_id = auth.uid()
  OR
  -- Users can view other phone numbers inside their school
  school_id = get_auth_user_school_id()
);

-- 6. Define Mutation RLS Policy (Write / Update Restrictions)
DROP POLICY IF EXISTS "Users can manage their own phone numbers or school admins can update them" ON public.phone_numbers;
CREATE POLICY "Users can manage their own phone numbers or school admins can update them"
ON public.phone_numbers FOR ALL USING (
  -- Super Admin can manage all
  (SELECT role::text FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  OR
  -- Users can manage their own
  user_id = auth.uid()
  OR
  -- School Admins can manage numbers inside their school
  (
    (SELECT role::text FROM public.users WHERE id = auth.uid()) IN ('ADMIN') 
    AND school_id = get_auth_user_school_id()
  )
);

-- 7. Automatically Migrate Existing Users Phone Numbers
-- Parse the legacy phone strings (e.g. '+1 (555) 123-4567') into clean country code and national numbers
-- and insert them into the new table
DO $$
DECLARE
  r RECORD;
  v_country_code VARCHAR(10);
  v_national_number VARCHAR(20);
  v_clean_phone VARCHAR(30);
BEGIN
  FOR r IN SELECT id, phone, school_id FROM public.users WHERE phone IS NOT NULL AND phone <> '' LOOP
    -- Remove spaces, dashes, parentheses
    v_clean_phone := regexp_replace(r.phone, '[^0-9+]', '', 'g');
    
    -- If it starts with '+'
    IF v_clean_phone ~ '^\+[0-9]+$' THEN
      -- Try to separate: default to first 2-3 characters for country code
      IF v_clean_phone LIKE '+91%' THEN
        v_country_code := '+91';
        v_national_number := substring(v_clean_phone from 4);
      ELSIF v_clean_phone LIKE '+1%' THEN
        v_country_code := '+1';
        v_national_number := substring(v_clean_phone from 3);
      ELSE
        v_country_code := substring(v_clean_phone from 1 for 3);
        v_national_number := substring(v_clean_phone from 4);
      END IF;
    ELSE
      -- Fallback: default to +91 country code
      v_country_code := '+91';
      v_national_number := v_clean_phone;
    END IF;
    
    -- Clean any extra characters
    v_national_number := regexp_replace(v_national_number, '[^0-9]', '', 'g');
    
    -- Insert if valid format
    IF v_country_code ~ '^\+[0-9]{1,4}$' AND v_national_number ~ '^[0-9]{6,15}$' THEN
      INSERT INTO public.phone_numbers (user_id, school_id, phone_type, country_code, national_number, full_number)
      VALUES (r.id, r.school_id, 'PRIMARY', v_country_code, v_national_number, v_country_code || v_national_number)
      ON CONFLICT (user_id, phone_type) DO NOTHING
      ON CONFLICT (full_number) DO NOTHING;
    END IF;
  END LOOP;
END
$$;

-- 8. Grant SQL Access Privileges
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_numbers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phone_numbers TO service_role;
