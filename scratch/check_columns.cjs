const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log("Checking columns of tables via RPC or simple select...");
  
  // Let's run a query on information_schema.columns
  const { data, error } = await supabaseAdmin.rpc('get_table_columns_info'); // Wait, if this RPC doesn't exist, we can query it using a custom query, but we don't have direct SQL execution unless we use supabaseAdmin or another way.
  // Wait, we don't have SQL execution RPC unless we create one. But we can query it using standard REST if allowed, or we can just try to insert a record and see the error message!
  // Yes! If we try to insert a record with ALL columns, we can see if it throws a column-not-found error.
  
  // Let's try to insert a test route
  console.log("Testing routes insert...");
  const routeRes = await supabaseAdmin.from('routes').insert({
    school_id: 'school-1',
    name: 'Test Route::R-999',
    route_code: 'R-999',
    start_point: 'Start',
    end_point: 'End',
    fare: 10
  }).select();
  console.log("Route Insert Res:", routeRes.error, routeRes.data);

  // Let's try to insert a test bus
  console.log("Testing buses insert...");
  const busRes = await supabaseAdmin.from('buses').insert({
    school_id: 'school-1',
    number_plate: 'TEST-123',
    plate_number: 'TEST-123',
    capacity: 20,
    status: 'ACTIVE',
    driver_id: null
  }).select();
  console.log("Bus Insert Res:", busRes.error, busRes.data);

  // Let's try to insert a test pickup stop
  console.log("Testing pickup_points insert...");
  const ppRes = await supabaseAdmin.from('pickup_points').insert({
    school_id: 'school-1',
    name: 'Test PP',
    latitude: 0,
    longitude: 0,
    route_id: 'd3b07384-d113-4ec5-a587-ee3e072c1f15' // random uuid
  }).select();
  console.log("Pickup Point Insert Res:", ppRes.error, ppRes.data);
}

run().catch(console.error);
