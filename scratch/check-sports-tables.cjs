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
  console.log("Fetching list of tables...");
  const { data: tables, error } = await supabaseAdmin.rpc('get_student_class_id'); // Just check what RPCs we have or query directly
  
  // Since we don't have get_tables_list, we can run a direct SQL query or use pg_catalog.
  // Wait, does Supabase JS client allow running arbitrary SQL? No, only via RPC.
  // Let's see if we can read columns by doing a SELECT * from pg_attribute/information_schema using a simple select query or check if there is an RPC we can use.
  // Wait, let's write a script that queries each table with .select('*').limit(1) and prints the keys!
  const targetTables = [
    'school_payment_settings',
    'sports_fee_payments',
    'sports_salary_records',
    'sports_budget_allocations',
    'sports_expenses',
    'sports_fines',
    'sports_budget_history',
    'sports_fine_payments',
    'sports_expense_requests'
  ];

  for (const table of targetTables) {
    try {
      const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
      if (error) {
        console.log(`Table "${table}" - Error: ${error.message} (${error.code})`);
      } else {
        const columns = data.length > 0 ? Object.keys(data[0]) : "No rows (table exists)";
        console.log(`Table "${table}" - Exists! Columns:`, columns);
      }
    } catch (e) {
      console.log(`Table "${table}" - Catch Error:`, e.message);
    }
  }
}

run().catch(console.error);
