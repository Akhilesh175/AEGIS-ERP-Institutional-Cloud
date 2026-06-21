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
  console.log("Adding UNIQUE constraint uniq_school_employee_month to sports_salary_records...");
  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql_query: `
      ALTER TABLE public.sports_salary_records 
      ADD CONSTRAINT uniq_school_employee_month UNIQUE (school_id, user_id, month);
    `
  });
  if (error) {
    console.error("Failed to add constraint:", error);
  } else {
    console.log("Successfully added unique constraint!", data);
  }
}

run().catch(console.error);
