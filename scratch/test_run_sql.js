import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => env.split('\n').find(l => l.startsWith(key + '=')).split('=')[1].trim();

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testRpc(name) {
  try {
    const { data, error } = await supabaseAdmin.rpc(name, { query: 'SELECT 1;', sql: 'SELECT 1;', sql_query: 'SELECT 1;' });
    if (error && error.code === 'P0001') {
      console.log(`RPC ${name}: function exists but failed with PG error (which means it's callable!)`);
      return true;
    }
    if (error && error.message.includes('does not exist')) {
      return false;
    }
    console.log(`RPC ${name} returned:`, data, error);
    return !error;
  } catch (e) {
    return false;
  }
}

async function run() {
  const rpcs = ['run_sql', 'exec_sql', 'execute_sql', 'sql', 'query', 'exec', 'execute'];
  for (const rpc of rpcs) {
    const ok = await testRpc(rpc);
    if (ok) {
      console.log(`Found usable RPC: ${rpc}`);
      break;
    }
  }
}
run();
