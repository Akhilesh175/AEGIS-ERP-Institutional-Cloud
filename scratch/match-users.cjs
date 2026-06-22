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
  const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers();
  const { data: dbUsers } = await supabaseAdmin.from('users').select('*');

  console.log("Matching auth users to db users:");
  authUsers.forEach(au => {
    const dbU = dbUsers.find(du => du.id === au.id);
    console.log(`- Auth Email: ${au.email} | DB Email: ${dbU ? dbU.email : 'NOT FOUND'} | DB Role: ${dbU ? dbU.role : 'N/A'}`);
  });
}

run().catch(console.error);
