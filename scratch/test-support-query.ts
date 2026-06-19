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
  console.log("=== RUNNING RESOLVED SUPPORT TICKETS QUERY ===");
  const { data, error } = await supabaseAdmin
    .from('support_tickets')
    .select('*, userDetails:users!support_tickets_user_id_fkey(*), schoolDetails:schools(name), messages:support_ticket_messages(count)');

  if (error) {
    console.error("Query failed:", error.message);
    if (error.details) console.error("Details:", error.details);
    if (error.hint) console.error("Hint:", error.hint);
  } else {
    console.log("Query succeeded! Total tickets fetched:", data.length);
    console.log("Sample ticket details:", JSON.stringify(data[0] || null, null, 2));
  }
}

run().catch(console.error);
