import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read env variables
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspect() {
  const { data: schools, error } = await supabase
    .from('schools')
    .select('id, name, subscription_plan');
  if (error) {
    console.error('Error fetching schools:', error);
  } else {
    console.log('Schools in Database:');
    schools.forEach(s => {
      console.log(`- ID: ${s.id} | Name: ${s.name} | Subscription Plan: ${s.subscription_plan}`);
    });
  }
}

inspect();
