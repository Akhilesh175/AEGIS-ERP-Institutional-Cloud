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
  console.log("Testing insert with st-1 as student_id...");
  const school_id = '65e1b24f-f8ac-4dea-ad32-2e4973e43d3c';
  const academic_session_id = '7618c7e7-b75f-47c7-b012-9e594647d575';

  const res = await supabaseAdmin.from('report_cards').insert({
    school_id,
    academic_session_id,
    student_id: 'st-1',
    term: 'TERM 1',
    remarks: 'Test remarks'
  });
  console.log("Error message:", res.error?.message);
}

run().catch(console.error);
