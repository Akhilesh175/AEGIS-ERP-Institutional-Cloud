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
  const { data: teachers } = await supabaseAdmin.from('teachers').select('*');
  console.log("All Teachers:", teachers);

  const { data: userRoles } = await supabaseAdmin.from('user_roles').select('*');
  console.log("All User Roles:", userRoles);

  if (teachers && teachers.length > 0) {
    const userIds = teachers.map(t => t.user_id);
    const { data: users } = await supabaseAdmin.from('users').select('*').in('id', userIds);
    console.log("Linked Users:", users);
  }
}

run().catch(console.error);
