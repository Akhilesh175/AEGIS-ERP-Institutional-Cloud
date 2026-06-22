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

async function testInsert() {
  const schoolId = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
  const meetingId = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
  const senderId = '38f8269e-fb13-4ca1-aada-a5c59e83417e'; // Vishal Yadav (Teacher user_id)
  
  console.log("Inserting message into ptm_messages...");
  const { data, error } = await supabaseAdmin
    .from('ptm_messages')
    .insert({
      school_id: schoolId,
      meeting_id: meetingId,
      sender_id: senderId,
      sender_role: 'TEACHER',
      message: 'Hello from test script'
    })
    .select();
  
  if (error) {
    console.error("Insert failed:", error);
  } else {
    console.log("Insert succeeded! Data:", data);
  }
}

testInsert();
