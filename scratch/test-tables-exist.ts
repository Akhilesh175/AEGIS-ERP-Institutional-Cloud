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
    'notifications',
    'fcm_tokens',
    'subscriptions',
    'subscription_plans',
    'payments',
    'payment_transactions',
    'subscription_invoices',
    'otp_verifications'
  ];
  for (const t of tables) {
    const { data, error } = await supabaseAdmin.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t} check failed:`, error.message);
    } else if (data && data.length > 0) {
      console.log(`Table ${t} exists and has data. Columns:`, Object.keys(data[0]));
    } else {
      console.log(`Table ${t} exists but is empty.`);
    }
  }
}

run().catch(console.error);
