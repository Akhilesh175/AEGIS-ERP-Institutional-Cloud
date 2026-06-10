import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

async function listAllTables() {
  const url = `${supabaseUrl}/rest/v1/`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    const schema = await res.json();
    console.log('Available tables in Supabase:');
    console.log(Object.keys(schema.definitions || {}).sort().join('\n'));
  } catch (err) {
    console.error('Error fetching tables:', err);
  }
}

listAllTables();
