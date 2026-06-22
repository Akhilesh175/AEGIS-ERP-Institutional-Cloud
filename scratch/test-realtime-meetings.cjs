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
  const schoolId = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
  
  console.log(`Logging in public client as ${teacherEmail}...`);
  const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
    email: teacherEmail,
    password: 'Password123!'
  });
  
  if (authErr) {
    console.error("Auth failed:", authErr.message);
    return;
  }
  
  console.log("Logged in successfully! User ID:", authData.user.id);

  console.log("Subscribing to ptm_meetings changes...");
  const sub = supabaseClient
    .channel('ptm-meetings-test')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ptm_meetings',
        filter: `school_id=eq.${schoolId}`
      },
      (payload) => {
        console.log("!!! REALTIME PTM_MEETING EVENT RECEIVED !!!");
        console.log(payload.eventType, payload.new);
      }
    )
    .subscribe((status, err) => {
      console.log(`Subscription status: ${status}`);
      if (err) console.error("Sub error:", err);
      
      if (status === 'SUBSCRIBED') {
        console.log("Triggering meeting update via Admin client...");
        supabaseAdmin
          .from('ptm_meetings')
          .update({ description: 'Updated description at ' + new Date().toISOString() })
          .eq('title', 'INTEGRATION_TEST_PTM')
          .then(({ data, error }) => {
            if (error) console.error("Admin update failed:", error);
            else console.log("Admin update successful.");
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
