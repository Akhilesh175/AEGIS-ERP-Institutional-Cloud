import './load-env';
import './mock-localStorage';
import { supabaseAdmin } from '../src/lib/supabase';

async function run() {
  const { data: schools } = await supabaseAdmin.from('schools').select('id').limit(1);
  const schoolId = schools?.[0]?.id;
  console.log("School ID:", schoolId);

  // Check columns of students table
  const { data: columnsInfo, error: columnsError } = await supabaseAdmin.rpc('exec_sql', {
    sql: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'students';
    `
  });
  console.log("Students Columns Error:", columnsError?.message);
  console.log("Students Columns Info:", columnsInfo);

  // Create a dummy user
  const email = `temp-student-${Math.random().toString(36).substring(2, 7)}@aegis.com`;
  const { data: authUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: 'Password123!',
    email_confirm: true,
    user_metadata: { school_id: schoolId, role: 'STUDENT' }
  });
  if (authErr || !authUser?.user) {
    console.error("Auth creation error:", authErr);
    return;
  }
  const userId = authUser.user.id;

  // Insert profile
  const { error: profileErr } = await supabaseAdmin.from('users').insert({
    id: userId,
    email,
    role: 'STUDENT',
    first_name: 'Temp',
    last_name: 'Student',
    school_id: schoolId,
    is_active: true
  });
  console.log("Profile Insert error:", profileErr?.message);

  // Try insert student
  const studentRecordId = crypto.randomUUID();
  const { data: studentInsertRes, error: studentInsertErr } = await supabaseAdmin.from('students').insert({
    id: studentRecordId,
    user_id: userId,
    school_id: schoolId,
    class_id: null,
    admission_number: `ADM-${Math.random().toString(36).substring(2, 7)}`,
    roll_number: 999,
    gender: 'MALE',
    date_of_birth: '2010-01-01'
  }).select('*');

  console.log("Student Insert Result:", studentInsertRes);
  console.log("Student Insert Error:", studentInsertErr);

  // Clean up
  if (userId) {
    await supabaseAdmin.from('students').delete().eq('id', studentRecordId);
    await supabaseAdmin.from('users').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
  }
}

run().catch(console.error);
