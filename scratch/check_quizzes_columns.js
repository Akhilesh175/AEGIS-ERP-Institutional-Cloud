import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseAdmin = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'],
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

async function run() {
  const tables = ['quizzes', 'quiz_questions', 'quiz_attempts'];
  for (const t of tables) {
    const { data: cols, error } = await supabaseAdmin.from(t).select('*').limit(1);
    console.log(`\n=== Table: ${t} ===`);
    if (error) {
      console.log('Error selecting from table:', error.message);
    }
    
    // Query exact column details via information_schema
    const { data, error: queryError } = await supabaseAdmin.rpc('exec_sql', {
      sql_query: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = '${t}'`
    });
    
    if (queryError) {
      // Fallback query if exec_sql isn't an RPC
      const { data: fallbackData, error: fallbackError } = await supabaseAdmin
        .from('pg_catalog.pg_tables')
        .select('*')
        .eq('tablename', t);
      console.log('Fallback tables metadata:', fallbackError?.message || fallbackData);
    } else {
      console.log(data);
    }
  }
}

run().catch(console.error);
