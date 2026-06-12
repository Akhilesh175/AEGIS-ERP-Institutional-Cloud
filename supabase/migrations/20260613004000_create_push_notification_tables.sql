-- =====================================================================
-- PUSH NOTIFICATION SYSTEM & FCM TOKENS SCHEMA
-- =====================================================================

-- 1. Notifications Table
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

-- Notifications Policies
CREATE POLICY users_read_own_notifications ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY users_update_own_notifications ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

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

-- 2. FCM Tokens Table
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on fcm_tokens table
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;

-- FCM Tokens Policies
CREATE POLICY users_manage_own_fcm_tokens ON public.fcm_tokens
  FOR ALL
  USING (auth.uid() = user_id);

-- Enable real-time replication
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.fcm_tokens REPLICA IDENTITY FULL;

COMMENT ON TABLE public.notifications IS 'Contains user push notifications, supporting multi-school context with strict isolation policies.';
COMMENT ON TABLE public.fcm_tokens IS 'Contains Firebase Cloud Messaging registration tokens mapped to user ID and role context.';
