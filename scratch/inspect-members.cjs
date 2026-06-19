const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

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
  console.log('--- Chat Members Check ---\n');

  const { data: members, error } = await supabaseAdmin
    .from('class_chat_members')
    .select('*, users(first_name, last_name, role), class_chat_groups(name)');
  
  if (error) {
    console.error('Error fetching members:', error.message);
  } else {
    console.log(`Found ${members.length} members in class_chat_members:`);
    members.forEach(m => {
      console.log(`- Member ID: ${m.id}`);
      console.log(`  User: ${m.users?.first_name} ${m.users?.last_name} (${m.users?.role})`);
      console.log(`  Group: ${m.class_chat_groups?.name}`);
      console.log(`  Role in Chat: ${m.role}`);
    });
  }
}

run().catch(console.error);
