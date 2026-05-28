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

async function check() {
  const tables = ['quizzes', 'quiz_questions', 'quiz_attempts', 'attempts'];
  for (const t of tables) {
    const { error } = await supabaseAdmin.from(t).select('count', { count: 'exact', head: true }).limit(1);
    if (error) {
      console.log(`Table "${t}" does NOT exist or error:`, error.message);
    } else {
      console.log(`Table "${t}" EXISTS!`);
    }
  }
}

check();
