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
  const sql = `
    SELECT
        tc.constraint_name, 
        tc.table_name, 
        kcu.column_name, 
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name 
    FROM 
        information_schema.table_constraints AS tc 
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 'payment_audit_logs';
  `;
  console.log("Querying foreign keys...");
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  // Note: exec_sql RPC might expect parameter name as "sql" or "sql_query"
  let res: any;
  if (error) {
    // Try with parameter name "sql"
    const { data: data2, error: error2 } = await supabaseAdmin.rpc('exec_sql', { sql });
    if (error2) {
      console.error("Failed to execute SQL:", error2.message);
      return;
    }
    res = data2;
  } else {
    res = data;
  }
  console.log("Foreign Key Info:");
  console.log(JSON.stringify(res, null, 2));
}

run().catch(console.error);
