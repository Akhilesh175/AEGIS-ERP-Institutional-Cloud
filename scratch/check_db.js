const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '../.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  console.error("Missing VITE_SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  console.log("Checking Supabase connection and tables...");
  
  // Check buses
  const busesRes = await supabaseAdmin.from('buses').select('*');
  console.log("Buses query error:", busesRes.error);
  console.log("Buses count:", busesRes.data ? busesRes.data.length : 'N/A');
  if (busesRes.data && busesRes.data.length > 0) {
    console.log("Buses sample:", busesRes.data[0]);
  }

  // Check routes
  const routesRes = await supabaseAdmin.from('routes').select('*');
  console.log("Routes query error:", routesRes.error);
  console.log("Routes count:", routesRes.data ? routesRes.data.length : 'N/A');
  if (routesRes.data && routesRes.data.length > 0) {
    console.log("Routes sample:", routesRes.data[0]);
  }

  // Check pickup_points
  const ppRes = await supabaseAdmin.from('pickup_points').select('*');
  console.log("Pickup Points query error:", ppRes.error);
  console.log("Pickup Points count:", ppRes.data ? ppRes.data.length : 'N/A');
  if (ppRes.data && ppRes.data.length > 0) {
    console.log("Pickup Points sample:", ppRes.data[0]);
  }

  // Check transport_assignments
  const taRes = await supabaseAdmin.from('transport_assignments').select('*');
  console.log("Transport Assignments query error:", taRes.error);
  console.log("Transport Assignments count:", taRes.data ? taRes.data.length : 'N/A');
  if (taRes.data && taRes.data.length > 0) {
    console.log("Transport Assignments sample:", taRes.data[0]);
  }
  
  // Check driver_attendance
  const daRes = await supabaseAdmin.from('driver_attendance').select('*');
  console.log("Driver Attendance query error:", daRes.error);
  console.log("Driver Attendance count:", daRes.data ? daRes.data.length : 'N/A');
}

run().catch(console.error);
