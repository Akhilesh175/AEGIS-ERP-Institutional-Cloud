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

async function listFunctions() {
  const url = `${supabaseUrl}/rest/v1/`;
  console.log('Fetching OpenAPI schema to find RPCs...');
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    const schema = await res.json();
    console.log('RPC functions found:');
    const rpcs = Object.keys(schema.paths || {})
      .filter(p => p.startsWith('/rpc/'))
      .map(p => p.slice(5));
    console.log(rpcs.sort().join('\n'));
  } catch (err) {
    console.error('Failed to list RPCs:', err);
  }
}

listFunctions();
