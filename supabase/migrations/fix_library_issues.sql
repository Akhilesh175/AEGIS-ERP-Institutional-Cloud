-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: LIBRARY BOOK ISSUES DATABASE CONSTRAINTS FIX
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Truncate table to prevent foreign key mismatch on existing records if any
TRUNCATE TABLE public.book_issues CASCADE;

-- 2. Drop the old foreign key constraint that references the public.books table
ALTER TABLE public.book_issues DROP CONSTRAINT IF EXISTS book_issues_book_id_fkey;

-- 3. Add the correct foreign key constraint referencing public.book_inventory(id)
ALTER TABLE public.book_issues 
  ADD CONSTRAINT book_issues_book_id_fkey 
  FOREIGN KEY (book_id) 
  REFERENCES public.book_inventory(id) 
  ON DELETE CASCADE;

-- 4. Alter column user_id to be NULL since student_id is the primary reference in V2
ALTER TABLE public.book_issues ALTER COLUMN user_id DROP NOT NULL;

-- 5. Re-create decrement/increment copies helpers to ensure book_inventory is updated properly
CREATE OR REPLACE FUNCTION public.decrement_available_copies(p_book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.book_inventory
    SET available_copies = GREATEST(0, available_copies - 1)
    WHERE id = p_book_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_available_copies(p_book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.book_inventory
    SET available_copies = LEAST(total_copies, available_copies + 1)
    WHERE id = p_book_id;
END;
$$;
