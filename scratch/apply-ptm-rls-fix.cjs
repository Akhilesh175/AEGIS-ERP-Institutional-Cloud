/**
 * Applies the PTM RLS deadlock fix via Supabase Management API
 */
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const https = require('https');

global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} };

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const projectRef = 'frsdcpqkxoxpbinazmgz';

const migrationSql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260629_fix_ptm_participant_rls_deadlock.sql'),
  'utf-8'
);

// Try Supabase Management API v1
function postJson(hostname, path, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname, port: 443, path,
      method: 'POST',
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
    req.write(bodyStr);
    req.end();
  });
}

async function run() {
  console.log('=== PTM RLS Deadlock Fix — Migration Runner ===\n');
  
  // Try via project-level SQL API
  const r1 = await postJson(
    'api.supabase.com',
    `/v1/projects/${projectRef}/database/query`,
    { query: migrationSql },
    { 'Authorization': `Bearer ${supabaseServiceKey}` }
  );
  console.log('Management API /database/query →', r1.status, r1.body.substring(0, 300));
  
  if (r1.status === 200 || r1.status === 201) {
    console.log('\n✅ Migration applied successfully via Management API!');
    return;
  }
  
  // Try supabase's pg endpoint
  const r2 = await postJson(
    new URL(supabaseUrl).hostname,
    '/pg/query',
    { query: migrationSql },
    { 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
  );
  console.log('pg/query →', r2.status, r2.body.substring(0, 300));
  
  // Since neither endpoint is available directly, use the supabase client rpc with a custom function
  // First create the exec function using a simpler approach
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Try calling existing RPC function
  const { data, error } = await supabaseAdmin.rpc('exec_sql_admin', { sql_query: 'SELECT 1' });
  console.log('\nRPC exec_sql_admin test →', error ? `ERROR: ${error.message}` : 'Available!', data);

  console.log('\n====================================================');
  console.log('📌 MANUAL ACTION REQUIRED — Apply via Supabase Dashboard:');
  console.log('====================================================');
  console.log('URL: https://supabase.com/dashboard/project/frsdcpqkxoxpbinazmgz/sql/new');
  console.log('\nThe migration file is ready at:');
  console.log(path.resolve(process.cwd(), 'supabase/migrations/20260629_fix_ptm_participant_rls_deadlock.sql'));
  console.log('\nKey fixes in this migration:');
  console.log('1. ✅ Breaks circular RLS deadlock on ptm_participants table');
  console.log('2. ✅ Allows parent/teacher/student self-registration as meeting participant');
  console.log('3. ✅ Fixes ptm_messages INSERT policy to not require pre-existing participant row');
  console.log('4. ✅ Fixes ptm_chat_attachments INSERT policy for file uploads');
  console.log('5. ✅ Updates validateMeetingParticipant() with direct meeting membership fallback');
  console.log('6. ✅ Fixes storage bucket INSERT policy for ptm-chat-files');
  console.log('7. ✅ Adds performance indexes for fast participant lookups\n');
}

run().catch(console.error);
