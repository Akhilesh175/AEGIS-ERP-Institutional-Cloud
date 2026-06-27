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
  const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseServiceKey}`);
  const schema = await response.json();
  if (schema && schema.definitions) {
    const keys = Object.keys(schema.definitions);
    console.log("All tables in Supabase REST API schema:", keys.filter(k => k.includes('sub') || k.includes('history') || k.includes('plan') || k.includes('invoice')));
  } else {
    console.log('Could not load definitions');
  }
}
run().catch(console.error);
