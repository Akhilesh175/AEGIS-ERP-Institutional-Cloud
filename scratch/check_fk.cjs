const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc2RjcHFreG94cGJpbmF6bWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4NDkzNiwiZXhwIjoyMDk1MzYwOTM2fQ.i3JVukYtqoEQVxIwzgMyicC_jwRgSsFkQ99BqRWPTrc';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runCheck() {
  const { data, error } = await supabase.rpc('get_table_info', { table_name: 'transport_assignments' });
  // If get_table_info doesn't exist, let's just query information_schema via custom sql or direct select.
  // Wait, let's do a query to information_schema using supabase.rpc or check by trying to insert a mock record.
  // Actually, we can run a postgres query by selecting from pg_catalog or information_schema.
  // In Supabase, standard users cannot easily query pg_catalog unless they use an RPC.
  // Let's see if there is an RPC we can use, or if we can run query on information_schema.columns.
  const { data: cols, error: colErr } = await supabase.from('users').select('id').limit(1);
  console.log('Cols:', cols, colErr);

  // Let's run a query on information_schema using supabase.from('information_schema.columns')
  // Wait, we can't always do that due to RLS/exposed tables.
  // But we can try to insert a record into transport_assignments.
  // Let's fetch a student and their user_id first.
  const { data: students } = await supabase.from('students').select('id, user_id').limit(1);
  console.log('Student:', students);

  if (students && students.length > 0) {
    const student = students[0];
    const { data: routes } = await supabase.from('routes').select('id').limit(1);
    const { data: buses } = await supabase.from('buses').select('id').limit(1);
    console.log('Route:', routes, 'Bus:', buses);
    if (routes && routes.length > 0 && buses && buses.length > 0) {
      console.log('Inserting with student.id (student table)...');
      const { data: res1, error: err1 } = await supabase.from('transport_assignments').insert({
        student_id: student.id,
        route_id: routes[0].id,
        bus_id: buses[0].id,
        school_id: 'eaa39dd2-d93f-4583-81d4-c89b0ee83f3a'
      });
      console.log('Result 1 (student.id):', res1, err1);

      console.log('Inserting with student.user_id (users table)...');
      const { data: res2, error: err2 } = await supabase.from('transport_assignments').insert({
        student_id: student.user_id,
        route_id: routes[0].id,
        bus_id: buses[0].id,
        school_id: 'eaa39dd2-d93f-4583-81d4-c89b0ee83f3a'
      });
      console.log('Result 2 (student.user_id):', res2, err2);
    }
  }
}

runCheck();
