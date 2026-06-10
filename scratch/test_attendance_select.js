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

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const schoolId = 'eaa39dd2-d93f-4583-81d4-c89b0ee83f3a';
  
  // Test join with users on recorded_by
  console.log('Testing select join with users on recorded_by...');
  const { data, error } = await supabaseAdmin
    .from('hostel_attendance')
    .select('*, student:students(*, userDetails:users(*)), recordedByDetails:users!recorded_by(*)')
    .eq('school_id', schoolId)
    .limit(1);

  if (error) {
    console.error('Select join failed:', error.message, error.details, error.hint);
  } else {
    console.log('Select join succeeded! Data:', data);
  }
}

run();
