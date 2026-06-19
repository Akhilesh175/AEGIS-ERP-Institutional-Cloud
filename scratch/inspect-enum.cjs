const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

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
  // Query enum values for user_role
  const { data, error } = await supabaseAdmin.rpc('execute_sql', {
    sql_query: "SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'user_role'"
  });
  if (error) {
    // try direct SQL if execute_sql exists, otherwise try querying pg_catalog via select
    console.error('RPC error:', error.message);
  } else {
    console.log('user_role enum labels:', data);
  }

  // Let's also check user roles in the users table
  const { data: usersData, error: usersErr } = await supabaseAdmin.from('users').select('role').limit(5);
  if (usersErr) {
    console.error('Error querying users role:', usersErr.message);
  } else {
    console.log('Sample user roles from users table:', usersData);
  }
}

run().catch(console.error);
