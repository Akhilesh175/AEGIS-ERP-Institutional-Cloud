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
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260613004000_create_push_notification_tables.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  console.log("Executing Push Notification Migration SQL with parameter { sql }...");
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql });
  if (error) {
    console.error("Failed to execute SQL:", error.message);
  } else {
    console.log("SQL executed successfully! Result:", data);
  }
}

run().catch(console.error);
