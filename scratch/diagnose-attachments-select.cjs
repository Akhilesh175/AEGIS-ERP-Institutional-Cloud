/**
 * Deep investigation of ptm_chat_attachments SELECT policy
 * Check what's actually in the table vs what RLS returns
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

async function run() {
  // First check what's in the table via admin (bypasses RLS)
  const admin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: adminData } = await admin.from('ptm_chat_attachments').select('*').eq('meeting_id', MEETING_ID);
  console.log('Admin (bypassing RLS) - ptm_chat_attachments count:', adminData?.length);
  
  if (adminData && adminData.length > 0) {
    console.log('Sample row school_id:', adminData[0].school_id);
    console.log('Sample row meeting_id:', adminData[0].meeting_id);
  }
  
  // Now sign in as teacher and check the SELECT
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData } = await supabase.auth.signInWithPassword({ email: 'vishal@gmail.com', password: 'Password123!' });
  const userId = authData.session.user.id;
  console.log('\nSigned in as teacher:', userId);
  
  // Check what get_auth_user_school_id returns in context
  const { data: schoolIdFromRpc } = await supabase.rpc('get_auth_user_school_id');
  console.log('get_auth_user_school_id returns:', schoolIdFromRpc);
  
  // Check is_meeting_participant
  const { data: isMeetPart } = await supabase.rpc('is_meeting_participant', { p_meeting_id: MEETING_ID, p_user_id: userId });
  console.log('is_meeting_participant:', isMeetPart);
  
  // Try SELECT with explicit school_id filter
  const { data: withSchool } = await supabase
    .from('ptm_chat_attachments')
    .select('id, school_id, meeting_id, file_name')
    .eq('meeting_id', MEETING_ID)
    .eq('school_id', SCHOOL_ID);
  console.log('\nSELECT with school_id filter:', withSchool?.length, 'rows');
  
  // Try SELECT with just meeting_id
  const { data: withMeeting } = await supabase
    .from('ptm_chat_attachments')
    .select('id, school_id, meeting_id, file_name')
    .eq('meeting_id', MEETING_ID);
  console.log('SELECT with just meeting_id filter:', withMeeting?.length, 'rows');

  // Try SELECT with no filter at all
  const { data: noFilter, error: noFilterErr } = await supabase
    .from('ptm_chat_attachments')
    .select('id, school_id, meeting_id');
  console.log('SELECT with no filter:', noFilter?.length, 'rows, error:', noFilterErr?.message || 'none');
  
  console.log('\nDIAGNOSIS: If admin shows rows but user shows 0, the SELECT policy is filtering them out');
  console.log('The policy uses: school_id = get_auth_user_school_id() AND is_meeting_participant(meeting_id, auth.uid())');
  console.log('Both conditions are true but SELECT returns 0. This means the POLICY IS NOT MATCHING.');
  console.log('Possible cause: The policy is the FOR ALL policy that uses USING which also applies to INSERT.');
  console.log('When we INSERT without .select(), the data IS saved but the SELECT still hits the policy.');
  console.log('The policy SHOULD match: school_id matches AND is_meeting_participant returns true.');
  console.log('Unless... the FOR ALL policy is blocking because the USING clause sees the school_id from the new row,');
  console.log('and there is some other policy running on top.');
}

run().catch(console.error);
