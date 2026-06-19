import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, ...parts] = line.split('=');
    envVars[key.trim()] = parts.join('=').trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: subjects } = await supabaseAdmin.from('subjects').select('id, name, code');
  console.log('=== SUBJECT MAP ===');
  subjects.forEach(s => {
    console.log(`ID: ${s.id} | Name: ${s.name} | Code: ${s.code}`);
  });
}

run();
