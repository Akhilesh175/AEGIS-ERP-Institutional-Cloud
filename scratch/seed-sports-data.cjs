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
  console.log("=== STARTING SPORTS ERP SEEDING UTILITY ===");

  // 1. Fetch schools and academic sessions
  const { data: schools } = await supabaseAdmin.from('schools').select('id, name');
  if (!schools || schools.length === 0) {
    console.error("No schools found in the database. Aborting.");
    return;
  }
  console.log(`Found ${schools.length} schools.`);

  const { data: sessions } = await supabaseAdmin.from('academic_sessions').select('id, name, school_id');
  if (!sessions || sessions.length === 0) {
    console.error("No academic sessions found in the database. Aborting.");
    return;
  }
  console.log(`Found ${sessions.length} academic sessions.`);

  // 2. Fetch existing students and teachers
  const { data: students } = await supabaseAdmin.from('students').select('id, school_id, user_id, class_id');
  const { data: teachers } = await supabaseAdmin.from('teachers').select('id, school_id, user_id');

  console.log(`Found ${students.length} students and ${teachers.length} teachers in DB.`);

  for (const school of schools) {
    const schoolId = school.id;
    console.log(`\n--- Seeding Data for School: "${school.name}" (${schoolId}) ---`);

    const session = sessions.find(s => s.school_id === schoolId) || sessions[0];
    const sessionId = session.id;

    const schoolStudents = students.filter(s => s.school_id === schoolId);
    const schoolTeachers = teachers.filter(t => t.school_id === schoolId);

    if (schoolStudents.length === 0) {
      console.log(`No students in school "${school.name}". Skipping.`);
      continue;
    }

    // A. Seed sports categories
    console.log("Seeding sports categories...");
    const categoriesData = [
      { school_id: schoolId, name: 'Team Sports', description: 'Sports played between two opposing teams' },
      { school_id: schoolId, name: 'Individual Sports', description: 'Sports contested by individual athletes' },
      { school_id: schoolId, name: 'Indoor Sports', description: 'Sports played inside a closed facility' },
      { school_id: schoolId, name: 'Outdoor Sports', description: 'Sports played in open fields or courts' }
    ];

    const cats = [];
    for (const cat of categoriesData) {
      const { data, error } = await supabaseAdmin.from('sports_categories')
        .insert(cat)
        .select()
        .single();
      
      if (error && error.code !== '23505') {
        console.error("Failed to seed category:", error.message);
      } else {
        const record = data || (await supabaseAdmin.from('sports_categories').select('id').eq('school_id', schoolId).eq('name', cat.name).single()).data;
        if (record) cats.push(record);
      }
    }
    console.log(`Created/Retrieved ${cats.length} categories.`);

    const teamCat = cats.find(c => c.name === 'Team Sports') || cats[0];
    const individualCat = cats.find(c => c.name === 'Individual Sports') || cats[0];
    const indoorCat = cats.find(c => c.name === 'Indoor Sports') || cats[0];
    const outdoorCat = cats.find(c => c.name === 'Outdoor Sports') || cats[0];

    // B. Seed Sports registry
    console.log("Seeding sports registry...");
    const sportsData = [
      { school_id: schoolId, category_id: teamCat.id, name: 'Cricket', type: 'OUTDOOR', format: 'TEAM', status: 'ACTIVE' },
      { school_id: schoolId, category_id: teamCat.id, name: 'Football', type: 'OUTDOOR', format: 'TEAM', status: 'ACTIVE' },
      { school_id: schoolId, category_id: teamCat.id, name: 'Basketball', type: 'INDOOR', format: 'TEAM', status: 'ACTIVE' },
      { school_id: schoolId, category_id: teamCat.id, name: 'Volleyball', type: 'OUTDOOR', format: 'TEAM', status: 'ACTIVE' },
      { school_id: schoolId, category_id: individualCat.id, name: 'Badminton', type: 'INDOOR', format: 'INDIVIDUAL', status: 'ACTIVE' },
      { school_id: schoolId, category_id: individualCat.id, name: 'Table Tennis', type: 'INDOOR', format: 'INDIVIDUAL', status: 'ACTIVE' },
      { school_id: schoolId, category_id: individualCat.id, name: 'Chess', type: 'INDOOR', format: 'INDIVIDUAL', status: 'ACTIVE' },
      { school_id: schoolId, category_id: outdoorCat.id, name: 'Athletics', type: 'OUTDOOR', format: 'INDIVIDUAL', status: 'ACTIVE' }
    ];

    const sportsList = [];
    for (const sport of sportsData) {
      const { data, error } = await supabaseAdmin.from('sports')
        .insert(sport)
        .select()
        .single();
      
      if (error && error.code !== '23505') {
        console.error("Failed to seed sport:", error.message);
      } else {
        const record = data || (await supabaseAdmin.from('sports').select('id, name').eq('school_id', schoolId).eq('name', sport.name).single()).data;
        if (record) sportsList.push(record);
      }
    }
    console.log(`Created/Retrieved ${sportsList.length} sports.`);

    // C. Seed sports coaches
    console.log("Seeding sports coaches...");
    const coaches = [];
    if (schoolTeachers.length > 0) {
      const specializations = ['Cricket & Football Specialist', 'Badminton & Table Tennis Pro'];
      for (let i = 0; i < schoolTeachers.length; i++) {
        const teacher = schoolTeachers[i];
        const spec = specializations[i % specializations.length];
        
        const { data, error } = await supabaseAdmin.from('sports_coaches')
          .insert({
            school_id: schoolId,
            user_id: teacher.user_id,
            specialization: spec,
            bio: `Experienced instructor specializing in physical education.`,
            status: 'ACTIVE'
          })
          .select()
          .single();

        if (error && error.code !== '23505') {
          console.error(`Failed to seed coach for teacher ${teacher.id}:`, error.message);
        } else {
          const record = data || (await supabaseAdmin.from('sports_coaches').select('id').eq('school_id', schoolId).eq('user_id', teacher.user_id).single()).data;
          if (record) coaches.push(record);
        }
      }
    }
    console.log(`Created/Retrieved ${coaches.length} coaches.`);

    const primaryCoach = coaches[0] || null;
    const secondaryCoach = coaches[1] || primaryCoach;

    // D. Seed sports enrollments
    console.log("Seeding student enrollments...");
    const enrollments = [];
    const cricket = sportsList.find(s => s.name === 'Cricket');
    const football = sportsList.find(s => s.name === 'Football');
    const badminton = sportsList.find(s => s.name === 'Badminton');

    const enrollableSports = [cricket, football, badminton].filter(Boolean);

    for (let i = 0; i < schoolStudents.length; i++) {
      const student = schoolStudents[i];
      // Enroll each student in 1 or 2 sports
      const s1 = enrollableSports[i % enrollableSports.length];
      const s2 = enrollableSports[(i + 1) % enrollableSports.length];
      
      const targets = [s1];
      if (i % 2 === 0 && s1.id !== s2.id) {
        targets.push(s2);
      }

      for (const t of targets) {
        const enrollStatus = i === 0 ? 'PENDING' : 'APPROVED'; // make one pending for approval test
        const { data, error } = await supabaseAdmin.from('sports_enrollments')
          .insert({
            school_id: schoolId,
            academic_session_id: sessionId,
            student_id: student.id,
            sport_id: t.id,
            status: enrollStatus
          })
          .select()
          .single();

        if (error && error.code !== '23505') {
          console.error(`Failed to enroll student ${student.id} to ${t.name}:`, error.message);
        } else {
          const record = data || (await supabaseAdmin.from('sports_enrollments').select('id, student_id, sport_id, status').eq('student_id', student.id).eq('sport_id', t.id).single()).data;
          if (record) enrollments.push(record);
        }
      }
    }
    console.log(`Created/Retrieved ${enrollments.length} enrollments.`);

    // E. Seed sports teams
    console.log("Seeding sports teams...");
    const teams = [];
    const teamConfigs = [
      { name: 'Cricket Team A', sport: cricket, coach: primaryCoach, age_group: 'U-16', gender: 'MIXED' },
      { name: 'Football U-16', sport: football, coach: primaryCoach, age_group: 'U-16', gender: 'MALE' },
      { name: 'Badminton Girls Team', sport: badminton, coach: secondaryCoach, age_group: 'U-18', gender: 'FEMALE' }
    ];

    for (const conf of teamConfigs) {
      if (!conf.sport) continue;
      
      // Get enrolled students for captain
      const enrolledStudents = enrollments
        .filter(e => e.sport_id === conf.sport.id && e.status === 'APPROVED')
        .map(e => e.student_id);

      const captainId = enrolledStudents[0] || null;
      const viceCaptainId = enrolledStudents[1] || null;

      const { data, error } = await supabaseAdmin.from('sports_teams')
        .insert({
          school_id: schoolId,
          sport_id: conf.sport.id,
          name: conf.name,
          coach_id: conf.coach ? conf.coach.id : null,
          captain_id: captainId,
          vice_captain_id: viceCaptainId,
          age_group: conf.age_group,
          gender: conf.gender,
          status: 'ACTIVE'
        })
        .select()
        .single();

      if (error && error.code !== '23505') {
        console.error(`Failed to create team "${conf.name}":`, error.message);
      } else {
        const record = data || (await supabaseAdmin.from('sports_teams').select('id, name, sport_id').eq('school_id', schoolId).eq('name', conf.name).single()).data;
        if (record) {
          teams.push(record);
          
          // Enroll all students registered in this sport into the team members list
          console.log(`Adding members to team "${conf.name}"...`);
          for (const studId of enrolledStudents) {
            const { error: memErr } = await supabaseAdmin.from('sports_team_members')
              .insert({
                school_id: schoolId,
                team_id: record.id,
                student_id: studId,
                status: 'ACTIVE'
              });
            if (memErr && memErr.code !== '23505') {
              console.error(`- Failed to add member ${studId} to team ${record.name}:`, memErr.message);
            }
          }
        }
      }
    }
    console.log(`Created/Retrieved ${teams.length} teams.`);

    // F. Seed training sessions
    console.log("Seeding training schedules...");
    const sessionsList = [];
    const dates = ['2026-06-19', '2026-06-20', '2026-06-21', '2026-06-22'];
    const times = [
      { start: '07:00 AM', end: '09:00 AM' },
      { start: '04:00 PM', end: '06:00 PM' }
    ];

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const coach = teamConfigs[i % teamConfigs.length].coach;
      
      for (let j = 0; j < dates.length; j++) {
        const dateStr = dates[j];
        const timeSlot = times[j % times.length];
        
        const { data, error } = await supabaseAdmin.from('sports_training_sessions')
          .insert({
            school_id: schoolId,
            academic_session_id: sessionId,
            sport_id: team.sport_id,
            team_id: team.id,
            coach_id: coach ? coach.id : null,
            session_name: `${team.name} Practice Session`,
            session_date: dateStr,
            start_time: timeSlot.start,
            end_time: timeSlot.end,
            venue: j % 2 === 0 ? 'Main Sports Complex Field' : 'School Indoor Court',
            recurrence: 'WEEKLY',
            status: j === 0 ? 'COMPLETED' : 'SCHEDULED' // first session completed
          })
          .select()
          .single();

        if (error && error.code !== '23505') {
          console.error(`Failed to create training session:`, error.message);
        } else {
          const record = data || (await supabaseAdmin.from('sports_training_sessions').select('id, status').eq('team_id', team.id).eq('session_date', dateStr).limit(1).single()).data;
          if (record) sessionsList.push(record);
        }
      }
    }
    console.log(`Created/Retrieved ${sessionsList.length} training sessions.`);

    // G. Seed Sports Attendance
    console.log("Seeding sports attendance for completed sessions...");
    const completedSessions = sessionsList.filter(s => s.status === 'COMPLETED');
    const markedByUserId = schoolTeachers[0] ? schoolTeachers[0].user_id : '38f8269e-fb13-4ca1-aada-a5c59e83417e';
    
    for (const sess of completedSessions) {
      // Find team members
      const { data: members } = await supabaseAdmin.from('sports_team_members')
        .select('student_id')
        .eq('team_id', sess.team_id || '');

      if (members && members.length > 0) {
        for (let i = 0; i < members.length; i++) {
          const m = members[i];
          const statuses = ['PRESENT', 'PRESENT', 'PRESENT', 'ABSENT', 'LATE'];
          const attStatus = statuses[i % statuses.length];
          
          const { error } = await supabaseAdmin.from('sports_attendance')
            .insert({
              school_id: schoolId,
              session_id: sess.id,
              student_id: m.student_id,
              date: '2026-06-19',
              status: attStatus,
              remarks: attStatus === 'ABSENT' ? 'Unexcused leave' : 'On-time arrival',
              marked_by: markedByUserId
            });

          if (error && error.code !== '23505') {
            console.error(`Failed to mark attendance for student ${m.student_id}:`, error.message);
          }
        }
      }
    }
    console.log("Marked attendance completed.");

    // H. Seed performance metrics
    console.log("Seeding student performance metrics...");
    for (const enrollment of enrollments) {
      if (enrollment.status !== 'APPROVED') continue;
      
      const { data, error } = await supabaseAdmin.from('sports_performance_metrics')
        .insert({
          school_id: schoolId,
          academic_session_id: sessionId,
          student_id: enrollment.student_id,
          sport_id: enrollment.sport_id,
          recorded_date: '2026-06-19',
          speed: Math.floor(Math.random() * 25) + 70, // 70 to 95
          stamina: Math.floor(Math.random() * 20) + 75,
          strength: Math.floor(Math.random() * 25) + 65,
          agility: Math.floor(Math.random() * 20) + 75,
          skill: Math.floor(Math.random() * 20) + 75,
          discipline: Math.floor(Math.random() * 15) + 80,
          teamwork: Math.floor(Math.random() * 15) + 80,
          fitness: Math.floor(Math.random() * 20) + 78,
          coach_rating: (Math.random() * 2.5 + 7.5).toFixed(1), // 7.5 to 10.0
          tournament_performance: Math.floor(Math.random() * 30) + 65,
          achievement_progress: Math.floor(Math.random() * 30) + 70,
          coach_id: primaryCoach ? primaryCoach.id : null,
          remarks: 'Shows great dedication in drills and training sessions. Strong physical attributes.'
        })
        .select()
        .single();

      if (error && error.code !== '23505') {
        console.error(`Failed to seed performance metric:`, error.message);
      }
    }
    console.log("Performance metrics seeding completed.");

    // I. Seed tournaments, fixtures, results & rankings
    console.log("Seeding tournaments engine...");
    const tournamentData = [
      { school_id: schoolId, academic_session_id: sessionId, sport_id: cricket.id, name: 'Inter-School Cricket Tournament', format: 'KNOCKOUT', start_date: '2026-05-15', end_date: '2026-05-25', venue: 'St. Xavier School Ground', status: 'COMPLETED' },
      { school_id: schoolId, academic_session_id: sessionId, sport_id: football.id, name: 'District Football Championship', format: 'ROUND_ROBIN', start_date: '2026-06-02', end_date: '2026-06-12', venue: 'City Sports Complex', status: 'COMPLETED' },
      { school_id: schoolId, academic_session_id: sessionId, sport_id: badminton.id, name: 'Basketball Friendly Match', format: 'HYBRID', start_date: '2026-06-10', end_date: '2026-06-15', venue: 'School Indoor Stadium', status: 'ONGOING' }
    ];

    for (const tour of tournamentData) {
      const { data, error } = await supabaseAdmin.from('sports_tournaments')
        .insert(tour)
        .select()
        .single();

      if (error && error.code !== '23505') {
        console.error("Failed to seed tournament:", error.message);
      } else {
        const record = data || (await supabaseAdmin.from('sports_tournaments').select('id, name').eq('school_id', schoolId).eq('name', tour.name).single()).data;
        if (record) {
          // Create a dummy fixture
          const cricketTeam = teams.find(t => t.name === 'Cricket Team A');
          const footballTeam = teams.find(t => t.name === 'Football U-16');
          const basketballTeam = teams.find(t => t.name === 'Badminton Girls Team');

          const t1 = tour.name.includes('Cricket') ? cricketTeam : (tour.name.includes('Football') ? footballTeam : basketballTeam);
          
          if (t1) {
            const { data: fixRecord, error: fixErr } = await supabaseAdmin.from('sports_fixtures')
              .insert({
                school_id: schoolId,
                tournament_id: record.id,
                team1_id: t1.id,
                team2_id: null, // represents opponent team outside school
                match_date: tour.start_date,
                match_time: '09:00 AM',
                venue: tour.venue,
                status: tour.status === 'COMPLETED' ? 'COMPLETED' : 'SCHEDULED',
                round: 'Finals',
                referee_officials: 'Mr. John Miller'
              })
              .select()
              .single();

            if (fixErr && fixErr.code !== '23505') {
              console.error("Failed to create fixture:", fixErr.message);
            } else if (fixRecord && tour.status === 'COMPLETED') {
              // Add a match result
              const { data: matchRecord, error: matErr } = await supabaseAdmin.from('sports_matches')
                .insert({
                  school_id: schoolId,
                  fixture_id: fixRecord.id,
                  winner_team_id: t1.id,
                  team1_score: '240/4 (20 overs)',
                  team2_score: '180/10 (18.2 overs)',
                  summary: 'Outstanding performance. Captain hit a magnificent century.'
                })
                .select()
                .single();

              if (matErr && matErr.code !== '23505') {
                console.error("Failed to create match:", matErr.message);
              } else if (matchRecord) {
                // Duplicate into results table to satisfy the BOTH sports_matches and sports_results requirement
                await supabaseAdmin.from('sports_results')
                  .insert({
                    school_id: schoolId,
                    match_id: matchRecord.id,
                    winner_team_id: t1.id,
                    team1_score: '240/4 (20 overs)',
                    team2_score: '180/10 (18.2 overs)',
                    summary: 'Outstanding performance. Captain hit a magnificent century.'
                  });
              }
            }
          }

          // Seed dynamic rankings
          if (t1) {
            await supabaseAdmin.from('sports_rankings')
              .insert({
                school_id: schoolId,
                academic_session_id: sessionId,
                sport_id: tour.sport_id,
                team_id: t1.id,
                student_id: null,
                points: 80,
                matches_played: 5,
                matches_won: 4,
                matches_lost: 1,
                matches_drawn: 0,
                rank_score: 92,
                rank: 1
              });
          }
        }
      }
    }
    console.log("Tournament structures seeded.");

    // J. Seed certificates and achievements
    console.log("Seeding achievements and certificates...");
    const achStudent = schoolStudents[0];
    if (achStudent) {
      // 1. Achievements
      const achTypes = ['GOLD', 'BEST_PLAYER', 'SPORTS_EXCELLENCE'];
      const levels = ['SCHOOL', 'DISTRICT', 'STATE'];
      const titles = ['Winner - Inter House Cricket', 'Best Player - Cricket Match', 'Participation - Badminton'];

      for (let i = 0; i < titles.length; i++) {
        await supabaseAdmin.from('sports_achievements')
          .insert({
            school_id: schoolId,
            academic_session_id: sessionId,
            student_id: achStudent.id,
            sport_id: cricket.id,
            type: achTypes[i % achTypes.length],
            level: levels[i % levels.length],
            title: titles[i],
            description: `Awarded for outstanding skills during the athletic meet.`,
            date_awarded: '2026-05-15'
          });
      }

      // 2. Certificates
      await supabaseAdmin.from('sports_certificates')
        .insert({
          school_id: schoolId,
          academic_session_id: sessionId,
          student_id: achStudent.id,
          sport_id: cricket.id,
          category: 'BEST_PLAYER',
          certificate_number: `AEGIS-SP-${schoolId.substring(0,4)}-${Math.floor(Math.random() * 90000 + 10000)}`,
          issue_date: '2026-05-20',
          file_url: 'https://placeholder.aegis.com/certificates/sample.pdf',
          verification_qr_code: `AEGIS-QR-VERIFY-${achStudent.id}`
        });
    }

    // K. Seed medical records
    console.log("Seeding medical records...");
    for (const student of schoolStudents) {
      await supabaseAdmin.from('sports_medical_records')
        .insert({
          school_id: schoolId,
          student_id: student.id,
          blood_group: 'O+',
          medical_conditions: 'None',
          emergency_contact: '+919876543210',
          injury_history: JSON.stringify([
            { injury: 'Ankle Sprain', date: '2026-01-10', recovery: 'Completed (2 weeks)' }
          ]),
          recovery_status: 'FIT',
          fitness_expiry_date: '2027-06-19'
        });
    }

    // L. Seed equipment inventory & logs
    console.log("Seeding equipment inventory...");
    const equipData = [
      { school_id: schoolId, name: 'Cricket Bat (English Willow)', category: 'Cricket', total_quantity: 15, available_quantity: 12, condition: 'GOOD', location: 'Sports Room Almirah A' },
      { school_id: schoolId, name: 'Football (Size 5 Leather)', category: 'Football', total_quantity: 40, available_quantity: 36, condition: 'EXCELLENT', location: 'Equipment Room Bin 2' },
      { school_id: schoolId, name: 'Badminton Racket (Carbon Fibre)', category: 'Badminton', total_quantity: 20, available_quantity: 18, condition: 'GOOD', location: 'Racket Rack A' },
      { school_id: schoolId, name: 'Basketball (Rubber)', category: 'Basketball', total_quantity: 12, available_quantity: 12, condition: 'GOOD', location: 'Equipment Room Bin 1' }
    ];

    for (const eq of equipData) {
      const { data, error } = await supabaseAdmin.from('sports_equipment')
        .insert(eq)
        .select()
        .single();
      
      if (error && error.code !== '23505') {
        console.error("Failed to seed equipment:", error.message);
      } else {
        const record = data || (await supabaseAdmin.from('sports_equipment').select('id').eq('school_id', schoolId).eq('name', eq.name).single()).data;
        if (record && primaryCoach) {
          // Log an issuance
          await supabaseAdmin.from('sports_equipment_logs')
            .insert({
              school_id: schoolId,
              equipment_id: record.id,
              assigned_to_user_id: schoolStudents[0].user_id,
              quantity: 1,
              issue_date: '2026-06-19T08:00:00Z',
              status: 'ISSUED'
            });
        }
      }
    }

    // M. Seed sports fees & payments
    console.log("Seeding sports fees and billing payments...");
    const feeTypes = ['REGISTRATION_FEE', 'TRAINING_FEE', 'TOURNAMENT_FEE'];
    const feeAmounts = [500.00, 1500.00, 2000.00];
    const feeNames = ['Annual Registration Fee', 'Quarterly Coaching Fee', 'Inter-School Tournament Entrance Fee'];

    for (let i = 0; i < feeTypes.length; i++) {
      const { data: fee, error } = await supabaseAdmin.from('sports_fees')
        .insert({
          school_id: schoolId,
          academic_session_id: sessionId,
          fee_type: feeTypes[i],
          amount: feeAmounts[i],
          due_date: '2026-06-30',
          description: feeNames[i]
        })
        .select()
        .single();

      if (error && error.code !== '23505') {
        console.error("Failed to seed fee structure:", error.message);
      } else {
        const record = fee || (await supabaseAdmin.from('sports_fees').select('id').eq('school_id', schoolId).eq('fee_type', feeTypes[i]).single()).data;
        if (record) {
          // Seed fee payment for first student as PAID/APPROVED
          await supabaseAdmin.from('sports_fee_payments')
            .insert({
              school_id: schoolId,
              sports_fee_id: record.id,
              student_id: schoolStudents[0].id,
              amount_paid: feeAmounts[i],
              payment_date: '2026-06-18T10:00:00Z',
              payment_method: 'UPI',
              transaction_id: `TXN${Math.floor(Math.random() * 900000 + 100000)}`,
              status: 'APPROVED',
              utr_number: `UTR${Math.floor(Math.random() * 900000000 + 100000000)}`
            });

          // Seed fee payment for second student as PENDING (needs approval)
          if (schoolStudents[1]) {
            await supabaseAdmin.from('sports_fee_payments')
              .insert({
                school_id: schoolId,
                sports_fee_id: record.id,
                student_id: schoolStudents[1].id,
                amount_paid: feeAmounts[i],
                payment_date: '2026-06-19T04:30:00Z',
                payment_method: 'UPI',
                transaction_id: `TXN${Math.floor(Math.random() * 900000 + 100000)}`,
                status: 'PENDING',
                utr_number: `UTR${Math.floor(Math.random() * 900000000 + 100000000)}`,
                payment_screenshot_url: 'https://placeholder.aegis.com/screenshots/payment.jpg'
              });
          }
        }
      }
    }

    // N. Seed sports notifications
    console.log("Seeding notifications...");
    for (const student of schoolStudents) {
      await supabaseAdmin.from('sports_notifications')
        .insert({
          school_id: schoolId,
          user_id: student.user_id,
          title: 'Sports Enrollment Approved',
          message: 'Congratulations! Your enrollment request for Cricket has been approved.',
          channel: 'IN_APP',
          is_read: false
        });
    }

    // O. Activity log
    await supabaseAdmin.from('sports_activity_logs')
      .insert({
        school_id: schoolId,
        user_id: schoolStudents[0].user_id,
        action: 'MODULE_INITIALIZED',
        details: JSON.stringify({ message: "Sports module initialized and seeded successfully." })
      });
  }

  console.log("\n🎉 SPORTS ERP DATABASE SEEDING COMPLETED SUCCESSFULLY! 🎉");
}

run().catch(console.error);
