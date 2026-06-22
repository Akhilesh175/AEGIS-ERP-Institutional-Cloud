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
  const users = [
    { email: 'vishal@gmail.com', id: '38f8269e-fb13-4ca1-aada-a5c59e83417e' },
    { email: 'basantkry1@gmail.com', id: 'd6c61203-2878-4f85-8252-d319bd6224ee' }
  ];

  for (const user of users) {
    console.log(`Updating password for ${user.email} (ID: ${user.id})...`);
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: 'Password123!' }
    );
    if (error) {
      console.error(`Failed to update password for ${user.email}:`, error.message);
    } else {
      console.log(`Successfully updated password for ${user.email}!`);
    }
  }
}

run().catch(console.error);
