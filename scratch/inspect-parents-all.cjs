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
  const { data: parents, error } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('role', 'PARENT');
  console.log('All parent users:', JSON.stringify(parents, null, 2));

  const { data: pTable, error: pErr } = await supabaseAdmin
    .from('parents')
    .select('*');
  console.log('All public.parents entries:', JSON.stringify(pTable, null, 2));
}

run().catch(console.error);
