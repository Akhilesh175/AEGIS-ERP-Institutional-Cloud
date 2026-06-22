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
  const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260622_sports_finance_fixes.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');
  console.log("Running Sports Finance Fixes Migration SQL...");
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error("Failed to execute SQL:", error.message);
    process.exit(1);
  } else {
    console.log("Migration executed successfully! Result:", data);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
