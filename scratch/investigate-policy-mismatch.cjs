/**
 * Check if is_meeting_participant actually works from within an RLS policy context
 * by testing it differently - checking if the function can see the ptm_participants rows
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const MEETING_ID = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
const SCHOOL_ID = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
const TEACHER_ID = '38f8269e-fb13-4ca1-aada-a5c59e83417e';

async function run() {
  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  
  // Check what policies currently exist on ptm_chat_attachments 
  // Use admin to check information_schema for policies
  const { data: openApiData } = await admin.from('ptm_chat_attachments').select('id').limit(1);
  console.log('Admin SELECT from ptm_chat_attachments:', openApiData?.length, 'rows (bypass RLS)');

  // Use admin to run is_meeting_participant in SECURITY DEFINER context - as the teacher user
  // Actually we can't impersonate from service role through RPC easily.
  // Let's instead check what the validateMeetingParticipant function signature looks like
  const { data: funcData, error: funcErr } = await admin.rpc('validateMeetingParticipant', {
    p_meeting_id: MEETING_ID,
    p_user_id: TEACHER_ID
  });
  console.log('validateMeetingParticipant (admin context):', funcData, funcErr?.message);
  
  const { data: isPartData, error: isPartErr } = await admin.rpc('is_meeting_participant', {
    p_meeting_id: MEETING_ID,
    p_user_id: TEACHER_ID
  });
  console.log('is_meeting_participant (admin context):', isPartData, isPartErr?.message);

  // Check the actual participants for this meeting
  const { data: parts } = await admin
    .from('ptm_participants')
    .select('user_id, role, joined_at, left_at')
    .eq('meeting_id', MEETING_ID)
    .eq('user_id', TEACHER_ID)
    .is('left_at', null);
  console.log('\nActive teacher participants rows:', parts?.length);
  parts?.forEach(p => console.log('  -', p.role, '| joined:', p.joined_at, '| left:', p.left_at));
  
  // Now sign in as teacher
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData } = await supabase.auth.signInWithPassword({ email: 'vishal@gmail.com', password: 'Password123!' });
  console.log('\n=== Teacher authenticated ===');
  console.log('User ID:', authData.session.user.id);
  
  // Check if teacher can read their own participant rows
  const { data: myParticipants, error: partsErr } = await supabase
    .from('ptm_participants')
    .select('id, role, joined_at, left_at')
    .eq('meeting_id', MEETING_ID)
    .eq('user_id', TEACHER_ID)
    .is('left_at', null);
  console.log('Teacher can read own ptm_participants rows:', myParticipants?.length, 'rows, error:', partsErr?.message || 'none');
  
  // Check the messages table directly - we know this works
  const { data: msgs } = await supabase.from('ptm_messages').select('id').eq('meeting_id', MEETING_ID).limit(1);
  console.log('Teacher can read ptm_messages:', msgs?.length, 'rows');
  
  // The ptm_messages SELECT policy also uses is_meeting_participant - same as ptm_chat_attachments
  // If ptm_messages works but ptm_chat_attachments doesn't, it's the SAME function but the table may have a different active policy
  
  // Let's check OpenAPI schema to see what policies are listed
  const schemaRes = await fetch(`${supabaseUrl}/rest/v1/`, {
    headers: { 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
  });
  const schema = await schemaRes.json();
  const paths = Object.keys(schema.paths || {}).filter(p => p.includes('ptm_chat_attach'));
  console.log('\nOpenAPI paths for ptm_chat_attachments:', paths);
}

run().catch(console.error);
