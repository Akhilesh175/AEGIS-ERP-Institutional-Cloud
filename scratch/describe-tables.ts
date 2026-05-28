import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env manually
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
  console.log('Querying table information from PostgreSQL information_schema...');
  const { data: tables, error: tablesErr } = await supabaseAdmin.rpc('get_tables_info');
  
  if (tablesErr) {
    console.log('RPC get_tables_info failed, trying direct query on pg_tables or raw sql execution...');
    // Try to run a raw query using a known endpoint or check common tables
    const checkTables = ['schools', 'users', 'students', 'teachers', 'parents', 'classes', 'subjects', 'timetables', 'exams', 'quizzes', 'materials', 'subscriptions'];
    for (const t of checkTables) {
      const { data, error } = await supabaseAdmin.from(t).select('*').limit(1);
      if (error) {
        console.log(`Table ${t}: Error (${error.message})`);
      } else {
        console.log(`Table ${t}: EXISTS (columns: ${Object.keys(data[0] || {}).join(', ') || 'no rows'})`);
      }
    }
  } else {
    console.log('Tables info:', JSON.stringify(tables, null, 2));
  }
}

run().catch(console.error);
