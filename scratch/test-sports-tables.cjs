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
  const tables = ['sports', 'sports_enrollments', 'sports_coaches'];
  for (const table of tables) {
    const { data, error } = await supabaseAdmin.from(table).select('count', { count: 'exact', head: true });
    if (error) {
      console.log(`Table "${table}" existence: ❌ ERROR: ${error.message} (${error.code})`);
    } else {
      console.log(`Table "${table}" existence:  EXIST (count: ${data})`);
    }
  }
}

run().catch(console.error);
