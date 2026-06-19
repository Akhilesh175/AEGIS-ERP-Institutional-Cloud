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
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  const schoolId = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
  
  const { data: groups } = await supabaseAdmin
    .from('class_chat_groups')
    .select('*')
    .eq('school_id', schoolId);
  console.log('--- Chat Groups for PARANTAP ---');
  console.log(JSON.stringify(groups, null, 2));

  const { data: members } = await supabaseAdmin
    .from('class_chat_members')
    .select('*, users(first_name, last_name, email)')
    .eq('school_id', schoolId);
  console.log('--- Chat Members for PARANTAP ---');
  console.log(JSON.stringify(members, null, 2));
}

run().catch(console.error);
