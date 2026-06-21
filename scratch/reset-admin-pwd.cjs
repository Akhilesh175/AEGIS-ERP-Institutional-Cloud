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
  const userId = '464e95e6-2c5b-40d4-849e-2d92ae017078';
  const email = 'test-final-deploy-success-7@aegiserp.xyz';
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: 'Password123!'
  });
  if (error) {
    console.error(`Failed to reset password for ${email}:`, error.message);
  } else {
    console.log(`Successfully reset password for ${email} to Password123!`);
  }
}

run().catch(console.error);
