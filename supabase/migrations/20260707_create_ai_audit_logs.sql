-- =========================================================================
-- AEGIS ERP – AI Audit Logs Schema
-- Run in Supabase → SQL Editor → New Query → Run
-- Safe to run multiple times (IDEMPOTENT)
-- =========================================================================

-- Create ai_audit_logs table
CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  school_id     UUID,
  role          TEXT NOT NULL,
  prompt        TEXT NOT NULL,
  response      TEXT NOT NULL,
  action_taken  TEXT,
  latency_ms    INTEGER,
  status        TEXT NOT NULL DEFAULT 'SUCCESS', -- SUCCESS, BLOCKED_INJECTION, RATE_LIMIT, ERROR
  token_count   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexing for search performance
CREATE INDEX IF NOT EXISTS idx_ai_logs_school_id ON public.ai_audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_user_id ON public.ai_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_created_at ON public.ai_audit_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view AI logs of their school" ON public.ai_audit_logs;
DROP POLICY IF EXISTS "Anyone can insert AI logs" ON public.ai_audit_logs;

-- Policies: School Admins & Sub Admins can read their school's logs. Super Admins can read all.
CREATE POLICY "Admins can view AI logs of their school" ON public.ai_audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND (
        (users.role IN ('ADMIN', 'ACADEMIC_ADMIN', 'FINANCE_ADMIN') AND users.school_id = ai_audit_logs.school_id)
        OR users.role = 'SUPER_ADMIN'
      )
    )
  );

-- Anyone can insert logs (includes anonymous landing page visitors)
CREATE POLICY "Anyone can insert AI logs" ON public.ai_audit_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
