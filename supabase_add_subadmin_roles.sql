-- =====================================================================
-- AEGIS DATABASE MIGRATION: ADD ENTERPRISE SUB-ADMIN ROLES TO ENUM
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- Alter the user_role enum to add new enterprise-grade sub-admin roles.
-- These values match the user custom roles in the frontend:
-- 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', and 'TRANSPORT_MANAGER'.

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'FINANCE_ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'ACADEMIC_ADMIN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'EXAM_CONTROLLER';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'LIBRARIAN';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'TRANSPORT_MANAGER';

COMMENT ON TYPE public.user_role IS 'Defines system authorization roles, including core and sub-admin enterprise classifications.';
