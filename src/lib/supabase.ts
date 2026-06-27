import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL || (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_URL : undefined);
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY || (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_ANON_KEY : undefined);
const supabaseServiceKey = import.meta.env?.VITE_SUPABASE_SERVICE_ROLE_KEY || (typeof globalThis !== 'undefined' ? (globalThis as any).process?.env?.VITE_SUPABASE_SERVICE_ROLE_KEY : undefined);

if (!supabaseUrl) {
  throw new Error('❌ AEGIS ERP: Missing VITE_SUPABASE_URL environment variable.');
}
if (!supabaseAnonKey) {
  throw new Error('❌ AEGIS ERP: Missing VITE_SUPABASE_ANON_KEY environment variable.');
}
if (!supabaseServiceKey) {
  throw new Error('❌ AEGIS ERP: Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable.');
}

// Public client strictly bound by Row Level Security (RLS)
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

// Admin client that overrides RLS - strictly used for SuperAdmin operations
export const supabaseAdmin = createClient(
  supabaseUrl,
  supabaseServiceKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      storageKey: 'sb-admin-auth-token'
    }
  }
);
