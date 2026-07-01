-- Add father_name and mother_name columns to students table
ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS father_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100);
