import './mock-localStorage';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

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
  console.log("=== CHECKING USERS BY ROLE ===");
  const targetRoles = [
    'ADMIN',
    'SCHOOL_ADMIN',
    'FINANCE_ADMIN',
    'FINANCE_ADMINISTRATION',
    'FINANCE_ADMINISTRATION_BILLER'
  ];
  
  const { data: allUsers, error } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, role, school_id');
  
  if (error) {
    console.error("Error reading users:", error);
    return;
  }

  const matched = allUsers.filter((u: any) => targetRoles.includes(u.role));
  console.log(`Matched ${matched.length} users:`);
  matched.forEach((u: any) => {
    console.log(`- ID: ${u.id}, Email: ${u.email}, Name: ${u.first_name} ${u.last_name}, Role: ${u.role}, School ID: ${u.school_id}`);
  });
}

run().catch(console.error);
