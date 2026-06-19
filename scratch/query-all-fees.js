import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, ...parts] = line.split('=');
    envVars[key.trim()] = parts.join('=').trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const { data: structures, error: err1 } = await supabaseAdmin.from('fee_structures').select('*');
  console.log("=== All Fee Structures ===");
  if (err1) console.error(err1);
  else console.log(structures);

  const { data: payments, error: err2 } = await supabaseAdmin.from('fee_payments').select('*');
  console.log("=== All Fee Payments ===");
  if (err2) console.error(err2);
  else console.log(payments);
}

run();
