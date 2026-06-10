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
    'school_settings', 'schools', 'institution_profile',
    'students', 'student_profiles', 'admissions', 'parents',
    'exams', 'exam_subjects', 'student_marks', 'exam_results', 'marksheets', 'exam_subject_marks', 'gradebook', 'report_cards',
    'attendance', 'student_attendance',
    'student_activity_grades', 'co_scholastic_records',
    'teacher_remarks', 'report_card_remarks',
    'staff_profiles'
  ];

  console.log('Checking table presence in schema...');
  for (const table of tables) {
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': NOT accessible or does not exist (${error.message})`);
    } else {
      console.log(`Table '${table}': EXISTS (Accessible)`);
    }
  }
}

run();
