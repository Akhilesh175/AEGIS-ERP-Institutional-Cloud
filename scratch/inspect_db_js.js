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

const supabaseAdmin = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'],
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function run() {
  const { data: schools } = await supabaseAdmin.from('schools').select('*');
  console.log('--- SCHOOLS ---');
  console.log(schools);

  const { data: teachers } = await supabaseAdmin.from('teachers').select('*');
  console.log('--- TEACHERS ---');
  console.log(teachers);

  const { data: classes } = await supabaseAdmin.from('classes').select('*');
  console.log('--- CLASSES ---');
  console.log(classes);

  const { data: subjects } = await supabaseAdmin.from('subjects').select('*');
  console.log('--- SUBJECTS ---');
  console.log(subjects);
}

run().catch(console.error);
