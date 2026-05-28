import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseAdmin = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'],
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function testInsert() {
  const teacherId = 'bbbd1987-5952-4a2d-92ba-7a1a5a53fff5';
  
  // Fetch teacher to get school_id
  const { data: teacher, error: tError } = await supabaseAdmin
    .from('teachers')
    .select('*')
    .eq('id', teacherId)
    .single();
    
  if (tError || !teacher) {
    console.error('Error fetching teacher:', tError);
    return;
  }
  
  console.log('Teacher fetched successfully. School ID:', teacher.school_id);
  
  // Fetch a subject
  const { data: subjects } = await supabaseAdmin
    .from('subjects')
    .select('*')
    .eq('school_id', teacher.school_id);
    
  if (!subjects || subjects.length === 0) {
    console.error('No subjects found.');
    return;
  }
  
  const subjectId = subjects[0].id;
  console.log('Using subject ID:', subjectId);

  // Try to insert a quiz
  console.log('Attempting to insert quiz...');
  const { data: quiz, error: qError } = await supabaseAdmin
    .from('quizzes')
    .insert({
      school_id: teacher.school_id,
      subject_id: subjectId,
      teacher_id: teacherId,
      title: 'Vite & Jest Integration Test Quiz',
      duration_minutes: 15,
      total_marks: 10,
      due_date: new Date(Date.now() + 86400000).toISOString()
    })
    .select()
    .single();

  if (qError) {
    console.error('Quiz insertion FAILED:', qError);
  } else {
    console.log('Quiz insertion SUCCEEDED! Quiz ID:', quiz.id);
    
    // Clean it up
    const { error: dError } = await supabaseAdmin
      .from('quizzes')
      .delete()
      .eq('id', quiz.id);
      
    if (dError) {
      console.error('Quiz deletion cleanup failed:', dError);
    } else {
      console.log('Quiz deleted successfully during cleanup.');
    }
  }
}

testInsert().catch(console.error);
