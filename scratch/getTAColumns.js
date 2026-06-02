import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log("Fetching valid UUIDs for a test insert...");

  // Fetch school
  const { data: schools } = await supabase.from('schools').select('id').limit(1);
  if (!schools || schools.length === 0) {
    console.error("No schools found in database!");
    return;
  }
  const schoolId = schools[0].id;
  console.log("Valid School ID:", schoolId);

  // Fetch student/user
  const { data: users } = await supabase.from('users').select('id').limit(1);
  if (!users || users.length === 0) {
    console.error("No users found in database!");
    return;
  }
  const userId = users[0].id;
  console.log("Valid User ID:", userId);

  // Let's create a test bus first
  const { data: busData, error: busErr } = await supabase.from('buses').insert({
    school_id: schoolId,
    plate_number: 'MH-12-TA-TEST',
    driver_name: 'Test Driver',
    driver_phone: '1234567890',
    capacity: 30
  }).select('id').single();

  if (busErr) {
    console.error("Failed to create test bus:", busErr.message);
    return;
  }
  const busId = busData.id;
  console.log("Created Test Bus ID:", busId);

  // Create a test route
  const { data: routeData, error: routeErr } = await supabase.from('routes').insert({
    school_id: schoolId,
    name: 'Test Route for TA',
    fare: 100.0
  }).select('id').single();

  if (routeErr) {
    console.error("Failed to create test route:", routeErr.message);
    // Cleanup bus
    await supabase.from('buses').delete().eq('id', busId);
    return;
  }
  const routeId = routeData.id;
  console.log("Created Test Route ID:", routeId);

  // Now, try inserting into transport_assignments with various columns
  console.log("\nAttempting transport_assignments insert...");
  const payload = {
    school_id: schoolId,
    student_id: userId,
    bus_id: busId,
    route_id: routeId,
    pickup_point_id: null, // let's see if this fails or is ignored
    status: 'ACTIVE'
  };

  const { data: taInsert, error: taErr } = await supabase.from('transport_assignments').insert(payload).select('*');
  if (taErr) {
    console.log("Insert with pickup_point_id and status failed:", taErr.message);
    
    // Try without them
    console.log("\nTrying insert WITHOUT pickup_point_id and status:");
    const cleanPayload = {
      school_id: schoolId,
      student_id: userId,
      bus_id: busId,
      route_id: routeId
    };
    const { data: taInsertClean, error: taErrClean } = await supabase.from('transport_assignments').insert(cleanPayload).select('*');
    if (taErrClean) {
      console.error("Insert failed completely:", taErrClean.message);
    } else {
      console.log("Success WITHOUT pickup_point_id!");
      console.log("Fields in transport_assignments:", Object.keys(taInsertClean[0]));
    }
  } else {
    console.log("Success WITH pickup_point_id!");
    console.log("Fields in transport_assignments:", Object.keys(taInsert[0]));
  }

  // Cleanup
  console.log("\nCleaning up test records...");
  await supabase.from('transport_assignments').delete().eq('student_id', userId);
  await supabase.from('routes').delete().eq('id', routeId);
  await supabase.from('buses').delete().eq('id', busId);
}

run();
