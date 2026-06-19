import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => env.split('\n').find(l => l.startsWith(key + '=')).split('=')[1].trim();

const client = createClient(getEnv('VITE_SUPABASE_URL'), getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY'));

async function check() {
  const tables = [
    'class_chat_groups',
    'class_chat_members',
    'class_messages'
  ];
  for (const t of tables) {
    const { data, error } = await client.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table ${t} does not exist or error: ${error.message}`);
    } else {
      console.log(`Table ${t} exists!`);
    }
  }
}

check();
