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

async function resetPwd(userId, email, newPassword) {
  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword
  });
  if (error) {
    console.error(`Failed to reset password for ${email}:`, error.message);
  } else {
    console.log(`Successfully reset password for ${email} (${userId})`);
  }
}

async function run() {
  const users = [
    { id: '7a7321a6-0c91-4132-b444-731219bcd150', email: 'jp@gmail.com' },
    { id: '58adfee0-aacb-4900-9246-a1364ca01750', email: 'manan@gmail.com' },
    { id: '38f8269e-fb13-4ca1-aada-a5c59e83417e', email: 'vishal@gmail.com' }
  ];

  for (const u of users) {
    await resetPwd(u.id, u.email, 'Password123!');
  }
}

run().catch(console.error);
