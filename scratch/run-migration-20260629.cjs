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
  const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20260629_fix_ptm_participant_rls_deadlock.sql');
  const sql = fs.readFileSync(migrationFile, 'utf-8');
  console.log("Reading migration SQL...");
  
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error("Failed to execute migration SQL:", error);
  } else {
    console.log("Migration executed successfully. Result:", data);
  }
}

run().catch(console.error);
