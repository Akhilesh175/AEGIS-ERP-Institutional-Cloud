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
  const tables = [
    'school_payment_settings',
    'faculty_payment_settings',
    'fee_payments',
    'salary_payments',
    'employee_salary_ledger',
    'invoices'
  ];
  console.log("Checking tables existence on Supabase...");
  for (const t of tables) {
    const { data, error } = await supabaseAdmin.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table "${t}" check status: FAIL / DOES NOT EXIST. Error:`, error.message);
    } else {
      const colStr = data && data.length > 0 ? `Columns: [${Object.keys(data[0]).join(', ')}]` : '(empty table)';
      console.log(`Table "${t}" check status: EXISTS. ${colStr}`);
    }
  }
}

run().catch(console.error);
