/**
 * Trigger Supabase PostgREST schema cache reload
 * This forces PostgREST to pick up newly created/modified functions
 */
const https = require('https');
const fs = require('fs');
const env = {};
fs.readFileSync('.env','utf-8').split('\n').forEach(l => { const p = l.split('='); if(p.length>=2) env[p[0].trim()] = p.slice(1).join('=').trim(); });

const supabaseUrl = env['VITE_SUPABASE_URL'];
const serviceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const projectRef = 'frsdcpqkxoxpbinazmgz';

function httpRequest(hostname, path, method, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = body ? JSON.stringify(body) : '';
    const opts = {
      hostname, port: 443, path, method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...headers
      }
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', e => resolve({ status: 0, body: e.message }));
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log('Triggering PostgREST schema cache reload via Supabase Management API...');
  
  // Method 1: POST to /rest/v1/schema - forces reload
  const r1 = await httpRequest(
    `${projectRef}.supabase.co`,
    '/rest/v1/rpc/pgrst_reload_schema',
    'POST',
    {},
    { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}` }
  );
  console.log('Method 1 (pgrst_reload_schema):', r1.status, r1.body.substring(0, 200));

  // Method 2: NOTIFY pgrst, 'reload schema' via the schema endpoint
  const r2 = await httpRequest(
    `${projectRef}.supabase.co`,
    '/rest/v1/',
    'GET',
    null,
    { 'apikey': serviceKey, 'Authorization': `Bearer ${serviceKey}`, 'Accept-Profile': 'public' }
  );
  console.log('Method 2 (GET /rest/v1/ for cache invalidation):', r2.status);

  // Method 3: Use Supabase Management API to reload schema
  const r3 = await httpRequest(
    'api.supabase.com',
    `/v1/projects/${projectRef}/api`,
    'GET',
    null,
    { 'Authorization': `Bearer ${serviceKey}` }
  );
  console.log('Method 3 (Management API):', r3.status, r3.body.substring(0, 100));
  
  // The most reliable way: NOTIFY via PostgREST's pgrst.reload_schema channel
  // This is done by sending a NOTIFY command to the Supabase database
  // Unfortunately without a direct DB connection, we can't do this.
  
  console.log('\nNOTE: PostgREST schema cache refresh may require:');
  console.log('1. Wait a few minutes (auto-refresh happens every ~30 seconds)');
  console.log('2. OR: Send a NOTIFY pgrst, "reload schema" to the database');
  console.log('3. OR: Restart PostgREST via Supabase Dashboard -> Settings -> API');
  console.log('\nURL: https://supabase.com/dashboard/project/frsdcpqkxoxpbinazmgz/settings/api');
}

run().catch(console.error);
