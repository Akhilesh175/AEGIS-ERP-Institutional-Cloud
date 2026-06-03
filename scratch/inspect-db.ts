import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable(tableName: string) {
  console.log(`\n--- Inspecting ${tableName} ---`);
  const { data, error } = await supabaseAdmin
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.error(`Error querying ${tableName}:`, error.message, error.details, error.hint);
  } else {
    console.log(`Success querying ${tableName}!`);
    if (data && data.length > 0) {
      console.log('Columns found:', Object.keys(data[0]));
    } else {
      console.log('No rows in table. Trying to get columns via insert rollback... or schema definition.');
      // Try to insert a dummy/empty row to get validation error which reveals column info
      const { error: insertError } = await supabaseAdmin.from(tableName).insert({});
      if (insertError) {
        console.log('Insert error response (reveals constraints):', insertError.message, insertError.details);
      }
    }
  }
}

async function main() {
  const tables = [
    'drivers',
    'buses',
    'routes',
    'pickup_points',
    'transport_assignments',
    'transport_fee_records',
    'vehicle_logs',
    'maintenance_logs',
    'driver_attendance',
    'driver_salary_payouts',
    'exams',
    'exam_subjects',
    'student_marks',
    'exam_results',
    'book_categories',
    'books',
    'book_inventory',
    'book_issues',
    'book_returns',
    'library_fines',
    'digital_library_assets',
    'quizzes'
  ];

  for (const table of tables) {
    await inspectTable(table);
  }
}

main().catch(console.error);
