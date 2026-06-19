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
  const tables = [
    'sports_coaches',
    'sports_admins',
    'sports_finance_transactions',
    'sports_salary_records',
    'sports_budget_allocations',
    'sports_expenses',
    'sports_fines',
    'sports_activity_logs'
  ];

  for (const table of tables) {
    console.log(`\n=== Columns of table: ${table} ===`);
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (error) {
      console.log(`Error querying ${table}: ${error.message}`);
    } else if (data && data.length > 0) {
      console.log(Object.keys(data[0]));
    } else {
      console.log("No records. Doing dummy insert to see error...");
      const { error: insErr } = await supabaseAdmin.from(table).insert({});
      if (insErr) {
        console.log(`Error output: ${insErr.message}`);
      } else {
        console.log("Inserted empty successfully.");
        await supabaseAdmin.from(table).delete().limit(1);
      }
    }
  }
}

run().catch(console.error);
