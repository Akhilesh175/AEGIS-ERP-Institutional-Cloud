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
    'sports_fee_payments'
  ];
  for (const table of tables) {
    const { count, error } = await supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table "${table}" existence: ❌ ERROR: ${error.message} (${error.code})`);
    } else {
      console.log(`Table "${table}" existence:  EXIST (count: ${count})`);
    }
  }
}

run().catch(console.error);
