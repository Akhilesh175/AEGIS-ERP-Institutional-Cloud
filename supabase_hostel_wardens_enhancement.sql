-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ENHANCE HOSTEL WARDENS TABLE
-- Adds columns for warden registration and assignments.
-- =====================================================================

ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS assigned_locations JSONB DEFAULT '[]'::jsonb;
