-- AEGIS ENTERPRISE MIGRATION: UPDATE HOSTEL LEAVE WORKFLOW & SUPPORT HOLD STATUS
-- Run this in your Supabase SQL Editor (https://supabase.com)

-- 1. Drop existing check constraints on hostel_leave_requests if they exist
ALTER TABLE public.hostel_leave_requests DROP CONSTRAINT IF EXISTS hostel_leave_requests_parent_approval_check;
ALTER TABLE public.hostel_leave_requests DROP CONSTRAINT IF EXISTS hostel_leave_requests_warden_approval_check;
ALTER TABLE public.hostel_leave_requests DROP CONSTRAINT IF EXISTS hostel_leave_requests_admin_approval_check;
ALTER TABLE public.hostel_leave_requests DROP CONSTRAINT IF EXISTS hostel_leave_requests_status_check;

-- 2. Add hostel_admin_approval column to hostel_leave_requests
ALTER TABLE public.hostel_leave_requests ADD COLUMN IF NOT EXISTS hostel_admin_approval TEXT NOT NULL DEFAULT 'PENDING';

-- 3. Add updated check constraints to support 'PENDING', 'APPROVED', 'REJECTED', and 'HOLD'
ALTER TABLE public.hostel_leave_requests ADD CONSTRAINT hostel_leave_requests_parent_approval_check CHECK (parent_approval IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD'));
ALTER TABLE public.hostel_leave_requests ADD CONSTRAINT hostel_leave_requests_warden_approval_check CHECK (warden_approval IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD'));
ALTER TABLE public.hostel_leave_requests ADD CONSTRAINT hostel_leave_requests_hostel_admin_approval_check CHECK (hostel_admin_approval IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD'));
ALTER TABLE public.hostel_leave_requests ADD CONSTRAINT hostel_leave_requests_admin_approval_check CHECK (admin_approval IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD'));
ALTER TABLE public.hostel_leave_requests ADD CONSTRAINT hostel_leave_requests_status_check CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'HOLD'));
