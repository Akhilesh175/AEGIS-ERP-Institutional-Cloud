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
  const { data: userRec } = await supabase
    .from('users')
    .select('*')
    .eq('email', 'vishal@gmail.com')
    .single();
  console.log('User vishal@gmail.com:', userRec);

  if (userRec) {
    const { data: teacherRec } = await supabase
      .from('teachers')
      .select('*')
      .eq('user_id', userRec.id);
    console.log('Teacher record:', teacherRec);

    const meetingId = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
    const { data: meetingRec } = await supabase
      .from('ptm_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();
    console.log('PTM Meeting record:', meetingRec);

    // Let's call the RPC function directly
    const { data: isParticipant, error: rpcError } = await supabase
      .rpc('is_meeting_participant', { p_meeting_id: meetingId, p_user_id: userRec.id });
    console.log('is_meeting_participant RPC result:', { isParticipant, rpcError });
  }
}

run().catch(console.error);
