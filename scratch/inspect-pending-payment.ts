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
  const { data: payments, error } = await supabaseAdmin
    .from('payments')
    .select('*, subscriptions(*)')
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error fetching pending payments:", error);
    return;
  }

  console.log("Pending payments:", JSON.stringify(payments, null, 2));
}

run().catch(console.error);
