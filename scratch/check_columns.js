import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => env.split('\n').find(l => l.startsWith(key + '=')).split('=')[1].trim();

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabaseAdmin
    .from('hostels')
    .select('*')
    .limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log('Columns in hostels table:', data && data.length > 0 ? Object.keys(data[0]) : 'No rows returned');
  }
}
check();
