/**
 * Applies the PTM Waiting Room Unique Constraint migration
 * via Supabase Management API (with fallback instructions)
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

// Extract project ref from URL: https://frsdcpqkxoxpbinazmgz.supabase.co
const projectRef = new URL(supabaseUrl).hostname.split('.')[0];

const migrationSql = fs.readFileSync(
  path.resolve(process.cwd(), 'supabase/migrations/20260701_ptm_waiting_room_unique_constraint.sql'),
  'utf-8'
);

function postJson(hostname, reqPath, body, headers) {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname, port: 443, path: reqPath,
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
  console.log('=== PTM Waiting Room Unique Constraint — Migration Runner ===\n');
  console.log('Project ref:', projectRef);
  
  // Try via Supabase Management API
  const r1 = await postJson(
    'api.supabase.com',
    `/v1/projects/${projectRef}/database/query`,
    { query: migrationSql },
    { 'Authorization': `Bearer ${supabaseServiceKey}` }
  );
  console.log('Management API /database/query →', r1.status, r1.body.substring(0, 500));
  
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
  
  if (r2.status === 200 || r2.status === 201) {
    console.log('\n✅ Migration applied via pg/query!');
    return;
  }

  // Check if constraint already exists via supabase-js
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // Try to read pg_constraint info via a direct query approach
  const { data: constraintData, error: constraintError } = await supabaseAdmin
    .from('information_schema.table_constraints')
    .select('constraint_name')
    .eq('table_name', 'meeting_waiting_room')
    .eq('constraint_name', 'meeting_waiting_room_meeting_participant_unique');

  if (!constraintError && constraintData && constraintData.length > 0) {
    console.log('\n✅ Unique constraint already exists on meeting_waiting_room — nothing to do.');
    return;
  }

  console.log('\n====================================================');
  console.log('📌 MANUAL ACTION REQUIRED — Apply via Supabase SQL Editor:');
  console.log('====================================================');
  console.log(`URL: https://supabase.com/dashboard/project/${projectRef}/sql/new`);
  console.log('\nPaste and run this SQL:\n');
  console.log(migrationSql);
  console.log('\nThis adds UNIQUE(meeting_id, participant_id) on meeting_waiting_room,');
  console.log('which is required for the UPSERT in AegisMeet.tsx to work correctly.\n');
}

run().catch(console.error);
