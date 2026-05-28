-- =====================================================================
-- AEGIS DATABASE MIGRATION: COMPOSITE ROLL NUMBER UNIQUENESS
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Deduplicate any existing invalid duplicate roll numbers (if any)
-- Keeps the oldest student record (smallest id/created_at) and sets duplicate roll numbers to NULL
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY school_id, academic_session_id, class_id, roll_number 
           ORDER BY created_at ASC, id ASC
         ) as rn
  FROM public.students
  WHERE roll_number IS NOT NULL
)
UPDATE public.students
SET roll_number = NULL
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- 2. Drop existing constraint if it exists to avoid conflicts
ALTER TABLE public.students 
  DROP CONSTRAINT IF EXISTS unique_school_session_class_roll;

-- 3. Add the composite UNIQUE constraint
-- This allows different schools and classes to use the same roll numbers,
-- but strictly prevents duplicates within the same school + session + class.
ALTER TABLE public.students 
  ADD CONSTRAINT unique_school_session_class_roll UNIQUE (school_id, academic_session_id, class_id, roll_number);

-- 4. Verify constraints are applied
SELECT conname, pg_get_constraintdef(c.oid) 
FROM pg_constraint c 
JOIN pg_namespace n ON n.oid = c.connamespace 
WHERE conname = 'unique_school_session_class_roll';
