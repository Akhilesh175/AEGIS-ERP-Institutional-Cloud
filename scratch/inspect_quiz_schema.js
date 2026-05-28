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

async function inspect() {
  const tables = ['quizzes', 'quiz_questions', 'quiz_attempts'];
  for (const t of tables) {
    const { data, error } = await supabaseAdmin.from(t).select('*').limit(1);
    if (error) {
      console.error(`Error inspecting "${t}":`, error.message);
    } else {
      console.log(`\nTable "${t}" Columns:`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        // Query pg_attribute or try to insert empty to get error or try selecting columns if we can
        console.log('No rows present. Fetching schema details via query...');
        const { data: cols, error: colError } = await supabaseAdmin.rpc('get_table_columns', { table_name: t });
        if (colError) {
          // Fallback check columns by attempting to select some standard columns or postgres catalog
          const { data: catData } = await supabaseAdmin.rpc('exec_sql', { sql_query: `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${t}'` });
          if (catData) {
            console.log(catData);
          } else {
            console.log(`Could not get columns for empty table. We can select * from ${t}.`);
            // Actually, select * returns columns even if 0 rows, so let's check what is in data:
            console.log('Data returned:', data);
          }
        } else {
          console.log(cols);
        }
      }
    }
  }
}

async function runExec() {
  console.log('--- Column Details ---');
  const tables = ['quizzes', 'quiz_questions', 'quiz_attempts'];
  for (const t of tables) {
    // Try to run a quick select * and output the result's object or metadata if we can
    // Or just run raw query if exec_sql is available
    const { data: cols } = await supabaseAdmin.from(t).select('*');
    console.log(`Table "${t}" rows count: ${cols?.length || 0}`);
    if (cols && cols.length > 0) {
      console.log(`Columns of "${t}":`, Object.keys(cols[0]));
    } else {
      console.log(`Table "${t}" is empty.`);
    }
  }
}

runExec();
