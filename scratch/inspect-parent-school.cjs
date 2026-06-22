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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const parentUserId = 'd6c61203-2878-4f85-8252-d319bd6224ee'; // parent user_id from ptm_meetings
  const { data: parentUser, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', parentUserId)
    .single();

  console.log("Parent User Record:", parentUser, error);
}

run().catch(console.error);
