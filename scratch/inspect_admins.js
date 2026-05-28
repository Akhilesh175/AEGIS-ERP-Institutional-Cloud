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

const supabaseAdmin = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'],
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function run() {
  const { data: users, error: uErr } = await supabaseAdmin.from('users').select('*');
  console.log('--- USERS IN DB ---');
  if (uErr) console.error('Error fetching users:', uErr);
  else console.log(users);

  const { data: admins, error: aErr } = await supabaseAdmin.from('school_admins').select('*');
  console.log('--- SCHOOL_ADMINS IN DB ---');
  if (aErr) console.error('Error fetching school_admins:', aErr);
  else console.log(admins);

  const { data: schools, error: sErr } = await supabaseAdmin.from('schools').select('*');
  console.log('--- SCHOOLS IN DB ---');
  if (sErr) console.error('Error fetching schools:', sErr);
  else console.log(schools);
}

run().catch(console.error);
