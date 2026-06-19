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
  const schoolId = '39b3c4f3-cb58-41c7-be8d-bfd6dee31350';
  console.log(`=== INSPECTING GRADING & TIMETABLE FOR SCHOOL ${schoolId} ===`);

  const { data: classes } = await supabaseAdmin.from('classes').select('id, name');
  console.log('Classes:', classes);

  const { data: subjects } = await supabaseAdmin.from('subjects').select('id, name, code');
  console.log('Subjects:', subjects);

  const { data: marks } = await supabaseAdmin.from('student_marks').select('*').eq('school_id', schoolId);
  console.log('Student Marks:', marks);

  const { data: reportCards } = await supabaseAdmin.from('report_cards').select('*').eq('school_id', schoolId);
  console.log('Report Cards:', reportCards);

  const { data: timetables } = await supabaseAdmin.from('timetables').select('*');
  console.log('Timetables count:', timetables?.length);
}

run();
