-- =====================================================================
-- PUSH NOTIFICATION SYSTEM SCHEMA
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL, -- e.g., 'HOMEWORK', 'QUIZ', 'FEE', 'CHAT', 'GRADE', 'ANNOUNCEMENT'
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 1. Users can SELECT notifications belonging strictly to their own user id
CREATE POLICY users_read_own_notifications ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- 2. Users can UPDATE (e.g. mark as read) their own notifications
CREATE POLICY users_update_own_notifications ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- 3. School Admins can SELECT all notifications within their school context
CREATE POLICY school_admins_read_notifications ON public.notifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'ADMIN'
        AND users.school_id = notifications.school_id
    )
  );

-- 4. School Admins can INSERT/DELETE notifications within their school context
CREATE POLICY school_admins_manage_notifications ON public.notifications
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role = 'ADMIN'
        AND users.school_id = notifications.school_id
    )
  );

-- Enable real-time replication for notifications table
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
COMMENT ON TABLE public.notifications IS 'Contains user push notifications, supporting multi-school context with strict isolation policies.';
