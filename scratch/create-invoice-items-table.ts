import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: { [key: string]: string } = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const sql = `
    -- Create subscription_invoice_items table
    CREATE TABLE IF NOT EXISTS public.subscription_invoice_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      invoice_id UUID NOT NULL REFERENCES public.subscription_invoices(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount NUMERIC NOT NULL,
      tax_amount NUMERIC DEFAULT 0,
      total_amount NUMERIC NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    -- Enable RLS
    ALTER TABLE public.subscription_invoice_items ENABLE ROW LEVEL SECURITY;

    -- Drop existing policy if any
    DROP POLICY IF EXISTS "Allow select for subscription invoice items" ON public.subscription_invoice_items;
    DROP POLICY IF EXISTS "Allow all for admin" ON public.subscription_invoice_items;

    -- Create select policy
    CREATE POLICY "Allow select for subscription invoice items" ON public.subscription_invoice_items
      FOR SELECT TO authenticated, anon USING (true);

    -- Create insert/all policy for admin
    CREATE POLICY "Allow all for admin" ON public.subscription_invoice_items
      FOR ALL USING (true) WITH CHECK (true);

    -- Add to replica publication for realtime
    DO $$
    BEGIN
      IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.subscription_invoice_items;
      END IF;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END $$;
  `;

  console.log("Executing SQL to create subscription_invoice_items table...");
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error("Failed to execute SQL:", error.message);
  } else {
    console.log("SQL executed successfully! Result:", data);
  }
}

run().catch(console.error);
