-- =====================================================================
-- AEGIS DATABASE MIGRATION: SECURE PROFILE PHOTOS & AVATARS
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Create the public 'avatars' storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 
  'avatars', 
  true, 
  5242880, -- 5 MB size limit
  ARRAY[
    'image/jpeg', 
    'image/jpg', 
    'image/png', 
    'image/gif', 
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 2. Grant permissions on storage schema objects (if needed)
GRANT ALL ON TABLE storage.objects TO authenticated;
GRANT ALL ON TABLE storage.objects TO service_role;
GRANT ALL ON TABLE storage.buckets TO authenticated;
GRANT ALL ON TABLE storage.buckets TO service_role;
