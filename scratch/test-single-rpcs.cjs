const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
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

async function tryCall(rpcName, argKey) {
  try {
    const { data, error } = await supabaseAdmin.rpc(rpcName, { [argKey]: 'SELECT 1;' });
    if (error && error.message.includes('Could not find the function')) {
      return false;
    }
    console.log(`RPC ${rpcName}(${argKey}): SUCCESS/CALLABLE (error: ${error?.message}, data: ${JSON.stringify(data)})`);
    return true;
  } catch (e) {
    console.error(`CATCH ERROR for ${rpcName}(${argKey}):`, e);
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
