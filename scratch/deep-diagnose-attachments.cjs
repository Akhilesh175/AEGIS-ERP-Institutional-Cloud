/**
 * Deep-dive: Why does ptm_chat_attachments SELECT return 0 rows even after
 * inserting a ptm_participants row in the same session?
 * 
 * Hypothesis 1: The new ptm_participants INSERT row is not yet committed/visible
 *               when is_meeting_participant is called during SELECT USING check
 *               (unlikely - same transaction issue)
 * 
 * Hypothesis 2: The new SELECT policy uses is_meeting_participant which checks
 *               ptm_participants. But is_meeting_participant is a SECURITY DEFINER
 *               function with SET search_path = public. It should bypass RLS on
 *               ptm_participants... wait, SECURITY DEFINER bypasses RLS only if
 *               the function is running as the definer (postgres). Let's verify.
 *
 * Hypothesis 3: The ptm_chat_attachments SELECT policy evaluates is_meeting_participant
 *               which checks ptm_participants. But ptm_participants now has its OWN
 *               SELECT policy (from our migration). If is_meeting_participant is NOT
 *               SECURITY DEFINER, it runs as the calling user and gets filtered by
 *               ptm_participants SELECT policy.
 *
 * Wait - is_meeting_participant IS marked SECURITY DEFINER SET search_path = public.
 * So it should run as the function owner (postgres role) and bypass RLS.
 * Unless validateMeetingParticipant is called and that function's SELECT on
 * ptm_participants also hits RLS...
 *
 * Actually: SECURITY DEFINER functions bypass RLS only if the function owner
 * has privileges. The function owner is postgres (superuser) so it should
 * bypass RLS entirely for its internal queries.
 *
 * This means is_meeting_participant SHOULD work correctly.
 *
 * Let me test with a clean approach: sign in, don't insert participant,
 * check if attachments are visible (new policy allows direct meeting membership)
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env','utf-8').split('\n').forEach(l => { const p = l.split('='); if(p.length>=2) env[p[0].trim()] = p.slice(1).join('=').trim(); });

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const MEETING_ID = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
const SCHOOL_ID = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';

async function run() {
  console.log('=== Diagnosing ptm_chat_attachments SELECT ===\n');

  // Step 1: Check how many rows exist via admin
  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: adminRows } = await admin.from('ptm_chat_attachments').select('id, sender_id, file_name').eq('meeting_id', MEETING_ID);
  console.log('Admin sees', adminRows?.length, 'rows in ptm_chat_attachments');
  adminRows?.forEach(r => console.log('  -', r.id, r.file_name, 'sender:', r.sender_id));

  // Step 2: Sign in as teacher and check
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  await supabase.auth.signInWithPassword({ email: 'vishal@gmail.com', password: 'Password123!' });
  const { data: { user } } = await supabase.auth.getUser();
  console.log('\nTeacher user ID:', user.id);

  // Check is_meeting_participant
  const { data: isMeet } = await supabase.rpc('is_meeting_participant', { p_meeting_id: MEETING_ID, p_user_id: user.id });
  console.log('is_meeting_participant:', isMeet);

  // Check what ptm_participants rows teacher sees
  const { data: myParts } = await supabase.from('ptm_participants').select('id, left_at').eq('meeting_id', MEETING_ID).eq('user_id', user.id).is('left_at', null);
  console.log('Teacher active ptm_participants rows:', myParts?.length);

  // Check attachments
  const { data: attachments, error: attachErr } = await supabase.from('ptm_chat_attachments').select('*').eq('meeting_id', MEETING_ID);
  console.log('Teacher ptm_chat_attachments SELECT:', attachments?.length, 'rows, error:', attachErr?.message || 'none');

  // NEW INSIGHT: The new SELECT policy requires is_meeting_participant to be TRUE.
  // But is_meeting_participant uses validateMeetingParticipant which:
  //   - Checks ptm_participants for left_at IS NULL
  //   - THEN falls back to direct meeting membership
  // Since teacher is listed as the teacher in ptm_meetings, the fallback should work.
  
  // Let me verify the teacher is the meeting teacher
  const { data: meeting } = await admin.from('ptm_meetings').select('teacher_id, parent_id').eq('id', MEETING_ID).single();
  console.log('\nMeeting teacher_id:', meeting?.teacher_id);
  
  // Get the teacher record for the teacher user
  const { data: teacherRecord } = await admin.from('teachers').select('id, user_id').eq('user_id', user.id).single();
  console.log('Teacher record id:', teacherRecord?.id);
  console.log('Meeting teacher_id matches teacher record:', meeting?.teacher_id === teacherRecord?.id);

  // The validateMeetingParticipant function checks:
  // m.teacher_id IN (SELECT id FROM public.teachers WHERE user_id = p_user_id)
  // So it should return TRUE for the teacher.
  
  // Let me check if validateMeetingParticipant is now exposed as RPC (it wasn't before)
  const { data: validateResult, error: validateErr } = await supabase.rpc('validateMeetingParticipant', { p_meeting_id: MEETING_ID, p_user_id: user.id });
  console.log('\nvalidateMeetingParticipant RPC:', validateResult, validateErr?.message || 'none');
  
  // If is_meeting_participant returns true but SELECT returns 0...
  // The issue might be that the NEWLY inserted rows (from this test session) 
  // use school_id = SCHOOL_ID but the new SELECT policy also checks school_id = get_auth_user_school_id()
  // AND is_meeting_participant(meeting_id, auth.uid())
  // Both should be true...
  
  // Let me check what the actual database policy currently shows
  // by trying different filters to narrow down
  const { data: r1 } = await supabase.from('ptm_chat_attachments').select('id').limit(100);
  console.log('\nNo filter:', r1?.length, 'rows');
  
  const { data: r2 } = await supabase.from('ptm_chat_attachments').select('id').eq('school_id', SCHOOL_ID).limit(100);
  console.log('school_id filter:', r2?.length, 'rows');

  // Key test: check if there's actually a race condition between INSERT and SELECT
  // in the same HTTP connection. Each Supabase client call is a separate HTTP request.
  // Wait 1 second and try again
  console.log('\nWaiting 2 seconds for any replication lag...');
  await new Promise(r => setTimeout(r, 2000));
  
  const { data: r3 } = await supabase.from('ptm_chat_attachments').select('id, file_name, meeting_id').eq('meeting_id', MEETING_ID);
  console.log('After 2s wait:', r3?.length, 'rows');
  r3?.forEach(r => console.log(' -', r.id, r.file_name));
}

run().catch(console.error);
