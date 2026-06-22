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
const serviceRoleKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

async function inspectSchema() {
  const url = `${supabaseUrl}/rest/v1/`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    const schema = await res.json();
    console.log('--- DEFINITIONS KEY ---');
    const tableKeys = Object.keys(schema.definitions || {});
    console.log('Available definitions:', tableKeys.filter(t => t.includes('ptm')));
    
    if (schema.definitions && schema.definitions.ptm_messages) {
      console.log('ptm_messages properties:', Object.keys(schema.definitions.ptm_messages.properties));
    } else {
      console.log('ptm_messages definition not found in OpenAPI schema');
    }

    if (schema.definitions && schema.definitions.ptm_chat_messages) {
      console.log('ptm_chat_messages properties:', Object.keys(schema.definitions.ptm_chat_messages.properties));
    }

    if (schema.definitions && schema.definitions.ptm_chat_attachments) {
      console.log('ptm_chat_attachments properties:', Object.keys(schema.definitions.ptm_chat_attachments.properties));
    }
  } catch (err) {
    console.error('Error inspecting schema:', err);
  }
}

inspectSchema();
