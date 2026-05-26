import { mockDb, getSystemTelemetry } from './mockDb';
import { 
  User, Student, Parent, Teacher, Class, Subject, Timetable, 
  Attendance, Assignment, AssignmentSubmission, Quiz, QuizAttempt, 
  Exam, ExamMark, FeeStructure, FeePayment, ChatMessage, Announcement, 
  Notification, AuditLog, StudyMaterial, ExamSchedule, 
  TeacherClassSubjectMapping, QuizQuestion, School, ForumPost, ForumReply
} from '../types';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { subscriptionPlans } from './subscriptionConfig';

// Helper to simulate network latency
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// Secure session key
const SESSION_KEY = 'aegis_session';

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


export const mockApi = {
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

    if (email === 'superadmin@aegis.com') {
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
      // In a real scenario, this shouldn't happen unless the database is out of sync.
      // But because this is a partial connection, we'll check if it's the superadmin and mock their session if their profile is missing.
      if (email === 'superadmin@aegis.com') {
         // --- AUTO-SEED MECHANISM ---
         // 1. Create auth user bypassing RLS
         let superAdminId = authData.user.id;
         
         // 2. Ensure profile exists in users table bypassing RLS
         const { error: seedError } = await supabaseAdmin.from('users').upsert({
           id: superAdminId,
           email: email,
           role: 'SUPER_ADMIN',
           first_name: 'Super',
           last_name: 'Admin',
           is_active: true
         });
         
         if (seedError) throw new Error('Failed to auto-seed superadmin profile: ' + seedError.message);
         
         // Re-fetch profile using admin client
         const { data: refetchedProfile } = await supabaseAdmin.from('users').select('*').eq('id', superAdminId).single();
         if (refetchedProfile) userProfile = refetchedProfile;
         else throw new Error('Failed to retrieve auto-seeded profile.');
      } else {
        throw new Error('User profile not found in database. Ensure you created the user record.');
      }
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

    // Determine sub-entity IDs for the mock DB if needed
    let studentId: string | undefined;
    let teacherId: string | undefined;
    let parentId: string | undefined;

    if (user.role === 'STUDENT') {
      const st = mockDb.students.find(s => s.userId === user.id);
      studentId = st?.id;
    } else if (user.role === 'TEACHER') {
      const tc = mockDb.teachers.find(t => t.userId === user.id);
      teacherId = tc?.id;
    } else if (user.role === 'PARENT') {
      const pr = mockDb.parents.find(p => p.userId === user.id);
      parentId = pr?.id;
    }

    const school = mockDb.schools.find(s => s.id === user.schoolId);

    const session: AuthSession = {
      user,
      token: authData.session?.access_token || 'jwt-mock-token-' + Math.random().toString(36).substring(7),
      studentId,
      teacherId,
      parentId,
      schoolSubscriptionPlan: school?.subscriptionPlan || 'enterprise'
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
    
    return mockDb.timetables.filter(t => t.classId === student.classId);
  },

  async studentGetAssignments(studentId: string): Promise<{ assignment: Assignment; submission?: AssignmentSubmission }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

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
    
    // Check if submission already exists
    const existingIndex = mockDb.assignmentSubmissions.findIndex(
      s => s.assignmentId === assignmentId && s.studentId === studentId
    );

    const submission: AssignmentSubmission = {
      id: existingIndex !== -1 ? mockDb.assignmentSubmissions[existingIndex].id : 'sub-' + Math.random().toString(36).substr(2, 9),
      assignmentId,
      studentId,
      submissionText: text,
      fileUrl,
      submittedAt: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      mockDb.assignmentSubmissions[existingIndex] = submission;
    } else {
      mockDb.assignmentSubmissions.push(submission);
    }

    mockDb.addLog(mockDb.students.find(s => s.id === studentId)?.userId || null, 'SUBMIT_ASSIGNMENT', { assignmentId });
    mockDb.saveAll();
    return submission;
  },

  async studentGetGrades(studentId: string): Promise<{ schedule: ExamSchedule; mark?: ExamMark; subject: Subject; examName: string }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

    const schedules = mockDb.examSchedules.filter(s => s.classId === student.classId);

    return schedules.map(sched => {
      const exam = mockDb.exams.find(e => e.id === sched.examId);
      const subject = mockDb.subjects.find(sub => sub.id === sched.subjectId)!;
      const mark = mockDb.examMarks.find(m => m.examScheduleId === sched.id && m.studentId === studentId);
      return {
        schedule: sched,
        mark,
        subject,
        examName: exam ? exam.name : 'Exam Assessment'
      };
    });
  },

  async studentGetQuizzes(studentId: string): Promise<{ quiz: Quiz; attempt?: QuizAttempt }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

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
    const attempt: QuizAttempt = {
      id: 'qa-' + Math.random().toString(36).substr(2, 9),
      quizId,
      studentId,
      answers,
      score,
      attemptedAt: new Date().toISOString()
    };

    mockDb.quizAttempts.push(attempt);
    mockDb.addLog(mockDb.students.find(s => s.id === studentId)?.userId || null, 'ATTEMPT_QUIZ', { quizId, score });
    mockDb.saveAll();
    return attempt;
  },

  async studentGetFees(studentId: string): Promise<{ structure: FeeStructure; payment?: FeePayment }[]> {
    await delay();
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student || !student.classId) return [];

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
    const student = mockDb.students.find(s => s.id === studentId)!;
    const userDetails = mockDb.users.find(u => u.id === student.userId)!;
    const c = mockDb.classes.find(cls => cls.id === student.classId);

    const attendance = mockDb.attendance.filter(a => a.studentId === studentId);
    
    // Exam report
    const schedules = mockDb.examSchedules.filter(sched => sched.classId === student.classId);
    const examMarks = schedules.map(sched => {
      const exam = mockDb.exams.find(e => e.id === sched.examId);
      const subject = mockDb.subjects.find(sub => sub.id === sched.subjectId)!;
      const mark = mockDb.examMarks.find(m => m.examScheduleId === sched.id && m.studentId === studentId);
      return {
        examName: exam ? exam.name : 'Midterm',
        subjectName: subject.name,
        subjectCode: subject.code,
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

  async teacherGetClassSubjectMappings(teacherId: string): Promise<(TeacherClassSubjectMapping & { className: string; subjectName: string; classId: string; subjectCode: string })[]> {
    await delay();
    const mappings = mockDb.teacherClassSubjectMappings.filter(m => m.teacherId === teacherId);

    return mappings.map(m => {
      const c = mockDb.classes.find(cls => cls.id === m.classId)!;
      const s = mockDb.subjects.find(sub => sub.id === m.subjectId)!;
      return {
        ...m,
        className: c.name,
        subjectName: s.name,
        subjectCode: s.code
      };
    });
  },

  async teacherGetClassStudents(teacherId: string, classId: string): Promise<(Student & { userDetails: User; attendanceState?: string })[]> {
    await delay();
    
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

    records.forEach(rec => {
      const existingIdx = mockDb.attendance.findIndex(
        a => a.studentId === rec.studentId && a.date === date
      );

      const att: Attendance = {
        id: existingIdx !== -1 ? mockDb.attendance[existingIdx].id : 'att-' + Math.random().toString(36).substr(2, 9),
        studentId: rec.studentId,
        classId,
        date,
        status: rec.status,
        remarks: rec.remarks,
        markedBy: teacher.userId
      };

      if (existingIdx !== -1) {
        mockDb.attendance[existingIdx] = att;
      } else {
        mockDb.attendance.push(att);
      }
    });

    mockDb.addLog(teacher.userId, 'MARK_ATTENDANCE', { classId, count: records.length, date });
    mockDb.saveAll();
  },

  async teacherGetSubmissions(teacherId: string, classId: string): Promise<(AssignmentSubmission & { studentName: string; assignmentTitle: string; maxMarks: number })[]> {
    await delay();
    
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
          isHomework: false
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
  },

  async teacherCreateAssignment(teacherId: string, classId: string, subjectId: string, title: string, description: string, dueDate: string, isHomework: boolean): Promise<Assignment> {
    await delay(500);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;

    const assign: Assignment = {
      id: 'as-' + Math.random().toString(36).substr(2, 9),
      classId,
      subjectId,
      teacherId,
      title,
      description,
      dueDate,
      maxMarks: 100,
      isHomework,
      createdAt: new Date().toISOString()
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

  async teacherCreateQuiz(teacherId: string, subjectId: string, classId: string, title: string, duration: number, questions: Omit<QuizQuestion, 'id' | 'quizId'>[]): Promise<Quiz> {
    await delay(600);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    const totalMarks = questions.reduce((acc, q) => acc + q.marks, 0);

    const quiz: Quiz = {
      id: 'q-' + Math.random().toString(36).substr(2, 9),
      subjectId,
      teacherId,
      title,
      durationMinutes: duration,
      totalMarks,
      dueDate: new Date(Date.now() + 86400000 * 5).toISOString(), // 5 days from now
      createdAt: new Date().toISOString()
    };

    mockDb.quizzes.unshift(quiz);

    // Save quiz questions
    questions.forEach((q, idx) => {
      const question: QuizQuestion = {
        id: `qq-${quiz.id}-${idx}`,
        quizId: quiz.id,
        question: q.question,
        options: q.options,
        correctOption: q.correctOption,
        marks: q.marks
      };
      mockDb.quizQuestions.push(question);
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
    return quiz;
  },

  // ==========================================
  // 5. ADMIN PORTAL ENDPOINTS (FULL WRITE ACCESS)
  // ==========================================

  async adminGetInstitutionOverview() {
    await delay();
    const schoolId = getAdminSchoolId();
    const schoolStudents = mockDb.students.filter(s => s.schoolId === schoolId);
    const schoolTeachers = mockDb.teachers.filter(t => t.schoolId === schoolId);
    const schoolParents = mockDb.parents.filter(p => p.schoolId === schoolId);
    const schoolClasses = mockDb.classes.filter(c => c.schoolId === schoolId);
    const schoolSubjects = mockDb.subjects.filter(s => s.schoolId === schoolId);

    const userIds = [
      ...schoolStudents.map(s => s.userId),
      ...schoolTeachers.map(t => t.userId),
      ...schoolParents.map(p => p.userId)
    ];
    const recentRegs = mockDb.users.filter(u => userIds.includes(u.id)).slice(0, 5);

    const structures = mockDb.feeStructures.filter(fs => fs.schoolId === schoolId);
    const structureIds = structures.map(fs => fs.id);
    const payments = mockDb.feePayments.filter(p => structureIds.includes(p.feeStructureId));

    const school = mockDb.schools.find(s => s.id === schoolId);
    const plan = school ? subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium : subscriptionPlans.freemium;

    return {
      totalStudents: schoolStudents.length,
      totalTeachers: schoolTeachers.length,
      totalParents: schoolParents.length,
      totalClasses: schoolClasses.length,
      totalSubjects: schoolSubjects.length,
      recentRegistrations: recentRegs,
      feeCollections: {
        paid: payments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + p.amountPaid, 0),
        pending: structures.reduce((acc, fs) => {
          const count = schoolStudents.filter(s => s.classId === fs.classId).length;
          const paidAmt = payments
            .filter(p => p.feeStructureId === fs.id && p.status === 'PAID')
            .reduce((sum, p) => sum + p.amountPaid, 0);
          return acc + (fs.amount * count - paidAmt);
        }, 0)
      },
      subscription: {
        plan: school?.subscriptionPlan || 'freemium',
        limits: plan.limits,
        features: plan.features
      }
    };
  },

  async adminGetStudents(): Promise<(Student & { userDetails: User; className: string })[]> {
    await delay();
    const schoolId = getAdminSchoolId();
    return mockDb.students
      .filter(s => s.schoolId === schoolId)
      .map(s => {
        const u = mockDb.users.find(usr => usr.id === s.userId)!;
        const c = mockDb.classes.find(cls => cls.id === s.classId);
        return {
          ...s,
          userDetails: u,
          className: c ? c.name : 'Unassigned'
        };
      });
  },


  async adminCreateStudent(adminId: string, email: string, firstName: string, lastName: string, classId: string, admissionNumber: string, rollNumber: number, gender: 'MALE' | 'FEMALE' | 'OTHER', dob: string): Promise<void> {
    await delay(600);
    const admin = mockDb.users.find(u => u.id === adminId);
    if (!admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.schoolId;
    if (!schoolId) throw new Error('Admin has no associated school');

    // Check limits
    const school = mockDb.schools.find(s => s.id === schoolId);
    if (!school) throw new Error('School not found.');
    const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
    const currentStudentsCount = mockDb.students.filter(s => s.schoolId === schoolId).length;
    if (currentStudentsCount >= plan.limits.maxStudents) {
      throw new Error(`Registration failed: Your ${school.subscriptionPlan} plan is limited to ${plan.limits.maxStudents} students. Please upgrade your subscription.`);
    }

    const user: User = {
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      email,
      role: 'STUDENT',
      firstName,
      lastName,
      phone: '',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      isActive: true,
      schoolId,
      password: 'password', // Default credentials seed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const student: Student = {
      id: 'st-' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      schoolId,
      classId,
      admissionNumber,
      rollNumber,
      dateOfBirth: dob,
      gender,
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
    return mockDb.teachers
      .filter(t => t.schoolId === schoolId)
      .map(t => {
        const u = mockDb.users.find(usr => usr.id === t.userId)!;
        return {
          ...t,
          userDetails: u
        };
      });
  },

  async adminGetParents(): Promise<(Parent & { userDetails: User; linkedStudentNames: string[] })[]> {
    await delay();
    const schoolId = getAdminSchoolId();
    return mockDb.parents
      .filter(p => p.schoolId === schoolId)
      .map(p => {
        const u = mockDb.users.find(usr => usr.id === p.userId)!;
        const mappings = mockDb.parentStudentMappings.filter(m => m.parentId === p.id);
        const linkedStudentNames = mappings.map(m => {
          const s = mockDb.students.find(st => st.id === m.studentId)!;
          const su = mockDb.users.find(usr => usr.id === s.userId)!;
          return `${su.firstName} ${su.lastName}`;
        });

        return {
          ...p,
          userDetails: u,
          linkedStudentNames
        };
      });
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
    let schoolClasses = mockDb.classes.filter(c => c.schoolId === schoolId);
    
    // Proactive self-healing fallback: if no classes exist, auto-seed defaults!
    if (schoolClasses.length === 0) {
      const defaultClasses: Class[] = [
        {
          id: 'c-10a-' + schoolId,
          schoolId: schoolId,
          name: 'Grade 10-A',
          academicSessionId: 'session-1',
          createdAt: new Date().toISOString()
        },
        {
          id: 'c-11b-' + schoolId,
          schoolId: schoolId,
          name: 'Grade 11-B',
          academicSessionId: 'session-1',
          createdAt: new Date().toISOString()
        }
      ];
      mockDb.classes.push(...defaultClasses);
      mockDb.saveAll();
      schoolClasses = defaultClasses;
    }
    
    return schoolClasses;
  },



  async adminCreateClass(adminId: string, className: string): Promise<Class> {
    await delay(500);
    const schoolId = getAdminSchoolId();

    const cls: Class = {
      id: 'c-' + Math.random().toString(36).substr(2, 9),
      schoolId,
      name: className,
      academicSessionId: 'session-1',
      createdAt: new Date().toISOString()
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
    
    cls.classTeacherId = teacherId;
    
    mockDb.addLog(adminId, 'ASSIGN_CLASS_TEACHER', { classId, teacherId });
    mockDb.saveAll();
  },
  async adminGetSubjects(): Promise<Subject[]> {
    await delay();
    const schoolId = getAdminSchoolId();
    let schoolSubjects = mockDb.subjects.filter(s => s.schoolId === schoolId);

    // Proactive self-healing fallback: if no subjects exist, auto-seed defaults!
    if (schoolSubjects.length === 0) {
      const defaultSubjects: Subject[] = [
        { id: 's-math-' + schoolId, schoolId: schoolId, name: 'Mathematics', code: 'MATH-' + schoolId.substring(schoolId.length - 3).toUpperCase(), description: 'Algebra, Geometry and Calculus' },
        { id: 's-phys-' + schoolId, schoolId: schoolId, name: 'Physics', code: 'PHYS-' + schoolId.substring(schoolId.length - 3).toUpperCase(), description: 'Mechanics and Electromagnetism' },
        { id: 's-comp-' + schoolId, schoolId: schoolId, name: 'Computer Science', code: 'COMP-' + schoolId.substring(schoolId.length - 3).toUpperCase(), description: 'Information systems and Programming' }
      ];
      mockDb.subjects.push(...defaultSubjects);
      mockDb.saveAll();
      schoolSubjects = defaultSubjects;
    }

    return schoolSubjects;
  },



  async adminCreateSubject(adminId: string, name: string, code: string, description: string): Promise<Subject> {
    await delay(400);
    const schoolId = getAdminSchoolId();

    const sub: Subject = {
      id: 's-' + Math.random().toString(36).substr(2, 9),
      schoolId,
      name,
      code,
      description
    };

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

    const exists = mockDb.teacherClassSubjectMappings.some(
      m => m.teacherId === teacherId && m.classId === classId && m.subjectId === subjectId
    );
    if (exists) throw new Error('Mapping already exists.');

    mockDb.teacherClassSubjectMappings.push({
      id: 'tcsm-' + Math.random().toString(36).substr(2, 9),
      teacherId,
      classId,
      subjectId,
      createdAt: new Date().toISOString()
    });

    if (dayOfWeek !== undefined && startTime && endTime) {
      mockDb.timetables.push({
        id: 'tt-' + Math.random().toString(36).substr(2, 9),
        classId,
        subjectId,
        teacherId,
        dayOfWeek,
        startTime,
        endTime,
        classroomNumber: classroomNumber || 'Main Lecture Hall'
      });
    }

    mockDb.addLog(adminId, 'MAP_TEACHER_CLASS_SUBJECT', { 
      teacherId, classId, subjectId, dayOfWeek, startTime, endTime, classroomNumber 
    });
    mockDb.saveAll();
  },

  async adminCreateTeacher(adminId: string, email: string, firstName: string, lastName: string, employeeId: string, qualification: string, specialization: string, phone: string): Promise<void> {
    await delay(600);
    const admin = mockDb.users.find(u => u.id === adminId);
    if (!admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.schoolId;
    if (!schoolId) throw new Error('Admin has no associated school');

    // Check limits
    const school = mockDb.schools.find(s => s.id === schoolId);
    if (!school) throw new Error('School not found.');
    const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
    const currentTeachersCount = mockDb.teachers.filter(t => t.schoolId === schoolId).length;
    if (currentTeachersCount >= plan.limits.maxTeachers) {
      throw new Error(`Registration failed: Your ${school.subscriptionPlan} plan is limited to ${plan.limits.maxTeachers} teachers. Please upgrade your subscription.`);
    }

    const user: User = {
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      email,
      role: 'TEACHER',
      firstName,
      lastName,
      phone: '',
      avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      isActive: true,
      schoolId,
      password: 'password', // Default credentials seed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const teacher: Teacher = {
      id: 't-' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      schoolId,
      employeeId,
      qualification,
      joiningDate: new Date().toISOString().split('T')[0],
      specialization,
      createdAt: new Date().toISOString()
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
    relationship?: string
  ): Promise<void> {
    await delay(600);
    const schoolId = getAdminSchoolId();

    if (studentId && admissionNumber) {
      const student = mockDb.students.find(s => s.id === studentId);
      if (!student) throw new Error('Selected student not found in registries.');
      
      // Secure verification mismatch validation
      if (student.admissionNumber.toLowerCase().trim() !== admissionNumber.toLowerCase().trim()) {
        throw new Error('Verification failed: Admission number does not match selected student.');
      }
    }

    const user: User = {
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      email,
      role: 'PARENT',
      firstName,
      lastName,
      phone,
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      isActive: true,
      schoolId,
      password: 'password', // Default credentials seed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const parent: Parent = {
      id: 'p-' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      schoolId,
      occupation,
      address,
      createdAt: new Date().toISOString()
    };

    mockDb.users.push(user);
    mockDb.parents.push(parent);

    // Map parent to student ward in database mappings sheet
    if (studentId && relationship) {
      mockDb.parentStudentMappings.push({
        parentId: parent.id,
        studentId,
        relationship: relationship || 'Father'
      });
    }

    mockDb.addLog(adminId, 'CREATE_PARENT', { parentName: `${firstName} ${lastName}`, email, studentId });
    mockDb.saveAll();
  },

  async adminDeleteTeacher(adminId: string, teacherId: string): Promise<void> {
    await delay(300);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');
    mockDb.users = mockDb.users.filter(u => u.id !== teacher.userId);
    mockDb.teachers = mockDb.teachers.filter(t => t.id !== teacherId);
    mockDb.classes = mockDb.classes.map(c => {
      if (c.classTeacherId === teacherId) {
        return { ...c, classTeacherId: undefined };
      }
      return c;
    });
    mockDb.addLog(adminId, 'DELETE_TEACHER', { teacherId });
    mockDb.saveAll();
  },

  async adminDeleteStudent(adminId: string, studentId: string): Promise<void> {
    await delay(300);
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');
    mockDb.users = mockDb.users.filter(u => u.id !== student.userId);
    mockDb.students = mockDb.students.filter(s => s.id !== studentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.studentId !== studentId);
    mockDb.addLog(adminId, 'DELETE_STUDENT', { studentId });
    mockDb.saveAll();
  },

  async adminDeleteParent(adminId: string, parentId: string): Promise<void> {
    await delay(300);
    const parent = mockDb.parents.find(p => p.id === parentId);
    if (!parent) throw new Error('Parent not found.');
    mockDb.users = mockDb.users.filter(u => u.id !== parent.userId);
    mockDb.parents = mockDb.parents.filter(p => p.id !== parentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.parentId !== parentId);
    mockDb.addLog(adminId, 'DELETE_PARENT', { parentId });
    mockDb.saveAll();
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
    dob: string
  ): Promise<void> {
    await delay(600);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');

    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized: You are not the Class Teacher of this class.');
    }

    const schoolId = teacher.schoolId;

    // Check limits
    const school = mockDb.schools.find(s => s.id === schoolId);
    if (!school) throw new Error('School not found.');
    const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
    const currentStudentsCount = mockDb.students.filter(s => s.schoolId === schoolId).length;
    if (currentStudentsCount >= plan.limits.maxStudents) {
      throw new Error(`Registration failed: Your ${school.subscriptionPlan} plan is limited to ${plan.limits.maxStudents} students. Please upgrade your subscription.`);
    }

    const user: User = {
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      email,
      role: 'STUDENT',
      firstName,
      lastName,
      phone: '',
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
      isActive: true,
      schoolId,
      password: 'password',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const student: Student = {
      id: 'st-' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      schoolId,
      classId,
      admissionNumber,
      rollNumber,
      dateOfBirth: dob,
      gender,
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
    relationship: string
  ): Promise<void> {
    await delay(600);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');

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

    const user: User = {
      id: 'u-' + Math.random().toString(36).substr(2, 9),
      email,
      role: 'PARENT',
      firstName,
      lastName,
      phone,
      avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150',
      isActive: true,
      schoolId,
      password: 'password',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const parent: Parent = {
      id: 'p-' + Math.random().toString(36).substr(2, 9),
      userId: user.id,
      schoolId,
      occupation,
      address,
      createdAt: new Date().toISOString()
    };

    mockDb.users.push(user);
    mockDb.parents.push(parent);

    mockDb.parentStudentMappings.push({
      parentId: parent.id,
      studentId,
      relationship: relationship || 'Father'
    });

    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_CREATE_PARENT', { parentName: `${firstName} ${lastName}`, email, studentId });
    mockDb.saveAll();
  },

  async classTeacherDeleteStudent(teacherId: string, studentId: string): Promise<void> {
    await delay(300);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');
    
    const cls = mockDb.classes.find(c => c.id === student.classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized: You can only remove students from your own managed class.');
    }

    mockDb.users = mockDb.users.filter(u => u.id !== student.userId);
    mockDb.students = mockDb.students.filter(s => s.id !== studentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.studentId !== studentId);
    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_DELETE_STUDENT', { studentId });
    mockDb.saveAll();
  },

  async classTeacherDeleteParent(teacherId: string, parentId: string): Promise<void> {
    await delay(300);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');
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

    mockDb.users = mockDb.users.filter(u => u.id !== parent.userId);
    mockDb.parents = mockDb.parents.filter(p => p.id !== parentId);
    mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(m => m.parentId !== parentId);
    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_DELETE_PARENT', { parentId });
    mockDb.saveAll();
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

  async superAdminCreateAdmin(superAdminId: string, email: string, firstName: string, lastName: string, schoolId: string, phone: string): Promise<void> {
    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: 'password', // Default password
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
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Failed to create admin user profile: ' + dbError.message);
    }
  },

  async superAdminDeleteSchool(superAdminId: string, schoolId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('schools').delete().eq('id', schoolId);
    if (error) throw new Error('Failed to delete school: ' + error.message);
  },

  async superAdminUpdateSchoolSubscription(superAdminId: string, schoolId: string, subscriptionPlan: string): Promise<void> {
    const { error } = await supabaseAdmin.from('schools').update({ subscription_plan: subscriptionPlan }).eq('id', schoolId);
    if (error) throw new Error('Failed to update school subscription: ' + error.message);
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
    const admin = mockDb.users.find(u => u.id === adminId);
    if (!admin || admin.role !== 'ADMIN') throw new Error('Unauthorized operational context.');

    const target = mockDb.users.find(u => u.id === targetUserId);
    if (!target) throw new Error('User not found');

    // Strict multi-school scoped isolation boundary check
    if (target.schoolId !== admin.schoolId) {
      mockDb.addLog(adminId, 'SECURITY_VIOLATION', { action: 'RESET_PASSWORD_OUT_OF_SCOPE', targetUserId });
      throw new Error('Access Denied: You can only reset passwords for users in your own school.');
    }

    target.password = newPasswordPlain;
    target.updatedAt = new Date().toISOString();

    mockDb.addLog(adminId, 'RESET_PASSWORD', { targetEmail: target.email, targetRole: target.role });
    mockDb.saveAll();
  },



  async classTeacherGetManagedClasses(teacherId: string): Promise<Class[]> {
    await delay();
    return mockDb.classes.filter(c => c.classTeacherId === teacherId);
  },

  async classTeacherGetExams(schoolId: string): Promise<Exam[]> {
    await delay();
    let exams = mockDb.exams.filter(e => e.schoolId === schoolId);
    if (exams.length === 0) {
      const defaultExam: Exam = {
        id: 'ex-auto-' + schoolId,
        schoolId,
        academicSessionId: 'session-1',
        name: 'Term 1 Assessments',
        startDate: '2026-10-10',
        endDate: '2026-10-20'
      };
      mockDb.exams.push(defaultExam);
      mockDb.saveAll();
      exams = [defaultExam];
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

    let schedules = mockDb.examSchedules.filter(s => s.examId === examId && s.classId === classId);
    if (schedules.length === 0) {
      const subjects = mockDb.subjects.filter(s => s.schoolId === cls.schoolId);
      schedules = subjects.slice(0, 3).map((sub, idx) => ({
        id: 'es-auto-' + classId + '-' + sub.id,
        examId,
        classId,
        subjectId: sub.id,
        examDate: '2026-10-' + (10 + idx).toString(),
        startTime: '09:00',
        endTime: '12:00',
        classroom: 'Main Hall',
        maxMarks: 100
      }));
      mockDb.examSchedules.push(...schedules);
      mockDb.saveAll();
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

    for (const data of marksData) {
      const existingMarkIdx = mockDb.examMarks.findIndex(m => m.examScheduleId === data.scheduleId && m.studentId === studentId);
      if (existingMarkIdx >= 0) {
        mockDb.examMarks[existingMarkIdx].marksObtained = data.marksObtained;
        mockDb.examMarks[existingMarkIdx].remarks = data.remarks;
        mockDb.examMarks[existingMarkIdx].gradedBy = teacherId;
      } else {
        mockDb.examMarks.push({
          id: 'mark-' + Math.random().toString(36).substr(2, 9),
          examScheduleId: data.scheduleId,
          studentId,
          marksObtained: data.marksObtained,
          remarks: data.remarks,
          gradedBy: teacherId,
          createdAt: new Date().toISOString()
        });
      }
    }
    mockDb.addLog(mockDb.teachers.find(t => t.id === teacherId)?.userId || null, 'CLASS_TEACHER_UPDATE_REPORT_CARD', { classId, studentId });
    mockDb.saveAll();
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

    const mappingExists = mockDb.teacherClassSubjectMappings.some(
      m => m.teacherId === teacherId && m.classId === classId && m.subjectId === subjectId
    );
    if (!mappingExists) {
      throw new Error('Unauthorized: You are not assigned to teach this subject for this class.');
    }

    const newEntry: Timetable = {
      id: 'tt-' + Math.random().toString(36).substr(2, 9),
      classId,
      subjectId,
      teacherId,
      dayOfWeek,
      startTime,
      endTime,
      classroomNumber
    };

    mockDb.timetables.push(newEntry);
    mockDb.addLog(mockDb.teachers.find(t => t.id === teacherId)!.userId, 'TEACHER_CREATE_TIMETABLE', { classId, timetableId: newEntry.id });
    mockDb.saveAll();
  },

  async teacherDeleteTimetableEntry(teacherId: string, timetableId: string): Promise<void> {
    await delay(300);

    const ttIdx = mockDb.timetables.findIndex(t => t.id === timetableId);
    if (ttIdx === -1) throw new Error('Timetable entry not found.');

    const tt = mockDb.timetables[ttIdx];
    if (tt.teacherId !== teacherId) {
      throw new Error('Unauthorized: You can only delete your own timetable entries.');
    }

    mockDb.timetables.splice(ttIdx, 1);
    mockDb.addLog(mockDb.teachers.find(t => t.id === teacherId)!.userId, 'TEACHER_DELETE_TIMETABLE', { classId: tt.classId, timetableId });
    mockDb.saveAll();
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

    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized operational context: You are not the Class Teacher of this class.');
    }

    const newEntry: Timetable = {
      id: 'tt-' + Math.random().toString(36).substr(2, 9),
      classId,
      subjectId,
      teacherId: assignedTeacherId || null,
      dayOfWeek,
      startTime,
      endTime,
      classroomNumber
    };

    mockDb.timetables.push(newEntry);
    mockDb.addLog(mockDb.teachers.find(t => t.id === teacherId)!.userId, 'CLASS_TEACHER_CREATE_TIMETABLE', { classId, timetableId: newEntry.id });
    mockDb.saveAll();
  },

  async classTeacherDeleteTimetableEntry(teacherId: string, timetableId: string): Promise<void> {
    await delay(300);

    const ttIdx = mockDb.timetables.findIndex(t => t.id === timetableId);
    if (ttIdx === -1) throw new Error('Timetable entry not found.');

    const tt = mockDb.timetables[ttIdx];
    const cls = mockDb.classes.find(c => c.id === tt.classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized operational context: You are not the Class Teacher of this class.');
    }

    mockDb.timetables.splice(ttIdx, 1);
    mockDb.addLog(mockDb.teachers.find(t => t.id === teacherId)!.userId, 'CLASS_TEACHER_DELETE_TIMETABLE', { classId: cls.id, timetableId });
    mockDb.saveAll();
  },

  // ==========================================
  // 7. GENERAL SHARED PORTAL SERVICES (DISCUSSION / FEED)
  // ==========================================

  async getAnnouncements(role: 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN'): Promise<Announcement[]> {
    await delay();
    return mockDb.announcements.filter(a => a.targetRoles.includes(role));
  },

  async getForumPosts(): Promise<(ForumPost & { authorName: string; categoryName: string; repliesCount: number })[]> {
    await delay();
    return mockDb.forumPosts.map(p => {
      const u = mockDb.users.find(usr => usr.id === p.authorId)!;
      const cat = mockDb.forumCategories.find(c => c.id === p.categoryId)!;
      const reps = mockDb.forumReplies.filter(r => r.postId === p.id).length;
      return {
        ...p,
        authorName: `${u.firstName} ${u.lastName}`,
        categoryName: cat.name,
        repliesCount: reps
      };
    });
  },

  async getForumPostReplies(postId: string): Promise<(ForumReply & { authorName: string; authorAvatar: string; authorRole: string })[]> {
    await delay();
    return mockDb.forumReplies
      .filter(r => r.postId === postId)
      .map(r => {
        const u = mockDb.users.find(usr => usr.id === r.authorId)!;
        return {
          ...r,
          authorName: `${u.firstName} ${u.lastName}`,
          authorAvatar: u.avatarUrl || '',
          authorRole: u.role
        };
      });
  },

  async createForumPost(authorId: string, title: string, content: string): Promise<void> {
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

    const post: ForumPost = {
      id: 'fpt-' + Math.random().toString(36).substr(2, 9),
      categoryId: 'fc-1', // Default general qa
      authorId,
      title,
      content,
      createdAt: new Date().toISOString()
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
    const rep: ForumReply = {
      id: 'frp-' + Math.random().toString(36).substr(2, 9),
      postId,
      authorId,
      content,
      createdAt: new Date().toISOString()
    };

    mockDb.forumReplies.push(rep);
    mockDb.saveAll();
  },

  async getChatInbox(userId: string): Promise<(User & { lastMessage?: string; unreadCount: number })[]> {
    await delay();
    
    // Find all users (excluding current)
    const chats = mockDb.users.filter(u => u.id !== userId);

    return chats.map(u => {
      // Find messages between users
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
    
    // Mark messages as read
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

    const chat: ChatMessage = {
      id: 'cm-' + Math.random().toString(36).substr(2, 9),
      senderId,
      receiverId,
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    mockDb.chatMessages.push(chat);
    mockDb.saveAll();
    return chat;
  },

  async getStudyMaterials(): Promise<(StudyMaterial & { subjectName: string; teacherName: string })[]> {
    await delay();
    return mockDb.studyMaterials.map(sm => {
      const s = mockDb.subjects.find(sub => sub.id === sm.subjectId)!;
      const t = sm.teacherId ? mockDb.teachers.find(tch => tch.id === sm.teacherId) : null;
      const tu = t ? mockDb.users.find(usr => usr.id === t.userId) : null;
      return {
        ...sm,
        subjectName: s.name,
        teacherName: tu ? `${tu.firstName} ${tu.lastName}` : 'Guest Faculty'
      };
    });
  },

  async teacherUploadStudyMaterial(teacherId: string, subjectId: string, title: string, desc: string, fileUrl: string, type: 'pdf' | 'docx' | 'mp4', isStreamable: boolean): Promise<StudyMaterial> {
    await delay(500);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    
    const mat: StudyMaterial = {
      id: 'sm-' + Math.random().toString(36).substr(2, 9),
      subjectId,
      teacherId,
      title,
      description: desc,
      fileUrl,
      fileType: type,
      isVideoStreamable: isStreamable,
      createdAt: new Date().toISOString()
    };

    mockDb.studyMaterials.unshift(mat);
    mockDb.addLog(teacher.userId, 'UPLOAD_STUDY_MATERIAL', { title, type });
    mockDb.saveAll();
    return mat;
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
  }
};
