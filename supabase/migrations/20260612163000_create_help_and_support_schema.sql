-- =====================================================================
-- AEGIS HELP & SUPPORT CENTER SCHEMA MIGRATION
-- =====================================================================

-- 1. system_status Table
CREATE TABLE IF NOT EXISTS public.system_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPERATIONAL' CHECK (status IN ('OPERATIONAL', 'DEGRADED_PERFORMANCE', 'PARTIAL_OUTAGE', 'MAJOR_OUTAGE')),
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. knowledge_base Table
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  target_roles TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. support_tickets Table
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. bug_reports Table
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_role TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  steps_to_reproduce TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'INVESTIGATING', 'FIXED', 'CLOSED')),
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_school ON public.support_tickets(school_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_user ON public.bug_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_bug_reports_school ON public.bug_reports(school_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.system_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Anyone can view system status" ON public.system_status;
DROP POLICY IF EXISTS "Super Admins can manage system status" ON public.system_status;
DROP POLICY IF EXISTS "Anyone can view knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Super Admins and Admins can manage knowledge base" ON public.knowledge_base;
DROP POLICY IF EXISTS "Users can select support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can insert support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can update support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can delete support tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Users can select bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can insert bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can update bug reports" ON public.bug_reports;
DROP POLICY IF EXISTS "Users can delete bug reports" ON public.bug_reports;

-- RLS Policies
CREATE POLICY "Anyone can view system status" ON public.system_status 
  FOR SELECT USING (true);

CREATE POLICY "Super Admins can manage system status" ON public.system_status 
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Anyone can view knowledge base" ON public.knowledge_base 
  FOR SELECT USING (true);

CREATE POLICY "Super Admins and Admins can manage knowledge base" ON public.knowledge_base 
  FOR ALL USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) IN ('SUPER_ADMIN', 'ADMIN')
  );

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

CREATE POLICY "Users can select bug reports" ON public.bug_reports 
  FOR SELECT USING (
    user_id = auth.uid() OR school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can insert bug reports" ON public.bug_reports 
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "Users can update bug reports" ON public.bug_reports 
  FOR UPDATE USING (
    user_id = auth.uid() OR school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );

CREATE POLICY "Users can delete bug reports" ON public.bug_reports 
  FOR DELETE USING (
    user_id = auth.uid() OR school_id = get_auth_user_school_id() OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'SUPER_ADMIN'
  );


-- =====================================================================
-- SEED DATA PREPOPULATION
-- =====================================================================

-- Seed System Status
INSERT INTO public.system_status (service_name, status, description) VALUES
  ('Core ERP Console', 'OPERATIONAL', 'All core modules are performing normally.'),
  ('Database Engine', 'OPERATIONAL', 'Data operations and replication are fully functional.'),
  ('Aegis Communicator', 'OPERATIONAL', 'Realtime chat and messaging server online.'),
  ('Document Engine', 'OPERATIONAL', 'Report cards, receipts, and templates printing service operational.'),
  ('Payment Gateway Integration', 'OPERATIONAL', 'Stripe, card, and net banking systems operational.'),
  ('Transit & Fleet Telemetry', 'OPERATIONAL', 'Bus logs, driver registry, and routing functional.'),
  ('Hostel Hub Core', 'OPERATIONAL', 'Warden registers, bed vacancy, and check-in APIs operational.')
ON CONFLICT (service_name) DO UPDATE SET
  status = EXCLUDED.status,
  description = EXCLUDED.description,
  updated_at = NOW();

-- Seed Knowledge Base Articles
INSERT INTO public.knowledge_base (title, category, content, target_roles) VALUES
  (
    'Aegis Communicator: Contact Discovery Help',
    'Communicator',
    '### Aegis Communicator Guide

The Aegis Communicator allows direct messaging between permitted roles under strict administrative safety controls:

* **School Admins** can discover and chat with all Super Admins, all Sub-Admins, and all Teachers.
* **Super Admins** can discover and chat with School Admins from their respective registered institutions.
* **Teachers, Parents, and Students** have role-specific discovery permissions synchronized in real-time.

**Common Troubleshooting:**
* If you see "0 contacts available", try logging out and logging back in to force a refresh of your cached credentials.',
    ARRAY['STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN']
  ),
  (
    'How to Download and Verify Student Report Cards',
    'Academics',
    '### Student Report Cards & Grades

Report cards are generated digitally by Homeroom teachers and can be verified by anyone globally via a unique secure QR link.

* **Parents & Students:** Navigate to **Report Cards** or **Grades Progress** from your dashboard to view marks.
* **Verification:** Every printed report card contains a verification URL at the bottom: `#/verify/marksheet/[UUID]`. Navigating to this URL allows anyone (e.g., colleges, boards) to instantly pull the original record directly from our secure disaster recovery ledger.',
    ARRAY['STUDENT', 'PARENT', 'TEACHER', 'ADMIN']
  ),
  (
    'Hostel Hub: Student Check-In and Leave Workflow',
    'Hostel Management',
    '### Hostel Hub Guide

Hostel administration follows a strict 4-level validation flow:

1. **Room Assignment:** Admin checks in a student into a vacant bed. The bed status automatically shifts from `VACANT` to `OCCUPIED`.
2. **Leave Request:** Students or parents submit leave requests detailing travel plans.
3. **Approval Sequence:** Leave requests must go through **Parent Approval** → **Warden Approval** → **Hostel Admin Approval** → **School Admin Approval**.
4. **Status Updates:** The request status shifts to `APPROVED` only after all four checkpoints approve.',
    ARRAY['STUDENT', 'PARENT', 'TEACHER', 'ADMIN']
  ),
  (
    'Billing and Online Fee Invoicing',
    'Billing & Fees',
    '### Fee Invoicing and Ledgers

* **Tuition Fees:** Invoiced automatically per academic session based on the student''s class registry.
* **Hostel Fees:** Created by the Hostel Admin and invoiced directly to student portal ledgers.
* **Payments:** Can be paid online via Stripe or logged manually as Cash/Bank Transfer in the Invoicing Office. Live receipts are automatically appended to the Documents Center.',
    ARRAY['STUDENT', 'PARENT', 'ADMIN']
  ),
  (
    'Transit Registry & Route Assignments',
    'Transport & Transit',
    '### School Transit & Route Assignment

* **Students:** Under the **School Transit** tab, students can view their assigned route, vehicle number plate, driver name, driver phone number, and pickup point details.
* **Admins:** Manage drivers, vehicle logs (maintenance, fuel), routes, and assignments. All mutation actions are logged to the global transport audit stream for security compliance.',
    ARRAY['STUDENT', 'PARENT', 'ADMIN']
  );
