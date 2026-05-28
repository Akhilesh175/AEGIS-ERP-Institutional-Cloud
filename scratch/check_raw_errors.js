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
  const tables = ['quizzes', 'quiz_questions', 'quiz_attempts'];
  for (const t of tables) {
    console.log(`--- Querying ${t} ---`);
    const { data, error } = await supabaseAdmin.from(t).select('*');
    if (error) {
      console.log('Error:', error);
    } else {
      console.log('Data count:', data?.length);
      if (data && data.length > 0) {
        console.log('Keys:', Object.keys(data[0]));
      }
    }
  }
}

run();
