const { createClient } = require('@supabase/supabase-js');
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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data: logsData, error: logsError } = await supabase.from('ptm_screenshare_logs').select('*').limit(1);
  console.log('ptm_screenshare_logs query:', { logsData, logsError });

  const { data: msgData, error: msgError } = await supabase.from('ptm_messages').select('message_type').limit(1);
  console.log('ptm_messages message_type query:', { msgData, msgError });
}

run().catch(console.error);
