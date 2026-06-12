-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ADD WARDEN ID TO HOSTEL BLOCKS
-- Maps direct block-to-warden relationship for Student/Parent portals
-- =====================================================================

ALTER TABLE public.hostel_blocks ADD COLUMN IF NOT EXISTS warden_id UUID REFERENCES public.hostel_wardens(id) ON DELETE SET NULL;
