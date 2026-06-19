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
  const { data: parentUsers } = await supabaseAdmin.from('users').select('*').eq('role', 'PARENT');
  console.log("Parent Users in DB:", parentUsers);

  if (parentUsers && parentUsers.length > 0) {
    const parentUser = parentUsers[0];
    const { data: parent } = await supabaseAdmin.from('parents').select('*').eq('user_id', parentUser.id).single();
    console.log("Parent Record:", parent);

    const { data: mappings } = await supabaseAdmin.from('parent_student_mapping').select('*').eq('parent_id', parent.id);
    console.log("Parent-Student Mappings:", mappings);

    for (const m of mappings) {
      const { data: student } = await supabaseAdmin.from('students').select('*').eq('id', m.student_id).single();
      const { data: studentUser } = await supabaseAdmin.from('users').select('*').eq('id', student.user_id).single();
      console.log(`\n=== Student: ${studentUser.first_name} ${studentUser.last_name} (${student.id}) ===`);
      console.log("Student Details:", student);

      const { data: structures } = await supabaseAdmin.from('fee_structures').select('*').eq('class_id', student.class_id);
      console.log("Fee Structures:", structures);

      const { data: payments } = await supabaseAdmin.from('fee_payments').select('*').eq('student_id', student.id);
      console.log("Fee Payments:", payments);
    }
  }
}

run();
