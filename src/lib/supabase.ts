import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables! Check your .env file and restart Vite.');
}

// Public client strictly bound by Row Level Security (RLS)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client that overrides RLS - strictly used for SuperAdmin operations
export const supabaseAdmin = createClient(
  supabaseUrl, 
  supabaseServiceKey, 
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);
