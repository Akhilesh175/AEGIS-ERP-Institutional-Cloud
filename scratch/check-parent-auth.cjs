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
const serviceRoleKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const meetingId = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
  const userId = 'd6c61203-2878-4f85-8252-d319bd6224ee'; // basantkry1@gmail.com user_id

  const { data: isPart, error: err1 } = await supabase.rpc('is_meeting_participant', {
    p_meeting_id: meetingId,
    p_user_id: userId
  });
  console.log('is_meeting_participant for parent user_id:', { isPart, err1 });

  const pathName = `0a5e1f1a-8a04-4b77-8215-a7ab9a48e342/fa0219ff-3058-4fed-8c99-89378a0f3caa/attachments/1782125974770_test.txt`;
  const { data: isStPart, error: err2 } = await supabase.rpc('is_storage_meeting_participant', {
    p_object_name: pathName,
    p_user_id: userId
  });
  console.log('is_storage_meeting_participant for parent:', { isStPart, err2 });
}

run().catch(console.error);
