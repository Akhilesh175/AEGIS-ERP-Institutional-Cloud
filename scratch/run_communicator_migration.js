import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const sql = fs.readFileSync('supabase/migrations/20260610222200_create_aegis_communicator_schema.sql', 'utf-8');
  console.log('Running communicator migration SQL...');
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql: sql });
  if (error) {
    console.error('exec_sql RPC Failed:', error.message);
  } else {
    console.log('exec_sql RPC Succeeded! Result:', data);
  }
}

run();
