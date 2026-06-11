-- Migration: Add status and deleted_at columns to forum tables
ALTER TABLE public.forum_categories 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';

ALTER TABLE public.forum_categories 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

ALTER TABLE public.forum_posts 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'ACTIVE';

ALTER TABLE public.forum_posts 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
