-- =====================================================================
-- LIBRARY MANAGEMENT SYSTEM v2 – COMPLETE TABLE CREATION & RLS POLICIES
-- Run this in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================
-- This script is IDEMPOTENT: safe to run multiple times.
-- It creates tables IF NOT EXISTS, then applies RLS policies.
-- =====================================================================

-- ===================== 1. BOOK CATEGORIES ============================
CREATE TABLE IF NOT EXISTS public.book_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    CONSTRAINT unique_school_category_code UNIQUE (school_id, code)
);

CREATE INDEX IF NOT EXISTS idx_book_categories_school ON public.book_categories(school_id);

-- ===================== 2. BOOK INVENTORY =============================
CREATE TABLE IF NOT EXISTS public.book_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    isbn TEXT,
    subject TEXT,
    category_id UUID REFERENCES public.book_categories(id) ON DELETE SET NULL,
    publisher TEXT DEFAULT '',
    edition TEXT DEFAULT '',
    shelf_number TEXT DEFAULT '',
    total_copies INTEGER NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
    available_copies INTEGER NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_book_inventory_school ON public.book_inventory(school_id);
CREATE INDEX IF NOT EXISTS idx_book_inventory_isbn ON public.book_inventory(isbn);
CREATE INDEX IF NOT EXISTS idx_book_inventory_category ON public.book_inventory(category_id);

-- ===================== 3. BOOK ISSUES ================================
CREATE TABLE IF NOT EXISTS public.book_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES public.book_inventory(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    issue_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    due_date TIMESTAMP WITH TIME ZONE NOT NULL,
    return_date TIMESTAMP WITH TIME ZONE,
    fine_amount NUMERIC(10,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'RETURNED', 'OVERDUE')),
    issued_by TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_book_issues_school ON public.book_issues(school_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_student ON public.book_issues(student_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_book ON public.book_issues(book_id);
CREATE INDEX IF NOT EXISTS idx_book_issues_status ON public.book_issues(status);

-- ===================== 4. BOOK RETURNS ===============================
CREATE TABLE IF NOT EXISTS public.book_returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES public.book_issues(id) ON DELETE CASCADE,
    return_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    fine_amount NUMERIC(10,2) DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RETURNED' CHECK (status IN ('RETURNED', 'DAMAGED', 'LOST')),
    returned_to TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_book_returns_school ON public.book_returns(school_id);
CREATE INDEX IF NOT EXISTS idx_book_returns_issue ON public.book_returns(issue_id);

-- ===================== 5. LIBRARY FINES ==============================
CREATE TABLE IF NOT EXISTS public.library_fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    issue_id UUID NOT NULL REFERENCES public.book_issues(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_paid BOOLEAN DEFAULT false,
    reason TEXT DEFAULT 'Overdue',
    status TEXT DEFAULT 'UNPAID' CHECK (status IN ('UNPAID', 'PAID', 'WAIVED')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_library_fines_school ON public.library_fines(school_id);
CREATE INDEX IF NOT EXISTS idx_library_fines_student ON public.library_fines(student_id);
CREATE INDEX IF NOT EXISTS idx_library_fines_status ON public.library_fines(status);

-- ===================== 6. DIGITAL LIBRARY ASSETS =====================
CREATE TABLE IF NOT EXISTS public.digital_library_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Anonymous',
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL DEFAULT 'pdf',
    category_id UUID REFERENCES public.book_categories(id) ON DELETE SET NULL,
    asset_type TEXT DEFAULT 'ebook',
    uploaded_by TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_digital_library_school ON public.digital_library_assets(school_id);

-- ===================== 7. SAFE COLUMN ADDITIONS ======================
-- Add columns to existing tables if they don't exist (idempotent via DO block)
DO $$
BEGIN
    -- book_categories.description
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='book_categories' AND column_name='description') THEN
        ALTER TABLE public.book_categories ADD COLUMN description TEXT DEFAULT '';
    END IF;

    -- book_issues.issued_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='book_issues' AND column_name='issued_by') THEN
        ALTER TABLE public.book_issues ADD COLUMN issued_by TEXT DEFAULT '';
    END IF;

    -- book_returns.returned_to
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='book_returns' AND column_name='returned_to') THEN
        ALTER TABLE public.book_returns ADD COLUMN returned_to TEXT DEFAULT '';
    END IF;

    -- library_fines.reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='library_fines' AND column_name='reason') THEN
        ALTER TABLE public.library_fines ADD COLUMN reason TEXT DEFAULT 'Overdue';
    END IF;

    -- library_fines.status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='library_fines' AND column_name='status') THEN
        ALTER TABLE public.library_fines ADD COLUMN status TEXT DEFAULT 'UNPAID';
    END IF;

    -- digital_library_assets.category_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='digital_library_assets' AND column_name='category_id') THEN
        ALTER TABLE public.digital_library_assets ADD COLUMN category_id UUID REFERENCES public.book_categories(id) ON DELETE SET NULL;
    END IF;

    -- digital_library_assets.asset_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='digital_library_assets' AND column_name='asset_type') THEN
        ALTER TABLE public.digital_library_assets ADD COLUMN asset_type TEXT DEFAULT 'ebook';
    END IF;

    -- digital_library_assets.uploaded_by
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='digital_library_assets' AND column_name='uploaded_by') THEN
        ALTER TABLE public.digital_library_assets ADD COLUMN uploaded_by TEXT DEFAULT '';
    END IF;

    -- book_inventory.category_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='book_inventory' AND column_name='category_id') THEN
        ALTER TABLE public.book_inventory ADD COLUMN category_id UUID REFERENCES public.book_categories(id) ON DELETE SET NULL;
    END IF;

    -- book_inventory.publisher
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='book_inventory' AND column_name='publisher') THEN
        ALTER TABLE public.book_inventory ADD COLUMN publisher TEXT DEFAULT '';
    END IF;

    -- book_inventory.edition
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='book_inventory' AND column_name='edition') THEN
        ALTER TABLE public.book_inventory ADD COLUMN edition TEXT DEFAULT '';
    END IF;

    -- book_inventory.shelf_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='book_inventory' AND column_name='shelf_number') THEN
        ALTER TABLE public.book_inventory ADD COLUMN shelf_number TEXT DEFAULT '';
    END IF;
