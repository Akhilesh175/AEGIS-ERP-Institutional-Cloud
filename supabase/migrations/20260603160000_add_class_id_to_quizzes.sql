-- Migration: Add class_id to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE;

-- Create an index to optimize class-scoped quiz queries
CREATE INDEX IF NOT EXISTS idx_quizzes_class_id ON public.quizzes(class_id);
