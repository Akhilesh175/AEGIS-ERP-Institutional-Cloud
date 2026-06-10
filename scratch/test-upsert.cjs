const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const schoolId = 'eaa39dd2-d93f-4583-81d4-c89b0ee83f3a';
  const sessionId = 'fca3bd55-db30-4802-aa78-1a63489335ff';

  // 1. Create an Exam
  console.log('Inserting exam...');
  const { data: examData, error: examErr } = await supabase.from('exams').insert({
    school_id: schoolId,
    academic_session_id: sessionId,
    name: 'Midterm Test',
    term: 'Midterm',
    start_date: '2026-06-01',
    end_date: '2026-06-10'
  }).select();
  
  if (examErr) {
    console.error('Exam insert failed:', examErr);
    return;
  }
  console.log('Exam inserted:', examData);

  const examId = examData[0].id;

  // 2. Get a subject
  const { data: subjects } = await supabase.from('subjects').select('id').limit(1);
  console.log('Subjects:', subjects);

  // 3. Get a student
  const { data: students } = await supabase.from('students').select('id').limit(1);
  console.log('Students:', students);

  if (subjects.length && students.length) {
    const subjectId = subjects[0].id;
    const studentId = students[0].id;

    console.log('Testing student_marks upsert...');
    const { data: markData, error: markErr } = await supabase.from('student_marks').upsert({
      school_id: schoolId,
      exam_id: examId,
      subject_id: subjectId,
      student_id: studentId,
      marks_obtained: 85,
      remarks: 'Excellent'
    }, { onConflict: 'exam_id,subject_id,student_id' }).select();
    
    console.log('Upsert result:', markData, 'Error:', markErr);

    // Clean up
    console.log('Cleaning up...');
    await supabase.from('student_marks').delete().eq('exam_id', examId);
    await supabase.from('exams').delete().eq('id', examId);
    console.log('Cleanup done.');
  } else {
    console.log('Missing subjects or students.');
  }
}

main().catch(console.error);
