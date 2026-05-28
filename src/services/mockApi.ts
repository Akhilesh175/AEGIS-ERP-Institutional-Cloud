import { mockDb, getSystemTelemetry } from './mockDb';
import { 
  User, Student, Parent, Teacher, Class, Subject, Timetable, 
  Attendance, Assignment, AssignmentSubmission, Quiz, QuizAttempt, 
  Exam, ExamMark, FeeStructure, FeePayment, PaymentStatus, ChatMessage, Announcement, 
  Notification, AuditLog, StudyMaterial, ExamSchedule, 
  TeacherClassSubjectMapping, QuizQuestion, School, ForumPost, ForumReply, ParentStudentMapping, ForumCategory
} from '../types';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { subscriptionPlans } from './subscriptionConfig';

// Helper to simulate network latency
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// Secure session key
const SESSION_KEY = 'aegis_session';

// Lightweight in-memory locks to prevent concurrent auto-seeding race conditions
const isSeedingClassesMap: { [schoolId: string]: boolean } = {};
const isSeedingSubjectsMap: { [schoolId: string]: boolean } = {};

export interface AuthSession {
  user: User;
  token: string;
  studentId?: string; // Cache primary id
  teacherId?: string;
  parentId?: string;
  schoolSubscriptionPlan?: string;
}

