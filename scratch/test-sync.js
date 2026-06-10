import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => {
  const line = env.split('\n').find(l => l.startsWith(key + '='));
  return line ? line.split('=')[1].trim() : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const schoolId = '0dccd8a8-ec60-42d2-8f2e-381c01f49ac8';

const tables = [
  { name: 'hostels', query: supabase.from('hostels').select('*').eq('school_id', schoolId) },
  { name: 'hostel_blocks', query: supabase.from('hostel_blocks').select('*').eq('school_id', schoolId) },
  { name: 'hostel_rooms', query: supabase.from('hostel_rooms').select('*').eq('school_id', schoolId) },
  { name: 'hostel_beds', query: supabase.from('hostel_beds').select('*').eq('school_id', schoolId) },
  { name: 'hostel_admissions', query: supabase.from('hostel_admissions').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId) },
  { name: 'hostel_attendance', query: supabase.from('hostel_attendance').select('*, student:students(*, userDetails:users(*)), recordedByDetails:users!recorded_by(*)').eq('school_id', schoolId) },
  { name: 'hostel_fees', query: supabase.from('hostel_fees').select('*').eq('school_id', schoolId) },
  { name: 'hostel_payments', query: supabase.from('hostel_payments').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId) },
  { name: 'hostel_leave_requests', query: supabase.from('hostel_leave_requests').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId) },
  { name: 'hostel_visitors', query: supabase.from('hostel_visitors').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId) },
  { name: 'hostel_complaints', query: supabase.from('hostel_complaints').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId) },
  { name: 'hostel_mess_menu', query: supabase.from('hostel_mess_menu').select('*').eq('school_id', schoolId) },
  { name: 'hostel_wardens', query: supabase.from('hostel_wardens').select('*, userDetails:users(*)').eq('school_id', schoolId) }
];

async function check() {
  for (const t of tables) {
    console.log(`Querying ${t.name}...`);
    const { data, error } = await t.query;
    if (error) {
      console.error(`❌ Error in ${t.name}:`, error.message, error.details || '');
    } else {
      console.log(`✅ Success in ${t.name}: ${data?.length} rows`);
    }
  }
}

check();
