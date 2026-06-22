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
  const parentId = '22b46288-28d8-428d-9616-19f6aa870e25';
  
  const { data: user, error: userErr } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('id', parentId)
    .maybeSingle();
  console.log('Parent user in public.users:', user);
  if (userErr) console.error('Parent query error:', userErr);

  const { data: mapping, error: mapErr } = await supabaseAdmin
    .from('parent_student_mapping')
    .select('*')
    .eq('parent_id', parentId);
  console.log('Parent mapping:', mapping);
}

run().catch(console.error);
