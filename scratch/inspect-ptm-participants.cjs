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
  console.log("=== PTM PARTICIPANTS ===");
  const { data, error } = await supabaseAdmin
    .from('ptm_participants')
    .select('*, users(first_name, last_name, role)');
  if (error) {
    console.error("Error fetching participants:", error);
  } else {
    console.log(`Found ${data.length} participants:`);
    data.forEach(p => {
      console.log(`- Meeting ID: ${p.meeting_id}`);
      console.log(`  User: ${p.users?.first_name} ${p.users?.last_name} (${p.users?.role}) | ID: ${p.user_id}`);
      console.log(`  Role: ${p.role}`);
      console.log(`  Joined: ${p.joined_at} | Left: ${p.left_at}`);
    });
  }
}

run().catch(console.error);
