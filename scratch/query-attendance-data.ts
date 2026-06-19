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
  const { data: schools, error: sErr } = await supabaseAdmin.from('schools').select('*');
  console.log('--- SCHOOLS ---');
  if (sErr) console.error(sErr);
  else console.log(schools);

  const { data: students, error: stErr } = await supabaseAdmin.from('students').select('*');
  console.log('--- STUDENTS COUNT ---', students?.length || 0);

  const { data: attendance, error: aErr } = await supabaseAdmin.from('attendance').select('*');
  console.log('--- ATTENDANCE COUNT ---', attendance?.length || 0);
  if (attendance && attendance.length > 0) {
    console.log('Sample attendance record:', attendance[0]);
  }
}

run().catch(console.error);
