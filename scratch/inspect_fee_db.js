import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, ...parts] = line.split('=');
    envVars[key.trim()] = parts.join('=').trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const tables = [
    'fee_payments',
    'fee_structures',
    'assignments',
    'assignment_submissions',
    'quizzes',
    'quiz_attempts',
    'quiz_results',
    'transport_fee_records',
    'hostel_fees',
    'hostel_payments'
  ];

  for (const table of tables) {
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
    console.log(`\n=== Table: ${table} ===`);
    if (error) {
      console.error('Error:', error.message);
    } else if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]));
      console.log('Sample Data:', data[0]);
    } else {
      console.log('Table is empty.');
      // Try to find columns by inserting empty object or querying pg_attribute
      const { error: insErr } = await supabaseAdmin.from(table).insert({});
      if (insErr) {
        console.log('Insert error showing fields:', insErr.message);
      }
    }
  }
}

run();
