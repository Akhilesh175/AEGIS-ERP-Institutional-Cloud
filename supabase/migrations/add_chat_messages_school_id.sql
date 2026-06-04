-- =====================================================================
-- AEGIS ENTERPRISE MIGRATION: ADD CHAT MESSAGES SCHOOL ID AND SCHOOL ISOLATION
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Add school_id to chat_messages if not exists
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

-- 2. Add conversation_thread to chat_messages if not exists
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS conversation_thread TEXT;

-- 3. Populate school_id for existing messages based on the sender's school_id
UPDATE public.chat_messages cm
SET school_id = u.school_id
FROM public.users u
WHERE cm.sender_id = u.id AND cm.school_id IS NULL;

-- 4. If there are still any messages without school_id (e.g. from superadmin to a school user),
-- set it from the receiver's school_id.
UPDATE public.chat_messages cm
SET school_id = u.school_id
FROM public.users u
WHERE cm.receiver_id = u.id AND cm.school_id IS NULL;

-- 5. If any are still NULL (fallback to first school)
UPDATE public.chat_messages
SET school_id = (SELECT id FROM public.schools LIMIT 1)
WHERE school_id IS NULL;

-- 6. Alter column school_id to be NOT NULL now that it is backfilled
ALTER TABLE public.chat_messages ALTER COLUMN school_id SET NOT NULL;

-- 7. Add index for performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_school_id ON public.chat_messages(school_id);

-- 8. Enable RLS on chat_messages if not already enabled
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 9. Create security policies for school isolation
DROP POLICY IF EXISTS "Users can view chat messages in school" ON public.chat_messages;
CREATE POLICY "Users can view chat messages in school" ON public.chat_messages
  FOR SELECT USING (school_id = get_auth_user_school_id());

DROP POLICY IF EXISTS "Users can insert chat messages in school" ON public.chat_messages;
CREATE POLICY "Users can insert chat messages in school" ON public.chat_messages
  FOR INSERT WITH CHECK (school_id = get_auth_user_school_id());
