const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc2RjcHFreG94cGJpbmF6bWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4NDkzNiwiZXhwIjoyMDk1MzYwOTM2fQ.i3JVukYtqoEQVxIwzgMyicC_jwRgSsFkQ99BqRWPTrc';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testIssue() {
  const { data: books } = await supabase.from('book_inventory').select('id').limit(1);
  const { data: students } = await supabase.from('students').select('id, user_id').limit(1);

  console.log('Book ID:', books?.[0]?.id, 'Student ID:', students?.[0]?.id, 'User ID:', students?.[0]?.user_id);

  if (books && books.length > 0 && students && students.length > 0) {
    const { data: res1, error: err1 } = await supabase.from('book_issues').insert({
      school_id: 'eaa39dd2-d93f-4583-81d4-c89b0ee83f3a',
      book_id: books[0].id,
      student_id: students[0].id,
      due_date: new Date().toISOString()
    });
    console.log('Result with student_id:', res1, err1);

    const { data: res2, error: err2 } = await supabase.from('book_issues').insert({
      school_id: 'eaa39dd2-d93f-4583-81d4-c89b0ee83f3a',
      book_id: books[0].id,
      user_id: students[0].user_id,
      due_date: new Date().toISOString()
    });
    console.log('Result with user_id:', res2, err2);
  }
}

testIssue();
