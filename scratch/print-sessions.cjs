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
  const { data: schools } = await supabaseAdmin.from('schools').select('*');
  console.log('--- Schools ---', JSON.stringify(schools, null, 2));

  const { data: sessions } = await supabaseAdmin.from('academic_sessions').select('*');
  console.log('--- Academic Sessions ---', JSON.stringify(sessions, null, 2));

  const { data: classes } = await supabaseAdmin.from('classes').select('*');
  console.log('--- Classes ---', JSON.stringify(classes, null, 2));
}

run().catch(console.error);
