const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

async function run() {
  const url = `${supabaseUrl}/rest/v1/`;
  console.log("Fetching PostgREST OpenAPI schema using Service Role Key...");
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const schema = await response.json();
  
  const paths = Object.keys(schema.paths || {});
  const rpcs = paths.filter(p => p.startsWith('/rpc/'));
  console.log("Registered RPCs count:", rpcs.length);
  
  const matched = rpcs.filter(r => r.includes('sql') || r.includes('exec') || r.includes('query'));
  console.log("Matched RPCs:", matched);

  // Print all RPC names
  console.log("All RPCs:", rpcs);
}

run().catch(console.error);
