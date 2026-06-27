import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => {
  const line = env.split('\n').find(l => l.startsWith(key + '='));
  return line ? line.split('=')[1].trim() : '';
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function tryCall(rpcName, argKey) {
  try {
    const { data, error } = await supabaseAdmin.rpc(rpcName, { [argKey]: 'SELECT 1;' });
    if (error && error.message.includes('Could not find the function')) {
      console.log(`RPC ${rpcName}(${argKey}): NOT FOUND (${error.message})`);
      return false;
    }
    console.log(`RPC ${rpcName}(${argKey}): SUCCESS/CALLABLE (error: ${error?.message}, data: ${JSON.stringify(data)})`);
    return true;
  } catch (e) {
    console.error(`CATCH ERROR for ${rpcName}(${argKey}):`, e.message);
    return false;
  }
}

async function run() {
  const names = ['exec_sql', 'exec_sql_admin', 'execute_sql', 'run_sql', 'sql_query_admin'];
  const args = ['sql', 'sql_query', 'query'];

  for (const name of names) {
    for (const arg of args) {
      await tryCall(name, arg);
    }
  }
}

run().catch(console.error);
