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
  const schoolId = "0a5e1f1a-8a04-4b77-8215-a7ab9a48e342";
  
  console.log("--- SUBSCRIPTION AUDIT LOGS ---");
  const { data: auditLogs, error: auditErr } = await supabaseAdmin
    .from('subscription_audit_logs')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (auditErr) {
    console.error("Error reading subscription_audit_logs:", auditErr);
  } else {
    console.log(JSON.stringify(auditLogs, null, 2));
  }

  console.log("\n--- SUBSCRIPTION INVOICES ---");
  const { data: invoices, error: invErr } = await supabaseAdmin
    .from('subscription_invoices')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (invErr) {
    console.error("Error reading subscription_invoices:", invErr);
  } else {
    console.log(JSON.stringify(invoices, null, 2));
  }
}

run().catch(console.error);
