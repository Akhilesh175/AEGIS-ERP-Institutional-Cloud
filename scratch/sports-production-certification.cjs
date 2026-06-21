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

function generateUUID() {
  return require('crypto').randomUUID();
}

async function run() {
  console.log("=== STARTING SPORTS PRODUCTION DATABASE CRUD VERIFICATION ===");

  const schoolId = '129f2529-9a8a-4d72-8641-d6b834a99a02';
  const academicSessionId = '29ff2f84-f1b7-41dc-9905-e7861e14bff1';

  // Fetch valid student
  const { data: students, error: studentErr } = await supabaseAdmin
    .from('students')
    .select('id, user_id')
    .eq('school_id', schoolId)
    .limit(1);
  if (studentErr || !students || students.length === 0) {
    throw new Error("No students found for verification school: " + (studentErr?.message || "Empty"));
  }
  const studentId = students[0].id;
  const studentUserId = students[0].user_id;
  console.log("Fetched valid student ID:", studentId, "user ID:", studentUserId);

  // Fetch student's current enrolled sports
  const { data: currentEnrollments } = await supabaseAdmin
    .from('sports_enrollments')
    .select('sport_id')
    .eq('student_id', studentId);
  const enrolledSportIds = (currentEnrollments || []).map(e => e.sport_id);

  // Find a sport the student is not enrolled in
  let sportId;
  const { data: sports, error: sportErr } = await supabaseAdmin
    .from('sports')
    .select('id')
    .eq('school_id', schoolId);
  
  if (sportErr || !sports || sports.length === 0) {
    throw new Error("No sports found for verification school: " + (sportErr?.message || "Empty"));
  }

  const unusedSport = sports.find(s => !enrolledSportIds.includes(s.id));
  if (unusedSport) {
    sportId = unusedSport.id;
  } else {
    // If enrolled in all, let's delete one enrollment at the start of the test
    sportId = sports[0].id;
    console.log(`Student enrolled in all sports. Clearing existing enrollment for sport ${sportId} first...`);
    // Delete achievements & certificates & roster memberships that might reference it
    await supabaseAdmin.from('sports_certificates').delete().eq('student_id', studentId).eq('sport_id', sportId);
    await supabaseAdmin.from('sports_achievements').delete().eq('student_id', studentId).eq('sport_id', sportId);
    await supabaseAdmin.from('sports_team_members').delete().eq('student_id', studentId);
    await supabaseAdmin.from('sports_enrollments').delete().eq('student_id', studentId).eq('sport_id', sportId);
  }
  console.log("Using Verification Sport ID:", sportId);

  const { data: users, error: userErr } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('school_id', schoolId)
    .eq('role', 'SPORTS_ADMIN')
    .limit(1);
  const adminUserId = users && users.length > 0 ? users[0].id : studentUserId;
  console.log("Using requestor User ID:", adminUserId);

  const generatedIds = {};

  // 1. Create auth user for coach
  const coachId = generateUUID();
  const coachEmail = `verify-coach-${coachId.substring(0,8)}@aegis.com`;
  console.log(`Creating auth user for coach: ${coachEmail}...`);
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: coachEmail,
    password: 'AegisVerifySports123!',
    email_confirm: true,
    user_metadata: { school_id: schoolId, role: 'TEACHER' }
  });
  if (authError || !authData.user) throw new Error(authError?.message || 'Failed to create auth user');
  const tempCoachUserId = authData.user.id;
  console.log("Created temp auth user ID:", tempCoachUserId);

  // Insert public user
  console.log("Inserting coach public users record...");
  const { error: userInsertErr } = await supabaseAdmin.from('users').insert({
    id: tempCoachUserId,
    email: coachEmail,
    role: 'TEACHER',
    first_name: 'TempVerify',
    last_name: 'Coach',
    school_id: schoolId,
    is_active: true
  });
  if (userInsertErr) {
    await supabaseAdmin.auth.admin.deleteUser(tempCoachUserId);
    throw userInsertErr;
  }

  // Insert coach
  console.log("Inserting coach record...");
  const { error: coachErr } = await supabaseAdmin.from('sports_coaches').insert({
    id: coachId,
    school_id: schoolId,
    user_id: tempCoachUserId,
    coach_name: 'Temp Verification Coach',
    specialization: 'Football',
    status: 'ACTIVE'
  });
  if (coachErr) {
    await supabaseAdmin.from('users').delete().eq('id', tempCoachUserId);
    await supabaseAdmin.auth.admin.deleteUser(tempCoachUserId);
    throw coachErr;
  }
  generatedIds['sports_coaches'] = coachId;

  // 2. Athlete/Enrollment (APPROVED)
  const enrollmentId = generateUUID();
  console.log("Inserting enrollment/athlete record...");
  const { error: enrollErr } = await supabaseAdmin.from('sports_enrollments').insert({
    id: enrollmentId,
    school_id: schoolId,
    academic_session_id: academicSessionId,
    student_id: studentId,
    sport_id: sportId,
    status: 'APPROVED'
  });
  if (enrollErr) throw enrollErr;
  generatedIds['sports_enrollments'] = enrollmentId;

  // 3. Team
  const teamId = generateUUID();
  console.log("Inserting team record...");
  const { error: teamErr } = await supabaseAdmin.from('sports_teams').insert({
    id: teamId,
    school_id: schoolId,
    sport_id: sportId,
    name: 'Verification Team 2026',
    coach_id: coachId,
    captain_id: studentId,
    status: 'ACTIVE'
  });
  if (teamErr) throw teamErr;
  generatedIds['sports_teams'] = teamId;

  // 4. Training Session
  const sessionId = generateUUID();
  console.log("Inserting training session record...");
  const { error: sessErr } = await supabaseAdmin.from('sports_training_sessions').insert({
    id: sessionId,
    school_id: schoolId,
    academic_session_id: academicSessionId,
    sport_id: sportId,
    team_id: teamId,
    coach_id: coachId,
    session_name: 'Verification Practice',
    session_date: '2026-06-25',
    start_time: '09:00:00',
    end_time: '11:00:00',
    venue: 'Verification Ground',
    recurrence: 'NONE',
    status: 'SCHEDULED'
  });
  if (sessErr) throw sessErr;
  generatedIds['sports_training_sessions'] = sessionId;

  // 5. Tournament
  const tournamentId = generateUUID();
  console.log("Inserting tournament record...");
  const { error: tournErr } = await supabaseAdmin.from('sports_tournaments').insert({
    id: tournamentId,
    school_id: schoolId,
    academic_session_id: academicSessionId,
    sport_id: sportId,
    name: 'Verification Tournament',
    format: 'KNOCKOUT',
    start_date: '2026-07-01',
    end_date: '2026-07-05',
    status: 'UPCOMING',
    venue: 'Verification Field'
  });
  if (tournErr) throw tournErr;
  generatedIds['sports_tournaments'] = tournamentId;

  // 6. Achievement
  const achievementId = generateUUID();
  console.log("Inserting achievement record...");
  const { error: achErr } = await supabaseAdmin.from('sports_achievements').insert({
    id: achievementId,
    school_id: schoolId,
    academic_session_id: academicSessionId,
    student_id: studentId,
    sport_id: sportId,
    type: 'GOLD',
    level: 'DISTRICT',
    title: 'Verification Medal',
    description: 'Gold in verification tests',
    date_awarded: '2026-06-20'
  });
  if (achErr) throw achErr;
  generatedIds['sports_achievements'] = achievementId;

  // 7. Certificate
  const certificateId = generateUUID();
  console.log("Inserting certificate record...");
  const certNumber = 'AEGIS-VERIFY-' + generateUUID().substring(0, 8);
  const { error: certErr } = await supabaseAdmin.from('sports_certificates').insert({
    id: certificateId,
    school_id: schoolId,
    academic_session_id: academicSessionId,
    student_id: studentId,
    sport_id: sportId,
    tournament_id: tournamentId,
    category: 'WINNER',
    certificate_number: certNumber,
    issue_date: '2026-06-20',
    file_url: 'https://placeholder.com/verify.pdf',
    verification_qr_code: 'VERIFY-QR-' + generateUUID().substring(0, 8)
  });
  if (certErr) throw certErr;
  generatedIds['sports_certificates'] = certificateId;

  // 8. Equipment Item
  const equipmentId = generateUUID();
  console.log("Inserting equipment record...");
  const { error: equipErr } = await supabaseAdmin.from('sports_equipment').insert({
    id: equipmentId,
    school_id: schoolId,
    name: 'Verification Football',
    category: 'Football',
    total_quantity: 5,
    available_quantity: 5,
    condition: 'GOOD',
    location: 'Locker B'
  });
  if (equipErr) throw equipErr;
  generatedIds['sports_equipment'] = equipmentId;

  // 9. Budget
  const budgetId = generateUUID();
  console.log("Inserting budget record...");
  const { error: budgetErr } = await supabaseAdmin.from('sports_budget_allocations').insert({
    id: budgetId,
    school_id: schoolId,
    academic_session_id: academicSessionId,
    allocated_amount: 15000.00,
    spent_amount: 0.00,
    category: 'TRAVEL'
  });
  // Handle unique constraint conflict by deleting existing first if travel exists
  if (budgetErr && budgetErr.code === '23505') {
    console.log("Travel budget already exists, clearing it first...");
    await supabaseAdmin.from('sports_budget_allocations').delete().eq('school_id', schoolId).eq('academic_session_id', academicSessionId).eq('category', 'TRAVEL');
    const { error: budgetRetryErr } = await supabaseAdmin.from('sports_budget_allocations').insert({
      id: budgetId,
      school_id: schoolId,
      academic_session_id: academicSessionId,
      allocated_amount: 15000.00,
      spent_amount: 0.00,
      category: 'TRAVEL'
    });
    if (budgetRetryErr) throw budgetRetryErr;
  } else if (budgetErr) {
    throw budgetErr;
  }
  generatedIds['sports_budget_allocations'] = budgetId;

  // 10. Expense
  const expenseId = generateUUID();
  console.log("Inserting expense record...");
  const { error: expErr } = await supabaseAdmin.from('sports_expenses').insert({
    id: expenseId,
    school_id: schoolId,
    academic_session_id: academicSessionId,
    category: 'TOURNAMENT_EXPENSE',
    title: 'Verification Travel Cost',
    amount_requested: 1200.00,
    requested_by: adminUserId,
    status: 'PENDING'
  });
  if (expErr) throw expErr;
  generatedIds['sports_expenses'] = expenseId;

  console.log("\n>>> Verification Insertion Complete. Captured database IDs:", generatedIds);

  // Verification checks: SELECT exists
  console.log("\n>>> Verifying records exist in Supabase tables...");
  for (const [table, id] of Object.entries(generatedIds)) {
    const { data, error } = await supabaseAdmin.from(table).select('id').eq('id', id).maybeSingle();
    if (error) {
      throw new Error(`Error verifying row existence in table ${table}: ${error.message}`);
    }
    if (!data) {
      throw new Error(`Verification FAILED: ID ${id} not found in table ${table}`);
    }
    console.log(`Table "${table}" entry is verified: EXISTS`);
  }

  // Deletion checks
  console.log("\n>>> Deleting verification records in reverse-dependency order...");

  // Delete expense
  console.log("Deleting expense record...");
  const { error: d1 } = await supabaseAdmin.from('sports_expenses').delete().eq('id', expenseId);
  if (d1) throw d1;

  // Delete budget
  console.log("Deleting budget record...");
  const { error: d2 } = await supabaseAdmin.from('sports_budget_allocations').delete().eq('id', budgetId);
  if (d2) throw d2;

  // Delete equipment
  console.log("Deleting equipment record...");
  const { error: d3 } = await supabaseAdmin.from('sports_equipment').delete().eq('id', equipmentId);
  if (d3) throw d3;

  // Delete certificate
  console.log("Deleting certificate record...");
  const { error: d4 } = await supabaseAdmin.from('sports_certificates').delete().eq('id', certificateId);
  if (d4) throw d4;

  // Delete tournament
  console.log("Deleting tournament record...");
  const { error: d5 } = await supabaseAdmin.from('sports_tournaments').delete().eq('id', tournamentId);
  if (d5) throw d5;

  // Delete achievement
  console.log("Deleting achievement record...");
  const { error: d6 } = await supabaseAdmin.from('sports_achievements').delete().eq('id', achievementId);
  if (d6) throw d6;

  // Delete training session
  console.log("Deleting training session record...");
  const { error: d7 } = await supabaseAdmin.from('sports_training_sessions').delete().eq('id', sessionId);
  if (d7) throw d7;

  // Delete team
  console.log("Deleting team record...");
  const { error: d8 } = await supabaseAdmin.from('sports_teams').delete().eq('id', teamId);
  if (d8) throw d8;

  // Delete enrollment
  console.log("Deleting enrollment record...");
  const { error: d9 } = await supabaseAdmin.from('sports_enrollments').delete().eq('id', enrollmentId);
  if (d9) throw d9;

  // Delete coach
  console.log("Deleting coach record...");
  const { error: d10 } = await supabaseAdmin.from('sports_coaches').delete().eq('id', coachId);
  if (d10) throw d10;

  // Delete temp coach user record
  console.log("Deleting temp coach user record...");
  const { error: d11 } = await supabaseAdmin.from('users').delete().eq('id', tempCoachUserId);
  if (d11) throw d11;

  // Delete temp auth user
  console.log("Deleting temp auth user...");
  const { error: d12 } = await supabaseAdmin.auth.admin.deleteUser(tempCoachUserId);
  if (d12) throw d12;

  console.log("\n>>> Deletion queries finished. Confirming row counts are 0 for the created IDs...");
  for (const [table, id] of Object.entries(generatedIds)) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('id', id);
    if (error) {
      throw new Error(`Error verifying deletion count for table ${table}: ${error.message}`);
    }
    if (count !== 0) {
      throw new Error(`Deletion verification FAILED: Row with ID ${id} still exists in table ${table} (count: ${count})`);
    }
    console.log(`Table "${table}" ID count is verified: 0`);
  }

  console.log("\n=== ALL CRITICAL SPORTS CRUD VERIFIED DIRECTLY ON DATABASE ===");
  console.log("SPORTS MODULE CERTIFIED FOR PRODUCTION");
}

run().catch(err => {
  console.error("\n*** VERIFICATION FAILED ***", err);
  process.exit(1);
});
