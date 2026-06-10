import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data, error } = await supabaseAdmin.from('messaging_channels').select('*').limit(1);
  console.log('messaging_channels:', { data, error });
  
  const { data: data2, error: error2 } = await supabaseAdmin.from('messaging_participants').select('*').limit(1);
  console.log('messaging_participants:', { data2, error2 });

  const { data: data3, error: error3 } = await supabaseAdmin.from('messages').select('*').limit(1);
  console.log('messages:', { data3, error3 });
}

run();
