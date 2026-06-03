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
  console.log('--- TEACHERS ROWS ---');
  const { data: teachers, error: teachersErr } = await supabaseAdmin
    .from('teachers')
    .select('*, users(*)');
  if (teachersErr) {
    console.error('Teachers query error:', teachersErr);
  } else {
    console.log(`Found ${teachers?.length || 0} teachers`);
    console.log('Sample teachers:', JSON.stringify(teachers?.slice(0, 5), null, 2));
  }

  console.log('--- TIMETABLES ROWS ---');
  const { data: timetables, error: timetablesErr } = await supabaseAdmin
    .from('timetables')
    .select('*');
  if (timetablesErr) {
    console.error('Timetables query error:', timetablesErr);
  } else {
    console.log(`Found ${timetables?.length || 0} timetables`);
    console.log('Sample timetables:', JSON.stringify(timetables?.slice(0, 5), null, 2));
  }

  console.log('--- USERS ROWS (TEACHER ROLE) ---');
  const { data: users, error: usersErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('role', 'teacher');
  if (usersErr) {
    console.error('Users query error:', usersErr);
  } else {
    console.log(`Found ${users?.length || 0} users with role 'teacher'`);
    console.log('Sample users:', JSON.stringify(users?.slice(0, 5), null, 2));
  }
}

run().catch(console.error);
