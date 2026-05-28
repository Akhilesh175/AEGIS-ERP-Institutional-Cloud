-- =====================================================================
-- AEGIS DATABASE FIX: REAL-TIME FORUMS & DISCUSSION BOARDS RLS
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Upgrade the school ID helper to support all roles dynamically
CREATE OR REPLACE FUNCTION get_auth_user_school_id()
RETURNS UUID AS $$
DECLARE
  v_school_id UUID;
  v_role TEXT;
BEGIN
  -- Get user school_id and role directly from users table first
  SELECT school_id, role::text INTO v_school_id, v_role FROM public.users WHERE id = auth.uid();
  IF v_school_id IS NOT NULL THEN
    RETURN v_school_id;
  END IF;

  -- Fallback logic for roles where school_id is in secondary profile tables
  IF v_role = 'STUDENT' THEN
    SELECT school_id INTO v_school_id FROM public.students WHERE user_id = auth.uid();
  ELSIF v_role = 'TEACHER' THEN
    SELECT school_id INTO v_school_id FROM public.teachers WHERE user_id = auth.uid();
  ELSIF v_role = 'PARENT' THEN
    SELECT school_id INTO v_school_id FROM public.parents WHERE user_id = auth.uid();
  END IF;

  RETURN v_school_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Define visibility helpers for students and parents
CREATE OR REPLACE FUNCTION get_student_class_id()
RETURNS UUID AS $$
  SELECT class_id FROM public.students WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION is_parent_linked_to_class(cid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.students s
    JOIN public.parent_student_mappings psm ON s.id = psm.student_id
    JOIN public.parents p ON psm.parent_id = p.id
    WHERE p.user_id = auth.uid() AND s.class_id = cid
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION get_auth_user_role()
RETURNS TEXT AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 3. Ensure Row Level Security (RLS) is enabled on all forum tables
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;

-- 4. Define and apply SELECT policies
DROP POLICY IF EXISTS "Select forum categories" ON public.forum_categories;
CREATE POLICY "Select forum categories" 
ON public.forum_categories FOR SELECT USING (
  school_id = get_auth_user_school_id() AND (
    class_id IS NULL OR
    get_auth_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER') OR
    (get_auth_user_role() = 'STUDENT' AND class_id = get_student_class_id()) OR
    (get_auth_user_role() = 'PARENT' AND is_parent_linked_to_class(class_id))
  )
);

DROP POLICY IF EXISTS "Select forum posts" ON public.forum_posts;
CREATE POLICY "Select forum posts" 
ON public.forum_posts FOR SELECT USING (
  category_id IN (
    SELECT id FROM public.forum_categories
  )
);

DROP POLICY IF EXISTS "Select forum replies" ON public.forum_replies;
CREATE POLICY "Select forum replies" 
ON public.forum_replies FOR SELECT USING (
  post_id IN (
    SELECT id FROM public.forum_posts
  )
);

-- 5. Define and apply WRITE/MANAGEMENT policies
DROP POLICY IF EXISTS "Insert/Update/Delete forum categories" ON public.forum_categories;
CREATE POLICY "Insert/Update/Delete forum categories" 
ON public.forum_categories FOR ALL USING (
  school_id = get_auth_user_school_id() AND
  get_auth_user_role() IN ('SUPER_ADMIN', 'ADMIN', 'TEACHER')
);

DROP POLICY IF EXISTS "Insert/Update/Delete forum posts" ON public.forum_posts;
CREATE POLICY "Insert/Update/Delete forum posts" 
ON public.forum_posts FOR ALL USING (
  category_id IN (
    SELECT id FROM public.forum_categories
  ) AND (
    author_id = auth.uid() OR
    get_auth_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  )
);

DROP POLICY IF EXISTS "Insert/Update/Delete forum replies" ON public.forum_replies;
CREATE POLICY "Insert/Update/Delete forum replies" 
ON public.forum_replies FOR ALL USING (
  post_id IN (
    SELECT id FROM public.forum_posts
  ) AND (
    author_id = auth.uid() OR
    get_auth_user_role() IN ('SUPER_ADMIN', 'ADMIN')
  )
);

-- 6. Grant access privileges on public schema
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_replies TO authenticated;
