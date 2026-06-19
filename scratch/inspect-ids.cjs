const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

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
  console.log('--- Database ID Verification ---\n');

  // Schools
  const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
  console.log('Schools in Database:');
  console.log(JSON.stringify(schools, null, 2));

  // Sessions
  const { data: sessions } = await supabaseAdmin.from('academic_sessions').select('id, name, school_id');
  console.log('\nAcademic Sessions in Database:');
  console.log(JSON.stringify(sessions, null, 2));

  // Users: Akhilesh, Manan, Vishal
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, first_name, last_name, email, role, school_id, is_active')
    .in('first_name', ['Akhilesh', 'Manan', 'Vishal']);
  console.log('\nUsers in Database:');
  console.log(JSON.stringify(users, null, 2));

  // Chat Groups school_id and academic_session_id
  const { data: groups } = await supabaseAdmin
    .from('class_chat_groups')
    .select('id, name, school_id, academic_session_id, class_id')
    .limit(3);
  console.log('\nSample Chat Groups:');
  console.log(JSON.stringify(groups, null, 2));
}

run().catch(console.error);
