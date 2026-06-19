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
  console.log('--- HOSTEL BLOCKS SCHEMA/ROWS ---');
  const { data: blocks, error: bErr } = await supabaseAdmin.from('hostel_blocks').select('*').limit(5);
  if (bErr) console.error(bErr);
  else console.log(JSON.stringify(blocks, null, 2));

  console.log('--- HOSTEL WARDEN ASSIGNMENTS ROWS ---');
  const { data: assignments, error: aErr } = await supabaseAdmin.from('hostel_warden_assignments').select('*').limit(5);
  if (aErr) console.error(aErr);
  else console.log(JSON.stringify(assignments, null, 2));

  console.log('--- HOSTEL WARDENS ROWS ---');
  const { data: wardens, error: wErr } = await supabaseAdmin.from('hostel_wardens').select('*').limit(5);
  if (wErr) console.error(wErr);
  else console.log(JSON.stringify(wardens, null, 2));

  console.log('--- HOSTEL ADMISSIONS ROWS ---');
  const { data: admissions, error: adErr } = await supabaseAdmin.from('hostel_admissions').select('*').limit(5);
  if (adErr) console.error(adErr);
  else console.log(JSON.stringify(admissions, null, 2));
}

run().catch(console.error);
