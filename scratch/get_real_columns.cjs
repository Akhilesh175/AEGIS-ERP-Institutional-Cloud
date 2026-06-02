const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseAdmin = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const tables = ['buses', 'routes', 'pickup_points', 'transport_assignments', 'driver_attendance', 'exams', 'report_cards'];
  
  for (const table of tables) {
    console.log(`\n=== Table: ${table} ===`);
    // Let's do a dummy insert with an invalid type or empty to inspect columns
    const { error } = await supabaseAdmin.from(table).insert({ id: '00000000-0000-0000-0000-000000000000' });
    if (error) {
      console.log(`Insert result: ${error.message}`);
    } else {
      console.log("Inserted test row successfully.");
      // Delete the test row
      await supabaseAdmin.from(table).delete().eq('id', '00000000-0000-0000-0000-000000000000');
    }
  }
}

run();
