import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => env.split('\n').find(l => l.startsWith(key + '=')).split('=')[1].trim();

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabase.from('school_subscriptions').select('*').limit(1);
  console.log('QueryResult:', data, error);
}

check();
