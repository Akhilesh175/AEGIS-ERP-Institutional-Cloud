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
  console.log("Checking parent details...");
  const { data: users, error: err1 } = await supabaseAdmin
    .from('users')
    .select('id, email, first_name, last_name, role, school_id')
    .eq('role', 'PARENT');
  console.log("Parent Users:", users);

  for (const parentUser of users || []) {
    const { data: parent } = await supabaseAdmin
      .from('parents')
      .select('id')
      .eq('user_id', parentUser.id)
      .maybeSingle();
    console.log(`Parent record for user ${parentUser.email}:`, parent);

    if (parent) {
      const { data: mappings } = await supabaseAdmin
        .from('parent_student_mappings')
        .select('*')
        .eq('parent_id', parent.id);
      console.log(`Student mappings for parent ${parent.id}:`, mappings);

      if (mappings && mappings.length > 0) {
        for (const mapping of mappings) {
          const { data: student } = await supabaseAdmin
            .from('students')
            .select('id, school_id, user_id')
            .eq('id', mapping.student_id)
            .maybeSingle();
          console.log(`Student record for ID ${mapping.student_id}:`, student);
        }
      }
    }
  }
}

run().catch(console.error);
