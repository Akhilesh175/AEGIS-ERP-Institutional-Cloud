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
  console.log('--- SCHOOLS ---');
  const { data: schools } = await supabaseAdmin.from('schools').select('*');
  console.log(JSON.stringify(schools, null, 2));

  console.log('--- ACTIVE TEACHERS SIGNATURES ---');
  const { data: teachers } = await supabaseAdmin.from('teachers').select('id, signature_url');
  console.log(JSON.stringify(teachers, null, 2));

  console.log('--- ACTIVE SCHOOL ADMINS SIGNATURES ---');
  const { data: admins } = await supabaseAdmin.from('school_admins').select('id, signature_url, status');
  console.log(JSON.stringify(admins, null, 2));
}

run().catch(console.error);
