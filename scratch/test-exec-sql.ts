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
  const query = `
    SELECT 
      conname AS constraint_name,
      conrelid::regclass AS table_name,
      confrelid::regclass AS referenced_table_name,
      pg_get_constraintdef(c.oid) AS constraint_definition
    FROM 
      pg_constraint c
    JOIN 
      pg_namespace n ON n.oid = c.connamespace
    WHERE 
      n.nspname = 'public' 
      AND c.contype = 'f'
      AND (conrelid::regclass::text = 'timetables' OR conrelid::regclass::text = 'teachers');
  `;

  const { data, error } = await supabaseAdmin.rpc('exec_sql', {
    sql_query: query
  });

  if (error) {
    console.error('exec_sql error:', error);
  } else {
    console.log('Foreign keys on timetables & teachers:', JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