export const getAdminSchoolId = (): string => {
  try {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as AuthSession;
      if (session.user.role === 'ADMIN' && session.user.schoolId) {
        return session.user.schoolId;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return 'school-1'; // default fallback
};


// ── Super Admin Identity Lock ────────────────────────────────────────────────
// ONLY this exact email address is permitted to log in as SUPER_ADMIN.
// Any other email attempting to use a SUPER_ADMIN role will be rejected.
const SUPER_ADMIN_EMAIL = 'jy7018080@gmail.com';

export const mockApi = {
  async resolveActiveSessionId(schoolId: string): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const activeSession = mockDb.academicSessions.find(s => s.schoolId === schoolId && s.isCurrent && isUUID(s.id));
    if (activeSession) {
      return activeSession.id;
    }
    const { data: sessRow } = await supabaseAdmin
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle();
    if (sessRow && isUUID(sessRow.id)) {
      return sessRow.id;
    }
    const { data: anyRow } = await supabaseAdmin
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .order('is_current', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anyRow && isUUID(anyRow.id)) {
      return anyRow.id;
    }
    const { data: newSess, error } = await supabaseAdmin
      .from('academic_sessions')
      .insert({
        school_id: schoolId,
        name: '2025-2026 Academic Year',
        start_date: '2025-09-01',
        end_date: '2026-06-30',
        is_current: true
      })
      .select('id')
      .single();
    if (error || !newSess) {
      throw new Error('Failed to resolve or create a valid Academic Session: ' + (error?.message || 'Unknown error'));
    }
    mockDb.academicSessions.push({
      id: newSess.id,
      schoolId: schoolId,
      name: '2025-2026 Academic Year',
      startDate: '2025-09-01',
      endDate: '2026-06-30',
      isCurrent: true
    });
    mockDb.saveAll();
    return newSess.id;
  },

  async uploadProfileImage(userId: string, file: File): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(userId)) {
      throw new Error('Invalid user ID format. Must be a valid UUID.');
    }

    // 1. Delete old avatar from storage first if there is one
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (dbUser?.avatar_url) {
      try {
        const parts = dbUser.avatar_url.split('/avatars/');
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabaseAdmin.storage.from('avatars').remove([filePath]);
        }
      } catch (err) {
        console.error('Failed to remove old avatar file from storage:', err);
      }
    }

    // 2. Upload new avatar with cache-busting timestamp
    const extension = file.name.split('.').pop() || 'png';
    const timestamp = Date.now();
    const filePath = `${userId}/avatar_${timestamp}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '0', // No cache to enforce instant UI refresh
        upsert: true
      });

    if (uploadError) {
      throw new Error('Failed to upload profile photo to storage: ' + uploadError.message);
    }

    // 3. Resolve public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // 4. Update avatar_url in database
    const { error: dbUpdateError } = await supabaseAdmin
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (dbUpdateError) {
      throw new Error('Failed to save profile photo URL to database: ' + dbUpdateError.message);
    }

    // 5. Update local client cache in mockDb.users
    const userIdx = mockDb.users.findIndex(u => u.id === userId);
    if (userIdx !== -1) {
      mockDb.users[userIdx].avatarUrl = publicUrl;
      mockDb.saveAll();
    }

    return publicUrl;
  },

  async removeProfileImage(userId: string): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(userId)) {
      throw new Error('Invalid user ID format. Must be a valid UUID.');
    }

    // 1. Fetch current avatar URL from database
    const { data: dbUser } = await supabaseAdmin
      .from('users')
      .select('avatar_url')
      .eq('id', userId)
      .single();

    if (dbUser?.avatar_url) {
      try {
        const parts = dbUser.avatar_url.split('/avatars/');
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabaseAdmin.storage.from('avatars').remove([filePath]);
        }
      } catch (err) {
        console.error('Failed to delete avatar from storage:', err);
      }
    }

    // 2. Set avatar_url to NULL in database
    const { error: dbUpdateError } = await supabaseAdmin
      .from('users')
      .update({ avatar_url: null })
      .eq('id', userId);

    if (dbUpdateError) {
      throw new Error('Failed to clear profile photo from database: ' + dbUpdateError.message);
    }

    // 3. Clear from local client cache
    const userIdx = mockDb.users.findIndex(u => u.id === userId);
    if (userIdx !== -1) {
      mockDb.users[userIdx].avatarUrl = '';
      mockDb.saveAll();
    }
  },

  // ==========================================
  // 1. AUTHENTICATION & SESSION MANAGEMENT
  // ==========================================
  
  async login(email: string, password_hash: string): Promise<AuthSession> {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: password_hash
    });

    if (authError || !authData.user) {
      mockDb.addLog(null, 'LOGIN_FAILED', { email, reason: authError?.message || 'Authentication failed' });
      throw new Error(authError?.message || 'Invalid email or password');
    }

    // 2. Fetch user profile from public.users table
    // For superadmin (school_id is null), standard RLS policies prevent selecting from users.
    // Therefore, we must use the supabaseAdmin client strictly for Super Admin profiles.
    let userProfile = null;
    let profileError = null;

    // Super Admin profile must be fetched using the admin client (RLS bypass)
    // because SUPER_ADMIN users have school_id = NULL which blocks standard RLS queries.
    if (email === SUPER_ADMIN_EMAIL) {
      const { data, error } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      userProfile = data;
      profileError = error;
    } else {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .single();
      userProfile = data;
      profileError = error;
    }

    if (profileError || !userProfile) {
      throw new Error('User profile not found. Please contact your administrator.');
    }

    // ── Security Guard ────────────────────────────────────────────────────────
    // Prevent any account other than the designated Super Admin email from
    // ever receiving SUPER_ADMIN privileges — even if the database record says so.
    if (userProfile.role === 'SUPER_ADMIN' && email !== SUPER_ADMIN_EMAIL) {
      mockDb.addLog(null, 'SECURITY_VIOLATION', { email, reason: 'SUPER_ADMIN_IMPERSONATION_ATTEMPT' });
      throw new Error('Access Denied: Unauthorized account.');
    }

    if (!userProfile.is_active) {
      mockDb.addLog(userProfile.id, 'LOGIN_BLOCKED', { email });
      throw new Error('Account deactivated. Please contact administration.');
    }

    // Map database profile to frontend User object
    const user: User = {
      id: userProfile.id,
      email: userProfile.email,
      role: userProfile.role,
      firstName: userProfile.first_name,
      lastName: userProfile.last_name,
      phone: userProfile.phone || '',
      avatarUrl: userProfile.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      isActive: userProfile.is_active,
      schoolId: userProfile.school_id,
      createdAt: userProfile.created_at || new Date().toISOString(),
      updatedAt: userProfile.created_at || new Date().toISOString()
    };

    // Determine sub-entity IDs from Supabase database tables directly on login
    let studentId: string | undefined;
    let teacherId: string | undefined;
    let parentId: string | undefined;

    if (user.role === 'STUDENT') {
      const { data: stRow } = await supabaseAdmin.from('students').select('id').eq('user_id', user.id).maybeSingle();
      studentId = stRow?.id;
      
      // Reconcile and sync local mockDb student cache
      if (stRow) {
        const { data: fullSt } = await supabaseAdmin.from('students').select('*').eq('id', stRow.id).maybeSingle();
        if (fullSt) {
          const studentMapped: Student = {
            id: fullSt.id, userId: fullSt.user_id, schoolId: fullSt.school_id,
            classId: fullSt.class_id || '', academicSessionId: fullSt.academic_session_id || 'session-1',
            admissionNumber: fullSt.admission_number,
            rollNumber: fullSt.roll_number, dateOfBirth: fullSt.date_of_birth || '',
            gender: fullSt.gender, createdAt: fullSt.created_at
          };
          const existingStudent = mockDb.students.findIndex(s => s.id === fullSt.id);
          if (existingStudent === -1) mockDb.students.push(studentMapped);
          else mockDb.students[existingStudent] = studentMapped;
          mockDb.saveAll();
        }
      }
    } else if (user.role === 'TEACHER') {
      const { data: tcRow } = await supabaseAdmin.from('teachers').select('id').eq('user_id', user.id).maybeSingle();
      teacherId = tcRow?.id;
      
      // Reconcile and sync local mockDb teacher cache
      if (tcRow) {
        const { data: fullTc } = await supabaseAdmin.from('teachers').select('*').eq('id', tcRow.id).maybeSingle();
        if (fullTc) {
          const teacherMapped: Teacher = {
            id: fullTc.id, userId: fullTc.user_id, schoolId: fullTc.school_id,
            employeeId: fullTc.employee_id, qualification: fullTc.qualification || '',
            joiningDate: fullTc.joining_date || '', specialization: fullTc.specialization || '',
            createdAt: fullTc.created_at
          };
          const existingTeacher = mockDb.teachers.findIndex(t => t.id === fullTc.id);
          if (existingTeacher === -1) mockDb.teachers.push(teacherMapped);
          else mockDb.teachers[existingTeacher] = teacherMapped;
          mockDb.saveAll();
        }
      }
    } else if (user.role === 'PARENT') {
      const { data: prRow } = await supabaseAdmin.from('parents').select('id').eq('user_id', user.id).maybeSingle();
      parentId = prRow?.id;
      
      // Reconcile and sync local mockDb parent cache
      if (prRow) {
        const { data: fullPr } = await supabaseAdmin.from('parents').select('*').eq('id', prRow.id).maybeSingle();
        if (fullPr) {
          const parentMapped: Parent = {
            id: fullPr.id, userId: fullPr.user_id, schoolId: fullPr.school_id,
            occupation: fullPr.occupation || '', address: fullPr.address || '',
            createdAt: fullPr.created_at
          };
          const existingParent = mockDb.parents.findIndex(p => p.id === fullPr.id);
          if (existingParent === -1) mockDb.parents.push(parentMapped);
          else mockDb.parents[existingParent] = parentMapped;
          mockDb.saveAll();
        }
      }
    }

    // Fetch live subscription plan and school metadata from Supabase
    let subscriptionPlan = 'freemium';
    if (user.schoolId) {
      const { data: dbSchool } = await supabaseAdmin
        .from('schools')
        .select('*')
        .eq('id', user.schoolId)
        .maybeSingle();
      if (dbSchool) {
        subscriptionPlan = dbSchool.subscription_plan ? dbSchool.subscription_plan.toLowerCase() : 'freemium';
        
        // Sync local mockDb schools cache
        const schoolMapped = {
          id: dbSchool.id,
          name: dbSchool.name,
          address: dbSchool.address || '',
          phone: dbSchool.phone || '',
          subscriptionPlan: subscriptionPlan as any,
          createdAt: dbSchool.created_at
        };
        const idx = mockDb.schools.findIndex(s => s.id === dbSchool.id);
        if (idx === -1) mockDb.schools.push(schoolMapped);
        else mockDb.schools[idx] = schoolMapped;
        mockDb.saveAll();
      }
    }

    const session: AuthSession = {
      user,
      token: authData.session?.access_token || 'jwt-mock-token-' + Math.random().toString(36).substring(7),
      studentId,
      teacherId,
      parentId,
      schoolSubscriptionPlan: subscriptionPlan
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    mockDb.addLog(user.id, 'LOGIN_SUCCESS', { role: user.role });

    return session;
  },

  async logout(): Promise<void> {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as AuthSession;
      mockDb.addLog(session.user.id, 'LOGOUT');
    }
    localStorage.removeItem(SESSION_KEY);
    await delay(100);
  },

  async getSession(): Promise<AuthSession | null> {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    if (!sessionRaw) return null;
    try {
      return JSON.parse(sessionRaw);
    } catch {
      return null;
    }
  },

  // ==========================================
  // 2. STUDENT PORTAL ENDPOINTS
  // ==========================================

  async studentGetTimetable(studentId: string): Promise<Timetable[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

    await this.syncTimetablesData(student.schoolId);
    await this.syncAttendanceData(student.schoolId);
    return mockDb.timetables.filter(t => t.classId === student.classId);
  },

  async studentGetAssignments(studentId: string): Promise<{ assignment: Assignment; submission?: AssignmentSubmission }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

    await this.syncAssignmentsData(student.schoolId);
    await this.syncAssignmentSubmissionsData(student.schoolId);

    const assignments = mockDb.assignments.filter(a => a.classId === student.classId);
    
    return assignments.map(assignment => {
      const submission = mockDb.assignmentSubmissions.find(
        sub => sub.assignmentId === assignment.id && sub.studentId === studentId
      );
      return { assignment, submission };
    });
  },

  async studentSubmitAssignment(studentId: string, assignmentId: string, text: string, fileUrl: string): Promise<AssignmentSubmission> {
    await delay(500);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validStudentId = isUUID(studentId) ? studentId : null;
    const validAssignmentId = isUUID(assignmentId) ? assignmentId : null;

    let subRow: any = null;
    
    // Check if submission already exists in database first
    if (validStudentId && validAssignmentId) {
      try {
        const { data: existingSub } = await supabaseAdmin
          .from('assignment_submissions')
          .select('id')
          .eq('assignment_id', validAssignmentId)
          .eq('student_id', validStudentId)
          .maybeSingle();

        if (existingSub) {
          const { data: updatedSub, error: updateErr } = await supabaseAdmin
            .from('assignment_submissions')
            .update({
              submission_text: text,
              file_url: fileUrl,
              submitted_at: new Date().toISOString()
            })
            .eq('id', existingSub.id)
            .select()
            .single();

          if (updateErr) throw new Error(updateErr.message);
          subRow = updatedSub;
        } else {
          const { data: insertedSub, error: insertErr } = await supabaseAdmin
            .from('assignment_submissions')
            .insert({
              assignment_id: validAssignmentId,
              student_id: validStudentId,
              submission_text: text,
              file_url: fileUrl,
              submitted_at: new Date().toISOString()
            })
            .select()
            .single();

          if (insertErr) throw new Error(insertErr.message);
          subRow = insertedSub;
        }
      } catch (err: any) {
        console.error('Failed to submit assignment in database:', err);
      }
    }

    const submission: AssignmentSubmission = {
      id: subRow ? subRow.id : 'sub-' + Math.random().toString(36).substr(2, 9),
      assignmentId,
      studentId,
      submissionText: text,
      fileUrl,
      submittedAt: subRow ? subRow.submitted_at : new Date().toISOString(),
      marksObtained: subRow && subRow.marks_obtained !== null ? Number(subRow.marks_obtained) : undefined,
      feedback: subRow ? subRow.feedback || undefined : undefined,
      gradedBy: subRow ? subRow.graded_by || undefined : undefined,
      gradedAt: subRow ? subRow.graded_at || undefined : undefined
    };

    const existingIndex = mockDb.assignmentSubmissions.findIndex(
      s => s.assignmentId === assignmentId && s.studentId === studentId
    );

    if (existingIndex !== -1) {
      mockDb.assignmentSubmissions[existingIndex] = submission;
    } else {
      mockDb.assignmentSubmissions.push(submission);
    }

    const student = mockDb.students.find(s => s.id === studentId);
    mockDb.addLog(student?.userId || null, 'SUBMIT_ASSIGNMENT', { assignmentId });
    mockDb.saveAll();

    if (student) {
      await this.syncAssignmentSubmissionsData(student.schoolId);
    }

    return submission;
  },

  async studentGetGrades(studentId: string): Promise<{ schedule: ExamSchedule; mark?: ExamMark; subject: Subject; examName: string }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

    // Sync from database first
    await this.syncExamsData(student.schoolId);
    await this.syncExamSchedulesData(student.schoolId);
    await this.syncExamMarksData(student.schoolId);

    const schedules = mockDb.examSchedules.filter(s => s.classId === student.classId);

    return schedules.map(sched => {
      const exam = mockDb.exams.find(e => e.id === sched.examId);
      const subject = mockDb.subjects.find(sub => sub.id === sched.subjectId);
      const mark = mockDb.examMarks.find(m => m.examScheduleId === sched.id && m.studentId === studentId);
      return {
        schedule: sched,
        mark,
        subject: subject || {
          id: sched.subjectId,
          schoolId: student.schoolId,
          name: 'Unknown Subject',
          code: 'UNK'
        },
        examName: exam ? exam.name : 'Exam Assessment'
      };
    });
  },

  async syncAssignmentsData(schoolId: string): Promise<void> {
    try {
      const { data: dbAssignments } = await supabaseAdmin
        .from('assignments')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbAssignments) {
        dbAssignments.forEach((r: any) => {
          const ass: Assignment = {
            id: r.id,
            classId: r.class_id,
            subjectId: r.subject_id,
            teacherId: r.teacher_id,
            title: r.title,
            description: r.description,
            dueDate: r.due_date,
            maxMarks: r.max_marks,
            fileAttachmentUrl: r.file_attachment_url || undefined,
            isHomework: r.is_homework,
            academicSessionId: r.academic_session_id || 'session-1',
            createdAt: r.created_at
          };
          const idx = mockDb.assignments.findIndex(a => a.id === ass.id);
          if (idx === -1) mockDb.assignments.push(ass);
          else mockDb.assignments[idx] = ass;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync assignments:', e);
    }
  },

  async syncAssignmentSubmissionsData(schoolId: string): Promise<void> {
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const schoolClassIds = mockDb.classes.filter(c => c.schoolId === schoolId).map(c => c.id);
      const assignmentsList = mockDb.assignments.filter(a => schoolClassIds.includes(a.classId));
      if (assignmentsList.length === 0) return;
      const assignmentIds = assignmentsList.map(a => a.id).filter(id => isUUID(id));
      if (assignmentIds.length === 0) return;

      // Filter out database-compliant UUIDs from local cache first to prepare exact repopulation
      mockDb.assignmentSubmissions = mockDb.assignmentSubmissions.filter(
        s => !assignmentIds.includes(s.assignmentId) || !isUUID(s.id)
      );

      const { data: dbSubmissions } = await supabaseAdmin
        .from('assignment_submissions')
        .select('*')
        .in('assignment_id', assignmentIds);

      if (dbSubmissions) {
        dbSubmissions.forEach((r: any) => {
          const sub: AssignmentSubmission = {
            id: r.id,
            assignmentId: r.assignment_id,
            studentId: r.student_id,
            submissionText: r.submission_text || undefined,
            fileUrl: r.file_url || undefined,
            submittedAt: r.submitted_at,
            marksObtained: r.marks_obtained !== null ? Number(r.marks_obtained) : undefined,
            feedback: r.feedback || undefined,
            gradedBy: r.graded_by || undefined,
            gradedAt: r.graded_at || undefined
          };
          const idx = mockDb.assignmentSubmissions.findIndex(s => s.id === sub.id);
          if (idx === -1) mockDb.assignmentSubmissions.push(sub);
          else mockDb.assignmentSubmissions[idx] = sub;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync assignment submissions:', e);
    }
  },

  async syncStudyMaterialsData(schoolId: string): Promise<void> {
    try {
      const { data: dbMaterials } = await supabaseAdmin
        .from('study_materials')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbMaterials) {
        dbMaterials.forEach((r: any) => {
          const sm: StudyMaterial = {
            id: r.id,
            subjectId: r.subject_id,
            teacherId: r.teacher_id,
            title: r.title,
            description: r.description || undefined,
            fileUrl: r.file_url,
            fileType: r.file_type as any,
            isVideoStreamable: r.is_video_streamable,
            createdAt: r.created_at
          };
          const idx = mockDb.studyMaterials.findIndex(m => m.id === sm.id);
          if (idx === -1) mockDb.studyMaterials.push(sm);
          else mockDb.studyMaterials[idx] = sm;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync study materials:', e);
    }
  },

  async syncFeeStructuresData(schoolId: string): Promise<void> {
    try {
      const { data: dbStructures } = await supabaseAdmin
        .from('fee_structures')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbStructures) {
        dbStructures.forEach((r: any) => {
          const fs: FeeStructure = {
            id: r.id,
            schoolId: r.school_id,
            academicSessionId: r.academic_session_id,
            classId: r.class_id,
            amount: Number(r.amount),
            dueDate: r.due_date,
            description: r.description
          };
          const idx = mockDb.feeStructures.findIndex(item => item.id === fs.id);
          if (idx === -1) mockDb.feeStructures.push(fs);
          else mockDb.feeStructures[idx] = fs;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync fee structures:', e);
    }
  },

  async syncFeePaymentsData(schoolId: string): Promise<void> {
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const schoolClassIds = mockDb.classes.filter(c => c.schoolId === schoolId).map(c => c.id);
      const structuresList = mockDb.feeStructures.filter(fs => schoolClassIds.includes(fs.classId));
      if (structuresList.length === 0) return;
      const structureIds = structuresList.map(fs => fs.id).filter(id => isUUID(id));
      if (structureIds.length === 0) return;

      // Filter out database-compliant UUIDs from local cache first to prepare exact repopulation
      mockDb.feePayments = mockDb.feePayments.filter(
        p => !structureIds.includes(p.feeStructureId) || !isUUID(p.id)
      );

      const { data: dbPayments } = await supabaseAdmin
        .from('fee_payments')
        .select('*')
        .in('fee_structure_id', structureIds);

      if (dbPayments) {
        dbPayments.forEach((r: any) => {
          const fp: FeePayment = {
            id: r.id,
            feeStructureId: r.fee_structure_id,
            studentId: r.student_id,
            amountPaid: Number(r.amount_paid),
            paymentDate: r.payment_date || '',
            paymentMethod: r.payment_method || '',
            transactionId: r.transaction_id || undefined,
            status: r.status as any,
            createdAt: r.created_at
          };
          const idx = mockDb.feePayments.findIndex(p => p.id === fp.id);
          if (idx === -1) mockDb.feePayments.push(fp);
          else mockDb.feePayments[idx] = fp;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync fee payments:', e);
    }
  },

  async syncAttendanceData(schoolId: string): Promise<void> {
    try {
      const studentIds = mockDb.students.filter(s => s.schoolId === schoolId).map(s => s.id);
      if (studentIds.length === 0) return;

      const { data: dbAttendance } = await supabaseAdmin
        .from('attendance')
        .select('*')
        .in('student_id', studentIds);

      if (dbAttendance) {
        dbAttendance.forEach((r: any) => {
          const att: Attendance = {
            id: r.id,
            studentId: r.student_id,
            classId: r.class_id,
            academicSessionId: r.academic_session_id,
            date: r.date,
            status: r.status as any,
            remarks: r.remarks || undefined,
            markedBy: r.marked_by || ''
          };
          const idx = mockDb.attendance.findIndex(a => a.id === att.id);
          if (idx === -1) mockDb.attendance.push(att);
          else mockDb.attendance[idx] = att;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync attendance:', e);
    }
  },

  async syncAcademicSessionsData(schoolId: string): Promise<void> {
    try {
      const { data: dbSessions } = await supabaseAdmin
        .from('academic_sessions')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbSessions) {
        // clear local school academic sessions before repopulating to keep active session exact
        mockDb.academicSessions = mockDb.academicSessions.filter(s => s.schoolId !== schoolId);
        
        dbSessions.forEach((r: any) => {
          const sess = {
            id: r.id,
            schoolId: r.school_id,
            name: r.name,
            startDate: r.start_date,
            endDate: r.end_date,
            isCurrent: r.is_current
          };
          const idx = mockDb.academicSessions.findIndex(s => s.id === sess.id);
          if (idx === -1) mockDb.academicSessions.push(sess);
          else mockDb.academicSessions[idx] = sess;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync academic sessions:', e);
    }
  },

  async syncTimetablesData(schoolId: string): Promise<void> {
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const classesList = mockDb.classes.filter(c => c.schoolId === schoolId);
      if (classesList.length === 0) return;
      const classIds = classesList.map(c => c.id);

      mockDb.timetables = mockDb.timetables.filter(t => !classIds.includes(t.classId) || isUUID(t.id));

      const { data: dbTimetables } = await supabaseAdmin
        .from('timetables')
        .select('*')
        .in('class_id', classIds);

      if (dbTimetables) {
        dbTimetables.forEach((r: any) => {
          const tt: Timetable = {
            id: r.id,
            classId: r.class_id,
            subjectId: r.subject_id,
            teacherId: r.teacher_id,
            dayOfWeek: r.day_of_week,
            startTime: r.start_time,
            endTime: r.end_time,
            classroomNumber: r.classroom_number || undefined,
            academicSessionId: r.academic_session_id || 'session-1'
          };
          const idx = mockDb.timetables.findIndex(t => t.id === tt.id);
          if (idx === -1) mockDb.timetables.push(tt);
          else mockDb.timetables[idx] = tt;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync timetables:', e);
    }
  },

  async syncTeacherClassSubjectMappingsData(schoolId: string): Promise<void> {
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const teachersList = mockDb.teachers.filter(t => t.schoolId === schoolId);
      if (teachersList.length === 0) return;
      const teacherIds = teachersList.map(t => t.id);

      mockDb.teacherClassSubjectMappings = mockDb.teacherClassSubjectMappings.filter(
        m => !teacherIds.includes(m.teacherId) || isUUID(m.id)
      );

      const { data: dbMappings } = await supabaseAdmin
        .from('teacher_class_subject_mappings')
        .select('*')
        .in('teacher_id', teacherIds);

      if (dbMappings) {
        dbMappings.forEach((r: any) => {
          const map: TeacherClassSubjectMapping = {
            id: r.id,
            teacherId: r.teacher_id,
            classId: r.class_id,
            subjectId: r.subject_id,
            createdAt: r.created_at
          };
          const idx = mockDb.teacherClassSubjectMappings.findIndex(m => m.id === map.id);
          if (idx === -1) mockDb.teacherClassSubjectMappings.push(map);
          else mockDb.teacherClassSubjectMappings[idx] = map;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync teacher class subject mappings:', e);
    }
  },

  async syncExamsData(schoolId: string): Promise<void> {
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      mockDb.exams = mockDb.exams.filter(e => e.schoolId !== schoolId || isUUID(e.id));

      const { data: dbExams } = await supabaseAdmin
        .from('exams')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbExams) {
        dbExams.forEach((r: any) => {
          const ex: Exam = {
            id: r.id,
            schoolId: r.school_id,
            academicSessionId: r.academic_session_id || 'session-1',
            name: r.name,
            startDate: r.start_date,
            endDate: r.end_date
          };
          const idx = mockDb.exams.findIndex(e => e.id === ex.id);
          if (idx === -1) mockDb.exams.push(ex);
          else mockDb.exams[idx] = ex;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync exams:', e);
    }
  },

  async syncExamSchedulesData(schoolId: string): Promise<void> {
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const examsList = mockDb.exams.filter(e => e.schoolId === schoolId);
      if (examsList.length === 0) return;
      const examIds = examsList.map(e => e.id);

      mockDb.examSchedules = mockDb.examSchedules.filter(s => !examIds.includes(s.examId) || isUUID(s.id));

      const { data: dbSchedules } = await supabaseAdmin
        .from('exam_schedules')
        .select('*')
        .in('exam_id', examIds);

      if (dbSchedules) {
        dbSchedules.forEach((r: any) => {
          const sched: ExamSchedule = {
            id: r.id,
            examId: r.exam_id,
            classId: r.class_id,
            subjectId: r.subject_id,
            examDate: r.date,
            startTime: r.start_time || '',
            endTime: r.end_time || '',
            classroom: r.classroom || '',
            maxMarks: r.max_marks
          };
          const idx = mockDb.examSchedules.findIndex(s => s.id === sched.id);
          if (idx === -1) mockDb.examSchedules.push(sched);
          else mockDb.examSchedules[idx] = sched;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync exam schedules:', e);
    }
  },

  async syncExamMarksData(schoolId: string): Promise<void> {
    try {
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const studentsList = mockDb.students.filter(s => s.schoolId === schoolId);
      if (studentsList.length === 0) return;
      const studentIds = studentsList.map(s => s.id);

      mockDb.examMarks = mockDb.examMarks.filter(m => !studentIds.includes(m.studentId) || isUUID(m.id));

      const { data: dbMarks } = await supabaseAdmin
        .from('exam_marks')
        .select('*')
        .in('student_id', studentIds);

      if (dbMarks) {
        dbMarks.forEach((r: any) => {
          const mark: ExamMark = {
            id: r.id,
            examScheduleId: r.exam_schedule_id,
            studentId: r.student_id,
            marksObtained: Number(r.marks_obtained),
            remarks: r.remarks || undefined,
            gradedBy: r.graded_by || '',
            createdAt: r.created_at
          };
          const idx = mockDb.examMarks.findIndex(m => m.id === mark.id);
          if (idx === -1) mockDb.examMarks.push(mark);
          else mockDb.examMarks[idx] = mark;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync exam marks:', e);
    }
  },

  async syncQuizzesData(schoolId: string): Promise<void> {
    try {
      // 1. Sync Quizzes
      const { data: dbQuizzes } = await supabaseAdmin
        .from('quizzes')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbQuizzes) {
        dbQuizzes.forEach((r: any) => {
          const qz: Quiz = {
            id: r.id,
            subjectId: r.subject_id,
            teacherId: r.teacher_id,
            title: r.title,
            durationMinutes: r.duration_minutes,
            totalMarks: r.total_marks,
            dueDate: r.due_date,
            academicSessionId: r.academic_session_id || 'session-1',
            createdAt: r.created_at
          };
          const idx = mockDb.quizzes.findIndex(q => q.id === qz.id);
          if (idx === -1) mockDb.quizzes.push(qz);
          else mockDb.quizzes[idx] = qz;
        });
      }

      // 2. Sync Quiz Questions
      if (dbQuizzes && dbQuizzes.length > 0) {
        const quizIds = dbQuizzes.map((q: any) => q.id);
        const { data: dbQuestions } = await supabaseAdmin
          .from('quiz_questions')
          .select('*')
          .in('quiz_id', quizIds);
        
        if (dbQuestions) {
          dbQuestions.forEach((r: any) => {
            const qq: QuizQuestion = {
              id: r.id,
              quizId: r.quiz_id,
              question: r.question,
              options: r.options,
              correctOption: r.correct_option,
              marks: r.marks
            };
            const idx = mockDb.quizQuestions.findIndex(q => q.id === qq.id);
            if (idx === -1) mockDb.quizQuestions.push(qq);
            else mockDb.quizQuestions[idx] = qq;
          });
        }

        // 3. Sync Quiz Attempts
        const { data: dbAttempts } = await supabaseAdmin
          .from('quiz_attempts')
          .select('*')
          .in('quiz_id', quizIds);
        
        if (dbAttempts) {
          dbAttempts.forEach((r: any) => {
            const qa: QuizAttempt = {
              id: r.id,
              quizId: r.quiz_id,
              studentId: r.student_id,
              answers: r.answers || {},
              score: r.score,
              attemptedAt: r.attempted_at
            };
            const idx = mockDb.quizAttempts.findIndex(a => a.id === qa.id);
            if (idx === -1) mockDb.quizAttempts.push(qa);
            else mockDb.quizAttempts[idx] = qa;
          });
        }
      }
      mockDb.saveAll();
    } catch (e) {
      console.error('Failed to sync quizzes data from database:', e);
    }
  },

  async syncUsersData(schoolId: string): Promise<void> {
    try {
      const { data: dbUsers } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbUsers) {
        dbUsers.forEach((r: any) => {
          const user: User = {
            id: r.id,
            email: r.email,
            role: r.role,
            firstName: r.first_name,
            lastName: r.last_name,
            phone: r.phone || '',
            avatarUrl: r.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
            isActive: r.is_active,
            schoolId: r.school_id,
            createdAt: r.created_at || new Date().toISOString(),
            updatedAt: r.created_at || new Date().toISOString()
          };
          const idx = mockDb.users.findIndex(u => u.id === user.id);
          if (idx === -1) mockDb.users.push(user);
          else mockDb.users[idx] = user;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync users:', e);
    }
  },

  async syncForumCategoriesData(schoolId: string): Promise<void> {
    try {
      await this.syncUsersData(schoolId);
      const { data: dbCats } = await supabaseAdmin
        .from('forum_categories')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbCats) {
        const dbCatIds = dbCats.map((r: any) => r.id);
        mockDb.forumCategories = mockDb.forumCategories.filter(
          c => c.schoolId !== schoolId || dbCatIds.includes(c.id)
        );

        dbCats.forEach((r: any) => {
          const cat: ForumCategory = {
            id: r.id,
            schoolId: r.school_id,
            academicSessionId: r.academic_session_id || null,
            classId: r.class_id || null,
            subjectId: r.subject_id || null,
            name: r.name,
            description: r.description
          };
          const idx = mockDb.forumCategories.findIndex(c => c.id === cat.id);
          if (idx === -1) mockDb.forumCategories.push(cat);
          else mockDb.forumCategories[idx] = cat;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync forum categories:', e);
    }
  },

  async syncForumPostsData(schoolId: string): Promise<void> {
    try {
      await this.syncForumCategoriesData(schoolId);
      const catIds = mockDb.forumCategories.filter(c => c.schoolId === schoolId).map(c => c.id);
      if (catIds.length === 0) {
        mockDb.forumPosts = [];
        mockDb.saveAll();
        return;
      }

      const { data: dbPosts } = await supabaseAdmin
        .from('forum_posts')
        .select('*')
        .in('category_id', catIds);
      
      if (dbPosts) {
        const dbPostIds = dbPosts.map((r: any) => r.id);
        mockDb.forumPosts = mockDb.forumPosts.filter(
          p => !catIds.includes(p.categoryId) || dbPostIds.includes(p.id)
        );

        dbPosts.forEach((r: any) => {
          const post: ForumPost = {
            id: r.id,
            categoryId: r.category_id,
            authorId: r.author_id,
            title: r.title,
            content: r.content,
            academicSessionId: r.academic_session_id || null,
            createdAt: r.created_at
          };
          const idx = mockDb.forumPosts.findIndex(p => p.id === post.id);
          if (idx === -1) mockDb.forumPosts.push(post);
          else mockDb.forumPosts[idx] = post;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync forum posts:', e);
    }
  },

  async syncForumRepliesData(schoolId: string): Promise<void> {
    try {
      await this.syncForumPostsData(schoolId);
      const postIds = mockDb.forumPosts.map(p => p.id);
      if (postIds.length === 0) {
        mockDb.forumReplies = [];
        mockDb.saveAll();
        return;
      }

      const { data: dbReps } = await supabaseAdmin
        .from('forum_replies')
        .select('*')
        .in('post_id', postIds);
      
      if (dbReps) {
        const dbRepIds = dbReps.map((r: any) => r.id);
        mockDb.forumReplies = mockDb.forumReplies.filter(
          rp => !postIds.includes(rp.postId) || dbRepIds.includes(rp.id)
        );

        dbReps.forEach((r: any) => {
          const rep: ForumReply = {
            id: r.id,
            postId: r.post_id,
            authorId: r.author_id,
            content: r.content,
            academicSessionId: r.academic_session_id || null,
            createdAt: r.created_at
          };
          const idx = mockDb.forumReplies.findIndex(x => x.id === rep.id);
          if (idx === -1) mockDb.forumReplies.push(rep);
          else mockDb.forumReplies[idx] = rep;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync forum replies:', e);
    }
  },

  async syncChatMessagesData(userId: string): Promise<void> {
    try {
      const { data: dbChats } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
      
      if (dbChats) {
        dbChats.forEach((r: any) => {
          const msg: ChatMessage = {
            id: r.id,
            senderId: r.sender_id,
            receiverId: r.receiver_id,
            message: r.message,
            isRead: r.is_read,
            createdAt: r.created_at
          };
          const idx = mockDb.chatMessages.findIndex(x => x.id === msg.id);
          if (idx === -1) mockDb.chatMessages.push(msg);
          else mockDb.chatMessages[idx] = msg;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync chat messages:', e);
    }
  },

  async studentGetQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
    await delay(300);
    const { data: dbQuestions } = await supabaseAdmin
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId);

    if (dbQuestions) {
      dbQuestions.forEach((r: any) => {
        const qq: QuizQuestion = {
          id: r.id,
          quizId: r.quiz_id,
          question: r.question,
          options: r.options,
          correctOption: r.correct_option,
          marks: r.marks
        };
        const idx = mockDb.quizQuestions.findIndex(q => q.id === qq.id);
        if (idx === -1) mockDb.quizQuestions.push(qq);
        else mockDb.quizQuestions[idx] = qq;
      });
      mockDb.saveAll();
    }

    return mockDb.quizQuestions.filter(q => q.quizId === quizId);
  },

  async studentGetQuizzes(studentId: string): Promise<{ quiz: Quiz; attempt?: QuizAttempt }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

    await this.syncQuizzesData(student.schoolId);

    // Find subjects in class via teacher mappings
    const activeSubjectIds = mockDb.teacherClassSubjectMappings
      .filter(m => m.classId === student.classId)
      .map(m => m.subjectId);

    const quizzes = mockDb.quizzes.filter(q => activeSubjectIds.includes(q.subjectId));

    return quizzes.map(quiz => {
      const attempt = mockDb.quizAttempts.find(a => a.quizId === quiz.id && a.studentId === studentId);
      return { quiz, attempt };
    });
  },

  async studentAttemptQuiz(studentId: string, quizId: string, answers: Record<string, number>, score: number): Promise<QuizAttempt> {
    await delay(400);
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');

    const { data: dbAttempt, error: attemptErr } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({
        quiz_id: quizId,
        student_id: studentId,
        answers: answers,
        score: score,
        attempted_at: new Date().toISOString()
      })
      .select()
      .single();

    if (attemptErr || !dbAttempt) {
      throw new Error(attemptErr?.message || 'Failed to submit quiz attempt to Supabase.');
    }

    const attempt: QuizAttempt = {
      id: dbAttempt.id,
      quizId: dbAttempt.quiz_id,
      studentId: dbAttempt.student_id,
      answers: dbAttempt.answers || {},
      score: dbAttempt.score,
      attemptedAt: dbAttempt.attempted_at
    };

    const idx = mockDb.quizAttempts.findIndex(a => a.id === attempt.id);
    if (idx === -1) mockDb.quizAttempts.push(attempt);
    else mockDb.quizAttempts[idx] = attempt;

    mockDb.addLog(student.userId, 'ATTEMPT_QUIZ', { quizId, score });
    mockDb.saveAll();
    return attempt;
  },

  async studentGetFees(studentId: string): Promise<{ structure: FeeStructure; payment?: FeePayment }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

    await this.syncFeeStructuresData(student.schoolId);
    await this.syncFeePaymentsData(student.schoolId);

    const structures = mockDb.feeStructures.filter(fs => fs.classId === student.classId);

    return structures.map(structure => {
      const payment = mockDb.feePayments.find(p => p.feeStructureId === structure.id && p.studentId === studentId);
      return { structure, payment };
    });
  },

  async studentPayFee(studentId: string, feeStructureId: string, amount: number, method: string): Promise<FeePayment> {
    await delay(700);

    const pay: FeePayment = {
      id: 'fp-' + Math.random().toString(36).substr(2, 9),
      feeStructureId,
      studentId,
      amountPaid: amount,
      paymentDate: new Date().toISOString(),
      paymentMethod: method,
      transactionId: 'ch_' + Math.random().toString(36).substr(2, 10).toUpperCase(),
      status: 'PAID',
      createdAt: new Date().toISOString()
    };

    mockDb.feePayments.push(pay);
    mockDb.addLog(mockDb.students.find(s => s.id === studentId)?.userId || null, 'PAY_FEE', { feeStructureId, amount });
    mockDb.saveAll();
    return pay;
  },

  // ==========================================
  // 3. PARENT PORTAL ENDPOINTS (READ ONLY + ISO)
  // ==========================================

  async parentGetStudents(parentId: string): Promise<(Student & { userDetails: User; className: string })[]> {
    await delay();
    const mappings = mockDb.parentStudentMappings.filter(m => m.parentId === parentId);
    const studentIds = mappings.map(m => m.studentId);

    return mockDb.students
      .filter(s => studentIds.includes(s.id))
      .map(s => {
        const u = mockDb.users.find(usr => usr.id === s.userId)!;
        const c = mockDb.classes.find(cls => cls.id === s.classId);
        return {
          ...s,
          userDetails: u,
          className: c ? c.name : 'Unassigned Class'
        };
      });
  },

  async parentGetStudentAcademicRecord(parentId: string, studentId: string) {
    await delay(500);

    // CRITICAL RBAC CHECK: Validate Parent-Student Link
    const isMapped = mockDb.parentStudentMappings.some(
      m => m.parentId === parentId && m.studentId === studentId
    );

    if (!isMapped) {
      mockDb.addLog(mockDb.parents.find(p => p.id === parentId)?.userId || null, 'SECURITY_VIOLATION', { parentId, targetStudentId: studentId });
      throw new Error('Unauthorized Access: You are not authorized to view this student\'s records.');
    }

    // Since authorization passed, load student records safely
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Student profile not found.');

    // Sync from database first
    await this.syncExamsData(student.schoolId);
    await this.syncExamSchedulesData(student.schoolId);
    await this.syncExamMarksData(student.schoolId);
    await this.syncTimetablesData(student.schoolId);
    await this.syncAssignmentsData(student.schoolId);
    await this.syncAssignmentSubmissionsData(student.schoolId);
    await this.syncAttendanceData(student.schoolId);
    await this.syncFeeStructuresData(student.schoolId);
    await this.syncFeePaymentsData(student.schoolId);

    const userDetails = mockDb.users.find(u => u.id === student.userId);
    if (!userDetails) throw new Error('Student user profile not found.');
    const c = mockDb.classes.find(cls => cls.id === student.classId);

    const attendance = mockDb.attendance.filter(a => a.studentId === studentId);
    
    // Exam report
    const schedules = mockDb.examSchedules.filter(sched => sched.classId === student.classId);
    const examMarks = schedules.map(sched => {
      const exam = mockDb.exams.find(e => e.id === sched.examId);
      const subject = mockDb.subjects.find(sub => sub.id === sched.subjectId);
      const mark = mockDb.examMarks.find(m => m.examScheduleId === sched.id && m.studentId === studentId);
      return {
        examName: exam ? exam.name : 'Midterm',
        subjectName: subject ? subject.name : 'Unknown Subject',
        subjectCode: subject ? subject.code : '',
        marksObtained: mark ? mark.marksObtained : null,
        maxMarks: sched.maxMarks,
        remarks: mark ? mark.remarks : ''
      };
    });

    // Assignments Homework
    const assignments = mockDb.assignments.filter(a => a.classId === student.classId);
    const assignmentSummaries = assignments.map(a => {
      const submission = mockDb.assignmentSubmissions.find(
        sub => sub.assignmentId === a.id && sub.studentId === studentId
      );
      return {
        title: a.title,
        dueDate: a.dueDate,
        isHomework: a.isHomework,
        submitted: !!submission,
        marksObtained: submission ? submission.marksObtained : null,
        maxMarks: a.maxMarks,
        feedback: submission ? submission.feedback : ''
      };
    });

    // Fees summary
    const structures = mockDb.feeStructures.filter(fs => fs.classId === student.classId);
    const feeSummaries = structures.map(fs => {
      const payment = mockDb.feePayments.find(p => p.feeStructureId === fs.id && p.studentId === studentId);
      return {
        description: fs.description,
        amount: fs.amount,
        dueDate: fs.dueDate,
        status: payment ? payment.status : 'PENDING',
        paymentDate: payment ? payment.paymentDate : ''
      };
    });

    return {
      studentProfile: {
        ...student,
        fullName: `${userDetails.firstName} ${userDetails.lastName}`,
        className: c ? c.name : 'N/A',
        email: userDetails.email,
        phone: userDetails.phone
      },
      attendance,
      examMarks,
      assignments: assignmentSummaries,
      fees: feeSummaries
    };
  },

  // ==========================================
  // 4. TEACHER PORTAL ENDPOINTS
  // ==========================================

  async verifyClassTeacherHubSubscription(teacherId: string): Promise<void> {
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');
    const schoolId = teacher.schoolId;
    if (!schoolId) throw new Error('Teacher has no school association.');
    const { data: dbSchool } = await supabaseAdmin
      .from('schools')
      .select('subscription_plan')
      .eq('id', schoolId)
      .maybeSingle();
    const planName = dbSchool?.subscription_plan?.toLowerCase() || 'freemium';
    if (planName !== 'enterprise') {
      throw new Error('Class Teacher Hub features are only available in the Enterprise subscription plan.');
    }
  },

  async teacherSyncData(teacherId: string): Promise<void> {
    try {
      const teacher = mockDb.teachers.find(t => t.id === teacherId);
      if (!teacher) return;
      const schoolId = teacher.schoolId;

      // 1. Sync Classes
      const { data: classRows } = await supabaseAdmin
        .from('classes')
        .select('*')
        .eq('school_id', schoolId);
      if (classRows) {
        classRows.forEach((r: any) => {
          const cls: Class = {
            id: r.id, schoolId: r.school_id, name: r.name,
            academicSessionId: r.academic_session_id || 'session-1',
            classTeacherId: r.class_teacher_id || undefined,
            createdAt: r.created_at
          };
          const idx = mockDb.classes.findIndex(c => c.id === cls.id);
          if (idx === -1) mockDb.classes.push(cls);
          else mockDb.classes[idx] = cls;
        });
        const classIds = new Set(classRows.map(c => c.id));
        mockDb.classes = mockDb.classes.filter(c => c.schoolId !== schoolId || classIds.has(c.id));
      }

      // 2. Sync Students and associated Users
      const { data: studentRows } = await supabaseAdmin
        .from('students')
        .select(`
          id, user_id, school_id, class_id, academic_session_id, admission_number, roll_number, date_of_birth, gender, created_at,
          users(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
        `)
        .eq('school_id', schoolId);
      if (studentRows) {
        studentRows.forEach((row: any) => {
          const u = row.users as any;
          if (u) {
            const userMapped: User = {
              id: u.id, email: u.email, role: u.role,
              firstName: u.first_name, lastName: u.last_name,
              phone: u.phone || '', avatarUrl: u.avatar_url || '', isActive: u.is_active,
              schoolId: u.school_id, password: '', createdAt: u.created_at, updatedAt: u.created_at
            };
            const existingUser = mockDb.users.findIndex(usr => usr.id === u.id);
            if (existingUser === -1) mockDb.users.push(userMapped);
            else mockDb.users[existingUser] = { ...mockDb.users[existingUser], ...userMapped };
          }

          const studentMapped: Student = {
            id: row.id, userId: row.user_id, schoolId: row.school_id,
            classId: row.class_id || '', academicSessionId: row.academic_session_id || 'session-1',
            admissionNumber: row.admission_number,
            rollNumber: row.roll_number, dateOfBirth: row.date_of_birth || '',
            gender: row.gender, createdAt: row.created_at
          };
          const idx = mockDb.students.findIndex(s => s.id === studentMapped.id);
          if (idx === -1) mockDb.students.push(studentMapped);
          else mockDb.students[idx] = studentMapped;
        });
        const studentIds = new Set(studentRows.map(s => s.id));
        mockDb.students = mockDb.students.filter(s => s.schoolId !== schoolId || studentIds.has(s.id));
      }

      // 3. Sync Parents and associated Users
      const { data: parentRows } = await supabaseAdmin
        .from('parents')
        .select(`
          id, user_id, school_id, occupation, address, created_at,
          users(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
        `)
        .eq('school_id', schoolId);
      if (parentRows) {
        parentRows.forEach((row: any) => {
          const u = row.users as any;
          if (u) {
            const userMapped: User = {
              id: u.id, email: u.email, role: u.role,
              firstName: u.first_name, lastName: u.last_name,
              phone: u.phone || '', avatarUrl: u.avatar_url || '', isActive: u.is_active,
              schoolId: u.school_id, password: '', createdAt: u.created_at, updatedAt: u.created_at
            };
            const existingUser = mockDb.users.findIndex(usr => usr.id === u.id);
            if (existingUser === -1) mockDb.users.push(userMapped);
            else mockDb.users[existingUser] = { ...mockDb.users[existingUser], ...userMapped };
          }

          const parentMapped: Parent = {
            id: row.id, userId: row.user_id, schoolId: row.school_id,
            occupation: row.occupation || '', address: row.address || '',
            createdAt: row.created_at
          };
          const idx = mockDb.parents.findIndex(p => p.id === parentMapped.id);
          if (idx === -1) mockDb.parents.push(parentMapped);
          else mockDb.parents[idx] = parentMapped;
        });
        const parentIds = new Set(parentRows.map(p => p.id));
        mockDb.parents = mockDb.parents.filter(p => p.schoolId !== schoolId || parentIds.has(p.id));

        // 4. Sync Parent-Student Mappings
        if (parentRows.length > 0) {
          const pIds = parentRows.map((p: any) => p.id);
          const { data: mappingRows } = await supabaseAdmin
            .from('parent_student_mapping')
            .select('*')
            .in('parent_id', pIds);
          if (mappingRows) {
            mappingRows.forEach((m: any) => {
              const map: ParentStudentMapping = {
                parentId: m.parent_id,
                studentId: m.student_id,
                relationship: m.relationship
              };
              const exists = mockDb.parentStudentMappings.some(
                cur => cur.parentId === map.parentId && cur.studentId === map.studentId
              );
              if (!exists) mockDb.parentStudentMappings.push(map);
            });
          }
        }
      }

      // 5. Sync Timetables
      await this.syncTimetablesData(schoolId);

      // 6. Sync Teacher Mappings
      await this.syncTeacherClassSubjectMappingsData(schoolId);

      // 7. Sync Attendance
      await this.syncAttendanceData(schoolId);

      mockDb.saveAll();
    } catch (e) {
      console.error('Failed to sync teacher portal data:', e);
    }
  },

  async teacherGetClassSubjectMappings(teacherId: string): Promise<(TeacherClassSubjectMapping & { className: string; subjectName: string; classId: string; subjectCode: string })[]> {
    await delay();
    await this.teacherSyncData(teacherId);
    const mappings = mockDb.teacherClassSubjectMappings.filter(m => m.teacherId === teacherId);

    return mappings.map(m => {
      const c = mockDb.classes.find(cls => cls.id === m.classId);
      const s = mockDb.subjects.find(sub => sub.id === m.subjectId);
      return {
        ...m,
        className: c ? c.name : 'Unknown Class',
        subjectName: s ? s.name : 'Unknown Subject',
        subjectCode: s ? s.code : 'UNKNOWN'
      };
    });
  },

  async teacherGetClassStudents(teacherId: string, classId: string): Promise<(Student & { userDetails: User; attendanceState?: string })[]> {
    await delay();
    await this.teacherSyncData(teacherId);
    
    // Safety check: is teacher mapped to this class?
    const isMapped = mockDb.teacherClassSubjectMappings.some(
      m => m.teacherId === teacherId && m.classId === classId
    );
    if (!isMapped) {
      throw new Error('Access denied: You are not assigned to teach this class.');
    }

    const todayStr = new Date().toISOString().split('T')[0];

    return mockDb.students
      .filter(s => s.classId === classId)
      .map(s => {
        const u = mockDb.users.find(usr => usr.id === s.userId)!;
        const att = mockDb.attendance.find(a => a.studentId === s.id && a.date === todayStr);
        return {
          ...s,
          userDetails: u,
          attendanceState: att ? att.status : undefined
        };
      });
  },

  async teacherMarkAttendance(teacherId: string, classId: string, date: string, records: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; remarks?: string }[]): Promise<void> {
    await delay(500);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    const cls = mockDb.classes.find(c => c.id === classId);
    const academicSessionId = await this.resolveActiveSessionId(teacher.schoolId);

    for (const rec of records) {
      try {
        const { data: existingRecord } = await supabaseAdmin
          .from('attendance')
          .select('id')
          .eq('student_id', rec.studentId)
          .eq('date', date)
          .maybeSingle();

        if (existingRecord) {
          const { error } = await supabaseAdmin
            .from('attendance')
            .update({
              status: rec.status,
              remarks: rec.remarks || null,
              marked_by: teacherId
            })
            .eq('id', existingRecord.id);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from('attendance')
            .insert({
              student_id: rec.studentId,
              class_id: classId,
              academic_session_id: academicSessionId,
              date: date,
              status: rec.status,
              remarks: rec.remarks || null,
              marked_by: teacherId
            });
          if (error) throw error;
        }
      } catch (err: any) {
        console.error('Failed to save attendance record to database:', err);
        throw err;
      }
    }

    // Sync from database to keep local state exact and prevent duplicate cache mismatch
    await this.syncAttendanceData(teacher.schoolId);

    mockDb.addLog(teacher.userId, 'MARK_ATTENDANCE', { classId, count: records.length, date });
    mockDb.saveAll();
  },

  async teacherGetSubmissions(teacherId: string, classId: string): Promise<(AssignmentSubmission & { studentName: string; assignmentTitle: string; maxMarks: number })[]> {
    await delay();
    
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (teacher) {
      await this.syncAssignmentsData(teacher.schoolId);
      await this.syncAssignmentSubmissionsData(teacher.schoolId);
    }

    // Find teacher's subjects in this class
    const subjectIds = mockDb.teacherClassSubjectMappings
      .filter(m => m.teacherId === teacherId && m.classId === classId)
      .map(m => m.subjectId);

    // Find assignments
    const assignments = mockDb.assignments.filter(
      a => a.classId === classId && subjectIds.includes(a.subjectId)
    );
    let assignmentIds = assignments.map(a => a.id);

    let submissions = mockDb.assignmentSubmissions.filter(s => assignmentIds.includes(s.assignmentId));

    if (submissions.length === 0 && subjectIds.length > 0) {
      if (assignments.length === 0) {
        const cls = mockDb.classes.find(c => c.id === classId);
        const academicSessionId = cls?.academicSessionId || (teacher ? await this.resolveActiveSessionId(teacher.schoolId) : 'session-1');
        const autoAssig = {
          id: 'assig-auto-' + classId,
          classId,
          subjectId: subjectIds[0],
          title: 'Chapter 1 Assessment',
          description: 'Complete the questions at the end of the chapter.',
          dueDate: '2026-12-31',
          maxMarks: 50,
          createdAt: new Date().toISOString(),
          createdBy: teacherId,
          teacherId: teacherId,
          isHomework: false,
          academicSessionId
        };
        mockDb.assignments.push(autoAssig);
        assignments.push(autoAssig);
        assignmentIds.push(autoAssig.id);
      }
      const studentsInClass = mockDb.students.filter(s => s.classId === classId);
      if (studentsInClass.length > 0) {
        const autoSub = {
          id: 'sub-auto-' + assignmentIds[0],
          assignmentId: assignmentIds[0],
          studentId: studentsInClass[0].id,
          fileUrl: 'https://cdn.aegis.edu/homework.pdf',
          submittedAt: new Date().toISOString()
        };
        mockDb.assignmentSubmissions.push(autoSub);
        submissions.push(autoSub);
      }
      mockDb.saveAll();
    }

    return submissions.map(s => {
        const student = mockDb.students.find(st => st.id === s.studentId)!;
        const studentUser = mockDb.users.find(u => u.id === student.userId)!;
        const assignment = assignments.find(a => a.id === s.assignmentId)!;

        return {
          ...s,
          studentName: `${studentUser.firstName} ${studentUser.lastName}`,
          assignmentTitle: assignment.title,
          maxMarks: assignment.maxMarks
        };
      });
  },

  async teacherGradeSubmission(teacherId: string, submissionId: string, marks: number, feedback: string): Promise<void> {
    await delay(400);

    const subIndex = mockDb.assignmentSubmissions.findIndex(s => s.id === submissionId);
    if (subIndex === -1) throw new Error('Submission not found');

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (isUUID(submissionId)) {
      try {
        const { error } = await supabaseAdmin
          .from('assignment_submissions')
          .update({
            marks_obtained: marks,
            feedback,
            graded_by: teacherId,
            graded_at: new Date().toISOString()
          })
          .eq('id', submissionId);
        
        if (error) throw new Error(error.message);
      } catch (err: any) {
        console.error('Failed to grade submission in database:', err);
      }
    }
    
    mockDb.assignmentSubmissions[subIndex] = {
      ...mockDb.assignmentSubmissions[subIndex],
      marksObtained: marks,
      feedback,
      gradedBy: teacherId,
      gradedAt: new Date().toISOString()
    };

    // Send notifications to student user
    const submission = mockDb.assignmentSubmissions[subIndex];
    const student = mockDb.students.find(s => s.id === submission.studentId)!;
    const assignment = mockDb.assignments.find(a => a.id === submission.assignmentId)!;

    mockDb.addNotification(
      student.userId,
      'Homework Assignment Graded',
      `Your submission for "${assignment.title}" has been graded: ${marks}/${assignment.maxMarks} marks.`
    );

    mockDb.addLog(teacher.userId, 'GRADE_SUBMISSION', { submissionId, marks });
    mockDb.saveAll();

    await this.syncAssignmentSubmissionsData(teacher.schoolId);
  },

  async teacherGetAssignments(teacherId: string): Promise<(Assignment & { className: string; subjectName: string })[]> {
    await delay();
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) return [];
    const schoolId = teacher.schoolId;
    await this.syncAssignmentsData(schoolId);
    // Only return assignments created by this teacher
    return mockDb.assignments
      .filter(a => a.teacherId === teacherId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(a => {
        const cls = mockDb.classes.find(c => c.id === a.classId);
        const sub = mockDb.subjects.find(s => s.id === a.subjectId);
        return {
          ...a,
          className: cls ? cls.name : 'Class',
          subjectName: sub ? sub.name : 'Subject'
        };
      });
  },

  async teacherGetStudyMaterials(teacherId: string): Promise<(StudyMaterial & { subjectName: string })[]> {
    await delay();
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) return [];
    const schoolId = teacher.schoolId;
    await this.syncStudyMaterialsData(schoolId);
    return mockDb.studyMaterials
      .filter(sm => sm.teacherId === teacherId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(sm => {
        const sub = mockDb.subjects.find(s => s.id === sm.subjectId);
        return {
          ...sm,
          subjectName: sub ? sub.name : 'Subject'
        };
      });
  },

  async teacherGetQuizzes(teacherId: string): Promise<Quiz[]> {
    await delay();
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) return [];
    const schoolId = teacher.schoolId;
    await this.syncQuizzesData(schoolId);
    return mockDb.quizzes
      .filter(q => q.teacherId === teacherId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async teacherCreateAssignment(teacherId: string, classId: string, subjectId: string, title: string, description: string, dueDate: string, isHomework: boolean): Promise<Assignment> {
    await delay(500);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    if (!teacher) throw new Error('Teacher not found.');
    const schoolId = teacher.schoolId;
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    const { data: dbAssign, error } = await supabaseAdmin
      .from('assignments')
      .insert({
        school_id: schoolId,
        class_id: classId,
        subject_id: subjectId,
        teacher_id: teacherId,
        title,
        description,
        due_date: dueDate,
        is_homework: isHomework,
        academic_session_id: academicSessionId
      })
      .select()
      .single();

    if (error || !dbAssign) {
      throw new Error(error?.message || 'Failed to create assignment in Supabase.');
    }

    const assign: Assignment = {
      id: dbAssign.id,
      classId: dbAssign.class_id,
      subjectId: dbAssign.subject_id,
      teacherId: dbAssign.teacher_id,
      title: dbAssign.title,
      description: dbAssign.description,
      dueDate: dbAssign.due_date,
      maxMarks: dbAssign.max_marks,
      fileAttachmentUrl: dbAssign.file_attachment_url || undefined,
      isHomework: dbAssign.is_homework,
      academicSessionId: dbAssign.academic_session_id || academicSessionId,
      createdAt: dbAssign.created_at
    };

    mockDb.assignments.unshift(assign);

    // Notify all students in class
    const studentsInClass = mockDb.students.filter(s => s.classId === classId);
    studentsInClass.forEach(st => {
      mockDb.addNotification(
        st.userId,
        isHomework ? 'New Daily Homework Assigned' : 'New Major Assignment Released',
        `"${title}" is due by ${new Date(dueDate).toLocaleDateString()}. Check details.`
      );
    });

    mockDb.addLog(teacher.userId, 'CREATE_ASSIGNMENT', { classId, title });
    mockDb.saveAll();
    return assign;
  },

  async teacherEditAssignment(assignmentId: string, classId: string, subjectId: string, title: string, description: string, dueDate: string, isHomework: boolean): Promise<Assignment> {
    await delay(500);

    const { data: dbAssign, error } = await supabaseAdmin
      .from('assignments')
      .update({
        class_id: classId,
        subject_id: subjectId,
        title,
        description,
        due_date: dueDate,
        is_homework: isHomework
      })
      .eq('id', assignmentId)
      .select()
      .single();

    if (error || !dbAssign) {
      throw new Error(error?.message || 'Failed to update assignment in Supabase.');
    }

    const assign: Assignment = {
      id: dbAssign.id,
      classId: dbAssign.class_id,
      subjectId: dbAssign.subject_id,
      teacherId: dbAssign.teacher_id,
      title: dbAssign.title,
      description: dbAssign.description,
      dueDate: dbAssign.due_date,
      maxMarks: dbAssign.max_marks,
      fileAttachmentUrl: dbAssign.file_attachment_url || undefined,
      isHomework: dbAssign.is_homework,
      academicSessionId: dbAssign.academic_session_id || 'session-1',
      createdAt: dbAssign.created_at
    };

    const idx = mockDb.assignments.findIndex(a => a.id === assignmentId);
    if (idx !== -1) {
      mockDb.assignments[idx] = assign;
    } else {
      mockDb.assignments.push(assign);
    }

    mockDb.saveAll();
    return assign;
  },

  async teacherDeleteAssignment(assignmentId: string): Promise<void> {
    await delay(500);

    const { error } = await supabaseAdmin
      .from('assignments')
      .delete()
      .eq('id', assignmentId);

    if (error) {
      throw new Error(error.message || 'Failed to delete assignment in Supabase.');
    }

    mockDb.assignments = mockDb.assignments.filter(a => a.id !== assignmentId);
    mockDb.assignmentSubmissions = mockDb.assignmentSubmissions.filter(s => s.assignmentId !== assignmentId);
    mockDb.saveAll();
  },

  async teacherCreateQuiz(teacherId: string, subjectId: string, classId: string, title: string, duration: number, questions: Omit<QuizQuestion, 'id' | 'quizId'>[]): Promise<Quiz> {
    await delay(600);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    if (!teacher) throw new Error('Teacher not found.');
    const schoolId = teacher.schoolId;
    if (!schoolId) throw new Error('Teacher has no school association.');

    const { data: dbSchool } = await supabaseAdmin
      .from('schools')
      .select('subscription_plan')
      .eq('id', schoolId)
      .maybeSingle();
    const planName = dbSchool?.subscription_plan?.toLowerCase() || 'freemium';
    if (planName !== 'pro' && planName !== 'enterprise') {
      throw new Error('Interactive Online Quizzes are only available in Pro and Enterprise subscription plans.');
    }

    const totalMarks = questions.reduce((acc, q) => acc + q.marks, 0);
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    // 1. Insert Quiz into Supabase
    const { data: dbQuiz, error: quizError } = await supabaseAdmin
      .from('quizzes')
      .insert({
        school_id: schoolId,
        subject_id: subjectId,
        teacher_id: teacherId,
        title: title,
        duration_minutes: duration,
        total_marks: totalMarks,
        due_date: new Date(Date.now() + 86400000 * 5).toISOString(),
        academic_session_id: academicSessionId
      })
      .select()
      .single();

    if (quizError || !dbQuiz) {
      throw new Error(quizError?.message || 'Failed to create quiz in Supabase.');
    }

    // 2. Insert Questions into Supabase
    const questionsToInsert = questions.map((q) => ({
      quiz_id: dbQuiz.id,
      question: q.question,
      options: q.options,
      correct_option: q.correctOption,
      marks: q.marks
    }));

    const { data: dbQuestions, error: qError } = await supabaseAdmin
      .from('quiz_questions')
      .insert(questionsToInsert)
      .select();

    if (qError || !dbQuestions) {
      // Clean up the quiz if questions failed to insert
      await supabaseAdmin.from('quizzes').delete().eq('id', dbQuiz.id);
      throw new Error(qError?.message || 'Failed to create quiz questions in Supabase.');
    }

    // 3. Sync to local mockDb
    const quizMapped: Quiz = {
      id: dbQuiz.id,
      subjectId: dbQuiz.subject_id,
      teacherId: dbQuiz.teacher_id,
      title: dbQuiz.title,
      durationMinutes: dbQuiz.duration_minutes,
      totalMarks: dbQuiz.total_marks,
      dueDate: dbQuiz.due_date,
      academicSessionId: dbQuiz.academic_session_id || academicSessionId,
      createdAt: dbQuiz.created_at
    };

    mockDb.quizzes.unshift(quizMapped);

    dbQuestions.forEach((r: any) => {
      const qqq: QuizQuestion = {
        id: r.id,
        quizId: r.quiz_id,
        question: r.question,
        options: r.options,
        correctOption: r.correct_option,
        marks: r.marks
      };
      mockDb.quizQuestions.push(qqq);
    });

    // Notify class students
    const studentsInClass = mockDb.students.filter(s => s.classId === classId);
    studentsInClass.forEach(st => {
      mockDb.addNotification(
        st.userId,
        'New Interactive Quiz Available',
        `The online quiz "${title}" has been published. Take it before the deadline.`
      );
    });

    mockDb.addLog(teacher.userId, 'CREATE_QUIZ', { title, totalMarks });
    mockDb.saveAll();
    return quizMapped;
  },

  async teacherEditQuiz(quizId: string, title: string, duration: number): Promise<void> {
    await delay(500);
    const { error } = await supabaseAdmin
      .from('quizzes')
      .update({ title, duration_minutes: duration })
      .eq('id', quizId);

    if (error) throw new Error(error.message || 'Failed to update quiz in Supabase.');

    const idx = mockDb.quizzes.findIndex(q => q.id === quizId);
    if (idx !== -1) {
      mockDb.quizzes[idx].title = title;
      mockDb.quizzes[idx].durationMinutes = duration;
      mockDb.saveAll();
    }
  },

  async teacherDeleteQuiz(quizId: string): Promise<void> {
    await delay(500);
    const { error } = await supabaseAdmin
      .from('quizzes')
      .delete()
      .eq('id', quizId);

    if (error) throw new Error(error.message || 'Failed to delete quiz in Supabase.');

    mockDb.quizzes = mockDb.quizzes.filter(q => q.id !== quizId);
    mockDb.quizQuestions = mockDb.quizQuestions.filter(q => q.quizId !== quizId);
    mockDb.quizAttempts = mockDb.quizAttempts.filter(q => q.quizId !== quizId);
    mockDb.saveAll();
  },

  // ==========================================
  // 5. ADMIN PORTAL ENDPOINTS (FULL WRITE ACCESS)
  // ==========================================

  async adminGetAcademicSessions(schoolId: string): Promise<any[]> {
    await delay();
    await this.syncAcademicSessionsData(schoolId);
    return mockDb.academicSessions
      .filter(s => s.schoolId === schoolId)
      .sort((a, b) => b.name.localeCompare(a.name));
  },

  async adminCreateAcademicSession(schoolId: string, name: string, startDate: string, endDate: string, isCurrent: boolean): Promise<any> {
    await delay(500);

    // Duplicate name prevention
    const existingDuplicate = mockDb.academicSessions.find(
      s => s.schoolId === schoolId && s.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (existingDuplicate) {
      throw new Error(`An academic session named "${name.trim()}" already exists. Please choose a different name.`);
    }

    // If setting as current active session, make all other sessions inactive in Supabase first
    if (isCurrent) {
      const { error: resetError } = await supabaseAdmin
        .from('academic_sessions')
        .update({ is_current: false })
        .eq('school_id', schoolId);
      if (resetError) throw new Error(resetError.message || 'Failed to reset current academic sessions.');
      
      // Update local db
      mockDb.academicSessions.forEach(s => {
        if (s.schoolId === schoolId) s.isCurrent = false;
      });
    }

    const { data: dbSession, error } = await supabaseAdmin
      .from('academic_sessions')
      .insert({
        school_id: schoolId,
        name,
        start_date: startDate,
        end_date: endDate,
        is_current: isCurrent
      })
      .select()
      .single();

    if (error || !dbSession) {
      throw new Error(error?.message || 'Failed to create academic session in Supabase.');
    }

    const sess = {
      id: dbSession.id,
      schoolId: dbSession.school_id,
      name: dbSession.name,
      startDate: dbSession.start_date,
      endDate: dbSession.end_date,
      isCurrent: dbSession.is_current
    };

    const idx = mockDb.academicSessions.findIndex(s => s.id === sess.id);
    if (idx === -1) mockDb.academicSessions.push(sess);
    else mockDb.academicSessions[idx] = sess;

    mockDb.saveAll();
    return sess;
  },

  async adminSetActiveAcademicSession(schoolId: string, sessionId: string): Promise<void> {
    await delay(500);
    // Set all sessions for this school as inactive
    const { error: resetError } = await supabaseAdmin
      .from('academic_sessions')
      .update({ is_current: false })
      .eq('school_id', schoolId);
    if (resetError) throw new Error(resetError.message || 'Failed to reset current academic sessions.');

    // Set target session as active
    const { error: updateError } = await supabaseAdmin
      .from('academic_sessions')
      .update({ is_current: true })
      .eq('id', sessionId);
    if (updateError) throw new Error(updateError.message || 'Failed to activate academic session.');

    // Update local db
    mockDb.academicSessions.forEach(s => {
      if (s.schoolId === schoolId) {
        s.isCurrent = s.id === sessionId;
      }
    });
    mockDb.saveAll();
  },

  async adminEditAcademicSession(schoolId: string, sessionId: string, name: string, startDate: string, endDate: string): Promise<any> {
    await delay(500);

    // Duplicate name prevention (exclude self)
    const existingDuplicate = mockDb.academicSessions.find(
      s => s.schoolId === schoolId && s.id !== sessionId && s.name.trim().toLowerCase() === name.trim().toLowerCase()
    );
    if (existingDuplicate) {
      throw new Error(`An academic session named "${name.trim()}" already exists. Please choose a different name.`);
    }

    const { data: dbSession, error } = await supabaseAdmin
      .from('academic_sessions')
      .update({
        name,
        start_date: startDate,
        end_date: endDate
      })
      .eq('id', sessionId)
      .eq('school_id', schoolId)
      .select()
      .single();

    if (error || !dbSession) {
      throw new Error(error?.message || 'Failed to update academic session.');
    }

    // Update local cache
    const idx = mockDb.academicSessions.findIndex(s => s.id === sessionId);
    const updated = {
      id: dbSession.id,
      schoolId: dbSession.school_id,
      name: dbSession.name,
      startDate: dbSession.start_date,
      endDate: dbSession.end_date,
      isCurrent: dbSession.is_current
    };
    if (idx !== -1) mockDb.academicSessions[idx] = updated;
    else mockDb.academicSessions.push(updated);
    mockDb.saveAll();
    return updated;
  },

  async adminDeleteAcademicSession(schoolId: string, sessionId: string): Promise<void> {
    await delay(500);

    // Prevent deleting the currently active session
    const target = mockDb.academicSessions.find(s => s.id === sessionId && s.schoolId === schoolId);
    if (target?.isCurrent) {
      throw new Error('Cannot delete the currently active academic session. Please activate a different session first, then delete this one.');
    }

    // Delete from database — CASCADE rules will handle dependent records
    const { error } = await supabaseAdmin
      .from('academic_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('school_id', schoolId);

    if (error) {
      throw new Error(error.message || 'Failed to delete academic session.');
    }

    // Clean local cache: remove the session and any data referencing it
    mockDb.academicSessions = mockDb.academicSessions.filter(s => s.id !== sessionId);
    mockDb.classes = mockDb.classes.filter(c => c.academicSessionId !== sessionId);
    mockDb.timetables = mockDb.timetables.filter(t => t.academicSessionId !== sessionId);
    mockDb.attendance = mockDb.attendance.filter(a => a.academicSessionId !== sessionId);
    mockDb.quizzes = mockDb.quizzes.filter(q => q.academicSessionId !== sessionId);
    mockDb.assignments = mockDb.assignments.filter(a => a.academicSessionId !== sessionId);
    mockDb.students = mockDb.students.filter(s => s.academicSessionId !== sessionId);
    mockDb.saveAll();
  },

  async adminGetInstitutionOverview() {
    await delay();
    const schoolId = getAdminSchoolId();

    // Fetch counts directly from Supabase for accuracy after DB deletions
    const [studentsRes, teachersRes, parentsRes] = await Promise.all([
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'STUDENT'),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'TEACHER'),
      supabaseAdmin.from('users').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'PARENT'),
    ]);

    const totalStudents = studentsRes.count ?? 0;
    const totalTeachers = teachersRes.count ?? 0;
    const totalParents = parentsRes.count ?? 0;

    const schoolClasses = mockDb.classes.filter(c => c.schoolId === schoolId);
    const schoolSubjects = mockDb.subjects.filter(s => s.schoolId === schoolId);

    const structures = mockDb.feeStructures.filter(fs => fs.schoolId === schoolId);
    const structureIds = structures.map(fs => fs.id);
    const payments = mockDb.feePayments.filter(p => structureIds.includes(p.feeStructureId));

    // Fetch live school from Supabase and sync local mockDb in real time
    let schoolName = 'Aegis Academy';
    let subscriptionPlan = 'freemium';
    if (schoolId) {
      const { data: dbSchool } = await supabaseAdmin.from('schools').select('*').eq('id', schoolId).maybeSingle();
      if (dbSchool) {
        schoolName = dbSchool.name;
        subscriptionPlan = dbSchool.subscription_plan ? dbSchool.subscription_plan.toLowerCase() : 'freemium';
        
        // Sync local mockDb schools cache
        const schoolMapped = {
          id: dbSchool.id,
          name: dbSchool.name,
          address: dbSchool.address || '',
          phone: dbSchool.phone || '',
          subscriptionPlan: subscriptionPlan as any,
          createdAt: dbSchool.created_at
        };
        const idx = mockDb.schools.findIndex(s => s.id === dbSchool.id);
        if (idx === -1) mockDb.schools.push(schoolMapped);
        else mockDb.schools[idx] = schoolMapped;
        mockDb.saveAll();
      }
    }
    const plan = subscriptionPlans[subscriptionPlan] || subscriptionPlans.freemium;

    return {
      totalStudents,
      totalTeachers,
      totalParents,
      totalClasses: schoolClasses.length,
      totalSubjects: schoolSubjects.length,
      recentRegistrations: [],
      feeCollections: {
        paid: payments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + p.amountPaid, 0),
        pending: structures.reduce((acc, fs) => {
          const paidAmt = payments
            .filter(p => p.feeStructureId === fs.id && p.status === 'PAID')
            .reduce((sum, p) => sum + p.amountPaid, 0);
          return acc + (fs.amount - paidAmt);
        }, 0)
      },
      subscription: {
        plan: subscriptionPlan,
        limits: plan.limits,
        features: plan.features
      }
    };
  },

  async adminGetStudents(): Promise<(Student & { userDetails: User; className: string })[]> {
    await delay();
    const schoolId = getAdminSchoolId();

    // Fetch live student profiles from Supabase (source of truth)
    const { data: studentRows, error } = await supabase
      .from('students')
      .select(`
        id, user_id, school_id, class_id, academic_session_id, admission_number, roll_number, date_of_birth, gender, created_at,
        users!inner(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
      `)
      .eq('school_id', schoolId);

    if (error || !studentRows) return [];

    // Reconcile local cache
    const result = studentRows.map((row: any) => {
      const u = row.users;
      const userMapped: User = {
        id: u.id, email: u.email, role: u.role,
        firstName: u.first_name, lastName: u.last_name,
        phone: u.phone || '', avatarUrl: u.avatar_url || '', isActive: u.is_active,
        schoolId: u.school_id, password: '', createdAt: u.created_at, updatedAt: u.created_at
      };
      const existingUser = mockDb.users.findIndex(usr => usr.id === u.id);
      if (existingUser === -1) mockDb.users.push(userMapped);
      else mockDb.users[existingUser] = { ...mockDb.users[existingUser], ...userMapped };

      const studentMapped: Student = {
        id: row.id, userId: row.user_id, schoolId: row.school_id,
        classId: row.class_id || '', academicSessionId: row.academic_session_id || 'session-1',
        admissionNumber: row.admission_number,
        rollNumber: row.roll_number, dateOfBirth: row.date_of_birth || '',
        gender: row.gender, createdAt: row.created_at
      };
      const existingStudent = mockDb.students.findIndex(s => s.id === row.id);
      if (existingStudent === -1) mockDb.students.push(studentMapped);
      else mockDb.students[existingStudent] = studentMapped;

      const cls = mockDb.classes.find(c => c.id === row.class_id);
      return { ...studentMapped, userDetails: userMapped, className: cls?.name || 'Unassigned' };
    });

    // Remove stale local entries not in Supabase
    const supabaseIds = new Set(studentRows.map((r: any) => r.id));
    mockDb.students = mockDb.students.filter(s => s.schoolId !== schoolId || supabaseIds.has(s.id));
    mockDb.saveAll();
    return result;
  },


  async adminCreateStudent(adminId: string, email: string, firstName: string, lastName: string, classId: string, admissionNumber: string, rollNumber: number, gender: 'MALE' | 'FEMALE' | 'OTHER', dob: string, password: string): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    // Verify system-wide uniqueness of Admission Number
    const { data: existingAdm } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('admission_number', admissionNumber)
      .maybeSingle();
    if (existingAdm) {
      throw new Error(`Registration failed: The admission number "${admissionNumber}" is already in use in the system.`);
    }

    // Verify uniqueness of Roll Number in the system
    const { data: existingRoll } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('roll_number', rollNumber)
      .maybeSingle();
    if (existingRoll) {
      throw new Error(`Registration failed: The roll number "${rollNumber}" is already in use in the system.`);
    }

    // Check limits
    const { data: school, error: schoolErr } = await supabaseAdmin.from('schools').select('subscription_plan').eq('id', schoolId).single();
    if (schoolErr || !school) throw new Error('School not found.');
    
    // Check limits from Supabase directly
    const plan = subscriptionPlans[school.subscription_plan] || subscriptionPlans.freemium;
    const { count: currentStudentsCount } = await supabaseAdmin
      .from('users').select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('role', 'STUDENT');
    if ((currentStudentsCount ?? 0) >= plan.limits.maxStudents) {
      throw new Error(`Registration failed: Your ${school.subscription_plan} plan is limited to ${plan.limits.maxStudents} students. Please upgrade your subscription.`);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError || !authData.user) throw new Error('Failed to create student auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email,
      role: 'STUDENT',
      first_name: firstName,
      last_name: lastName,
      phone: '',
      school_id: schoolId,
      is_active: true
    });
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create student database profile: ' + dbError.message);
    }

    // Resolve active academic session
    const activeSessionId = await this.resolveActiveSessionId(schoolId);

    // Insert into students table
    const { data: studentRow, error: studentErr } = await supabaseAdmin.from('students').insert({
      user_id: newUserId,
      school_id: schoolId,
      class_id: classId || null,
      academic_session_id: activeSessionId,
      admission_number: admissionNumber,
      roll_number: rollNumber,
      date_of_birth: dob || null, // Safety: use null if date_of_birth is empty string to prevent invalid date syntax database errors
      gender
    }).select('id').single();

    if (studentErr || !studentRow) {
      // Force manual database rollback on profile table failure
      await supabaseAdmin.from('users').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create student record: ' + (studentErr?.message || 'Unknown error'));
    }

    // Sync to local mockDb cache
    const user: User = {
      id: newUserId, email, role: 'STUDENT', firstName, lastName,
      phone: '', avatarUrl: '', isActive: true, schoolId,
      password, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const student: Student = {
      id: studentRow.id, userId: newUserId, schoolId, classId,
      academicSessionId: activeSessionId,
      admissionNumber, rollNumber, dateOfBirth: dob, gender,
      createdAt: new Date().toISOString()
    };
    mockDb.users.push(user);
    mockDb.students.push(student);
    mockDb.addLog(adminId, 'CREATE_STUDENT', { studentName: `${firstName} ${lastName}`, email });
    mockDb.saveAll();
  },


  async adminGetTeachers(): Promise<(Teacher & { userDetails: User })[]> {
    await delay();
    const schoolId = getAdminSchoolId();

    // Fetch live teacher profiles from Supabase (source of truth)
    const { data: teacherRows, error } = await supabase
      .from('teachers')
      .select(`
        id, user_id, school_id, employee_id, qualification, joining_date, specialization, created_at,
        users!inner(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
      `)
      .eq('school_id', schoolId);

    if (error || !teacherRows) return [];

    const result = teacherRows.map((row: any) => {
      const u = row.users;
      const userMapped: User = {
        id: u.id, email: u.email, role: u.role,
        firstName: u.first_name, lastName: u.last_name,
        phone: u.phone || '', avatarUrl: u.avatar_url || '', isActive: u.is_active,
        schoolId: u.school_id, password: '', createdAt: u.created_at, updatedAt: u.created_at
      };
      const existingUser = mockDb.users.findIndex(usr => usr.id === u.id);
      if (existingUser === -1) mockDb.users.push(userMapped);
      else mockDb.users[existingUser] = { ...mockDb.users[existingUser], ...userMapped };

      const teacherMapped: Teacher = {
        id: row.id, userId: row.user_id, schoolId: row.school_id,
        employeeId: row.employee_id, qualification: row.qualification || '',
        joiningDate: row.joining_date || '', specialization: row.specialization || '',
        createdAt: row.created_at
      };
      const existingTeacher = mockDb.teachers.findIndex(t => t.id === row.id);
      if (existingTeacher === -1) mockDb.teachers.push(teacherMapped);
      else mockDb.teachers[existingTeacher] = teacherMapped;

      return { ...teacherMapped, userDetails: userMapped };
    });

    const supabaseIds = new Set(teacherRows.map((r: any) => r.id));
    mockDb.teachers = mockDb.teachers.filter(t => t.schoolId !== schoolId || supabaseIds.has(t.id));
    
    await this.syncTeacherClassSubjectMappingsData(schoolId);
    mockDb.saveAll();
    return result;
  },

  async adminGetParents(): Promise<(Parent & { userDetails: User; linkedStudentNames: string[] })[]> {
    await delay();
    const schoolId = getAdminSchoolId();

    // Fetch live parent profiles from Supabase (source of truth)
    const { data: parentRows, error } = await supabase
      .from('parents')
      .select(`
        id, user_id, school_id, occupation, address, created_at,
        users!inner(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
      `)
      .eq('school_id', schoolId);

    if (error || !parentRows) return [];

    // Fetch parent-student mappings
    const parentIds = parentRows.map((r: any) => r.id);
    const { data: mappingRows } = parentIds.length > 0
      ? await supabase.from('parent_student_mapping').select('parent_id, student_id, relationship').in('parent_id', parentIds)
      : { data: [] };

    const result = parentRows.map((row: any) => {
      const u = row.users;
      const userMapped: User = {
        id: u.id, email: u.email, role: u.role,
        firstName: u.first_name, lastName: u.last_name,
        phone: u.phone || '', avatarUrl: u.avatar_url || '', isActive: u.is_active,
        schoolId: u.school_id, password: '', createdAt: u.created_at, updatedAt: u.created_at
      };
      const existingUser = mockDb.users.findIndex(usr => usr.id === u.id);
      if (existingUser === -1) mockDb.users.push(userMapped);
      else mockDb.users[existingUser] = { ...mockDb.users[existingUser], ...userMapped };

      const parentMapped: Parent = {
        id: row.id, userId: row.user_id, schoolId: row.school_id,
        occupation: row.occupation || '', address: row.address || '',
        createdAt: row.created_at
      };
      const existingParent = mockDb.parents.findIndex(p => p.id === row.id);
      if (existingParent === -1) mockDb.parents.push(parentMapped);
      else mockDb.parents[existingParent] = parentMapped;

      const myMappings = (mappingRows || []).filter((m: any) => m.parent_id === row.id);
      const linkedStudentNames = myMappings.map((m: any) => {
        const s = mockDb.students.find(st => st.id === m.student_id);
        if (!s) return null;
        const su = mockDb.users.find(usr => usr.id === s.userId);
        return su ? `${su.firstName} ${su.lastName}` : null;
      }).filter(Boolean) as string[];

      return { ...parentMapped, userDetails: userMapped, linkedStudentNames };
    });

    const supabaseIds = new Set(parentRows.map((r: any) => r.id));
    mockDb.parents = mockDb.parents.filter(p => p.schoolId !== schoolId || supabaseIds.has(p.id));
    mockDb.saveAll();
    return result;
  },


  async adminLinkParentStudent(adminId: string, parentId: string, studentId: string, relationship: string): Promise<void> {
    await delay(400);

    const exists = mockDb.parentStudentMappings.some(
      m => m.parentId === parentId && m.studentId === studentId
    );

    if (exists) throw new Error('Parent and student are already mapped.');

    mockDb.parentStudentMappings.push({ parentId, studentId, relationship });
    mockDb.addLog(adminId, 'LINK_PARENT_STUDENT', { parentId, studentId, relationship });
    mockDb.saveAll();
  },

  async adminGetClasses(): Promise<Class[]> {
    await delay();
    const schoolId = getAdminSchoolId();

    // Fetch from Supabase as source of truth using standard authenticated client
    const { data: classRows, error } = await supabase
      .from('classes')
      .select('id, school_id, name, academic_session_id, class_teacher_id, created_at')
      .eq('school_id', schoolId);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (!error && classRows && classRows.length > 0) {
      // Sync to local cache
      const mapped: Class[] = classRows.map((r: any) => ({
        id: r.id, schoolId: r.school_id, name: r.name,
        academicSessionId: r.academic_session_id || 'session-1',
        classTeacherId: r.class_teacher_id || undefined,
        createdAt: r.created_at
      }));
      // Merge into mockDb
      mapped.forEach(cls => {
        const idx = mockDb.classes.findIndex(c => c.id === cls.id);
        if (idx === -1) mockDb.classes.push(cls);
        else mockDb.classes[idx] = cls;
      });
      const supabaseIds = new Set(mapped.map(c => c.id));
      mockDb.classes = mockDb.classes.filter(c => c.schoolId !== schoolId || supabaseIds.has(c.id));
      mockDb.saveAll();
      return mapped;
    }

    // Client query returned empty/error. Check database using bypass-RLS admin client to see if classes already exist.
    const { data: adminCheckRows, error: adminCheckError } = await supabaseAdmin
      .from('classes')
      .select('id, school_id, name, academic_session_id, class_teacher_id, created_at')
      .eq('school_id', schoolId);

    if (adminCheckError) {
      console.error('[adminGetClasses] Failed to verify class existence via admin client:', adminCheckError);
    }

    // If classes already exist in the database (even if the client couldn't select them),
    // we MUST NOT seed duplicates! We instead return the existing database classes.
    if (adminCheckRows && adminCheckRows.length > 0) {
      console.log(`[adminGetClasses] Classes already exist in database (${adminCheckRows.length} found). Skipping seeding to prevent duplicates.`);
      const mapped: Class[] = adminCheckRows.map((r: any) => ({
        id: r.id, schoolId: r.school_id, name: r.name,
        academicSessionId: r.academic_session_id || 'session-1',
        classTeacherId: r.class_teacher_id || undefined,
        createdAt: r.created_at
      }));
      // Sync to local cache
      mapped.forEach(cls => {
        const idx = mockDb.classes.findIndex(c => c.id === cls.id);
        if (idx === -1) mockDb.classes.push(cls);
        else mockDb.classes[idx] = cls;
      });
      const supabaseIds = new Set(mapped.map(c => c.id));
      mockDb.classes = mockDb.classes.filter(c => c.schoolId !== schoolId || supabaseIds.has(c.id));
      mockDb.saveAll();
      return mapped;
    }

    // Check if seeding is already in progress for this school (concurrency lock)
    if (isSeedingClassesMap[schoolId]) {
      console.log(`[adminGetClasses] Seeding already in progress for school ${schoolId}. Skipping concurrent seed request.`);
      return mockDb.classes.filter(c => c.schoolId === schoolId);
    }

    isSeedingClassesMap[schoolId] = true;
    try {
      const activeSessionId = await this.resolveActiveSessionId(schoolId);
      // Supabase has no classes for this school yet. Discard mock non-UUID classes and seed!
      console.log(`[adminGetClasses] No classes exist in the database for school_id ${schoolId}. Seeding default classes...`);
      mockDb.classes = mockDb.classes.filter(c => c.schoolId === schoolId && isUUID(c.id));

      const defaultClasses = [
        { school_id: schoolId, name: 'Grade 9-C', academic_session_id: activeSessionId },
        { school_id: schoolId, name: 'Grade 10-A', academic_session_id: activeSessionId },
        { school_id: schoolId, name: 'Grade 11-B', academic_session_id: activeSessionId }
      ];

      const { data: seeded, error: seedError } = await supabaseAdmin
        .from('classes')
        .insert(defaultClasses)
        .select('id, school_id, name, academic_session_id, created_at');

      if (seedError) {
        console.error('[adminGetClasses] Seeding classes failed:', seedError);
      }

      if (seeded && seeded.length > 0) {
        const schoolClasses = seeded.map((r: any) => ({
          id: r.id, schoolId: r.school_id, name: r.name,
          academicSessionId: r.academic_session_id || activeSessionId,
          createdAt: r.created_at
        }));
        mockDb.classes.push(...schoolClasses);
        mockDb.saveAll();
        return schoolClasses;
      }
      return mockDb.classes.filter(c => c.schoolId === schoolId);
    } finally {
      isSeedingClassesMap[schoolId] = false;
    }
  },



  async adminCreateClass(adminId: string, className: string): Promise<Class> {
    await delay(500);
    const schoolId = getAdminSchoolId();
    const activeSessionId = await this.resolveActiveSessionId(schoolId);

    // Insert into Supabase classes table
    const { data: classRow, error } = await supabaseAdmin.from('classes').insert({
      school_id: schoolId,
      name: className,
      academic_session_id: activeSessionId
    }).select('id, school_id, name, academic_session_id, created_at').single();

    if (error || !classRow) throw new Error('Failed to create class: ' + (error?.message || 'Unknown error'));

    const cls: Class = {
      id: classRow.id, schoolId: classRow.school_id, name: classRow.name,
      academicSessionId: classRow.academic_session_id || activeSessionId,
      createdAt: classRow.created_at
    };
    mockDb.classes.push(cls);
    mockDb.addLog(adminId, 'CREATE_CLASS', { className });
    mockDb.saveAll();
    return cls;
  },

  async adminAssignClassTeacher(adminId: string, classId: string, teacherId: string): Promise<void> {
    await delay(300);
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls) throw new Error('Class not found');
    
    try {
      const { error } = await supabaseAdmin
        .from('classes')
        .update({ class_teacher_id: teacherId })
        .eq('id', classId);

      if (error) {
        throw new Error(error.message || 'Failed to assign class teacher in database.');
      }
      
      cls.classTeacherId = teacherId;
      mockDb.addLog(adminId, 'ASSIGN_CLASS_TEACHER', { classId, teacherId });
      mockDb.saveAll();
    } catch (err: any) {
      console.error('Failed to assign class teacher:', err);
      throw new Error(err.message || 'Failed to assign class teacher in database.');
    }
  },
  async adminGetSubjects(): Promise<Subject[]> {
    await delay();
    const schoolId = getAdminSchoolId();

    // Fetch from Supabase as source of truth using standard authenticated client
    const { data: subjectRows, error } = await supabase
      .from('subjects')
      .select('id, school_id, name, code, description')
      .eq('school_id', schoolId);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (!error && subjectRows && subjectRows.length > 0) {
      const mapped: Subject[] = subjectRows.map((r: any) => ({
        id: r.id, schoolId: r.school_id, name: r.name, code: r.code, description: r.description || ''
      }));
      // Sync to local cache
      mapped.forEach(sub => {
        const idx = mockDb.subjects.findIndex(s => s.id === sub.id);
        if (idx === -1) mockDb.subjects.push(sub);
        else mockDb.subjects[idx] = sub;
      });
      const supabaseIds = new Set(mapped.map(s => s.id));
      mockDb.subjects = mockDb.subjects.filter(s => s.schoolId !== schoolId || supabaseIds.has(s.id));
      mockDb.saveAll();
      return mapped;
    }

    // Client query returned empty/error. Check database using bypass-RLS admin client to see if subjects already exist.
    const { data: adminCheckRows, error: adminCheckError } = await supabaseAdmin
      .from('subjects')
      .select('id, school_id, name, code, description')
      .eq('school_id', schoolId);

    if (adminCheckError) {
      console.error('[adminGetSubjects] Failed to verify subject existence via admin client:', adminCheckError);
    }

    // If subjects already exist in the database (even if the client couldn't select them),
    // we MUST NOT seed duplicates! We instead return the existing database subjects.
    if (adminCheckRows && adminCheckRows.length > 0) {
      console.log(`[adminGetSubjects] Subjects already exist in database (${adminCheckRows.length} found). Skipping seeding to prevent duplicates.`);
      const mapped: Subject[] = adminCheckRows.map((r: any) => ({
        id: r.id, schoolId: r.school_id, name: r.name, code: r.code, description: r.description || ''
      }));
      // Sync to local cache
      mapped.forEach(sub => {
        const idx = mockDb.subjects.findIndex(s => s.id === sub.id);
        if (idx === -1) mockDb.subjects.push(sub);
        else mockDb.subjects[idx] = sub;
      });
      const supabaseIds = new Set(mapped.map(s => s.id));
      mockDb.subjects = mockDb.subjects.filter(s => s.schoolId !== schoolId || supabaseIds.has(s.id));
      mockDb.saveAll();
      return mapped;
    }

    // Check if seeding is already in progress for this school (concurrency lock)
    if (isSeedingSubjectsMap[schoolId]) {
      console.log(`[adminGetSubjects] Seeding already in progress for school ${schoolId}. Skipping concurrent seed request.`);
      return mockDb.subjects.filter(s => s.schoolId === schoolId);
    }

    isSeedingSubjectsMap[schoolId] = true;
    try {
      // Supabase has no subjects for this school yet. Discard mock non-UUID subjects and seed!
      console.log(`[adminGetSubjects] No subjects exist in the database for school_id ${schoolId}. Seeding default subjects...`);
      mockDb.subjects = mockDb.subjects.filter(s => s.schoolId === schoolId && isUUID(s.id));

      const suffix = schoolId.substring(schoolId.length - 4).toUpperCase();
      const defaultSubjects = [
        { school_id: schoolId, name: 'Mathematics', code: 'MATH-' + suffix, description: 'Algebra, Geometry and Calculus' },
        { school_id: schoolId, name: 'Physics', code: 'PHYS-' + suffix, description: 'Mechanics and Electromagnetism' },
        { school_id: schoolId, name: 'Computer Science', code: 'COMP-' + suffix, description: 'Information systems and Programming' }
      ];

      const { data: seeded, error: seedError } = await supabaseAdmin
        .from('subjects')
        .insert(defaultSubjects)
        .select('id, school_id, name, code, description');

      if (seedError) {
        console.error('[adminGetSubjects] Seeding subjects failed:', seedError);
      }

      if (seeded && seeded.length > 0) {
        const schoolSubjects = seeded.map((r: any) => ({ id: r.id, schoolId: r.school_id, name: r.name, code: r.code, description: r.description || '' }));
        mockDb.subjects.push(...schoolSubjects);
        mockDb.saveAll();
        return schoolSubjects;
      }
      return mockDb.subjects.filter(s => s.schoolId === schoolId);
    } finally {
      isSeedingSubjectsMap[schoolId] = false;
    }
  },



  async adminCreateSubject(adminId: string, name: string, code: string, description: string): Promise<Subject> {
    await delay(400);
    const schoolId = getAdminSchoolId();

    // Insert into Supabase subjects table
    const { data: subRow, error } = await supabaseAdmin.from('subjects').insert({
      school_id: schoolId, name, code, description
    }).select('id, school_id, name, code, description').single();

    if (error || !subRow) throw new Error('Failed to create subject: ' + (error?.message || 'Unknown error'));

    const sub: Subject = { id: subRow.id, schoolId: subRow.school_id, name: subRow.name, code: subRow.code, description: subRow.description || '' };
    mockDb.subjects.push(sub);
    mockDb.addLog(adminId, 'CREATE_SUBJECT', { name, code });
    mockDb.saveAll();
    return sub;
  },


  async adminMapTeacherClassSubject(
    adminId: string, 
    teacherId: string, 
    classId: string, 
    subjectId: string,
    dayOfWeek?: number,
    startTime?: string,
    endTime?: string,
    classroomNumber?: string
  ): Promise<void> {
    await delay(500);

    // Try to resolve existing mapping from cache or database
    let mappingId: string | null = null;
    const existingMapping = mockDb.teacherClassSubjectMappings.find(
      m => m.teacherId === teacherId && m.classId === classId && m.subjectId === subjectId
    );

    if (existingMapping) {
      mappingId = existingMapping.id;
    } else {
      try {
        // Query DB to see if the mapping already exists in database (e.g. from seed or other admin session)
        const { data: dbMapping } = await supabaseAdmin
          .from('teacher_class_subject_mappings')
          .select()
          .eq('teacher_id', teacherId)
          .eq('class_id', classId)
          .eq('subject_id', subjectId)
          .maybeSingle();

        if (dbMapping) {
          mappingId = dbMapping.id;
          mockDb.teacherClassSubjectMappings.push({
            id: dbMapping.id,
            teacherId: dbMapping.teacher_id,
            classId: dbMapping.class_id,
            subjectId: dbMapping.subject_id,
            createdAt: dbMapping.created_at
          });
        } else {
          // Mapping does not exist anywhere, insert a new one
          const { data: insertedMapping, error: mapError } = await supabaseAdmin
            .from('teacher_class_subject_mappings')
            .insert({
              teacher_id: teacherId,
              class_id: classId,
              subject_id: subjectId
            })
            .select()
            .single();

          if (mapError) {
            throw new Error(mapError.message || 'Failed to save mapping in database.');
          } else if (insertedMapping) {
            mappingId = insertedMapping.id;
            mockDb.teacherClassSubjectMappings.push({
              id: insertedMapping.id,
              teacherId: insertedMapping.teacher_id,
              classId: insertedMapping.class_id,
              subjectId: insertedMapping.subject_id,
              createdAt: insertedMapping.created_at
            });
          }
        }
      } catch (err: any) {
        console.error('Failed to save mapping:', err);
        throw new Error(err.message || 'Failed to save mapping in database.');
      }
    }

    if (dayOfWeek !== undefined && startTime && endTime) {
      try {
        const teacher = mockDb.teachers.find(t => t.id === teacherId);
        const schoolId = teacher ? teacher.schoolId : getAdminSchoolId();
        const academicSessionId = await this.resolveActiveSessionId(schoolId);

        const { data: dbTt, error: ttError } = await supabaseAdmin
          .from('timetables')
          .insert({
            class_id: classId,
            subject_id: subjectId,
            teacher_id: teacherId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            classroom_number: classroomNumber || 'Main Lecture Hall',
            academic_session_id: academicSessionId
          })
          .select()
          .single();

        if (ttError) {
          throw new Error(ttError.message || 'Failed to save timetable in database.');
        } else if (dbTt) {
          mockDb.timetables.push({
            id: dbTt.id,
            classId: dbTt.class_id,
            subjectId: dbTt.subject_id,
            teacherId: dbTt.teacher_id,
            dayOfWeek: dbTt.day_of_week,
            startTime: dbTt.start_time,
            endTime: dbTt.end_time,
            classroomNumber: dbTt.classroom_number || undefined,
            academicSessionId: dbTt.academic_session_id || academicSessionId
          });
        }
      } catch (err: any) {
        console.error(err);
        throw new Error(err.message || 'Failed to save mapping timetable in database.');
      }
    }

    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    const schoolId = teacher ? teacher.schoolId : getAdminSchoolId();

    mockDb.addLog(adminId, 'MAP_TEACHER_CLASS_SUBJECT', { 
      teacherId, classId, subjectId, dayOfWeek, startTime, endTime, classroomNumber 
    });
    mockDb.saveAll();

    await this.syncTeacherClassSubjectMappingsData(schoolId);
    await this.syncTimetablesData(schoolId);
  },

  async adminCreateTeacher(adminId: string, email: string, firstName: string, lastName: string, employeeId: string, qualification: string, specialization: string, phone: string, password: string): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    // Verify system-wide uniqueness of Employee ID
    const { data: existingEmp } = await supabaseAdmin
      .from('teachers')
      .select('id')
      .eq('employee_id', employeeId)
      .maybeSingle();
    if (existingEmp) {
      throw new Error(`Registration failed: The employee ID "${employeeId}" is already in use in the system.`);
    }

    // Check limits
    const { data: school, error: schoolErr } = await supabaseAdmin.from('schools').select('subscription_plan').eq('id', schoolId).single();
    if (schoolErr || !school) throw new Error('School not found.');
    
    // Check limits from Supabase directly
    const plan = subscriptionPlans[school.subscription_plan] || subscriptionPlans.freemium;
    const { count: currentTeachersCount } = await supabaseAdmin
      .from('users').select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('role', 'TEACHER');
    if ((currentTeachersCount ?? 0) >= plan.limits.maxTeachers) {
      throw new Error(`Registration failed: Your ${school.subscription_plan} plan is limited to ${plan.limits.maxTeachers} teachers. Please upgrade your subscription.`);
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (authError || !authData.user) throw new Error('Failed to create teacher auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email,
      role: 'TEACHER',
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      school_id: schoolId,
      is_active: true
    });
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create teacher database profile: ' + dbError.message);
    }

    // Insert into teachers table
    const { data: teacherRow, error: teacherErr } = await supabaseAdmin.from('teachers').insert({
      user_id: newUserId,
      school_id: schoolId,
      employee_id: employeeId,
      qualification: qualification || null,
      specialization: specialization || null,
      joining_date: new Date().toISOString().split('T')[0]
    }).select('id').single();

    if (teacherErr || !teacherRow) {
      // Force manual database rollback on profile table failure
      await supabaseAdmin.from('users').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create teacher record: ' + (teacherErr?.message || 'Unknown error'));
    }

    // Sync to local mockDb cache
    const user: User = {
      id: newUserId, email, role: 'TEACHER', firstName, lastName,
      phone: phone || '', avatarUrl: '', isActive: true, schoolId,
      password, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const teacher: Teacher = {
      id: teacherRow.id, userId: newUserId, schoolId, employeeId,
      qualification, joiningDate: new Date().toISOString().split('T')[0],
      specialization, createdAt: new Date().toISOString()
    };
    mockDb.users.push(user);
    mockDb.teachers.push(teacher);
    mockDb.addLog(adminId, 'CREATE_TEACHER', { teacherName: `${firstName} ${lastName}`, email });
    mockDb.saveAll();
  },

  async adminCreateParent(
    adminId: string, 
    email: string, 
    firstName: string, 
    lastName: string, 
    occupation: string, 
    address: string, 
    phone: string,
    studentId?: string,
    admissionNumber?: string,
    relationship?: string,
    password?: string
  ): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    if (studentId && admissionNumber) {
      const student = mockDb.students.find(s => s.id === studentId);
      if (!student) throw new Error('Selected student not found in registries.');
      
      // Secure verification mismatch validation
      if (student.admissionNumber.toLowerCase().trim() !== admissionNumber.toLowerCase().trim()) {
        throw new Error('Verification failed: Admission number does not match selected student.');
      }
    }

    const pass = password || 'password';
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true
    });
    if (authError || !authData.user) throw new Error('Failed to create parent auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email,
      role: 'PARENT',
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      school_id: schoolId,
      is_active: true
    });
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create parent database profile: ' + dbError.message);
    }

    // Insert into parents table
    const { data: parentRow, error: parentErr } = await supabaseAdmin.from('parents').insert({
      user_id: newUserId,
      school_id: schoolId,
      occupation: occupation || null,
      address: address || null
    }).select('id').single();

    if (parentErr || !parentRow) {
      // Force manual database rollback on profile table failure
      await supabaseAdmin.from('users').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create parent record: ' + (parentErr?.message || 'Unknown error'));
    }

    // Verify student admission number if linking
    let resolvedStudentId = studentId;
    if (studentId && admissionNumber) {
      const student = mockDb.students.find(s => s.id === studentId);
      if (student && student.admissionNumber.toLowerCase().trim() !== admissionNumber.toLowerCase().trim()) {
        throw new Error('Verification failed: Admission number does not match selected student.');
      }
      // Also try to find student from Supabase if not in local cache
      if (!student) {
        const { data: stRow } = await supabaseAdmin.from('students').select('id, admission_number').eq('id', studentId).single();
        if (stRow && stRow.admission_number.toLowerCase().trim() !== admissionNumber.toLowerCase().trim()) {
          throw new Error('Verification failed: Admission number does not match selected student.');
        }
      }
    }

    // Map parent to student in Supabase parent_student_mapping table
    if (resolvedStudentId && relationship) {
      // Find the real Supabase student record for mapping
      const { data: stSupabase } = await supabaseAdmin.from('students').select('id').eq('user_id',
        mockDb.students.find(s => s.id === resolvedStudentId)?.userId || resolvedStudentId
      ).single();
      const realStudentId = stSupabase?.id || resolvedStudentId;

      await supabaseAdmin.from('parent_student_mapping').insert({
        parent_id: parentRow.id,
        student_id: realStudentId,
        relationship
      });
    }

    // Sync to local mockDb cache
    const user: User = {
      id: newUserId, email, role: 'PARENT', firstName, lastName,
      phone, avatarUrl: '', isActive: true, schoolId,
      password: pass, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const parent: Parent = {
      id: parentRow.id, userId: newUserId, schoolId, occupation, address,
      createdAt: new Date().toISOString()
    };
    mockDb.users.push(user);
    mockDb.parents.push(parent);
    if (resolvedStudentId && relationship) {
      mockDb.parentStudentMappings.push({ parentId: parentRow.id, studentId: resolvedStudentId, relationship });
    }
    mockDb.addLog(adminId, 'CREATE_PARENT', { parentName: `${firstName} ${lastName}`, email, studentId });
    mockDb.saveAll();
  },

  async adminDeleteTeacher(adminId: string, teacherId: string): Promise<void> {
    await delay(300);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');
    const authUserId = teacher.userId;

    // 1. Nullify class teacher assignments in Supabase
    await supabaseAdmin.from('classes').update({ class_teacher_id: null }).eq('class_teacher_id', teacherId);
    // 2. Delete teacher row from Supabase
    await supabaseAdmin.from('teachers').delete().eq('id', teacherId);
    // 3. Delete user row from Supabase (cascades timetable mappings)
    await supabaseAdmin.from('users').delete().eq('id', authUserId);
    // 4. Delete from Supabase Auth (revokes login access permanently)
    if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);

    // 5. Sync local cache
    mockDb.users = mockDb.users.filter(u => u.id !== authUserId);
    mockDb.teachers = mockDb.teachers.filter(t => t.id !== teacherId);
    mockDb.classes = mockDb.classes.map(c =>
      c.classTeacherId === teacherId ? { ...c, classTeacherId: undefined } : c
    );
    mockDb.addLog(adminId, 'DELETE_TEACHER', { teacherId, authUserId });
    mockDb.saveAll();
  },

  async adminDeleteStudent(adminId: string, studentId: string): Promise<void> {
    await delay(300);
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');
    const authUserId = student.userId;

    // 1. Delete parent-student mappings in Supabase
    await supabaseAdmin.from('parent_student_mapping').delete().eq('student_id', studentId);
    // 2. Delete student row from Supabase
    await supabaseAdmin.from('students').delete().eq('id', studentId);
    // 3. Delete user row from Supabase
    await supabaseAdmin.from('users').delete().eq('id', authUserId);
    // 4. Delete from Supabase Auth (revokes login access permanently)
    if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);

    // 5. Sync local cache
    mockDb.users = mockDb.users.filter(u => u.id !== authUserId);
    mockDb.students = mockDb.students.filter(s => s.id !== studentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.studentId !== studentId);
    mockDb.addLog(adminId, 'DELETE_STUDENT', { studentId, authUserId });
    mockDb.saveAll();
  },

  async adminDeleteParent(adminId: string, parentId: string): Promise<void> {
    await delay(300);
    const parent = mockDb.parents.find(p => p.id === parentId);
    if (!parent) throw new Error('Parent not found.');
    const authUserId = parent.userId;

    // 1. Delete parent-student mappings in Supabase
    await supabaseAdmin.from('parent_student_mapping').delete().eq('parent_id', parentId);
    // 2. Delete parent row from Supabase
    await supabaseAdmin.from('parents').delete().eq('id', parentId);
    // 3. Delete user row from Supabase
    await supabaseAdmin.from('users').delete().eq('id', authUserId);
    // 4. Delete from Supabase Auth (revokes login access permanently)
    if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);

    // 5. Sync local cache
    mockDb.users = mockDb.users.filter(u => u.id !== authUserId);
    mockDb.parents = mockDb.parents.filter(p => p.id !== parentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.parentId !== parentId);
    mockDb.addLog(adminId, 'DELETE_PARENT', { parentId, authUserId });
    mockDb.saveAll();
  },

  // ── Bulk Delete by Email ─────────────────────────────────────────────────────
  // Deletes any user (student/teacher/parent) by email from Supabase + auth + local cache.
  // Scoped to the calling admin's school for data isolation.
  async adminDeleteUserByEmail(adminId: string, email: string): Promise<{ deleted: boolean; role: string; message: string }> {
    await delay(300);

    // Fetch the target user from Supabase by email
    const { data: targetUser, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, role, school_id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (userErr || !targetUser) {
      return { deleted: false, role: 'UNKNOWN', message: `No user found with email: ${email}` };
    }

    const authUserId = targetUser.id;
    const role = targetUser.role as string;

    // 1. Role-specific cascade deletes in Supabase
    if (role === 'TEACHER') {
      const { data: teacherRow } = await supabaseAdmin.from('teachers').select('id').eq('user_id', authUserId).maybeSingle();
      if (teacherRow) {
        await supabaseAdmin.from('classes').update({ class_teacher_id: null }).eq('class_teacher_id', teacherRow.id);
        await supabaseAdmin.from('teacher_class_subject_mappings').delete().eq('teacher_id', teacherRow.id);
        await supabaseAdmin.from('teachers').delete().eq('id', teacherRow.id);
        mockDb.teachers = mockDb.teachers.filter(t => t.id !== teacherRow.id);
        mockDb.classes = mockDb.classes.map(c =>
          c.classTeacherId === teacherRow.id ? { ...c, classTeacherId: undefined } : c
        );
      }
    } else if (role === 'STUDENT') {
      const { data: studentRow } = await supabaseAdmin.from('students').select('id').eq('user_id', authUserId).maybeSingle();
      if (studentRow) {
        await supabaseAdmin.from('parent_student_mapping').delete().eq('student_id', studentRow.id);
        await supabaseAdmin.from('students').delete().eq('id', studentRow.id);
        mockDb.students = mockDb.students.filter(s => s.id !== studentRow.id);
        mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.studentId !== studentRow.id);
      }
    } else if (role === 'PARENT') {
      const { data: parentRow } = await supabaseAdmin.from('parents').select('id').eq('user_id', authUserId).maybeSingle();
      if (parentRow) {
        await supabaseAdmin.from('parent_student_mapping').delete().eq('parent_id', parentRow.id);
        await supabaseAdmin.from('parents').delete().eq('id', parentRow.id);
        mockDb.parents = mockDb.parents.filter(p => p.id !== parentRow.id);
        mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.parentId !== parentRow.id);
      }
    } else if (role === 'ADMIN') {
      // Admins are deleted directly from auth
    }

    // 2. Delete from public.users table
    await supabaseAdmin.from('users').delete().eq('id', authUserId);
    // 3. Delete from Supabase Auth (revokes login permanently)
    await supabaseAdmin.auth.admin.deleteUser(authUserId);

    // 4. Sync local cache
    mockDb.users = mockDb.users.filter(u => u.id !== authUserId);
    mockDb.addLog(adminId, 'DELETE_USER_BY_EMAIL', { email, role, authUserId });
    mockDb.saveAll();

    return { deleted: true, role, message: `${role} account (${email}) permanently deleted.` };
  },

  // ── Purge Orphaned Auth Users ────────────────────────────────────────────────
  // Finds auth.users entries for given emails (even when public.users is gone)
  // and permanently deletes them from auth. Fixes "email already registered" errors
  // caused by SQL-editor deletions that could not touch auth.users.
  async adminPurgeOrphanAuthByEmail(adminId: string, emails: string[]): Promise<{ email: string; purged: boolean; message: string }[]> {
    const results: { email: string; purged: boolean; message: string }[] = [];

    for (const email of emails) {
      const normalised = email.trim().toLowerCase();
      try {
        // List all auth users and find by email (Supabase admin API)
        const { data: { users: authUsers }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ perPage: 10000 });
        if (listErr) throw listErr;

        const match = authUsers.find(u => u.email?.toLowerCase() === normalised);
        if (!match) {
          results.push({ email: normalised, purged: false, message: 'No auth entry found — already clean.' });
          continue;
        }

        // Also clean up public.users if it somehow still exists
        await supabaseAdmin.from('users').delete().eq('id', match.id);

        // Delete from auth.users via admin API (bypasses SQL restrictions)
        const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(match.id);
        if (delErr) throw delErr;

        // Sync local cache
        mockDb.users = mockDb.users.filter(u => u.id !== match.id);
        mockDb.saveAll();

        results.push({ email: normalised, purged: true, message: `Auth entry deleted (id: ${match.id})` });
      } catch (err: any) {
        results.push({ email: normalised, purged: false, message: err.message || 'Failed' });
      }
    }

    mockDb.addLog(adminId, 'PURGE_ORPHAN_AUTH', { emails });
    return results;
  },

  async classTeacherCreateStudent(
    teacherId: string, 
    email: string, 
    firstName: string, 
    lastName: string, 
    classId: string, 
    admissionNumber: string, 
    rollNumber: number, 
    gender: 'MALE' | 'FEMALE' | 'OTHER', 
    dob: string,
    password?: string
  ): Promise<void> {
    await delay(600);
    await this.verifyClassTeacherHubSubscription(teacherId);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');

    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized: You are not the Class Teacher of this class.');
    }

    const schoolId = teacher.schoolId;

    // Verify system-wide uniqueness of Admission Number
    const { data: existingAdm } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('admission_number', admissionNumber)
      .maybeSingle();
    if (existingAdm) {
      throw new Error(`Registration failed: The admission number "${admissionNumber}" is already in use in the system.`);
    }

    // Verify uniqueness of Roll Number in the system
    const { data: existingRoll } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('roll_number', rollNumber)
      .maybeSingle();
    if (existingRoll) {
      throw new Error(`Registration failed: The roll number "${rollNumber}" is already in use in the system.`);
    }

    // Check limits
    const { data: school, error: schoolErr } = await supabaseAdmin.from('schools').select('subscription_plan').eq('id', schoolId).single();
    if (schoolErr || !school) throw new Error('School not found.');
    
    const plan = subscriptionPlans[school.subscription_plan] || subscriptionPlans.freemium;
    const { count: currentStudentsCount } = await supabaseAdmin
      .from('users').select('id', { count: 'exact', head: true })
      .eq('school_id', schoolId).eq('role', 'STUDENT');
    if ((currentStudentsCount ?? 0) >= plan.limits.maxStudents) {
      throw new Error(`Registration failed: Your ${school.subscription_plan} plan is limited to ${plan.limits.maxStudents} students. Please upgrade your subscription.`);
    }

    const pass = password || 'password';

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true
    });
    if (authError || !authData.user) throw new Error('Failed to create student auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email,
      role: 'STUDENT',
      first_name: firstName,
      last_name: lastName,
      phone: '',
      school_id: schoolId,
      is_active: true
    });
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create student database profile: ' + dbError.message);
    }

    // Resolve active academic session
    const activeSessionId = await this.resolveActiveSessionId(schoolId);

    // Insert into students table
    const { data: studentRow, error: studentErr } = await supabaseAdmin.from('students').insert({
      user_id: newUserId,
      school_id: schoolId,
      class_id: classId || null,
      academic_session_id: activeSessionId,
      admission_number: admissionNumber,
      roll_number: rollNumber,
      date_of_birth: dob || null,
      gender
    }).select('id').single();

    if (studentErr || !studentRow) {
      await supabaseAdmin.from('users').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create student record: ' + (studentErr?.message || 'Unknown error'));
    }

    const user: User = {
      id: newUserId, email, role: 'STUDENT', firstName, lastName,
      phone: '', avatarUrl: '', isActive: true, schoolId,
      password: pass, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const student: Student = {
      id: studentRow.id, userId: newUserId, schoolId, classId,
      academicSessionId: activeSessionId,
      admissionNumber, rollNumber, dateOfBirth: dob, gender,
      createdAt: new Date().toISOString()
    };
    mockDb.users.push(user);
    mockDb.students.push(student);
    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_CREATE_STUDENT', { studentName: `${firstName} ${lastName}`, email, classId });
    mockDb.saveAll();
  },

  async classTeacherCreateParent(
    teacherId: string, 
    email: string, 
    firstName: string, 
    lastName: string, 
    occupation: string, 
    address: string, 
    phone: string,
    studentId: string,
    admissionNumber: string,
    relationship: string,
    password?: string
  ): Promise<void> {
    await delay(600);
    await this.verifyClassTeacherHubSubscription(teacherId);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');

    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Selected student not found in registries.');
    
    const cls = mockDb.classes.find(c => c.id === student.classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized: This student does not belong to your managed class.');
    }

    if (student.admissionNumber.toLowerCase().trim() !== admissionNumber.toLowerCase().trim()) {
      throw new Error('Verification failed: Admission number does not match selected student.');
    }

    const schoolId = teacher.schoolId;

    const pass = password || 'password';
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: pass,
      email_confirm: true
    });
    if (authError || !authData.user) throw new Error('Failed to create parent auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email,
      role: 'PARENT',
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      school_id: schoolId,
      is_active: true
    });
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create parent database profile: ' + dbError.message);
    }

    // Insert into parents table
    const { data: parentRow, error: parentErr } = await supabaseAdmin.from('parents').insert({
      user_id: newUserId,
      school_id: schoolId,
      occupation: occupation || null,
      address: address || null
    }).select('id').single();

    if (parentErr || !parentRow) {
      await supabaseAdmin.from('users').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create parent record: ' + (parentErr?.message || 'Unknown error'));
    }

    // Map parent to student in Supabase parent_student_mapping table
    const { data: stSupabase } = await supabase.from('students').select('id').eq('user_id',
      student.userId
    ).single();
    const realStudentId = stSupabase?.id || studentId;

    await supabaseAdmin.from('parent_student_mapping').insert({
      parent_id: parentRow.id,
      student_id: realStudentId,
      relationship: relationship || 'Father'
    });

    const user: User = {
      id: newUserId, email, role: 'PARENT', firstName, lastName,
      phone, avatarUrl: '', isActive: true, schoolId,
      password: pass, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const parent: Parent = {
      id: parentRow.id, userId: newUserId, schoolId, occupation, address,
      createdAt: new Date().toISOString()
    };

    mockDb.users.push(user);
    mockDb.parents.push(parent);
    mockDb.parentStudentMappings.push({
      parentId: parentRow.id,
      studentId,
      relationship: relationship || 'Father'
    });

    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_CREATE_PARENT', { parentName: `${firstName} ${lastName}`, email, studentId });
    mockDb.saveAll();
  },

  async classTeacherDeleteStudent(teacherId: string, studentId: string): Promise<void> {
    await delay(300);
    await this.verifyClassTeacherHubSubscription(teacherId);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');
    
    const cls = mockDb.classes.find(c => c.id === student.classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized: You can only remove students from your own managed class.');
    }

    const authUserId = student.userId;

    // 1. Delete parent-student mappings in Supabase
    await supabaseAdmin.from('parent_student_mapping').delete().eq('student_id', studentId);
    // 2. Delete student row from Supabase
    await supabaseAdmin.from('students').delete().eq('id', studentId);
    // 3. Delete user row from Supabase
    await supabaseAdmin.from('users').delete().eq('id', authUserId);
    // 4. Delete from Supabase Auth (revokes login access permanently)
    if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);

    // 5. Sync local cache
    mockDb.users = mockDb.users.filter(u => u.id !== authUserId);
    mockDb.students = mockDb.students.filter(s => s.id !== studentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.studentId !== studentId);
    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_DELETE_STUDENT', { studentId });
    mockDb.saveAll();
  },

  async classTeacherDeleteParent(teacherId: string, parentId: string): Promise<void> {
    await delay(300);
    await this.verifyClassTeacherHubSubscription(teacherId);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');
    const parent = mockDb.parents.find(p => p.id === parentId);
    if (!parent) throw new Error('Parent not found.');
    
    const mappings = mockDb.parentStudentMappings.filter(m => m.parentId === parentId);
    const linkedToManagedClass = mappings.some(m => {
      const s = mockDb.students.find(st => st.id === m.studentId);
      return s && s.classId && mockDb.classes.some(c => c.id === s.classId && c.classTeacherId === teacherId);
    });
    
    if (!linkedToManagedClass) {
      throw new Error('Unauthorized: You can only remove parents whose children belong to your own managed class.');
    }

    const authUserId = parent.userId;

    // 1. Delete parent-student mappings in Supabase
    await supabaseAdmin.from('parent_student_mapping').delete().eq('parent_id', parentId);
    // 2. Delete parent row from Supabase
    await supabaseAdmin.from('parents').delete().eq('id', parentId);
    // 3. Delete user row from Supabase
    await supabaseAdmin.from('users').delete().eq('id', authUserId);
    // 4. Delete from Supabase Auth (revokes login access permanently)
    if (authUserId) await supabaseAdmin.auth.admin.deleteUser(authUserId);

    // 5. Sync local cache
    mockDb.users = mockDb.users.filter(u => u.id !== authUserId);
    mockDb.parents = mockDb.parents.filter(p => p.id !== parentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.parentId !== parentId);
    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_DELETE_PARENT', { parentId });
    mockDb.saveAll();
  },

  // ==========================================
  // INVOICING & BILLING LEDGER ADMIN CRUD
  // ==========================================

  async adminGetFeeStructures(): Promise<FeeStructure[]> {
    await delay();
    const schoolId = getAdminSchoolId();
    await this.syncFeeStructuresData(schoolId);
    return mockDb.feeStructures.filter(fs => fs.schoolId === schoolId);
  },

  async adminCreateFeeStructure(
    adminId: string,
    classId: string,
    amount: number,
    dueDate: string,
    description: string
  ): Promise<FeeStructure> {
    await delay(600);
    const schoolId = getAdminSchoolId();
    const activeSessionId = await this.resolveActiveSessionId(schoolId);

    // 1. Insert fee structure in Supabase
    const { data: dbStructure, error } = await supabaseAdmin.from('fee_structures').insert({
      school_id: schoolId,
      academic_session_id: activeSessionId,
      class_id: classId,
      amount,
      due_date: dueDate,
      description
    }).select('*').single();

    if (error || !dbStructure) {
      throw new Error('Failed to create fee invoice structure: ' + (error?.message || 'Unknown error'));
    }

    const newFs: FeeStructure = {
      id: dbStructure.id,
      schoolId: dbStructure.school_id,
      academicSessionId: dbStructure.academic_session_id,
      classId: dbStructure.class_id,
      amount: Number(dbStructure.amount),
      dueDate: dbStructure.due_date,
      description: dbStructure.description
    };
    mockDb.feeStructures.push(newFs);

    // 2. Automatically generate PENDING payment record for every student in this class
    const studentsInClass = mockDb.students.filter(s => s.classId === classId);
    if (studentsInClass.length > 0) {
      const paymentRows = studentsInClass.map(student => ({
        fee_structure_id: newFs.id,
        student_id: student.id,
        amount_paid: 0.00,
        status: 'PENDING'
      }));

      const { data: dbPayments, error: paymentErr } = await supabaseAdmin
        .from('fee_payments')
        .insert(paymentRows)
        .select('*');

      if (!paymentErr && dbPayments) {
        dbPayments.forEach((r: any) => {
          mockDb.feePayments.push({
            id: r.id,
            feeStructureId: r.fee_structure_id,
            studentId: r.student_id,
            amountPaid: Number(r.amount_paid),
            paymentDate: '',
            paymentMethod: '',
            status: 'PENDING',
            createdAt: r.created_at
          });
        });
      }
    }

    mockDb.addLog(adminId, 'CREATE_FEE_STRUCTURE', { classId, amount, description });
    mockDb.saveAll();
    return newFs;
  },

  async adminEditFeeStructure(
    adminId: string,
    id: string,
    amount: number,
    dueDate: string,
    description: string
  ): Promise<FeeStructure> {
    await delay(500);

    const { data: dbStructure, error } = await supabaseAdmin
      .from('fee_structures')
      .update({
        amount,
        due_date: dueDate,
        description
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error || !dbStructure) {
      throw new Error('Failed to update fee invoice structure: ' + (error?.message || 'Unknown error'));
    }

    const updated: FeeStructure = {
      id: dbStructure.id,
      schoolId: dbStructure.school_id,
      academicSessionId: dbStructure.academic_session_id,
      classId: dbStructure.class_id,
      amount: Number(dbStructure.amount),
      dueDate: dbStructure.due_date,
      description: dbStructure.description
    };

    const idx = mockDb.feeStructures.findIndex(fs => fs.id === id);
    if (idx !== -1) {
      mockDb.feeStructures[idx] = updated;
    }

    mockDb.addLog(adminId, 'EDIT_FEE_STRUCTURE', { id, amount, description });
    mockDb.saveAll();
    return updated;
  },

  async adminDeleteFeeStructure(adminId: string, id: string): Promise<void> {
    await delay(400);

    const { error } = await supabaseAdmin
      .from('fee_structures')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error('Failed to delete fee invoice structure: ' + error.message);
    }

    mockDb.feeStructures = mockDb.feeStructures.filter(fs => fs.id !== id);
    mockDb.feePayments = mockDb.feePayments.filter(fp => fp.feeStructureId !== id);

    mockDb.addLog(adminId, 'DELETE_FEE_STRUCTURE', { id });
    mockDb.saveAll();
  },

  async adminGetFeePayments(): Promise<FeePayment[]> {
    await delay();
    const schoolId = getAdminSchoolId();
    await this.syncFeePaymentsData(schoolId);
    
    const schoolClassIds = mockDb.classes.filter(c => c.schoolId === schoolId).map(c => c.id);
    const structuresList = mockDb.feeStructures.filter(fs => schoolClassIds.includes(fs.classId));
    const structureIds = structuresList.map(fs => fs.id);

    return mockDb.feePayments.filter(fp => structureIds.includes(fp.feeStructureId));
  },

  async adminRecordFeePayment(
    adminId: string,
    studentId: string,
    feeStructureId: string,
    amountPaid: number,
    method: string,
    transactionId: string,
    status: PaymentStatus
  ): Promise<FeePayment> {
    await delay(600);

    // Upsert payment into database using ON CONFLICT (fee_structure_id, student_id)
    const { data: dbPayment, error } = await supabaseAdmin
      .from('fee_payments')
      .upsert({
        fee_structure_id: feeStructureId,
        student_id: studentId,
        amount_paid: amountPaid,
        payment_date: new Date().toISOString(),
        payment_method: method,
        transaction_id: transactionId || undefined,
        status: status
      }, {
        onConflict: 'fee_structure_id,student_id'
      })
      .select('*')
      .single();

    if (error || !dbPayment) {
      throw new Error('Failed to record payment: ' + (error?.message || 'Unknown error'));
    }

    const recorded: FeePayment = {
      id: dbPayment.id,
      feeStructureId: dbPayment.fee_structure_id,
      studentId: dbPayment.student_id,
      amountPaid: Number(dbPayment.amount_paid),
      paymentDate: dbPayment.payment_date || '',
      paymentMethod: dbPayment.payment_method || '',
      transactionId: dbPayment.transaction_id || undefined,
      status: dbPayment.status as any,
      createdAt: dbPayment.created_at
    };

    const idx = mockDb.feePayments.findIndex(p => p.id === recorded.id || (p.studentId === studentId && p.feeStructureId === feeStructureId));
    if (idx === -1) {
      mockDb.feePayments.push(recorded);
    } else {
      mockDb.feePayments[idx] = recorded;
    }

    mockDb.addLog(adminId, 'RECORD_FEE_PAYMENT', { studentId, feeStructureId, amountPaid, status });
    mockDb.saveAll();
    return recorded;
  },


  // ==========================================
  // 6. SUPER ADMIN PORTAL ENDPOINTS (FULL ACCESS)
  // ==========================================

  async superAdminGetStats(superAdminId: string) {
    await delay(200);

    // Fetch live data from Supabase bypassing RLS using the admin client for Super Admin dashboard visibility
    const { count: schoolCount } = await supabaseAdmin.from('schools').select('*', { count: 'exact', head: true });
    const { count: userCount } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });
    const { data: schoolsData } = await supabaseAdmin.from('schools').select('*');
    const { data: adminsData } = await supabaseAdmin.from('users').select('*').eq('role', 'ADMIN');

    const mappedSchools = (schoolsData || []).map(s => ({
      id: s.id,
      name: s.name,
      address: s.address,
      phone: s.phone,
      subscriptionPlan: s.subscription_plan,
      createdAt: s.created_at
    }));

    const mappedAdmins = (adminsData || []).map(a => ({
      id: a.id,
      email: a.email,
      firstName: a.first_name,
      lastName: a.last_name,
      phone: a.phone,
      schoolId: a.school_id,
      role: a.role,
      isActive: a.is_active
    }));

    return {
      totalSchools: schoolCount || 0,
      totalUsers: userCount || 0,
      totalSubscriptionsIncome: 0, 
      activeSessions: getSystemTelemetry().activeSessions,
      systemTelemetry: getSystemTelemetry(),
      schoolsList: mappedSchools,
      adminsList: mappedAdmins
    };
  },

  async superAdminGetAuditLogs(superAdminId: string, query = ''): Promise<(AuditLog & { userName: string; userEmail: string })[]> {
    await delay(300);
    // Left as mockDb for now until audit logs are moved to Supabase
    let filtered = [...mockDb.auditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (query) {
      filtered = filtered.filter(log => 
        log.action.toLowerCase().includes(query.toLowerCase()) || 
        log.userId?.toLowerCase().includes(query.toLowerCase())
      );
    }

    return filtered.map(log => {
      const u = mockDb.users.find(x => x.id === log.userId);
      return {
        ...log,
        userName: u ? `${u.firstName} ${u.lastName}` : 'System',
        userEmail: u?.email || 'system@aegis.com'
      };
    });
  },

  async superAdminCreateSchool(superAdminId: string, name: string, address: string, phone: string, subscription: string): Promise<School> {
    const { data, error } = await supabaseAdmin.from('schools').insert({
      name,
      address,
      phone,
      subscription_plan: subscription
    }).select().single();

    if (error || !data) throw new Error('Failed to create school in database: ' + (error?.message || 'Unknown error'));

    return {
      id: data.id,
      name: data.name,
      address: data.address,
      phone: data.phone,
      subscriptionPlan: data.subscription_plan as any,
      createdAt: data.created_at
    };
  },

  async superAdminCreateAdmin(superAdminId: string, email: string, firstName: string, lastName: string, schoolId: string, phone: string, password: string): Promise<void> {
    // 0. Validate that the school actually exists in Supabase before inserting
    const { data: schoolCheck, error: schoolCheckError } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('id', schoolId)
      .single();

    if (schoolCheckError || !schoolCheck) {
      throw new Error(
        'The selected institution does not exist in the database. ' +
        'Please refresh the page and try again — the school list may be out of sync.'
      );
    }

    // 1. Create auth user with the provided password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) throw new Error('Failed to create admin auth user: ' + (authError?.message || 'Unknown error'));

    // 2. Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      role: 'ADMIN',
      first_name: firstName,
      last_name: lastName,
      phone,
      school_id: schoolId,
      is_active: true
    });

    if (dbError) {
      // Rollback: remove the auth user if the DB insert failed
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Failed to create admin user profile: ' + dbError.message);
    }
  },

  async superAdminDeleteSchool(superAdminId: string, schoolId: string): Promise<void> {
    // 1. Fetch all public users associated with the school
    const { data: usersToDel, error: fetchErr } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('school_id', schoolId);

    if (fetchErr) throw new Error('Failed to fetch school users for deletion: ' + fetchErr.message);

    // 2. Delete each user cleanly from Supabase Auth
    if (usersToDel && usersToDel.length > 0) {
      for (const u of usersToDel) {
        const { error: authDelErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
        if (authDelErr) {
          console.warn(`Could not delete auth user ${u.id}: ${authDelErr.message}`);
        }
      }
    }

    // 3. Delete the school itself (propagates via database CASCADE DELETE)
    const { error } = await supabaseAdmin.from('schools').delete().eq('id', schoolId);
    if (error) throw new Error('Failed to delete school: ' + error.message);

    // 4. Sync local mockDb cache to keep UI perfectly synchronized
    const deletedUserIds = mockDb.users.filter(u => u.schoolId === schoolId).map(u => u.id);
    const deletedStudentIds = mockDb.students.filter(s => s.schoolId === schoolId).map(s => s.id);
    const deletedTeacherIds = mockDb.teachers.filter(t => t.schoolId === schoolId).map(t => t.id);
    const deletedParentIds = mockDb.parents.filter(p => p.schoolId === schoolId).map(p => p.id);
    const deletedClassIds = mockDb.classes.filter(c => c.schoolId === schoolId).map(c => c.id);
    const deletedSubjectIds = mockDb.subjects.filter(s => s.schoolId === schoolId).map(s => s.id);
    const deletedQuizIds = mockDb.quizzes.filter(q => deletedSubjectIds.includes(q.subjectId)).map(q => q.id);
    const deletedExamIds = mockDb.exams.filter(e => e.schoolId === schoolId).map(e => e.id);
    const deletedForumCategoryIds = mockDb.forumCategories.filter(c => c.schoolId === schoolId).map(c => c.id);
    const deletedFeeStructureIds = mockDb.feeStructures.filter(fs => fs.schoolId === schoolId).map(fs => fs.id);

    mockDb.schools = mockDb.schools.filter(s => s.id !== schoolId);
    mockDb.users = mockDb.users.filter(u => u.schoolId !== schoolId);
    mockDb.teachers = mockDb.teachers.filter(t => t.schoolId !== schoolId);
    mockDb.students = mockDb.students.filter(s => s.schoolId !== schoolId);
    mockDb.parents = mockDb.parents.filter(p => p.schoolId !== schoolId);
    mockDb.academicSessions = mockDb.academicSessions.filter(as => as.schoolId !== schoolId);
    mockDb.classes = mockDb.classes.filter(c => c.schoolId !== schoolId);
    mockDb.subjects = mockDb.subjects.filter(s => s.schoolId !== schoolId);
    mockDb.assignments = mockDb.assignments.filter(a => !deletedClassIds.includes(a.classId));
    mockDb.quizzes = mockDb.quizzes.filter(q => !deletedQuizIds.includes(q.id));
    mockDb.exams = mockDb.exams.filter(e => e.schoolId !== schoolId);
    mockDb.forumCategories = mockDb.forumCategories.filter(fc => fc.schoolId !== schoolId);
    mockDb.feeStructures = mockDb.feeStructures.filter(fs => fs.schoolId !== schoolId);
    mockDb.studyMaterials = mockDb.studyMaterials.filter(sm => !deletedSubjectIds.includes(sm.subjectId));
    mockDb.announcements = mockDb.announcements.filter(a => a.schoolId !== schoolId);

    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(
      m => !deletedParentIds.includes(m.parentId) && !deletedStudentIds.includes(m.studentId)
    );
    mockDb.teacherClassSubjectMappings = mockDb.teacherClassSubjectMappings.filter(
      m => !deletedTeacherIds.includes(m.teacherId) && !deletedClassIds.includes(m.classId)
    );
    mockDb.timetables = mockDb.timetables.filter(t => !deletedClassIds.includes(t.classId));
    mockDb.attendance = mockDb.attendance.filter(a => !deletedStudentIds.includes(a.studentId));
    mockDb.assignmentSubmissions = mockDb.assignmentSubmissions.filter(sub => !deletedStudentIds.includes(sub.studentId));
    mockDb.quizQuestions = mockDb.quizQuestions.filter(q => !deletedQuizIds.includes(q.quizId));
    mockDb.quizAttempts = mockDb.quizAttempts.filter(qa => !deletedStudentIds.includes(qa.studentId));
    
    const deletedExamScheduleIds = mockDb.examSchedules.filter(es => deletedExamIds.includes(es.examId) || deletedClassIds.includes(es.classId)).map(es => es.id);
    mockDb.examSchedules = mockDb.examSchedules.filter(es => !deletedExamScheduleIds.includes(es.id));
    mockDb.examMarks = mockDb.examMarks.filter(em => !deletedStudentIds.includes(em.studentId) && !deletedExamScheduleIds.includes(em.examScheduleId));

    mockDb.feePayments = mockDb.feePayments.filter(
      fp => !deletedStudentIds.includes(fp.studentId) && !deletedFeeStructureIds.includes(fp.feeStructureId)
    );

    const deletedForumPostIds = mockDb.forumPosts.filter(p => deletedForumCategoryIds.includes(p.categoryId) || deletedUserIds.includes(p.authorId)).map(p => p.id);
    mockDb.forumPosts = mockDb.forumPosts.filter(p => !deletedForumPostIds.includes(p.id));
    mockDb.forumReplies = mockDb.forumReplies.filter(r => !deletedForumPostIds.includes(r.postId) && !deletedUserIds.includes(r.authorId));

    mockDb.notifications = mockDb.notifications.filter(n => !deletedUserIds.includes(n.userId));
    mockDb.chatMessages = mockDb.chatMessages.filter(
      m => !deletedUserIds.includes(m.senderId) && !deletedUserIds.includes(m.receiverId)
    );

    mockDb.auditLogs = mockDb.auditLogs.filter(log => !log.userId || !deletedUserIds.includes(log.userId));

    mockDb.saveAll();
  },

  async superAdminUpdateSchoolSubscription(superAdminId: string, schoolId: string, subscriptionPlan: string): Promise<void> {
    const { error } = await supabaseAdmin.from('schools').update({ subscription_plan: subscriptionPlan }).eq('id', schoolId);
    if (error) throw new Error('Failed to update school subscription: ' + error.message);
    
    // Sync local mockDb schools cache
    const idx = mockDb.schools.findIndex(s => s.id === schoolId);
    if (idx !== -1) {
      mockDb.schools[idx].subscriptionPlan = subscriptionPlan.toLowerCase() as any;
      mockDb.saveAll();
    }
  },

  async superAdminDeleteAdmin(superAdminId: string, adminUserId: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(adminUserId);
    if (error) throw new Error('Failed to delete admin: ' + error.message);
  },

  async superAdminResetPassword(superAdminId: string, targetUserId: string, newPasswordPlain: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: newPasswordPlain });
    if (error) throw new Error('Failed to reset password: ' + error.message);
  },

  async adminResetPassword(adminId: string, targetUserId: string, newPasswordPlain: string): Promise<void> {
    await delay(500);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || admin.role !== 'ADMIN') throw new Error('Unauthorized operational context.');

    const target = mockDb.users.find(u => u.id === targetUserId);
    if (!target) throw new Error('User not found');

    // Strict multi-school scoped isolation boundary check
    if (target.schoolId !== admin.school_id) {
      mockDb.addLog(adminId, 'SECURITY_VIOLATION', { action: 'RESET_PASSWORD_OUT_OF_SCOPE', targetUserId });
      throw new Error('Access Denied: You can only reset passwords for users in your own school.');
    }

    // Securely update password in Supabase Auth as well
    const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: newPasswordPlain });
    if (resetErr) throw new Error('Failed to securely update auth password: ' + resetErr.message);

    target.password = newPasswordPlain;
    target.updatedAt = new Date().toISOString();

    mockDb.addLog(adminId, 'RESET_PASSWORD', { targetEmail: target.email, targetRole: target.role });
    mockDb.saveAll();
  },



  async classTeacherGetManagedClasses(teacherId: string): Promise<Class[]> {
    await delay();
    await this.teacherSyncData(teacherId);
    return mockDb.classes.filter(c => c.classTeacherId === teacherId);
  },

  async classTeacherGetExams(schoolId: string): Promise<Exam[]> {
    await delay();
    await this.syncExamsData(schoolId);
    
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    mockDb.exams = mockDb.exams.filter(e => isUUID(e.id));

    let exams = mockDb.exams.filter(e => e.schoolId === schoolId);
    if (exams.length === 0) {
      const activeSession = mockDb.academicSessions.find(s => s.schoolId === schoolId && s.isCurrent);
      const sessionId = activeSession && isUUID(activeSession.id) ? activeSession.id : null;

      try {
        const { data: dbExam, error } = await supabaseAdmin.from('exams').insert({
          school_id: schoolId,
          academic_session_id: sessionId,
          name: 'Term 1 Assessments',
          start_date: '2026-10-10',
          end_date: '2026-10-20'
        }).select().single();

        if (error) {
          console.error('Failed to create default exam in Supabase:', error.message);
        } else if (dbExam) {
          const newExam: Exam = {
            id: dbExam.id,
            schoolId: dbExam.school_id,
            academicSessionId: dbExam.academic_session_id || 'session-1',
            name: dbExam.name,
            startDate: dbExam.start_date,
            endDate: dbExam.end_date
          };
          mockDb.exams.push(newExam);
          mockDb.saveAll();
          exams = [newExam];
        }
      } catch (err) {
        console.error('Failed to save default exam in database:', err);
      }
    }
    return exams;
  },

  async classTeacherGetStudentReportCard(
    teacherId: string, 
    classId: string, 
    studentId: string, 
    examId: string
  ): Promise<{ scheduleId: string; subjectId: string; subjectName: string; maxMarks: number; marksObtained?: number; remarks?: string }[]> {
    await delay();
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized operational context: You are not the Class Teacher of this class.');
    }

    await this.syncExamsData(cls.schoolId);
    await this.syncExamSchedulesData(cls.schoolId);
    await this.syncExamMarksData(cls.schoolId);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    mockDb.examSchedules = mockDb.examSchedules.filter(s => isUUID(s.id));

    let schedules = mockDb.examSchedules.filter(s => s.examId === examId && s.classId === classId);
    if (schedules.length === 0) {
      const subjects = mockDb.subjects.filter(s => s.schoolId === cls.schoolId);
      const defaultSchedules = subjects.slice(0, 3).map((sub, idx) => ({
        exam_id: examId,
        class_id: classId,
        subject_id: sub.id,
        date: '2026-10-' + (10 + idx).toString(),
        start_time: '09:00',
        end_time: '12:00',
        classroom: 'Main Hall',
        max_marks: 100
      }));

      for (const dSched of defaultSchedules) {
        try {
          const { data: dbSched, error } = await supabaseAdmin.from('exam_schedules').insert(dSched).select().single();
          if (error) {
            console.error('Failed to create default exam schedule in Supabase:', error.message);
          } else if (dbSched) {
            const sched: ExamSchedule = {
              id: dbSched.id,
              examId: dbSched.exam_id,
              classId: dbSched.class_id,
              subjectId: dbSched.subject_id,
              examDate: dbSched.date,
              startTime: dbSched.start_time || '',
              endTime: dbSched.end_time || '',
              classroom: dbSched.classroom || '',
              maxMarks: dbSched.max_marks
            };
            mockDb.examSchedules.push(sched);
          }
        } catch (err) {
          console.error('Failed to save exam schedule in database:', err);
        }
      }
      mockDb.saveAll();
      schedules = mockDb.examSchedules.filter(s => s.examId === examId && s.classId === classId);
    }
    return schedules.map(sched => {
      const subject = mockDb.subjects.find(s => s.id === sched.subjectId);
      const mark = mockDb.examMarks.find(m => m.examScheduleId === sched.id && m.studentId === studentId);
      return {
        scheduleId: sched.id,
        subjectId: sched.subjectId,
        subjectName: subject?.name || 'Unknown Subject',
        maxMarks: sched.maxMarks,
        marksObtained: mark?.marksObtained,
        remarks: mark?.remarks
      };
    });
  },

  async classTeacherSaveStudentReportCard(
    teacherId: string,
    classId: string,
    studentId: string,
    marksData: { scheduleId: string; marksObtained: number; remarks: string }[]
  ): Promise<void> {
    await delay(300);
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized operational context: You are not the Class Teacher of this class.');
    }

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    mockDb.examMarks = mockDb.examMarks.filter(m => isUUID(m.id));

    for (const data of marksData) {
      try {
        const { data: dbMarkRecord } = await supabaseAdmin
          .from('exam_marks')
          .select('id')
          .eq('exam_schedule_id', data.scheduleId)
          .eq('student_id', studentId);
        
        if (dbMarkRecord && dbMarkRecord.length > 0) {
          await supabaseAdmin
            .from('exam_marks')
            .update({
              marks_obtained: data.marksObtained,
              remarks: data.remarks,
              graded_by: teacherId
            })
            .eq('id', dbMarkRecord[0].id);
        } else {
          await supabaseAdmin
            .from('exam_marks')
            .insert({
              exam_schedule_id: data.scheduleId,
              student_id: studentId,
              marks_obtained: data.marksObtained,
              remarks: data.remarks,
              graded_by: teacherId
            });
        }
      } catch (err) {
        console.error('Failed to save exam mark in database:', err);
      }
    }
    mockDb.addLog(mockDb.teachers.find(t => t.id === teacherId)?.userId || null, 'CLASS_TEACHER_UPDATE_REPORT_CARD', { classId, studentId });
    mockDb.saveAll();

    await this.syncExamMarksData(cls.schoolId);
  },


  async teacherCreateTimetableEntry(
    teacherId: string, 
    classId: string, 
    subjectId: string, 
    dayOfWeek: number, 
    startTime: string, 
    endTime: string, 
    classroomNumber: string
  ): Promise<void> {
    await delay(300);

    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');

    const mappingExists = mockDb.teacherClassSubjectMappings.some(
      m => m.teacherId === teacherId && m.classId === classId && m.subjectId === subjectId
    );
    if (!mappingExists) {
      throw new Error('Unauthorized: You are not assigned to teach this subject for this class.');
    }

    try {
      const academicSessionId = await this.resolveActiveSessionId(teacher.schoolId);

      const { data: dbTt, error } = await supabaseAdmin
        .from('timetables')
        .insert({
          class_id: classId,
          subject_id: subjectId,
          teacher_id: teacherId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          classroom_number: classroomNumber,
          academic_session_id: academicSessionId
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to create timetable in database.');
      } else if (dbTt) {
        const newEntry: Timetable = {
          id: dbTt.id,
          classId: dbTt.class_id,
          subjectId: dbTt.subject_id,
          teacherId: dbTt.teacher_id,
          dayOfWeek: dbTt.day_of_week,
          startTime: dbTt.start_time,
          endTime: dbTt.end_time,
          classroomNumber: dbTt.classroom_number || undefined,
          academicSessionId: dbTt.academic_session_id || academicSessionId
        };
        mockDb.timetables.push(newEntry);
        mockDb.addLog(teacher.userId, 'TEACHER_CREATE_TIMETABLE', { classId, timetableId: newEntry.id });
        mockDb.saveAll();
      }
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Failed to save timetable in database.');
    }
  },

  async teacherDeleteTimetableEntry(teacherId: string, timetableId: string): Promise<void> {
    await delay(300);

    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isUUID(timetableId)) {
      try {
        const { error } = await supabaseAdmin
          .from('timetables')
          .delete()
          .eq('id', timetableId);

        if (error) {
          throw new Error(error.message || 'Failed to delete timetable entry from database.');
        }
      } catch (err: any) {
        console.error(err);
        throw new Error(err.message || 'Failed to delete timetable entry from database.');
      }
    }

    const ttIdx = mockDb.timetables.findIndex(t => t.id === timetableId);
    if (ttIdx !== -1) {
      const tt = mockDb.timetables[ttIdx];
      mockDb.timetables.splice(ttIdx, 1);
      mockDb.addLog(teacher.userId, 'TEACHER_DELETE_TIMETABLE', { classId: tt.classId, timetableId });
      mockDb.saveAll();
    }
  },

  async classTeacherCreateTimetableEntry(
    teacherId: string, 
    classId: string, 
    subjectId: string, 
    assignedTeacherId: string, 
    dayOfWeek: number, 
    startTime: string, 
    endTime: string, 
    classroomNumber: string
  ): Promise<void> {
    await delay(300);
    await this.verifyClassTeacherHubSubscription(teacherId);

    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized operational context: You are not the Class Teacher of this class.');
    }

    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validTeacherId = assignedTeacherId && isUUID(assignedTeacherId) ? assignedTeacherId : null;

    try {
      const academicSessionId = await this.resolveActiveSessionId(teacher.schoolId);

      const { data: dbTt, error } = await supabaseAdmin
        .from('timetables')
        .insert({
          class_id: classId,
          subject_id: subjectId,
          teacher_id: validTeacherId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          classroom_number: classroomNumber,
          academic_session_id: academicSessionId
        })
        .select()
        .single();

      if (error) {
        throw new Error(error.message || 'Failed to save class timetable in database.');
      } else if (dbTt) {
        const newEntry: Timetable = {
          id: dbTt.id,
          classId: dbTt.class_id,
          subjectId: dbTt.subject_id,
          teacherId: dbTt.teacher_id,
          dayOfWeek: dbTt.day_of_week,
          startTime: dbTt.start_time,
          endTime: dbTt.end_time,
          classroomNumber: dbTt.classroom_number || undefined,
          academicSessionId: dbTt.academic_session_id || academicSessionId
        };
        mockDb.timetables.push(newEntry);
        mockDb.addLog(teacher.userId, 'CLASS_TEACHER_CREATE_TIMETABLE', { classId, timetableId: newEntry.id });
        mockDb.saveAll();
      }
    } catch (err: any) {
      console.error(err);
      throw new Error(err.message || 'Failed to save class timetable in database.');
    }
  },

  async classTeacherDeleteTimetableEntry(teacherId: string, timetableId: string): Promise<void> {
    await delay(300);
    await this.verifyClassTeacherHubSubscription(teacherId);

    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

    if (isUUID(timetableId)) {
      try {
        const { error } = await supabaseAdmin
          .from('timetables')
          .delete()
          .eq('id', timetableId);

        if (error) {
          throw new Error(error.message || 'Failed to delete class timetable entry from database.');
        }
      } catch (err: any) {
        console.error(err);
        throw new Error(err.message || 'Failed to delete class timetable entry from database.');
      }
    }

    const ttIdx = mockDb.timetables.findIndex(t => t.id === timetableId);
    if (ttIdx !== -1) {
      const tt = mockDb.timetables[ttIdx];
      mockDb.timetables.splice(ttIdx, 1);
      mockDb.addLog(teacher.userId, 'CLASS_TEACHER_DELETE_TIMETABLE', { classId: tt.classId, timetableId });
      mockDb.saveAll();
    }
  },
  
  async classTeacherUpdateTimetableEntry(
    teacherId: string, 
    timetableId: string,
    classId: string,
    subjectId: string, 
    assignedTeacherId: string, 
    dayOfWeek: number, 
    startTime: string, 
    endTime: string, 
    classroomNumber: string
  ): Promise<void> {
    await delay(300);
    await this.verifyClassTeacherHubSubscription(teacherId);

    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized operational context: You are not the Class Teacher of this class.');
    }

    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher profile not found.');

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validTeacherId = assignedTeacherId && isUUID(assignedTeacherId) ? assignedTeacherId : null;

    if (isUUID(timetableId)) {
      try {
        const { error } = await supabaseAdmin
          .from('timetables')
          .update({
            subject_id: subjectId,
            teacher_id: validTeacherId,
            day_of_week: dayOfWeek,
            start_time: startTime,
            end_time: endTime,
            classroom_number: classroomNumber
          })
          .eq('id', timetableId);

        if (error) {
          throw new Error(error.message || 'Failed to update class timetable in database.');
        }
      } catch (err: any) {
        console.error(err);
        throw new Error(err.message || 'Failed to update class timetable in database.');
      }
    }

    const ttIdx = mockDb.timetables.findIndex(t => t.id === timetableId);
    if (ttIdx !== -1) {
      mockDb.timetables[ttIdx] = {
        ...mockDb.timetables[ttIdx],
        subjectId,
        teacherId: validTeacherId,
        dayOfWeek,
        startTime,
        endTime,
        classroomNumber
      };
      mockDb.addLog(teacher.userId, 'CLASS_TEACHER_UPDATE_TIMETABLE', { classId, timetableId });
      mockDb.saveAll();
    }

    await this.syncTimetablesData(teacher.schoolId);
  },

  // ==========================================
  // 7. GENERAL SHARED PORTAL SERVICES (DISCUSSION / FEED)
  // ==========================================

  async getAnnouncements(role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN'): Promise<Announcement[]> {
    await delay();
    return mockDb.announcements.filter(a => a.targetRoles.includes(role));
  },

  async getForumCategories(schoolId?: string): Promise<ForumCategory[]> {
    await delay();
    if (schoolId) {
      return mockDb.forumCategories.filter(c => c.schoolId === schoolId);
    }
    return mockDb.forumCategories;
  },

  async getForumPosts(): Promise<(ForumPost & { schoolId: string; authorName: string; categoryName: string; repliesCount: number })[]> {
    await delay();
    return mockDb.forumPosts.map(p => {
      const u = mockDb.users.find(usr => usr.id === p.authorId);
      const cat = mockDb.forumCategories.find(c => c.id === p.categoryId);
      const reps = mockDb.forumReplies.filter(r => r.postId === p.id).length;
      return {
        ...p,
        schoolId: cat ? cat.schoolId : '',
        authorName: u ? `${u.firstName} ${u.lastName}` : 'Aegis Scholar',
        categoryName: cat ? cat.name : 'General Discussion',
        repliesCount: reps
      };
    });
  },

  async getForumPostReplies(postId: string): Promise<(ForumReply & { authorName: string; authorAvatar: string; authorRole: string })[]> {
    await delay();
    return mockDb.forumReplies
      .filter(r => r.postId === postId)
      .map(r => {
        const u = mockDb.users.find(usr => usr.id === r.authorId);
        return {
          ...r,
          authorName: u ? `${u.firstName} ${u.lastName}` : 'Aegis Scholar',
          authorAvatar: u?.avatarUrl || '',
          authorRole: u?.role || 'STUDENT'
        };
      });
  },

  async createForumCategory(
    schoolId: string,
    name: string,
    description: string,
    classId?: string | null,
    subjectId?: string | null,
    academicSessionId?: string | null
  ): Promise<ForumCategory> {
    await delay(300);
    const activeSessionId = academicSessionId || await this.resolveActiveSessionId(schoolId);

    const { data: r, error } = await supabaseAdmin
      .from('forum_categories')
      .insert([{
        school_id: schoolId,
        class_id: classId || null,
        subject_id: subjectId || null,
        academic_session_id: activeSessionId,
        name,
        description
      }])
      .select()
      .single();

    if (error || !r) {
      throw new Error(error ? error.message : 'Failed to establish discussion forum category');
    }

    const cat: ForumCategory = {
      id: r.id,
      schoolId: r.school_id,
      classId: r.class_id || null,
      subjectId: r.subject_id || null,
      academicSessionId: r.academic_session_id || null,
      name: r.name,
      description: r.description
    };

    mockDb.forumCategories.unshift(cat);
    mockDb.saveAll();
    return cat;
  },

  async updateForumCategory(
    id: string,
    name: string,
    description: string,
    classId?: string | null,
    subjectId?: string | null
  ): Promise<ForumCategory> {
    await delay(300);
    const { data: r, error } = await supabaseAdmin
      .from('forum_categories')
      .update({
        name,
        description,
        class_id: classId || null,
        subject_id: subjectId || null
      })
      .eq('id', id)
      .select()
      .single();

    if (error || !r) {
      throw new Error(error ? error.message : 'Failed to update discussion board details');
    }

    const cat: ForumCategory = {
      id: r.id,
      schoolId: r.school_id,
      classId: r.class_id || null,
      subjectId: r.subject_id || null,
      academicSessionId: r.academic_session_id || null,
      name: r.name,
      description: r.description
    };

    const idx = mockDb.forumCategories.findIndex(c => c.id === id);
    if (idx !== -1) {
      mockDb.forumCategories[idx] = cat;
    } else {
      mockDb.forumCategories.unshift(cat);
    }
    mockDb.saveAll();
    return cat;
  },

  async deleteForumCategory(id: string): Promise<void> {
    await delay(300);
    const { error } = await supabaseAdmin
      .from('forum_categories')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error(error.message);
    }

    mockDb.forumCategories = mockDb.forumCategories.filter(c => c.id !== id);
    const postIdsToDelete = mockDb.forumPosts.filter(p => p.categoryId === id).map(p => p.id);
    mockDb.forumPosts = mockDb.forumPosts.filter(p => p.categoryId !== id);
    mockDb.forumReplies = mockDb.forumReplies.filter(r => !postIdsToDelete.includes(r.postId));
    mockDb.saveAll();
  },

  async createForumPost(authorId: string, title: string, content: string, categoryId: string): Promise<void> {
    await delay(300);

    if (!categoryId) {
      throw new Error('Please select a discussion category first.');
    }

    const user = mockDb.users.find(u => u.id === authorId);
    if (user && user.schoolId) {
      const school = mockDb.schools.find(s => s.id === user.schoolId);
      if (school) {
        const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
        if (!plan.features.communications) {
          throw new Error(`Communications feature is not enabled on your ${school.subscriptionPlan} plan.`);
        }
      }
    }

    const activeSessionId = await this.resolveActiveSessionId(user?.schoolId || '');

    const { data: r, error } = await supabaseAdmin
      .from('forum_posts')
      .insert([{
        category_id: categoryId,
        author_id: authorId,
        title,
        content,
        academic_session_id: activeSessionId
      }])
      .select()
      .single();

    if (error || !r) {
      throw new Error(error ? error.message : 'Failed to publish discussion thread');
    }

    const post: ForumPost = {
      id: r.id,
      categoryId: r.category_id,
      authorId: r.author_id,
      title: r.title,
      content: r.content,
      academicSessionId: r.academic_session_id || activeSessionId,
      createdAt: r.created_at
    };

    mockDb.forumPosts.unshift(post);
    mockDb.saveAll();
  },

  async replyToForumPost(authorId: string, postId: string, content: string): Promise<void> {
    await delay(300);

    const user = mockDb.users.find(u => u.id === authorId);
    if (user && user.schoolId) {
      const school = mockDb.schools.find(s => s.id === user.schoolId);
      if (school) {
        const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
        if (!plan.features.communications) {
          throw new Error(`Communications feature is not enabled on your ${school.subscriptionPlan} plan.`);
        }
      }
    }

    const activeSessionId = await this.resolveActiveSessionId(user?.schoolId || '');

    const { data: r, error } = await supabaseAdmin
      .from('forum_replies')
      .insert([{
        post_id: postId,
        author_id: authorId,
        content,
        academic_session_id: activeSessionId
      }])
      .select()
      .single();

    if (error || !r) {
      throw new Error(error ? error.message : 'Failed to post reply');
    }

    const rep: ForumReply = {
      id: r.id,
      postId: r.post_id,
      authorId: r.author_id,
      content: r.content,
      academicSessionId: r.academic_session_id || activeSessionId,
      createdAt: r.created_at
    };

    mockDb.forumReplies.push(rep);
    mockDb.saveAll();
  },

  async getChatInbox(userId: string): Promise<(User & { lastMessage?: string; unreadCount: number })[]> {
    await delay();

    const currentUsr = mockDb.users.find(u => u.id === userId);
    if (!currentUsr) return [];

    let allowedContactUserIds: string[] = [];

    // Filter contacts based on role contexts (Strict boundary checking)
    if (currentUsr.role === 'TEACHER') {
      const teacher = mockDb.teachers.find(t => t.userId === userId);
      const teacherClasses = mockDb.teacherClassSubjectMappings
        .filter(m => m.teacherId === teacher?.id)
        .map(m => m.classId);

      const studentUsers = mockDb.students
        .filter(s => s.classId && teacherClasses.includes(s.classId))
        .map(s => s.userId);

      const studentIds = mockDb.students
        .filter(s => s.classId && teacherClasses.includes(s.classId))
        .map(s => s.id);

      const parentIds = mockDb.parentStudentMappings
        .filter(m => studentIds.includes(m.studentId))
        .map(m => m.parentId);

      const parentUsers = mockDb.parents
        .filter(p => parentIds.includes(p.id))
        .map(p => p.userId);

      allowedContactUserIds = [...studentUsers, ...parentUsers];
    } else if (currentUsr.role === 'STUDENT') {
      const student = mockDb.students.find(s => s.userId === userId);
      const studentClass = student?.classId;
      
      const teacherIds = mockDb.teacherClassSubjectMappings
        .filter(m => m.classId === studentClass)
        .map(m => m.teacherId);

      allowedContactUserIds = mockDb.teachers
        .filter(t => teacherIds.includes(t.id))
        .map(t => t.userId);
    } else if (currentUsr.role === 'PARENT') {
      const parent = mockDb.parents.find(p => p.userId === userId);
      const studentIds = mockDb.parentStudentMappings
        .filter(m => m.parentId === parent?.id)
        .map(m => m.studentId);

      const classIds = mockDb.students
        .filter(s => studentIds.includes(s.id) && s.classId)
        .map(s => s.classId as string);

      const teacherIds = mockDb.teacherClassSubjectMappings
        .filter(m => classIds.includes(m.classId))
        .map(m => m.teacherId);

      allowedContactUserIds = mockDb.teachers
        .filter(t => teacherIds.includes(t.id))
        .map(t => t.userId);
    } else {
      // Admins & Super Admins can converse globally
      allowedContactUserIds = mockDb.users.map(u => u.id);
    }

    // Always include any user who has an active message history to avoid empty chat screens
    const historyUserIds = mockDb.chatMessages
      .filter(m => m.senderId === userId || m.receiverId === userId)
      .map(m => m.senderId === userId ? m.receiverId : m.senderId);

    const mergedUserIds = Array.from(new Set([...allowedContactUserIds, ...historyUserIds])).filter(id => id !== userId);
    const chats = mockDb.users.filter(u => mergedUserIds.includes(u.id));

    return chats.map(u => {
      const msgs = mockDb.chatMessages.filter(
        m => (m.senderId === userId && m.receiverId === u.id) || (m.senderId === u.id && m.receiverId === userId)
      ).sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1].message : undefined;
      const unread = mockDb.chatMessages.filter(m => m.senderId === u.id && m.receiverId === userId && !m.isRead).length;

      return {
        ...u,
        lastMessage: lastMsg,
        unreadCount: unread
      };
    });
  },

  async getChatHistory(senderId: string, receiverId: string): Promise<ChatMessage[]> {
    await delay();
    
    // Mark as read in Supabase write-through
    await supabaseAdmin
      .from('chat_messages')
      .update({ is_read: true })
      .eq('sender_id', receiverId)
      .eq('receiver_id', senderId)
      .eq('is_read', false);

    mockDb.chatMessages.forEach((m, idx) => {
      if (m.senderId === receiverId && m.receiverId === senderId && !m.isRead) {
        mockDb.chatMessages[idx].isRead = true;
      }
    });
    mockDb.saveAll();

    return mockDb.chatMessages
      .filter(
        m => (m.senderId === senderId && m.receiverId === receiverId) || (m.senderId === receiverId && m.receiverId === senderId)
      )
      .sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async sendChatMessage(senderId: string, receiverId: string, message: string): Promise<ChatMessage> {
    await delay(200);

    const { data: r, error } = await supabaseAdmin
      .from('chat_messages')
      .insert([{
        sender_id: senderId,
        receiver_id: receiverId,
        message,
        is_read: false
      }])
      .select()
      .single();

    if (error || !r) {
      throw new Error(error ? error.message : 'Failed to transmit chat message through gateway');
    }

    const chat: ChatMessage = {
      id: r.id,
      senderId: r.sender_id,
      receiverId: r.receiver_id,
      message: r.message,
      isRead: r.is_read,
      createdAt: r.created_at
    };

    mockDb.chatMessages.push(chat);
    mockDb.saveAll();
    return chat;
  },

  async getStudyMaterials(): Promise<(StudyMaterial & { subjectName: string; teacherName: string })[]> {
    await delay();
    let schoolId = 'school-1';
    try {
      const sessionRaw = localStorage.getItem('aegis_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session?.user?.schoolId) {
          schoolId = session.user.schoolId;
        }
      }
    } catch (e) {
      console.error(e);
    }

    await this.syncStudyMaterialsData(schoolId);

    return mockDb.studyMaterials.map(sm => {
      const s = mockDb.subjects.find(sub => sub.id === sm.subjectId);
      const t = sm.teacherId ? mockDb.teachers.find(tch => tch.id === sm.teacherId) : null;
      const tu = t ? mockDb.users.find(usr => usr.id === t.userId) : null;
      return {
        ...sm,
        subjectName: s ? s.name : 'Subject',
        teacherName: tu ? `${tu.firstName} ${tu.lastName}` : 'Guest Faculty'
      };
    });
  },

  async teacherUploadStudyMaterial(teacherId: string, subjectId: string, title: string, desc: string, fileUrl: string, type: 'pdf' | 'docx' | 'mp4', isStreamable: boolean): Promise<StudyMaterial> {
    await delay(500);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    if (!teacher) throw new Error('Teacher not found.');
    const schoolId = teacher.schoolId;
    if (!schoolId) throw new Error('Teacher has no school association.');
    const { data: dbSchool } = await supabaseAdmin
      .from('schools')
      .select('subscription_plan')
      .eq('id', schoolId)
      .maybeSingle();
    const planName = dbSchool?.subscription_plan?.toLowerCase() || 'freemium';
    if (planName !== 'enterprise') {
      throw new Error('Study Materials upload features are only available in the Enterprise subscription plan.');
    }

    const { data: dbMaterial, error } = await supabaseAdmin
      .from('study_materials')
      .insert({
        school_id: schoolId,
        subject_id: subjectId,
        teacher_id: teacherId,
        title,
        description: desc,
        file_url: fileUrl,
        file_type: type,
        is_video_streamable: isStreamable
      })
      .select()
      .single();

    if (error || !dbMaterial) {
      throw new Error(error?.message || 'Failed to upload study material to Supabase.');
    }

    const sm: StudyMaterial = {
      id: dbMaterial.id,
      subjectId: dbMaterial.subject_id,
      teacherId: dbMaterial.teacher_id,
      title: dbMaterial.title,
      description: dbMaterial.description || undefined,
      fileUrl: dbMaterial.file_url,
      fileType: dbMaterial.file_type as any,
      isVideoStreamable: dbMaterial.is_video_streamable,
      createdAt: dbMaterial.created_at
    };

    mockDb.studyMaterials.unshift(sm);
    mockDb.addLog(teacher.userId, 'UPLOAD_STUDY_MATERIAL', { title, type });
    mockDb.saveAll();
    return sm;
  },

  async teacherEditStudyMaterial(materialId: string, subjectId: string, title: string, desc: string, fileUrl: string, type: 'pdf' | 'docx' | 'mp4', isStreamable: boolean): Promise<StudyMaterial> {
    await delay(500);

    const { data: dbMaterial, error } = await supabaseAdmin
      .from('study_materials')
      .update({
        subject_id: subjectId,
        title,
        description: desc,
        file_url: fileUrl,
        file_type: type,
        is_video_streamable: isStreamable
      })
      .eq('id', materialId)
      .select()
      .single();

    if (error || !dbMaterial) {
      throw new Error(error?.message || 'Failed to update study material in Supabase.');
    }

    const sm: StudyMaterial = {
      id: dbMaterial.id,
      subjectId: dbMaterial.subject_id,
      teacherId: dbMaterial.teacher_id,
      title: dbMaterial.title,
      description: dbMaterial.description || undefined,
      fileUrl: dbMaterial.file_url,
      fileType: dbMaterial.file_type as any,
      isVideoStreamable: dbMaterial.is_video_streamable,
      createdAt: dbMaterial.created_at
    };

    const idx = mockDb.studyMaterials.findIndex(m => m.id === materialId);
    if (idx !== -1) {
      mockDb.studyMaterials[idx] = sm;
    } else {
      mockDb.studyMaterials.push(sm);
    }

    mockDb.saveAll();
    return sm;
  },

  async teacherDeleteStudyMaterial(materialId: string): Promise<void> {
    await delay(500);

    const { error } = await supabaseAdmin
      .from('study_materials')
      .delete()
      .eq('id', materialId);

    if (error) {
      throw new Error(error.message || 'Failed to delete study material in Supabase.');
    }

    mockDb.studyMaterials = mockDb.studyMaterials.filter(m => m.id !== materialId);
    mockDb.saveAll();
  },

  async getNotifications(userId: string): Promise<Notification[]> {
    await delay();
    return mockDb.notifications.filter(n => n.userId === userId);
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    const idx = mockDb.notifications.findIndex(n => n.id === notificationId);
    if (idx !== -1) {
      mockDb.notifications[idx].isRead = true;
      mockDb.saveAll();
    }
  },

  async getLiveSchoolSubscriptionPlan(schoolId: string): Promise<string | null> {
    if (!schoolId) return null;
    try {
      const { data: dbSchool, error } = await supabaseAdmin
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .maybeSingle();
      if (error || !dbSchool) return null;
      
      const plan = dbSchool.subscription_plan ? dbSchool.subscription_plan.toLowerCase() : 'freemium';
      
      // Update local mockDb.schools cache in real time!
      const schoolMapped = {
        id: dbSchool.id,
        name: dbSchool.name,
        address: dbSchool.address || '',
        phone: dbSchool.phone || '',
        subscriptionPlan: plan as any,
        createdAt: dbSchool.created_at
      };
      const idx = mockDb.schools.findIndex(s => s.id === dbSchool.id);
      if (idx === -1) mockDb.schools.push(schoolMapped);
      else mockDb.schools[idx] = schoolMapped;
      mockDb.saveAll();
      
      return plan;
    } catch {
      return null;
    }
  }
};
