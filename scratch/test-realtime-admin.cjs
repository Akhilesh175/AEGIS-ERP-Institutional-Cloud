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

async function run() {
  const meetingId = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
  const schoolId = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
  
  const channelName = `admin-chat-changes-${meetingId}`;
  console.log(`Subscribing to realtime channel as ADMIN: ${channelName}...`);
  
  const sub = supabaseAdmin
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'ptm_messages',
        filter: `meeting_id=eq.${meetingId}`
      },
      (payload) => {
        console.log("!!! ADMIN REALTIME EVENT RECEIVED !!!");
        console.log(payload.new);
      }
    )
    .subscribe((status, err) => {
      console.log(`Subscription status update: ${status}`);
      if (err) {
        console.error("Subscription error:", err);
      }
      
      if (status === 'SUBSCRIBED') {
        console.log("Triggering message insert via Admin client...");
        supabaseAdmin
          .from('ptm_messages')
          .insert({
            school_id: schoolId,
            meeting_id: meetingId,
            sender_id: '38f8269e-fb13-4ca1-aada-a5c59e83417e', // Vishal teacher user_id
            sender_role: 'TEACHER',
            message: 'Admin Realtime test message at ' + new Date().toISOString()
          })
          .then(({ data, error }) => {
            if (error) console.error("Admin insert failed:", error);
            else console.log("Admin insert successful.");
          });
      }
    });

  setTimeout(() => {
    console.log("Test finished.");
    sub.unsubscribe();
    process.exit(0);
  }, 10000);
}

run().catch(console.error);
