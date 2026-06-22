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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: students, error: stErr } = await supabaseAdmin
    .from('students')
    .select('id, user_id, class_id, users(first_name, last_name)');
  console.log('Students:', JSON.stringify(students, null, 2));

  const { data: mappings, error: mapErr } = await supabaseAdmin
    .from('parent_student_mapping')
    .select('*');
  console.log('Mappings:', JSON.stringify(mappings, null, 2));
}

run().catch(console.error);
