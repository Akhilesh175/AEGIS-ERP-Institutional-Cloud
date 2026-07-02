-- ============================================================
-- AEGIS ERP – Student Documents Management System Migration
-- Run this in your Supabase SQL Editor (Database → SQL Editor)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- TABLE 1: student_profiles
-- Extended student data linked 1:1 to students table
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.student_profiles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id          UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id           UUID NOT NULL,
  -- Personal extended fields
  blood_group         TEXT,
  aadhaar_number      TEXT,
  nationality         TEXT DEFAULT 'Indian',
  religion            TEXT,
  category            TEXT DEFAULT 'General', -- General / OBC / SC / ST / EWS
  -- Address
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  state               TEXT,
  pincode             TEXT,
  country             TEXT DEFAULT 'India',
  -- Academic admission info
  house               TEXT,  -- House/team name
  admission_date      DATE,
  previous_school     TEXT,
  previous_class      TEXT,
  previous_board      TEXT,
  previous_percentage TEXT,
  -- Student photo (separate from auth avatar)
  photo_url           TEXT,
  -- Extended parent info
  father_occupation   TEXT,
  father_email        TEXT,
  mother_name         TEXT,
  mother_phone        TEXT,
  mother_email        TEXT,
  mother_occupation   TEXT,
  -- Metadata
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique constraint: one profile per student
CREATE UNIQUE INDEX IF NOT EXISTS idx_student_profiles_student_id
  ON public.student_profiles(student_id);

-- Index for school isolation queries
CREATE INDEX IF NOT EXISTS idx_student_profiles_school_id
  ON public.student_profiles(school_id);

-- RLS
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;

-- School-scoped policy: users can only see profiles from their own school
CREATE POLICY "school_isolation" ON public.student_profiles
  FOR ALL
  USING (school_id = (
    SELECT school_id FROM public.users WHERE id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- TABLE 2: generated_documents
-- Tracks every document ever generated per student
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.generated_documents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL,
  student_id            UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  document_type         TEXT NOT NULL,
  -- e.g. 'id_card' | 'admission_form' | 'admission_record' | 'bonafide'
  --      | 'character_certificate' | 'transfer_certificate'
  --      | 'certificate_of_excellence'
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by_user_id  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  generated_by_role     TEXT,
  version               INTEGER NOT NULL DEFAULT 1,
  verification_number   TEXT UNIQUE,   -- e.g. AEGIS-DOC-2025-XXXX
  qr_data               TEXT,
  pdf_url               TEXT,          -- Supabase Storage URL (optional future use)
  status                TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | REVOKED | SUPERSEDED
  metadata              JSONB,         -- Any extra data (e.g. reason for leaving)
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_generated_docs_student
  ON public.generated_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_school
  ON public.generated_documents(school_id);
CREATE INDEX IF NOT EXISTS idx_generated_docs_type
  ON public.generated_documents(student_id, document_type, status);

-- RLS
ALTER TABLE public.generated_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_isolation" ON public.generated_documents
  FOR ALL
  USING (school_id = (
    SELECT school_id FROM public.users WHERE id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- TABLE 3: document_audit_logs
-- Immutable audit trail for every document action
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.document_audit_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID REFERENCES public.generated_documents(id) ON DELETE SET NULL,
  school_id       UUID NOT NULL,
  student_id      UUID NOT NULL,
  action          TEXT NOT NULL,  -- 'GENERATED' | 'DOWNLOADED' | 'REVOKED' | 'REGENERATED'
  performed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  performed_by_role TEXT,
  timestamp       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address      TEXT,
  details         JSONB
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_document
  ON public.document_audit_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_audit_student
  ON public.document_audit_logs(student_id);

ALTER TABLE public.document_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "school_isolation" ON public.document_audit_logs
  FOR ALL
  USING (school_id = (
    SELECT school_id FROM public.users WHERE id = auth.uid()
  ));

-- ─────────────────────────────────────────────────────────────
-- Auto-update updated_at on student_profiles
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_student_profiles_updated_at ON public.student_profiles;
CREATE TRIGGER trg_student_profiles_updated_at
  BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- STORAGE: student-photos bucket
-- Create via Supabase Dashboard → Storage → New Bucket
-- Name: student-photos, Public: false
-- Or run:
-- ─────────────────────────────────────────────────────────────
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('student-photos', 'student-photos', false)
-- ON CONFLICT (id) DO NOTHING;
