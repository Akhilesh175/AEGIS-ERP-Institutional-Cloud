import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => env.split('\n').find(l => l.startsWith(key + '=')).split('=')[1].trim();

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const { data, error } = await supabaseAdmin
    .rpc('get_my_claims') // just checking if RPC works
    .catch(e => ({ error: e }));
  
  console.log('RPC check result:', data, error);
}
check();
