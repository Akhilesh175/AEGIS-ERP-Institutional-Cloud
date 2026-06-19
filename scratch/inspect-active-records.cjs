const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

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
  console.log("--- Fetching Active Database Entities ---");

  const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
  console.log("\nSchools:", schools);

  const { data: sessions } = await supabaseAdmin.from('academic_sessions').select('id, name, school_id');
  console.log("\nAcademic Sessions:", sessions);

  const { data: teachers } = await supabaseAdmin
    .from('teachers')
    .select('id, school_id, user_id, employee_id');
  
  // Get teacher names from users table
  if (teachers && teachers.length > 0) {
    const userIds = teachers.map(t => t.user_id);
    const { data: userProfiles } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', userIds);
    console.log("\nTeachers:", teachers.map(t => {
      const p = userProfiles?.find(u => u.id === t.user_id);
      return {
        teacher_id: t.id,
        user_id: t.user_id,
        school_id: t.school_id,
        name: p ? `${p.first_name} ${p.last_name}` : 'Unknown',
        email: p ? p.email : 'Unknown'
      };
    }));
  } else {
    console.log("\nTeachers: None");
  }

  const { data: students } = await supabaseAdmin
    .from('students')
    .select('id, school_id, user_id, class_id, roll_number');
  
  if (students && students.length > 0) {
    const studentUserIds = students.map(s => s.user_id);
    const { data: studentProfiles } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name, email')
      .in('id', studentUserIds);
    console.log("\nStudents Sample (first 5):", students.slice(0, 5).map(s => {
      const p = studentProfiles?.find(u => u.id === s.user_id);
      return {
        student_id: s.id,
        user_id: s.user_id,
        school_id: s.school_id,
        class_id: s.class_id,
        name: p ? `${p.first_name} ${p.last_name}` : 'Unknown',
        email: p ? p.email : 'Unknown'
      };
    }));
  } else {
    console.log("\nStudents: None");
  }
}

run().catch(console.error);
