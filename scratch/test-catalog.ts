import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env manually
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

async function run() {
  const { data, error } = await supabaseAdmin
    .from('pg_catalog.pg_constraint')
    .select('*');
  console.log('pg_constraint result:', { data: data?.slice(0, 2), error });

  const { data: data2, error: error2 } = await supabaseAdmin
    .from('information_schema.table_constraints')
    .select('*');
  console.log('table_constraints result:', { data: data2?.slice(0, 2), error: error2 });
}

run().catch(console.error);
