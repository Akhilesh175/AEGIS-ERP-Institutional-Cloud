-- =====================================================================
-- AEGIS DATABASE MIGRATION: BRANDING ASSETS & SIGNATURES STORAGE
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Add branding columns to schools table
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_file_name TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_uploaded_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS seal_url TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS seal_file_name TEXT;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS seal_uploaded_at TIMESTAMP WITH TIME ZONE;

-- 2. Add signature columns to school_admins table
ALTER TABLE public.school_admins ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.school_admins ADD COLUMN IF NOT EXISTS signature_uploaded_at TIMESTAMP WITH TIME ZONE;

-- 3. Add signature columns to teachers table
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS signature_uploaded_at TIMESTAMP WITH TIME ZONE;

-- 4. Create file upload audit table
CREATE TABLE IF NOT EXISTS public.file_upload_audit (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('logo', 'seal', 'school_admin_signature', 'teacher_signature')),
  file_url TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Enable Row Level Security (RLS) on audit table
ALTER TABLE public.file_upload_audit ENABLE ROW LEVEL SECURITY;

-- 6. Define RLS Policies for audit logs
DROP POLICY IF EXISTS "Users can view school audit logs" ON public.file_upload_audit;
CREATE POLICY "Users can view school audit logs" 
ON public.file_upload_audit FOR SELECT USING (
  school_id = get_auth_user_school_id()
);

DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.file_upload_audit;
CREATE POLICY "Service role can insert audit logs" 
ON public.file_upload_audit FOR INSERT WITH CHECK (
  true
);

-- 7. Create indexes for optimization
CREATE INDEX IF NOT EXISTS idx_file_upload_audit_school ON public.file_upload_audit(school_id);
CREATE INDEX IF NOT EXISTS idx_file_upload_audit_uploader ON public.file_upload_audit(uploaded_by);

-- 8. Provision Supabase Storage Buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('school-assets', 'school-assets', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']),
  ('admin-signatures', 'admin-signatures', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg']),
  ('teacher-signatures', 'teacher-signatures', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/jpg'])
ON CONFLICT (id) DO NOTHING;

-- Enable public read access policies on storage objects if not already configured
DROP POLICY IF EXISTS "Public Select Access on school-assets" ON storage.objects;
CREATE POLICY "Public Select Access on school-assets" ON storage.objects FOR SELECT USING (bucket_id = 'school-assets');

DROP POLICY IF EXISTS "Public Select Access on admin-signatures" ON storage.objects;
CREATE POLICY "Public Select Access on admin-signatures" ON storage.objects FOR SELECT USING (bucket_id = 'admin-signatures');

DROP POLICY IF EXISTS "Public Select Access on teacher-signatures" ON storage.objects;
CREATE POLICY "Public Select Access on teacher-signatures" ON storage.objects FOR SELECT USING (bucket_id = 'teacher-signatures');
