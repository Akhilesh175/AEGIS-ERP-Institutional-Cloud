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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('*')
    .or('first_name.ilike.%vishal%,last_name.ilike.%vishal%');
  console.log('Vishal users:', JSON.stringify(users, null, 2));

  if (users && users.length > 0) {
    const { data: teachers } = await supabaseAdmin
      .from('teachers')
      .select('*')
      .eq('user_id', users[0].id);
    console.log('Vishal teachers:', JSON.stringify(teachers, null, 2));
  }

  // Let's check Manan Yadav's details
  const { data: manan } = await supabaseAdmin
    .from('users')
    .select('*')
    .or('first_name.ilike.%manan%,last_name.ilike.%manan%');
  console.log('Manan users:', JSON.stringify(manan, null, 2));
}

run().catch(console.error);
