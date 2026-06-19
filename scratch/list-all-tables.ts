import './mock-localStorage';
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

async function run() {
  const { data, error } = await supabaseAdmin.rpc('get_tables');
  if (error) {
    // Fallback: Query pg_catalog
    const { data: tablesData, error: pgError } = await supabaseAdmin.from('pg_tables' as any).select('tablename').eq('schemaname', 'public');
    if (pgError) {
      // Direct query using schema inspection or simple SELECT on pg_class
      const { data: rawData, error: rawError } = await supabaseAdmin.rpc('execute_sql', {
        sql_query: "SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"
      });
      if (rawError) {
        console.error("Failed to fetch tables:", rawError);
      } else {
        console.log("Tables list:", rawData);
      }
    } else {
      console.log("Tables list (pg_tables):", tablesData);
    }
  } else {
    console.log("Tables list (get_tables RPC):", data);
  }
}

run().catch(console.error);
