const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
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
  console.log('--- USERS ---');
  const { data: users } = await supabaseAdmin.from('users').select('id, email, role, school_id, is_active');
  console.log(JSON.stringify(users, null, 2));

  console.log('--- ACADEMIC SESSIONS ---');
  const { data: sessions } = await supabaseAdmin.from('academic_sessions').select('id, name, school_id, is_active');
  console.log(JSON.stringify(sessions, null, 2));

  console.log('--- CLASSES ---');
  const { data: classes } = await supabaseAdmin.from('classes').select('id, name, school_id, academic_session_id');
  console.log(JSON.stringify(classes, null, 2));

  console.log('--- TEACHERS ---');
  const { data: teachers } = await supabaseAdmin.from('teachers').select('id, user_id, school_id');
  console.log(JSON.stringify(teachers, null, 2));

  console.log('--- STUDENTS ---');
  const { data: students } = await supabaseAdmin.from('students').select('id, user_id, class_id, school_id, academic_session_id');
  console.log(JSON.stringify(students, null, 2));

  console.log('--- CHAT GROUPS ---');
  const { data: groups } = await supabaseAdmin.from('class_chat_groups').select('id, name, class_id, school_id, academic_session_id, is_archived');
  console.log(JSON.stringify(groups, null, 2));

  console.log('--- CHAT MEMBERS ---');
  const { data: members } = await supabaseAdmin.from('class_chat_members').select('id, group_id, user_id, role, school_id, academic_session_id');
  console.log(JSON.stringify(members, null, 2));
}

run().catch(console.error);
