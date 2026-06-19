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
  console.log('=== Supabase Discussion System Production Audit ===\n');

  // Count existing master records
  const { count: classCount, error: classErr } = await supabaseAdmin.from('classes').select('*', { count: 'exact', head: true });
  const { count: studentCount, error: studErr } = await supabaseAdmin.from('students').select('*', { count: 'exact', head: true });
  const { count: teacherCount, error: teachErr } = await supabaseAdmin.from('teachers').select('*', { count: 'exact', head: true });
  const { count: userCount, error: userErr } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });

  console.log(`Master ERP Records:`);
  console.log(`- Classes: ${classErr ? 'ERROR: ' + classErr.message : classCount}`);
  console.log(`- Students: ${studErr ? 'ERROR: ' + studErr.message : studentCount}`);
  console.log(`- Teachers: ${teachErr ? 'ERROR: ' + teachErr.message : teacherCount}`);
  console.log(`- Users: ${userErr ? 'ERROR: ' + userErr.message : userCount}`);

  // Count chat records
  const { count: groupCount, error: grpErr } = await supabaseAdmin.from('class_chat_groups').select('*', { count: 'exact', head: true });
  const { count: memberCount, error: memErr } = await supabaseAdmin.from('class_chat_members').select('*', { count: 'exact', head: true });

  console.log(`\nChat Module Records:`);
  console.log(`- Chat Groups: ${grpErr ? 'ERROR: ' + grpErr.message : groupCount}`);
  console.log(`- Chat Members: ${memErr ? 'ERROR: ' + memErr.message : memberCount}`);
}

run().catch(console.error);
