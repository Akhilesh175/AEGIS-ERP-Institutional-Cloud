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
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, role, school_id')
    .or('first_name.ilike.%Yadav%,last_name.ilike.%Yadav%,role.eq.ADMIN');
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }
  
  console.log('--- Matching Users ---');
  console.log(JSON.stringify(users, null, 2));

  // Let's also fetch schools and academic sessions to match
  const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
  console.log('--- Schools ---');
  console.log(JSON.stringify(schools, null, 2));

  const { data: sessions } = await supabaseAdmin.from('academic_sessions').select('id, name, school_id, is_active');
  console.log('--- Academic Sessions ---');
  console.log(JSON.stringify(sessions, null, 2));
}

run().catch(console.error);
