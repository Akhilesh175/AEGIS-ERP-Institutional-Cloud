const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env','utf-8').split('\n').forEach(l => { const p = l.split('='); if(p.length>=2) env[p[0].trim()] = p.slice(1).join('=').trim(); });

const MEETING_ID = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
const SCHOOL_ID = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
const TEACHER_ID = '38f8269e-fb13-4ca1-aada-a5c59e83417e';

async function run() {
  const supabase = createClient(env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']);
  await supabase.auth.signInWithPassword({ email: 'vishal@gmail.com', password: 'Password123!' });
  console.log('Signed in as teacher');
  
  // Test 1: The actual policy condition manually
  const { data: schoolId } = await supabase.rpc('get_auth_user_school_id');
  console.log('get_auth_user_school_id:', schoolId, '(expected:', SCHOOL_ID, ')');
  console.log('Match:', schoolId === SCHOOL_ID);
  
  // Test 2: is_meeting_participant 
  const { data: isMeetPart } = await supabase.rpc('is_meeting_participant', { p_meeting_id: MEETING_ID, p_user_id: TEACHER_ID });
  console.log('is_meeting_participant:', isMeetPart);
  
  // Test 3: SELECT from ptm_chat_attachments with very specific filter
  console.log('\nTesting ptm_chat_attachments SELECT:');
  
  const r1 = await supabase.from('ptm_chat_attachments').select('id').limit(100);
  console.log('No filter:', r1.data?.length, 'rows, status:', r1.status, 'error:', r1.error?.message);
  
  const r2 = await supabase.from('ptm_chat_attachments').select('id').eq('sender_id', TEACHER_ID).limit(100);
  console.log('sender_id filter:', r2.data?.length, 'rows, status:', r2.status, 'error:', r2.error?.message);
  
  const r3 = await supabase.from('ptm_chat_attachments').select('id').eq('meeting_id', MEETING_ID).limit(100);
  console.log('meeting_id filter:', r3.data?.length, 'rows, status:', r3.status, 'error:', r3.error?.message);
  
  // Test 4: Can teacher SELECT from ptm_messages (same policy)?
  console.log('\nTesting ptm_messages SELECT (same policy):');
  const r4 = await supabase.from('ptm_messages').select('id').limit(100);
  console.log('ptm_messages no filter:', r4.data?.length, 'rows, status:', r4.status, 'error:', r4.error?.message);
  
  // Test 5: Compare the two table names (maybe ptm_chat_attachments has a DIFFERENT policy!)
  // Check what the policy references in ptm_chat_attachments vs ptm_messages
  console.log('\n=== HYPOTHESIS: ptm_chat_attachments may still have the old policy from migration 20260626 ===');
  console.log('Migration 20260626 created: ptm_chat_attachments_policy FOR ALL USING is_meeting_participant');
  console.log('Migration 20260627 REDEFINED it with the same FOR ALL USING is_meeting_participant');  
  console.log('Migration 20260628 REDEFINED it again with the same FOR ALL USING is_meeting_participant');
  console.log('So the policy SHOULD allow reads when is_meeting_participant is true.');
  console.log('');
  console.log('Wait... is_meeting_participant in RLS context calls validateMeetingParticipant');
  console.log('which checks ptm_participants for left_at IS NULL...');
  console.log('But the teacher has many active rows!');
  console.log('');
  console.log('ANOTHER HYPOTHESIS: Maybe the ptm_participants SELECT POLICY is blocking');
  console.log('the validateMeetingParticipant function from reading ptm_participants rows!');
  console.log('The ptm_participants_policy (from migration 20260628) may itself call is_meeting_participant');
  console.log('creating a recursive deadlock!');
  
  // Let's check ptm_participants policy
  const r5 = await supabase.from('ptm_participants').select('id').limit(5);
  console.log('\nptm_participants SELECT:', r5.data?.length, 'rows, error:', r5.error?.message);
}

run().catch(console.error);
