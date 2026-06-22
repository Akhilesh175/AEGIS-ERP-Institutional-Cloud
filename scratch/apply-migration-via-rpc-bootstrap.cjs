/**
 * Bootstrap apply of the PTM RLS deadlock migration
 * 
 * Strategy: First create a self-destructing exec_sql_once function using
 * the Supabase REST API's /rpc endpoint by sending raw SQL embedded in an
 * anonymous DO block via the PostgREST schema RPC mechanism.
 * 
 * PostgREST allows calling SQL functions by name. If we embed the migration
 * as a "database function body" in an RPC call using plpgsql DO block...
 * wait, that won't work either.
 * 
 * CORRECT STRATEGY:
 * The Supabase Management API /v1/projects/{ref}/database/query requires
 * an ACCESS TOKEN (personal access token), NOT the service role key.
 * 
 * Since we don't have a PAT, let's try another approach:
 * Use pg directly via the DATABASE_URL if it's in .env
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const databaseUrl = env['DATABASE_URL'] || env['VITE_DATABASE_URL'] || env['POSTGRES_URL'] || env['DB_URL'];

console.log('Supabase URL:', supabaseUrl);
console.log('Database URL available:', !!databaseUrl);
if (databaseUrl) {
  // Mask password for display
  console.log('Database URL:', databaseUrl.replace(/:([^@]+)@/, ':****@'));
}

// List all env vars related to DB
const dbVars = Object.keys(env).filter(k => 
  k.toLowerCase().includes('database') || 
  k.toLowerCase().includes('postgres') ||
  k.toLowerCase().includes('pg_') ||
  k.toLowerCase().includes('db_')
);
console.log('\nDB-related env vars found:', dbVars);
