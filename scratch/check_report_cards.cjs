const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log("Checking report_cards table structure and testing dummy insert...");
  
  // Try inserting into report_cards
  const res = await supabaseAdmin.from('report_cards').insert({
    school_id: 'school-1',
    academic_session_id: 'session-1', // Try a non-UUID first to see if it complains about type or if it accepts it
    student_id: 'student-1',
    term: 'TERM 1',
    attendance_percentage: 90,
    grade_point_average: 8.5,
    remarks: 'Test remarks',
    file_url: ''
  }).select();
  
  console.log("Insert response error:", res.error);
  console.log("Insert response data:", res.data);
}

run().catch(console.error);
