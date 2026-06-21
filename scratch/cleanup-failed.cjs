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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function run() {
  console.log("Cleaning up failed verification run records...");
  const tempCoachUserId = '782c5fa6-2227-4803-ac06-63a945fca8d9';

  // Find coach id
  const { data: coaches } = await supabaseAdmin
    .from('sports_coaches')
    .select('id')
    .eq('user_id', tempCoachUserId);
  
  if (coaches && coaches.length > 0) {
    const coachId = coaches[0].id;
    console.log("Found Coach ID:", coachId);

    // Delete training sessions
    await supabaseAdmin.from('sports_training_sessions').delete().eq('coach_id', coachId);
    // Delete teams
    await supabaseAdmin.from('sports_teams').delete().eq('coach_id', coachId);
    // Delete sports_coaches
    await supabaseAdmin.from('sports_coaches').delete().eq('id', coachId);
  }

  // Delete from users public table
  await supabaseAdmin.from('users').delete().eq('id', tempCoachUserId);
  
  // Delete from auth
  await supabaseAdmin.auth.admin.deleteUser(tempCoachUserId);

  // Also clean up any enrollment for student 7b55f77a-0558-4355-96c8-6d22a1ad82ef with sport 5f8eafc7-f498-481c-b58e-5b8d49daf17b
  const studentId = '7b55f77a-0558-4355-96c8-6d22a1ad82ef';
  const sportId = '5f8eafc7-f498-481c-b58e-5b8d49daf17b';
  
  // Clean up achievements and certificates that might have been created
  // Note: certificate creation failed, but let's make sure
  await supabaseAdmin.from('sports_certificates').delete().eq('student_id', studentId).eq('sport_id', sportId);
  await supabaseAdmin.from('sports_achievements').delete().eq('student_id', studentId).eq('sport_id', sportId);
  await supabaseAdmin.from('sports_enrollments').delete().eq('student_id', studentId).eq('sport_id', sportId);

  console.log("Cleanup done.");
}

run().catch(console.error);
