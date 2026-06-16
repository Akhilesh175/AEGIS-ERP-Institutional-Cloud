-- ============================================================
-- AEGIS ERP Payment Infrastructure Migration
-- Created: 2026-06-14
-- Author: Antigravity / AEGIS Dev
-- ============================================================


-- -----------------------------------------------------------------
-- 1. SCHOOL PAYMENT SETTINGS
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.school_payment_settings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  account_holder_name   TEXT,
  bank_name             TEXT,
  account_number        TEXT,
  ifsc_code             TEXT,
  branch_name           TEXT,
  swift_code            TEXT,
  upi_id                TEXT,
  qr_code_url           TEXT,
  payment_instructions  TEXT,
  qr_payment_enabled    BOOLEAN NOT NULL DEFAULT true,
  bank_transfer_enabled BOOLEAN NOT NULL DEFAULT true,
  show_qr_to_parents    BOOLEAN NOT NULL DEFAULT false,
  show_bank_to_parents  BOOLEAN NOT NULL DEFAULT false,
  enable_utr_upload     BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT school_payment_settings_school_id_unique UNIQUE (school_id)
);

CREATE OR REPLACE FUNCTION update_school_payment_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_school_payment_settings_updated_at ON public.school_payment_settings;
CREATE TRIGGER trg_school_payment_settings_updated_at
  BEFORE UPDATE ON public.school_payment_settings
  FOR EACH ROW EXECUTE FUNCTION update_school_payment_settings_updated_at();

ALTER TABLE public.school_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "school_payment_settings_view_own" ON public.school_payment_settings;
CREATE POLICY "school_payment_settings_view_own"
  ON public.school_payment_settings FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN')
        AND is_active = true
    )
  );

DROP POLICY IF EXISTS "school_payment_settings_upsert_admin" ON public.school_payment_settings;
CREATE POLICY "school_payment_settings_upsert_admin"
  ON public.school_payment_settings FOR ALL
  USING (
    school_id IN (
      SELECT school_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'FINANCE_ADMIN')
        AND is_active = true
    )
  )
  WITH CHECK (
    school_id IN (
      SELECT school_id FROM public.users
      WHERE id = auth.uid()
        AND role IN ('ADMIN', 'FINANCE_ADMIN')
        AND is_active = true
    )
  );


-- -----------------------------------------------------------------
-- 2. FACULTY PAYMENT SETTINGS
-- -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.faculty_payment_settings (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  upi_id         TEXT,
  qr_code_url    TEXT,
  bank_name      TEXT,
  account_number TEXT,
  ifsc_code      TEXT,
  branch_name    TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT faculty_payment_settings_user_id_unique UNIQUE (user_id)
);

CREATE OR REPLACE FUNCTION update_faculty_payment_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_faculty_payment_settings_updated_at ON public.faculty_payment_settings;
CREATE TRIGGER trg_faculty_payment_settings_updated_at
  BEFORE UPDATE ON public.faculty_payment_settings
  FOR EACH ROW EXECUTE FUNCTION update_faculty_payment_settings_updated_at();

ALTER TABLE public.faculty_payment_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "faculty_payment_settings_view_own" ON public.faculty_payment_settings;
CREATE POLICY "faculty_payment_settings_view_own"
  ON public.faculty_payment_settings FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "faculty_payment_settings_upsert_own" ON public.faculty_payment_settings;
CREATE POLICY "faculty_payment_settings_upsert_own"
  ON public.faculty_payment_settings FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "faculty_payment_settings_finance_admin_view" ON public.faculty_payment_settings;
CREATE POLICY "faculty_payment_settings_finance_admin_view"
  ON public.faculty_payment_settings FOR SELECT
  USING (
    school_id IN (
      SELECT school_id FROM public.users
      WHERE id = auth.uid()
        AND role = 'FINANCE_ADMIN'
        AND is_active = true
    )
  );


-- -----------------------------------------------------------------
-- 3. FEE PAYMENTS TABLE ALTERATIONS
--    Each block checks that the fee_payments table EXISTS and
--    that the column does NOT already exist before altering.
--    The index is created dynamically to avoid any column-name
--    assumptions that could cause 42703 errors.
-- -----------------------------------------------------------------

