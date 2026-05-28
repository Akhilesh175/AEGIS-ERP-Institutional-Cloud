import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_URL : undefined);
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY : undefined);
const supabaseServiceKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_SERVICE_ROLE_KEY : undefined);

// Validate that required environment variables are present.
// Instead of throwing (which causes a blank page), we log a clear warning.
// The app will still load and show a login screen; the error only surfaces on actual API calls.
if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error(
    '⚠️  AEGIS ERP: Missing Supabase environment variables!\n' +
    'Please add VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and VITE_SUPABASE_SERVICE_ROLE_KEY\n' +
    'to your Vercel project settings (Project → Settings → Environment Variables).'
  );
}

// Public client strictly bound by Row Level Security (RLS)
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);

// Admin client that overrides RLS - strictly used for SuperAdmin operations
export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
