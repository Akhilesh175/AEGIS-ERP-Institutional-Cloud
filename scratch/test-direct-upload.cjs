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
  // Sign in as vishal@gmail.com
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
  const schoolId = session.user.user_metadata?.schoolId || 'f1b9b9b9-b9b9-49b9-b9b9-b9b9b9b9b9b9'; // let's find schoolId or use a valid one
  // Let's query user record to find real school_id
  const { data: userRec } = await supabase
    .from('users')
    .select('school_id')
    .eq('id', session.user.id)
    .single();
  const realSchoolId = userRec.school_id;
  const meetingId = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
  console.log('Real school_id:', realSchoolId);

  const filePath = `${realSchoolId}/${meetingId}/attachments/${Date.now()}_test.txt`;
  console.log('Upload target filePath:', filePath);

  const uploadUrl = `${supabaseUrl}/storage/v1/object/ptm-chat-files/${filePath}`;
  console.log('Upload URL:', uploadUrl);

  const fileContent = 'Hello direct upload progress test!';
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': supabaseAnonKey,
      'Content-Type': 'text/plain'
    },
    body: fileContent
  });

  const responseText = await response.text();
  console.log('Upload Status:', response.status);
  console.log('Upload Response:', responseText);
}

run().catch(console.error);
