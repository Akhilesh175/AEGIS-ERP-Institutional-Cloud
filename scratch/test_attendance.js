import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  // Let's get one student and recordedBy user to perform the test
  const { data: students } = await supabaseAdmin.from('students').select('id, school_id, user_id').limit(1);
  if (!students || students.length === 0) {
    console.error('No student found in DB for testing.');
    return;
  }
  const student = students[0];
  const { data: users } = await supabaseAdmin.from('users').select('id').eq('school_id', student.school_id).limit(1);
  if (!users || users.length === 0) {
    console.error('No user found in DB for testing.');
    return;
  }
  const user = users[0];

  console.log(`Testing with student_id: ${student.id}, school_id: ${student.school_id}, recorded_by: ${user.id}`);

  // Test insert/upsert
  const testData = {
    school_id: student.school_id,
    student_id: student.id,
    date: '2026-06-05',
    time_slot: 'MORNING',
    status: 'PRESENT',
    recorded_by: user.id,
    created_by: user.id,
    updated_by: user.id
  };

  console.log('Upserting attendance...');
  const { data: upsertData, error: upsertError } = await supabaseAdmin
    .from('hostel_attendance')
    .upsert(testData, { onConflict: 'student_id,date,time_slot' })
    .select()
    .single();

  if (upsertError) {
    console.error('Upsert failed:', upsertError.message, upsertError.details, upsertError.hint);
  } else {
    console.log('Upsert succeeded! Returned data:', upsertData);
  }
}

run();
