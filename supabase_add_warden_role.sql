-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ADD WARDEN TO USER_ROLE ENUM
-- Exposes the Warden role to public.users table mapping constraints.
-- =====================================================================

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'WARDEN';
