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
  const { data, error } = await supabaseAdmin.from('schools').select('id, name').limit(1);
  if (error) {
    console.error('Error querying schools:', error.message);
  } else {
    console.log('Schools:', data);
  }
  
  const { data: chatGroups, error: cgError } = await supabaseAdmin.from('class_chat_groups').select('id').limit(1);
  if (cgError) {
    console.log('class_chat_groups select failed:', cgError.message);
  } else {
    console.log('class_chat_groups select succeeded:', chatGroups);
  }
}

run().catch(console.error);
