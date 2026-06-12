-- =====================================================================
-- ENHANCED HELP & SUPPORT CENTER SCHEMA MIGRATION
-- =====================================================================

-- Drop tables if they already exist
DROP TABLE IF EXISTS public.support_ticket_status_logs CASCADE;
DROP TABLE IF EXISTS public.support_ticket_messages CASCADE;
DROP TABLE IF EXISTS public.support_notifications CASCADE;
DROP TABLE IF EXISTS public.support_tickets CASCADE;
DROP TABLE IF EXISTS public.bug_reports CASCADE;

-- 1. Sequence for sequential ticket numbering
DROP SEQUENCE IF EXISTS public.support_ticket_number_seq CASCADE;
CREATE SEQUENCE public.support_ticket_number_seq START 1001;

-- 2. support_tickets Table
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  assigned_to UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to automatically populate ticket_number on insert
CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := 'TKT-' || nextval('public.support_ticket_number_seq')::text;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_generate_ticket_number
BEFORE INSERT ON public.support_tickets
FOR EACH ROW
EXECUTE FUNCTION public.generate_ticket_number();

-- 3. support_ticket_messages Table
CREATE TABLE public.support_ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,
  message TEXT NOT NULL,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. support_ticket_status_logs Table
CREATE TABLE public.support_ticket_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  old_status TEXT NOT NULL,
  new_status TEXT NOT NULL,
  changed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. support_notifications Table
CREATE TABLE public.support_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. bug_reports Table
CREATE TABLE public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  page_url TEXT,
  bug_title TEXT NOT NULL,
  description TEXT NOT NULL,
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'INVESTIGATING', 'FIXED', 'CLOSED')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance Indices
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_school ON public.support_tickets(school_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_messages_ticket ON public.support_ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_support_notifications_user ON public.support_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_school ON public.bug_reports(school_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_ticket_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- support_tickets
CREATE POLICY "Users can select support tickets" ON public.support_tickets
  FOR SELECT USING (
    user_id = auth.uid() OR school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can insert support tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update support tickets" ON public.support_tickets
  FOR UPDATE USING (
    user_id = auth.uid() OR school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can delete support tickets" ON public.support_tickets
  FOR DELETE USING (
    user_id = auth.uid() OR school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

-- support_ticket_messages
CREATE POLICY "Users can select ticket messages" ON public.support_ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR t.school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Users can insert ticket messages" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR t.school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN')
    )
  );

-- support_ticket_status_logs
CREATE POLICY "Users can view ticket status logs" ON public.support_ticket_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR t.school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Users can create ticket status logs" ON public.support_ticket_status_logs
  FOR INSERT WITH CHECK (
    changed_by = auth.uid()
  );

-- support_notifications
CREATE POLICY "Users can view their support notifications" ON public.support_notifications
  FOR SELECT USING (
    user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can update their support notifications" ON public.support_notifications
  FOR UPDATE USING (
    user_id = auth.uid()
  );

CREATE POLICY "System can insert support notifications" ON public.support_notifications
  FOR INSERT WITH CHECK (
    true
  );

-- bug_reports
CREATE POLICY "Users can view bug reports" ON public.bug_reports
  FOR SELECT USING (
    user_id = auth.uid() OR school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can submit bug reports" ON public.bug_reports
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Admins can update bug reports" ON public.bug_reports
  FOR UPDATE USING (
    school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );
