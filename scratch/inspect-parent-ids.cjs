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

async function inspectIds() {
  const parentIdInMeeting = 'd6c61203-2878-4f85-8252-d319bd6224ee';
  
  const { data: userRecord, error: uErr } = await supabaseAdmin
    .from('users')
    .select('id, role, email')
    .eq('id', parentIdInMeeting)
    .maybeSingle();
  
  console.log("Searching in 'users' table:", userRecord, uErr);

  const { data: parentRecord, error: pErr } = await supabaseAdmin
    .from('parents')
    .select('id, user_id')
    .eq('id', parentIdInMeeting)
    .maybeSingle();

  console.log("Searching in 'parents' table by id:", parentRecord, pErr);

  const { data: parentRecord2, error: pErr2 } = await supabaseAdmin
    .from('parents')
    .select('id, user_id')
    .eq('user_id', parentIdInMeeting)
    .maybeSingle();

  console.log("Searching in 'parents' table by user_id:", parentRecord2, pErr2);
}

inspectIds();
