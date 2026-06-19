import './mock-localStorage';
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
  const { data, error } = await supabaseAdmin.rpc('run_sql', {
    sql_query: "SELECT schemaname, tablename, policyname, roles, cmd, qual FROM pg_policies WHERE tablename = 'attendance'"
  });
  if (error) {
    console.error('RPC run_sql failed, querying pg_policies via select:', error);
    // If run_sql is not defined, let's query it by selecting or running another query
  } else {
    console.log('--- POLICIES ---');
    console.log(data);
  }
}

run().catch(console.error);
