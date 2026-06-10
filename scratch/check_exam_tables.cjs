const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc2RjcHFreG94cGJpbmF6bWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4NDkzNiwiZXhwIjoyMDk1MzYwOTM2fQ.i3JVukYtqoEQVxIwzgMyicC_jwRgSsFkQ99BqRWPTrc';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runCheck() {
  console.log('--- TESTING STUDENT MARKS ---');
  const { data: stMarks, error: err1 } = await supabase.from('student_marks').select('*').limit(1);
  console.log('student_marks:', stMarks, 'Error:', err1);

  console.log('\n--- TESTING EXAM MARKS ---');
  const { data: exMarks, error: err2 } = await supabase.from('exam_marks').select('*').limit(1);
  console.log('exam_marks:', exMarks, 'Error:', err2);
}

runCheck();
