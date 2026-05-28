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
  console.log('Fetching schools from Supabase...');
  const { data: schools, error: schoolErr } = await supabaseAdmin.from('schools').select('*');
  if (schoolErr) {
    console.error('Error fetching schools:', schoolErr);
  } else {
    console.log('Schools in DB:', JSON.stringify(schools, null, 2));
  }

  console.log('\nFetching users from Supabase...');
  const { data: users, error: userErr } = await supabaseAdmin.from('users').select('*');
  if (userErr) {
    console.error('Error fetching users:', userErr);
  } else {
    console.log('Total users:', users?.length);
    console.log('Role distribution:');
    const roles: Record<string, number> = {};
    users?.forEach(u => {
      roles[u.role] = (roles[u.role] || 0) + 1;
    });
    console.log(roles);
    console.log('Sample users (first 10):', JSON.stringify(users?.slice(0, 10), null, 2));
  }
}

run().catch(console.error);
