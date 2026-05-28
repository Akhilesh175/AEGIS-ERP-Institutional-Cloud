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

const emailsToPurge = [
  'jp@gmail.com', 'akash@gmail.com', 'sk@gmail.com', 'ram@gmail.com',
  'jk@gmail.com', 'manan2@gmail.com', 'basant1@gmail.com', 'rajan@gmail.com',
  'manan3@gmail.com', 'vishal1@gmail.com', 'jj@gmail.com', 'ak@gmail.com',
  'manan@gmail.com', 'manan1@gmail.com', 'vishal@gmail.com', 'basant@gmail.com'
];

async function purge() {
  console.log('Fetching all auth users...');
  const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 10000 });
  
  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  let deleted = 0;
  for (const email of emailsToPurge) {
    const user = users.find(u => u.email === email);
    if (user) {
      console.log(`Deleting auth entry for ${email} (ID: ${user.id})...`);
      const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(user.id);
      if (delErr) {
        console.error(`Failed to delete ${email}:`, delErr);
      } else {
        console.log(`✅ Successfully deleted auth entry for ${email}`);
        deleted++;
      }
    } else {
      console.log(`ℹ️ No auth entry found for ${email} (already clean)`);
    }
  }
  
  console.log(`\nDone. Purged ${deleted} leftover auth accounts.`);
}

purge();
