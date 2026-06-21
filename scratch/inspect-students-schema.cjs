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
  
  console.log("\n--- students Definition ---");
  const studentsDef = schema.definitions['students'];
  if (studentsDef) {
    console.log("Columns:", Object.keys(studentsDef.properties));
  } else {
    console.log("students definition not found in schema!");
  }
}

run().catch(console.error);
