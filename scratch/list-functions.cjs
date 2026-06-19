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

async function run() {
  // We can query pg_proc to find any function names containing 'sql' or 'exec'
  // But wait, can we do a direct query? No, we don't have exec_sql yet.
  // Wait, let's see if we can query pg_proc by calling a select on it? No, pg_proc is not a public table.
  // Wait, is there any other custom RPC that we saw in grep?
  // Let's look at the grep results:
  // - scratch/run_communicator_migration.js line 22: supabaseAdmin.rpc('exec_sql', { sql: sql });
  // - scratch/run_warden_migration.js line 26: supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  // - scratch/test_run_sql.js: 'run_sql', 'exec_sql', 'execute_sql', 'sql', 'query', 'exec', 'execute'
  // Let's write a script to try executing sql on these rpc functions!
  // Wait! In `list-all-tables.cjs` we tried `exec_sql` with `sql_query` and got:
  // "Could not find the function public.exec_sql(sql_query) in the schema cache"
  // And in `execute-push-migration.ts` it tried `exec_sql` with `sql` and got:
  // "Could not find the function public.exec_sql(sql) in the schema cache"
  // Let's try calling `exec_sql` with parameter `sql_query` or `sql`? Wait, both failed.
  // Wait! Let's check if there is an RPC named `exec_sql` at all!
  // Let's try calling different RPCs with a simple 'SELECT 1' query.
  
  const rpcs = [
    { name: 'exec_sql', params: { sql: 'SELECT 1' } },
    { name: 'exec_sql', params: { sql_query: 'SELECT 1' } },
    { name: 'execute_sql', params: { sql: 'SELECT 1' } },
    { name: 'execute_sql', params: { sql_query: 'SELECT 1' } },
    { name: 'run_sql', params: { sql: 'SELECT 1' } },
    { name: 'run_sql', params: { sql_query: 'SELECT 1' } }
  ];

  for (const rpc of rpcs) {
    try {
      const { data, error } = await supabaseAdmin.rpc(rpc.name, rpc.params);
      if (error) {
        console.log(`RPC ${rpc.name} with params ${JSON.stringify(rpc.params)} failed:`, error.message);
      } else {
        console.log(`RPC ${rpc.name} with params ${JSON.stringify(rpc.params)} succeeded! Result:`, data);
      }
    } catch (e) {
      console.log(`RPC ${rpc.name} threw error:`, e.message);
    }
  }
}

run().catch(console.error);
