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

  console.log("Querying ptm_chat_attachments...");
  const { data: attachments, error } = await supabase.from('ptm_chat_attachments').select('*');
  console.log("Query result:", { attachments, error });
}

run().catch(console.error);
