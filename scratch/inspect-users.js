import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => {
  const line = env.split('\n').find(l => l.startsWith(key + '='));
  return line ? line.split('=')[1].trim() : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const tables = ['finance_admins', 'academic_admins', 'exam_controllers', 'librarians', 'transport_managers', 'hostel_admins', 'hostel_wardens'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*');
    console.log(`--- ${t} ---`, error ? error.message : data);
  }
}

check();
