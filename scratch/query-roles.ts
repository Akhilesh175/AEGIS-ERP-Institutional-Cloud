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
  console.log("=== DISTINCT ROLES IN USERS TABLE ===");
  const { data: userRoles, error: err1 } = await supabaseAdmin.from('users').select('role');
  if (err1) {
    console.error("Error reading users:", err1.message);
  } else {
    const roles = Array.from(new Set(userRoles.map((u: any) => u.role)));
    console.log("Roles in users table:", roles);
  }

  console.log("\n=== ALL ROWS IN ROLES TABLE ===");
  const { data: rolesTable, error: err2 } = await supabaseAdmin.from('roles').select('*');
  if (err2) {
    console.error("Error reading roles table:", err2.message);
  } else {
    console.log("Roles in roles table:", rolesTable);
  }

  console.log("\n=== ALL ROWS IN ROLE_PERMISSIONS TABLE ===");
  const { data: permsTable, error: err3 } = await supabaseAdmin.from('role_permissions').select('*').limit(10);
  if (err3) {
    console.error("Error reading role_permissions:", err3.message);
  } else {
    console.log("Sample role_permissions:", permsTable);
  }
}

run().catch(console.error);