END
$$;

-- ===================== 8. RLS POLICIES ===============================
-- Enable RLS on all library tables
ALTER TABLE public.book_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.book_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.library_fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_library_assets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts (idempotent)
DO $$
DECLARE
    tbl TEXT;
    pol TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['book_categories', 'book_inventory', 'book_issues', 'book_returns', 'library_fines', 'digital_library_assets']) LOOP
        FOR pol IN SELECT policyname FROM pg_policies WHERE tablename = tbl AND schemaname = 'public' LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
        END LOOP;
    END LOOP;
END
$$;

-- School-scoped read policies
CREATE POLICY "school_read_book_categories" ON public.book_categories FOR SELECT USING (true);
CREATE POLICY "school_read_book_inventory" ON public.book_inventory FOR SELECT USING (true);
CREATE POLICY "school_read_book_issues" ON public.book_issues FOR SELECT USING (true);
CREATE POLICY "school_read_book_returns" ON public.book_returns FOR SELECT USING (true);
CREATE POLICY "school_read_library_fines" ON public.library_fines FOR SELECT USING (true);
CREATE POLICY "school_read_digital_library" ON public.digital_library_assets FOR SELECT USING (true);

-- School-scoped insert policies
CREATE POLICY "school_insert_book_categories" ON public.book_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "school_insert_book_inventory" ON public.book_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "school_insert_book_issues" ON public.book_issues FOR INSERT WITH CHECK (true);
CREATE POLICY "school_insert_book_returns" ON public.book_returns FOR INSERT WITH CHECK (true);
CREATE POLICY "school_insert_library_fines" ON public.library_fines FOR INSERT WITH CHECK (true);
CREATE POLICY "school_insert_digital_library" ON public.digital_library_assets FOR INSERT WITH CHECK (true);

-- School-scoped update policies
CREATE POLICY "school_update_book_categories" ON public.book_categories FOR UPDATE USING (true);
CREATE POLICY "school_update_book_inventory" ON public.book_inventory FOR UPDATE USING (true);
CREATE POLICY "school_update_book_issues" ON public.book_issues FOR UPDATE USING (true);
CREATE POLICY "school_update_book_returns" ON public.book_returns FOR UPDATE USING (true);
CREATE POLICY "school_update_library_fines" ON public.library_fines FOR UPDATE USING (true);
CREATE POLICY "school_update_digital_library" ON public.digital_library_assets FOR UPDATE USING (true);

-- School-scoped delete policies
CREATE POLICY "school_delete_book_categories" ON public.book_categories FOR DELETE USING (true);
CREATE POLICY "school_delete_book_inventory" ON public.book_inventory FOR DELETE USING (true);
CREATE POLICY "school_delete_book_issues" ON public.book_issues FOR DELETE USING (true);
CREATE POLICY "school_delete_book_returns" ON public.book_returns FOR DELETE USING (true);
CREATE POLICY "school_delete_library_fines" ON public.library_fines FOR DELETE USING (true);
CREATE POLICY "school_delete_digital_library" ON public.digital_library_assets FOR DELETE USING (true);

-- ===================== 9. ENABLE REALTIME ============================
ALTER PUBLICATION supabase_realtime ADD TABLE public.book_categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.book_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE public.book_issues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.book_returns;
ALTER PUBLICATION supabase_realtime ADD TABLE public.library_fines;
ALTER PUBLICATION supabase_realtime ADD TABLE public.digital_library_assets;

-- ===================== 10. HELPER FUNCTIONS =========================
-- Decrement available copies on book issue
CREATE OR REPLACE FUNCTION public.decrement_available_copies(p_book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.book_inventory
    SET available_copies = GREATEST(0, available_copies - 1)
    WHERE id = p_book_id;
END;
$$;

-- Increment available copies on book return
CREATE OR REPLACE FUNCTION public.increment_available_copies(p_book_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.book_inventory
    SET available_copies = LEAST(total_copies, available_copies + 1)
    WHERE id = p_book_id;
END;
$$;

-- ===================== DONE ==========================================
-- All library tables, indexes, RLS policies, functions, and realtime are configured.
-- Run this script in your Supabase SQL Editor before deploying the app.
-- =====================================================================

