import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function check() {
  const { data: tables, error } = await supabaseAdmin.rpc('get_tables_list');
  if (error) {
    // If rpc doesn't exist, query pg_catalog or information_schema via a standard query
    // Wait, let's try querying information_schema via a dummy select or rpc if available.
    // Actually we can query using a table that is always present, or query pg_class.
    // Let's use custom RPC or dynamic SQL if we have custom SQL editor or we can run via migration.
    // Wait! In Supabase, can we query information_schema directly via REST?
    // Usually, the REST API does not expose information_schema unless it's in the API schema.
    // Let's query some tables to see if they exist.
    console.log('Querying individual tables to verify existence:');
    const tablesToTest = [
      'schools', 'users', 'students', 'classes', 'academic_sessions',
      'exams', 'exam_schedules', 'exam_marks', 'report_cards',
      'vehicle_logs', 'transport_assignments', 'transport_fee_records', 'routes', 'buses', 'drivers',
      'book_categories', 'book_inventory', 'book_issues', 'book_returns', 'library_fines', 'digital_library_assets',
      'quizzes', 'quiz_questions', 'quiz_attempts', 'quiz_results'
    ];
    for (const t of tablesToTest) {
      const { data, error } = await supabaseAdmin.from(t).select('count', { count: 'exact', head: true });
      if (error) {
        console.log(`Table "${t}": ❌ ERROR: ${error.message}`);
      } else {
        console.log(`Table "${t}":  EXIST (count: ${data})`);
      }
    }
  }
}

check();
