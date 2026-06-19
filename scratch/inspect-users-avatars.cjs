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
    .select('id, email, first_name, last_name, avatar_url, role');
  
  if (error) {
    console.error(error);
  } else {
    console.log('All Users:');
    users.forEach(u => {
      console.log(`User: ${u.first_name} ${u.last_name} (${u.role}), Email: ${u.email}, Avatar: ${u.avatar_url}`);
    });
  }
}

run().catch(console.error);
