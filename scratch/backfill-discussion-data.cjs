const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {}
};

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
  console.log('=== Starting Discussion Module Backfill ===\n');

  // 1. Fetch existing classes
  console.log('Fetching active classes...');
  const { data: classes, error: clErr } = await supabaseAdmin
    .from('classes')
    .select('id, name, school_id, academic_session_id, class_teacher_id');

  if (clErr) {
    console.error('Failed to fetch classes:', clErr.message);
    return;
  }
  console.log(`Found ${classes.length} classes.`);

  // 2. Create Chat Groups
  console.log('\nCreating chat groups...');
  const groupIds = {};
  for (const c of classes) {
    const groupName = `${c.name} Group Discussion`;
    const { data: group, error: grpErr } = await supabaseAdmin
      .from('class_chat_groups')
      .insert({
        school_id: c.school_id,
        academic_session_id: c.academic_session_id,
        class_id: c.id,
        name: groupName
      })
      .select()
      .single();

    if (grpErr) {
      if (grpErr.code === '23505') { // Unique constraint violation (already exists)
        const { data: existing } = await supabaseAdmin
          .from('class_chat_groups')
          .select('id')
          .eq('class_id', c.id)
          .single();
        if (existing) {
          groupIds[c.id] = existing.id;
          console.log(`- Chat group for class "${c.name}" already exists: id = ${existing.id}`);
        }
      } else {
        console.error(`- Failed to create chat group for class "${c.name}":`, grpErr.message);
      }
    } else {
      groupIds[c.id] = group.id;
      console.log(`- Created chat group for class "${c.name}": id = ${group.id}`);
    }
  }

  // 3. Backfill Admins and Academic Admins into every group
  console.log('\nBackfilling School Admins & Academic Admins...');
  const { data: admins, error: admErr } = await supabaseAdmin
    .from('users')
    .select('id, school_id, role')
    .in('role', ['ADMIN', 'ACADEMIC_ADMIN'])
    .eq('is_active', true);

  if (admErr) {
    console.error('Failed to fetch admins:', admErr.message);
  } else {
    console.log(`Found ${admins.length} active admins.`);
    for (const admin of admins) {
      // Find all groups in the same school
      const schoolGroups = classes.filter(c => c.school_id === admin.school_id);
      for (const sg of schoolGroups) {
        const groupId = groupIds[sg.id];
        if (!groupId) continue;

        const { error: memErr } = await supabaseAdmin
          .from('class_chat_members')
          .insert({
            school_id: sg.school_id,
            academic_session_id: sg.academic_session_id,
            group_id: groupId,
            user_id: admin.id,
            role: admin.role
          });
        
        if (memErr && memErr.code !== '23505') {
          console.error(`- Failed to enroll admin ${admin.id} to group ${groupId}:`, memErr.message);
        }
      }
    }
    console.log('✅ Admin memberships sync completed.');
  }

  // 4. Backfill Class Teachers
  console.log('\nBackfilling Class Teachers...');
  for (const c of classes) {
    if (!c.class_teacher_id) continue;
    const groupId = groupIds[c.id];
    if (!groupId) continue;

    // Get teacher's user_id
    const { data: teacher, error: tErr } = await supabaseAdmin
      .from('teachers')
      .select('user_id')
      .eq('id', c.class_teacher_id)
      .single();

    if (tErr || !teacher || !teacher.user_id) {
      console.error(`- Class teacher user record not found for class "${c.name}":`, tErr?.message);
      continue;
    }

    const { error: memErr } = await supabaseAdmin
      .from('class_chat_members')
      .insert({
        school_id: c.school_id,
        academic_session_id: c.academic_session_id,
        group_id: groupId,
        user_id: teacher.user_id,
        role: 'CLASS_TEACHER'
      });

    if (memErr) {
      if (memErr.code === '23505') {
        // Update role to CLASS_TEACHER if they are already in the group (e.g. as subject teacher)
        await supabaseAdmin
          .from('class_chat_members')
          .update({ role: 'CLASS_TEACHER' })
          .eq('group_id', groupId)
          .eq('user_id', teacher.user_id);
      } else {
        console.error(`- Failed to enroll class teacher ${teacher.user_id} to group ${groupId}:`, memErr.message);
      }
    } else {
      console.log(`- Enrolled Class Teacher ${teacher.user_id} in class "${c.name}"`);
    }
  }

  // 5. Backfill Subject Teachers
  console.log('\nBackfilling Subject Teachers...');
  const { data: mappings, error: mapErr } = await supabaseAdmin
    .from('teacher_class_subject_mappings')
    .select('class_id, teacher_id');

  if (mapErr) {
    console.error('Failed to fetch subject mappings:', mapErr.message);
  } else {
    console.log(`Found ${mappings.length} teacher subject mappings.`);
    for (const m of mappings) {
      const c = classes.find(cl => cl.id === m.class_id);
      if (!c) continue;
      const groupId = groupIds[m.class_id];
      if (!groupId) continue;

      // Get teacher user_id
      const { data: teacher } = await supabaseAdmin
        .from('teachers')
        .select('user_id')
        .eq('id', m.teacher_id)
        .single();

      if (!teacher || !teacher.user_id) continue;

      const { error: memErr } = await supabaseAdmin
        .from('class_chat_members')
        .insert({
          school_id: c.school_id,
          academic_session_id: c.academic_session_id,
          group_id: groupId,
          user_id: teacher.user_id,
          role: 'TEACHER'
        });

      if (memErr && memErr.code !== '23505') {
        console.error(`- Failed to enroll subject teacher ${teacher.user_id} to group ${groupId}:`, memErr.message);
      }
    }
    console.log('✅ Subject teachers memberships sync completed.');
  }

  // 6. Backfill Students
  console.log('\nBackfilling Students...');
  const { data: students, error: studErr } = await supabaseAdmin
    .from('students')
    .select('school_id, academic_session_id, class_id, user_id');

  if (studErr) {
    console.error('Failed to fetch students:', studErr.message);
  } else {
    console.log(`Found ${students.length} students.`);
    for (const s of students) {
      if (!s.class_id) continue;
      const groupId = groupIds[s.class_id];
      if (!groupId) continue;

      const { error: memErr } = await supabaseAdmin
        .from('class_chat_members')
        .insert({
          school_id: s.school_id,
          academic_session_id: s.academic_session_id,
          group_id: groupId,
          user_id: s.user_id,
          role: 'STUDENT'
        });

      if (memErr && memErr.code !== '23505') {
        console.error(`- Failed to enroll student ${s.user_id} to group ${groupId}:`, memErr.message);
      }
    }
    console.log('✅ Student memberships sync completed.');
  }

  console.log('\n🎉 BACKFILL COMPLETED SUCCESSFULLY!');
}

run().catch(console.error);
