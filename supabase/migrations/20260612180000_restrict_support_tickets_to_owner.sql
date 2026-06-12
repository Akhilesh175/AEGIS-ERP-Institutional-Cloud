-- =====================================================================
-- RESTRICT SUPPORT TICKETS & BUG REPORTS TO OWNER OR SUPER ADMIN
-- =====================================================================

-- 1. Drop existing policies for support_tickets
DROP POLICY IF EXISTS "Users can select support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can update support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can delete support tickets" ON public.support_tickets;

-- Re-create support_tickets policies
CREATE POLICY "Users can select support tickets" ON public.support_tickets
  FOR SELECT USING (
    user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can update support tickets" ON public.support_tickets
  FOR UPDATE USING (
    user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can delete support tickets" ON public.support_tickets
  FOR DELETE USING (
    user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );


-- 2. Drop existing policies for support_ticket_messages
DROP POLICY IF EXISTS "Users can select ticket messages" ON public.support_ticket_messages;
DROP POLICY IF EXISTS "Users can insert ticket messages" ON public.support_ticket_messages;

-- Re-create support_ticket_messages policies
CREATE POLICY "Users can select ticket messages" ON public.support_ticket_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Users can insert ticket messages" ON public.support_ticket_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN')
    )
  );


-- 3. Drop existing policies for support_ticket_status_logs
DROP POLICY IF EXISTS "Users can view ticket status logs" ON public.support_ticket_status_logs;

-- Re-create support_ticket_status_logs policies
CREATE POLICY "Users can view ticket status logs" ON public.support_ticket_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets t 
      WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN')
    )
  );


-- 4. Drop existing policies for bug_reports
DROP POLICY IF EXISTS "Users can view bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Admins can update bug reports" ON public.bug_reports;

-- Re-create bug_reports policies
CREATE POLICY "Users can view bug reports" ON public.bug_reports
  FOR SELECT USING (
    user_id = auth.uid() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Admins can update bug reports" ON public.bug_reports
  FOR UPDATE USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );
