/**
 * Final attempt to apply PTM RLS migration without exec_sql RPC
 * 
 * Strategy: Create a TEMPORARY bootstrap function that executes SQL,
 * then drop it. PostgREST can call any function defined in the public schema.
 * 
 * The trick: Use the Supabase REST API to call a stored procedure that
 * we create using a different mechanism.
 * 
 * ACTUAL STRATEGY:
 * Supabase's service role key bypasses RLS, but to create functions/policies
 * we need DDL access. PostgREST wraps all requests in transactions.
 * 
 * Let's try creating the function using a raw HTTP request to the /rest/v1/rpc/ 
 * endpoint by calling a pre-existing PL/pgSQL function that does something we need.
 * 
 * Wait... let's think differently:
 * - The is_meeting_participant function ALREADY checks direct membership (from our test)
 * - The policies need to be split
 * - We cannot execute DDL via PostgREST API
 * 
 * The ONLY remaining option without a PAT or DB URL is:
 * 1. Use npx supabase CLI with --db-url flag (if we can construct the URL)
 * 2. Apply manually via Dashboard
 * 
 * Let's verify that the CODE CHANGES we already made work correctly first
 * by running a comprehensive test against the CURRENT database state.
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

// Test credentials
const TEACHER_EMAIL = 'vishal@gmail.com';
const TEACHER_PASS = 'Password123!';
const PARENT_EMAIL = 'basantkry1@gmail.com';
const PARENT_PASS = 'Password123!';
const MEETING_ID = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
const SCHOOL_ID = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';

async function testAsUser(email, password, label) {
  console.log(`\n=== Testing as ${label} (${email}) ===`);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error(`  Auth error: ${authError.message}`);
    return;
  }
  
  const userId = authData.session.user.id;
  console.log(`  User ID: ${userId}`);
  
  // Test 1: is_meeting_participant
  const { data: isParticipant, error: rpcErr } = await supabase
    .rpc('is_meeting_participant', { p_meeting_id: MEETING_ID, p_user_id: userId });
  console.log(`  is_meeting_participant: ${isParticipant} (error: ${rpcErr?.message || 'none'})`);
  
  // Test 2: INSERT into ptm_participants (no .select())
  const participantInsert = await supabase.from('ptm_participants').insert({
    school_id: SCHOOL_ID,
    meeting_id: MEETING_ID,
    user_id: userId,
    role: label.toUpperCase(),
    joined_at: new Date().toISOString()
  });
  console.log(`  ptm_participants INSERT: status=${participantInsert.status} error=${participantInsert.error?.message || 'none'}`);
  
  // Test 3: INSERT into ptm_messages (no .select())
  const msgInsert = await supabase.from('ptm_messages').insert({
    school_id: SCHOOL_ID,
    meeting_id: MEETING_ID,
    sender_id: userId,
    sender_role: label.toUpperCase(),
    message: `Test message from ${label} at ${new Date().toISOString()}`,
    message_type: 'TEXT'
  });
  console.log(`  ptm_messages INSERT: status=${msgInsert.status} error=${msgInsert.error?.message || 'none'}`);
  
  // Test 4: SELECT from ptm_messages (requires is_meeting_participant=true)
  const { data: msgs, error: msgSelectErr } = await supabase
    .from('ptm_messages')
    .select('id, message, created_at')
    .eq('meeting_id', MEETING_ID)
    .limit(3);
  console.log(`  ptm_messages SELECT: ${msgs?.length ?? 'null'} rows (error: ${msgSelectErr?.message || 'none'})`);
  
  // Test 5: INSERT into ptm_chat_attachments (no .select())
  const filePath = `${SCHOOL_ID}/${MEETING_ID}/attachments/${Date.now()}_integration_test.txt`;
  const attachInsert = await supabase.from('ptm_chat_attachments').insert({
    school_id: SCHOOL_ID,
    meeting_id: MEETING_ID,
    sender_id: userId,
    sender_role: label.toUpperCase(),
    file_name: 'integration_test.txt',
    file_size: 123,
    file_type: 'text/plain',
    storage_path: filePath,
    public_url: ''
  });
  console.log(`  ptm_chat_attachments INSERT: status=${attachInsert.status} error=${attachInsert.error?.message || 'none'}`);
  
  // Test 6: SELECT from ptm_chat_attachments
  const { data: attachments, error: attachSelectErr } = await supabase
    .from('ptm_chat_attachments')
    .select('id, file_name, created_at')
    .eq('meeting_id', MEETING_ID)
    .limit(3);
  console.log(`  ptm_chat_attachments SELECT: ${attachments?.length ?? 'null'} rows (error: ${attachSelectErr?.message || 'none'})`);
  
  await supabase.auth.signOut();
}

async function run() {
  console.log('=== PTM Integration Test — Current Database State ===\n');
  console.log('Project URL:', supabaseUrl);
  console.log('Meeting ID:', MEETING_ID);
  
  await testAsUser(TEACHER_EMAIL, TEACHER_PASS, 'TEACHER');
  await testAsUser(PARENT_EMAIL, PARENT_PASS, 'PARENT');
  
  console.log('\n=== Test Complete ===');
  console.log('\nINTERPRETATION:');
  console.log('- INSERT status 201 = SUCCESS (no .select() used, correct behavior)');
  console.log('- SELECT returning rows = POLICY ALLOWS READ');
  console.log('- SELECT returning 0 rows (no error) = POLICY FILTERS OUT (may need migration)');
  console.log('- Error containing "42501" or "Row-level" = RLS DENIAL (migration definitely needed)');
}

run().catch(console.error);
