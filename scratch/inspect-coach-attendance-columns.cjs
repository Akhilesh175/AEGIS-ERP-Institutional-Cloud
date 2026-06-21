const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

async function run() {
  const url = `${supabaseUrl}/rest/v1/`;
  console.log("Fetching OpenAPI schema...");
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`
    }
  });
  const schema = await response.json();
  
  console.log("\n--- sports_coach_attendance Definition ---");
  const attendanceDef = schema.definitions['sports_coach_attendance'];
  if (attendanceDef) {
    console.log("Columns:", Object.keys(attendanceDef.properties));
  } else {
    console.log("sports_coach_attendance definition not found in schema!");
  }

  console.log("\n--- users Definition ---");
  const usersDef = schema.definitions['users'];
  if (usersDef) {
    console.log("role property description:", usersDef.properties.role);
  } else {
    console.log("users definition not found in schema!");
  }
}

run().catch(console.error);
