import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: { [key: string]: string } = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function tryCall(rpcName: string, argKey: string) {
  const { data, error } = await supabaseAdmin.rpc(rpcName, { [argKey]: 'SELECT 1;' });
  if (error && error.message.includes('Could not find the function')) {
    return false;
  }
  console.log(`RPC ${rpcName}(${argKey}): SUCCESS/CALLABLE (error: ${error?.message}, data: ${data})`);
  return true;
}

async function run() {
  const names = ['exec_sql', 'exec_sql_admin', 'execute_sql', 'run_sql', 'sql_query_admin'];
  const args = ['sql', 'sql_query', 'query'];

  for (const name of names) {
    for (const arg of args) {
      const ok = await tryCall(name, arg);
      if (ok) {
        console.log(`FOUND WORKING SIGNATURE: ${name} with arg ${arg}`);
      }
    }
  }
}

run().catch(console.error);
