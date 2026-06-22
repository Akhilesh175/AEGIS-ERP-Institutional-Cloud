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
  console.log("Querying sports_fine_payments...");
  const { data, error } = await supabaseAdmin
    .from('sports_fine_payments')
    .select('*, students(*, users(first_name, last_name))');
  
  if (error) {
    console.error("Error fetching fine payments:", error.message);
  } else {
    console.log("Fine payments count:", data.length);
    console.log("Raw Fine Payments rows:", JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
