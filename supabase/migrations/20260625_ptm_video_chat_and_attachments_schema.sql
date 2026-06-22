-- 1. Create ptm_chat_attachments table
CREATE TABLE IF NOT EXISTS public.ptm_chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  public_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create ptm_participants table (to register active participant states)
CREATE TABLE IF NOT EXISTS public.ptm_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT ptm_participants_unique_session UNIQUE (meeting_id, user_id, joined_at)
);

-- 3. Create ptm_messages table (to persist text message logs)
CREATE TABLE IF NOT EXISTS public.ptm_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  meeting_id UUID NOT NULL REFERENCES public.ptm_meetings(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.ptm_chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ptm_messages ENABLE ROW LEVEL SECURITY;

-- Helper function get_auth_user_school_id() or fallback
CREATE OR REPLACE FUNCTION public.get_auth_user_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 5. RLS Policies (multi-tenant school isolation)
DROP POLICY IF EXISTS ptm_chat_attachments_policy ON public.ptm_chat_attachments;
CREATE POLICY ptm_chat_attachments_policy ON public.ptm_chat_attachments
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS ptm_participants_policy ON public.ptm_participants;
CREATE POLICY ptm_participants_policy ON public.ptm_participants
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

DROP POLICY IF EXISTS ptm_messages_policy ON public.ptm_messages;
CREATE POLICY ptm_messages_policy ON public.ptm_messages
  FOR ALL TO authenticated
  USING (
    school_id = public.get_auth_user_school_id()
    AND EXISTS (SELECT 1 FROM public.ptm_meetings WHERE id = meeting_id)
  );

-- 6. Add to Supabase Realtime publication
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_chat_attachments;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_participants;
  EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ptm_messages;
  EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
