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

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing supabase env details!");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("Querying sports_enrollments...");
  const { data, error } = await supabaseAdmin
    .from('sports_enrollments')
    .select('*, students(*, users(first_name, last_name)), sports(name)')
    .limit(5);

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("Query Data:", JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
