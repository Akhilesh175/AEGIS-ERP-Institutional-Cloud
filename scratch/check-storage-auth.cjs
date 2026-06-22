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
const serviceRoleKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const userId = '38f8269e-fb13-4ca1-aada-a5c59e83417e'; // vishal@gmail.com
  const pathName = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342/fa0219ff-3058-4fed-8c99-89378a0f3caa/attachments/1782125974770_test.txt';

  const { data: isAuth, error } = await supabase.rpc('is_storage_meeting_participant', {
    p_object_name: pathName,
    p_user_id: userId
  });

  console.log('is_storage_meeting_participant result:', { isAuth, error });
}

run().catch(console.error);
