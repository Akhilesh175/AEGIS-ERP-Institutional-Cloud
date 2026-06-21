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
  const { data: parent, error } = await supabaseAdmin
    .from('parents')
    .select('*, users(*)')
    .eq('id', '4e324127-ea8d-497c-b6b6-e21633d05637')
    .single();
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Parent profile with users:", parent);
  }
}

run().catch(console.error);
