import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = `
    ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS username TEXT;
    ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS address TEXT;
    ALTER TABLE public.hostel_wardens ADD COLUMN IF NOT EXISTS assigned_locations JSONB DEFAULT '[]'::jsonb;
  `;
  console.log('Applying warden migration...');
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error('Migration failed:', error.message);
  } else {
    console.log('Migration successfully applied!', data);
  }
}

run();
