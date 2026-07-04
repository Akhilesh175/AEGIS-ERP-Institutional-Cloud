-- =========================================================================
-- AEGIS ERP – Make Last Name Optional in Users Table
-- Run in Supabase → SQL Editor → New Query → Run
-- Safe to run multiple times (IDEMPOTENT)
-- =========================================================================

-- Step 1: Remove NOT NULL constraint from last_name column in users table
ALTER TABLE public.users
  ALTER COLUMN last_name DROP NOT NULL;

-- Step 2: Set default value to empty string
ALTER TABLE public.users
  ALTER COLUMN last_name SET DEFAULT '';