DO $$
BEGIN
  -- Only proceed if the fee_payments table exists at all
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'fee_payments'
  ) THEN

    -- Add REJECTED to payment_status enum
    EXECUTE 'ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS ''REJECTED''';

    -- payment_screenshot_url
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'fee_payments'
        AND column_name  = 'payment_screenshot_url'
    ) THEN
      EXECUTE 'ALTER TABLE public.fee_payments ADD COLUMN payment_screenshot_url TEXT';
    END IF;

    -- utr_number
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'fee_payments'
        AND column_name  = 'utr_number'
    ) THEN
      EXECUTE 'ALTER TABLE public.fee_payments ADD COLUMN utr_number TEXT';
    END IF;

    -- verified_by
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'fee_payments'
        AND column_name  = 'verified_by'
    ) THEN
      EXECUTE 'ALTER TABLE public.fee_payments ADD COLUMN verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL';
    END IF;

    -- verified_at
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'fee_payments'
        AND column_name  = 'verified_at'
    ) THEN
      EXECUTE 'ALTER TABLE public.fee_payments ADD COLUMN verified_at TIMESTAMPTZ';
    END IF;

    -- rejection_reason
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'fee_payments'
        AND column_name  = 'rejection_reason'
    ) THEN
      EXECUTE 'ALTER TABLE public.fee_payments ADD COLUMN rejection_reason TEXT';
    END IF;

    -- Drop old (possibly broken) index
    IF EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname   = 'idx_fee_payments_pending_screenshots'
    ) THEN
      EXECUTE 'DROP INDEX public.idx_fee_payments_pending_screenshots';
    END IF;

    -- Create index only if the status column exists
    -- (use only status to avoid any uncertainty about other column names)
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'fee_payments'
        AND column_name  = 'status'
    ) THEN
      EXECUTE 'CREATE INDEX idx_fee_payments_pending_screenshots ON public.fee_payments (status) WHERE payment_screenshot_url IS NOT NULL';
    END IF;

  ELSE
    RAISE NOTICE 'fee_payments table not found -- skipping alterations (app uses mock layer)';
  END IF;
END $$;


-- -----------------------------------------------------------------
-- 4. STORAGE BUCKET POLICIES
-- -----------------------------------------------------------------

DROP POLICY IF EXISTS "payment_qr_admin_upload" ON storage.objects;
CREATE POLICY "payment_qr_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-qr-codes'
    AND (storage.foldername(name))[1] = 'school'
    AND auth.uid() IN (
      SELECT id FROM public.users
      WHERE role IN ('ADMIN', 'FINANCE_ADMIN') AND is_active = true
    )
  );

DROP POLICY IF EXISTS "payment_qr_faculty_upload" ON storage.objects;
CREATE POLICY "payment_qr_faculty_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'payment-qr-codes'
    AND (storage.foldername(name))[1] = 'faculty'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "payment_qr_authenticated_read" ON storage.objects;
CREATE POLICY "payment_qr_authenticated_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'payment-qr-codes'
    AND auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "fee_proof_upload_parent_student" ON storage.objects;
CREATE POLICY "fee_proof_upload_parent_student"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'fee-payment-proofs'
    AND auth.uid() IN (
      SELECT id FROM public.users
      WHERE role IN ('PARENT', 'STUDENT') AND is_active = true
    )
  );

DROP POLICY IF EXISTS "fee_proof_admin_read" ON storage.objects;
CREATE POLICY "fee_proof_admin_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'fee-payment-proofs'
    AND auth.uid() IN (
      SELECT id FROM public.users
      WHERE role IN ('ADMIN', 'FINANCE_ADMIN') AND is_active = true
    )
  );


-- -----------------------------------------------------------------
-- 5. MASKED VIEW FOR SUPER_ADMIN CONSOLE
-- -----------------------------------------------------------------

CREATE OR REPLACE VIEW public.v_school_payment_overview AS
SELECT
  sps.school_id,
  s.name AS school_name,
  CASE
    WHEN sps.upi_id IS NULL OR length(sps.upi_id) < 7 THEN NULL
    ELSE left(sps.upi_id, 3) || repeat('*', length(sps.upi_id) - 6) || right(sps.upi_id, 3)
  END AS upi_id_masked,
  sps.bank_name,
  CASE
    WHEN sps.account_number IS NULL THEN NULL
    ELSE repeat('*', GREATEST(length(sps.account_number) - 4, 0)) || right(sps.account_number, 4)
  END AS account_number_masked,
  sps.ifsc_code,
  sps.qr_payment_enabled,
  sps.bank_transfer_enabled,
  sps.updated_at
FROM public.school_payment_settings sps
JOIN public.schools s ON s.id = sps.school_id;

GRANT SELECT ON public.v_school_payment_overview TO authenticated;

COMMENT ON VIEW public.v_school_payment_overview IS
  'Masked read-only view for Super Admin. UPI ID and account number are redacted.';


-- -----------------------------------------------------------------
-- DONE
-- -----------------------------------------------------------------
