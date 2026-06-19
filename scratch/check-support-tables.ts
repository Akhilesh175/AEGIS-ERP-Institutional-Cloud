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
    'support_tickets',
    'support_ticket_messages',
    'support_ticket_status_logs',
    'support_internal_notes',
    'support_notifications'
  ];
  for (const t of tables) {
    const { data, error } = await supabaseAdmin.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t} check failed:`, error.message);
    } else {
      console.log(`Table ${t} exists! Row count:`, data.length);
    }
  }
}

run().catch(console.error);
