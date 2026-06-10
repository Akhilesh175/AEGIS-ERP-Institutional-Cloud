const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function inspectTable(tableName) {
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
      console.log('No rows in table. Trying to get columns via insert rollback...');
      // Try to insert a dummy/empty row to get validation error which reveals column info
      const { error: insertError } = await supabaseAdmin.from(tableName).insert({});
      if (insertError) {
        console.log('Insert error response:', insertError.message, insertError.details);
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
    'quizzes',
    'forum_categories',
    'forum_posts'
  ];

  for (const table of tables) {
    await inspectTable(table);
  }
}

main().catch(console.error);
