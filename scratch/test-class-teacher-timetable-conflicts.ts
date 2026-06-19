import './load-env';
import './mock-localStorage';
import { supabaseAdmin } from '../src/lib/supabase';
import { mockDb } from '../src/services/mockDb';
import { mockApi } from '../src/services/mockApi';

async function runTests() {
  console.log('=== RUNNING LIVE DYNAMIC CLASS TEACHER & TIMETABLE CONFLICT TESTS ===\n');

  // 1. Query live active teachers
  const { data: dbTeachers, error: tErr } = await supabaseAdmin
    .from('teachers')
    .select('id, school_id, user_id, users!inner(is_active)')
    .eq('users.is_active', true)
    .limit(2);

  if (tErr || !dbTeachers || dbTeachers.length < 2) {
    console.error('Teachers query error:', tErr);
    throw new Error('Could not find 2 active teachers in database for testing.');
  }

  const schoolId = dbTeachers[0].school_id;
  const teacher1Id = dbTeachers[0].id;
  const teacher2Id = dbTeachers[1].id;

  console.log(`Using schoolId: ${schoolId}`);
  console.log(`Using active teachers: T1 = ${teacher1Id}, T2 = ${teacher2Id}`);

  // 2. Query live classes for this school
  const { data: dbClasses, error: cErr } = await supabaseAdmin
    .from('classes')
    .select('id, name, class_teacher_id')
    .eq('school_id', schoolId)
    .limit(2);

  if (cErr || !dbClasses || dbClasses.length < 2) {
    console.error('Classes query error:', cErr);
    throw new Error(`Could not find 2 classes in school ${schoolId} for testing.`);
  }

  const classId = dbClasses[0].id;
  const class2Id = dbClasses[1].id;
  console.log(`Using classes: C1 = ${classId} (${dbClasses[0].name}), C2 = ${class2Id} (${dbClasses[1].name})`);

  // 3. Query live subject for this school
  const { data: dbSubjects, error: sErr } = await supabaseAdmin
    .from('subjects')
    .select('id, name')
    .eq('school_id', schoolId)
    .limit(1);

  if (sErr || !dbSubjects || dbSubjects.length < 1) {
    console.error('Subjects query error:', sErr);
    throw new Error(`Could not find a subject in school ${schoolId} for testing.`);
  }

  const subjectId = dbSubjects[0].id;
  console.log(`Using subject: S1 = ${subjectId} (${dbSubjects[0].name})`);

  // 4. Setup mock session in localStorage for authentication with correct schoolId scope
  const mockUser = {
    id: dbTeachers[0].user_id, // adminId
    role: 'ADMIN',
    schoolId: schoolId,
    email: 'admin@aegiserp.xyz',
    firstName: 'System',
    lastName: 'Admin',
    isActive: true
  };
  localStorage.setItem('aegis_session', JSON.stringify({
    user: mockUser,
    token: 'mock-token'
  }));

  // 5. Clean mockDb arrays for this school and populate with Supabase records directly
  mockDb.teachers = mockDb.teachers.filter(t => t.schoolId !== schoolId);
  mockDb.users = mockDb.users.filter(u => u.schoolId !== schoolId);
  mockDb.classes = mockDb.classes.filter(c => c.schoolId !== schoolId);
  mockDb.subjects = mockDb.subjects.filter(s => s.schoolId !== schoolId);

  for (const t of dbTeachers) {
    mockDb.teachers.push({
      id: t.id,
      userId: t.user_id,
      schoolId: schoolId,
      employeeId: 'EMP-' + t.id.substring(0, 4),
      qualification: 'Degree',
      joiningDate: '2024-01-01',
      specialization: 'General',
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      deletedAt: null
    });
    mockDb.users.push({
      id: t.user_id,
      email: 'teacher@aegiserp.xyz',
      role: 'TEACHER',
      firstName: 'Test',
      lastName: 'Teacher',
      phone: '',
      avatarUrl: '',
      isActive: true,
      schoolId: schoolId,
      password: 'password',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  for (const c of dbClasses) {
    mockDb.classes.push({
      id: c.id,
      schoolId: schoolId,
      name: c.name,
      academicSessionId: 'session-1',
      createdAt: new Date().toISOString(),
      classTeacherId: c.class_teacher_id || undefined
    });
  }

  for (const s of dbSubjects) {
    mockDb.subjects.push({
      id: s.id,
      schoolId: schoolId,
      name: s.name,
      code: 'SUB-' + s.id.substring(0, 4)
    });
  }

  // Sync other dynamic databases
  await mockApi.syncTimetablesData(schoolId);
  await mockApi.syncTeacherClassSubjectMappingsData(schoolId);

  const cls = mockDb.classes.find(c => c.id === classId);
  if (!cls) throw new Error('Class not found in local mockDb');
  const originalClassTeacherId = cls.classTeacherId;
  cls.classTeacherId = undefined;

  // Clear existing timetables for our classes to start fresh locally
  mockDb.timetables = mockDb.timetables.filter(t => t.classId !== classId && t.classId !== class2Id);

  try {
    // === FEATURE 1 & 2: CLASS TEACHER TESTS ===
    console.log('\n--- TESTING CLASS TEACHER RULE ---');
    console.log('Testing Class Teacher assignment (Initial assignment)...');
    await mockApi.adminAssignClassTeacher(mockUser.id, classId, teacher1Id);
    if (cls.classTeacherId !== teacher1Id) {
      throw new Error('Initial Class Teacher assignment failed');
    }
    console.log('✔ Initial Class Teacher assigned successfully.');

    console.log('\nTesting Single Class Teacher Rule (Duplicate assignment)...');
    try {
      await mockApi.adminAssignClassTeacher(mockUser.id, classId, teacher2Id);
      throw new Error('Failing: Duplicate class teacher assignment was allowed');
    } catch (err: any) {
      if (err.message === 'This class already has an assigned Class Teacher.') {
        console.log('✔ Successfully prevented duplicate active class teacher.');
      } else {
        throw new Error(`Unexpected error on duplicate assignment: ${err.message}`);
      }
    }

    console.log('\nTesting Change Class Teacher (Replacement workflow)...');
    await mockApi.adminChangeClassTeacher(mockUser.id, classId, teacher2Id);
    if (cls.classTeacherId !== teacher2Id) {
      throw new Error('Changing Class Teacher failed');
    }
    console.log('✔ Changed Class Teacher successfully.');

    console.log('\nTesting Remove Class Teacher...');
    await mockApi.adminRemoveClassTeacher(mockUser.id, classId);
    if (cls.classTeacherId !== undefined && cls.classTeacherId !== null) {
      throw new Error('Removing Class Teacher failed');
    }
    console.log('✔ Class Teacher removed successfully.');

    // === FEATURE 3, 4 & 5: TIMETABLE CONFLICT TESTS ===
    console.log('\n--- TESTING TIMETABLE CONFLICT DETECTION ---');
    console.log('Creating base period (Monday 09:00 - 10:30)...');
    await mockApi.adminMapTeacherClassSubject(
      mockUser.id,
      teacher1Id,
      classId,
      subjectId,
      1,
      '09:00',
      '10:30',
      'Room 303'
    );
    console.log('✔ Base period created.');

    console.log('\nTesting Teacher Timetable Conflict (overlapping time for same teacher)...');
    try {
      await mockApi.adminMapTeacherClassSubject(
        mockUser.id,
        teacher1Id,
        class2Id,
        subjectId,
        1,
        '09:30',
        '10:30',
        'Room 304'
      );
      throw new Error('Failing: Overlapping teacher assignment was allowed');
    } catch (err: any) {
      if (err.message === 'Teacher is already assigned during the selected time period.') {
        console.log('✔ Successfully prevented teacher overlap conflict.');
      } else {
        throw new Error(`Unexpected error on teacher conflict: ${err.message}`);
      }
    }

    console.log('\nTesting Room Conflict (overlapping time for same room)...');
    try {
      await mockApi.adminMapTeacherClassSubject(
        mockUser.id,
        teacher2Id,
        class2Id,
        subjectId,
        1,
        '10:00',
        '11:30',
        'Room 303'
      );
      throw new Error('Failing: Overlapping room assignment was allowed');
    } catch (err: any) {
      if (err.message === 'Selected room is already occupied during this time period.') {
        console.log('✔ Successfully prevented room occupancy conflict.');
      } else {
        throw new Error(`Unexpected error on room conflict: ${err.message}`);
      }
    }

    console.log('\nTesting Class Conflict (overlapping time for same class)...');
    try {
      await mockApi.adminMapTeacherClassSubject(
        mockUser.id,
        teacher2Id,
        classId,
        subjectId,
        1,
        '10:15',
        '11:15',
        'Room 305'
      );
      throw new Error('Failing: Overlapping class assignment was allowed');
    } catch (err: any) {
      if (err.message === 'This class already has a scheduled lecture during the selected time period.') {
        console.log('✔ Successfully prevented class schedule conflict.');
      } else {
        throw new Error(`Unexpected error on class conflict: ${err.message}`);
      }
    }

    console.log('\n✔ All Class Teacher & Timetable Conflict tests passed successfully!');

  } finally {
    console.log('\nRestoring database state...');
    try {
      if (originalClassTeacherId) {
        await supabaseAdmin.from('classes').update({ class_teacher_id: originalClassTeacherId }).eq('id', classId);
      } else {
        await supabaseAdmin.from('classes').update({ class_teacher_id: null }).eq('id', classId);
      }
      const syncedTts = mockDb.timetables.filter(t => t.classId === classId || t.classId === class2Id);
      for (const tt of syncedTts) {
        if (tt.id.length > 10) {
          await supabaseAdmin.from('timetables').delete().eq('id', tt.id);
        }
      }
      console.log('✔ Database restored successfully.');
    } catch (restoreErr: any) {
      console.error('Failed to restore database state:', restoreErr.message);
    }
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Failure:', err.message);
  process.exit(1);
});
