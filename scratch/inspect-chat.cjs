const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('--- Inspecting chat_messages ---');
  const { data, error } = await supabase.from('chat_messages').select('*').limit(1);
  if (error) {
    console.error('Error querying chat_messages:', error);
    
    console.log('Creating chat_messages table...');
    // If it doesn't exist, we can output SQL or create it if missing!
  } else {
    console.log('chat_messages table exists! Row count:', data.length);
    if (data.length > 0) {
      console.log('Columns found:', Object.keys(data[0]));
    }
  }
}

main().catch(console.error);
