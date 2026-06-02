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
  console.log("Checking foreign keys of transport_assignments...");
  
  // Fetch a valid school id
  const { data: schools } = await supabaseAdmin.from('schools').select('id').limit(1);
  if (!schools || schools.length === 0) {
    console.error("No schools found!");
    return;
  }
  const schoolId = schools[0].id;
  console.log("School ID:", schoolId);

  // Fetch a valid bus
  const { data: buses } = await supabaseAdmin.from('buses').select('id').limit(1);
  const busId = buses && buses.length > 0 ? buses[0].id : '00000000-0000-0000-0000-000000000000';

  // Fetch a valid route
  const { data: routes } = await supabaseAdmin.from('routes').select('id').limit(1);
  const routeId = routes && routes.length > 0 ? routes[0].id : '00000000-0000-0000-0000-000000000000';

  const { error } = await supabaseAdmin.from('transport_assignments').insert({
    school_id: schoolId,
    student_id: '00000000-0000-0000-0000-000000000000', // invalid student/user uuid
    bus_id: busId,
    route_id: routeId
  });
  
  console.log("Insert Error:", error);
}

run();
