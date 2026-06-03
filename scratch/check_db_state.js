import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function check() {
  const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
  console.log('Schools:', schools);

  const { data: users } = await supabaseAdmin.from('users').select('id, email, role, school_id');
  console.log('Users:', users);

  const { data: admins } = await supabaseAdmin.from('school_admins').select('*');
  console.log('School Admins:', admins);
}

check();
