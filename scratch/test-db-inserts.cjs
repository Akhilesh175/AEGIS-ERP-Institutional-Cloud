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
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  // Sign in
  console.log('Signing in...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'vishal@gmail.com',
    password: 'Password123!'
  });

  if (authError) {
    console.error('Auth error:', authError);
    return;
  }

  const session = authData.session;
  console.log('Signed in successfully! User ID:', session.user.id);
  
  const schoolId = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
  const meetingId = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
  const filePath = `${schoolId}/${meetingId}/attachments/${Date.now()}_test.txt`;

  console.log("Testing insert ptm_chat_attachments (no select)...");
  const attachmentResult = await supabase.from('ptm_chat_attachments').insert({
    school_id: schoolId,
    meeting_id: meetingId,
    sender_id: session.user.id,
    sender_role: 'TEACHER',
    file_name: 'test.txt',
    file_size: 100,
    file_type: 'text/plain',
    storage_path: filePath,
    public_url: ''
  });
  console.log("ptm_chat_attachments insert (no select) result:", attachmentResult);
}

run().catch(console.error);
