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
  console.log("Inspecting report_cards columns by testing different UUID inserts...");
  
  const school_id = '65e1b24f-f8ac-4dea-ad32-2e4973e43d3c';
  const academic_session_id = '7618c7e7-b75f-47c7-b012-9e594647d575';
  const student_id = '12143737-58b7-4b48-a9a3-bef1cceb9ead';

  // Test 1: Let's see if a successful insert works with all real UUIDs!
  console.log("Test 1: Successful insert with all valid UUIDs:");
  const res1 = await supabaseAdmin.from('report_cards').insert({
    school_id,
    academic_session_id,
    student_id,
    term: 'TERM 1',
    attendance_percentage: 90,
    grade_point_average: 8.5,
    remarks: 'Test remarks 1',
    file_url: ''
  }).select();
  console.log("Res 1 error:", res1.error);
  console.log("Res 1 data:", res1.data);

  // Test 2: Let's pass school_id = ''
  console.log("\nTest 2: school_id = ''");
  const res2 = await supabaseAdmin.from('report_cards').insert({
    school_id: '',
    academic_session_id,
    student_id,
    term: 'TERM 1',
    remarks: 'Test remarks'
  });
  console.log("Res 2 error:", res2.error?.message);

  // Test 3: Let's pass academic_session_id = ''
  console.log("\nTest 3: academic_session_id = ''");
  const res3 = await supabaseAdmin.from('report_cards').insert({
    school_id,
    academic_session_id: '',
    student_id,
    term: 'TERM 1',
    remarks: 'Test remarks'
  });
  console.log("Res 3 error:", res3.error?.message);

  // Test 4: Let's pass student_id = ''
  console.log("\nTest 4: student_id = ''");
  const res4 = await supabaseAdmin.from('report_cards').insert({
    school_id,
    academic_session_id,
    student_id: '',
    term: 'TERM 1',
    remarks: 'Test remarks'
  });
  console.log("Res 4 error:", res4.error?.message);
}

run().catch(console.error);
