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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const MEETING_ID = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
const PARENT_USER_ID = 'd6c61203-2878-4f85-8252-d319bd6224ee';

async function run() {
  console.log(`Approving parent ${PARENT_USER_ID} for meeting ${MEETING_ID}...`);
  const { data, error } = await supabaseAdmin
    .from('meeting_waiting_room')
    .update({ status: 'APPROVED', approved_at: new Date().toISOString() })
    .eq('meeting_id', MEETING_ID)
    .eq('participant_id', PARENT_USER_ID)
    .select();

  if (error) {
    console.error("Failed to approve parent:", error);
  } else {
    console.log("Parent approved successfully! DB Response:", data);
  }
}

run().catch(console.error);
