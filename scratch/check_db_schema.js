import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env manually
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
    'exams', 'exam_subjects', 'student_marks', 'exam_results', 'report_cards',
    'vehicle_logs', 'transport_assignments', 'transport_fee_records',
    'book_categories', 'book_inventory', 'book_issues', 'book_returns', 'library_fines', 'digital_library_assets',
    'quizzes', 'quiz_questions', 'quiz_results'
  ];

  for (const table of tables) {
    const query = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = '${table}'
      ORDER BY ordinal_position;
    `;
    const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: query });
    if (error) {
      console.error(`Error describing table "${table}":`, error.message);
    } else {
      console.log(`\n=== Table Schema: "${table}" ===`);
      data.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
    }
  }
}

run().catch(console.error);
