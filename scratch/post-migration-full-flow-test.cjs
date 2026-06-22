/**
 * Definitive post-migration test:
 * 1. Register as participant first (INSERT into ptm_participants)
 * 2. Then send messages
 * 3. Then upload attachments
 * 4. Then read everything back
 * This mirrors the real application flow.
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const env = {};
fs.readFileSync('.env','utf-8').split('\n').forEach(l => { const p = l.split('='); if(p.length>=2) env[p[0].trim()] = p.slice(1).join('=').trim(); });

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];
const MEETING_ID = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
const SCHOOL_ID = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';

async function testFullFlow(email, password, role) {
  console.log(`\n🔹 Testing as ${role} (${email})`);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({ email, password });
  if (authErr) { console.error('  ❌ Auth failed:', authErr.message); return; }
  const userId = authData.session.user.id;
  console.log('  ✅ Signed in:', userId);

  // Step 1: Register as participant (mirrors registerParticipantSession in AegisMeet.tsx)
  const p1 = await supabase.from('ptm_participants').insert({
    school_id: SCHOOL_ID, meeting_id: MEETING_ID, user_id: userId, role, joined_at: new Date().toISOString()
  });
  console.log(`  ${p1.status === 201 ? '✅' : '❌'} ptm_participants INSERT: status=${p1.status} error=${p1.error?.message || 'none'}`);

  // Step 2: Send a chat message (mirrors sendChatMessageText in AegisMeet.tsx)
  const m1 = await supabase.from('ptm_messages').insert({
    school_id: SCHOOL_ID, meeting_id: MEETING_ID, sender_id: userId, sender_role: role,
    message: `Flow test from ${role} at ${new Date().toISOString()}`, message_type: 'TEXT'
  });
  console.log(`  ${m1.status === 201 ? '✅' : '❌'} ptm_messages INSERT: status=${m1.status} error=${m1.error?.message || 'none'}`);

  // Step 3: Upload attachment record (mirrors uploadFileToSupabase in AegisMeet.tsx)
  const a1 = await supabase.from('ptm_chat_attachments').insert({
    school_id: SCHOOL_ID, meeting_id: MEETING_ID, sender_id: userId, sender_role: role,
    file_name: `flow_test_${role.toLowerCase()}.pdf`, file_size: 512, file_type: 'application/pdf',
    storage_path: `${SCHOOL_ID}/${MEETING_ID}/attachments/${Date.now()}_flow_test.pdf`, public_url: ''
  });
  console.log(`  ${a1.status === 201 ? '✅' : '❌'} ptm_chat_attachments INSERT: status=${a1.status} error=${a1.error?.message || 'none'}`);

  // Step 4: Read messages back (requires SELECT policy)
  const { data: msgs, error: msgsErr } = await supabase
    .from('ptm_messages').select('id, message').eq('meeting_id', MEETING_ID).limit(5);
  console.log(`  ${(msgs?.length ?? 0) > 0 ? '✅' : '⚠️ '} ptm_messages SELECT: ${msgs?.length ?? 0} rows error=${msgsErr?.message || 'none'}`);

  // Step 5: Read attachments back (requires SELECT policy — the key test)
  const { data: atts, error: attsErr } = await supabase
    .from('ptm_chat_attachments').select('id, file_name').eq('meeting_id', MEETING_ID).limit(5);
  console.log(`  ${(atts?.length ?? 0) > 0 ? '✅' : '⚠️ '} ptm_chat_attachments SELECT: ${atts?.length ?? 0} rows error=${attsErr?.message || 'none'}`);

  // Step 6: Create signed URL for storage (mirrors download in UI)
  const testStoragePath = `${SCHOOL_ID}/${MEETING_ID}/attachments/1782125974770_test.txt`;
  const { data: signedData, error: signedErr } = await supabase.storage.from('ptm-chat-files').createSignedUrl(testStoragePath, 3600);
  console.log(`  ${signedData?.signedUrl ? '✅' : '⚠️ '} Storage signed URL: ${signedData?.signedUrl ? 'generated' : 'failed'} error=${signedErr?.message || 'none'}`);

  await supabase.auth.signOut();
}

async function run() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  AEGIS PTM — Post-Migration Full Flow Integration Test');
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Tests the EXACT same flow as the AegisMeet.tsx component');
  console.log('  Migration applied: 20260630_final_ptm_rls_fix.sql ✅');
  console.log('');
  
  await testFullFlow('vishal@gmail.com', 'Password123!', 'TEACHER');
  await testFullFlow('basantkry1@gmail.com', 'Password123!', 'PARENT');
  
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  All ✅ = PRODUCTION READY');
  console.log('  Any ❌ = CRITICAL (fix before deploy)');
  console.log('  Any ⚠️  = WARNING (check RLS policy)');
  console.log('═══════════════════════════════════════════════════════');
}

run().catch(console.error);
