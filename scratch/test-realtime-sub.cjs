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
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const teacherEmail = 'vishal@gmail.com';
  const parentEmail = 'basantkry1@gmail.com';
  
  // Choose meeting
  const meetingId = 'fa0219ff-3058-4fed-8c99-89378a0f3caa';
  const schoolId = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
  
  console.log(`Logging in public client as ${teacherEmail}...`);
  // Note: Password for users is typically Password123! in this test suite, let's try it
  const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
    email: teacherEmail,
    password: 'Password123!'
  });
  
  if (authErr) {
    console.error("Auth failed:", authErr.message);
    return;
  }
  
  console.log("Logged in successfully! User ID:", authData.user.id);

  // Subscribe to ptm_messages channel
  const channelName = `chat-changes-${meetingId}`;
  console.log(`Subscribing to realtime channel: ${channelName}...`);
  
  const sub = supabaseClient
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
        console.log("!!! REALTIME MESSAGE INSERT EVENT RECEIVED !!!");
        console.log(payload.new);
      }
    )
    .subscribe((status, err) => {
      console.log(`Subscription status update: ${status}`);
      if (err) {
        console.error("Subscription error:", err);
      }
      
      if (status === 'SUBSCRIBED') {
        // Trigger an insert as the teacher using supabaseAdmin
        console.log("Triggering message insert via Admin client...");
        supabaseAdmin
          .from('ptm_messages')
          .insert({
            school_id: schoolId,
            meeting_id: meetingId,
            sender_id: '38f8269e-fb13-4ca1-aada-a5c59e83417e', // Vishal teacher user_id
            sender_role: 'TEACHER',
            message: 'Realtime test message at ' + new Date().toISOString()
          })
          .then(({ data, error }) => {
            if (error) console.error("Admin insert failed:", error);
            else console.log("Admin insert successful.");
          });
      }
    });

  // Keep process running for 10 seconds to wait for event
  setTimeout(() => {
    console.log("Test finished.");
    sub.unsubscribe();
    process.exit(0);
  }, 10000);
}

run().catch(console.error);
