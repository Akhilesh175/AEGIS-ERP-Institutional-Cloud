const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  const tables = [
    'hostels',
    'hostel_blocks',
    'hostel_rooms',
    'hostel_beds',
    'hostel_wardens',
    'hostel_admissions',
    'hostel_attendance',
    'hostel_fees',
    'hostel_payments',
    'hostel_leave_requests',
    'hostel_visitors',
    'hostel_complaints',
    'hostel_mess_menu'
  ];

  for (const table of tables) {
    const { data, error } = await supabaseAdmin.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table ${table} query failed: ${error.message}`);
    } else {
      console.log(`Table ${table} query succeeded! Row count: ${data.length}`);
    }
  }
}

main().catch(console.error);
