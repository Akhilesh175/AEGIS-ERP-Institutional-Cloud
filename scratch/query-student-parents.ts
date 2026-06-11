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
  console.log('--- ALL STUDENTS IN DB ---');
  const { data: students } = await supabaseAdmin.from('students').select('id, user_id, admission_number, roll_number');
  console.log(JSON.stringify(students, null, 2));

  console.log('--- ALL PARENT STUDENT MAPPINGS IN DB ---');
  const { data: mappings } = await supabaseAdmin.from('parent_student_mapping').select('*');
  console.log(JSON.stringify(mappings, null, 2));

  console.log('--- ALL PARENTS IN DB ---');
  const { data: parents } = await supabaseAdmin.from('parents').select('*');
  console.log(JSON.stringify(parents, null, 2));

  console.log('--- USERS IN DB ---');
  const { data: users } = await supabaseAdmin.from('users').select('id, first_name, last_name, role');
  console.log(JSON.stringify(users, null, 2));
}

run().catch(console.error);
