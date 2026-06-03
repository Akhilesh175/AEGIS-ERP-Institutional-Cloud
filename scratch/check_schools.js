import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

console.log('URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? 'PRESENT' : 'MISSING');

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function check() {
  const { data: schools, error } = await supabaseAdmin.from('schools').select('*');
  if (error) {
    console.error('Error fetching schools:', error);
  } else {
    console.log('Schools in database:', schools);
  }
}

check();
