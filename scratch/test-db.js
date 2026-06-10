import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env manually
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

async function check() {
  console.log('Checking roles and tables...');
  
  // Check if roles table has HOSTEL_ADMIN
  const { data: roles, error: rolesError } = await supabaseAdmin
    .from('roles')
    .select('*');
  
  if (rolesError) {
    console.error('Error fetching roles:', rolesError);
  } else {
    console.log('Roles in DB:', roles.map(r => `${r.role_code} (${r.school_id})`));
  }

  // Check if hostel_admins table exists
  const { data: hostelAdmins, error: hostelAdminsError } = await supabaseAdmin
    .from('hostel_admins')
    .select('*')
    .limit(1);
  
  if (hostelAdminsError) {
    console.log('hostel_admins table error (might not exist):', hostelAdminsError.message);
  } else {
    console.log('hostel_admins table exists! Rows:', hostelAdmins);
  }
}

check().catch(console.error);
