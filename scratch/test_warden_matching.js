const fs = require('fs');
const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});
const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

async function testMatching() {
  const headers = {
    'apikey': serviceRoleKey,
    'Authorization': 'Bearer ' + serviceRoleKey
  };

  const [adRes, rmRes, blRes, wRes] = await Promise.all([
    fetch(supabaseUrl + '/rest/v1/hostel_admissions?status=eq.ACTIVE', { headers }).then(r => r.json()),
    fetch(supabaseUrl + '/rest/v1/hostel_rooms', { headers }).then(r => r.json()),
    fetch(supabaseUrl + '/rest/v1/hostel_blocks', { headers }).then(r => r.json()),
    fetch(supabaseUrl + '/rest/v1/hostel_wardens?select=*,userDetails:users!hostel_wardens_user_id_fkey(*)', { headers }).then(r => r.json())
  ]);

  console.log('\n=== Hostel Admissions ===');
  console.log(adRes);

  console.log('\n=== Hostel Rooms ===');
  console.log(rmRes);

  console.log('\n=== Hostel Blocks ===');
  console.log(blRes);

  console.log('\n=== Hostel Wardens ===');
  console.log(wRes);

  console.log('\n=== Simulating Matching ===');
  for (const ad of adRes) {
    const rm = rmRes.find(r => r.id === ad.room_id);
    const bl = blRes.find(b => b.id === rm?.block_id);
    console.log(`Student ID: ${ad.student_id}, Room: ${rm?.room_number}, Block: ${bl?.name}, Building/Hostel: ${ad.hostel_id}`);
    
    const matchedWardens = [];
    for (const w of wRes) {
      let matched = false;
      if (w.hostel_id === ad.hostel_id) {
        console.log(`  -> Match: Warden ${w.userDetails?.first_name} assigned directly to hostel ${w.hostel_id}`);
        matched = true;
      }
      if (w.assigned_locations && Array.isArray(w.assigned_locations)) {
        console.log(`  -> Checking assigned locations for Warden ${w.userDetails?.first_name}:`, w.assigned_locations);
        for (const loc of w.assigned_locations) {
          const matchesBuilding = loc.buildingId === ad.hostel_id;
          const matchesBlock = !loc.blockId || loc.blockId === rm?.block_id;
          const matchesFloor = loc.floor === null || loc.floor === rm?.floor;
          const matchesSection = !loc.section || loc.section === rm?.room_number;
          console.log(`     Loc: Bldg Match: ${matchesBuilding}, Block Match: ${matchesBlock}, Floor Match: ${matchesFloor}, Section Match: ${matchesSection}`);
          if (matchesBuilding && matchesBlock && matchesFloor && matchesSection) {
            console.log(`     -> Match found: location assignment matched student room allocation!`);
            matched = true;
            break;
          }
        }
      }
      if (matched) matchedWardens.push(w);
    }
    console.log(`Matched wardens count: ${matchedWardens.length}`);
  }
}

testMatching().catch(console.error);
