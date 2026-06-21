import { mockDb, getSystemTelemetry, SEED_EXAMS, SEED_EXAM_SCHEDULES, SEED_EXAM_MARKS, encryptAccountNumberSync, decryptAccountNumberSync } from './mockDb';
import { 
  User, Student, Parent, Teacher, Class, Subject, Timetable, 
  Attendance, Assignment, AssignmentSubmission, Quiz, QuizAttempt, 
  Exam, ExamMark, FeeStructure, FeePayment, PaymentStatus, ChatMessage, Announcement, 
  Notification, AuditLog, StudyMaterial, ExamSchedule, 
  TeacherClassSubjectMapping, QuizQuestion, School, ForumPost, ForumReply, ParentStudentMapping, ForumCategory, PhoneNumber, EmailAddress, Section, HomeworkAttachment,
  Role, RolePermission, DriverSalaryPayout, UserRole, PayrollRecord,
  Hostel, HostelBlock, HostelRoom, HostelBed, HostelWarden, HostelAdmission,
  HostelAttendance, HostelLeaveRequest, HostelVisitor, HostelComplaint,
  HostelFee, HostelPayment, HostelMessMenu,
  SystemStatus, KnowledgeBaseArticle, SupportTicket, BugReport,
  SupportTicketMessage, SupportTicketStatusLog, SupportNotification, SupportInternalNote,
  SchoolPaymentSettings, FacultyPaymentSettings, SalaryPayment, EmployeeSalaryLedger, PaymentAuditLog
} from '../types';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { subscriptionPlans, SubscriptionFeatures } from './subscriptionConfig';

// Helper to simulate network latency
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

// ── Payment Detail Validations ──────────────────────────────────────────
export function validateIFSCCode(ifsc: string): boolean {
  if (!ifsc) return false;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.trim().toUpperCase());
}

export function validateUPIID(upi: string): boolean {
  if (!upi) return false;
  return /^[\w.\-_]+@[\w.\-_]+$/.test(upi.trim().toLowerCase());
}

export function validateAccountNumber(acc: string): boolean {
  if (!acc) return false;
  return /^\d{9,18}$/.test(acc.trim());
}

// Convert file to base64 helper
export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// ── Phone Number Validation (ITU-T E.164) ──────────────────────────────────
function parseAndValidatePhone(phoneStr: string): { countryCode: string; nationalNumber: string; fullNumber: string } {
  if (!phoneStr || !phoneStr.trim()) {
    return { countryCode: '', nationalNumber: '', fullNumber: '' };
  }
  // Strip all non-digit and non-plus characters
  const cleaned = phoneStr.replace(/[^0-9+]/g, '');
  
  // Must start with '+'
  if (!cleaned.startsWith('+')) {
    throw new Error('Phone number must start with a country code (e.g. +91, +1). Example: +919876543210');
  }
  
  // Extract country code and national number
  let countryCode = '';
  let nationalNumber = '';
  
  // Common country codes: +1 (US/CA), +91 (IN), +44 (UK), +61 (AU), etc.
  if (cleaned.startsWith('+91')) {
    countryCode = '+91';
    nationalNumber = cleaned.substring(3);
  } else if (cleaned.startsWith('+1')) {
    countryCode = '+1';
    nationalNumber = cleaned.substring(2);
  } else if (cleaned.startsWith('+44')) {
    countryCode = '+44';
    nationalNumber = cleaned.substring(3);
  } else if (cleaned.startsWith('+61')) {
    countryCode = '+61';
    nationalNumber = cleaned.substring(3);
  } else {
    // Generic: take first 2-4 chars as country code
    const match = cleaned.match(/^(\+\d{1,4})(\d+)$/);
    if (!match) {
      throw new Error('Invalid phone number format. Please use international format: +[country code][number]');
    }
    countryCode = match[1];
    nationalNumber = match[2];
  }
  
  // Validate country code format: + followed by 1-4 digits
  if (!/^\+[0-9]{1,4}$/.test(countryCode)) {
    throw new Error('Invalid country code. Must be + followed by 1-4 digits (e.g. +1, +91, +44).');
  }
  
  // Validate national number: 6-15 digits
  if (!/^[0-9]{6,15}$/.test(nationalNumber)) {
    throw new Error(`Invalid phone number length: ${nationalNumber.length} digits. National number must be 6-15 digits long.`);
  }
  
  return {
    countryCode,
    nationalNumber,
    fullNumber: countryCode + nationalNumber
  };
}

// ── Email Address Validation & Lowercase Normalization ─────────────────────
function validateAndNormalizeEmail(emailStr: string): string {
  if (!emailStr || !emailStr.trim()) {
    throw new Error('Email address cannot be empty.');
  }
  const normalized = emailStr.trim().toLowerCase();
  
  // Standard strict RFC 5322 regex validation
  const emailRegex = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;
  if (!emailRegex.test(normalized)) {
    throw new Error(`Invalid email address format: "${emailStr}". Please provide a valid email (e.g. user@domain.com).`);
  }
  
  return normalized;
}

// Secure session key
const SESSION_KEY = 'aegis_session';

// Lightweight in-memory locks to prevent concurrent auto-seeding race conditions
const isSeedingClassesMap: { [schoolId: string]: boolean } = {};
const isSeedingSubjectsMap: { [schoolId: string]: boolean } = {};

// Consolidation map for parallel hostel data sync calls to avoid duplicate queries
const syncHostelDataPromises: { [schoolId: string]: Promise<void> | null } = {};

export interface AuthSession {
  user: User;
  token: string;
  studentId?: string; // Cache primary id
  teacherId?: string;
  parentId?: string;
  schoolSubscriptionPlan?: string;
}

export const isUUID = (str: string): boolean => 
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export const validateSchoolId = (schoolId: any, queryContext: string): void => {
  if (!schoolId || typeof schoolId !== 'string' || !isUUID(schoolId)) {
    const errMsg = `[DATABASE QUERY SECURITY SHIELD] Blocked execution of query context "${queryContext}" due to missing or invalid schoolId UUID: "${schoolId}"`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
};

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const clean = timeStr.trim().toUpperCase();
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3];
    if (ampm === 'PM' && hours < 12) hours += 12;
    if (ampm === 'AM' && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const parts = clean.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return 0;
}

export function validateTimetableConflicts(
  schoolId: string,
  excludeId: string | undefined,
  classId: string,
  teacherId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  classroomNumber?: string
): void {
  const startMin = parseTimeToMinutes(startTime);
  const endMin = parseTimeToMinutes(endTime);
  if (startMin >= endMin) {
    throw new Error('Start time must be earlier than end time.');
  }

  const targetClass = mockDb.classes.find(c => c.id === classId);
  if (!targetClass) return;

  for (const entry of mockDb.timetables) {
    if (excludeId && entry.id === excludeId) continue;

    const entryClass = mockDb.classes.find(c => c.id === entry.classId);
    if (!entryClass || entryClass.schoolId !== schoolId) continue;

    if (entry.dayOfWeek !== dayOfWeek) continue;

    const entryStartMin = parseTimeToMinutes(entry.startTime);
    const entryEndMin = parseTimeToMinutes(entry.endTime);

    // Overlap condition: startA < endB && startB < endA
    if (startMin < entryEndMin && entryStartMin < endMin) {
      if (entry.teacherId === teacherId) {
        throw new Error('Teacher is already assigned during the selected time period.');
      }

      if (classroomNumber && entry.classroomNumber && entry.classroomNumber.trim().toLowerCase() === classroomNumber.trim().toLowerCase()) {
        throw new Error('Selected room is already occupied during this time period.');
      }

      if (entry.classId === classId) {
        throw new Error('This class already has a scheduled lecture during the selected time period.');
      }
    }
  }
}


export const getAdminSchoolId = async (): Promise<string> => {
  try {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as AuthSession;
      if (session.user?.schoolId && isUUID(session.user.schoolId)) {
        return session.user.schoolId;
      }
    }
  } catch (e) {
    console.error('Error parsing session in getAdminSchoolId:', e);
  }

  // Fallback 1: Query currently logged-in user profile from Supabase Auth & select school_id from public.users table
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabaseAdmin
        .from('users')
        .select('school_id')
        .eq('id', user.id)
        .maybeSingle();
      if (profile?.school_id && isUUID(profile.school_id)) {
        return profile.school_id;
      }
    }
  } catch (e) {
    console.error('Error fetching user profile school_id in getAdminSchoolId:', e);
  }

  // Fallback 2: Read from db schools in localStorage
  try {
    const dbSchoolsRaw = localStorage.getItem('aegis_erp_db_schools');
    if (dbSchoolsRaw) {
      const dbSchools = JSON.parse(dbSchoolsRaw);
      if (dbSchools && dbSchools.length > 0 && dbSchools[0].id && isUUID(dbSchools[0].id)) {
        return dbSchools[0].id;
      }
    }
  } catch (e) {
    console.error('Error reading cached schools in getAdminSchoolId:', e);
  }

  // Fallback 3: Select first available school from public.schools
  try {
    const { data: schoolList } = await supabaseAdmin
      .from('schools')
      .select('id')
      .limit(1);
    if (schoolList && schoolList.length > 0 && schoolList[0].id && isUUID(schoolList[0].id)) {
      return schoolList[0].id;
    }
  } catch (e) {
    console.error('Error fetching fallback schools from DB in getAdminSchoolId:', e);
  }

  // Fallback 4: Read from in-memory mockDb
  try {
    if (mockDb.schools && mockDb.schools.length > 0) {
      const firstSchoolId = mockDb.schools[0].id;
      if (isUUID(firstSchoolId)) {
        return firstSchoolId;
      }
    }
  } catch {}

  return '';
};



export const getActiveUser = (): { id: string; role: string; schoolId: string } | null => {
  try {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as AuthSession;
      if (session.user) {
        return {
          id: session.user.id,
          role: session.user.role,
          schoolId: session.user.schoolId || ''
        };
      }
    }
  } catch (e) {
    console.error(e);
  }
  return null;
};

export const checkCoreAdminOrAcademicAdmin = (): void => {
  const activeUser = getActiveUser();
  if (!activeUser || !['ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(activeUser.role)) {
    throw new Error('Access Denied: Only School Admin and Academic Admin are authorized to perform this operation.');
  }
};

export async function validateTeacherForTimetable(teacherId: string, schoolId: string): Promise<void> {
  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  if (!teacherId || !isUUID(teacherId)) {
    throw new Error('Selected teacher is invalid or no longer available. Please select an active teacher from your school.');
  }

  // Query Supabase directly using inner join to ensure teacher is active
  const { data: teacher, error } = await supabaseAdmin
    .from('teachers')
    .select('id, school_id, user_id, users!inner(is_active)')
    .eq('id', teacherId)
    .eq('users.is_active', true)
    .single();

  if (error || !teacher || teacher.school_id !== schoolId) {
    throw new Error('Selected teacher is invalid or no longer available. Please select an active teacher from your school.');
  }

  // Self-heal/update the local mockDb.teachers cache if needed
  const localTeacherIdx = mockDb.teachers.findIndex(t => t.id === teacherId);
  if (localTeacherIdx !== -1) {
    mockDb.teachers[localTeacherIdx].status = 'ACTIVE';
    mockDb.teachers[localTeacherIdx].deletedAt = null;
  }
}

export const isChatAllowed = (roleA: string, roleB: string): boolean => {
  if (roleA === roleB) return false;
  const subAdmins = ['FINANCE_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'ACADEMIC_ADMIN', 'CUSTOM_SUB_ADMIN', 'HOSTEL_ADMIN', 'WARDEN'];
  const isSubAdmin = (r: string) => subAdmins.includes(r);
  
  const checkPair = (r1: string, r2: string) => {
    if (r1 === 'TEACHER' && r2 === 'ADMIN') return true;
    if (r1 === 'STUDENT' && (r2 === 'TEACHER' || isSubAdmin(r2))) return true;
    if (r1 === 'PARENT' && (r2 === 'TEACHER' || isSubAdmin(r2))) return true;
    if (isSubAdmin(r1) && (r2 === 'ADMIN' || r2 === 'STUDENT' || r2 === 'TEACHER' || r2 === 'PARENT')) return true;
    if (r1 === 'ADMIN' && (r2 === 'SUPER_ADMIN' || isSubAdmin(r2))) return true;
    return false;
  };
  
  return checkPair(roleA, roleB) || checkPair(roleB, roleA);
};

export const checkChatAllowed = (sender: any, receiver: any): boolean => {
  if (sender.id === receiver.id) return false;
  
  // Enforce strict school tenant isolation (unless super admin is involved)
  if (sender.role !== 'SUPER_ADMIN' && receiver.role !== 'SUPER_ADMIN') {
    if (sender.schoolId !== receiver.schoolId) return false;
  }

  const roleA = sender.role;
  const roleB = receiver.role;
  const subAdmins = ['FINANCE_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'ACADEMIC_ADMIN', 'CUSTOM_SUB_ADMIN', 'HOSTEL_ADMIN', 'WARDEN'];
  const isSubAdmin = (r: string) => subAdmins.includes(r);

  const checkPair = (uA: any, uB: any) => {
    const rA = uA.role;
    const rB = uB.role;
    
    // 1. SUPER_ADMIN <-> ADMIN
    if (rA === 'SUPER_ADMIN' && rB === 'ADMIN') return true;
    
    // 2. ADMIN <-> SUPER_ADMIN, TEACHER, SUB_ADMIN
    if (rA === 'ADMIN') {
      return rB === 'SUPER_ADMIN' || rB === 'TEACHER' || isSubAdmin(rB);
    }
    
    // 3. SUB_ADMIN <-> ADMIN, TEACHER, STUDENT, PARENT, OTHER SUB_ADMIN
    if (isSubAdmin(rA)) {
      return rB === 'ADMIN' || rB === 'TEACHER' || rB === 'STUDENT' || rB === 'PARENT' || isSubAdmin(rB);
    }
    
    // 4. TEACHER <-> ADMIN, SUB_ADMIN, STUDENT, PARENT, TEACHER (assigned to same class/section only or class teacher relationship)
    if (rA === 'TEACHER') {
      if (rB === 'ADMIN' || isSubAdmin(rB)) return true;
      if (rB === 'STUDENT') {
        const student = mockDb.students.find(s => s.userId === uB.id);
        const teacher = mockDb.teachers.find(t => t.userId === uA.id);
        if (student && teacher && student.classId) {
          return mockDb.teacherClassSubjectMappings.some(m => m.teacherId === teacher.id && m.classId === student.classId);
        }
        return false;
      }
      if (rB === 'PARENT') {
        const parent = mockDb.parents.find(p => p.userId === uB.id);
        const teacher = mockDb.teachers.find(t => t.userId === uA.id);
        if (parent && teacher) {
          const studentIds = mockDb.parentStudentMappings.filter(m => m.parentId === parent.id).map(m => m.studentId);
          const childStudents = mockDb.students.filter(s => studentIds.includes(s.id) && s.classId);
          return childStudents.some(student => 
            mockDb.teacherClassSubjectMappings.some(m => m.teacherId === teacher.id && m.classId === student.classId)
          );
        }
        return false;
      }
      if (rB === 'TEACHER') {
        const teacherA = mockDb.teachers.find(t => t.userId === uA.id);
        const teacherB = mockDb.teachers.find(t => t.userId === uB.id);
        if (teacherA && teacherB) {
          const classesA = mockDb.teacherClassSubjectMappings.filter(m => m.teacherId === teacherA.id).map(m => m.classId);
          const classesB = mockDb.teacherClassSubjectMappings.filter(m => m.teacherId === teacherB.id).map(m => m.classId);
          
          // Same class assignment
          const sameClass = classesA.some(cId => classesB.includes(cId));
          if (sameClass) return true;
          
          // B is Class Teacher of a class A is assigned to
          const classObjsA = mockDb.classes.filter(c => classesA.includes(c.id));
          const isBClassTeacherOfA = classObjsA.some(c => c.classTeacherId === teacherB.id);
          if (isBClassTeacherOfA) return true;
          
          // A is Class Teacher of a class B is assigned to
          const classObjsB = mockDb.classes.filter(c => classesB.includes(c.id));
          const isAClassTeacherOfB = classObjsB.some(c => c.classTeacherId === teacherA.id);
          if (isAClassTeacherOfB) return true;
        }
        return false;
      }
      return false;
    }
    
    // 5. STUDENT <-> TEACHER (assigned to student class), SUB_ADMIN
    if (rA === 'STUDENT') {
      if (isSubAdmin(rB)) return true;
      if (rB === 'TEACHER') {
        const student = mockDb.students.find(s => s.userId === uA.id);
        const teacher = mockDb.teachers.find(t => t.userId === uB.id);
        if (student && teacher && student.classId) {
          return mockDb.teacherClassSubjectMappings.some(m => m.teacherId === teacher.id && m.classId === student.classId);
        }
      }
      return false;
    }
    
    // 6. PARENT <-> TEACHER (assigned to child class), SUB_ADMIN
    if (rA === 'PARENT') {
      if (isSubAdmin(rB)) return true;
      if (rB === 'TEACHER') {
        const parent = mockDb.parents.find(p => p.userId === uA.id);
        const teacher = mockDb.teachers.find(t => t.userId === uB.id);
        if (parent && teacher) {
          const studentIds = mockDb.parentStudentMappings.filter(m => m.parentId === parent.id).map(m => m.studentId);
          const childStudents = mockDb.students.filter(s => studentIds.includes(s.id) && s.classId);
          return childStudents.some(student => 
            mockDb.teacherClassSubjectMappings.some(m => m.teacherId === teacher.id && m.classId === student.classId)
          );
        }
      }
      return false;
    }
    
    return false;
  };

  return checkPair(sender, receiver) || checkPair(receiver, sender);
};


export function normalizeRole(role: string): string {
  if (!role) return '';
  return role
    .toUpperCase()
    .trim()
    .replace(/[^A-Z0-9_\s-]/g, '')
    .replace(/[\s-]+/g, '_');
}

// ── Super Admin Identity Lock ────────────────────────────────────────────────
// ONLY this exact email address is permitted to log in as SUPER_ADMIN.
// Any other email attempting to use a SUPER_ADMIN role will be rejected.
const SUPER_ADMIN_EMAIL = 'jy7018080@gmail.com';

// Dynamic cache for student attendance analytics to prevent portal lag
export const attendanceAnalyticsCache: Record<string, { timestamp: number; data: any }> = {};

const PLAN_HIERARCHY: Record<string, number> = {
  freemium: 0,
  basic: 1,
  pro: 2,
  enterprise: 3
};

export const mockApi = {
  getHighestPriorityRole(roles: string[]): UserRole {
    const priority: UserRole[] = [
      'SUPER_ADMIN',
      'ADMIN',
      'FINANCE_ADMIN',
      'CUSTOM_SUB_ADMIN',
      'SPORTS_ADMIN',
      'CLASS_TEACHER',
      'TEACHER',
      'COACH'
    ];
    for (const p of priority) {
      if (roles.includes(p)) return p;
    }
    return (roles[0] || 'TEACHER') as UserRole;
  },

  async validateEnterpriseSubscription(schoolId: string, featureName?: string): Promise<void> {
    const livePlan = (await this.getLiveSchoolSubscriptionPlan(schoolId) || 'freemium').toLowerCase();
    const liveLevel = PLAN_HIERARCHY[livePlan] ?? 0;
    if (liveLevel < 3) {
      throw new Error(`403 Forbidden: Accessing ${featureName || 'this premium feature'} requires an active Enterprise Tier subscription.`);
    }
  },

  async validateSubscriptionFeature(schoolId: string, featureName: string, allowedPlans: string[]): Promise<void> {
    const livePlan = (await this.getLiveSchoolSubscriptionPlan(schoolId) || 'freemium').toLowerCase();
    const liveLevel = PLAN_HIERARCHY[livePlan] ?? 0;
    const minRequiredLevel = Math.min(...allowedPlans.map(p => PLAN_HIERARCHY[p.toLowerCase()] ?? 0));
    if (liveLevel < minRequiredLevel) {
      throw new Error(`Security Policy Violation: Accessing ${featureName} requires an active ${allowedPlans.map(p => p.toUpperCase()).join('/')} Tier subscription.`);
    }
  },

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

  async ensureBrandingBucketsExist(): Promise<void> {
    const buckets = ['school-assets', 'admin-signatures', 'teacher-signatures'];
    for (const b of buckets) {
      try {
        const { data, error } = await supabaseAdmin.storage.getBucket(b);
        if (error || !data) {
          console.log(`Self-healing missing storage bucket: ${b}`);
          await supabaseAdmin.storage.createBucket(b, {
            public: true,
            allowedMimeTypes: b === 'school-assets' 
              ? ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp']
              : ['image/png', 'image/jpeg', 'image/jpg'],
            fileSizeLimit: 5242880 // 5MB
          });
        }
      } catch (err) {
        console.error(`Error ensuring bucket ${b} exists:`, err);
      }
    }
  },

  async uploadSchoolAsset(schoolId: string, assetType: 'logo' | 'seal', file: File, uploaderId: string): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(schoolId) || !isUUID(uploaderId)) {
      throw new Error('Invalid school or uploader ID format. Must be UUID.');
    }

    await this.ensureBrandingBucketsExist();

    // 1. Upload new asset exactly at schoolId/assetType.png
    const extension = file.name.split('.').pop() || 'png';
    const filePath = `${schoolId}/${assetType}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('school-assets')
      .upload(filePath, file, {
        cacheControl: '0',
        upsert: true
      });

    if (uploadError) {
      throw new Error(`Failed to upload school ${assetType} to storage: ` + uploadError.message);
    }

    // 2. Resolve public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('school-assets')
      .getPublicUrl(filePath);

    // 3. Update database schools table
    const updatePayload: Record<string, any> = {};
    if (assetType === 'logo') {
      updatePayload.logo_url = publicUrl;
      updatePayload.logo_file_name = file.name;
      updatePayload.logo_uploaded_at = new Date().toISOString();
    } else {
      updatePayload.seal_url = publicUrl;
      updatePayload.seal_file_name = file.name;
      updatePayload.seal_uploaded_at = new Date().toISOString();
    }

    const { error: dbUpdateError } = await supabaseAdmin
      .from('schools')
      .update(updatePayload)
      .eq('id', schoolId);

    if (dbUpdateError) {
      throw new Error(`Failed to save ${assetType} URL to database: ` + dbUpdateError.message);
    }

    // 4. Log to upload audit table
    try {
      await supabaseAdmin.from('file_upload_audit').insert({
        school_id: schoolId,
        uploaded_by: uploaderId,
        file_type: assetType,
        file_url: publicUrl
      });
    } catch (auditErr) {
      console.error('Failed to log file upload audit record:', auditErr);
    }

    // 5. Update local client cache in mockDb.schools
    const schIdx = mockDb.schools.findIndex(s => s.id === schoolId);
    if (schIdx !== -1) {
      if (assetType === 'logo') {
        mockDb.schools[schIdx].logoUrl = publicUrl;
        mockDb.schools[schIdx].logoFileName = file.name;
        mockDb.schools[schIdx].logoUploadedAt = updatePayload.logo_uploaded_at;
      } else {
        mockDb.schools[schIdx].sealUrl = publicUrl;
        mockDb.schools[schIdx].sealFileName = file.name;
        mockDb.schools[schIdx].sealUploadedAt = updatePayload.seal_uploaded_at;
      }
      mockDb.saveAll();
    }

    return publicUrl;
  },

  async removeSchoolAsset(schoolId: string, assetType: 'logo' | 'seal', uploaderId: string): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(schoolId) || !isUUID(uploaderId)) {
      throw new Error('Invalid school or uploader ID format. Must be UUID.');
    }

    // 1. Fetch current URL from db to locate file
    const { data: schoolRow } = await supabaseAdmin
      .from('schools')
      .select('logo_url, seal_url')
      .eq('id', schoolId)
      .single();

    const currentUrl = assetType === 'logo' ? schoolRow?.logo_url : schoolRow?.seal_url;
    if (currentUrl) {
      try {
        const parts = currentUrl.split('/school-assets/');
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabaseAdmin.storage.from('school-assets').remove([filePath]);
        }
      } catch (err) {
        console.error(`Failed to delete ${assetType} from storage:`, err);
      }
    }

    // 2. Set columns to NULL in database
    const updatePayload: Record<string, any> = {};
    if (assetType === 'logo') {
      updatePayload.logo_url = null;
      updatePayload.logo_file_name = null;
      updatePayload.logo_uploaded_at = null;
    } else {
      updatePayload.seal_url = null;
      updatePayload.seal_file_name = null;
      updatePayload.seal_uploaded_at = null;
    }

    const { error: dbUpdateError } = await supabaseAdmin
      .from('schools')
      .update(updatePayload)
      .eq('id', schoolId);

    if (dbUpdateError) {
      throw new Error(`Failed to clear ${assetType} from database: ` + dbUpdateError.message);
    }

    // 3. Log to upload audit table
    try {
      await supabaseAdmin.from('file_upload_audit').insert({
        school_id: schoolId,
        uploaded_by: uploaderId,
        file_type: assetType,
        file_url: null
      });
    } catch (auditErr) {
      console.error('Failed to log file remove audit record:', auditErr);
    }

    // 4. Update local client cache in mockDb.schools
    const schIdx = mockDb.schools.findIndex(s => s.id === schoolId);
    if (schIdx !== -1) {
      if (assetType === 'logo') {
        mockDb.schools[schIdx].logoUrl = '';
        mockDb.schools[schIdx].logoFileName = '';
        mockDb.schools[schIdx].logoUploadedAt = '';
      } else {
        mockDb.schools[schIdx].sealUrl = '';
        mockDb.schools[schIdx].sealFileName = '';
        mockDb.schools[schIdx].sealUploadedAt = '';
      }
      mockDb.saveAll();
    }
  },

  async uploadAdminSignature(adminId: string, file: File, uploaderId: string): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(adminId) || !isUUID(uploaderId)) {
      throw new Error('Invalid IDs format. Must be UUID.');
    }

    await this.ensureBrandingBucketsExist();

    // 1. Get school_id
    const { data: adminRow } = await supabaseAdmin
      .from('school_admins')
      .select('school_id')
      .eq('user_id', adminId)
      .single();

    const schoolId = adminRow?.school_id;
    if (!schoolId) {
      throw new Error('School Admin institution scope not found.');
    }

    // 2. Upload file
    const extension = file.name.split('.').pop() || 'png';
    const filePath = `${adminId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('admin-signatures')
      .upload(filePath, file, {
        cacheControl: '0',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Failed to upload admin signature to storage: ' + uploadError.message);
    }

    // 3. Resolve public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('admin-signatures')
      .getPublicUrl(filePath);

    // 4. Update database school_admins table
    const { error: dbUpdateError } = await supabaseAdmin
      .from('school_admins')
      .update({
        signature_url: publicUrl,
        signature_uploaded_at: new Date().toISOString()
      })
      .eq('user_id', adminId);

    if (dbUpdateError) {
      throw new Error('Failed to save signature URL to database: ' + dbUpdateError.message);
    }

    // 5. Log audit
    try {
      await supabaseAdmin.from('file_upload_audit').insert({
        school_id: schoolId,
        uploaded_by: uploaderId,
        file_type: 'school_admin_signature',
        file_url: publicUrl
      });
    } catch (auditErr) {
      console.error('Failed to log signature audit:', auditErr);
    }

    return publicUrl;
  },

  async removeAdminSignature(adminId: string, uploaderId: string): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(adminId) || !isUUID(uploaderId)) {
      throw new Error('Invalid IDs format. Must be UUID.');
    }

    // 1. Get school_id and current url
    const { data: adminRow } = await supabaseAdmin
      .from('school_admins')
      .select('school_id, signature_url')
      .eq('user_id', adminId)
      .single();

    const schoolId = adminRow?.school_id;
    if (!schoolId) {
      throw new Error('School Admin institution scope not found.');
    }

    if (adminRow?.signature_url) {
      try {
        const parts = adminRow.signature_url.split('/admin-signatures/');
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabaseAdmin.storage.from('admin-signatures').remove([filePath]);
        }
      } catch (err) {
        console.error('Failed to delete signature from storage:', err);
      }
    }

    // 2. Set database to NULL
    const { error: dbUpdateError } = await supabaseAdmin
      .from('school_admins')
      .update({
        signature_url: null,
        signature_uploaded_at: null
      })
      .eq('user_id', adminId);

    if (dbUpdateError) {
      throw new Error('Failed to clear signature from database: ' + dbUpdateError.message);
    }

    // 3. Log audit
    try {
      await supabaseAdmin.from('file_upload_audit').insert({
        school_id: schoolId,
        uploaded_by: uploaderId,
        file_type: 'school_admin_signature',
        file_url: null
      });
    } catch (auditErr) {
      console.error('Failed to log signature remove audit:', auditErr);
    }
  },

  async uploadTeacherSignature(teacherId: string, file: File, uploaderId: string): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(teacherId) || !isUUID(uploaderId)) {
      throw new Error('Invalid IDs format. Must be UUID.');
    }

    await this.ensureBrandingBucketsExist();

    // 1. Get teacher school_id
    const { data: tcRow } = await supabaseAdmin
      .from('teachers')
      .select('school_id')
      .eq('id', teacherId)
      .single();

    const schoolId = tcRow?.school_id;
    if (!schoolId) {
      throw new Error('Teacher school scope not found.');
    }

    // 2. Upload file
    const extension = file.name.split('.').pop() || 'png';
    const filePath = `${teacherId}.${extension}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('teacher-signatures')
      .upload(filePath, file, {
        cacheControl: '0',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Failed to upload teacher signature to storage: ' + uploadError.message);
    }

    // 3. Resolve public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('teacher-signatures')
      .getPublicUrl(filePath);

    // 4. Update database teachers table
    const { error: dbUpdateError } = await supabaseAdmin
      .from('teachers')
      .update({
        signature_url: publicUrl,
        signature_uploaded_at: new Date().toISOString()
      })
      .eq('id', teacherId);

    if (dbUpdateError) {
      throw new Error('Failed to save teacher signature URL to database: ' + dbUpdateError.message);
    }

    // 5. Log audit
    try {
      await supabaseAdmin.from('file_upload_audit').insert({
        school_id: schoolId,
        uploaded_by: uploaderId,
        file_type: 'teacher_signature',
        file_url: publicUrl
      });
    } catch (auditErr) {
      console.error('Failed to log teacher signature audit:', auditErr);
    }

    // 6. Update local client cache in mockDb.teachers
    const tcIdx = mockDb.teachers.findIndex(t => t.id === teacherId);
    if (tcIdx !== -1) {
      mockDb.teachers[tcIdx].signatureUrl = publicUrl;
      mockDb.teachers[tcIdx].signatureUploadedAt = new Date().toISOString();
      mockDb.saveAll();
    }

    return publicUrl;
  },

  async removeTeacherSignature(teacherId: string, uploaderId: string): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(teacherId) || !isUUID(uploaderId)) {
      throw new Error('Invalid IDs format. Must be UUID.');
    }

    // 1. Get teacher school_id and current url
    const { data: tcRow } = await supabaseAdmin
      .from('teachers')
      .select('school_id, signature_url')
      .eq('id', teacherId)
      .single();

    const schoolId = tcRow?.school_id;
    if (!schoolId) {
      throw new Error('Teacher school scope not found.');
    }

    if (tcRow?.signature_url) {
      try {
        const parts = tcRow.signature_url.split('/teacher-signatures/');
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabaseAdmin.storage.from('teacher-signatures').remove([filePath]);
        }
      } catch (err) {
        console.error('Failed to delete teacher signature from storage:', err);
      }
    }

    // 2. Set database to NULL
    const { error: dbUpdateError } = await supabaseAdmin
      .from('teachers')
      .update({
        signature_url: null,
        signature_uploaded_at: null
      })
      .eq('id', teacherId);

    if (dbUpdateError) {
      throw new Error('Failed to clear teacher signature from database: ' + dbUpdateError.message);
    }

    // 3. Log audit
    try {
      await supabaseAdmin.from('file_upload_audit').insert({
        school_id: schoolId,
        uploaded_by: uploaderId,
        file_type: 'teacher_signature',
        file_url: null
      });
    } catch (auditErr) {
      console.error('Failed to log teacher signature remove audit:', auditErr);
    }

    // 4. Update local client cache in mockDb.teachers
    const tcIdx = mockDb.teachers.findIndex(t => t.id === teacherId);
    if (tcIdx !== -1) {
      mockDb.teachers[tcIdx].signatureUrl = '';
      mockDb.teachers[tcIdx].signatureUploadedAt = '';
      mockDb.saveAll();
    }
  },

  async uploadHomeworkSubmissionFile(schoolId: string, homeworkId: string, studentId: string, file: File): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(schoolId) || !isUUID(homeworkId) || !isUUID(studentId)) {
      throw new Error('Invalid format for school, homework, or student ID. Must be UUID.');
    }

    // Validate size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File exceeds the maximum size limit of 50MB.');
    }

    // Validate MIME type
    const whitelist = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'application/zip',
      'application/x-zip-compressed',
      'video/mp4'
    ];
    if (!whitelist.includes(file.type)) {
      throw new Error(`File type "${file.type}" is not supported. Please upload PDF, DOC/DOCX, JPG/PNG, ZIP, or MP4.`);
    }

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `${schoolId}/${homeworkId}/${studentId}_${timestamp}_${sanitizedName}`;

    // Upload using admin client to guarantee permissions bypass
    const { data, error } = await supabaseAdmin.storage
      .from('homeworks')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      throw new Error('Storage upload failed: ' + error.message);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('homeworks')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  async deleteHomeworkSubmissionFile(fileUrl: string): Promise<void> {
    if (!fileUrl) return;
    try {
      const parts = fileUrl.split('/homeworks/');
      if (parts.length > 1) {
        const filePath = parts[1];
        await supabaseAdmin.storage.from('homeworks').remove([filePath]);
      }
    } catch (err) {
      console.error('Failed to remove submission file from storage:', err);
    }
  },

  async uploadHomeworkFileOnly(schoolId: string, homeworkId: string, file: File): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(schoolId) || !isUUID(homeworkId)) {
      throw new Error('Invalid format for school or homework ID. Must be UUID.');
    }

    // Validate size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File exceeds the maximum size limit of 50MB.');
    }

    // Validate MIME type
    const whitelist = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/zip',
      'application/x-zip-compressed',
      'video/mp4'
    ];
    if (!whitelist.includes(file.type)) {
      throw new Error(`File type "${file.type}" is not supported. Please upload PDF, DOC/DOCX, JPG/PNG/WEBP, ZIP, or MP4.`);
    }

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `${schoolId}/${homeworkId}/teacher_${timestamp}_${sanitizedName}`;

    // Upload to storage bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('homeworks')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Storage upload failed: ' + uploadError.message);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('homeworks')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  async teacherInsertHomeworkAttachmentMetadata(schoolId: string, homeworkId: string, teacherId: string, fileUrl: string, fileName: string, mimeType: string): Promise<HomeworkAttachment> {
    await this.validateEnterpriseSubscription(schoolId);
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    const { data: dbAttachment, error: dbError } = await supabaseAdmin
      .from('homework_attachments')
      .insert({
        homework_id: homeworkId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: mimeType.split('/')[1] || 'document',
        mime_type: mimeType,
        uploaded_by: mockDb.teachers.find(t => t.id === teacherId)?.userId || null,
        school_id: schoolId,
        academic_session_id: academicSessionId
      })
      .select()
      .single();

    if (dbError || !dbAttachment) {
      throw new Error('Failed to save attachment metadata to database: ' + (dbError?.message || 'Unknown error'));
    }

    const att: HomeworkAttachment = {
      id: dbAttachment.id,
      homeworkId: dbAttachment.homework_id,
      fileUrl: dbAttachment.file_url,
      fileName: dbAttachment.file_name,
      fileType: dbAttachment.file_type || null,
      mimeType: dbAttachment.mime_type || null,
      uploadedBy: dbAttachment.uploaded_by || null,
      schoolId: dbAttachment.school_id,
      academicSessionId: dbAttachment.academic_session_id || academicSessionId,
      uploadedAt: dbAttachment.uploaded_at
    };

    mockDb.homeworkAttachments.push(att);
    mockDb.saveAll();

    return att;
  },

  async teacherUploadHomeworkAttachment(schoolId: string, homeworkId: string, teacherId: string, file: File): Promise<HomeworkAttachment> {
    await this.validateEnterpriseSubscription(schoolId);
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!isUUID(schoolId) || !isUUID(homeworkId) || !isUUID(teacherId)) {
      throw new Error('Invalid format for IDs. Must be UUID.');
    }

    // Validate size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      throw new Error('File exceeds the maximum size limit of 50MB.');
    }

    // Validate MIME type
    const whitelist = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'application/zip',
      'application/x-zip-compressed',
      'video/mp4'
    ];
    if (!whitelist.includes(file.type)) {
      throw new Error(`File type "${file.type}" is not supported. Please upload PDF, DOC/DOCX, JPG/PNG/WEBP, ZIP, or MP4.`);
    }

    // Sanitize filename
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const timestamp = Date.now();
    const filePath = `${schoolId}/${homeworkId}/teacher_${timestamp}_${sanitizedName}`;

    // Upload to storage bucket
    const { error: uploadError } = await supabaseAdmin.storage
      .from('homeworks')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Storage upload failed: ' + uploadError.message);
    }

    // Resolve public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('homeworks')
      .getPublicUrl(filePath);

    // Resolve active academic session
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    // Insert metadata record into table
    const { data: dbAttachment, error: dbError } = await supabaseAdmin
      .from('homework_attachments')
      .insert({
        homework_id: homeworkId,
        file_url: publicUrl,
        file_name: file.name,
        file_type: file.type.split('/')[1] || 'document',
        mime_type: file.type,
        uploaded_by: mockDb.teachers.find(t => t.id === teacherId)?.userId || null,
        school_id: schoolId,
        academic_session_id: academicSessionId
      })
      .select()
      .single();

    if (dbError || !dbAttachment) {
      // Rollback file upload on metadata insertion failure
      await supabaseAdmin.storage.from('homeworks').remove([filePath]);
      throw new Error('Failed to save attachment metadata to database: ' + (dbError?.message || 'Unknown error'));
    }

    // Insert into mockDb local cache
    const att: HomeworkAttachment = {
      id: dbAttachment.id,
      homeworkId: dbAttachment.homework_id,
      fileUrl: dbAttachment.file_url,
      fileName: dbAttachment.file_name,
      fileType: dbAttachment.file_type || null,
      mimeType: dbAttachment.mime_type || null,
      uploadedBy: dbAttachment.uploaded_by || null,
      schoolId: dbAttachment.school_id,
      academicSessionId: dbAttachment.academic_session_id || academicSessionId,
      uploadedAt: dbAttachment.uploaded_at
    };

    mockDb.homeworkAttachments.push(att);
    mockDb.saveAll();

    return att;
  },

  async teacherDeleteHomeworkAttachment(attachmentId: string): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    
    // Fetch attachment metadata from database or cache to validate subscription
    let schoolId: string | null | undefined = null;
    if (isUUID(attachmentId)) {
      const { data: dbAttachment } = await supabaseAdmin
        .from('homework_attachments')
        .select('school_id')
        .eq('id', attachmentId)
        .maybeSingle();
      if (dbAttachment) {
        schoolId = dbAttachment.school_id;
      }
    }
    if (!schoolId) {
      const att = mockDb.homeworkAttachments.find(a => a.id === attachmentId);
      if (att) {
        schoolId = att.schoolId;
      }
    }
    if (schoolId) {
      await this.validateEnterpriseSubscription(schoolId);
    }

    if (!isUUID(attachmentId)) {
      // Local mockup cleanup
      mockDb.homeworkAttachments = mockDb.homeworkAttachments.filter(att => att.id !== attachmentId);
      mockDb.saveAll();
      return;
    }

    // Fetch attachment metadata from database
    const { data: dbAttachment } = await supabaseAdmin
      .from('homework_attachments')
      .select('*')
      .eq('id', attachmentId)
      .maybeSingle();

    if (dbAttachment) {
      try {
        const parts = dbAttachment.file_url.split('/homeworks/');
        if (parts.length > 1) {
          const filePath = parts[1];
          await supabaseAdmin.storage.from('homeworks').remove([filePath]);
        }
      } catch (err) {
        console.error('Failed to remove attachment file from storage:', err);
      }

      // Delete database record
      await supabaseAdmin
        .from('homework_attachments')
        .delete()
        .eq('id', attachmentId);
    }

    mockDb.homeworkAttachments = mockDb.homeworkAttachments.filter(att => att.id !== attachmentId);
    mockDb.saveAll();
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
    // Fetch all active roles from user_roles
    let { data: dbRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', userProfile.id)
      .eq('status', 'ACTIVE');

    let activeRoles = (dbRoles || []).map(r => r.role_code);
    if (activeRoles.length === 0 && userProfile.role) {
      // Self-heal/backfill role to user_roles
      const { error: insErr } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userProfile.id,
          school_id: userProfile.school_id,
          role_code: userProfile.role,
          status: 'ACTIVE'
        });
      
      if (!insErr) {
        activeRoles = [userProfile.role];
      }
    }

    if (activeRoles.length === 0) {
      mockDb.addLog(userProfile.id, 'LOGIN_BLOCKED', { email });
      throw new Error('Your account or assigned roles have been deactivated. Please contact your school administrator.');
    }

    // Resolve highest priority active role for default session caching
    const defaultRole = activeRoles.length === 1 ? (activeRoles[0] as UserRole) : this.getHighestPriorityRole(activeRoles);
    
    // Sync default active role to the database users.role cache (keeps RLS policies in sync)
    if (userProfile.role !== defaultRole) {
      await supabaseAdmin.from('users').update({ role: defaultRole }).eq('id', userProfile.id);
      userProfile.role = defaultRole;
    }

    // Self-heal: If they got here, ensure users.is_active is true (recovering status)
    if (userProfile.is_active === false) {
      await supabaseAdmin.from('users').update({ is_active: true }).eq('id', userProfile.id);
      userProfile.is_active = true;
    }

    const activeSessionId = userProfile.school_id
      ? await this.resolveActiveSessionId(userProfile.school_id)
      : undefined;

    // Map database profile to frontend User object
    const user: User = {
      id: userProfile.id,
      email: userProfile.email,
      role: defaultRole,
      firstName: userProfile.first_name,
      lastName: userProfile.last_name,
      phone: userProfile.phone || '',
      avatarUrl: userProfile.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
      isActive: userProfile.is_active,
      schoolId: userProfile.school_id,
      academicSessionId: activeSessionId,
      createdAt: userProfile.created_at || new Date().toISOString(),
      updatedAt: userProfile.created_at || new Date().toISOString(),
      roles: activeRoles,
      activeRoleSelected: activeRoles.length === 1
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
            createdAt: fullTc.created_at,
            signatureUrl: fullTc.signature_url || '',
            signatureUploadedAt: fullTc.signature_uploaded_at || ''
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
        const schoolMapped: School = {
          id: dbSchool.id,
          name: dbSchool.name,
          address: dbSchool.address || '',
          phone: dbSchool.phone || '',
          subscriptionPlan: subscriptionPlan as any,
          createdAt: dbSchool.created_at,
          country: dbSchool.country || 'USA',
          currencyCode: dbSchool.currency_code || 'USD',
          currencySymbol: dbSchool.currency_symbol || '$',
          timezone: dbSchool.timezone || 'America/New_York',
          logoUrl: dbSchool.logo_url || '',
          logoFileName: dbSchool.logo_file_name || '',
          logoUploadedAt: dbSchool.logo_uploaded_at || '',
          sealUrl: dbSchool.seal_url || '',
          sealFileName: dbSchool.seal_file_name || '',
          sealUploadedAt: dbSchool.seal_uploaded_at || ''
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

    // ── Persist the logged-in user into mockDb.users so all subsequent
    // mockDb.users.find(u => u.id === userId) lookups succeed immediately.
    // Without this, ADMIN and SUPER_ADMIN see 0 contacts because their own
    // record is missing from the cache, causing getAllowedContacts to bail early.
    const selfIdx = mockDb.users.findIndex(u => u.id === user.id);
    if (selfIdx === -1) mockDb.users.push(user);
    else mockDb.users[selfIdx] = user;
    mockDb.saveAll();

    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    mockDb.addLog(user.id, 'LOGIN_SUCCESS', { role: user.role });

    return session;
  },

  async logout(): Promise<void> {
    const sessionRaw = localStorage.getItem(SESSION_KEY);
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as AuthSession;
      try {
        mockDb.addLog(session.user.id, 'LOGOUT');
      } catch (e) {}
    }
    
    // Clear all session and DB local storage keys synchronously first to prevent any race condition on reload
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key !== 'aegis_theme') {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));

    try {
      sessionStorage.clear();
    } catch (err) {
      console.error('sessionStorage clear error:', err);
    }

    try {
      // Async signOut call, timeout after 500ms to not block reload flow
      await Promise.race([
        supabase.auth.signOut(),
        new Promise(resolve => setTimeout(resolve, 500))
      ]);
    } catch (err) {
      console.error('Supabase signOut error:', err);
    }

    await delay(50);
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

  async changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const session = await this.getSession();
    if (!session || !session.token) {
      throw new Error('Unauthorized session. Please sign in again.');
    }

    const res = await fetch('/api/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.token}`
      },
      body: JSON.stringify({ currentPassword, newPassword })
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.error || 'Failed to change password');
    }

    return body;
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

    // Apply strict boundaries: match class, section (if active), and academic session
    const assignments = mockDb.assignments.filter(a => {
      const schoolMatches = a.schoolId === student.schoolId;
      const classMatches = a.classId === student.classId;
      const sectionMatches = !student.sectionId || !a.sectionId || a.sectionId === student.sectionId;
      const sessionMatches = !a.academicSessionId || !student.academicSessionId || a.academicSessionId === student.academicSessionId || a.academicSessionId === 'session-1' || student.academicSessionId === 'session-1';
      return schoolMatches && classMatches && sectionMatches && sessionMatches;
    });
    
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

    const student = mockDb.students.find(s => s.id === studentId);
    const schoolId = student?.schoolId;
    const academicSessionId = student?.academicSessionId;

    let subRow: any = null;
    
    // Check if submission already exists in database first
    if (validStudentId && validAssignmentId) {
      try {
        const { data: existingSub } = await supabaseAdmin
          .from('homework_submissions')
          .select('id')
          .eq('homework_id', validAssignmentId)
          .eq('student_id', validStudentId)
          .maybeSingle();

        if (existingSub) {
          const { data: updatedSub, error: updateErr } = await supabaseAdmin
            .from('homework_submissions')
            .update({
              submission_text: text,
              submitted_file_url: fileUrl,
              submitted_at: new Date().toISOString()
            })
            .eq('id', existingSub.id)
            .select()
            .single();

          if (updateErr) throw new Error(updateErr.message);
          subRow = updatedSub;
        } else {
          const { data: insertedSub, error: insertErr } = await supabaseAdmin
            .from('homework_submissions')
            .insert({
              homework_id: validAssignmentId,
              student_id: validStudentId,
              submission_text: text,
              submitted_file_url: fileUrl,
              submitted_at: new Date().toISOString(),
              school_id: schoolId || null,
              academic_session_id: academicSessionId || null
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
      marksObtained: subRow && subRow.marks !== null ? Number(subRow.marks) : undefined,
      feedback: subRow ? subRow.remarks || undefined : undefined,
      gradedBy: undefined,
      gradedAt: subRow ? subRow.graded_at || undefined : undefined,
      schoolId: subRow ? subRow.school_id : schoolId,
      academicSessionId: subRow ? subRow.academic_session_id : academicSessionId
    };

    const existingIndex = mockDb.assignmentSubmissions.findIndex(
      s => s.assignmentId === assignmentId && s.studentId === studentId
    );

    if (existingIndex !== -1) {
      mockDb.assignmentSubmissions[existingIndex] = submission;
    } else {
      mockDb.assignmentSubmissions.push(submission);
    }

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

    // Sync exams from database first
    await this.syncExamsData(student.schoolId);

    const { data: dbExamSubjects } = await supabaseAdmin
      .from('exam_subjects')
      .select('*, subject:subjects(*)')
      .eq('school_id', student.schoolId);

    const { data: dbStudentMarks } = await supabaseAdmin
      .from('student_marks')
      .select('*')
      .eq('school_id', student.schoolId)
      .eq('student_id', studentId);

    let examSubjects: any[] = [];
    if (dbExamSubjects) {
      examSubjects = dbExamSubjects.map(es => ({
        id: es.id,
        schoolId: es.school_id,
        examId: es.exam_id,
        subjectId: es.subject_id,
        maxMarks: Number(es.max_marks || 100),
        passingMarks: Number(es.passing_marks || 40),
        subject: es.subject
      }));
    } else {
      examSubjects = mockDb.examSubjects.filter(es => es.schoolId === student.schoolId);
    }

    let studentMarks: any[] = [];
    if (dbStudentMarks) {
      studentMarks = dbStudentMarks.map(sm => ({
        id: sm.id,
        schoolId: sm.school_id,
        examId: sm.exam_id,
        subjectId: sm.subject_id,
        studentId: sm.student_id,
        marksObtained: Number(sm.marks_obtained || 0),
        remarks: sm.remarks || ''
      }));
    } else {
      studentMarks = mockDb.studentMarks.filter(sm => sm.schoolId === student.schoolId && sm.studentId === studentId);
    }

    return examSubjects.map(es => {
      const exam = mockDb.exams.find(e => e.id === es.examId);
      const subject = mockDb.subjects.find(sub => sub.id === es.subjectId) || es.subject || {
        id: es.subjectId,
        schoolId: student.schoolId,
        name: 'Unknown Subject',
        code: 'UNK'
      };
      const mark = studentMarks.find(sm => sm.examId === es.examId && sm.subjectId === es.subjectId);

      const virtualSchedule: ExamSchedule = {
        id: 'virtual-sched-' + es.id,
        examId: es.examId,
        classId: student.classId as string,
        subjectId: es.subjectId,
        examDate: '',
        startTime: '',
        endTime: '',
        classroom: '',
        maxMarks: es.maxMarks
      };

      const virtualMark: ExamMark | undefined = mark ? {
        id: mark.id,
        examScheduleId: 'virtual-sched-' + es.id,
        studentId: studentId,
        marksObtained: mark.marksObtained,
        remarks: mark.remarks,
        gradedBy: 'Teacher',
        createdAt: new Date().toISOString()
      } : undefined;

      return {
        schedule: virtualSchedule,
        mark: virtualMark,
        subject,
        examName: exam ? exam.name : 'Exam Assessment'
      };
    });
  },

  async syncHomeworkAttachmentsData(schoolId: string): Promise<void> {
    try {
      const { data: dbAttachments } = await supabaseAdmin
        .from('homework_attachments')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbAttachments) {
        // Clear local cache for this school first to prevent duplicates
        mockDb.homeworkAttachments = mockDb.homeworkAttachments.filter(att => att.schoolId !== schoolId);

        dbAttachments.forEach((r: any) => {
          const att: HomeworkAttachment = {
            id: r.id,
            homeworkId: r.homework_id,
            fileUrl: r.file_url,
            fileName: r.file_name,
            fileType: r.file_type || null,
            mimeType: r.mime_type || null,
            uploadedBy: r.uploaded_by || null,
            schoolId: r.school_id,
            academicSessionId: r.academic_session_id || 'session-1',
            uploadedAt: r.uploaded_at
          };
          mockDb.homeworkAttachments.push(att);
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync homework attachments:', e);
    }
  },

  async syncAssignmentsData(schoolId: string): Promise<void> {
    // Sync attachments first so they are ready to link
    await this.syncHomeworkAttachmentsData(schoolId);
    try {
      const { data: dbAssignments } = await supabaseAdmin
        .from('homeworks')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbAssignments) {
        dbAssignments.forEach((r: any) => {
          const ass: Assignment = {
            id: r.id,
            schoolId: r.school_id,
            classId: r.class_id,
            sectionId: r.section_id || undefined,
            subjectId: r.subject_id,
            teacherId: r.teacher_id,
            title: r.title,
            description: r.description,
            dueDate: r.due_date,
            maxMarks: 100,
            fileAttachmentUrl: r.attachment_url || undefined,
            attachments: mockDb.homeworkAttachments.filter(att => att.homeworkId === r.id),
            isHomework: r.status !== 'DRAFT',
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

  async syncSectionsData(schoolId: string): Promise<void> {
    try {
      const { data: dbSections } = await supabaseAdmin
        .from('sections')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbSections) {
        dbSections.forEach((r: any) => {
          const sec: Section = {
            id: r.id,
            schoolId: r.school_id,
            classId: r.class_id,
            name: r.name,
            createdAt: r.created_at
          };
          const idx = mockDb.sections.findIndex(s => s.id === sec.id);
          if (idx === -1) mockDb.sections.push(sec);
          else mockDb.sections[idx] = sec;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync sections:', e);
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
        .from('homework_submissions')
        .select('*')
        .in('homework_id', assignmentIds);

      if (dbSubmissions) {
        dbSubmissions.forEach((r: any) => {
          const sub: AssignmentSubmission = {
            id: r.id,
            assignmentId: r.homework_id,
            studentId: r.student_id,
            submissionText: r.submission_text || undefined,
            fileUrl: r.submitted_file_url || undefined,
            submittedAt: r.submitted_at,
            marksObtained: r.marks !== null ? Number(r.marks) : undefined,
            feedback: r.remarks || undefined,
            gradedBy: undefined,
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
        // Clear local cache for this school first to prevent duplicate/buffering artifacts
        mockDb.studyMaterials = mockDb.studyMaterials.filter(m => m.schoolId !== schoolId);
        
        dbMaterials.forEach((r: any) => {
          const sm: StudyMaterial = {
            id: r.id,
            schoolId: r.school_id,
            subjectId: r.subject_id,
            classId: r.class_id,
            teacherId: r.teacher_id,
            uploadedBy: r.uploaded_by,
            academicSessionId: r.academic_session_id,
            title: r.title,
            description: r.description || undefined,
            fileUrl: r.file_url,
            thumbnailUrl: r.thumbnail_url || null,
            fileType: r.file_type as any,
            mimeType: r.mime_type || null,
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
      await this.syncClassesData(schoolId).catch(() => {});
      await this.syncFeeStructuresData(schoolId).catch(() => {});

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
            createdAt: r.created_at,
            paymentScreenshotUrl: r.payment_screenshot_url || undefined,
            utrNumber: r.utr_number || undefined,
            rejectionReason: r.rejection_reason || undefined
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

  async syncDriverSalaryPayoutsData(schoolId: string): Promise<void> {
    try {
      const { data: dbPayouts } = await supabaseAdmin
        .from('driver_salary_payouts')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbPayouts) {
        dbPayouts.forEach((r: any) => {
          const dp: DriverSalaryPayout = {
            id: r.id,
            schoolId: r.school_id,
            driverId: r.driver_id,
            attendanceRecordId: r.attendance_record_id,
            payoutAmount: Number(r.payout_amount) || 0,
            payoutStatus: r.payout_status as any,
            payoutDate: r.payout_date || '',
            paidByUserId: r.paid_by_user_id,
            transactionReference: r.transaction_reference,
            notes: r.notes,
            createdAt: r.created_at,
            updatedAt: r.updated_at
          };
          const idx = mockDb.driverSalaryPayouts.findIndex(p => p.id === dp.id);
          if (idx === -1) mockDb.driverSalaryPayouts.push(dp);
          else mockDb.driverSalaryPayouts[idx] = dp;
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync driver salary payouts:', e);
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

      // Fetch active, non-deleted teachers for this school to check for orphaned records
      const { data: dbActiveTeachers } = await supabaseAdmin
        .from('teachers')
        .select('id, users!inner(is_active)')
        .eq('school_id', schoolId)
        .eq('users.is_active', true);

      const activeTeacherIds = dbActiveTeachers ? dbActiveTeachers.map(t => t.id) : [];
      const fallbackTeacherId = activeTeacherIds.length > 0 ? activeTeacherIds[0] : null;

      if (dbTimetables) {
        for (const r of dbTimetables) {
          let currentTeacherId = r.teacher_id;
          
          // If the teacher assigned to this timetable is not in our active teachers list
          if (!activeTeacherIds.includes(currentTeacherId)) {
            if (fallbackTeacherId) {
              console.warn(`Repairing orphan timetable record: reassigned ${r.id} from inactive/deleted teacher ${currentTeacherId} to active teacher ${fallbackTeacherId}`);
              const { error: updateError } = await supabaseAdmin
                .from('timetables')
                .update({ teacher_id: fallbackTeacherId })
                .eq('id', r.id);
              if (!updateError) {
                currentTeacherId = fallbackTeacherId;
              }
            } else {
              console.warn(`Deleting orphan timetable record ${r.id}: no active teacher available for reassignment`);
              await supabaseAdmin
                .from('timetables')
                .delete()
                .eq('id', r.id);
              
              // Remove from local cache if it exists
              const localIdx = mockDb.timetables.findIndex(t => t.id === r.id);
              if (localIdx !== -1) {
                mockDb.timetables.splice(localIdx, 1);
              }
              continue;
            }
          }

          const tt: Timetable = {
            id: r.id,
            classId: r.class_id,
            subjectId: r.subject_id,
            teacherId: currentTeacherId,
            dayOfWeek: r.day_of_week,
            startTime: r.start_time,
            endTime: r.end_time,
            classroomNumber: r.classroom_number || undefined,
            academicSessionId: r.academic_session_id || 'session-1'
          };
          const idx = mockDb.timetables.findIndex(t => t.id === tt.id);
          if (idx === -1) mockDb.timetables.push(tt);
          else mockDb.timetables[idx] = tt;
        }

        // Filter local cache to match only existing synced records
        const syncedIds = new Set(dbTimetables.map(t => t.id));
        mockDb.timetables = mockDb.timetables.filter(t => !classIds.includes(t.classId) || syncedIds.has(t.id));
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
          const existingIdx = mockDb.exams.findIndex(e => e.id === ex.id);
          if (existingIdx >= 0) mockDb.exams[existingIdx] = ex;
          else mockDb.exams.push(ex);
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync exams', e);
    }
  },

  async syncExamSchedulesData(schoolId: string): Promise<void> {
    try {
      const { data: dbExams } = await supabaseAdmin.from('exams').select('id').eq('school_id', schoolId);
      if (!dbExams || dbExams.length === 0) return;
      
      const { data: dbSchedules } = await supabaseAdmin
        .from('exam_schedules')
        .select('*')
        .in('exam_id', dbExams.map(e => e.id));
        
      if (dbSchedules) {
        dbSchedules.forEach((r: any) => {
          const sched: ExamSchedule = {
            id: r.id,
            examId: r.exam_id,
            classId: r.class_id,
            subjectId: r.subject_id,
            examDate: r.exam_date || r.date,
            startTime: r.start_time,
            endTime: r.end_time,
            classroom: r.classroom || '',
            maxMarks: r.max_marks || 100
          };
          const existingIdx = mockDb.examSchedules.findIndex(s => s.id === sched.id);
          if (existingIdx >= 0) mockDb.examSchedules[existingIdx] = sched;
          else mockDb.examSchedules.push(sched);
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync exam schedules', e);
    }
  },

  async syncExamMarksData(schoolId: string): Promise<void> {
    try {
      const { data: dbExams } = await supabaseAdmin.from('exams').select('id').eq('school_id', schoolId);
      if (!dbExams || dbExams.length === 0) return;
      
      const { data: dbSchedules } = await supabaseAdmin.from('exam_schedules').select('id').in('exam_id', dbExams.map(e => e.id));
      if (!dbSchedules || dbSchedules.length === 0) return;
      
      const { data: dbMarks } = await supabaseAdmin
        .from('exam_marks')
        .select('*')
        .in('exam_schedule_id', dbSchedules.map(s => s.id));
        
      if (dbMarks) {
        dbMarks.forEach((r: any) => {
          const mark: ExamMark = {
            id: r.id,
            examScheduleId: r.exam_schedule_id,
            studentId: r.student_id,
            marksObtained: r.marks_obtained,
            remarks: r.remarks || '',
            gradedBy: r.graded_by || 't-1',
            createdAt: r.created_at || new Date().toISOString()
          };
          const existingIdx = mockDb.examMarks.findIndex(m => m.id === mark.id);
          if (existingIdx >= 0) mockDb.examMarks[existingIdx] = mark;
          else mockDb.examMarks.push(mark);
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync exam marks', e);
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
            schoolId: r.school_id,
            subjectId: r.subject_id,
            classId: r.class_id || undefined,
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
        .or(`school_id.eq.${schoolId},role.eq.SUPER_ADMIN`);
      
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
      
      if (dbCats && dbCats.length === 0) {
        // No categories exist in the DB for this school yet. Let's auto-seed default ones.
        const defaultCats = [
          {
            school_id: schoolId,
            name: 'General Q&A',
            description: 'Standard school topics, general academic questions'
          },
          {
            school_id: schoolId,
            name: 'Computer Science & Tech',
            description: 'Share coding concepts, programming bugs, and tech advancements'
          }
        ];
        const { data: seededCats } = await supabaseAdmin
          .from('forum_categories')
          .insert(defaultCats)
          .select();
        
        if (seededCats) {
          seededCats.forEach((r: any) => {
            const cat: ForumCategory = {
              id: r.id,
              schoolId: r.school_id,
              academicSessionId: r.academic_session_id || null,
              classId: r.class_id || null,
              subjectId: r.subject_id || null,
              name: r.name,
              description: r.description,
              status: r.status || 'ACTIVE',
              deletedAt: r.deleted_at || null
            };
            const idx = mockDb.forumCategories.findIndex(c => c.id === cat.id);
            if (idx === -1) mockDb.forumCategories.push(cat);
            else mockDb.forumCategories[idx] = cat;
          });
          mockDb.saveAll();
        }
      } else if (dbCats) {
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
            description: r.description,
            status: r.status || 'ACTIVE',
            deletedAt: r.deleted_at || null
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
        mockDb.forumPosts = mockDb.forumPosts.filter(p => !catIds.includes(p.categoryId));
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
            createdAt: r.created_at,
            status: r.status || 'ACTIVE',
            deletedAt: r.deleted_at || null
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
      const catIds = mockDb.forumCategories.filter(c => c.schoolId === schoolId).map(c => c.id);
      const postIds = mockDb.forumPosts.filter(p => catIds.includes(p.categoryId)).map(p => p.id);
      if (postIds.length === 0) {
        mockDb.forumReplies = mockDb.forumReplies.filter(rp => !postIds.includes(rp.postId));
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

  async syncStudentsData(schoolId: string): Promise<void> {
    try {
      const { data: dbStudents } = await supabaseAdmin
        .from('students')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbStudents) {
        dbStudents.forEach((r: any) => {
          const studentMapped: Student = {
            id: r.id,
            userId: r.user_id,
            schoolId: r.school_id,
            classId: r.class_id || '',
            sectionId: r.section_id || null,
            academicSessionId: r.academic_session_id || 'session-1',
            admissionNumber: r.admission_number,
            rollNumber: r.roll_number,
            dateOfBirth: r.date_of_birth || '',
            gender: r.gender,
            createdAt: r.created_at
          };
          const idx = mockDb.students.findIndex(s => s.id === r.id);
          if (idx === -1) mockDb.students.push(studentMapped);
          else mockDb.students[idx] = studentMapped;
        });
        const studentIds = new Set(dbStudents.map(s => s.id));
        mockDb.students = mockDb.students.filter(s => s.schoolId !== schoolId || studentIds.has(s.id));
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync students:', e);
    }
  },

  async syncParentsData(schoolId: string): Promise<void> {
    try {
      const { data: dbParents } = await supabaseAdmin
        .from('parents')
        .select('*')
        .eq('school_id', schoolId);
      
      if (dbParents) {
        dbParents.forEach((r: any) => {
          const parentMapped: Parent = {
            id: r.id,
            userId: r.user_id,
            schoolId: r.school_id,
            occupation: r.occupation || '',
            address: r.address || '',
            createdAt: r.created_at
          };
          const idx = mockDb.parents.findIndex(p => p.id === r.id);
          if (idx === -1) mockDb.parents.push(parentMapped);
          else mockDb.parents[idx] = parentMapped;
        });
        const parentIds = new Set(dbParents.map(p => p.id));
        mockDb.parents = mockDb.parents.filter(p => p.schoolId !== schoolId || parentIds.has(p.id));
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync parents:', e);
    }
  },

  async syncParentStudentMappingsData(schoolId: string): Promise<void> {
    try {
      const studentIds = mockDb.students.filter(s => s.schoolId === schoolId).map(s => s.id);
      if (studentIds.length === 0) return;

      const { data: dbMappings } = await supabaseAdmin
        .from('parent_student_mapping')
        .select('*')
        .in('student_id', studentIds);
      
      if (dbMappings) {
        mockDb.parentStudentMappings = mockDb.parentStudentMappings.filter(
          m => !studentIds.includes(m.studentId)
        );

        dbMappings.forEach((r: any) => {
          const map: ParentStudentMapping = {
            parentId: r.parent_id,
            studentId: r.student_id,
            relationship: r.relationship
          };
          mockDb.parentStudentMappings.push(map);
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync parent student mappings:', e);
    }
  },

  async syncSchoolsData(schoolId: string): Promise<void> {
    try {
      const { data: dbSchool } = await supabaseAdmin
        .from('schools')
        .select('*')
        .eq('id', schoolId)
        .maybeSingle();

      if (dbSchool) {
        const schoolMapped: School = {
          id: dbSchool.id,
          name: dbSchool.name,
          address: dbSchool.address || '',
          phone: dbSchool.phone || '',
          subscriptionPlan: (dbSchool.subscription_plan ? dbSchool.subscription_plan.toLowerCase() : 'freemium') as any,
          createdAt: dbSchool.created_at,
          country: dbSchool.country || 'USA',
          currencyCode: dbSchool.currency_code || 'USD',
          currencySymbol: dbSchool.currency_symbol || '$',
          timezone: dbSchool.timezone || 'America/New_York',
          logoUrl: dbSchool.logo_url || '',
          logoFileName: dbSchool.logo_file_name || '',
          logoUploadedAt: dbSchool.logo_uploaded_at || '',
          sealUrl: dbSchool.seal_url || '',
          sealFileName: dbSchool.seal_file_name || '',
          sealUploadedAt: dbSchool.seal_uploaded_at || ''
        };
        const idx = mockDb.schools.findIndex(s => s.id === dbSchool.id);
        if (idx === -1) mockDb.schools.push(schoolMapped);
        else mockDb.schools[idx] = schoolMapped;
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync schools:', e);
    }
  },

  async syncClassesData(schoolId: string): Promise<void> {
    try {
      const { data: dbClasses } = await supabaseAdmin
        .from('classes')
        .select('*')
        .eq('school_id', schoolId);

      if (dbClasses) {
        dbClasses.forEach((r: any) => {
          const cls = {
            id: r.id,
            schoolId: r.school_id,
            name: r.name,
            academicSessionId: r.academic_session_id || 'session-1',
            classTeacherId: r.class_teacher_id || undefined,
            createdAt: r.created_at
          };
          const idx = mockDb.classes.findIndex(c => c.id === cls.id);
          if (idx === -1) mockDb.classes.push(cls);
          else mockDb.classes[idx] = cls;
        });
        const classIds = new Set(dbClasses.map(c => c.id));
        mockDb.classes = mockDb.classes.filter(c => c.schoolId !== schoolId || classIds.has(c.id));
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync classes:', e);
    }
  },

  async syncTeachersData(schoolId: string): Promise<void> {
    try {
      const { data: dbTeachers } = await supabaseAdmin
        .from('teachers')
        .select('*, users!inner(is_active)')
        .eq('school_id', schoolId)
        .eq('users.is_active', true);

      if (dbTeachers) {
        dbTeachers.forEach((r: any) => {
          const tc = {
            id: r.id,
            userId: r.user_id,
            schoolId: r.school_id,
            employeeId: r.employee_id,
            qualification: r.qualification || '',
            joiningDate: r.joining_date || '',
            specialization: r.specialization || '',
            createdAt: r.created_at,
            status: 'ACTIVE' as const,
            deletedAt: null
          };
          const idx = mockDb.teachers.findIndex(t => t.id === tc.id);
          if (idx === -1) mockDb.teachers.push(tc);
          else mockDb.teachers[idx] = tc;
        });
        const teacherIds = new Set(dbTeachers.map(t => t.id));
        mockDb.teachers = mockDb.teachers.filter(t => t.schoolId !== schoolId || teacherIds.has(t.id));
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync teachers:', e);
    }
  },

  async syncSubjectsData(schoolId: string): Promise<void> {
    try {
      const { data: dbSubjects } = await supabaseAdmin
        .from('subjects')
        .select('*')
        .eq('school_id', schoolId);

      if (dbSubjects) {
        dbSubjects.forEach((r: any) => {
          const sub = {
            id: r.id,
            schoolId: r.school_id,
            name: r.name,
            code: r.code,
            description: r.description || ''
          };
          const idx = mockDb.subjects.findIndex(s => s.id === sub.id);
          if (idx === -1) mockDb.subjects.push(sub);
          else mockDb.subjects[idx] = sub;
        });
        const subjectIds = new Set(dbSubjects.map(s => s.id));
        mockDb.subjects = mockDb.subjects.filter(s => s.schoolId !== schoolId || subjectIds.has(s.id));
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync subjects:', e);
    }
  },

  async syncNotificationsData(userId: string): Promise<void> {
    try {
      const { data: dbNotifications } = await supabaseAdmin
        .from('notifications')
        .select('*')
        .eq('user_id', userId);

      if (dbNotifications) {
        mockDb.notifications = mockDb.notifications.filter(n => n.userId !== userId);
        dbNotifications.forEach((r: any) => {
          const notify: Notification = {
            id: r.id,
            userId: r.user_id,
            title: r.title,
            message: r.content,
            isRead: r.is_read,
            createdAt: r.created_at,
            senderId: r.sender_id,
            recipientRole: r.recipient_role,
            category: r.category || r.type,
            priority: r.priority || 'MEDIUM'
          };
          mockDb.notifications.push(notify);
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync notifications:', e);
    }
  },

  async sendNotification(
    userId: string,
    title: string,
    message: string,
    type = 'ANNOUNCEMENT',
    schoolId?: string,
    senderId?: string | null,
    recipientRole?: string | null,
    priority?: string
  ): Promise<Notification> {
    const student = mockDb.students.find(s => s.userId === userId);
    const teacher = mockDb.teachers.find(t => t.userId === userId);
    const parent = mockDb.parents.find(p => p.userId === userId);
    const resolvedSchoolId = schoolId || student?.schoolId || teacher?.schoolId || parent?.schoolId || 'school-1';
    const resolvedRole = recipientRole || (student ? 'STUDENT' : teacher ? 'TEACHER' : parent ? 'PARENT' : 'USER');

    let dbRow: any = null;
    try {
      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: resolvedSchoolId,
          targetType: 'individual',
          targetValue: userId,
          title,
          content: message,
          type,
          senderId: senderId || null,
          recipientRole: resolvedRole,
          priority: priority || 'MEDIUM'
        })
      });

      if (res.ok) {
        const data = await res.json();
        const { data: latestNotifs } = await supabaseAdmin
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (latestNotifs) {
          dbRow = latestNotifs;
        }
      } else {
        const { data, error } = await supabaseAdmin
          .from('notifications')
          .insert({
            school_id: resolvedSchoolId,
            user_id: userId,
            recipient_id: userId,
            sender_id: senderId || null,
            recipient_role: resolvedRole,
            title: title,
            content: message,
            message: message,
            type: type,
            category: type,
            priority: priority || 'MEDIUM',
            is_read: false,
            read_status: false
          })
          .select()
          .single();
        if (data) dbRow = data;
      }
    } catch (e) {
      console.error('Failed to dispatch notification via API, falling back to direct DB write:', e);
      try {
        const { data } = await supabaseAdmin
          .from('notifications')
          .insert({
            school_id: resolvedSchoolId,
            user_id: userId,
            recipient_id: userId,
            sender_id: senderId || null,
            recipient_role: resolvedRole,
            title: title,
            content: message,
            message: message,
            type: type,
            category: type,
            priority: priority || 'MEDIUM',
            is_read: false,
            read_status: false
          })
          .select()
          .single();
        if (data) dbRow = data;
      } catch (dbErr) {
        console.error('Direct DB write fallback failed:', dbErr);
      }
    }

    const notify: Notification = {
      id: dbRow ? dbRow.id : 'n-' + Math.random().toString(36).substr(2, 9),
      userId,
      title,
      message,
      isRead: false,
      createdAt: dbRow ? dbRow.created_at : new Date().toISOString()
    };

    const idx = mockDb.notifications.findIndex(n => n.id === notify.id);
    if (idx === -1) mockDb.notifications.unshift(notify);
    else mockDb.notifications[idx] = notify;
    mockDb.saveAll();
    return notify;
  },

  async markNotificationAsRead(notificationId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    } catch (e) {
      console.error('Failed to mark notification as read in DB:', e);
    }
    const idx = mockDb.notifications.findIndex(n => n.id === notificationId);
    if (idx !== -1) {
      mockDb.notifications[idx].isRead = true;
      mockDb.saveAll();
    }
  },

  async sendNotificationToUserAndParents(
    studentUserId: string,
    title: string,
    message: string,
    category: string,
    schoolId: string,
    senderId: string | null = null,
    priority: string = 'MEDIUM'
  ): Promise<void> {
    try {
      await this.sendNotification(
        studentUserId,
        title,
        message,
        category,
        schoolId,
        senderId,
        'STUDENT',
        priority
      );
    } catch (e) {
      console.error('Failed to notify student:', e);
    }

    try {
      const student = mockDb.students.find(s => s.userId === studentUserId);
      if (student) {
        const mappings = mockDb.parentStudentMappings.filter(m => m.studentId === student.id);
        for (const mapping of mappings) {
          const parent = mockDb.parents.find(p => p.id === mapping.parentId);
          if (parent) {
            await this.sendNotification(
              parent.userId,
              title,
              message,
              category,
              schoolId,
              senderId,
              'PARENT',
              priority
            );
          }
        }
      }
    } catch (e) {
      console.error('Failed to notify parents:', e);
    }
  },

  async sendUpcomingDeadlineReminders(schoolId: string): Promise<void> {
    const activeSessionId = await this.resolveActiveSessionId(schoolId).catch(() => 'session-1');
    const now = new Date();
    const twoDaysFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const upcomingAssignments = mockDb.assignments.filter(a => {
      if (a.schoolId !== schoolId) return false;
      const due = new Date(a.dueDate);
      return due > now && due <= twoDaysFromNow;
    });

    for (const a of upcomingAssignments) {
      const submissions = mockDb.assignmentSubmissions.filter(sub => sub.assignmentId === a.id);
      const submittedStudentIds = submissions.map(sub => sub.studentId);

      const students = mockDb.students.filter(s => s.classId === a.classId);
      for (const st of students) {
        if (!submittedStudentIds.includes(st.id)) {
          const alreadyReminded = mockDb.notifications.some(
            n => n.userId === st.userId && n.title === 'Upcoming Assignment Reminder' && n.message.includes(a.title)
          );
          if (!alreadyReminded) {
            await this.sendNotificationToUserAndParents(
              st.userId,
              'Upcoming Assignment Reminder',
              `Reminder: "${a.title}" is due soon (by ${new Date(a.dueDate).toLocaleString()}).`,
              'Assignment',
              schoolId,
              null,
              'HIGH'
            );
          }
        }
      }
    }
  },

  async syncChatMessagesData(userId: string): Promise<void> {
    try {
      // 1. Get all channel IDs for the user
      const { data: participants, error: partError } = await supabaseAdmin
        .from('communication_participants')
        .select('channel_id')
        .eq('user_id', userId);

      if (partError) throw partError;
      
      // Clear local chatMessages list so we discard any mock/residual messages
      mockDb.chatMessages = [];

      if (!participants || participants.length === 0) {
        mockDb.saveAll();
        return;
      }

      const channelIds = participants.map((p: any) => p.channel_id);

      // 2. Fetch all participants of those channels
      const { data: allParticipants, error: allPartError } = await supabaseAdmin
        .from('communication_participants')
        .select('channel_id, user_id')
        .in('channel_id', channelIds);

      if (allPartError) throw allPartError;

      // 3. Fetch all messages in those channels
      const { data: dbMessages, error: msgError } = await supabaseAdmin
        .from('communication_messages')
        .select('*')
        .in('channel_id', channelIds);

      if (msgError) throw msgError;

      if (dbMessages && allParticipants) {
        // Group participants by channel
        const participantsByChannel: Record<string, string[]> = {};
        allParticipants.forEach((p: any) => {
          if (!participantsByChannel[p.channel_id]) {
            participantsByChannel[p.channel_id] = [];
          }
          participantsByChannel[p.channel_id].push(p.user_id);
        });

        dbMessages.forEach((r: any) => {
          const chParts = participantsByChannel[r.channel_id] || [];
          const receiverId = r.receiver_id || chParts.find((uid: string) => uid !== r.sender_id) || r.sender_id;

          const msg: ChatMessage = {
            id: r.id,
            senderId: r.sender_id,
            receiverId: receiverId,
            message: r.message_content,
            isRead: r.is_read || r.read_status,
            createdAt: r.created_at
          };
          const idx = mockDb.chatMessages.findIndex(x => x.id === msg.id);
          if (idx === -1) mockDb.chatMessages.push(msg);
          else mockDb.chatMessages[idx] = msg;
        });

        // Ensure all message participants are present in mockDb.users so getChatInbox can resolve them
        const allUserIdsInMessages = new Set<string>();
        dbMessages.forEach((r: any) => {
          if (r.sender_id) allUserIdsInMessages.add(r.sender_id);
          if (r.receiver_id) allUserIdsInMessages.add(r.receiver_id);
        });
        allParticipants.forEach((p: any) => {
          if (p.user_id) allUserIdsInMessages.add(p.user_id);
        });
        const missingUserIds = [...allUserIdsInMessages].filter(
          uid => uid !== userId && !mockDb.users.find(u => u.id === uid)
        );
        if (missingUserIds.length > 0) {
          const { data: missingUsers } = await supabaseAdmin
            .from('users')
            .select('*')
            .in('id', missingUserIds);
          if (missingUsers) {
            missingUsers.forEach((r: any) => {
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
                updatedAt: r.updated_at || r.created_at || new Date().toISOString()
              };
              const idx = mockDb.users.findIndex(u => u.id === user.id);
              if (idx === -1) mockDb.users.push(user);
              else mockDb.users[idx] = user;
            });
          }
        }

        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync chat messages:', e);
    }
  },

  async studentGetQuizQuestions(quizId: string): Promise<QuizQuestion[]> {
    await delay(300);
    const activeUser = getActiveUser();
    if (activeUser?.schoolId) {
      await this.validateSubscriptionFeature(activeUser.schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);
    }
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

    await this.validateSubscriptionFeature(student.schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);
    await this.syncQuizzesData(student.schoolId);

    // Find subjects in class via teacher mappings
    const activeSubjectIds = mockDb.teacherClassSubjectMappings
      .filter(m => m.classId === student.classId)
      .map(m => m.subjectId);

    const quizzes = mockDb.quizzes.filter(q => {
      const schoolMatches = q.schoolId === student.schoolId;
      if (!schoolMatches) return false;
      if (q.classId) {
        return q.classId === student.classId;
      }
      return activeSubjectIds.includes(q.subjectId);
    });

    return quizzes.map(quiz => {
      const attempt = mockDb.quizAttempts.find(a => a.quizId === quiz.id && a.studentId === studentId);
      return { quiz, attempt };
    });
  },

  async studentAttemptQuiz(studentId: string, quizId: string, answers: Record<string, number>, score: number): Promise<QuizAttempt> {
    await delay(400);
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) throw new Error('Student not found.');

    await this.validateSubscriptionFeature(student.schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);

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
    const students = mockDb.students.filter(s => studentIds.includes(s.id));

    // Sync users data for these students' schools
    const schoolIds = Array.from(new Set(students.map(s => s.schoolId)));
    for (const schoolId of schoolIds) {
      await this.syncUsersData(schoolId).catch(() => {});
    }

    return students
      .map(s => {
        const u = mockDb.users.find(usr => usr.id === s.userId) || {
          id: s.userId,
          email: '',
          role: 'STUDENT',
          firstName: 'Student',
          lastName: '',
          phone: '',
          avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
          isActive: true,
          schoolId: s.schoolId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as User;
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
    await this.syncSchoolsData(student.schoolId);
    await this.syncClassesData(student.schoolId);
    await this.syncTeachersData(student.schoolId);
    await this.syncSubjectsData(student.schoolId);
    await this.syncTeacherClassSubjectMappingsData(student.schoolId);
    await this.syncExamsData(student.schoolId);
    await this.syncExamSchedulesData(student.schoolId);
    await this.syncExamMarksData(student.schoolId);
    await this.syncTimetablesData(student.schoolId);
    await this.syncAssignmentsData(student.schoolId);
    await this.syncAssignmentSubmissionsData(student.schoolId);
    await this.syncHomeworkAttachmentsData(student.schoolId);
    await this.syncAttendanceData(student.schoolId);
    await this.syncFeeStructuresData(student.schoolId);
    await this.syncFeePaymentsData(student.schoolId);
    await this.syncUsersData(student.schoolId).catch(() => {});

    const userDetails = mockDb.users.find(u => u.id === student.userId);
    if (!userDetails) throw new Error('Student user profile not found.');
    const c = mockDb.classes.find(cls => cls.id === student.classId);

    const attendance = mockDb.attendance.filter(a => a.studentId === studentId);
    
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    mockDb.examSchedules = mockDb.examSchedules.filter(s => s.classId === student.classId ? isUUID(s.id) : true);
    
    // Fetch all exams for child's school
    await this.syncExamsData(student.schoolId);

    const { data: dbExamSubjects } = await supabaseAdmin
      .from('exam_subjects')
      .select('*, subject:subjects(*)')
      .eq('school_id', student.schoolId);

    const { data: dbStudentMarks } = await supabaseAdmin
      .from('student_marks')
      .select('*')
      .eq('school_id', student.schoolId)
      .eq('student_id', studentId);

    let examSubjects: any[] = [];
    if (dbExamSubjects) {
      examSubjects = dbExamSubjects.map(es => ({
        id: es.id,
        schoolId: es.school_id,
        examId: es.exam_id,
        subjectId: es.subject_id,
        maxMarks: Number(es.max_marks || 100),
        passingMarks: Number(es.passing_marks || 40),
        subject: es.subject
      }));
    } else {
      examSubjects = mockDb.examSubjects.filter(es => es.schoolId === student.schoolId);
    }

    let studentMarks: any[] = [];
    if (dbStudentMarks) {
      studentMarks = dbStudentMarks.map(sm => ({
        id: sm.id,
        schoolId: sm.school_id,
        examId: sm.exam_id,
        subjectId: sm.subject_id,
        studentId: sm.student_id,
        marksObtained: Number(sm.marks_obtained || 0),
        remarks: sm.remarks || ''
      }));
    } else {
      studentMarks = mockDb.studentMarks.filter(sm => sm.schoolId === student.schoolId && sm.studentId === studentId);
    }

    const examMarks = examSubjects.map(es => {
      const exam = mockDb.exams.find(e => e.id === es.examId);
      const subject = mockDb.subjects.find(sub => sub.id === es.subjectId) || es.subject;
      const mark = studentMarks.find(sm => sm.examId === es.examId && sm.subjectId === es.subjectId);
      return {
        examName: exam ? exam.name : 'Exam Assessment',
        subjectName: subject ? subject.name : 'Unknown Subject',
        subjectCode: subject ? subject.code : 'UNK',
        marksObtained: mark ? mark.marksObtained : null,
        maxMarks: es.maxMarks,
        remarks: mark ? mark.remarks : ''
      };
    });

    // Assignments Homework with strict section boundaries
    const assignments = mockDb.assignments.filter(a => {
      const schoolMatches = a.schoolId === student.schoolId;
      const classMatches = a.classId === student.classId;
      const sectionMatches = !student.sectionId || !a.sectionId || a.sectionId === student.sectionId;
      const sessionMatches = !a.academicSessionId || !student.academicSessionId || a.academicSessionId === student.academicSessionId || a.academicSessionId === 'session-1' || student.academicSessionId === 'session-1';
      return schoolMatches && classMatches && sectionMatches && sessionMatches;
    });
    const assignmentSummaries = assignments.map(a => {
      const submission = mockDb.assignmentSubmissions.find(
        sub => sub.assignmentId === a.id && sub.studentId === studentId
      );
      const subject = mockDb.subjects.find(sub => sub.id === a.subjectId);
      const teacher = a.teacherId ? mockDb.teachers.find(t => t.id === a.teacherId) : null;
      const teacherUser = teacher ? mockDb.users.find(u => u.id === teacher.userId) : null;
      // Get attachments from mockDb.homeworkAttachments linked by homework/assignment id
      const attachments = mockDb.homeworkAttachments.filter(att => att.homeworkId === a.id);
      return {
        id: a.id,
        title: a.title,
        description: a.description,
        dueDate: a.dueDate,
        isHomework: a.isHomework,
        submitted: !!submission,
        marksObtained: submission ? submission.marksObtained : null,
        maxMarks: a.maxMarks,
        feedback: submission ? submission.feedback : '',
        subjectName: subject ? subject.name : 'General',
        subjectCode: subject ? subject.code : '',
        teacherName: teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : 'Faculty',
        attachments: attachments,
        fileAttachmentUrl: a.fileAttachmentUrl || null,
        submissionFileUrl: submission ? submission.fileUrl : null,
        submittedAt: submission ? submission.submittedAt : null,
        createdAt: a.createdAt
      };
    });
    const structures = mockDb.feeStructures.filter(fs => fs.classId === student.classId);
    const feeSummaries = structures.map((fs: any) => {
      const payment = mockDb.feePayments.find(p => p.feeStructureId === fs.id && p.studentId === studentId);
      const hasProof = !!(payment && (payment.utrNumber || payment.paymentScreenshotUrl));
      const feeStatus = payment 
        ? (payment.status === 'PENDING' && !hasProof ? 'UNPAID' : payment.status) 
        : 'UNPAID';
      return {
        id: fs.id,
        description: fs.description,
        amount: fs.amount,
        dueDate: fs.dueDate,
        status: feeStatus,
        paymentDate: payment ? payment.paymentDate : '',
        paymentId: payment?.id || '',
        paymentScreenshotUrl: payment?.paymentScreenshotUrl || '',
        utrNumber: payment?.utrNumber || '',
        rejectionReason: payment?.rejectionReason || '',
        paymentMethod: payment?.paymentMethod || ''
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

  async verifySchoolFeature(schoolId: string, feature: string): Promise<void> {
    const planName = (await this.getLiveSchoolSubscriptionPlan(schoolId) || 'freemium').toLowerCase();
    const plan = subscriptionPlans[planName] || subscriptionPlans.freemium;
    if (!(plan.features as any)[feature]) {
      throw new Error(`Security Policy Alert: The requested feature (${String(feature)}) is locked under your institution's current "${planName.toUpperCase()}" subscription plan. Please upgrade to a higher tier.`);
    }
  },

  async verifyClassTeacherHubSubscription(teacherId: string): Promise<void> {
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');
    const schoolId = teacher.schoolId;
    if (!schoolId) throw new Error('Teacher has no school association.');
    const planName = await this.getLiveSchoolSubscriptionPlan(schoolId);
    if (planName !== 'pro' && planName !== 'enterprise') {
      throw new Error('Class Teacher Hub features are only available in Pro and Enterprise subscription plans.');
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

  async teacherGetClassStudentsReadOnly(teacherId: string, classId: string): Promise<(Student & { userDetails: User })[]> {
    await delay();
    await this.teacherSyncData(teacherId);
    
    // Safety check: is teacher mapped to teach this class?
    const isMapped = mockDb.teacherClassSubjectMappings.some(
      m => m.teacherId === teacherId && m.classId === classId
    );
    if (!isMapped) {
      throw new Error('Access denied: You are not assigned to teach this class.');
    }

    return mockDb.students
      .filter(s => s.classId === classId)
      .map(s => {
        const u = mockDb.users.find(usr => usr.id === s.userId)!;
        return {
          ...s,
          userDetails: u
        };
      });
  },

  async teacherGetClassStudents(teacherId: string, classId: string, date?: string): Promise<(Student & { userDetails: User; attendanceState?: string })[]> {
    await delay();
    await this.teacherSyncData(teacherId);
    
    // Safety check: is teacher the assigned Class Teacher?
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls) throw new Error('Class not found.');
    if (cls.classTeacherId !== teacherId) {
      throw new Error('Security Policy Violation: Daily attendance records are strictly reserved for the assigned Class Teacher of this class.');
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    return mockDb.students
      .filter(s => s.classId === classId)
      .map(s => {
        const u = mockDb.users.find(usr => usr.id === s.userId)!;
        const att = mockDb.attendance.find(a => a.studentId === s.id && a.date === targetDate);
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
    if (!cls) throw new Error('Class not found.');
    if (cls.classTeacherId !== teacherId) {
      throw new Error('Security Policy Violation: You are not the assigned Class Teacher for this class. Attendance modification denied.');
    }

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

    // Dispatch notifications for absent students
    for (const rec of records) {
      if (rec.status === 'ABSENT') {
        const student = mockDb.students.find(s => s.id === rec.studentId);
        if (student) {
          this.sendNotification(
            student.userId,
            "Attendance Alert: Absent",
            "You were marked absent in today's class.",
            'Attendance',
            teacher.schoolId,
            teacher.userId,
            'STUDENT',
            'HIGH'
          ).catch(e => console.error('Failed to notify absent student:', e));

          const mappings = mockDb.parentStudentMappings.filter(m => m.studentId === student.id);
          for (const mapping of mappings) {
            const parent = mockDb.parents.find(p => p.id === mapping.parentId);
            if (parent) {
              this.sendNotification(
                parent.userId,
                "Attendance Alert: Absent",
                "Your child was marked absent in today's class.",
                'Attendance',
                teacher.schoolId,
                teacher.userId,
                'PARENT',
                'HIGH'
              ).catch(e => console.error('Failed to notify parent about absence:', e));
            }
          }
        }
      }
    }

    mockDb.addLog(teacher.userId, 'MARK_ATTENDANCE', { classId, count: records.length, date });
    mockDb.saveAll();
  },

  async adminMarkAttendance(
    adminId: string, 
    classId: string, 
    date: string, 
    records: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; remarks?: string }[]
  ): Promise<void> {
    await delay(200);
    throw new Error('Security Policy Violation: Administrative roles are restricted to read-only attendance visibility. Daily register marking is exclusively reserved for the assigned Class Teacher.');
  },

  async teacherGetClassAttendanceAnalytics(teacherId: string, classId: string): Promise<any[]> {
    await delay(200);
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) throw new Error('Teacher not found.');

    await this.validateEnterpriseSubscription(teacher.schoolId);

    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls) throw new Error('Class not found.');

    if (cls.classTeacherId !== teacherId) {
      throw new Error('Security Policy Violation: Access denied. You are not the assigned Class Teacher for this class.');
    }

    const res = await this.fetchStudentAttendanceAnalytics(teacher.schoolId, classId);
    return res.students;
  },

  async fetchStudentAttendanceAnalytics(
    schoolId: string,
    classId?: string,
    sectionId?: string | null,
    academicSessionId?: string
  ): Promise<any> {
    const cacheKey = `${schoolId}_${classId || ''}_${sectionId || ''}_${academicSessionId || ''}`;
    const cachedEntry = attendanceAnalyticsCache[cacheKey];
    const CACHE_TTL = 15000; // 15 seconds TTL for fast reload
    if (cachedEntry && (Date.now() - cachedEntry.timestamp < CACHE_TTL)) {
      return cachedEntry.data;
    }

    await delay(100);
    // Sync all latest student and attendance data before aggregating
    await this.syncStudentsData(schoolId).catch(() => {});
    await this.syncAttendanceData(schoolId).catch(() => {});

    let studentList = mockDb.students.filter(s => s.schoolId === schoolId);
    if (classId) studentList = studentList.filter(s => s.classId === classId);
    if (sectionId) studentList = studentList.filter(s => s.sectionId === sectionId);
    if (academicSessionId) studentList = studentList.filter(s => s.academicSessionId === academicSessionId);

    const computed = studentList.map(st => {
      const user = mockDb.users.find(u => u.id === st.userId);
      const clsObj = mockDb.classes.find(c => c.id === st.classId);
      const secObj = st.sectionId ? mockDb.sections.find(s => s.id === st.sectionId) : null;
      const className = clsObj ? clsObj.name : 'Unassigned';
      const sectionName = secObj ? secObj.name : 'N/A';

      let records = mockDb.attendance.filter(a => a.studentId === st.id);
      if (classId) records = records.filter(a => a.classId === classId);
      if (academicSessionId) records = records.filter(a => a.academicSessionId === academicSessionId);
      
      // Class-specific marked attendance dates count as total working days
      let classRecords = mockDb.attendance.filter(a => a.classId === st.classId);
      if (academicSessionId) classRecords = classRecords.filter(a => a.academicSessionId === academicSessionId);
      const distinctDates = Array.from(new Set(classRecords.map(a => a.date)));
      const totalWorkingDays = distinctDates.length;

      const presentDays = records.filter(r => r.status === 'PRESENT').length;
      const absentDays = records.filter(r => r.status === 'ABSENT').length;
      const lateDays = records.filter(r => r.status === 'LATE').length;
      const excusedDays = records.filter(r => r.status === 'EXCUSED').length;

      const presentCount = presentDays + lateDays;
      const percentage = totalWorkingDays > 0 ? (presentCount / totalWorkingDays) * 100 : 100;
      const roundedPercentage = Math.round(percentage * 10) / 10;
      const eligibilityStatus = roundedPercentage >= 75 ? 'ELIGIBLE' : 'INELIGIBLE';
      
      const studentName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'N/A';
      const absenceRate = totalWorkingDays > 0 ? Math.round((absentDays / totalWorkingDays) * 100 * 10) / 10 : 0;
      const lateRate = totalWorkingDays > 0 ? Math.round((lateDays / totalWorkingDays) * 100 * 10) / 10 : 0;

      return {
        studentId: st.id,
        rollNumber: st.rollNumber,
        firstName: user?.firstName || 'N/A',
        lastName: user?.lastName || 'N/A',
        studentName,
        admissionNumber: st.admissionNumber,
        gender: st.gender,
        className,
        sectionName,
        totalWorkingDays,
        presentDays: presentCount,
        absentDays,
        lateDays,
        excusedDays,
        percentage: roundedPercentage,
        attendanceRate: roundedPercentage,
        absenceRate,
        lateRate,
        eligibilityStatus,
        lateRecords: records.filter(r => r.status === 'LATE').map(r => ({ date: r.date, remarks: r.remarks || 'Late entry' }))
      };
    });

    // Calculate aggregate metrics dynamically from database records
    const filteredStudentIds = studentList.map(s => s.id);
    let groupRecords = mockDb.attendance.filter(a => filteredStudentIds.includes(a.studentId));
    if (classId) groupRecords = groupRecords.filter(a => a.classId === classId);
    if (academicSessionId) groupRecords = groupRecords.filter(a => a.academicSessionId === academicSessionId);

    const totalRecords = groupRecords.length;
    const presentRecords = groupRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const overallPercentage = totalRecords > 0 ? (presentRecords / totalRecords) * 100 : 100;

    const absentStudents = new Set(groupRecords.filter(r => r.status === 'ABSENT').map(r => r.studentId));
    const absencesCount = absentStudents.size;

    const tardyStudents = new Set(groupRecords.filter(r => r.status === 'LATE').map(r => r.studentId));
    const tardyCount = tardyStudents.size;

    const chronicAbsentList = computed
      .filter(s => s.percentage < 90 && s.absentDays > 0)
      .map(s => ({
        student_name: s.studentName,
        missed_count: s.absentDays
      }));

    const result = {
      students: computed,
      overall_percentage: overallPercentage,
      absences_count: absencesCount,
      tardy_count: tardyCount,
      chronic_absent: chronicAbsentList
    };

    attendanceAnalyticsCache[cacheKey] = {
      timestamp: Date.now(),
      data: result
    };

    return result;
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
          .from('homework_submissions')
          .update({
            marks: marks,
            remarks: feedback,
            submission_status: 'GRADED',
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

  async teacherGetStudyMaterials(teacherId: string): Promise<(StudyMaterial & { subjectName: string; className: string })[]> {
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
        const cls = sm.classId ? mockDb.classes.find(c => c.id === sm.classId) : null;
        return {
          ...sm,
          subjectName: sub ? sub.name : 'Subject',
          className: cls ? cls.name : 'School-wide'
        };
      });
  },

  async teacherGetQuizzes(teacherId: string): Promise<Quiz[]> {
    await delay();
    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    if (!teacher) return [];
    const schoolId = teacher.schoolId;
    await this.validateSubscriptionFeature(schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);
    await this.syncQuizzesData(schoolId);
    return mockDb.quizzes
      .filter(q => q.teacherId === teacherId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async teacherCreateAssignment(teacherId: string, classId: string, subjectId: string, title: string, description: string, dueDate: string, isHomework: boolean, sectionId?: string | null, customId?: string | null): Promise<Assignment> {
    await delay(500);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    if (!teacher) throw new Error('Teacher not found.');
    const schoolId = teacher.schoolId;
    await this.validateEnterpriseSubscription(schoolId);
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    const { data: dbAssign, error } = await supabaseAdmin
      .from('homeworks')
      .insert({
        id: customId || undefined,
        school_id: schoolId,
        class_id: classId,
        section_id: sectionId || null,
        subject_id: subjectId,
        teacher_id: teacherId,
        title,
        description,
        instructions: description,
        due_date: dueDate,
        status: 'PUBLISHED',
        academic_session_id: academicSessionId
      })
      .select()
      .single();

    if (error || !dbAssign) {
      throw new Error(error?.message || 'Failed to create assignment in Supabase.');
    }

    const assign: Assignment = {
      id: dbAssign.id,
      schoolId: schoolId,
      classId: dbAssign.class_id,
      sectionId: dbAssign.section_id || undefined,
      subjectId: dbAssign.subject_id,
      teacherId: dbAssign.teacher_id,
      title: dbAssign.title,
      description: dbAssign.description,
      dueDate: dbAssign.due_date,
      maxMarks: 100,
      fileAttachmentUrl: dbAssign.attachment_url || undefined,
      attachments: mockDb.homeworkAttachments.filter(att => att.homeworkId === dbAssign.id),
      isHomework: dbAssign.status !== 'DRAFT',
      academicSessionId: dbAssign.academic_session_id || academicSessionId,
      createdAt: dbAssign.created_at
    };

    mockDb.assignments.unshift(assign);

    // Notify all students in class (filtered by section if section boundary is active) and their parents
    const studentsInClass = mockDb.students.filter(s => s.classId === classId && (!sectionId || s.sectionId === sectionId));
    studentsInClass.forEach(st => {
      this.sendNotificationToUserAndParents(
        st.userId,
        isHomework ? 'New Daily Homework Assigned' : 'New Major Assignment Released',
        `"${title}" is due by ${new Date(dueDate).toLocaleDateString()}. Check details.`,
        isHomework ? 'Homework' : 'Assignment',
        schoolId,
        teacher.userId,
        'MEDIUM'
      ).catch(e => console.error(e));
    });

    // Post to Group Discussion system notice
    this.postGroupDiscussionSystemNotice(
      schoolId,
      academicSessionId,
      classId,
      isHomework ? 'HOMEWORK' : 'ASSIGNMENT',
      title,
      teacher.userId
    ).catch(e => console.error('Failed to post system notice to group discussion:', e));

    mockDb.addLog(teacher.userId, 'CREATE_ASSIGNMENT', { classId, title });
    mockDb.saveAll();
    return assign;
  },

  async adminCreateAssignment(
    adminId: string, 
    classId: string, 
    subjectId: string, 
    title: string, 
    description: string, 
    dueDate: string, 
    isHomework: boolean, 
    sectionId?: string | null, 
    customId?: string | null
  ): Promise<Assignment> {
    await delay(500);
    const admin = mockDb.users.find(u => u.id === adminId);
    if (!admin) throw new Error('Admin not found.');
    const schoolId = admin.schoolId;
    if (!schoolId) throw new Error('Admin schoolId is undefined');
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    const { data: dbAssign, error } = await supabaseAdmin
      .from('homeworks')
      .insert({
        id: customId || undefined,
        school_id: schoolId,
        class_id: classId,
        section_id: sectionId || null,
        subject_id: subjectId,
        title,
        description,
        instructions: description,
        due_date: dueDate,
        status: 'PUBLISHED',
        academic_session_id: academicSessionId
      })
      .select()
      .single();

    if (error || !dbAssign) {
      throw new Error('Failed to create homework in database: ' + (error?.message || 'Unknown error'));
    }

    const ass: Assignment = {
      id: dbAssign.id,
      schoolId: schoolId,
      classId: dbAssign.class_id,
      sectionId: dbAssign.section_id || undefined,
      subjectId: dbAssign.subject_id,
      teacherId: null,
      title: dbAssign.title,
      description: dbAssign.description,
      dueDate: dbAssign.due_date,
      maxMarks: 100,
      fileAttachmentUrl: dbAssign.attachment_url || undefined,
      attachments: [],
      isHomework: true,
      academicSessionId: dbAssign.academic_session_id || academicSessionId,
      createdAt: dbAssign.created_at
    };

    const idx = mockDb.assignments.findIndex(a => a.id === ass.id);
    if (idx === -1) {
      mockDb.assignments.push(ass);
    } else {
      mockDb.assignments[idx] = ass;
    }

    // Post to Group Discussion system notice
    this.postGroupDiscussionSystemNotice(
      schoolId,
      academicSessionId,
      classId,
      'HOMEWORK',
      title,
      adminId
    ).catch(e => console.error('Failed to post system notice to group discussion:', e));

    await this.syncAssignmentsData(schoolId);
    mockDb.addLog(adminId, 'CREATE_HOMEWORK_ADMIN', { title, classId });
    mockDb.saveAll();
    return ass;
  },

  async teacherEditAssignment(assignmentId: string, classId: string, subjectId: string, title: string, description: string, dueDate: string, isHomework: boolean, sectionId?: string | null): Promise<Assignment> {
    await delay(500);

    const { data: currentAssign } = await supabaseAdmin
      .from('homeworks')
      .select('school_id')
      .eq('id', assignmentId)
      .maybeSingle();
    if (currentAssign) {
      await this.validateEnterpriseSubscription(currentAssign.school_id);
    }

    const { data: dbAssign, error } = await supabaseAdmin
      .from('homeworks')
      .update({
        class_id: classId,
        section_id: sectionId || null,
        subject_id: subjectId,
        title,
        description,
        instructions: description,
        due_date: dueDate
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
      sectionId: dbAssign.section_id || undefined,
      subjectId: dbAssign.subject_id,
      teacherId: dbAssign.teacher_id,
      title: dbAssign.title,
      description: dbAssign.description,
      dueDate: dbAssign.due_date,
      maxMarks: 100,
      fileAttachmentUrl: dbAssign.attachment_url || undefined,
      attachments: mockDb.homeworkAttachments.filter(att => att.homeworkId === dbAssign.id),
      isHomework: dbAssign.status !== 'DRAFT',
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

    const { data: currentAssign } = await supabaseAdmin
      .from('homeworks')
      .select('school_id')
      .eq('id', assignmentId)
      .maybeSingle();
    if (currentAssign) {
      await this.validateEnterpriseSubscription(currentAssign.school_id);
    }

    const { error } = await supabaseAdmin
      .from('homeworks')
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

    await this.validateSubscriptionFeature(schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);

    const totalMarks = questions.reduce((acc, q) => acc + q.marks, 0);
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    // 1. Insert Quiz into Supabase
    const { data: dbQuiz, error: quizError } = await supabaseAdmin
      .from('quizzes')
      .insert({
        school_id: schoolId,
        subject_id: subjectId,
        class_id: classId,
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
      schoolId: schoolId,
      subjectId: dbQuiz.subject_id,
      classId: dbQuiz.class_id,
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

    // Notify class students and their parents
    const studentsInClass = mockDb.students.filter(s => s.classId === classId);
    studentsInClass.forEach(st => {
      this.sendNotificationToUserAndParents(
        st.userId,
        'New Interactive Quiz Available',
        `The online quiz "${title}" has been published. Take it before the deadline.`,
        'Quiz',
        schoolId,
        teacher.userId,
        'MEDIUM'
      ).catch(e => console.error(e));
    });

    mockDb.addLog(teacher.userId, 'CREATE_QUIZ', { title, totalMarks });
    mockDb.saveAll();
    return quizMapped;
  },

  async teacherEditQuiz(quizId: string, title: string, duration: number): Promise<void> {
    await delay(500);
    const activeUser = getActiveUser();
    if (activeUser?.schoolId) {
      await this.validateSubscriptionFeature(activeUser.schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);
    }
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
    const activeUser = getActiveUser();
    if (activeUser?.schoolId) {
      await this.validateSubscriptionFeature(activeUser.schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);
    }
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
    checkCoreAdminOrAcademicAdmin();

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
    checkCoreAdminOrAcademicAdmin();
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
    checkCoreAdminOrAcademicAdmin();

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
    checkCoreAdminOrAcademicAdmin();

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
    const schoolId = await getAdminSchoolId();

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
    let currencyCode = 'USD';
    let currencySymbol = '$';

    if (schoolId) {
      const { data: dbSchool } = await supabaseAdmin.from('schools').select('*').eq('id', schoolId).maybeSingle();
      if (dbSchool) {
        schoolName = dbSchool.name;
        subscriptionPlan = dbSchool.subscription_plan ? dbSchool.subscription_plan.toLowerCase() : 'freemium';
        currencyCode = dbSchool.currency_code || 'USD';
        currencySymbol = dbSchool.currency_symbol || '$';
        
        // Sync local mockDb schools cache
        const schoolMapped: School = {
          id: dbSchool.id,
          name: dbSchool.name,
          address: dbSchool.address || '',
          phone: dbSchool.phone || '',
          subscriptionPlan: subscriptionPlan as any,
          createdAt: dbSchool.created_at,
          country: dbSchool.country || 'USA',
          currencyCode: currencyCode,
          currencySymbol: currencySymbol,
          timezone: dbSchool.timezone || 'America/New_York',
          logoUrl: dbSchool.logo_url || '',
          logoFileName: dbSchool.logo_file_name || '',
          logoUploadedAt: dbSchool.logo_uploaded_at || '',
          sealUrl: dbSchool.seal_url || '',
          sealFileName: dbSchool.seal_file_name || '',
          sealUploadedAt: dbSchool.seal_uploaded_at || ''
        };
        const idx = mockDb.schools.findIndex(s => s.id === dbSchool.id);
        if (idx === -1) mockDb.schools.push(schoolMapped);
        else mockDb.schools[idx] = schoolMapped;
        mockDb.saveAll();
      } else {
        const localSchool = mockDb.schools.find(s => s.id === schoolId);
        if (localSchool) {
          schoolName = localSchool.name;
          subscriptionPlan = localSchool.subscriptionPlan;
          currencyCode = localSchool.currencyCode || 'USD';
          currencySymbol = localSchool.currencySymbol || '$';
        }
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
      schoolId,
      schoolName,
      currencyCode,
      currencySymbol,
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
    const schoolId = await getAdminSchoolId();

    // Fetch live student profiles from Supabase (source of truth)
    const { data: studentRows, error } = await supabase
      .from('students')
      .select(`
        id, user_id, school_id, class_id, academic_session_id, admission_number, roll_number, date_of_birth, gender, created_at,
        users!inner(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
      `)
      .eq('school_id', schoolId);

    if (error || !studentRows || studentRows.length === 0) {
      // Graceful fallback to local seed data/cache
      const localSt = mockDb.students.filter(s => s.schoolId === schoolId);
      return localSt.map(s => {
        const u = mockDb.users.find(usr => usr.id === s.userId) || {
          id: s.userId, email: 'student@example.com', role: 'STUDENT', firstName: 'Student', lastName: 'Name', phone: '', avatarUrl: '', isActive: true, schoolId, password: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        const cls = mockDb.classes.find(c => c.id === s.classId);
        return { ...s, userDetails: u, className: cls?.name || 'Unassigned' };
      });
    }

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


  async adminCreateStudent(
    adminId: string, 
    email: string, 
    firstName: string, 
    lastName: string, 
    classId: string, 
    admissionNumber: string, 
    rollNumber: number, 
    gender: 'MALE' | 'FEMALE' | 'OTHER', 
    dob: string, 
    password: string,
    phone?: string
  ): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    const normalizedEmail = validateAndNormalizeEmail(email);

    // Verify system-wide uniqueness of Admission Number
    const { data: existingAdm } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('admission_number', admissionNumber)
      .maybeSingle();
    if (existingAdm) {
      throw new Error(`Registration failed: The admission number "${admissionNumber}" is already in use in the system.`);
    }

    // Resolve active academic session
    const activeSessionId = await this.resolveActiveSessionId(schoolId);

    // Verify uniqueness of Roll Number within the same school, class, and academic session
    const targetClassId = classId || null;
    let rollQuery = supabaseAdmin
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('academic_session_id', activeSessionId)
      .eq('roll_number', rollNumber);
    
    if (targetClassId === null) {
      rollQuery = rollQuery.is('class_id', null);
    } else {
      rollQuery = rollQuery.eq('class_id', targetClassId);
    }

    const { data: existingRoll } = await rollQuery.maybeSingle();
    if (existingRoll) {
      throw new Error(`Registration failed: The roll number "${rollNumber}" is already in use in this class and academic session.`);
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
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'STUDENT' }
    });
    if (authError || !authData.user) throw new Error('Failed to create student auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
      role: 'STUDENT',
      first_name: firstName,
      last_name: lastName,
      phone: phone || '',
      school_id: schoolId,
      is_active: true
    });
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create student database profile: ' + dbError.message);
    }

    // Insert login email into email_addresses table
    await supabaseAdmin.from('email_addresses').insert({
      user_id: newUserId,
      school_id: schoolId,
      email_type: 'LOGIN',
      email: normalizedEmail,
      is_primary: true,
      is_verified: true
    });

    // Insert phone number into phone_numbers table if provided
    const parsedStudentPhone = parseAndValidatePhone(phone || '');
    if (parsedStudentPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: newUserId,
        school_id: schoolId,
        phone_type: 'PRIMARY',
        country_code: parsedStudentPhone.countryCode,
        national_number: parsedStudentPhone.nationalNumber,
        full_number: parsedStudentPhone.fullNumber
      });
    }

    // Resolve sectionId
    let resolvedSectionId: string | null = null;
    if (classId) {
      const { data: secRow } = await supabaseAdmin
        .from('sections')
        .select('id')
        .eq('class_id', classId)
        .limit(1)
        .maybeSingle();
      if (secRow) {
        resolvedSectionId = secRow.id;
      }
    }

    // Insert into students table
    const { data: studentRow, error: studentErr } = await supabaseAdmin.from('students').insert({
      user_id: newUserId,
      school_id: schoolId,
      class_id: classId || null,
      section_id: resolvedSectionId,
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
      id: newUserId, email: normalizedEmail, role: 'STUDENT', firstName, lastName,
      phone: phone || '', avatarUrl: '', isActive: true, schoolId,
      password, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const student: Student = {
      id: studentRow.id, userId: newUserId, schoolId, classId,
      sectionId: resolvedSectionId,
      academicSessionId: activeSessionId,
      admissionNumber, rollNumber, dateOfBirth: dob, gender,
      createdAt: new Date().toISOString()
    };
    mockDb.users.push(user);
    mockDb.students.push(student);
    if (parsedStudentPhone.fullNumber) {
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: newUserId, schoolId,
        phoneType: 'PRIMARY',
        countryCode: parsedStudentPhone.countryCode,
        nationalNumber: parsedStudentPhone.nationalNumber,
        fullNumber: parsedStudentPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }
    const ea: EmailAddress = {
      id: 'ea-' + Math.random().toString(36).substr(2, 9),
      userId: newUserId,
      schoolId,
      emailType: 'LOGIN',
      email: normalizedEmail,
      isPrimary: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDb.emailAddresses.push(ea);

    mockDb.addLog(adminId, 'CREATE_STUDENT', { studentName: `${firstName} ${lastName}`, email: normalizedEmail });
    mockDb.saveAll();
  },
  async adminGetTeachers(): Promise<(Teacher & { userDetails: User })[]> {
    await delay();
    const schoolId = await getAdminSchoolId();

    // Fetch active user IDs who hold TEACHER or CLASS_TEACHER roles in user_roles table
    const { data: roleRows, error: roleError } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('school_id', schoolId)
      .eq('status', 'ACTIVE')
      .in('role_code', ['TEACHER', 'CLASS_TEACHER']);

    const teacherUserIds = roleRows ? Array.from(new Set(roleRows.map(r => r.user_id))) : [];

    let teacherRows: any[] = [];
    let queryError = null;

    if (teacherUserIds.length > 0) {
      const { data, error } = await supabase
        .from('teachers')
        .select(`
          id, user_id, school_id, employee_id, qualification, joining_date, specialization, created_at,
          users!inner(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
        `)
        .eq('school_id', schoolId)
        .in('user_id', teacherUserIds);
      
      teacherRows = data || [];
      queryError = error;
    }

    if (queryError || teacherRows.length === 0) {
      // Graceful fallback to local seed data
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
      const localT = mockDb.teachers.filter(t => t.schoolId === schoolId && isUUID(t.id) && (t.status === undefined || t.status === 'ACTIVE') && !t.deletedAt);
      return localT.map(t => {
        const u = mockDb.users.find(usr => usr.id === t.userId) || {
          id: t.userId, email: 'teacher@example.com', role: 'TEACHER', firstName: 'Teacher', lastName: 'Name', phone: '', avatarUrl: '', isActive: true, schoolId, password: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        return { ...t, userDetails: u };
      });
    }
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
        createdAt: row.created_at,
        status: 'ACTIVE',
        deletedAt: null
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
    const schoolId = await getAdminSchoolId();

    // Fetch live parent profiles from Supabase (source of truth)
    const { data: parentRows, error } = await supabase
      .from('parents')
      .select(`
        id, user_id, school_id, occupation, address, created_at,
        users!inner(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
      `)
      .eq('school_id', schoolId);

    if (error || !parentRows || parentRows.length === 0) {
      // Graceful fallback to local seed data
      const localP = mockDb.parents.filter(p => p.schoolId === schoolId);
      return localP.map(p => {
        const u = mockDb.users.find(usr => usr.id === p.userId) || {
          id: p.userId, email: 'parent@example.com', role: 'PARENT', firstName: 'Parent', lastName: 'Name', phone: '', avatarUrl: '', isActive: true, schoolId, password: '', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
        };
        const linkedStudentNames = mockDb.parentStudentMappings
          .filter(m => m.parentId === p.id)
          .map(m => {
            const s = mockDb.students.find(st => st.id === m.studentId);
            if (!s) return null;
            const su = mockDb.users.find(usr => usr.id === s.userId);
            return su ? `${su.firstName} ${su.lastName}` : null;
          }).filter(Boolean) as string[];
        return { ...p, userDetails: u, linkedStudentNames };
      });
    }

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
    const schoolId = await getAdminSchoolId();

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
    checkCoreAdminOrAcademicAdmin();
    const schoolId = await getAdminSchoolId();
    const activeSessionId = await this.resolveActiveSessionId(schoolId);

    // Insert into Supabase classes table
    const { data: classRow, error } = await supabaseAdmin.from('classes').insert({
      school_id: schoolId,
      name: className,
      academic_session_id: activeSessionId
    }).select('id, school_id, name, academic_session_id, created_at').single();

    if (error || !classRow) throw new Error('Failed to create class: ' + (error?.message || 'Unknown error'));

    // Auto-create section for this class if name is like "Grade 10-A"
    const parts = className.split('-');
    const sectionName = parts.length > 1 ? parts[1].trim() : 'A';
    try {
      const { data: secRow } = await supabaseAdmin.from('sections').insert({
        school_id: schoolId,
        class_id: classRow.id,
        name: sectionName
      }).select('id').single();
      if (secRow) {
        mockDb.sections.push({
          id: secRow.id,
          schoolId,
          classId: classRow.id,
          name: sectionName,
          createdAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.error('Failed to auto-create section in database:', e);
    }

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
    checkCoreAdminOrAcademicAdmin();
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls) throw new Error('Class not found');

    if (cls.classTeacherId) {
      const activeTeacher = mockDb.teachers.find(t => t.id === cls.classTeacherId);
      const activeUser = activeTeacher ? mockDb.users.find(u => u.id === activeTeacher.userId) : null;
      const isActive = activeTeacher && activeTeacher.status !== 'INACTIVE' && !activeTeacher.deletedAt && (!activeUser || activeUser.isActive);
      if (isActive) {
        throw new Error('This class already has an assigned Class Teacher.');
      }
    }

    await validateTeacherForTimetable(teacherId, cls.schoolId);
    
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

      const activeUser = getActiveUser();
      if (activeUser) {
        await this.writeAuditLog(
          activeUser.id,
          null,
          cls.schoolId,
          'academics',
          'CLASS_TEACHER_ASSIGNED',
          classId,
          null,
          { classId, teacherId }
        );
      }
    } catch (err: any) {
      console.error('Failed to assign class teacher:', err);
      throw new Error(err.message || 'Failed to assign class teacher in database.');
    }
  },

  async adminChangeClassTeacher(adminId: string, classId: string, teacherId: string): Promise<void> {
    await delay(300);
    checkCoreAdminOrAcademicAdmin();
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls) throw new Error('Class not found');
    const oldTeacherId = cls.classTeacherId;
    await validateTeacherForTimetable(teacherId, cls.schoolId);

    try {
      const { error } = await supabaseAdmin
        .from('classes')
        .update({ class_teacher_id: teacherId })
        .eq('id', classId);

      if (error) {
        throw new Error(error.message || 'Failed to change class teacher in database.');
      }
      
      cls.classTeacherId = teacherId;
      mockDb.addLog(adminId, 'CHANGE_CLASS_TEACHER', { classId, oldTeacherId, newTeacherId: teacherId });
      mockDb.saveAll();

      const activeUser = getActiveUser();
      if (activeUser) {
        await this.writeAuditLog(
          activeUser.id,
          null,
          cls.schoolId,
          'academics',
          'CLASS_TEACHER_CHANGED',
          classId,
          oldTeacherId ? { teacherId: oldTeacherId } : null,
          { classId, teacherId }
        );
      }
    } catch (err: any) {
      console.error('Failed to change class teacher:', err);
      throw new Error(err.message || 'Failed to change class teacher in database.');
    }
  },

  async adminRemoveClassTeacher(adminId: string, classId: string): Promise<void> {
    await delay(300);
    checkCoreAdminOrAcademicAdmin();
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls) throw new Error('Class not found');
    const oldTeacherId = cls.classTeacherId;

    try {
      const { error } = await supabaseAdmin
        .from('classes')
        .update({ class_teacher_id: null })
        .eq('id', classId);

      if (error) {
        throw new Error(error.message || 'Failed to remove class teacher in database.');
      }
      
      cls.classTeacherId = undefined;
      mockDb.addLog(adminId, 'REMOVE_CLASS_TEACHER', { classId, oldTeacherId });
      mockDb.saveAll();

      const activeUser = getActiveUser();
      if (activeUser) {
        await this.writeAuditLog(
          activeUser.id,
          null,
          cls.schoolId,
          'academics',
          'CLASS_TEACHER_REMOVED',
          classId,
          oldTeacherId ? { teacherId: oldTeacherId } : null,
          null
        );
      }
    } catch (err: any) {
      console.error('Failed to remove class teacher:', err);
      throw new Error(err.message || 'Failed to remove class teacher in database.');
    }
  },
  async adminGetSubjects(): Promise<Subject[]> {
    await delay();
    const schoolId = await getAdminSchoolId();

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
    const activeUser = getActiveUser();
    if (!activeUser || !['ADMIN', 'ACADEMIC_ADMIN'].includes(activeUser.role)) {
      throw new Error('Access Denied: Only School Admin (ADMIN) and Academic Admin (ACADEMIC_ADMIN) are authorized to register subjects in the Subject Catalog.');
    }
    const schoolId = await getAdminSchoolId();

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

  async adminEditSubject(adminId: string, subjectId: string, name: string, code: string, description: string): Promise<Subject> {
    await delay(300);
    const activeUser = getActiveUser();
    if (!activeUser || !['ADMIN', 'ACADEMIC_ADMIN'].includes(activeUser.role)) {
      throw new Error('Access Denied: Only School Admin (ADMIN) and Academic Admin (ACADEMIC_ADMIN) are authorized to modify subjects in the Subject Catalog.');
    }
    const { data: subRow, error } = await supabaseAdmin.from('subjects').update({
      name, code, description
    }).eq('id', subjectId).select('id, school_id, name, code, description').single();

    if (error || !subRow) throw new Error('Failed to update subject: ' + (error?.message || 'Unknown error'));

    const sub: Subject = { id: subRow.id, schoolId: subRow.school_id, name: subRow.name, code: subRow.code, description: subRow.description || '' };
    const idx = mockDb.subjects.findIndex(s => s.id === subjectId);
    if (idx !== -1) {
      mockDb.subjects[idx] = sub;
    }
    mockDb.addLog(adminId, 'EDIT_SUBJECT', { name, code });
    mockDb.saveAll();
    return sub;
  },

  async adminDeleteSubject(adminId: string, subjectId: string): Promise<void> {
    await delay(300);
    const activeUser = getActiveUser();
    if (!activeUser || !['ADMIN', 'ACADEMIC_ADMIN'].includes(activeUser.role)) {
      throw new Error('Access Denied: Only School Admin (ADMIN) and Academic Admin (ACADEMIC_ADMIN) are authorized to delete subjects from the Subject Catalog.');
    }
    const { error } = await supabaseAdmin.from('subjects').delete().eq('id', subjectId);
    if (error) throw new Error('Failed to delete subject: ' + error.message);

    mockDb.subjects = mockDb.subjects.filter(s => s.id !== subjectId);
    mockDb.addLog(adminId, 'DELETE_SUBJECT', { subjectId });
    mockDb.saveAll();
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
    checkCoreAdminOrAcademicAdmin();

    const teacher = mockDb.teachers.find(t => t.id === teacherId);
    const schoolId = teacher ? teacher.schoolId : await getAdminSchoolId();
    await validateTeacherForTimetable(teacherId, schoolId);

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
      await this.syncTimetablesData(schoolId);
      validateTimetableConflicts(schoolId, undefined, classId, teacherId, dayOfWeek, startTime, endTime, classroomNumber);

      try {
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
          const newTt = {
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
          mockDb.timetables.push(newTt);

          // Post to Group Discussion system notice
          this.postGroupDiscussionSystemNotice(
            schoolId,
            academicSessionId,
            classId,
            'TIMETABLE',
            `Timetable updated for this class`,
            adminId
          ).catch(e => console.error('Failed to post system notice to group discussion:', e));

          const activeUser = getActiveUser();
          if (activeUser) {
            await this.writeAuditLog(
              activeUser.id,
              null,
              schoolId,
              'academics',
              'TIMETABLE_CREATED',
              dbTt.id,
              null,
              newTt
            );
          }
        }
      } catch (err: any) {
        console.error(err);
        throw new Error(err.message || 'Failed to save mapping timetable in database.');
      }
    }

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
    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    const normalizedEmail = validateAndNormalizeEmail(email);

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
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'TEACHER' }
    });
    if (authError || !authData.user) throw new Error('Failed to create teacher auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
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

    // Insert login email into email_addresses table
    await supabaseAdmin.from('email_addresses').insert({
      user_id: newUserId,
      school_id: schoolId,
      email_type: 'LOGIN',
      email: normalizedEmail,
      is_primary: true,
      is_verified: true
    });

    // Insert phone number into phone_numbers table if provided
    const parsedTeacherPhone = parseAndValidatePhone(phone);
    if (parsedTeacherPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: newUserId,
        school_id: schoolId,
        phone_type: 'PRIMARY',
        country_code: parsedTeacherPhone.countryCode,
        national_number: parsedTeacherPhone.nationalNumber,
        full_number: parsedTeacherPhone.fullNumber
      });
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

    // Insert into user_roles table
    await supabaseAdmin.from('user_roles').insert({
      user_id: newUserId,
      school_id: schoolId,
      role_code: 'TEACHER',
      status: 'ACTIVE',
      assigned_by: adminId
    });

    // Log the audit event for role changes
    await supabaseAdmin.from('role_changes').insert({
      event_type: 'ROLE_CREATED',
      user_id: newUserId,
      school_id: schoolId,
      old_value: null,
      new_value: 'TEACHER',
      changed_by: adminId,
      ip_address: '127.0.0.1',
      device_id: 'browser'
    });

    // Sync to local mockDb cache
    const user: User = {
      id: newUserId, email: normalizedEmail, role: 'TEACHER', firstName, lastName,
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
    if (parsedTeacherPhone.fullNumber) {
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: newUserId, schoolId,
        phoneType: 'PRIMARY',
        countryCode: parsedTeacherPhone.countryCode,
        nationalNumber: parsedTeacherPhone.nationalNumber,
        fullNumber: parsedTeacherPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }
    const ea: EmailAddress = {
      id: 'ea-' + Math.random().toString(36).substr(2, 9),
      userId: newUserId,
      schoolId,
      emailType: 'LOGIN',
      email: normalizedEmail,
      isPrimary: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDb.emailAddresses.push(ea);

    mockDb.addLog(adminId, 'CREATE_TEACHER', { teacherName: `${firstName} ${lastName}`, email: normalizedEmail });
    mockDb.saveAll();
  },

  async adminCreateSubAdmin(
    adminId: string, 
    email: string, 
    firstName: string, 
    lastName: string, 
    phone: string, 
    role: 'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'HOSTEL_ADMIN' | 'WARDEN' | 'SPORTS_ADMIN' | 'CUSTOM_SUB_ADMIN', 
    password: string,
    employeeId?: string,
    username?: string,
    gender?: string,
    address?: string,
    assignedLocations?: any[],
    isActive?: boolean,
    designation?: string,
    joiningDate?: string
  ): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || (admin.role !== 'ADMIN' && (admin.role !== 'HOSTEL_ADMIN' || role !== 'WARDEN'))) throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    const planName = await this.getLiveSchoolSubscriptionPlan(schoolId);
    if (planName !== 'pro' && planName !== 'enterprise') {
      throw new Error('Provisioning sub-admin operators requires an active Pro or Enterprise Subscription plan.');
    }

    const normalizedEmail = validateAndNormalizeEmail(email);
    const trimmedEmployeeId = employeeId?.trim() || '';

    // Validate Employee ID uniqueness within school if provided
    if (trimmedEmployeeId) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('school_id', schoolId)
        .eq('employee_id', trimmedEmployeeId)
        .maybeSingle();
      
      if (existingUser) {
        throw new Error(`Employee ID "${trimmedEmployeeId}" is already assigned to ${existingUser.first_name} ${existingUser.last_name} (${existingUser.role}). Each Employee ID must be unique within your school.`);
      }
    }

    // Resolve matching role_id if exists, otherwise seed it
    const roleNameMap: Record<string, string> = {
      'FINANCE_ADMIN': 'Finance Admin',
      'ACADEMIC_ADMIN': 'Academic Admin',
      'EXAM_CONTROLLER': 'Exam Controller',
      'LIBRARIAN': 'Librarian',
      'TRANSPORT_MANAGER': 'Transport Manager',
      'HOSTEL_ADMIN': 'Hostel Admin',
      'WARDEN': 'Hostel Warden',
      'CUSTOM_SUB_ADMIN': 'Custom Operator',
      'SPORTS_ADMIN': 'Sports Admin'
    };
    const roleDescMap: Record<string, string> = {
      'FINANCE_ADMIN': 'Responsible for billing, invoices, payment structures, and fee tracking.',
      'ACADEMIC_ADMIN': 'Manages classes, sections, timetables, subjects, and study structures.',
      'EXAM_CONTROLLER': 'Administers examinations, quiz configurations, marksheets, and grading books.',
      'LIBRARIAN': 'Manages library book inventory, issue/return logs, and late fee tracking.',
      'TRANSPORT_MANAGER': 'Administers school buses, routes, driver information, and passenger maps.',
      'HOSTEL_ADMIN': 'Responsible for hostels, blocks, floors, rooms, beds, admissions, leave requests, visitor logs, complaints, and mess menus.',
      'WARDEN': 'Responsible for daily hostel operations, attendance logging, and initial leave requests.',
      'CUSTOM_SUB_ADMIN': 'Customizable operator role with custom-assigned modular access tags.',
      'SPORTS_ADMIN': 'Responsible for managing sports schedules, teams, matches, coach attendances, and sports-module finances.'
    };
    const defaultRolePermissions: Record<string, Record<string, boolean>> = {
      'FINANCE_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
      'ACADEMIC_ADMIN': { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true, hostel: false },
      'EXAM_CONTROLLER': { billing: false, directory: true, academics: true, grading: true, security: false, books: false, transport: false, hostel: false },
      'LIBRARIAN': { billing: false, directory: true, academics: true, grading: false, security: false, books: true, transport: false, hostel: false },
      'TRANSPORT_MANAGER': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
      'HOSTEL_ADMIN': { billing: false, directory: false, academics: false, grading: false, security: false, books: false, transport: false, hostel: true },
      'WARDEN': { billing: false, directory: false, academics: false, grading: false, security: false, books: false, transport: false, hostel: true },
      'CUSTOM_SUB_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false, hostel: false },
      'SPORTS_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false, hostel: false }
    };

    let { data: dbRole } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role_code', role)
      .maybeSingle();

    let roleId = dbRole?.id || null;

    if (!roleId) {
      const roleName = roleNameMap[role] || role.replace('_', ' ');
      const description = roleDescMap[role] || 'Modular sub-admin role.';
      
      const { data: newRole, error: roleError } = await supabaseAdmin
        .from('roles')
        .insert({
          school_id: schoolId,
          role_code: role,
          role_name: roleName,
          description: description
        })
        .select('id')
        .single();
      
      if (newRole && !roleError) {
        roleId = newRole.id;
        const perms = defaultRolePermissions[role] || {};
        const permissionRows = Object.keys(perms).map(moduleName => ({
          role_id: roleId,
          module_name: moduleName,
          can_view: perms[moduleName],
          can_create: perms[moduleName],
          can_edit: perms[moduleName],
          can_delete: perms[moduleName]
        }));
        await supabaseAdmin.from('role_permissions').insert(permissionRows);
      }
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: role }
    });
    if (authError || !authData.user) throw new Error('Failed to create auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table with employee_id and role_id
    const userInsert: any = {
      id: newUserId,
      email: normalizedEmail,
      role: role,
      role_id: roleId,
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      school_id: schoolId,
      is_active: isActive !== undefined ? isActive : true
    };
    if (trimmedEmployeeId) userInsert.employee_id = trimmedEmployeeId;

    const { error: dbError } = await supabaseAdmin.from('users').insert(userInsert);
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create user database profile: ' + dbError.message);
    }

    // Insert into user_roles table
    await supabaseAdmin.from('user_roles').insert({
      user_id: newUserId,
      school_id: schoolId,
      role_code: role,
      status: 'ACTIVE',
      assigned_by: adminId
    });

    // Log the audit event for role changes
    await supabaseAdmin.from('role_changes').insert({
      event_type: 'ROLE_CREATED',
      user_id: newUserId,
      school_id: schoolId,
      old_value: null,
      new_value: role,
      changed_by: adminId,
      ip_address: '127.0.0.1',
      device_id: 'browser'
    });

    // Dynamically insert into matching dedicated sub-admin table with employee_id
    let dedicatedTable = '';
    if (role === 'FINANCE_ADMIN') dedicatedTable = 'finance_admins';
    else if (role === 'ACADEMIC_ADMIN') dedicatedTable = 'academic_admins';
    else if (role === 'EXAM_CONTROLLER') dedicatedTable = 'exam_controllers';
    else if (role === 'LIBRARIAN') dedicatedTable = 'librarians';
    else if (role === 'TRANSPORT_MANAGER') dedicatedTable = 'transport_managers';
    else if (role === 'HOSTEL_ADMIN') dedicatedTable = 'hostel_admins';
    else if (role === 'WARDEN') dedicatedTable = 'hostel_wardens';
    else if (role === 'CUSTOM_SUB_ADMIN') dedicatedTable = 'custom_sub_admins';
    else if (role === 'SPORTS_ADMIN') dedicatedTable = 'sports_admins';

    if (dedicatedTable) {
      const profileInsert: any = {
        user_id: newUserId,
        school_id: schoolId
      };
      if (role === 'WARDEN') {
        profileInsert.phone = phone;
        profileInsert.hostel_id = null;
        profileInsert.username = username || null;
        profileInsert.gender = gender || null;
        profileInsert.address = address || null;
        profileInsert.assigned_locations = assignedLocations || [];
        profileInsert.first_name = firstName;
        profileInsert.last_name = lastName;
        profileInsert.email = email;
        profileInsert.employee_id = trimmedEmployeeId || null;
        profileInsert.status = isActive !== undefined ? (isActive ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE';
        profileInsert.designation = designation || null;
        profileInsert.joining_date = joiningDate || new Date().toISOString().split('T')[0];
      } else if (role === 'SPORTS_ADMIN') {
        profileInsert.employee_id = trimmedEmployeeId || null;
        profileInsert.full_name = `${firstName} ${lastName}`.trim();
        profileInsert.email = normalizedEmail;
        profileInsert.mobile = phone || null;
        profileInsert.status = isActive !== undefined ? (isActive ? 'ACTIVE' : 'INACTIVE') : 'ACTIVE';
      } else {
        profileInsert.role_id = roleId;
        profileInsert.status = 'ACTIVE';
        profileInsert.permissions = {};
        if (trimmedEmployeeId) profileInsert.employee_id = trimmedEmployeeId;
      }

      const { data: wardenData, error: profileErr } = await supabaseAdmin.from(dedicatedTable).insert(profileInsert).select('id').single();
      if (profileErr) {
        // Rollback
        await supabaseAdmin.from('users').delete().eq('id', newUserId);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw new Error('Failed to create dedicated sub-admin profile record: ' + profileErr.message);
      }

      if (role === 'WARDEN' && wardenData && assignedLocations && assignedLocations.length > 0) {
        const assignmentRows = assignedLocations.map((loc: any) => ({
          warden_id: wardenData.id,
          building_id: loc.buildingId || loc.hostelId,
          block_id: loc.blockId || null,
          assigned_by: newUserId,
          status: 'ACTIVE'
        }));
        await supabaseAdmin.from('hostel_warden_assignments').insert(assignmentRows);
        
        // Update mockDb cache
        assignedLocations.forEach((loc: any) => {
          mockDb.hostelWardenAssignments.push({
            id: Math.random().toString(36).substring(2, 11),
            wardenId: wardenData.id,
            buildingId: loc.buildingId || loc.hostelId,
            blockId: loc.blockId || null,
            assignedBy: newUserId,
            assignedAt: new Date().toISOString(),
            status: 'ACTIVE'
          });
        });

        // Update blocks in cache and Supabase to link to this warden
        const newBlockIds = assignedLocations.map((loc: any) => loc.blockId || loc.hostelBlockId).filter(Boolean);
        for (const blockId of newBlockIds) {
          const b = mockDb.hostelBlocks.find(x => x.id === blockId);
          if (b) {
            b.wardenId = wardenData.id;
          }
          try {
            await supabaseAdmin.from('hostel_blocks').update({ warden_id: wardenData.id }).eq('id', blockId);
          } catch (err) {
            console.error('Failed to update hostel block warden:', err);
          }
        }
      }
    }


    // Write Audit Log
    try {
      await mockApi.writeAuditLog(
        adminId,
        null,
        schoolId,
        'directory',
        'CREATE_USER',
        newUserId,
        null,
        { email: normalizedEmail, firstName, lastName, role, phone, employeeId: trimmedEmployeeId || undefined }
      );
    } catch (err) {
      console.error('Audit logging failed:', err);
    }


    // Insert login email into email_addresses table
    await supabaseAdmin.from('email_addresses').insert({
      user_id: newUserId,
      school_id: schoolId,
      email_type: 'LOGIN',
      email: normalizedEmail,
      is_primary: true,
      is_verified: true
    });

    // Insert phone number into phone_numbers table if provided
    if (phone) {
      const parsedPhone = parseAndValidatePhone(phone);
      if (parsedPhone.fullNumber) {
        await supabaseAdmin.from('phone_numbers').insert({
          user_id: newUserId,
          school_id: schoolId,
          phone_type: 'PRIMARY',
          country_code: parsedPhone.countryCode,
          national_number: parsedPhone.nationalNumber,
          full_number: parsedPhone.fullNumber
        });
      }
    }

    // Sync to local mockDb cache
    const user: User = {
      id: newUserId, email: normalizedEmail, role: role, firstName, lastName,
      phone: phone || '', avatarUrl: '', isActive: true, schoolId,
      employeeId: trimmedEmployeeId || undefined,
      password, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    mockDb.users.push(user);

    // If warden, also push to hostelWardens cache immediately so the table renders instantly
    if (role === 'WARDEN') {
      // Query the newly inserted hostel_wardens row to get its id
      const { data: newWardenRow } = await supabaseAdmin
        .from('hostel_wardens')
        .select('*')
        .eq('user_id', newUserId)
        .eq('school_id', schoolId)
        .maybeSingle();
      if (newWardenRow) {
        mockDb.hostelWardens.push({
          id: newWardenRow.id,
          schoolId: newWardenRow.school_id,
          userId: newWardenRow.user_id,
          hostelId: newWardenRow.hostel_id,
          phone: newWardenRow.phone,
          username: newWardenRow.username || '',
          gender: newWardenRow.gender || '',
          address: newWardenRow.address || '',
          assignedLocations: newWardenRow.assigned_locations || [],
          userDetails: user,
          createdBy: newWardenRow.created_by,
          updatedBy: newWardenRow.updated_by
        });
      }
    }

    mockDb.addLog(adminId, 'CREATE_SUB_ADMIN', { subAdminName: `${firstName} ${lastName}`, role: role, email: normalizedEmail, employeeId: trimmedEmployeeId || undefined });
    mockDb.saveAll();
    if (role === 'WARDEN' || role === 'HOSTEL_ADMIN') {
      this.clearHostelCache(schoolId);
    }
  },

  async adminEditSubAdmin(
    adminId: string,
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    phone: string,
    role: 'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'CUSTOM_SUB_ADMIN' | 'HOSTEL_ADMIN' | 'WARDEN' | 'SPORTS_ADMIN',
    employeeId: string,
    isActive: boolean
  ): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    const planName = await this.getLiveSchoolSubscriptionPlan(schoolId);
    if (planName !== 'pro' && planName !== 'enterprise') {
      throw new Error('Modifying sub-admin operators requires an active Pro or Enterprise Subscription plan.');
    }

    const normalizedEmail = validateAndNormalizeEmail(email);
    const trimmedEmployeeId = employeeId.trim();

    // Validate Employee ID uniqueness within school if provided
    if (trimmedEmployeeId) {
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id, first_name, last_name, role')
        .eq('school_id', schoolId)
        .eq('employee_id', trimmedEmployeeId)
        .neq('id', userId)
        .maybeSingle();
      
      if (existingUser) {
        throw new Error(`Employee ID "${trimmedEmployeeId}" is already assigned to ${existingUser.first_name} ${existingUser.last_name} (${existingUser.role}). Each Employee ID must be unique within your school.`);
      }
    }

    const { data: userRow } = await supabaseAdmin.from('users').select('role, role_id, email, deactivated_at, deactivated_by').eq('id', userId).single();
    if (!userRow) throw new Error('Operator profile not found.');
    const oldRole = userRow.role;
    const oldEmail = userRow.email;

    // Resolve matching role_id if exists, otherwise seed it
    const roleNameMap: Record<string, string> = {
      'FINANCE_ADMIN': 'Finance Admin',
      'ACADEMIC_ADMIN': 'Academic Admin',
      'EXAM_CONTROLLER': 'Exam Controller',
      'LIBRARIAN': 'Librarian',
      'TRANSPORT_MANAGER': 'Transport Manager',
      'HOSTEL_ADMIN': 'Hostel Admin',
      'CUSTOM_SUB_ADMIN': 'Custom Operator',
      'SPORTS_ADMIN': 'Sports Admin'
    };
    const roleDescMap: Record<string, string> = {
      'FINANCE_ADMIN': 'Responsible for billing, invoices, payment structures, and fee tracking.',
      'ACADEMIC_ADMIN': 'Manages classes, sections, timetables, subjects, and study structures.',
      'EXAM_CONTROLLER': 'Administers examinations, quiz configurations, marksheets, and grading books.',
      'LIBRARIAN': 'Manages library book inventory, issue/return logs, and late fee tracking.',
      'TRANSPORT_MANAGER': 'Administers school buses, routes, driver information, and passenger maps.',
      'HOSTEL_ADMIN': 'Responsible for hostels, blocks, floors, rooms, beds, admissions, leave requests, visitor logs, complaints, and mess menus.',
      'CUSTOM_SUB_ADMIN': 'Customizable operator role with custom-assigned modular access tags.',
      'SPORTS_ADMIN': 'Responsible for managing sports schedules, teams, matches, coach attendances, and sports-module finances.'
    };
    const defaultRolePermissions: Record<string, Record<string, boolean>> = {
      'FINANCE_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
      'ACADEMIC_ADMIN': { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true, hostel: false },
      'EXAM_CONTROLLER': { billing: false, directory: true, academics: true, grading: true, security: false, books: false, transport: false, hostel: false },
      'LIBRARIAN': { billing: false, directory: true, academics: true, grading: false, security: false, books: true, transport: false, hostel: false },
      'TRANSPORT_MANAGER': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
      'HOSTEL_ADMIN': { billing: false, directory: false, academics: false, grading: false, security: false, books: false, transport: false, hostel: true },
      'CUSTOM_SUB_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false, hostel: false },
      'SPORTS_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false, hostel: false }
    };

    let targetRoleId: string | null = null;
    const { data: dbRole } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('school_id', schoolId)
      .eq('role_code', role)
      .maybeSingle();
    targetRoleId = dbRole?.id || null;

    if (!targetRoleId) {
      const roleName = roleNameMap[role] || role.replace('_', ' ');
      const description = roleDescMap[role] || 'Modular sub-admin role.';
      
      const { data: newRole } = await supabaseAdmin
        .from('roles')
        .insert({
          school_id: schoolId,
          role_code: role,
          role_name: roleName,
          description: description
        })
        .select('id')
        .single();
      
      if (newRole) {
        targetRoleId = newRole.id;
        const perms = defaultRolePermissions[role] || {};
        const permissionRows = Object.keys(perms).map(moduleName => ({
          role_id: targetRoleId,
          module_name: moduleName,
          can_view: perms[moduleName],
          can_create: perms[moduleName],
          can_edit: perms[moduleName],
          can_delete: perms[moduleName]
        }));
        await supabaseAdmin.from('role_permissions').insert(permissionRows);
      }
    }

    // Update Auth user
    const authUpdate: any = {
      user_metadata: { role }
    };
    if (normalizedEmail !== oldEmail) {
      authUpdate.email = normalizedEmail;
      authUpdate.email_confirm = true;
    }
    await supabaseAdmin.auth.admin.updateUserById(userId, authUpdate);

    // Update public.users
    const usersUpdate: any = {
      email: normalizedEmail,
      role: role,
      role_id: targetRoleId,
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      employee_id: trimmedEmployeeId,
      is_active: isActive,
      deactivated_at: isActive ? null : (userRow.deactivated_at || new Date().toISOString()),
      deactivated_by: isActive ? null : (userRow.deactivated_by || adminId)
    };

    const { error: usersError } = await supabaseAdmin
      .from('users')
      .update(usersUpdate)
      .eq('id', userId);
    if (usersError) throw new Error('Failed to update user profile: ' + usersError.message);

    // Dedicated tables sync
    const getTableName = (roleCode: string) => {
      if (roleCode === 'FINANCE_ADMIN') return 'finance_admins';
      if (roleCode === 'ACADEMIC_ADMIN') return 'academic_admins';
      if (roleCode === 'EXAM_CONTROLLER') return 'exam_controllers';
      if (roleCode === 'LIBRARIAN') return 'librarians';
      if (roleCode === 'TRANSPORT_MANAGER') return 'transport_managers';
      if (roleCode === 'HOSTEL_ADMIN') return 'hostel_admins';
      if (roleCode === 'WARDEN') return 'hostel_wardens';
      if (roleCode === 'CUSTOM_SUB_ADMIN') return 'custom_sub_admins';
      if (roleCode === 'SPORTS_ADMIN') return 'sports_admins';
      return '';
    };

    const oldTable = getTableName(oldRole);
    const newTable = getTableName(role);

    if (oldTable && newTable) {
      if (oldTable !== newTable) {
        // Delete old profile
        await supabaseAdmin.from(oldTable).delete().eq('user_id', userId);
        
        // Insert new profile
        if (newTable === 'hostel_wardens') {
          await supabaseAdmin.from('hostel_wardens').insert({
            user_id: userId,
            school_id: schoolId,
            phone: phone,
            hostel_id: null,
            username: null,
            gender: null,
            address: null,
            assigned_locations: []
          });
        } else if (newTable === 'sports_admins') {
          await supabaseAdmin.from('sports_admins').insert({
            user_id: userId,
            school_id: schoolId,
            employee_id: trimmedEmployeeId,
            full_name: `${firstName} ${lastName}`.trim(),
            email: normalizedEmail,
            mobile: phone || null,
            status: isActive ? 'ACTIVE' : 'INACTIVE'
          });
        } else {
          await supabaseAdmin.from(newTable).insert({
            user_id: userId,
            school_id: schoolId,
            role_id: targetRoleId,
            employee_id: trimmedEmployeeId,
            status: isActive ? 'ACTIVE' : 'INACTIVE',
            permissions: {},
            deactivated_at: isActive ? null : new Date().toISOString(),
            deactivated_by: isActive ? null : adminId
          });
        }
      } else {
        // Just update existing
        if (newTable === 'hostel_wardens') {
          await supabaseAdmin
            .from('hostel_wardens')
            .update({
              phone: phone
            })
            .eq('user_id', userId);
        } else if (newTable === 'sports_admins') {
          await supabaseAdmin
            .from('sports_admins')
            .update({
              employee_id: trimmedEmployeeId,
              full_name: `${firstName} ${lastName}`.trim(),
              email: normalizedEmail,
              mobile: phone || null,
              status: isActive ? 'ACTIVE' : 'INACTIVE'
            })
            .eq('user_id', userId);
        } else {
          await supabaseAdmin
            .from(newTable)
            .update({
              role_id: targetRoleId,
              employee_id: trimmedEmployeeId,
              status: isActive ? 'ACTIVE' : 'INACTIVE',
              deactivated_at: isActive ? null : new Date().toISOString(),
              deactivated_by: isActive ? null : adminId
            })
            .eq('user_id', userId);
        }
      }
    }

    // Sync email_addresses
    await supabaseAdmin
      .from('email_addresses')
      .update({ email: normalizedEmail })
      .eq('user_id', userId)
      .eq('email_type', 'LOGIN');

    // Sync phone_numbers
    if (phone) {
      const parsedPhone = parseAndValidatePhone(phone);
      if (parsedPhone.fullNumber) {
        const { data: phoneRow } = await supabaseAdmin.from('phone_numbers').select('id').eq('user_id', userId).maybeSingle();
        if (phoneRow) {
          await supabaseAdmin
            .from('phone_numbers')
            .update({
              country_code: parsedPhone.countryCode,
              national_number: parsedPhone.nationalNumber,
              full_number: parsedPhone.fullNumber
            })
            .eq('user_id', userId);
        } else {
          await supabaseAdmin.from('phone_numbers').insert({
            user_id: userId,
            school_id: schoolId,
            phone_type: 'PRIMARY',
            country_code: parsedPhone.countryCode,
            national_number: parsedPhone.nationalNumber,
            full_number: parsedPhone.fullNumber
          });
        }
      }
    }

    // Sync to local mockDb
    const cachedUser = mockDb.users.find(u => u.id === userId);
    if (cachedUser) {
      cachedUser.email = normalizedEmail;
      cachedUser.role = role;
      cachedUser.firstName = firstName;
      cachedUser.lastName = lastName;
      cachedUser.phone = phone;
      cachedUser.employeeId = trimmedEmployeeId || undefined;
      cachedUser.isActive = isActive;
      cachedUser.roleId = targetRoleId || undefined;
      cachedUser.deactivatedAt = isActive ? undefined : new Date().toISOString();
      cachedUser.deactivatedBy = isActive ? undefined : (adminId || undefined);
    }
    
    try {
      await mockApi.writeAuditLog(
        adminId,
        null,
        schoolId,
        'directory',
        'EDIT_USER',
        userId,
        null,
        { email: normalizedEmail, firstName, lastName, role, phone, employeeId: trimmedEmployeeId || undefined, isActive }
      );
    } catch (err) {
      console.error('Audit logging failed:', err);
    }

    mockDb.addLog(adminId, 'EDIT_SUB_ADMIN', { subAdminName: `${firstName} ${lastName}`, role, email: normalizedEmail, employeeId: trimmedEmployeeId || undefined });
    mockDb.saveAll();

    // Sync mockDb.hostelWardens list for warden additions/removals
    if (role === 'WARDEN') {
      const idx = mockDb.hostelWardens.findIndex(w => w.userId === userId);
      if (idx === -1) {
        const wId = 'w-' + Math.random().toString(36).substr(2, 9);
        mockDb.hostelWardens.push({
          id: wId,
          schoolId,
          userId,
          hostelId: null,
          phone,
          username: '',
          gender: '',
          address: '',
          assignedLocations: [],
          userDetails: cachedUser || undefined
        });
      } else {
        mockDb.hostelWardens[idx].phone = phone;
        if (cachedUser) mockDb.hostelWardens[idx].userDetails = cachedUser;
      }
    } else {
      mockDb.hostelWardens = mockDb.hostelWardens.filter(w => w.userId !== userId);
    }
    
    if (role === 'WARDEN' || oldRole === 'WARDEN' || role === 'HOSTEL_ADMIN' || oldRole === 'HOSTEL_ADMIN') {
      this.clearHostelCache(schoolId);
    }
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
    password?: string,
    emergencyPhone?: string
  ): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    const normalizedEmail = validateAndNormalizeEmail(email);

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
      email: normalizedEmail,
      password: pass,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'PARENT' }
    });
    if (authError || !authData.user) throw new Error('Failed to create parent auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
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

    // Insert login email into email_addresses table
    await supabaseAdmin.from('email_addresses').insert({
      user_id: newUserId,
      school_id: schoolId,
      email_type: 'LOGIN',
      email: normalizedEmail,
      is_primary: true,
      is_verified: true
    });

    // Insert phone number into phone_numbers table if provided
    const parsedParentPhone = parseAndValidatePhone(phone);
    if (parsedParentPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: newUserId,
        school_id: schoolId,
        phone_type: 'PRIMARY',
        country_code: parsedParentPhone.countryCode,
        national_number: parsedParentPhone.nationalNumber,
        full_number: parsedParentPhone.fullNumber
      });
    }

    // Insert parent emergency phone number into phone_numbers table if provided
    const parsedParentEmergencyPhone = parseAndValidatePhone(emergencyPhone || '');
    if (parsedParentEmergencyPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: newUserId,
        school_id: schoolId,
        phone_type: 'EMERGENCY',
        country_code: parsedParentEmergencyPhone.countryCode,
        national_number: parsedParentEmergencyPhone.nationalNumber,
        full_number: parsedParentEmergencyPhone.fullNumber
      });
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
      id: newUserId, email: normalizedEmail, role: 'PARENT', firstName, lastName,
      phone, avatarUrl: '', isActive: true, schoolId,
      password: pass, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const parent: Parent = {
      id: parentRow.id, userId: newUserId, schoolId, occupation, address,
      createdAt: new Date().toISOString()
    };
    mockDb.users.push(user);
    mockDb.parents.push(parent);
    if (parsedParentPhone.fullNumber) {
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: newUserId, schoolId,
        phoneType: 'PRIMARY',
        countryCode: parsedParentPhone.countryCode,
        nationalNumber: parsedParentPhone.nationalNumber,
        fullNumber: parsedParentPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }
    if (parsedParentEmergencyPhone.fullNumber) {
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: newUserId, schoolId,
        phoneType: 'EMERGENCY',
        countryCode: parsedParentEmergencyPhone.countryCode,
        nationalNumber: parsedParentEmergencyPhone.nationalNumber,
        fullNumber: parsedParentEmergencyPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }
    const ea: EmailAddress = {
      id: 'ea-' + Math.random().toString(36).substr(2, 9),
      userId: newUserId,
      schoolId,
      emailType: 'LOGIN',
      email: normalizedEmail,
      isPrimary: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDb.emailAddresses.push(ea);

    if (resolvedStudentId && relationship) {
      mockDb.parentStudentMappings.push({ parentId: parentRow.id, studentId: resolvedStudentId, relationship });
    }
    mockDb.addLog(adminId, 'CREATE_PARENT', { parentName: `${firstName} ${lastName}`, email: normalizedEmail, studentId });
    mockDb.saveAll();
  },

  async adminDeleteTeacher(adminId: string, teacherId: string): Promise<void> {
    await delay(300);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role').eq('id', adminId).single();
    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

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
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role').eq('id', adminId).single();
    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

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
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role').eq('id', adminId).single();
    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

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

    // Fetch target user
    const { data: targetUser, error: userErr } = await supabaseAdmin
      .from('users')
      .select('id, role, school_id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (userErr || !targetUser) {
      return { deleted: false, role: 'UNKNOWN', message: `No user found with email: ${email}` };
    }

    // Fetch calling admin profile and verify school_id matches targetUser school_id
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from('users')
      .select('role, school_id')
      .eq('id', adminId)
      .single();

    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) {
      return { deleted: false, role: 'UNAUTHORIZED', message: 'Unauthorized' };
    }

    const adminSchoolId = admin.school_id;
    if (!adminSchoolId) {
      return { deleted: false, role: 'UNAUTHORIZED', message: 'Admin has no associated school' };
    }

    if (targetUser.school_id !== adminSchoolId) {
      return { deleted: false, role: 'UNAUTHORIZED', message: 'Unauthorized: You cannot delete a user belonging to another school.' };
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

    // Fetch calling admin profile and verify school_id
    const { data: admin, error: adminErr } = await supabaseAdmin
      .from('users')
      .select('role, school_id')
      .eq('id', adminId)
      .single();

    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) {
      throw new Error('Unauthorized');
    }

    const adminSchoolId = admin.school_id;
    if (!adminSchoolId) {
      throw new Error('Admin has no associated school');
    }

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

        // Verify school isolation: check public.users, raw_user_meta_data, and mockDb
        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('school_id')
          .eq('email', normalised)
          .maybeSingle();

        if (dbUser) {
          if (dbUser.school_id !== adminSchoolId) {
            results.push({ email: normalised, purged: false, message: 'Unauthorized: This user belongs to another school.' });
            continue;
          }
        } else {
          // If they don't exist in public.users, check if they exist in auth.users
          // but have user_metadata.school_id of another school
          if (match.user_metadata && match.user_metadata.school_id) {
            if (match.user_metadata.school_id !== adminSchoolId) {
              results.push({ email: normalised, purged: false, message: 'Unauthorized: This user belongs to another school.' });
              continue;
            }
          }
          // Also check mockDb.users for any cached record of this user
          const cachedUser = mockDb.users.find(u => u.email.toLowerCase() === normalised);
          if (cachedUser && cachedUser.schoolId !== adminSchoolId) {
            results.push({ email: normalised, purged: false, message: 'Unauthorized: This user belongs to another school.' });
            continue;
          }
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
    password?: string,
    phone?: string
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

    const normalizedEmail = validateAndNormalizeEmail(email);

    // Verify system-wide uniqueness of Admission Number
    const { data: existingAdm } = await supabaseAdmin
      .from('students')
      .select('id')
      .eq('admission_number', admissionNumber)
      .maybeSingle();
    if (existingAdm) {
      throw new Error(`Registration failed: The admission number "${admissionNumber}" is already in use in the system.`);
    }

    // Resolve active academic session
    const activeSessionId = await this.resolveActiveSessionId(schoolId);

    // Verify uniqueness of Roll Number within the same school, class, and academic session
    const targetClassId = classId || null;
    let rollQuery = supabaseAdmin
      .from('students')
      .select('id')
      .eq('school_id', schoolId)
      .eq('academic_session_id', activeSessionId)
      .eq('roll_number', rollNumber);
    
    if (targetClassId === null) {
      rollQuery = rollQuery.is('class_id', null);
    } else {
      rollQuery = rollQuery.eq('class_id', targetClassId);
    }

    const { data: existingRoll } = await rollQuery.maybeSingle();
    if (existingRoll) {
      throw new Error(`Registration failed: The roll number "${rollNumber}" is already in use in this class and academic session.`);
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
      email: normalizedEmail,
      password: pass,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'STUDENT' }
    });
    if (authError || !authData.user) throw new Error('Failed to create student auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
      role: 'STUDENT',
      first_name: firstName,
      last_name: lastName,
      phone: phone || '',
      school_id: schoolId,
      is_active: true
    });
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create student database profile: ' + dbError.message);
    }

    // Insert login email into email_addresses table
    await supabaseAdmin.from('email_addresses').insert({
      user_id: newUserId,
      school_id: schoolId,
      email_type: 'LOGIN',
      email: normalizedEmail,
      is_primary: true,
      is_verified: true
    });

    // Insert phone number into phone_numbers table if provided
    const parsedStudentPhone = parseAndValidatePhone(phone || '');
    if (parsedStudentPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: newUserId,
        school_id: schoolId,
        phone_type: 'PRIMARY',
        country_code: parsedStudentPhone.countryCode,
        national_number: parsedStudentPhone.nationalNumber,
        full_number: parsedStudentPhone.fullNumber
      });
    }

    // Resolve sectionId
    let resolvedSectionId: string | null = null;
    if (classId) {
      const { data: secRow } = await supabaseAdmin
        .from('sections')
        .select('id')
        .eq('class_id', classId)
        .limit(1)
        .maybeSingle();
      if (secRow) {
        resolvedSectionId = secRow.id;
      }
    }

    // Insert into students table
    const { data: studentRow, error: studentErr } = await supabaseAdmin.from('students').insert({
      user_id: newUserId,
      school_id: schoolId,
      class_id: classId || null,
      section_id: resolvedSectionId,
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
      id: newUserId, email: normalizedEmail, role: 'STUDENT', firstName, lastName,
      phone: phone || '', avatarUrl: '', isActive: true, schoolId,
      password: pass, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    const student: Student = {
      id: studentRow.id, userId: newUserId, schoolId, classId,
      sectionId: resolvedSectionId,
      academicSessionId: activeSessionId,
      admissionNumber, rollNumber, dateOfBirth: dob, gender,
      createdAt: new Date().toISOString()
    };
    mockDb.users.push(user);
    mockDb.students.push(student);
    if (parsedStudentPhone.fullNumber) {
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: newUserId, schoolId,
        phoneType: 'PRIMARY',
        countryCode: parsedStudentPhone.countryCode,
        nationalNumber: parsedStudentPhone.nationalNumber,
        fullNumber: parsedStudentPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }
    const ea: EmailAddress = {
      id: 'ea-' + Math.random().toString(36).substr(2, 9),
      userId: newUserId,
      schoolId,
      emailType: 'LOGIN',
      email: normalizedEmail,
      isPrimary: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDb.emailAddresses.push(ea);

    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_CREATE_STUDENT', { studentName: `${firstName} ${lastName}`, email: normalizedEmail, classId });
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
    password?: string,
    emergencyPhone?: string
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

    const normalizedEmail = validateAndNormalizeEmail(email);

    const pass = password || 'password';
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: pass,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'PARENT' }
    });
    if (authError || !authData.user) throw new Error('Failed to create parent auth user: ' + (authError?.message || 'Unknown error'));
    
    const newUserId = authData.user.id;
    
    // Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
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

    // Insert login email into email_addresses table
    await supabaseAdmin.from('email_addresses').insert({
      user_id: newUserId,
      school_id: schoolId,
      email_type: 'LOGIN',
      email: normalizedEmail,
      is_primary: true,
      is_verified: true
    });

    // Insert primary phone number into phone_numbers table if provided
    const parsedParentPhone = parseAndValidatePhone(phone);
    if (parsedParentPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: newUserId,
        school_id: schoolId,
        phone_type: 'PRIMARY',
        country_code: parsedParentPhone.countryCode,
        national_number: parsedParentPhone.nationalNumber,
        full_number: parsedParentPhone.fullNumber
      });
    }

    // Insert emergency phone number into phone_numbers table if provided
    const parsedParentEmergencyPhone = parseAndValidatePhone(emergencyPhone || '');
    if (parsedParentEmergencyPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: newUserId,
        school_id: schoolId,
        phone_type: 'EMERGENCY',
        country_code: parsedParentEmergencyPhone.countryCode,
        national_number: parsedParentEmergencyPhone.nationalNumber,
        full_number: parsedParentEmergencyPhone.fullNumber
      });
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
      id: newUserId, email: normalizedEmail, role: 'PARENT', firstName, lastName,
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
    if (parsedParentPhone.fullNumber) {
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: newUserId, schoolId,
        phoneType: 'PRIMARY',
        countryCode: parsedParentPhone.countryCode,
        nationalNumber: parsedParentPhone.nationalNumber,
        fullNumber: parsedParentPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }
    if (parsedParentEmergencyPhone.fullNumber) {
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: newUserId, schoolId,
        phoneType: 'EMERGENCY',
        countryCode: parsedParentEmergencyPhone.countryCode,
        nationalNumber: parsedParentEmergencyPhone.nationalNumber,
        fullNumber: parsedParentEmergencyPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }
    const ea: EmailAddress = {
      id: 'ea-' + Math.random().toString(36).substr(2, 9),
      userId: newUserId,
      schoolId,
      emailType: 'LOGIN',
      email: normalizedEmail,
      isPrimary: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDb.emailAddresses.push(ea);

    mockDb.addLog(teacher.userId, 'CLASS_TEACHER_CREATE_PARENT', { parentName: `${firstName} ${lastName}`, email: normalizedEmail, studentId });
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
    const schoolId = await getAdminSchoolId();
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
    const schoolId = await getAdminSchoolId();
    await this.verifySchoolFeature(schoolId, 'billing');
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
    const schoolId = await getAdminSchoolId();
    await this.verifySchoolFeature(schoolId, 'billing');

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
    const schoolId = await getAdminSchoolId();
    await this.verifySchoolFeature(schoolId, 'billing');

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
    const schoolId = await getAdminSchoolId();
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
    const { data: admin } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (!admin || !['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
      throw new Error('Access Denied: Only School Admin and Finance Admin can record fee payments.');
    }
    if (admin.school_id) {
      await this.verifySchoolFeature(admin.school_id, 'billing');
    }

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

  async adminApproveFeePayment(adminId: string, paymentId: string): Promise<void> {
    await delay(300);
    const { data: admin } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (!admin || !['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
      throw new Error('Access Denied: Only School Admin and Finance Admin can approve fee payments.');
    }
    if (admin.school_id) {
      await this.verifySchoolFeature(admin.school_id, 'billing');
    }

    const payment = mockDb.feePayments.find(p => p.id === paymentId);
    if (!payment) throw new Error('Payment record not found');

    const { error } = await supabaseAdmin
      .from('fee_payments')
      .update({ status: 'PAID', payment_date: new Date().toISOString() })
      .eq('id', paymentId);

    if (error) throw new Error('Failed to approve payment: ' + error.message);

    payment.status = 'PAID';
    payment.paymentDate = new Date().toISOString();
    mockDb.addLog(adminId, 'APPROVE_FEE_PAYMENT', { paymentId });
    mockDb.saveAll();
  },

  async adminRejectFeePayment(adminId: string, paymentId: string): Promise<void> {
    await delay(300);
    const { data: admin } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (!admin || !['ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'].includes(admin.role)) {
      throw new Error('Access Denied: Only School Admin and Finance Admin can reject fee payments.');
    }
    if (admin.school_id) {
      await this.verifySchoolFeature(admin.school_id, 'billing');
    }

    const payment = mockDb.feePayments.find(p => p.id === paymentId);
    if (!payment) throw new Error('Payment record not found');

    const { error } = await supabaseAdmin
      .from('fee_payments')
      .update({ status: 'PENDING', amount_paid: 0, payment_date: '', payment_method: '', transaction_id: null })
      .eq('id', paymentId);

    if (error) throw new Error('Failed to reject payment: ' + error.message);

    payment.status = 'PENDING';
    payment.amountPaid = 0;
    payment.paymentDate = '';
    payment.paymentMethod = '';
    payment.transactionId = undefined;
    mockDb.addLog(adminId, 'REJECT_FEE_PAYMENT', { paymentId });
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
    const { data: adminsData } = await supabaseAdmin
      .from('school_admins')
      .select(`
        user_id,
        school_id,
        role_settings,
        users!inner(email, first_name, last_name, phone, is_active)
      `);

    const mappedSchools = (schoolsData || []).map(s => {
      const schoolMapped: School = {
        id: s.id,
        name: s.name,
        address: s.address || '',
        phone: s.phone || '',
        subscriptionPlan: s.subscription_plan ? (s.subscription_plan.toLowerCase() as any) : 'freemium',
        createdAt: s.created_at,
        country: s.country || 'USA',
        currencyCode: s.currency_code || 'USD',
        currencySymbol: s.currency_symbol || '$',
        timezone: s.timezone || 'America/New_York',
        logoUrl: s.logo_url || '',
        logoFileName: s.logo_file_name || '',
        logoUploadedAt: s.logo_uploaded_at || '',
        sealUrl: s.seal_url || '',
        sealFileName: s.seal_file_name || '',
        sealUploadedAt: s.seal_uploaded_at || ''
      };

      const idx = mockDb.schools.findIndex(x => x.id === s.id);
      if (idx === -1) {
        mockDb.schools.push(schoolMapped);
      } else {
        mockDb.schools[idx] = schoolMapped;
      }
      return schoolMapped;
    });

    const mappedAdmins = (adminsData || []).map((sa: any) => {
      const u = sa.users;
      const adminMapped = {
        id: sa.user_id,
        email: u.email,
        firstName: u.first_name,
        lastName: u.last_name,
        phone: u.phone || '',
        schoolId: sa.school_id,
        role: (sa.role_settings || 'ADMIN') as any,
        isActive: u.is_active
      };

      const userMapped: User = {
        id: sa.user_id,
        email: u.email,
        role: (sa.role_settings || 'ADMIN') as any,
        firstName: u.first_name,
        lastName: u.last_name,
        phone: u.phone || '',
        avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
        isActive: u.is_active,
        schoolId: sa.school_id,
        createdAt: u.created_at || new Date().toISOString(),
        updatedAt: u.created_at || new Date().toISOString()
      };

      const existingUserIdx = mockDb.users.findIndex(x => x.id === sa.user_id);
      if (existingUserIdx === -1) {
        mockDb.users.push(userMapped);
      } else {
        const pass = mockDb.users[existingUserIdx].password;
        mockDb.users[existingUserIdx] = { ...userMapped, password: pass };
      }

      return adminMapped;
    });

    mockDb.saveAll();

    let saasStats: any = {};
    try {
      const res = await fetch('/api/saas-stats');
      if (res.ok) {
        const payload = await res.json();
        if (payload.success) {
          saasStats = payload.stats;
        }
      }
    } catch (e) {
      console.error('Failed to fetch saas stats from api:', e);
    }

    return {
      totalSchools: schoolCount || 0,
      totalUsers: userCount || 0,
      totalSubscriptionsIncome: saasStats.totalRevenue || 0, 
      activeSessions: getSystemTelemetry().activeSessions,
      systemTelemetry: getSystemTelemetry(),
      schoolsList: mappedSchools,
      adminsList: mappedAdmins,
      
      activeSchools: saasStats.activeSchools || 0,
      expiredSchools: saasStats.expiredSchools || 0,
      monthlyRevenue: saasStats.monthlyRevenue || 0,
      planDistribution: saasStats.planDistribution || [],
      expiryAlerts: saasStats.expiryAlerts || [],
      recentPayments: saasStats.recentPayments || [],
      recentRegistrations: saasStats.recentRegistrations || []
    };
  },

  async superAdminGetAuditLogs(superAdminId: string, query = ''): Promise<(AuditLog & { userName: string; userEmail: string })[]> {
    await delay(300);
    // Left as mockDb for now until audit logs are moved to Supabase
    let filtered = [...mockDb.auditLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    if (query) {
      filtered = filtered.filter(log => 
        (log.action || '').toLowerCase().includes(query.toLowerCase()) || 
        (log.userId || '').toLowerCase().includes(query.toLowerCase())
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

  async superAdminCreateSchool(
    superAdminId: string, 
    name: string, 
    address: string, 
    phone: string, 
    subscription: string,
    country: string = 'USA',
    currencyCode: string = 'USD',
    currencySymbol: string = '$',
    timezone: string = 'America/New_York',
    logoFile?: File | null,
    sealFile?: File | null
  ): Promise<School> {
    const { data, error } = await supabaseAdmin.from('schools').insert({
      name,
      address,
      phone,
      subscription_plan: subscription,
      country,
      currency_code: currencyCode,
      currency_symbol: currencySymbol,
      timezone
    }).select().single();

    if (error || !data) throw new Error('Failed to create school in database: ' + (error?.message || 'Unknown error'));

    // Upload files if provided
    if (logoFile) {
      try {
        await this.uploadSchoolAsset(data.id, 'logo', logoFile, superAdminId);
      } catch (err) {
        console.error('Failed to upload logo during school creation:', err);
      }
    }
    if (sealFile) {
      try {
        await this.uploadSchoolAsset(data.id, 'seal', sealFile, superAdminId);
      } catch (err) {
        console.error('Failed to upload seal during school creation:', err);
      }
    }

    // Refetch final record to resolve branding URLs
    const { data: finalData } = await supabaseAdmin.from('schools').select('*').eq('id', data.id).single();
    const activeData = finalData || data;

    const schoolMapped: School = {
      id: activeData.id,
      name: activeData.name,
      address: activeData.address || '',
      phone: activeData.phone || '',
      subscriptionPlan: activeData.subscription_plan ? (activeData.subscription_plan.toLowerCase() as any) : 'freemium',
      createdAt: activeData.created_at,
      country: activeData.country || country,
      currencyCode: activeData.currency_code || currencyCode,
      currencySymbol: activeData.currency_symbol || currencySymbol,
      timezone: activeData.timezone || timezone,
      logoUrl: activeData.logo_url || '',
      logoFileName: activeData.logo_file_name || '',
      logoUploadedAt: activeData.logo_uploaded_at || '',
      sealUrl: activeData.seal_url || '',
      sealFileName: activeData.seal_file_name || '',
      sealUploadedAt: activeData.seal_uploaded_at || ''
    };

    const idx = mockDb.schools.findIndex(x => x.id === activeData.id);
    if (idx === -1) {
      mockDb.schools.push(schoolMapped);
    } else {
      mockDb.schools[idx] = schoolMapped;
    }
    mockDb.saveAll();

    return schoolMapped;
  },

  async superAdminCreateAdmin(superAdminId: string, email: string, firstName: string, lastName: string, schoolId: string, phone: string, password: string): Promise<void> {
    const normalizedEmail = validateAndNormalizeEmail(email);

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
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'ADMIN' }
    });

    if (authError || !authData.user) throw new Error('Failed to create admin auth user: ' + (authError?.message || 'Unknown error'));

    // 2. Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email: normalizedEmail,
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

    // 3. Insert into school_admins table
    const { error: adminTableError } = await supabaseAdmin.from('school_admins').insert({
      user_id: authData.user.id,
      school_id: schoolId,
      role_settings: 'ADMIN',
      permissions: { all: true },
      status: 'ACTIVE'
    });

    if (adminTableError) {
      // Rollback: remove public.users entry and auth user if the school admin specific insert failed
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Failed to create school admin record: ' + adminTableError.message);
    }

    // Insert login email into email_addresses table
    await supabaseAdmin.from('email_addresses').insert({
      user_id: authData.user.id,
      school_id: schoolId,
      email_type: 'LOGIN',
      email: normalizedEmail,
      is_primary: true,
      is_verified: true
    });

    // 4. Insert phone number into phone_numbers table if provided
    const parsedPhone = parseAndValidatePhone(phone);
    if (parsedPhone.fullNumber) {
      await supabaseAdmin.from('phone_numbers').insert({
        user_id: authData.user.id,
        school_id: schoolId,
        phone_type: 'PRIMARY',
        country_code: parsedPhone.countryCode,
        national_number: parsedPhone.nationalNumber,
        full_number: parsedPhone.fullNumber
      });
      // Sync to local cache
      const pn: PhoneNumber = {
        id: 'pn-' + Math.random().toString(36).substr(2, 9),
        userId: authData.user.id, schoolId,
        phoneType: 'PRIMARY',
        countryCode: parsedPhone.countryCode,
        nationalNumber: parsedPhone.nationalNumber,
        fullNumber: parsedPhone.fullNumber,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      mockDb.phoneNumbers.push(pn);
    }

    // Sync newly created school admin with local mockDb cache
    const user: User = {
      id: authData.user.id,
      email: normalizedEmail,
      role: 'ADMIN',
      firstName,
      lastName,
      phone,
      avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150',
      isActive: true,
      schoolId,
      password: password,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const ea: EmailAddress = {
      id: 'ea-' + Math.random().toString(36).substr(2, 9),
      userId: authData.user.id,
      schoolId,
      emailType: 'LOGIN',
      email: normalizedEmail,
      isPrimary: true,
      isVerified: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    mockDb.emailAddresses.push(ea);

    const existingUserIdx = mockDb.users.findIndex(x => x.id === authData.user.id);
    if (existingUserIdx === -1) {
      mockDb.users.push(user);
    } else {
      mockDb.users[existingUserIdx] = user;
    }
    mockDb.saveAll();
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
    
    try {
      // 1. Deactivate all existing plans for the school
      await supabaseAdmin
        .from('school_subscriptions')
        .update({ status: 'INACTIVE' })
        .eq('school_id', schoolId);

      // 2. If the new plan is a paid plan, insert or update it as ACTIVE
      const upperPlan = subscriptionPlan.toUpperCase();
      if (['BASIC', 'PRO', 'ENTERPRISE'].includes(upperPlan)) {
        const oneYearLaterStr = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        // Safe check-then-insert/update flow to bypass unique constraint mismatch error 42P10
        const { data: existing } = await supabaseAdmin
          .from('school_subscriptions')
          .select('*')
          .eq('school_id', schoolId)
          .eq('plan', upperPlan)
          .limit(1);
          
        if (existing && existing.length > 0) {
          const { error: updateErr } = await supabaseAdmin
            .from('school_subscriptions')
            .update({
              status: 'ACTIVE',
              expiry_date: oneYearLaterStr
            })
            .eq('id', existing[0].id);
            
          if (updateErr) throw updateErr;
        } else {
          const { error: insertErr } = await supabaseAdmin
            .from('school_subscriptions')
            .insert({
              school_id: schoolId,
              plan: upperPlan,
              status: 'ACTIVE',
              expiry_date: oneYearLaterStr
            });
            
          if (insertErr) throw insertErr;
        }
      }
    } catch (e) {
      console.error('Failed to update school_subscriptions table in Supabase:', e);
      throw e;
    }

    // Invalidate cached subscription-related telemetry
    Object.keys(attendanceAnalyticsCache).forEach((key) => {
      if (key.startsWith(`${schoolId}_`)) {
        delete attendanceAnalyticsCache[key];
      }
    });
    this.clearHostelCache(schoolId);

    // Sync local mockDb schools cache
    const idx = mockDb.schools.findIndex(s => s.id === schoolId);
    if (idx !== -1) {
      mockDb.schools[idx].subscriptionPlan = subscriptionPlan.toLowerCase() as any;
      mockDb.saveAll();
    }

    // Broadcast the updated plan in real-time to all listening clients in this school
    try {
      const channel = supabaseAdmin.channel(`school-subscription-updates-${schoolId}`);
      await new Promise<void>((resolve) => {
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.send({
              type: 'broadcast',
              event: 'plan_updated',
              payload: { schoolId, plan: subscriptionPlan.toLowerCase() }
            });
            supabaseAdmin.removeChannel(channel);
            resolve();
          } else {
            // fallback timeout logic
            setTimeout(() => {
              supabaseAdmin.removeChannel(channel);
              resolve();
            }, 1000);
          }
        });
      });
    } catch (broadcastErr) {
      console.warn('Failed to broadcast subscription change event in real-time:', broadcastErr);
    }
  },

  async superAdminDeleteAdmin(superAdminId: string, adminUserId: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(adminUserId);
    if (error) throw new Error('Failed to delete admin: ' + error.message);
    
    // Sync local mockDb cache
    mockDb.users = mockDb.users.filter(u => u.id !== adminUserId);
    mockDb.saveAll();
  },

  async superAdminResetPassword(superAdminId: string, targetUserId: string, newPasswordPlain: string): Promise<void> {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, { password: newPasswordPlain });
    if (error) throw new Error('Failed to reset password: ' + error.message);

    const userIdx = mockDb.users.findIndex(u => u.id === targetUserId);
    if (userIdx !== -1) {
      mockDb.users[userIdx].password = newPasswordPlain;
      mockDb.users[userIdx].updatedAt = new Date().toISOString();
      mockDb.saveAll();
    }
  },

  async adminResetPassword(adminId: string, targetUserId: string, newPasswordPlain: string): Promise<void> {
    await delay(500);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || !['ADMIN', 'ACADEMIC_ADMIN'].includes(admin.role)) throw new Error('Unauthorized operational context.');

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
    // Remove non-UUID seed data only for the current school to avoid leaking mock stubs into real Supabase data views
    mockDb.exams = mockDb.exams.filter(e => e.schoolId === schoolId ? isUUID(e.id) : true);

    let exams = mockDb.exams.filter(e => e.schoolId === schoolId);
    if (exams.length === 0) {
      // Graceful fallback to seed arrays if Supabase failed or returned empty (do not mutate local DB cache with non-UUIDs)
      return SEED_EXAMS.map(e => ({ ...e, schoolId }));
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
    
    // Clean up local mock db for this class to prevent seed data from mixing with real Supabase data
    mockDb.examSchedules = mockDb.examSchedules.filter(s => s.classId === classId ? isUUID(s.id) : true);
    mockDb.examMarks = mockDb.examMarks.filter(m => m.studentId === studentId ? isUUID(m.id) : true);

    let schedules = mockDb.examSchedules.filter(s => s.examId === examId && s.classId === classId);
    if (schedules.length === 0) {
      // Graceful fallback to seed arrays if Supabase failed or returned empty (do not mutate local DB cache with non-UUIDs)
      // Map the IDs so they link correctly for the frontend view
      schedules = SEED_EXAM_SCHEDULES.map(s => ({ ...s, examId, classId }));
    }
    return schedules.map(sched => {
      const subject = mockDb.subjects.find(s => s.id === sched.subjectId);
      let mark = mockDb.examMarks.find(m => m.examScheduleId === sched.id && m.studentId === studentId);
      
      if (!mark && !isUUID(sched.id)) {
        // Fallback for seed schedule IDs if no mock mark exists
        mark = SEED_EXAM_MARKS.find(m => m.examScheduleId === sched.id && m.studentId === studentId);
      }

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
    examId: string,
    marksData: { scheduleId: string; marksObtained: number; remarks: string }[]
  ): Promise<void> {
    await delay(300);
    const cls = mockDb.classes.find(c => c.id === classId);
    if (!cls || cls.classTeacherId !== teacherId) {
      throw new Error('Unauthorized operational context: You are not the Class Teacher of this class.');
    }

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    
    const dbExamId = examId;
    if (!dbExamId) throw new Error('Unable to resolve active exam reference in database.');

    // Keep local exam marks clean for this student but preserve seed marks for others
    mockDb.examMarks = mockDb.examMarks.filter(m => m.studentId === studentId ? isUUID(m.id) : true);

    const resolvedScheduleIds: Record<string, string> = {};
    const saveErrors: string[] = [];

    for (const data of marksData) {
      try {
        let dbScheduleId: string | null = null;
        let dbSubjectId: string | null = null;
        let localMaxMarks = 100;

        if (isUUID(data.scheduleId)) {
          dbScheduleId = data.scheduleId;
          const sched = mockDb.examSchedules.find(s => s.id === data.scheduleId);
          dbSubjectId = sched?.subjectId || null;
          localMaxMarks = sched?.maxMarks || 100;
        } else {
          // Resolve mock schedule (e.g. es-1) to DB entities
          const localSched = mockDb.examSchedules.find(s => s.id === data.scheduleId) || SEED_EXAM_SCHEDULES.find(s => s.id === data.scheduleId);
          if (localSched) {
            localMaxMarks = localSched.maxMarks || 100;
            const localSubject = mockDb.subjects.find(s => s.id === localSched.subjectId);
            if (localSubject) {
              let dbSubject = mockDb.subjects.find(s => s.schoolId === cls.schoolId && isUUID(s.id) && s.name.toLowerCase() === localSubject.name.toLowerCase());
              if (!dbSubject) {
                const { data: dbSubjects } = await supabaseAdmin.from('subjects').select('*').eq('school_id', cls.schoolId);
                dbSubject = dbSubjects?.find((s: any) => s.name.toLowerCase() === localSubject.name.toLowerCase());
                if (!dbSubject) {
                  // Auto-create missing subject in database
                  const { data: newSub, error: newSubErr } = await supabaseAdmin.from('subjects').insert({
                    school_id: cls.schoolId,
                    name: localSubject.name,
                    code: localSubject.code || localSubject.name.substring(0, 3).toUpperCase(),
                    description: localSubject.description || ''
                  }).select().single();
                  if (newSubErr) {
                    throw new Error(`Failed to create missing subject "${localSubject.name}": ${newSubErr.message}`);
                  }
                  dbSubject = newSub;
                  // Sync local cache
                  if (dbSubject) {
                    const localSubObj = {
                      id: dbSubject.id,
                      schoolId: cls.schoolId,
                      name: dbSubject.name,
                      code: dbSubject.code,
                      description: dbSubject.description || ''
                    };
                    mockDb.subjects.push(localSubObj);
                    mockDb.saveAll();
                  }
                }
              }
              if (dbSubject) {
                dbSubjectId = dbSubject.id;
              }
            }
          }
        }

        if (!dbSubjectId) {
          throw new Error(`Unable to resolve subject ID for schedule: ${data.scheduleId}`);
        }

        // Ensure exam_subjects mapping exists
        const { data: existingES } = await supabaseAdmin.from('exam_subjects').select('id').eq('exam_id', dbExamId).eq('subject_id', dbSubjectId).eq('school_id', cls.schoolId);
        if (!existingES || existingES.length === 0) {
          const { error: esErr } = await supabaseAdmin.from('exam_subjects').insert({
            school_id: cls.schoolId,
            exam_id: dbExamId,
            subject_id: dbSubjectId,
            max_marks: localMaxMarks,
            passing_marks: Math.round(localMaxMarks * 0.4)
          });
          if (esErr) {
            throw new Error(`Failed to map exam subject: ${esErr.message}`);
          }
        }

        // Resolve or create exam_schedules row via UPSERT to prevent race conditions
        if (!dbScheduleId) {
          const { data: existingSched } = await supabaseAdmin.from('exam_schedules').select('id').eq('exam_id', dbExamId).eq('class_id', classId).eq('subject_id', dbSubjectId);
          if (existingSched && existingSched.length > 0) {
            dbScheduleId = existingSched[0].id;
          } else {
            const { data: newSched, error: newSchedErr } = await supabaseAdmin.from('exam_schedules').upsert({
              exam_id: dbExamId,
              class_id: classId,
              subject_id: dbSubjectId,
              max_marks: localMaxMarks,
              date: new Date().toISOString().split('T')[0],
              start_time: '09:00',
              end_time: '12:00',
              classroom: 'Classroom'
            }, { onConflict: 'exam_id,class_id,subject_id' }).select().maybeSingle();
            
            if (newSchedErr) {
              throw new Error(`Failed to create exam schedule: ${newSchedErr.message}`);
            }
            dbScheduleId = newSched?.id || null;
          }
        }

        if (!dbScheduleId) {
          throw new Error(`Unable to resolve or create exam schedule for subject ID ${dbSubjectId}`);
        }

        // Save mock mapping
        resolvedScheduleIds[data.scheduleId] = dbScheduleId;

        // Save to exam_marks using atomic UPSERT
        const { data: upsertedMark, error: upsertErr } = await supabaseAdmin
          .from('exam_marks')
          .upsert({
            exam_schedule_id: dbScheduleId,
            student_id: studentId,
            marks_obtained: Number(data.marksObtained || 0),
            remarks: data.remarks || '',
            graded_by: teacherId
          }, { onConflict: 'exam_schedule_id,student_id' })
          .select()
          .maybeSingle();

        if (upsertErr) {
          throw new Error(`Failed to upsert exam mark: ${upsertErr.message}`);
        }

        const resolvedMarkId = upsertedMark?.id || ('em-' + Math.random().toString(36).substr(2, 9));

        // Instantly sync to mockDb.examMarks in-memory cache
        const localMark = {
          id: resolvedMarkId,
          examScheduleId: dbScheduleId,
          studentId: studentId,
          marksObtained: Number(data.marksObtained || 0),
          remarks: data.remarks || '',
          gradedBy: teacherId,
          createdAt: new Date().toISOString()
        };
        const mIdx = mockDb.examMarks.findIndex(m => m.examScheduleId === dbScheduleId && m.studentId === studentId);
        if (mIdx === -1) {
          mockDb.examMarks.push(localMark);
        } else {
          mockDb.examMarks[mIdx] = localMark;
        }
        mockDb.saveAll();

        // Save to student_marks
        await this.enterStudentMarks(cls.schoolId, dbExamId, dbSubjectId, studentId, data.marksObtained, data.remarks);
      } catch (err: any) {
        console.error('Failed to save exam mark in database:', err);
        saveErrors.push(err.message || String(err));
      }
    }

    if (saveErrors.length > 0) {
      throw new Error(`Failed to save marks for one or more subjects: ${saveErrors.join('; ')}`);
    }

    // Upsert Report Card term summary record
    try {
      const resolvedSessionId = await this.resolveActiveSessionId(cls.schoolId);
      const totalMax = marksData.reduce((sum, item) => {
        const lookupId = resolvedScheduleIds[item.scheduleId] || item.scheduleId;
        const sched = mockDb.examSchedules.find(s => s.id === lookupId) || SEED_EXAM_SCHEDULES.find(s => s.id === lookupId);
        return sum + (sched?.maxMarks || 100);
      }, 0);
      const totalObtained = marksData.reduce((sum, item) => sum + (item.marksObtained || 0), 0);
      const gpa = totalMax > 0 ? (totalObtained / totalMax) * 10 : 0;

      const studentAtt = mockDb.attendance.filter(a => a.studentId === studentId);
      const totalDays = studentAtt.length;
      const presentDays = studentAtt.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
      const attendancePercent = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 95;

      const summaryRemarks = marksData.map(m => m.remarks).filter(Boolean).join('; ') || 'Satisfactory midterm progress.';

      const examObj = mockDb.exams.find(e => e.id === dbExamId);
      const termName = examObj?.term || 'TERM 1';

      const { data: existingRC } = await supabaseAdmin
        .from('report_cards')
        .select('id')
        .eq('school_id', cls.schoolId)
        .eq('student_id', studentId)
        .eq('term', termName);

      if (existingRC && existingRC.length > 0) {
        await supabaseAdmin.from('report_cards').update({
          grade_point_average: gpa,
          attendance_percentage: attendancePercent,
          remarks: summaryRemarks,
          academic_session_id: resolvedSessionId
        }).eq('id', existingRC[0].id);
      } else {
        await supabaseAdmin.from('report_cards').insert({
          school_id: cls.schoolId,
          academic_session_id: resolvedSessionId,
          student_id: studentId,
          term: termName,
          grade_point_average: gpa,
          attendance_percentage: attendancePercent,
          remarks: summaryRemarks,
          file_url: ''
        });
      }

      await this.fetchReportCards(cls.schoolId, studentId);
    } catch (rcErr) {
      console.error('Failed to create/update report card summary in database:', rcErr);
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

    await this.syncTimetablesData(teacher.schoolId);
    await validateTeacherForTimetable(teacherId, teacher.schoolId);
    validateTimetableConflicts(teacher.schoolId, undefined, classId, teacherId, dayOfWeek, startTime, endTime, classroomNumber);

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

        // Post to Group Discussion system notice
        this.postGroupDiscussionSystemNotice(
          teacher.schoolId,
          academicSessionId,
          classId,
          'TIMETABLE',
          `Timetable updated for this class`,
          teacher.userId
        ).catch(e => console.error('Failed to post system notice to group discussion:', e));

        mockDb.addLog(teacher.userId, 'TEACHER_CREATE_TIMETABLE', { classId, timetableId: newEntry.id });
        mockDb.saveAll();

        const activeUser = getActiveUser();
        if (activeUser) {
          await this.writeAuditLog(
            activeUser.id,
            null,
            teacher.schoolId,
            'academics',
            'TIMETABLE_CREATED',
            newEntry.id,
            null,
            newEntry
          );
        }
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

    const ttIdx = mockDb.timetables.findIndex(t => t.id === timetableId);
    const oldEntry = ttIdx !== -1 ? mockDb.timetables[ttIdx] : null;

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

    if (ttIdx !== -1 && oldEntry) {
      const tt = mockDb.timetables[ttIdx];
      mockDb.timetables.splice(ttIdx, 1);
      mockDb.addLog(teacher.userId, 'TEACHER_DELETE_TIMETABLE', { classId: tt.classId, timetableId });
      mockDb.saveAll();

      const activeUser = getActiveUser();
      if (activeUser) {
        await this.writeAuditLog(
          activeUser.id,
          null,
          teacher.schoolId,
          'academics',
          'TIMETABLE_DELETED',
          timetableId,
          oldEntry,
          null
        );
      }
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

    await this.syncTimetablesData(teacher.schoolId);
    await validateTeacherForTimetable(assignedTeacherId, teacher.schoolId);
    const validTeacherId = assignedTeacherId;

    validateTimetableConflicts(teacher.schoolId, undefined, classId, validTeacherId, dayOfWeek, startTime, endTime, classroomNumber);

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

        // Post to Group Discussion system notice
        this.postGroupDiscussionSystemNotice(
          teacher.schoolId,
          academicSessionId,
          classId,
          'TIMETABLE',
          `Timetable updated for this class`,
          teacher.userId
        ).catch(e => console.error('Failed to post system notice to group discussion:', e));

        mockDb.addLog(teacher.userId, 'CLASS_TEACHER_CREATE_TIMETABLE', { classId, timetableId: newEntry.id });
        mockDb.saveAll();

        const activeUser = getActiveUser();
        if (activeUser) {
          await this.writeAuditLog(
            activeUser.id,
            null,
            teacher.schoolId,
            'academics',
            'TIMETABLE_CREATED',
            newEntry.id,
            null,
            newEntry
          );
        }
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

    const ttIdx = mockDb.timetables.findIndex(t => t.id === timetableId);
    const oldEntry = ttIdx !== -1 ? mockDb.timetables[ttIdx] : null;

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

    if (ttIdx !== -1 && oldEntry) {
      const tt = mockDb.timetables[ttIdx];
      mockDb.timetables.splice(ttIdx, 1);
      mockDb.addLog(teacher.userId, 'CLASS_TEACHER_DELETE_TIMETABLE', { classId: tt.classId, timetableId });
      mockDb.saveAll();

      const activeUser = getActiveUser();
      if (activeUser) {
        await this.writeAuditLog(
          activeUser.id,
          null,
          teacher.schoolId,
          'academics',
          'TIMETABLE_DELETED',
          timetableId,
          oldEntry,
          null
        );
      }
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

    await this.syncTimetablesData(teacher.schoolId);
    await validateTeacherForTimetable(assignedTeacherId, teacher.schoolId);
    const validTeacherId = assignedTeacherId;

    validateTimetableConflicts(teacher.schoolId, timetableId, classId, validTeacherId, dayOfWeek, startTime, endTime, classroomNumber);

    const oldEntry = mockDb.timetables.find(t => t.id === timetableId);
    const oldData = oldEntry ? { ...oldEntry } : null;

    const checkIsUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (checkIsUUID(timetableId)) {
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

      const activeUser = getActiveUser();
      if (activeUser) {
        await this.writeAuditLog(
          activeUser.id,
          null,
          teacher.schoolId,
          'academics',
          'TIMETABLE_UPDATED',
          timetableId,
          oldData,
          mockDb.timetables[ttIdx]
        );
      }
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

  // ==========================================
  // GROUP DISCUSSION SYSTEM SERVICES
  // ==========================================

  async ensureClassChatBucketExists(): Promise<void> {
    try {
      const { data, error } = await supabaseAdmin.storage.getBucket('class-chat-attachments');
      if (error || !data) {
        console.log('Self-healing missing storage bucket: class-chat-attachments');
        await supabaseAdmin.storage.createBucket('class-chat-attachments', {
          public: true,
          fileSizeLimit: 52428800 // 50MB
        });
      }
    } catch (err) {
      console.error('Error ensuring bucket class-chat-attachments exists:', err);
    }
  },

  async uploadClassChatAttachment(schoolId: string, classId: string, file: File): Promise<{ url: string; name: string; type: string; size: number }> {
    if (file.size > 50 * 1024 * 1024) {
      throw new Error('File size exceeds the 50MB limit.');
    }
    await this.ensureClassChatBucketExists();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${schoolId}/group-discussion/${classId}/files/${Date.now()}_${cleanFileName}`;
    const { error } = await supabaseAdmin.storage
      .from('class-chat-attachments')
      .upload(filePath, file, { cacheControl: '3600', upsert: true });

    if (error) {
      throw new Error('Failed to upload file to storage: ' + error.message);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('class-chat-attachments')
      .getPublicUrl(filePath);

    return {
      url: publicUrl,
      name: file.name,
      type: file.type,
      size: file.size
    };
  },

  async getClassChatGroups(schoolId: string, academicSessionId: string, userId: string, role: string): Promise<any[]> {
    validateSchoolId(schoolId, 'getClassChatGroups');
    
    let dbGroups: any[] = [];
    if (['ADMIN', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(role)) {
      const { data, error } = await supabaseAdmin
        .from('class_chat_groups')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_session_id', academicSessionId)
        .eq('is_archived', false);
      if (error) throw new Error('Failed to fetch chat groups: ' + error.message);
      console.log("getClassChatGroups Raw Supabase Response:", data);
      dbGroups = data || [];
      console.log("getClassChatGroups Filtered Response:", dbGroups);
    } else {
      const { data, error } = await supabaseAdmin
        .from('class_chat_members')
        .select('group_id, class_chat_groups!inner(*)')
        .eq('user_id', userId)
        .eq('school_id', schoolId)
        .eq('academic_session_id', academicSessionId)
        .eq('class_chat_groups.is_archived', false);
      if (error) throw new Error('Failed to fetch chat groups: ' + error.message);
      console.log("getClassChatGroups Raw Supabase Response:", data);
      dbGroups = (data || []).map((m: any) => m.class_chat_groups);
      console.log("getClassChatGroups Filtered Response:", dbGroups);
    }

    const rendered = dbGroups.map((g: any) => ({
      id: g.id,
      schoolId: g.school_id,
      academicSessionId: g.academic_session_id,
      classId: g.class_id,
      name: g.name,
      isArchived: g.is_archived,
      createdAt: g.created_at
    }));
    console.log("getClassChatGroups Final Rendered Response:", rendered);
    return rendered;
  },

  async getClassChatMembers(schoolId: string, academicSessionId: string, groupId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'getClassChatMembers');
    const { data, error } = await supabaseAdmin
      .from('class_chat_members')
      .select('*, users!inner(first_name, last_name, avatar_url, role)')
      .eq('group_id', groupId);

    if (error) throw new Error('Failed to fetch chat members: ' + error.message);

    console.log("getClassChatMembers Raw Membership Data:", data);
    console.log("getClassChatMembers Filtered Membership Data:", data);

    return (data || []).map((m: any) => ({
      id: m.id,
      schoolId: m.school_id,
      academicSessionId: m.academic_session_id,
      groupId: m.group_id,
      userId: m.user_id,
      role: m.role,
      mutedUntil: m.muted_until,
      isPermanentlyMuted: m.is_permanently_muted,
      joinedAt: m.joined_at,
      userFirst: m.users?.first_name,
      userLast: m.users?.last_name,
      avatarUrl: m.users?.avatar_url
    }));
  },

  async getClassMessages(schoolId: string, academicSessionId: string, groupId: string, limit = 100, offset = 0): Promise<any[]> {
    validateSchoolId(schoolId, 'getClassMessages');
    const { data: messages, error } = await supabaseAdmin
      .from('class_messages')
      .select('*, users!inner(first_name, last_name, avatar_url, role)')
      .eq('group_id', groupId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error('Failed to fetch messages: ' + error.message);
    if (!messages || messages.length === 0) return [];

    const messageIds = messages.map((m: any) => m.id);

    // Fetch reactions
    const { data: reactions } = await supabaseAdmin
      .from('class_message_reactions')
      .select('*, users!inner(first_name, last_name)')
      .in('message_id', messageIds);

    // Fetch attachments
    const { data: attachments } = await supabaseAdmin
      .from('class_message_attachments')
      .select('*')
      .in('message_id', messageIds);

    // Fetch replies relation
    const { data: replies } = await supabaseAdmin
      .from('class_message_replies')
      .select('*, parent_message:class_messages!parent_message_id_fkey(id, content, users!inner(first_name, last_name))')
      .in('reply_message_id', messageIds);

    // Fetch pinned
    const { data: pinned } = await supabaseAdmin
      .from('class_pinned_messages')
      .select('*')
      .in('message_id', messageIds);

    const reactionsMap = (reactions || []).reduce((acc: any, r: any) => {
      if (!acc[r.message_id]) acc[r.message_id] = [];
      acc[r.message_id].push({
        id: r.id,
        schoolId: r.school_id,
        academicSessionId: r.academic_session_id,
        messageId: r.message_id,
        userId: r.user_id,
        reaction: r.reaction,
        createdAt: r.created_at,
        userFirst: r.users?.first_name,
        userLast: r.users?.last_name
      });
      return acc;
    }, {});

    const attachmentsMap = (attachments || []).reduce((acc: any, a: any) => {
      if (!acc[a.message_id]) acc[a.message_id] = [];
      acc[a.message_id].push({
        id: a.id,
        schoolId: a.school_id,
        academicSessionId: a.academic_session_id,
        messageId: a.message_id,
        fileName: a.file_name,
        fileUrl: a.file_url,
        fileType: a.file_type,
        fileSize: a.file_size,
        createdAt: a.created_at
      });
      return acc;
    }, {});

    const repliesMap = (replies || []).reduce((acc: any, rep: any) => {
      acc[rep.reply_message_id] = {
        replyToMessageId: rep.parent_message_id,
        replyToSenderName: `${rep.parent_message?.users?.first_name || ''} ${rep.parent_message?.users?.last_name || ''}`.trim(),
        replyToContent: rep.parent_message?.content || ''
      };
      return acc;
    }, {});

    const pinnedMap = (pinned || []).reduce((acc: any, p: any) => {
      acc[p.message_id] = p;
      return acc;
    }, {});

    // Map everything onto the message object and reverse to chronological order
    const mapped = messages.map((m: any) => {
      const pinObj = pinnedMap[m.id];
      const replyObj = repliesMap[m.id];
      return {
        id: m.id,
        schoolId: m.school_id,
        academicSessionId: m.academic_session_id,
        groupId: m.group_id,
        senderId: m.sender_id,
        content: m.content,
        messageType: m.message_type,
        systemNoticeType: m.system_notice_type,
        editedAt: m.edited_at,
        deletedAt: m.deleted_at,
        createdAt: m.created_at,
        senderName: `${m.users?.first_name || ''} ${m.users?.last_name || ''}`.trim(),
        senderAvatar: m.users?.avatar_url,
        senderRole: m.users?.role,
        reactions: reactionsMap[m.id] || [],
        attachments: attachmentsMap[m.id] || [],
        pinnedBy: pinObj ? pinObj.pinned_by : undefined,
        pinnedAt: pinObj ? pinObj.pinned_at : undefined,
        replyToMessageId: replyObj?.replyToMessageId || null,
        replyToSenderName: replyObj?.replyToSenderName || null,
        replyToContent: replyObj?.replyToContent || null
      };
    });

    return mapped.reverse();
  },

  async submitClassChatMessage(
    schoolId: string,
    academicSessionId: string,
    groupId: string,
    senderId: string,
    content: string | null,
    attachments: any[] = [],
    replyToMessageId: string | null = null,
    messageType: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM' = 'CHAT',
    systemNoticeType: string | null = null
  ): Promise<any> {
    validateSchoolId(schoolId, 'submitClassChatMessage');

    // 1. Check mute status
    const { data: member, error: memErr } = await supabaseAdmin
      .from('class_chat_members')
      .select('muted_until, is_permanently_muted')
      .eq('group_id', groupId)
      .eq('user_id', senderId)
      .maybeSingle();

    if (memErr) throw new Error('Failed to verify mute permission: ' + memErr.message);

    if (member) {
      if (member.is_permanently_muted) {
        throw new Error('You are permanently muted in this group and cannot send messages.');
      }
      if (member.muted_until && new Date(member.muted_until) > new Date()) {
        throw new Error(`You are muted in this group until ${new Date(member.muted_until).toLocaleString()}.`);
      }
    }

    // 2. Insert message
    const { data: dbMsg, error: msgErr } = await supabaseAdmin
      .from('class_messages')
      .insert({
        school_id: schoolId,
        academic_session_id: academicSessionId,
        group_id: groupId,
        sender_id: senderId,
        content: content,
        message_type: messageType,
        system_notice_type: systemNoticeType
      })
      .select('*, users!inner(first_name, last_name, avatar_url, role)')
      .single();

    if (msgErr || !dbMsg) {
      throw new Error('Failed to send message: ' + (msgErr?.message || 'Unknown error'));
    }

    // 3. Handle reply mapping
    if (replyToMessageId) {
      const { error: repErr } = await supabaseAdmin
        .from('class_message_replies')
        .insert({
          school_id: schoolId,
          academic_session_id: academicSessionId,
          parent_message_id: replyToMessageId,
          reply_message_id: dbMsg.id
        });
      if (repErr) console.error('Failed to save reply mapping:', repErr.message);
    }

    // 4. Handle attachments mapping
    const savedAttachments: any[] = [];
    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        const { data: savedAtt, error: attErr } = await supabaseAdmin
          .from('class_message_attachments')
          .insert({
            school_id: schoolId,
            academic_session_id: academicSessionId,
            message_id: dbMsg.id,
            file_name: att.name || att.fileName,
            file_url: att.url || att.fileUrl,
            file_type: att.type || att.fileType,
            file_size: att.size || att.fileSize
          })
          .select()
          .single();
        if (attErr) {
          console.error('Failed to map attachment:', attErr.message);
        } else {
          savedAttachments.push({
            id: savedAtt.id,
            schoolId: savedAtt.school_id,
            academicSessionId: savedAtt.academic_session_id,
            messageId: savedAtt.message_id,
            fileName: savedAtt.file_name,
            fileUrl: savedAtt.file_url,
            fileType: savedAtt.file_type,
            fileSize: savedAtt.file_size,
            createdAt: savedAtt.created_at
          });
        }
      }
    }

    // 5. Audit Log
    try {
      await supabaseAdmin.from('class_chat_audit_logs').insert({
        school_id: schoolId,
        academic_session_id: academicSessionId,
        group_id: groupId,
        user_id: senderId,
        action: 'SEND_MESSAGE',
        details: { messageId: dbMsg.id, attachmentCount: savedAttachments.length }
      });
    } catch {}

    // Resolve replyTo details for instant frontend injection
    let replyObj: any = null;
    if (replyToMessageId) {
      const { data: parentMsg } = await supabaseAdmin
        .from('class_messages')
        .select('content, users!inner(first_name, last_name)')
        .eq('id', replyToMessageId)
        .single();
      if (parentMsg) {
        const parentUser: any = Array.isArray(parentMsg.users) ? parentMsg.users[0] : parentMsg.users;
        replyObj = {
          replyToMessageId,
          replyToSenderName: `${parentUser?.first_name || ''} ${parentUser?.last_name || ''}`.trim(),
          replyToContent: parentMsg.content
        };
      }
    }

    return {
      id: dbMsg.id,
      schoolId: dbMsg.school_id,
      academicSessionId: dbMsg.academic_session_id,
      groupId: dbMsg.group_id,
      senderId: dbMsg.sender_id,
      content: dbMsg.content,
      messageType: dbMsg.message_type,
      systemNoticeType: dbMsg.system_notice_type,
      editedAt: dbMsg.edited_at,
      deletedAt: dbMsg.deleted_at,
      createdAt: dbMsg.created_at,
      senderName: `${dbMsg.users?.first_name || ''} ${dbMsg.users?.last_name || ''}`.trim(),
      senderAvatar: dbMsg.users?.avatar_url,
      senderRole: dbMsg.users?.role,
      reactions: [],
      attachments: savedAttachments,
      replyToMessageId: replyObj?.replyToMessageId || null,
      replyToSenderName: replyObj?.replyToSenderName || null,
      replyToContent: replyObj?.replyToContent || null
    };
  },

  async setClassMessageReaction(
    schoolId: string,
    academicSessionId: string,
    messageId: string,
    userId: string,
    reaction: string,
    remove = false
  ): Promise<void> {
    validateSchoolId(schoolId, 'setClassMessageReaction');
    if (remove) {
      const { error } = await supabaseAdmin
        .from('class_message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', userId)
        .eq('reaction', reaction);
      if (error) throw new Error('Failed to delete reaction: ' + error.message);
    } else {
      const { error } = await supabaseAdmin
        .from('class_message_reactions')
        .upsert({
          school_id: schoolId,
          academic_session_id: academicSessionId,
          message_id: messageId,
          user_id: userId,
          reaction: reaction
        }, { onConflict: 'message_id,user_id,reaction' });
      if (error) throw new Error('Failed to save reaction: ' + error.message);
    }
  },

  async setClassPinnedMessage(
    schoolId: string,
    academicSessionId: string,
    groupId: string,
    messageId: string,
    pinnedBy: string,
    pin = true
  ): Promise<void> {
    validateSchoolId(schoolId, 'setClassPinnedMessage');
    
    // Get sender profile for notice
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('first_name, last_name')
      .eq('id', pinnedBy)
      .single();
    
    const userName = `${userProfile?.first_name || ''} ${userProfile?.last_name || ''}`.trim();

    if (pin) {
      const { error } = await supabaseAdmin
        .from('class_pinned_messages')
        .upsert({
          school_id: schoolId,
          academic_session_id: academicSessionId,
          group_id: groupId,
          message_id: messageId,
          pinned_by: pinnedBy
        }, { onConflict: 'message_id' });
      if (error) throw new Error('Failed to pin message: ' + error.message);

      // Create a system message notice in the group
      await this.submitClassChatMessage(
        schoolId,
        academicSessionId,
        groupId,
        pinnedBy,
        `pinned a message.`,
        [],
        null,
        'SYSTEM',
        'NOTICE'
      );
    } else {
      const { error } = await supabaseAdmin
        .from('class_pinned_messages')
        .delete()
        .eq('message_id', messageId);
      if (error) throw new Error('Failed to unpin message: ' + error.message);
    }
  },

  async setClassAnnouncement(
    schoolId: string,
    academicSessionId: string,
    groupId: string,
    messageId: string,
    title: string
  ): Promise<void> {
    validateSchoolId(schoolId, 'setClassAnnouncement');
    const { error } = await supabaseAdmin
      .from('class_announcements')
      .upsert({
        school_id: schoolId,
        academic_session_id: academicSessionId,
        group_id: groupId,
        message_id: messageId,
        title: title
      }, { onConflict: 'message_id' });

    if (error) throw new Error('Failed to set announcement: ' + error.message);
  },

  async deleteClassChatMessage(schoolId: string, academicSessionId: string, messageId: string, userId: string, role: string): Promise<void> {
    validateSchoolId(schoolId, 'deleteClassChatMessage');

    // Fetch message sender
    const { data: msg } = await supabaseAdmin
      .from('class_messages')
      .select('sender_id, group_id')
      .eq('id', messageId)
      .single();

    if (!msg) throw new Error('Message not found.');

    const isAuthorized = msg.sender_id === userId || ['ADMIN', 'TEACHER', 'CLASS_TEACHER', 'ACADEMIC_ADMIN', 'SUPER_ADMIN'].includes(role);
    if (!isAuthorized) throw new Error('Not authorized to delete this message.');

    const { error } = await supabaseAdmin
      .from('class_messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId);

    if (error) throw new Error('Failed to delete message: ' + error.message);

    // Audit log
    try {
      await supabaseAdmin.from('class_chat_audit_logs').insert({
        school_id: schoolId,
        academic_session_id: academicSessionId,
        group_id: msg.group_id,
        user_id: userId,
        action: 'DELETE_MESSAGE',
        details: { messageId }
      });
    } catch {}
  },

  async muteStudentInClassGroup(
    schoolId: string,
    academicSessionId: string,
    groupId: string,
    studentUserId: string,
    muteMinutes: number,
    permanent = false
  ): Promise<void> {
    validateSchoolId(schoolId, 'muteStudentInClassGroup');

    const mutedUntil = permanent ? null : new Date(Date.now() + muteMinutes * 60 * 1000).toISOString();

    const { error } = await supabaseAdmin
      .from('class_chat_members')
      .update({
        muted_until: mutedUntil,
        is_permanently_muted: permanent
      })
      .eq('group_id', groupId)
      .eq('user_id', studentUserId);

    if (error) throw new Error('Failed to mute student: ' + error.message);

    // Audit log
    try {
      await supabaseAdmin.from('class_chat_audit_logs').insert({
        school_id: schoolId,
        academic_session_id: academicSessionId,
        group_id: groupId,
        user_id: studentUserId,
        action: permanent ? 'PERMANENT_MUTE' : 'MUTE',
        details: { muteMinutes }
      });
    } catch {}
  },

  async postGroupDiscussionSystemNotice(
    schoolId: string,
    academicSessionId: string,
    classId: string,
    noticeType: 'HOMEWORK' | 'ASSIGNMENT' | 'EXAM' | 'TIMETABLE' | 'NOTICE',
    title: string,
    actorUserId: string
  ): Promise<void> {
    try {
      const { data: group } = await supabaseAdmin
        .from('class_chat_groups')
        .select('id')
        .eq('school_id', schoolId)
        .eq('academic_session_id', academicSessionId)
        .eq('class_id', classId)
        .eq('is_archived', false)
        .maybeSingle();

      if (group) {
        let content = '';
        if (noticeType === 'HOMEWORK') {
          content = `New Homework assigned: "${title}"`;
        } else if (noticeType === 'ASSIGNMENT') {
          content = `New Assignment assigned: "${title}"`;
        } else if (noticeType === 'EXAM') {
          content = `New Exam Schedule published: "${title}"`;
        } else if (noticeType === 'TIMETABLE') {
          content = `Timetable updated: "${title}"`;
        } else if (noticeType === 'NOTICE') {
          content = `New Announcement notice: "${title}"`;
        }

        await supabaseAdmin
          .from('class_messages')
          .insert({
            school_id: schoolId,
            academic_session_id: academicSessionId,
            group_id: group.id,
            sender_id: actorUserId,
            content: content,
            message_type: 'SYSTEM',
            system_notice_type: noticeType
          });
      }
    } catch (err) {
      console.error('Failed to post group discussion system notice:', err);
    }
  },

  async exportClassDiscussionHistory(schoolId: string, academicSessionId: string, groupId: string): Promise<string> {
    validateSchoolId(schoolId, 'exportClassDiscussionHistory');
    const messages = await this.getClassMessages(schoolId, academicSessionId, groupId, 2000, 0);
    
    // Generate CSV content
    const headers = ['Date', 'Sender', 'Role', 'Message', 'Message Type', 'Notice Type', 'Attachments'];
    const rows = messages.map((m: any) => {
      const date = new Date(m.createdAt).toLocaleString();
      const sender = m.senderName;
      const role = m.senderRole || '';
      const content = (m.content || '').replace(/"/g, '""');
      const msgType = m.messageType;
      const noticeType = m.systemNoticeType || '';
      const attachments = (m.attachments || []).map((a: any) => a.fileUrl).join(' | ');
      return [
        `"${date}"`,
        `"${sender}"`,
        `"${role}"`,
        `"${content}"`,
        `"${msgType}"`,
        `"${noticeType}"`,
        `"${attachments}"`
      ];
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    return csvContent;
  },


  async getForumCategories(schoolId?: string): Promise<ForumCategory[]> {
    await delay();
    let cats = mockDb.forumCategories;
    if (schoolId) {
      cats = cats.filter(c => c.schoolId === schoolId);
    }
    return cats.filter(c => (c.status === undefined || c.status === 'ACTIVE') && !c.deletedAt);
  },

  async getForumPosts(): Promise<(ForumPost & { schoolId: string; authorName: string; categoryName: string; repliesCount: number })[]> {
    await delay();
    return mockDb.forumPosts
      .filter(p => (p.status === undefined || p.status === 'ACTIVE') && !p.deletedAt)
      .map(p => {
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
      })
      .filter(p => {
        const cat = mockDb.forumCategories.find(c => c.id === p.categoryId);
        if (!cat) return false;
        return (cat.status === undefined || cat.status === 'ACTIVE') && !cat.deletedAt;
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
    const category = mockDb.forumCategories.find(c => c.id === categoryId);
    const targetSchoolId = category?.schoolId || user?.schoolId || '';

    if (targetSchoolId) {
      const school = mockDb.schools.find(s => s.id === targetSchoolId);
      if (school) {
        const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
        if (!plan.features.communications) {
          throw new Error(`Communications feature is not enabled on your ${school.subscriptionPlan} plan.`);
        }
      }
    }

    const activeSessionId = await this.resolveActiveSessionId(targetSchoolId);

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
    const postObj = mockDb.forumPosts.find(p => p.id === postId);
    const category = postObj ? mockDb.forumCategories.find(c => c.id === postObj.categoryId) : undefined;
    const targetSchoolId = category?.schoolId || user?.schoolId || '';

    if (targetSchoolId) {
      const school = mockDb.schools.find(s => s.id === targetSchoolId);
      if (school) {
        const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
        if (!plan.features.communications) {
          throw new Error(`Communications feature is not enabled on your ${school.subscriptionPlan} plan.`);
        }
      }
    }

    const activeSessionId = await this.resolveActiveSessionId(targetSchoolId);

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

    let currentUsr = mockDb.users.find(u => u.id === userId);
    if (!currentUsr) {
      // Not in cache — re-fetch from DB (e.g. after hard refresh cleared localStorage)
      const { data: dbSelf } = await supabaseAdmin.from('users').select('*').eq('id', userId).maybeSingle();
      if (!dbSelf) {
        console.warn('[getChatInbox] User not found in DB either:', userId);
        return [];
      }
      currentUsr = {
        id: dbSelf.id, email: dbSelf.email, role: dbSelf.role,
        firstName: dbSelf.first_name, lastName: dbSelf.last_name,
        phone: dbSelf.phone || '', avatarUrl: dbSelf.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        isActive: dbSelf.is_active, schoolId: dbSelf.school_id,
        createdAt: dbSelf.created_at || new Date().toISOString(),
        updatedAt: dbSelf.updated_at || dbSelf.created_at || new Date().toISOString()
      };
      mockDb.users.push(currentUsr);
      mockDb.saveAll();
    }

    console.log('[getChatInbox] currentUsr:', currentUsr.role, currentUsr.id, 'schoolId:', currentUsr.schoolId);

    if (currentUsr.role === 'SUPER_ADMIN') {
      const { data: dbAdmins } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('role', 'ADMIN');
      if (dbAdmins) {
        dbAdmins.forEach((r: any) => {
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
    } else if (currentUsr.schoolId) {
      await this.syncUsersData(currentUsr.schoolId);
      const planName = await this.getLiveSchoolSubscriptionPlan(currentUsr.schoolId);
      if (planName !== 'enterprise' && (currentUsr.role as string) !== 'SUPER_ADMIN') {
        return []; // Hide related API data when locked
      }
      // Sync all dependency data so checkChatAllowed can resolve class/teacher/parent relationships
      await Promise.all([
        this.syncStudentsData(currentUsr.schoolId).catch(() => {}),
        this.syncTeachersData(currentUsr.schoolId).catch(() => {}),
        this.syncClassesData(currentUsr.schoolId).catch(() => {}),
        this.syncTeacherClassSubjectMappingsData(currentUsr.schoolId).catch(() => {}),
        this.syncParentsData(currentUsr.schoolId).catch(() => {}),
        this.syncParentStudentMappingsData(currentUsr.schoolId).catch(() => {}),
      ]);
    }

    await this.syncChatMessagesData(userId);

    // Identify active contact IDs from synchronized messages
    const activeContactIds = new Set<string>();
    mockDb.chatMessages.forEach(m => {
      if (m.senderId === userId) activeContactIds.add(m.receiverId);
      if (m.receiverId === userId) activeContactIds.add(m.senderId);
    });

    // Filter contacts based on permission matrix and active conversations
    const chats = mockDb.users.filter(u => activeContactIds.has(u.id) && checkChatAllowed(currentUsr, u));

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

  async getAllowedContacts(userId: string): Promise<User[]> {
    await delay();

    let currentUsr = mockDb.users.find(u => u.id === userId);
    if (!currentUsr) {
      // Not in cache — re-fetch from DB (e.g. after hard refresh cleared localStorage)
      const { data: dbSelf } = await supabaseAdmin.from('users').select('*').eq('id', userId).maybeSingle();
      if (!dbSelf) {
        console.warn('[getAllowedContacts] User not found in DB either:', userId);
        return [];
      }
      currentUsr = {
        id: dbSelf.id, email: dbSelf.email, role: dbSelf.role,
        firstName: dbSelf.first_name, lastName: dbSelf.last_name,
        phone: dbSelf.phone || '', avatarUrl: dbSelf.avatar_url || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150',
        isActive: dbSelf.is_active, schoolId: dbSelf.school_id,
        createdAt: dbSelf.created_at || new Date().toISOString(),
        updatedAt: dbSelf.updated_at || dbSelf.created_at || new Date().toISOString()
      };
      mockDb.users.push(currentUsr);
      mockDb.saveAll();
    }

    console.log('[getAllowedContacts] currentUsr role:', currentUsr.role, '| schoolId:', currentUsr.schoolId, '| id:', currentUsr.id);

    if ((currentUsr.role as string) === 'SUPER_ADMIN') {
      // Fetch ALL school admins (SUPER_ADMIN can communicate with all school-level admins)
      const { data: dbAdmins } = await supabaseAdmin
        .from('users')
        .select('*')
        .eq('role', 'ADMIN');
      console.log('[getAllowedContacts] SUPER_ADMIN: fetched ADMIN users:', dbAdmins?.length ?? 0);
      if (dbAdmins) {
        dbAdmins.forEach((r: any) => {
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
    } else if (currentUsr.schoolId) {
      // Sync all dependency data so checkChatAllowed can resolve class/teacher/parent relationships
      await Promise.all([
        this.syncUsersData(currentUsr.schoolId),
        this.syncStudentsData(currentUsr.schoolId).catch(() => {}),
        this.syncTeachersData(currentUsr.schoolId).catch(() => {}),
        this.syncClassesData(currentUsr.schoolId).catch(() => {}),
        this.syncTeacherClassSubjectMappingsData(currentUsr.schoolId).catch(() => {}),
        this.syncParentsData(currentUsr.schoolId).catch(() => {}),
        this.syncParentStudentMappingsData(currentUsr.schoolId).catch(() => {}),
      ]);
    }

    const allowed = mockDb.users.filter(u => checkChatAllowed(currentUsr!, u));
    console.log('[getAllowedContacts] contacts allowed for role', currentUsr.role, ':', allowed.length, allowed.map(u => u.role + ':' + u.firstName));
    return allowed;
  },

  async getChatHistory(senderId: string, receiverId: string): Promise<ChatMessage[]> {
    await delay();
    
    await this.syncChatMessagesData(senderId);

    // Find DIRECT channel between senderId and receiverId
    const { data: senderChannels } = await supabaseAdmin
      .from('communication_participants')
      .select('channel_id, communication_channels!inner(channel_type)')
      .eq('user_id', senderId)
      .eq('communication_channels.channel_type', 'DIRECT');

    let channelId: string | null = null;
    if (senderChannels && senderChannels.length > 0) {
      const channelIds = senderChannels.map((sc: any) => sc.channel_id);
      const { data: receiverParticipants } = await supabaseAdmin
        .from('communication_participants')
        .select('channel_id')
        .eq('user_id', receiverId)
        .in('channel_id', channelIds);
        
      if (receiverParticipants && receiverParticipants.length > 0) {
        channelId = receiverParticipants[0].channel_id;
      }
    }

    if (channelId) {
      // Mark as read in communication_messages table
      await supabaseAdmin
        .from('communication_messages')
        .update({ is_read: true, read_status: true })
        .eq('channel_id', channelId)
        .eq('sender_id', receiverId)
        .eq('is_read', false);

      // Log reads in communication_message_reads
      const unreadMsgs = mockDb.chatMessages.filter(
        m => m.senderId === receiverId && m.receiverId === senderId && !m.isRead
      );
      if (unreadMsgs.length > 0) {
        for (const msg of unreadMsgs) {
          await supabaseAdmin
            .from('communication_message_reads')
            .insert({
              message_id: msg.id,
              user_id: senderId
            })
            .select()
            .maybeSingle(); // conflict handled by DB
        }
      }
    }

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

    const sender = mockDb.users.find(u => u.id === senderId);
    const receiver = mockDb.users.find(u => u.id === receiverId);

    if (!sender || !receiver) throw new Error('Sender or receiver not found');

    // Enforce school isolation
    if ((sender.role as string) !== 'SUPER_ADMIN' && (receiver.role as string) !== 'SUPER_ADMIN') {
      if (sender.schoolId !== receiver.schoolId) {
        throw new Error('Messaging permission denied');
      }
    }

    // Enforce Enterprise subscription check
    if ((sender.role as string) !== 'SUPER_ADMIN' && sender.schoolId) {
      const planName = await this.getLiveSchoolSubscriptionPlan(sender.schoolId);
      if (planName !== 'enterprise') {
        throw new Error('Messaging permission denied');
      }
    }

    // Enforce role DM matrix rules
    if (!checkChatAllowed(sender, receiver)) {
      throw new Error('Messaging permission denied');
    }

    // Find or create DIRECT channel
    const { data: senderChannels } = await supabaseAdmin
      .from('communication_participants')
      .select('channel_id, communication_channels!inner(channel_type)')
      .eq('user_id', senderId)
      .eq('communication_channels.channel_type', 'DIRECT');

    let channelId: string | null = null;
    if (senderChannels && senderChannels.length > 0) {
      const channelIds = senderChannels.map((sc: any) => sc.channel_id);
      const { data: receiverParticipants } = await supabaseAdmin
        .from('communication_participants')
        .select('channel_id')
        .eq('user_id', receiverId)
        .in('channel_id', channelIds);
        
      if (receiverParticipants && receiverParticipants.length > 0) {
        channelId = receiverParticipants[0].channel_id;
      }
    }

    // schoolId: prefer receiver's schoolId for Super Admin who has no school
    const schoolId = sender.schoolId || receiver.schoolId || null;
    if (!channelId) {
      // Create channel — school_id may be null for Super Admin ↔ Admin cross-school channels
      const channelInsertPayload: Record<string, any> = {
        channel_type: 'DIRECT',
        created_by: senderId
      };
      if (schoolId) channelInsertPayload.school_id = schoolId;

      const { data: newChannel, error: newChError } = await supabaseAdmin
        .from('communication_channels')
        .insert(channelInsertPayload)
        .select()
        .single();

      if (newChError || !newChannel) {
        throw new Error(newChError ? newChError.message : 'Failed to create chat channel');
      }

      channelId = newChannel.id;

      // Add participants
      const { error: partErr } = await supabaseAdmin
        .from('communication_participants')
        .insert([
          { channel_id: channelId, user_id: senderId, role: sender.role },
          { channel_id: channelId, user_id: receiverId, role: receiver.role }
        ]);

      if (partErr) {
        throw new Error(partErr.message);
      }
    }

    // Insert message — school_id may be null for Super Admin channels
    const msgInsertPayload: Record<string, any> = {
      channel_id: channelId,
      sender_id: senderId,
      sender_role: sender.role,
      receiver_id: receiverId,
      receiver_role: receiver.role,
      message_content: message,
      is_read: false,
      read_status: false
    };
    if (schoolId) msgInsertPayload.school_id = schoolId;

    // Insert message into communication_messages
    const { data: r, error } = await supabaseAdmin
      .from('communication_messages')
      .insert([msgInsertPayload])
      .select()
      .single();

    if (error || !r) {
      throw new Error(error ? error.message : 'Failed to transmit chat message through gateway');
    }

    const chat: ChatMessage = {
      id: r.id,
      senderId: r.sender_id,
      receiverId: receiverId,
      message: r.message_content,
      isRead: r.is_read || r.read_status,
      createdAt: r.created_at
    };

    mockDb.chatMessages.push(chat);
    mockDb.saveAll();
    return chat;
  },

  async getStudyMaterials(schoolId: string, classId?: string | null): Promise<(StudyMaterial & { subjectName: string; teacherName: string; className: string })[]> {
    await this.syncStudyMaterialsData(schoolId);
    let list = mockDb.studyMaterials.filter(m => m.schoolId === schoolId);
    if (classId) {
      list = list.filter(m => m.classId === classId || m.classId === null);
    }
    return list.map(sm => {
      const s = mockDb.subjects.find(sub => sub.id === sm.subjectId);
      const t = sm.teacherId ? mockDb.teachers.find(tch => tch.id === sm.teacherId) : null;
      const tu = t ? mockDb.users.find(usr => usr.id === t.userId) : null;
      const c = sm.classId ? mockDb.classes.find(cls => cls.id === sm.classId) : null;
      return {
        ...sm,
        subjectName: s ? s.name : 'Subject',
        teacherName: tu ? `${tu.firstName} ${tu.lastName}` : 'Guest Faculty',
        className: c ? c.name : 'School-wide'
      };
    });
  },

  async teacherUploadStudyMaterial(
    teacherId: string, 
    subjectId: string, 
    classId: string,
    title: string, 
    desc: string, 
    fileUrl: string, 
    type: 'pdf' | 'docx' | 'mp4' | 'stream', 
    isStreamable: boolean,
    file?: File
  ): Promise<StudyMaterial> {
    await delay(600);

    const teacher = mockDb.teachers.find(t => t.id === teacherId)!;
    if (!teacher) throw new Error('Teacher not found.');
    const schoolId = teacher.schoolId;
    if (!schoolId) throw new Error('Teacher has no school association.');

    // Plan check
    await this.validateEnterpriseSubscription(schoolId);

    let finalFileUrl = fileUrl;
    let mimeType = 'url/stream';

    // File Upload Handler
    if (file && type !== 'stream') {
      // Validate file size limit: 100MB
      const sizeLimitBytes = 100 * 1024 * 1024;
      if (file.size > sizeLimitBytes) {
        throw new Error('File size exceeds the 100 MB limit. Please optimize or compress your file.');
      }

      // Validate MIME type
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      mimeType = file.type;
      if (type === 'pdf' && extension !== 'pdf') {
        throw new Error('Selected format is PDF but the uploaded file extension is not .pdf.');
      }
      if (type === 'docx' && extension !== 'docx') {
        throw new Error('Selected format is Word Document but the uploaded file extension is not .docx.');
      }
      if (type === 'mp4' && !['mp4', 'mov', 'webm', 'ogg', 'avi'].includes(extension)) {
        throw new Error('Selected format is Video Lecture but the uploaded file extension is not a supported video format.');
      }

      const timestamp = Date.now();
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filePath = `${schoolId}/teacher_${teacherId}/${timestamp}_${cleanFileName}`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from('materials')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error('Failed to upload file to Supabase storage: ' + uploadError.message);
      }

      // Resolve public URL
      const { data: { publicUrl } } = supabaseAdmin.storage
        .from('materials')
        .getPublicUrl(filePath);

      finalFileUrl = publicUrl;
    } else if (type === 'stream') {
      // Stream live link validation
      if (!/^https?:\/\//i.test(finalFileUrl)) {
        throw new Error('Please enter a valid URL (starting with http:// or https://) for the live stream link.');
      }
    } else {
      if (!finalFileUrl) {
        throw new Error('Please upload an actual file or enter a valid resource URL.');
      }
    }

    // Resolve active academic session
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

    const { data: dbMaterial, error } = await supabaseAdmin
      .from('study_materials')
      .insert({
        school_id: schoolId,
        subject_id: subjectId,
        class_id: classId || null,
        teacher_id: teacherId,
        uploaded_by: teacher.userId,
        academic_session_id: academicSessionId,
        title,
        description: desc,
        file_url: finalFileUrl,
        file_type: type,
        mime_type: mimeType,
        is_video_streamable: isStreamable,
        thumbnail_url: null
      })
      .select()
      .single();

    if (error || !dbMaterial) {
      throw new Error(error?.message || 'Failed to upload study material metadata to Supabase.');
    }

    const sm: StudyMaterial = {
      id: dbMaterial.id,
      schoolId: dbMaterial.school_id,
      subjectId: dbMaterial.subject_id,
      classId: dbMaterial.class_id,
      teacherId: dbMaterial.teacher_id,
      uploadedBy: dbMaterial.uploaded_by,
      academicSessionId: dbMaterial.academic_session_id,
      title: dbMaterial.title,
      description: dbMaterial.description || undefined,
      fileUrl: dbMaterial.file_url,
      thumbnailUrl: dbMaterial.thumbnail_url || null,
      fileType: dbMaterial.file_type as any,
      mimeType: dbMaterial.mime_type || null,
      isVideoStreamable: dbMaterial.is_video_streamable,
      createdAt: dbMaterial.created_at
    };

    mockDb.studyMaterials.unshift(sm);
    mockDb.addLog(teacher.userId, 'UPLOAD_STUDY_MATERIAL', { title, type });
    mockDb.saveAll();
    return sm;
  },

  async teacherEditStudyMaterial(
    materialId: string, 
    subjectId: string, 
    classId: string,
    title: string, 
    desc: string, 
    fileUrl: string, 
    type: 'pdf' | 'docx' | 'mp4' | 'stream', 
    isStreamable: boolean
  ): Promise<StudyMaterial> {
    await delay(500);

    const { data: currentMaterial } = await supabaseAdmin
      .from('study_materials')
      .select('school_id')
      .eq('id', materialId)
      .maybeSingle();
    if (currentMaterial) {
      await this.validateEnterpriseSubscription(currentMaterial.school_id);
    }

    const { data: dbMaterial, error } = await supabaseAdmin
      .from('study_materials')
      .update({
        subject_id: subjectId,
        class_id: classId || null,
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
      schoolId: dbMaterial.school_id,
      subjectId: dbMaterial.subject_id,
      classId: dbMaterial.class_id,
      teacherId: dbMaterial.teacher_id,
      uploadedBy: dbMaterial.uploaded_by,
      academicSessionId: dbMaterial.academic_session_id,
      title: dbMaterial.title,
      description: dbMaterial.description || undefined,
      fileUrl: dbMaterial.file_url,
      thumbnailUrl: dbMaterial.thumbnail_url || null,
      fileType: dbMaterial.file_type as any,
      mimeType: dbMaterial.mime_type || null,
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

    const { data: currentMaterial } = await supabaseAdmin
      .from('study_materials')
      .select('school_id')
      .eq('id', materialId)
      .maybeSingle();
    if (currentMaterial) {
      await this.validateEnterpriseSubscription(currentMaterial.school_id);
    }

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
    await this.syncNotificationsData(userId);
    return mockDb.notifications
      .filter(n => n.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);
    } catch (e) {
      console.error('Failed to mark notification as read in DB:', e);
    }
    const idx = mockDb.notifications.findIndex(n => n.id === notificationId);
    if (idx !== -1) {
      mockDb.notifications[idx].isRead = true;
      mockDb.saveAll();
    }
  },

  async checkEnterpriseSubscription(schoolId: string): Promise<boolean> {
    if (!schoolId) return false;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const { data: activeSub, error: subError } = await supabaseAdmin
        .from('school_subscriptions')
        .select('*')
        .eq('school_id', schoolId)
        .eq('plan', 'ENTERPRISE')
        .eq('status', 'ACTIVE')
        .gte('expiry_date', todayStr)
        .limit(1)
        .maybeSingle();

      if (subError) {
        // Fallback to schools table if the subscription table query fails (e.g. table not created yet)
        const { data: dbSchool } = await supabaseAdmin
          .from('schools')
          .select('subscription_plan')
          .eq('id', schoolId)
          .maybeSingle();
        return dbSchool?.subscription_plan?.toLowerCase() === 'enterprise';
      }

      return !!activeSub;
    } catch {
      const s = mockDb.schools.find(x => x.id === schoolId);
      return s?.subscriptionPlan?.toLowerCase() === 'enterprise';
    }
  },

  async checkHostelAccess(schoolId: string): Promise<void> {
    const isEnterprise = await this.checkEnterpriseSubscription(schoolId);
    if (!isEnterprise) {
      throw new Error('Enterprise subscription required');
    }
  },

  async validateTransportAction(
    schoolId: string,
    action: 'create' | 'update' | 'delete' | 'assign' | 'configure',
    targetId?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    const activeUser = getActiveUser();
    if (!activeUser) {
      throw new Error('Security Policy Alert: No active session found.');
    }
    
    const role = activeUser.role;
    
    if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
      return;
    }

    if (role === 'FINANCE_ADMIN' || role === 'ACADEMIC_ADMIN') {
      await this.writeAuditLog(
        activeUser.id,
        null,
        schoolId,
        'TRANSPORT',
        `UNAUTHORIZED_${action.toUpperCase()}_ATTEMPT`,
        targetId,
        oldData,
        { role, action, error: 'You do not have permission to modify transport data.' }
      );
      throw new Error('You do not have permission to modify transport data.');
    }

    try {
      const { data: dbRole } = await supabaseAdmin
        .from('roles')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role_code', role)
        .maybeSingle();
        
      if (dbRole) {
        const { data: perm } = await supabaseAdmin
          .from('role_permissions')
          .select('*')
          .eq('role_id', dbRole.id)
          .eq('module_name', 'transport')
          .maybeSingle();

        if (perm) {
          const hasPerm = 
            (action === 'create' && perm.can_create) ||
            ((action === 'update' || action === 'assign' || action === 'configure') && perm.can_edit) ||
            (action === 'delete' && perm.can_delete);

          if (hasPerm) {
            return;
          }
        }
      }
    } catch (err) {
      console.error('Database permission check failed:', err);
    }

    if (role === 'TRANSPORT_MANAGER') {
      return;
    }

    await this.writeAuditLog(
      activeUser.id,
      null,
      schoolId,
      'TRANSPORT',
      `UNAUTHORIZED_${action.toUpperCase()}_ATTEMPT`,
      targetId,
      oldData,
      { role, action, error: 'You do not have permission to modify transport data.' }
    );
    throw new Error('You do not have permission to modify transport data.');
  },

  async logTransportAuditAction(
    schoolId: string,
    actionType: string,
    targetId?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    const activeUser = getActiveUser();
    if (activeUser) {
      await this.writeAuditLog(activeUser.id, null, schoolId, 'TRANSPORT', actionType, targetId, oldData, newData);
    }
  },

  async getLiveSchoolSubscriptionPlan(schoolId: string): Promise<string | null> {
    if (!schoolId) return null;
    try {
      // 1. Query subscriptions table for the latest subscription (source of truth)
      const { data: latestSub, error: subError } = await supabaseAdmin
        .from('subscriptions')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      let plan = 'freemium';
      
      if (!subError && latestSub) {
        const todayStr = new Date().toISOString().split('T')[0];
        const isExpired = latestSub.status === 'EXPIRED' || (latestSub.expiry_date && latestSub.expiry_date < todayStr);
        if (isExpired) {
          plan = 'expired';
        } else {
          plan = latestSub.plan_code.toLowerCase();
        }
      } else {
        // Fallback: Query the old school_subscriptions table for active plan
        const todayStr = new Date().toISOString().split('T')[0];
        const { data: activeSub, error: schoolSubError } = await supabaseAdmin
          .from('school_subscriptions')
          .select('*')
          .eq('school_id', schoolId)
          .eq('status', 'ACTIVE')
          .gte('expiry_date', todayStr)
          .limit(1)
          .maybeSingle();

        if (!schoolSubError && activeSub) {
          plan = activeSub.plan.toLowerCase();
        } else {
          // If no subscription record exists at all, fall back to schools table
          const { data: dbSchool } = await supabaseAdmin
            .from('schools')
            .select('*')
            .eq('id', schoolId)
            .maybeSingle();
            
          if (dbSchool) {
            plan = dbSchool.subscription_plan ? dbSchool.subscription_plan.toLowerCase() : 'freemium';
          }
        }
      }
      
      // Update local mockDb.schools cache in real time!
      const schoolMapped = {
        id: schoolId,
        name: mockDb.schools.find(s => s.id === schoolId)?.name || 'Institution Name',
        address: '',
        phone: '',
        subscriptionPlan: plan as any,
        createdAt: new Date().toISOString()
      };
      const idx = mockDb.schools.findIndex(s => s.id === schoolId);
      if (idx === -1) mockDb.schools.push(schoolMapped);
      else mockDb.schools[idx].subscriptionPlan = plan as any;
      mockDb.saveAll();
      
      return plan;
    } catch {
      return 'freemium';
    }
  },

  async fetchRoles(schoolId: string): Promise<Role[]> {
    const { data, error } = await supabaseAdmin
      .from('roles')
      .select('*')
      .eq('school_id', schoolId);
      
    if (error || !data) return [];
    
    return data.map((d: any) => ({
      id: d.id,
      roleName: d.role_name,
      roleCode: d.role_code,
      description: d.description || undefined,
      schoolId: d.school_id,
      createdAt: d.created_at,
      updatedAt: d.updated_at
    }));
  },

  async fetchSchoolRolePermissions(schoolId: string): Promise<Record<string, Record<string, boolean>>> {
    const { data: dbRoles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('id, role_code')
      .eq('school_id', schoolId);

    const defaultMatrix: Record<string, Record<string, boolean>> = {
      FINANCE_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
      ACADEMIC_ADMIN: { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true, hostel: false },
      EXAM_CONTROLLER: { billing: false, directory: false, academics: true, grading: true, security: false, books: false, transport: false, hostel: false },
      LIBRARIAN: { billing: false, directory: false, academics: true, grading: false, security: false, books: true, transport: false, hostel: false },
      TRANSPORT_MANAGER: { billing: true, directory: false, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
      HOSTEL_ADMIN: { billing: false, directory: false, academics: false, grading: false, security: false, books: false, transport: false, hostel: true },
      CUSTOM_SUB_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false, hostel: false }
    };

    if (rolesError || !dbRoles || dbRoles.length === 0) {
      return defaultMatrix;
    }

    const matrix: Record<string, Record<string, boolean>> = {};
    for (const roleCode of Object.keys(defaultMatrix)) {
      const role = dbRoles.find(r => r.role_code === roleCode);
      const rolePerms: Record<string, boolean> = { ...defaultMatrix[roleCode] };
      
      if (role) {
        const { data: perms } = await supabaseAdmin
          .from('role_permissions')
          .select('module_name, can_view')
          .eq('role_id', role.id);
        
        if (perms && perms.length > 0) {
          perms.forEach((p: any) => {
            rolePerms[p.module_name] = p.can_view;
          });
        }
      }
      matrix[roleCode] = rolePerms;
    }
    
    return matrix;
  },

  async saveRolePermissionsMatrix(schoolId: string, matrix: Record<string, Record<string, boolean>>): Promise<void> {
    const { data: schoolObj } = await supabaseAdmin.from('schools').select('subscription_plan').eq('id', schoolId).single();
    if (schoolObj?.subscription_plan?.toLowerCase() !== 'enterprise') {
      throw new Error('Modifying the Dynamic Permissions Matrix requires an active Enterprise Subscription plan.');
    }

    const { data: dbRoles, error: rolesError } = await supabaseAdmin
      .from('roles')
      .select('id, role_code')
      .eq('school_id', schoolId);
      
    if (rolesError || !dbRoles) throw new Error('Failed to load roles from database');

    for (const [roleCode, modules] of Object.entries(matrix)) {
      let role = dbRoles.find(r => r.role_code === roleCode);
      
      // If role somehow does not exist, create it dynamically
      if (!role) {
        const { data: newRole, error: createRoleErr } = await supabaseAdmin
          .from('roles')
          .insert({
            role_name: roleCode.replace('_', ' '),
            role_code: roleCode,
            description: `Dynamic sub-admin role for ${roleCode}`,
            school_id: schoolId
          })
          .select('id, role_code')
          .single();
          
        if (createRoleErr || !newRole) {
          console.error(`Failed to create missing role ${roleCode}`, createRoleErr);
          continue;
        }
        role = newRole;
      }
      
      for (const [moduleName, canView] of Object.entries(modules)) {
        const { error } = await supabaseAdmin
          .from('role_permissions')
          .upsert({
            role_id: role.id,
            module_name: moduleName,
            can_view: canView,
            can_create: canView,
            can_edit: canView,
            can_delete: canView,
            can_export: canView,
            can_approve: canView
          }, {
            onConflict: 'role_id,module_name'
          });
        
        if (error) {
          console.error(`Error saving permission ${roleCode}:${moduleName}`, error);
        }
      }
    }
  },

  async writeAuditLog(
    userId: string | null,
    roleId: string | null,
    schoolId: string,
    moduleName: string,
    actionType: string,
    targetId?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    let ipAddress = '127.0.0.1';
    let userAgent = 'Browser (Aegis Web App Client)';
    try {
      userAgent = navigator.userAgent;
    } catch {}

    await supabaseAdmin
      .from('audit_logs')
      .insert({
        user_id: userId || null,
        role_id: roleId || null,
        school_id: schoolId,
        module_name: moduleName,
        action_type: actionType,
        target_id: targetId || null,
        old_data: oldData || null,
        new_data: newData || null,
        ip_address: ipAddress,
        user_agent: userAgent
      });
  },

  async fetchAuditLogs(schoolId: string): Promise<AuditLog[]> {
    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
      
    if (error || !data) return [];
    
    return data.map((d: any) => ({
      id: d.id,
      userId: d.user_id,
      roleId: d.role_id,
      moduleName: d.module_name,
      actionType: d.action_type,
      targetId: d.target_id,
      oldData: d.old_data,
      newData: d.new_data,
      ipAddress: d.ip_address,
      userAgent: d.user_agent,
      schoolId: d.school_id,
      createdAt: d.created_at
    }));
  },

  async updateUserStatus(userId: string, isActive: boolean, adminId: string | null = null): Promise<void> {
    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();

    const { error } = await supabaseAdmin
      .from('users')
      .update({ 
        is_active: isActive,
        deactivated_at: isActive ? null : new Date().toISOString(),
        deactivated_by: isActive ? null : adminId
      })
      .eq('id', userId);
      
    if (error) throw new Error('Failed to update operator status in Supabase: ' + error.message);

    if (userRow) {
      let dedicatedTable = '';
      if (userRow.role === 'FINANCE_ADMIN') dedicatedTable = 'finance_admins';
      else if (userRow.role === 'ACADEMIC_ADMIN') dedicatedTable = 'academic_admins';
      else if (userRow.role === 'EXAM_CONTROLLER') dedicatedTable = 'exam_controllers';
      else if (userRow.role === 'LIBRARIAN') dedicatedTable = 'librarians';
      else if (userRow.role === 'TRANSPORT_MANAGER') dedicatedTable = 'transport_managers';
      else if (userRow.role === 'HOSTEL_ADMIN') dedicatedTable = 'hostel_admins';
      else if (userRow.role === 'CUSTOM_SUB_ADMIN') dedicatedTable = 'custom_sub_admins';

      if (dedicatedTable) {
        await supabaseAdmin
          .from(dedicatedTable)
          .update({ 
            status: isActive ? 'ACTIVE' : 'INACTIVE',
            deactivated_at: isActive ? null : new Date().toISOString(),
            deactivated_by: isActive ? null : adminId
          })
          .eq('user_id', userId);
      }
    }

    // Sync status back to local mockDb
    const cachedUser = mockDb.users.find(u => u.id === userId);
    if (cachedUser) {
      cachedUser.isActive = isActive;
      cachedUser.deactivatedAt = isActive ? undefined : new Date().toISOString();
      cachedUser.deactivatedBy = isActive ? undefined : (adminId || undefined);
      mockDb.saveAll();
    }
  },

  async fetchOperators(schoolId: string): Promise<User[]> {
    const adminRoles = [
      'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 
      'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN',
      'HOSTEL_ADMIN', 'WARDEN'
    ];
    
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('school_id', schoolId)
      .in('role', adminRoles);
      
    if (error || !data) return [];
    
    const operatorsList: User[] = [];
    for (const u of data) {
      let isActiveStatus = u.is_active !== false;
      let dedicatedTable = '';
      if (u.role === 'FINANCE_ADMIN') dedicatedTable = 'finance_admins';
      else if (u.role === 'ACADEMIC_ADMIN') dedicatedTable = 'academic_admins';
      else if (u.role === 'EXAM_CONTROLLER') dedicatedTable = 'exam_controllers';
      else if (u.role === 'LIBRARIAN') dedicatedTable = 'librarians';
      else if (u.role === 'TRANSPORT_MANAGER') dedicatedTable = 'transport_managers';
      else if (u.role === 'CUSTOM_SUB_ADMIN') dedicatedTable = 'custom_sub_admins';
      else if (u.role === 'HOSTEL_ADMIN') dedicatedTable = 'hostel_admins';

      if (dedicatedTable) {
        const { data: profile } = await supabaseAdmin
          .from(dedicatedTable)
          .select('status')
          .eq('user_id', u.id)
          .maybeSingle();
        if (profile) {
          isActiveStatus = profile.status === 'ACTIVE';
        }
      }

      operatorsList.push({
        id: u.id,
        email: u.email,
        role: u.role,
        firstName: u.first_name,
        lastName: u.last_name,
        phone: u.phone || undefined,
        avatarUrl: u.avatar_url || undefined,
        isActive: isActiveStatus,
        schoolId: u.school_id,
        employeeId: u.employee_id || undefined,
        createdAt: u.created_at,
        updatedAt: u.updated_at,
        roleId: u.role_id || undefined,
        lastLoginAt: u.last_login_at || undefined,
        loginDevice: u.login_device || undefined,
        sessionStatus: u.session_status || 'OFFLINE'
      });
    }
    
    return operatorsList;
  },

  // --- Dedicated Finance Admin Helpers ---
  async fetchInvoices(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select('*, student:students(*, userDetails:users(*))')
      .eq('school_id', schoolId);
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      invoiceNumber: d.invoice_number,
      amount: Number(d.amount),
      dueDate: d.due_date,
      status: d.status,
      createdAt: d.created_at,
      studentName: d.student?.userDetails ? `${d.student.userDetails.first_name} ${d.student.userDetails.last_name}` : 'Unknown Student',
      studentEmail: d.student?.userDetails?.email || 'N/A'
    }));
  },

  async createInvoice(schoolId: string, sessionId: string, studentId: string, amount: number, dueDate: string): Promise<void> {
    const invNumber = 'INV-' + Math.floor(100000 + Math.random() * 900000);
    const { error } = await supabaseAdmin.from('invoices').insert({
      school_id: schoolId,
      academic_session_id: sessionId,
      student_id: studentId,
      invoice_number: invNumber,
      amount: amount,
      due_date: dueDate,
      status: 'UNPAID'
    });
    if (error) throw new Error('Failed to generate fee invoice: ' + error.message);
  },

  async fetchPaymentLogs(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('payment_logs')
      .select('*, payment:fee_payments(*)')
      .eq('school_id', schoolId);
    if (error || !data) return [];
    return data;
  },

  async fetchTransportFeeRecords(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('transport_fee_records')
      .select('*, student:students(*, userDetails:users(*)), route:routes(*)')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.transportFeeRecords.filter(tfr => tfr.schoolId === schoolId);

    const mapped = data.map(tfr => ({
      id: tfr.id,
      schoolId: tfr.school_id || schoolId,
      academicSessionId: tfr.academic_session_id,
      studentId: tfr.student_id,
      routeId: tfr.route_id,
      amount: Number(tfr.amount || 0),
      status: tfr.status || 'UNPAID',
      createdAt: tfr.created_at,
      studentName: tfr.student?.userDetails ? `${tfr.student.userDetails.first_name} ${tfr.student.userDetails.last_name}` : 'Unknown Student',
      routeName: tfr.route ? tfr.route.name.split('::')[0] : 'N/A'
    }));

    const otherSchools = mockDb.transportFeeRecords.filter(tfr => tfr.schoolId !== schoolId);
    mockDb.transportFeeRecords = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async toggleTransportFeePayment(id: string, currentStatus: string): Promise<void> {
    const nextStatus = currentStatus === 'PAID' ? 'UNPAID' : 'PAID';
    const { error } = await supabaseAdmin
      .from('transport_fee_records')
      .update({ status: nextStatus })
      .eq('id', id);
    
    const idx = mockDb.transportFeeRecords.findIndex(tfr => tfr.id === id);
    if (idx !== -1) {
      mockDb.transportFeeRecords[idx].status = nextStatus;
      mockDb.saveAll();
    }
    if (error) {
      throw new Error('Failed to update payment status: ' + error.message);
    }
  },

  // --- Dedicated Exam Controller Helpers ---
  async fetchReportCards(schoolId: string, studentId?: string): Promise<any[]> {
    let query = supabaseAdmin.from('report_cards').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      let local = mockDb.reportCards.filter(rc => rc.schoolId === schoolId);
      if (studentId) local = local.filter(rc => rc.studentId === studentId);
      return local.map(rc => {
        const st = mockDb.students.find(s => s.id === rc.studentId);
        const su = st ? mockDb.users.find(usr => usr.id === st.userId) : null;
        return {
          id: rc.id,
          term: rc.term,
          attendancePercentage: rc.attendancePercentage,
          gradePointAverage: rc.gradePointAverage,
          remarks: rc.remarks,
          fileUrl: rc.fileUrl || '',
          createdAt: rc.createdAt,
          studentName: su ? `${su.firstName} ${su.lastName}` : 'Unknown Student'
        };
      });
    }

    const mapped = data.map(d => ({
      id: d.id,
      schoolId: d.school_id,
      academicSessionId: d.academic_session_id || '',
      studentId: d.student_id,
      term: d.term,
      attendancePercentage: Number(d.attendance_percentage || 0),
      gradePointAverage: Number(d.grade_point_average || 0),
      remarks: d.remarks || '',
      fileUrl: d.file_url || '',
      createdAt: d.created_at,
      studentName: d.student?.userDetails ? `${d.student.userDetails.first_name} ${d.student.userDetails.last_name}` : 'Unknown Student'
    }));

    const otherSchools = mockDb.reportCards.filter(rc => rc.schoolId !== schoolId);
    mockDb.reportCards = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createReportCard(
    schoolId: string, sessionId: string, studentId: string, term: string, 
    attendancePercentage: number, gradePointAverage: number, remarks: string, fileUrl: string
  ): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const resolvedSessionId = (sessionId && isUUID(sessionId)) 
      ? sessionId 
      : await this.resolveActiveSessionId(schoolId);

    const { data, error } = await supabaseAdmin.from('report_cards').insert({
      school_id: schoolId,
      academic_session_id: resolvedSessionId,
      student_id: studentId,
      term: term,
      attendance_percentage: attendancePercentage,
      grade_point_average: gradePointAverage,
      remarks: remarks,
      file_url: fileUrl
    }).select().single();

    const newReportCard = {
      id: data ? data.id : ('rc-' + Math.random().toString(36).substr(2, 9)),
      schoolId,
      academicSessionId: resolvedSessionId,
      studentId,
      term,
      attendancePercentage,
      gradePointAverage,
      remarks,
      fileUrl,
      createdAt: data ? data.created_at : new Date().toISOString()
    };

    mockDb.reportCards.push(newReportCard);
    mockDb.saveAll();

    if (error) throw new Error('Failed to publish student report card: ' + error.message);
  },

  async fetchQuizResults(schoolId: string, studentId?: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'Interactive MCQ Online Quizzes', ['pro', 'enterprise']);
    let query = supabaseAdmin.from('quiz_results').select('*, student:students(*, userDetails:users(*)), quiz:quizzes(*)').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data;
  },

  async fetchBookInventory(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    const { data, error } = await supabaseAdmin
      .from('book_inventory')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.books.filter(b => b.schoolId === schoolId);
    
    const mapped = data.map(b => ({
      id: b.id,
      schoolId: b.school_id,
      title: b.title,
      author: b.author,
      isbn: b.isbn,
      subject: b.subject,
      totalCopies: b.total_copies,
      availableCopies: b.available_copies,
      createdAt: b.created_at
    }));

    const otherSchools = mockDb.books.filter(b => b.schoolId !== schoolId);
    mockDb.books = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async fetchDigitalLibraryAssets(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'Digital Library Resources', ['basic', 'pro', 'enterprise']);
    const { data, error } = await supabaseAdmin
      .from('digital_library_assets')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.digitalLibraryAssets.filter(d => d.schoolId === schoolId);
    
    const mapped = data.map(d => ({
      id: d.id,
      schoolId: d.school_id,
      title: d.title,
      author: d.author || 'Anonymous',
      fileUrl: d.file_url,
      fileType: d.file_type || 'pdf',
      createdAt: d.created_at
    }));

    const otherSchools = mockDb.digitalLibraryAssets.filter(d => d.schoolId !== schoolId);
    mockDb.digitalLibraryAssets = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  // --- Dedicated Transport Manager Helpers ---
  async fetchDrivers(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.drivers.filter(d => d.schoolId === schoolId);
    
    if (data.length > 0) {
      const mapped = data.map(d => ({
        id: d.id,
        schoolId: d.school_id || schoolId,
        name: d.name,
        licenseNumber: d.license_number || d.licenseNumber,
        phone: d.phone,
        status: d.status || 'ACTIVE',
        createdAt: d.created_at,
        employeeId: d.employee_id || d.employeeId || null
      }));

      mapped.forEach(d => {
        const idx = mockDb.drivers.findIndex(md => md.id === d.id);
        if (idx === -1) mockDb.drivers.push(d);
        else mockDb.drivers[idx] = d;
      });
      mockDb.drivers = mockDb.drivers.filter(md => md.schoolId !== schoolId || mapped.some(m => m.id === md.id));
      mockDb.saveAll();

      return mapped;
    }
    return mockDb.drivers.filter(d => d.schoolId === schoolId);
  },

  async createDriver(schoolId: string, sessionId: string, name: string, licenseNumber: string, phone: string, employeeId?: string | null): Promise<void> {
    await this.validateTransportAction(schoolId, 'create', undefined, undefined, { name, licenseNumber, phone });
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const resolvedSessionId = (sessionId && isUUID(sessionId)) ? sessionId : null;

    const resolvedEmployeeId = employeeId?.trim() || ('DRV-' + Math.floor(100000 + Math.random() * 900000).toString());

    const { error } = await supabaseAdmin.from('drivers').insert({
      school_id: schoolId,
      academic_session_id: resolvedSessionId,
      name: name,
      license_number: licenseNumber,
      phone: phone,
      status: 'ACTIVE',
      employee_id: resolvedEmployeeId
    });
    if (error) {
      mockDb.drivers.push({
        id: 'dr-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        name,
        licenseNumber,
        phone,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        employeeId: resolvedEmployeeId
      });
      mockDb.saveAll();
    }
    await this.logTransportAuditAction(schoolId, 'CREATE_DRIVER', undefined, undefined, { name, licenseNumber, phone, employeeId: resolvedEmployeeId });
  },

  async fetchPickupPoints(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('pickup_points')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.pickupPoints.filter(p => p.schoolId === schoolId);
    
    if (data.length > 0) {
      const mapped = data.map(p => {
        const parts = (p.name || '').split('::');
        const name = parts[0] || p.name;
        const routeId = parts[1] || p.route_id || p.routeId || '';
        return {
          id: p.id,
          schoolId: p.school_id || schoolId,
          name,
          routeId,
          latitude: p.latitude !== null ? Number(p.latitude) : null,
          longitude: p.longitude !== null ? Number(p.longitude) : null,
          createdAt: p.created_at
        };
      });

      mapped.forEach(p => {
        const idx = mockDb.pickupPoints.findIndex(mp => mp.id === p.id);
        if (idx === -1) mockDb.pickupPoints.push(p);
        else mockDb.pickupPoints[idx] = p;
      });
      mockDb.pickupPoints = mockDb.pickupPoints.filter(mp => mp.schoolId !== schoolId || mapped.some(m => m.id === mp.id));
      mockDb.saveAll();

      return mapped;
    }
    return mockDb.pickupPoints.filter(p => p.schoolId === schoolId);
  },

  async fetchVehicleLogs(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('vehicle_logs')
      .select('*, bus:buses(*)')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.vehicleLogs.filter(vl => vl.schoolId === schoolId);
    
    const mapped = data.map(vl => ({
      id: vl.id,
      schoolId: vl.school_id || schoolId,
      academicSessionId: vl.academic_session_id || '',
      busId: vl.bus_id,
      logType: vl.log_type,
      description: vl.description || '',
      amount: Number(vl.amount || 0),
      createdAt: vl.created_at,
      bus: vl.bus ? {
        id: vl.bus.id,
        numberPlate: vl.bus.number_plate || vl.bus.plate_number || ''
      } : null
    }));

    const otherSchools = mockDb.vehicleLogs.filter(vl => vl.schoolId !== schoolId);
    mockDb.vehicleLogs = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createVehicleLog(schoolId: string, sessionId: string, busId: string, logType: string, description: string, amount: number): Promise<void> {
    await this.validateTransportAction(schoolId, 'create', undefined, undefined, { busId, logType, description, amount });
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validBusId = (busId && isUUID(busId)) ? busId : null;
    const validSessionId = (sessionId && isUUID(sessionId)) ? sessionId : null;

    let localLogId = 'vl-' + Math.random().toString(36).substr(2, 9);
    const { data, error } = await supabaseAdmin.from('vehicle_logs').insert({
      school_id: schoolId,
      academic_session_id: validSessionId,
      bus_id: validBusId,
      log_type: logType,
      description,
      amount
    }).select().single();

    if (error) {
      const localLog = {
        id: localLogId,
        schoolId,
        busId,
        logType: logType as any,
        description,
        amount,
        createdAt: new Date().toISOString()
      };
      mockDb.vehicleLogs.push(localLog);
      mockDb.saveAll();
    } else if (data) {
      localLogId = data.id;
      const mapped = {
        id: data.id,
        schoolId: data.school_id,
        academicSessionId: data.academic_session_id,
        busId: data.bus_id,
        logType: data.log_type,
        description: data.description,
        amount: Number(data.amount || 0),
        createdAt: data.created_at
      };
      mockDb.vehicleLogs.push(mapped);
      mockDb.saveAll();
    }
    await this.logTransportAuditAction(schoolId, 'CREATE_VEHICLE_LOG', localLogId, undefined, { busId, logType, description, amount });
  },

  async deleteVehicleLog(id: string): Promise<void> {
    const log = mockDb.vehicleLogs.find(vl => vl.id === id);
    if (log) {
      await this.validateTransportAction(log.schoolId, 'delete', id, log);
    }
    await supabaseAdmin.from('vehicle_logs').delete().eq('id', id);
    const idx = mockDb.vehicleLogs.findIndex(vl => vl.id === id);
    if (idx !== -1) {
      mockDb.vehicleLogs.splice(idx, 1);
      mockDb.saveAll();
    }
    if (log) {
      await this.logTransportAuditAction(log.schoolId, 'DELETE_VEHICLE_LOG', id, log);
    }
  },

  // --- Dedicated Buses & Transport CRUD ---
  async fetchBuses(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('buses')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.buses.filter(b => b.schoolId === schoolId);
    
    const mapped = data.map(b => ({
      id: b.id,
      schoolId: b.school_id || schoolId,
      numberPlate: b.number_plate || b.plate_number || b.numberPlate || '',
      capacity: Number(b.capacity || 0),
      status: b.status || 'ACTIVE',
      driverId: b.driver_id || b.driverId || null,
      driverName: b.driver_name || null,
      driverPhone: b.driver_phone || null,
      createdAt: b.created_at
    }));
    
    const otherSchools = mockDb.buses.filter(b => b.schoolId !== schoolId);
    mockDb.buses = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createBus(schoolId: string, numberPlate: string, capacity: number, status: string, driverId: string | null): Promise<void> {
    await this.validateTransportAction(schoolId, 'create', undefined, undefined, { numberPlate, capacity, status, driverId });
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validDriverId = (driverId && isUUID(driverId)) ? driverId : null;

    let localBusId = 'bus-' + Math.random().toString(36).substr(2, 9);
    const { data, error } = await supabaseAdmin.from('buses').insert({
      school_id: schoolId,
      number_plate: numberPlate,
      plate_number: numberPlate,
      capacity,
      status,
      driver_id: validDriverId
    }).select().single();

    if (error) {
      // Resilient fallback: Try using only the default columns that exist in the legacy DB schema
      let driverName = 'Assigned Driver';
      let driverPhone = '';
      if (driverId) {
        const drivers = mockDb.drivers.filter(d => d.schoolId === schoolId);
        const driver = drivers.find(d => d.id === driverId);
        if (driver) {
          driverName = driver.name;
          driverPhone = driver.phone;
        }
      }
      const { data: fallbackData } = await supabaseAdmin.from('buses').insert({
        school_id: schoolId,
        plate_number: numberPlate,
        driver_name: driverName,
        driver_phone: driverPhone,
        capacity
      }).select().single();

      if (fallbackData) localBusId = fallbackData.id;
      const busObject = {
        id: localBusId,
        schoolId,
        numberPlate,
        capacity,
        status: status as any,
        driverId,
        createdAt: new Date().toISOString()
      };
      mockDb.buses.push(busObject);
      mockDb.saveAll();
    } else if (data) {
      localBusId = data.id;
      const busObject = {
        id: data.id,
        schoolId,
        numberPlate: data.number_plate || data.plate_number || '',
        capacity: Number(data.capacity || 0),
        status: data.status || 'ACTIVE',
        driverId: data.driver_id || null,
        createdAt: data.created_at
      };
      mockDb.buses.push(busObject);
      mockDb.saveAll();
    }
    await this.logTransportAuditAction(schoolId, 'CREATE_BUS', localBusId, undefined, { numberPlate, capacity, status, driverId });
  },

  async deleteBus(id: string): Promise<void> {
    const bus = mockDb.buses.find(b => b.id === id);
    if (bus) {
      await this.validateTransportAction(bus.schoolId, 'delete', id, bus);
      await this.validateSubscriptionFeature(bus.schoolId, 'School Transit', ['enterprise']);
    }
    await supabaseAdmin.from('buses').delete().eq('id', id);
    const idx = mockDb.buses.findIndex(b => b.id === id);
    if (idx !== -1) {
      mockDb.buses.splice(idx, 1);
      mockDb.saveAll();
    }
    if (bus) {
      await this.logTransportAuditAction(bus.schoolId, 'DELETE_BUS', id, bus);
    }
  },

  async fetchRoutes(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('routes')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.routes.filter(r => r.schoolId === schoolId);
    
    const mapped = data.map(r => {
      const parts = (r.name || '').split('::');
      const name = parts[0] || r.name;
      const routeCode = parts[1] || r.route_code || r.routeCode || 'R-101';
      return {
        id: r.id,
        schoolId: r.school_id || schoolId,
        name,
        routeCode,
        startPoint: r.start_point || r.startPoint || '',
        endPoint: r.end_point || r.endPoint || '',
        fare: Number(r.fare || 0),
        createdAt: r.created_at
      };
    });

    const otherSchools = mockDb.routes.filter(r => r.schoolId !== schoolId);
    mockDb.routes = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createRoute(schoolId: string, name: string, routeCode: string, startPoint: string, endPoint: string, fare: number): Promise<void> {
    await this.validateTransportAction(schoolId, 'create', undefined, undefined, { name, routeCode, startPoint, endPoint, fare });
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    let localRouteId = 'rt-' + Math.random().toString(36).substr(2, 9);
    const { data, error } = await supabaseAdmin.from('routes').insert({
      school_id: schoolId,
      name: `${name}::${routeCode}`,
      route_code: routeCode,
      start_point: startPoint,
      end_point: endPoint,
      fare
    }).select().single();

    if (error) {
      // Resilient fallback: Retry inserting with name = name::routeCode to avoid missing route_code column error
      const { data: fallbackData, error: retryErr } = await supabaseAdmin.from('routes').insert({
        school_id: schoolId,
        name: `${name}::${routeCode}`,
        start_point: startPoint,
        end_point: endPoint,
        fare
      }).select().single();
      
      if (fallbackData) localRouteId = fallbackData.id;
      const routeObj = {
        id: localRouteId,
        schoolId,
        name,
        routeCode,
        startPoint,
        endPoint,
        fare,
        createdAt: new Date().toISOString()
      };
      mockDb.routes.push(routeObj);
      mockDb.saveAll();
    } else if (data) {
      localRouteId = data.id;
      const parts = (data.name || '').split('::');
      const routeObj = {
        id: data.id,
        schoolId: data.school_id,
        name: parts[0] || data.name,
        routeCode: parts[1] || data.route_code || 'R-101',
        startPoint: data.start_point || '',
        endPoint: data.end_point || '',
        fare: Number(data.fare || 0),
        createdAt: data.created_at
      };
      mockDb.routes.push(routeObj);
      mockDb.saveAll();
    }
    await this.logTransportAuditAction(schoolId, 'CREATE_ROUTE', localRouteId, undefined, { name, routeCode, startPoint, endPoint, fare });
  },

  async deleteRoute(id: string): Promise<void> {
    const route = mockDb.routes.find(r => r.id === id);
    if (route) {
      await this.validateTransportAction(route.schoolId, 'delete', id, route);
      await this.validateSubscriptionFeature(route.schoolId, 'School Transit', ['enterprise']);
    }
    await supabaseAdmin.from('routes').delete().eq('id', id);
    const idx = mockDb.routes.findIndex(r => r.id === id);
    if (idx !== -1) {
      mockDb.routes.splice(idx, 1);
      mockDb.saveAll();
    }
    if (route) {
      await this.logTransportAuditAction(route.schoolId, 'DELETE_ROUTE', id, route);
    }
  },

  async fetchTransportAssignments(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('transport_assignments')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.transportAssignments.filter(ta => ta.schoolId === schoolId);
    
    // transport_assignments.student_id is a FK to users(id), but portals compare against students.id.
    // Resolve each user_id back to the corresponding students.id for correct portal matching.
    const mapped = data.map(ta => {
      const dbUserId = ta.student_id || ta.studentId;
      // Find the student record whose userId or id matches the DB's student_id (which is actually a user_id)
      const studentRecord = mockDb.students.find(s => s.userId === dbUserId || s.id === dbUserId);
      return {
        id: ta.id,
        schoolId: ta.school_id || schoolId,
        studentId: studentRecord ? studentRecord.id : dbUserId,
        routeId: ta.route_id || ta.routeId,
        busId: ta.bus_id || ta.busId,
        pickupPointId: ta.pickup_point_id || ta.pickupPointId || '',
        status: ta.status || 'ACTIVE',
        createdAt: ta.created_at
      };
    });

    const otherSchools = mockDb.transportAssignments.filter(ta => ta.schoolId !== schoolId);
    mockDb.transportAssignments = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createTransportAssignment(schoolId: string, studentId: string, routeId: string, busId: string, pickupPointId: string): Promise<void> {
    await this.validateTransportAction(schoolId, 'assign', undefined, undefined, { studentId, routeId, busId, pickupPointId });
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validPickupPointId = (pickupPointId && isUUID(pickupPointId)) ? pickupPointId : null;

    // Resolve the student's user_id — transport_assignments.student_id references users(id), NOT students(id)
    const studentRecord = mockDb.students.find(s => s.id === studentId);
    const userIdForTransport = studentRecord?.userId || studentId;

    // Prevent duplicate active assignments for the same student
    const existingActive = mockDb.transportAssignments.find(
      ta => ta.studentId === studentId && ta.status === 'ACTIVE'
    );
    if (existingActive) {
      throw new Error('This student already has an active transport assignment. Please edit or remove the existing one first.');
    }

    let fare = 0;
    const route = mockDb.routes.find(r => r.id === routeId);
    if (route) {
      fare = Number(route.fare || 0);
    } else {
      const { data: routeData } = await supabaseAdmin.from('routes').select('fare').eq('id', routeId).single();
      if (routeData) fare = Number(routeData.fare || 0);
    }

    const sessionId = await this.resolveActiveSessionId(schoolId);

    const localId = 'ta-' + Math.random().toString(36).substr(2, 9);
    let finalId = localId;
    const assignmentObj = {
      id: localId,
      schoolId,
      studentId,
      routeId,
      busId,
      pickupPointId,
      status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE',
      createdAt: new Date().toISOString()
    };
    mockDb.transportAssignments.push(assignmentObj);
    mockDb.saveAll();

    // Insert with user_id (not students.id) since transport_assignments.student_id FK -> users(id)
    const { data, error } = await supabaseAdmin.from('transport_assignments').insert({
      school_id: schoolId,
      student_id: userIdForTransport,
      route_id: routeId,
      bus_id: busId,
      pickup_point_id: validPickupPointId,
      status: 'ACTIVE'
    }).select().single();

    if (error) {
      const { data: retryData } = await supabaseAdmin.from('transport_assignments').insert({
        school_id: schoolId,
        student_id: userIdForTransport,
        route_id: routeId,
        bus_id: busId
      }).select().single();
      
      if (retryData) {
        finalId = retryData.id;
        const idx = mockDb.transportAssignments.findIndex(t => t.id === localId);
        if (idx !== -1) {
          mockDb.transportAssignments[idx].id = retryData.id;
          mockDb.saveAll();
        }
        // transport_fee_records.student_id FK -> students(id), so use the original studentId
        await supabaseAdmin.from('transport_fee_records').insert({
          school_id: schoolId,
          academic_session_id: sessionId,
          student_id: studentId,
          route_id: routeId,
          amount: fare,
          status: 'UNPAID'
        });
      }
    } else if (data) {
      finalId = data.id;
      const idx = mockDb.transportAssignments.findIndex(t => t.id === localId);
      if (idx !== -1) {
        mockDb.transportAssignments[idx].id = data.id;
        mockDb.saveAll();
      }
      // transport_fee_records.student_id FK -> students(id), so use the original studentId
      await supabaseAdmin.from('transport_fee_records').insert({
        school_id: schoolId,
        academic_session_id: sessionId,
        student_id: studentId,
        route_id: routeId,
        amount: fare,
        status: 'UNPAID'
      });
    }
    await this.logTransportAuditAction(schoolId, 'CREATE_TRANSPORT_ASSIGNMENT', finalId, undefined, { studentId, routeId, busId, pickupPointId });
  },

  async deleteTransportAssignment(id: string): Promise<void> {
    const ta = mockDb.transportAssignments.find(t => t.id === id);
    if (ta) {
      await this.validateTransportAction(ta.schoolId, 'delete', id, ta);
      await this.validateSubscriptionFeature(ta.schoolId, 'School Transit', ['enterprise']);
    }
    await supabaseAdmin.from('transport_assignments').delete().eq('id', id);
    const idx = mockDb.transportAssignments.findIndex(ta => ta.id === id);
    if (idx !== -1) {
      mockDb.transportAssignments.splice(idx, 1);
      mockDb.saveAll();
    }
    if (ta) {
      await this.logTransportAuditAction(ta.schoolId, 'DELETE_TRANSPORT_ASSIGNMENT', id, ta);
    }
  },

  async fetchMaintenanceLogs(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('maintenance_logs')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.maintenanceLogs.filter(ml => ml.schoolId === schoolId);
    return data;
  },

  async createMaintenanceLog(schoolId: string, busId: string, logDate: string, description: string, cost: number): Promise<void> {
    await this.validateTransportAction(schoolId, 'create', undefined, undefined, { busId, logDate, description, cost });
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { error } = await supabaseAdmin.from('maintenance_logs').insert({
      school_id: schoolId,
      bus_id: busId,
      log_date: logDate,
      description,
      cost
    });
    if (error) {
      mockDb.maintenanceLogs.push({
        id: 'ml-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        busId,
        logDate,
        description,
        cost,
        createdAt: new Date().toISOString()
      });
      mockDb.saveAll();
    }
    await this.logTransportAuditAction(schoolId, 'CREATE_MAINTENANCE_LOG', undefined, undefined, { busId, logDate, description, cost });
  },

  async fetchDriverSalaryPayouts(schoolId: string): Promise<DriverSalaryPayout[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('driver_salary_payouts')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) {
      // Offline fallback: backfill missing snapshots from in-memory driver registry
      const localPayouts = mockDb.driverSalaryPayouts.filter(p => p.schoolId === schoolId);
      localPayouts.forEach(p => {
        if (!p.driverName) {
          const driver = mockDb.drivers.find(d => d.id === p.driverId);
          if (driver) {
            p.driverName = driver.name || null;
            p.driverEmployeeId = driver.employeeId || null;
            p.driverLicenseNumber = driver.licenseNumber || null;
            p.driverPhone = driver.phone || null;
          }
        }
      });
      mockDb.saveAll();
      return localPayouts;
    }

    const mapped = data.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      driverId: r.driver_id,
      attendanceRecordId: r.attendance_record_id,
      payoutAmount: Number(r.payout_amount) || 0,
      payoutStatus: r.payout_status as any,
      payoutDate: r.payout_date || '',
      paidByUserId: r.paid_by_user_id,
      transactionReference: r.transaction_reference,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      currencyCode: r.currency_code || 'USD',
      currencySymbol: r.currency_symbol || '$',
      driverName: r.driver_name,
      driverEmployeeId: r.driver_employee_id,
      driverLicenseNumber: r.driver_license_number,
      driverPhone: r.driver_phone
    }));

    // --- DRIVER IDENTITY BACKFILL ---
    // For any payout that has no driverName snapshot (legacy records before snapshotting was added),
    // resolve from local driver registry and push the snapshot back to Supabase so the identity
    // is permanently preserved and will never display as "Unknown Driver" again.
    const backfillPromises: Promise<any>[] = [];
    mapped.forEach(dp => {
      if (!dp.driverName) {
        const driver = mockDb.drivers.find(d => d.id === dp.driverId);
        if (driver) {
          dp.driverName = driver.name || null;
          dp.driverEmployeeId = driver.employeeId || null;
          dp.driverLicenseNumber = driver.licenseNumber || null;
          dp.driverPhone = driver.phone || null;
          // Push backfill to Supabase asynchronously (fire-and-forget, non-blocking)
          const updateQuery = supabaseAdmin.from('driver_salary_payouts').update({
            driver_name: dp.driverName,
            driver_employee_id: dp.driverEmployeeId,
            driver_license_number: dp.driverLicenseNumber,
            driver_phone: dp.driverPhone,
            updated_at: new Date().toISOString()
          }).eq('id', dp.id);
          backfillPromises.push(Promise.resolve(updateQuery).then(() => {}).catch(() => {}));
        }
      }
    });
    // Fire all backfill updates in parallel (non-blocking — don't await to avoid slowing load)
    if (backfillPromises.length > 0) {
      Promise.all(backfillPromises).catch(() => {});
    }

    // Cache locally
    mapped.forEach(dp => {
      const idx = mockDb.driverSalaryPayouts.findIndex(p => p.id === dp.id);
      if (idx === -1) mockDb.driverSalaryPayouts.push(dp);
      else mockDb.driverSalaryPayouts[idx] = dp;
    });
    mockDb.saveAll();

    return mapped;
  },

  async adminDisburseDriverSalary(
    adminId: string,
    schoolId: string,
    driverId: string,
    amount: number,
    attendanceRecordId?: string | null,
    paidByUserId?: string | null,
    notes?: string | null
  ): Promise<DriverSalaryPayout> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    await delay(600);
    // RBAC Validation
    const operator = mockDb.users.find(o => o.id === adminId);

    // Validate role against database user record dynamically rather than hardcoded UI values
    const { data: dbUser, error: dbErr } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    const currentRole = dbErr || !dbUser ? operator?.role : dbUser.role;
    const normalizedRole = normalizeRole(currentRole || '');
    if (normalizedRole !== 'FINANCE_ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      throw new Error('Only Finance Admin is authorized to perform salary disbursement.');
    }

    // Duplicate Prevention Check
    const existingPayouts = mockDb.driverSalaryPayouts.filter(p => p.schoolId === schoolId);
    if (attendanceRecordId) {
      const isAlreadyPaid = existingPayouts.some(p => p.attendanceRecordId === attendanceRecordId && p.driverId === driverId);
      if (isAlreadyPaid) {
        throw new Error('Transaction Policy Mismatch: Payout has already been disbursed for this specific attendance record.');
      }
    }

    const txRef = 'TXP' + Math.random().toString(36).substr(2, 8).toUpperCase();
    const school = mockDb.schools.find(s => s.id === schoolId);
    const currencyCode = school?.currencyCode || 'USD';
    const currencySymbol = school?.currencySymbol || '$';

    // Fetch driver info for snapshotting
    const driver = mockDb.drivers.find(d => d.id === driverId);
    const { data: dbDriver } = await supabaseAdmin
      .from('drivers')
      .select('*')
      .eq('id', driverId)
      .maybeSingle();

    const resolvedName = dbDriver?.name || driver?.name || '';
    const resolvedEmpId = dbDriver?.employee_id || driver?.employeeId || '';
    const resolvedLicense = dbDriver?.license_number || driver?.licenseNumber || '';
    const resolvedPhone = dbDriver?.phone || driver?.phone || '';

    // 1. Insert in Supabase
    const { data: dbPayout, error } = await supabaseAdmin.from('driver_salary_payouts').insert({
      school_id: schoolId,
      driver_id: driverId,
      attendance_record_id: attendanceRecordId || null,
      payout_amount: amount,
      payout_status: 'PAID',
      payout_date: new Date().toISOString(),
      paid_by_user_id: paidByUserId || adminId,
      transaction_reference: txRef,
      notes: notes || 'Daily salary disburse',
      currency_code: currencyCode,
      currency_symbol: currencySymbol,
      driver_name: resolvedName,
      driver_employee_id: resolvedEmpId,
      driver_license_number: resolvedLicense,
      driver_phone: resolvedPhone
    }).select('*').single();

    if (error || !dbPayout) {
      // Fallback to local memory if Supabase offline/error
      const localPayout: DriverSalaryPayout = {
        id: 'dp-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        driverId,
        attendanceRecordId: attendanceRecordId || null,
        payoutAmount: amount,
        payoutStatus: 'PAID',
        payoutDate: new Date().toISOString(),
        paidByUserId: paidByUserId || adminId,
        transactionReference: txRef,
        notes: notes || 'Daily salary disburse',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currencyCode,
        currencySymbol,
        driverName: resolvedName,
        driverEmployeeId: resolvedEmpId,
        driverLicenseNumber: resolvedLicense,
        driverPhone: resolvedPhone
      };
      mockDb.driverSalaryPayouts.push(localPayout);
      mockDb.saveAll();
      return localPayout;
    }

    const newPayout: DriverSalaryPayout = {
      id: dbPayout.id,
      schoolId: dbPayout.school_id,
      driverId: dbPayout.driver_id,
      attendanceRecordId: dbPayout.attendance_record_id,
      payoutAmount: Number(dbPayout.payout_amount) || 0,
      payoutStatus: dbPayout.payout_status as any,
      payoutDate: dbPayout.payout_date,
      paidByUserId: dbPayout.paid_by_user_id,
      transactionReference: dbPayout.transaction_reference,
      notes: dbPayout.notes,
      createdAt: dbPayout.created_at,
      updatedAt: dbPayout.updated_at,
      currencyCode: dbPayout.currency_code || currencyCode,
      currencySymbol: dbPayout.currency_symbol || currencySymbol,
      driverName: dbPayout.driver_name,
      driverEmployeeId: dbPayout.driver_employee_id,
      driverLicenseNumber: dbPayout.driver_license_number,
      driverPhone: dbPayout.driver_phone
    };

    mockDb.driverSalaryPayouts.push(newPayout);
    mockDb.saveAll();
    return newPayout;
  },

  async fetchDriverAttendance(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { data, error } = await supabaseAdmin
      .from('driver_attendance')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.driverAttendance.filter(da => da.schoolId === schoolId);
    
    const mapped = data.map(da => ({
      id: da.id,
      schoolId: da.school_id || schoolId,
      driverId: da.driver_id || da.driverId,
      date: da.date,
      status: da.status,
      createdAt: da.created_at
    }));

    mapped.forEach(da => {
      const idx = mockDb.driverAttendance.findIndex(mda => mda.id === da.id);
      if (idx === -1) mockDb.driverAttendance.push(da);
      else mockDb.driverAttendance[idx] = da;
    });
    mockDb.driverAttendance = mockDb.driverAttendance.filter(mda => mda.schoolId !== schoolId || mapped.some(m => m.id === mda.id));
    mockDb.saveAll();

    return mapped;
  },

  async markDriverAttendance(schoolId: string, driverId: string, date: string, status: string): Promise<void> {
    await this.validateTransportAction(schoolId, 'update', undefined, undefined, { driverId, date, status });
    await this.validateSubscriptionFeature(schoolId, 'School Transit', ['enterprise']);
    const { error } = await supabaseAdmin.from('driver_attendance').upsert({
      school_id: schoolId,
      driver_id: driverId,
      date,
      status
    }, { onConflict: 'driver_id,date' });
    
    // Always sync locally
    const idx = mockDb.driverAttendance.findIndex(da => da.driverId === driverId && da.date === date);
    if (idx === -1) {
      mockDb.driverAttendance.push({
        id: 'da-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        driverId,
        date,
        status: status as any,
        createdAt: new Date().toISOString()
      });
    } else {
      mockDb.driverAttendance[idx].status = status as any;
    }
    mockDb.saveAll();
    await this.logTransportAuditAction(schoolId, 'MARK_DRIVER_ATTENDANCE', undefined, undefined, { driverId, date, status });
  },

  // --- Admin Book CRUD ---
  async adminCreateBook(title: string, author: string, isbn: string, subject: string, totalCopies: number): Promise<void> {
    const schoolId = await getAdminSchoolId();
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    
    const { data, error } = await supabaseAdmin.from('book_inventory').insert({
      school_id: schoolId,
      title,
      author,
      isbn,
      subject,
      total_copies: totalCopies,
      available_copies: totalCopies,
      barcode: 'BAR-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase()
    }).select().single();

    if (!error && data) {
      const bookObj = {
        id: data.id,
        schoolId: data.school_id,
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        subject: data.subject,
        totalCopies: data.total_copies,
        availableCopies: data.available_copies,
        createdAt: data.created_at
      };
      mockDb.books.push(bookObj);
      mockDb.saveAll();
    } else {
      const fallbackBook = {
        id: 'bk-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        title,
        author,
        isbn,
        subject,
        totalCopies,
        availableCopies: totalCopies,
        createdAt: new Date().toISOString()
      };
      mockDb.books.push(fallbackBook);
      mockDb.saveAll();
    }
  },

  // --- Dedicated Library CRUD ---
  async fetchBookCategories(schoolId: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    const { data, error } = await supabaseAdmin
      .from('book_categories')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.bookCategories.filter(bc => bc.schoolId === schoolId);
    
    const mapped = data.map(bc => ({
      id: bc.id,
      schoolId: bc.school_id,
      name: bc.name,
      code: bc.code,
      description: bc.description || '',
      createdAt: bc.created_at
    }));

    const otherSchools = mockDb.bookCategories.filter(bc => bc.schoolId !== schoolId);
    mockDb.bookCategories = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createBookCategory(schoolId: string, name: string, code: string, description?: string): Promise<void> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    
    // Do not pass invalid custom id prefix (book_categories.id is UUID)
    const { data, error } = await supabaseAdmin.from('book_categories').insert({
      school_id: schoolId,
      name,
      code,
      description: description || ''
    }).select().single();

    if (error || !data) {
      const fallbackId = 'bc-' + Math.random().toString(36).substr(2, 9);
      const fallbackCategory = {
        id: fallbackId,
        schoolId,
        name,
        code,
        description: description || '',
        createdAt: new Date().toISOString()
      };
      mockDb.bookCategories.push(fallbackCategory);
      mockDb.saveAll();
    } else {
      const newCategory = {
        id: data.id,
        schoolId: data.school_id,
        name: data.name,
        code: data.code,
        description: data.description || '',
        createdAt: data.created_at
      };
      mockDb.bookCategories.push(newCategory);
      mockDb.saveAll();
    }
  },

  async deleteBookCategory(id: string): Promise<void> {
    const bc = mockDb.bookCategories.find(c => c.id === id);
    if (bc) {
      await this.validateSubscriptionFeature(bc.schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    }
    await supabaseAdmin.from('book_categories').delete().eq('id', id);
    const idx = mockDb.bookCategories.findIndex(bc => bc.id === id);
    if (idx !== -1) {
      mockDb.bookCategories.splice(idx, 1);
      mockDb.saveAll();
    }
  },

  async fetchBookIssues(schoolId: string, studentId?: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    let query = supabaseAdmin
      .from('book_issues')
      .select('*, book:book_inventory(*), student:students(*, userDetails:users(*))')
      .eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) {
      const local = mockDb.bookIssues.filter(bi => bi.schoolId === schoolId);
      if (studentId) return local.filter(bi => bi.studentId === studentId);
      return local;
    }
    const mapped = data.map(bi => ({
      id: bi.id,
      schoolId: bi.school_id,
      bookId: bi.book_id,
      studentId: bi.student_id,
      issueDate: bi.issue_date,
      dueDate: bi.due_date,
      returnDate: bi.return_date,
      fineAmount: bi.fine_amount ? Number(bi.fine_amount) : 0,
      status: bi.status,
      createdAt: bi.created_at,
      book: bi.book ? {
        id: bi.book.id,
        schoolId: bi.book.school_id,
        title: bi.book.title,
        author: bi.book.author,
        isbn: bi.book.isbn,
        subject: bi.book.subject,
        totalCopies: bi.book.total_copies,
        availableCopies: bi.book.available_copies
      } : null,
      student: bi.student
    }));

    const otherSchools = mockDb.bookIssues.filter(bi => bi.schoolId !== schoolId);
    mockDb.bookIssues = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async issueBook(schoolId: string, bookId: string, studentId: string, issueDate: string, dueDate: string): Promise<void> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    // Check availability - local mockDb check
    const book = mockDb.books.find(b => b.id === bookId && b.schoolId === schoolId);
    if (book && book.availableCopies <= 0) {
      throw new Error('No copies available for this book. All copies are currently issued.');
    }
    // Prevent duplicate active issue for same student+book
    const existingIssue = mockDb.bookIssues.find(
      bi => bi.bookId === bookId && bi.studentId === studentId && bi.status === 'ISSUED'
    );
    if (existingIssue) {
      throw new Error('This student already has an active issue for this book.');
    }

    // Resolve student's user_id for the book_issues.user_id constraint
    const studentRecord = mockDb.students.find(s => s.id === studentId);
    let userIdForIssue = studentRecord?.userId;
    if (!userIdForIssue) {
      const { data: dbSt } = await supabaseAdmin
        .from('students')
        .select('user_id')
        .eq('id', studentId)
        .single();
      if (dbSt) {
        userIdForIssue = dbSt.user_id;
      }
    }
    if (!userIdForIssue) {
      userIdForIssue = studentId;
    }

    // Resolve logged-in operator for issued_by field
    let issuedBy = '';
    const sessionRaw = localStorage.getItem('aegis_session');
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        issuedBy = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email || '';
      } catch (e) {}
    }

    const { error } = await supabaseAdmin.from('book_issues').insert({
      school_id: schoolId,
      book_id: bookId,
      student_id: studentId,
      user_id: userIdForIssue,
      issue_date: issueDate,
      due_date: dueDate,
      status: 'ISSUED',
      issued_by: issuedBy
    });
    // Decrement available copies in Supabase
    if (!error) {
      try {
        await supabaseAdmin.rpc('decrement_available_copies', { p_book_id: bookId });
      } catch (e) {}
    }
    // Always update local mockDb
    const newIssue = {
      id: 'bi-' + Math.random().toString(36).substr(2, 9),
      schoolId,
      bookId,
      studentId,
      issueDate,
      dueDate,
      returnDate: null,
      fineAmount: 0,
      status: 'ISSUED' as const,
      createdAt: new Date().toISOString()
    };
    mockDb.bookIssues.push(newIssue);
    // Decrement local available copies
    if (book) {
      book.availableCopies = Math.max(0, book.availableCopies - 1);
    }
    mockDb.saveAll();
  },

  async returnBook(schoolId: string, issueId: string, returnDate: string, fineAmount: number, status: string): Promise<void> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    // Find the issue record
    const issue = mockDb.bookIssues.find(bi => bi.id === issueId);
    if (!issue) throw new Error('Book issue record not found.');
    // Auto-calculate fine if overdue
    let calculatedFine = fineAmount;
    if (fineAmount === 0 && issue.dueDate) {
      const dueMs = new Date(issue.dueDate).getTime();
      const returnMs = new Date(returnDate).getTime();
      if (returnMs > dueMs) {
        const overdueDays = Math.ceil((returnMs - dueMs) / (24 * 3600 * 1000));
        calculatedFine = overdueDays * 0.50; // $0.50 per day overdue
      }
    }
    // Add penalty for DAMAGED or LOST
    if (status === 'DAMAGED') calculatedFine += 5.00;
    if (status === 'LOST') calculatedFine += 25.00;

    // Resolve logged-in operator for returned_to field
    let returnedTo = '';
    const sessionRaw = localStorage.getItem('aegis_session');
    if (sessionRaw) {
      try {
        const session = JSON.parse(sessionRaw);
        returnedTo = `${session.user.firstName || ''} ${session.user.lastName || ''}`.trim() || session.user.email || '';
      } catch (e) {}
    }

    // Insert return record in Supabase
    const { error } = await supabaseAdmin.from('book_returns').insert({
      school_id: schoolId,
      issue_id: issueId,
      return_date: returnDate,
      fine_amount: calculatedFine,
      status,
      returned_to: returnedTo
    });
    // Update issue record in Supabase
    await supabaseAdmin.from('book_issues').update({
      status: 'RETURNED',
      return_date: returnDate,
      fine_amount: calculatedFine
    }).eq('id', issueId);
    // Increment available copies in Supabase (only for RETURNED, not LOST)
    if (status !== 'LOST') {
      try {
        await supabaseAdmin.rpc('increment_available_copies', { p_book_id: issue.bookId });
      } catch (e) {}
    }

    // Always update local mockDb
    const idx = mockDb.bookIssues.findIndex(bi => bi.id === issueId);
    if (idx !== -1) {
      mockDb.bookIssues[idx].status = 'RETURNED';
      mockDb.bookIssues[idx].returnDate = returnDate;
      mockDb.bookIssues[idx].fineAmount = calculatedFine;
    }
    // Restore local inventory (except LOST)
    if (status !== 'LOST') {
      const book = mockDb.books.find(b => b.id === issue.bookId);
      if (book) {
        book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      }
    }
    // Create return record in local mockDb
    mockDb.bookReturns.push({
      id: 'br-' + Math.random().toString(36).substr(2, 9),
      schoolId,
      issueId,
      returnDate,
      fineAmount: calculatedFine,
      status: status as any,
      createdAt: new Date().toISOString()
    });
    // Auto-create fine record if there's a fine
    if (calculatedFine > 0) {
      const fineId = 'lf-' + Math.random().toString(36).substr(2, 9);
      const fineRecord = {
        id: fineId,
        schoolId,
        issueId,
        studentId: issue.studentId,
        amount: calculatedFine,
        isPaid: false,
        reason: status === 'LOST' ? 'Book Lost' : status === 'DAMAGED' ? 'Book Damaged' : 'Overdue Return',
        status: 'UNPAID' as const,
        createdAt: new Date().toISOString()
      };
      mockDb.libraryFines.push(fineRecord);

      // Resolve student's user_id for the library_fines.user_id NOT NULL constraint
      const studentRecord = mockDb.students.find(s => s.id === issue.studentId);
      const userIdForFine = studentRecord?.userId || issue.studentId;

      // Also insert into Supabase
      try {
        await supabaseAdmin.from('library_fines').insert({
          id: fineId,
          school_id: schoolId,
          issue_id: issueId,
          student_id: issue.studentId,
          user_id: userIdForFine,
          amount: calculatedFine,
          is_paid: false,
          reason: fineRecord.reason,
          status: 'UNPAID'
        });
      } catch (e) {}
    }
    mockDb.saveAll();
  },

  async fetchLibraryFines(schoolId: string, studentId?: string): Promise<any[]> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    let query = supabaseAdmin
      .from('library_fines')
      .select('*, issue:book_issues(*, book:book_inventory(*)), student:students(*, userDetails:users(*))')
      .eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) {
      const local = mockDb.libraryFines.filter(lf => lf.schoolId === schoolId);
      if (studentId) return local.filter(lf => lf.studentId === studentId);
      return local;
    }
    return data.map(lf => ({
      id: lf.id,
      schoolId: lf.school_id,
      issueId: lf.issue_id,
      studentId: lf.student_id,
      amount: Number(lf.amount),
      isPaid: lf.is_paid,
      reason: lf.reason,
      status: lf.status,
      createdAt: lf.created_at,
      issue: lf.issue ? {
        id: lf.issue.id,
        schoolId: lf.issue.school_id,
        bookId: lf.issue.book_id,
        studentId: lf.issue.student_id,
        issueDate: lf.issue.issue_date,
        dueDate: lf.issue.due_date,
        returnDate: lf.issue.return_date,
        fineAmount: lf.issue.fine_amount ? Number(lf.issue.fine_amount) : 0,
        status: lf.issue.status,
        book: lf.issue.book ? {
          id: lf.issue.book.id,
          schoolId: lf.issue.book.school_id,
          title: lf.issue.book.title,
          author: lf.issue.book.author,
          isbn: lf.issue.book.isbn,
          subject: lf.issue.book.subject,
          totalCopies: lf.issue.book.total_copies,
          availableCopies: lf.issue.book.available_copies
        } : null
      } : null,
      student: lf.student
    }));
  },

  async payLibraryFine(schoolId: string, fineId: string): Promise<void> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    const { error } = await supabaseAdmin.from('library_fines').update({ is_paid: true, status: 'PAID' }).eq('id', fineId);
    // Always update local mockDb
    const idx = mockDb.libraryFines.findIndex(lf => lf.id === fineId);
    if (idx !== -1) {
      mockDb.libraryFines[idx].isPaid = true;
      (mockDb.libraryFines[idx] as any).status = 'PAID';
      mockDb.saveAll();
    }
  },

  async waiveLibraryFine(schoolId: string, fineId: string): Promise<void> {
    await this.validateSubscriptionFeature(schoolId, 'Library Books', ['basic', 'pro', 'enterprise']);
    await supabaseAdmin.from('library_fines').update({ is_paid: true, status: 'WAIVED' }).eq('id', fineId);
    const idx = mockDb.libraryFines.findIndex(lf => lf.id === fineId);
    if (idx !== -1) {
      mockDb.libraryFines[idx].isPaid = true;
      (mockDb.libraryFines[idx] as any).status = 'WAIVED';
      mockDb.saveAll();
    }
  },

  async createDigitalLibraryAsset(schoolId: string, title: string, author: string, fileUrl: string, fileType: string): Promise<void> {
    await this.validateSubscriptionFeature(schoolId, 'Digital Library Resources', ['basic', 'pro', 'enterprise']);
    
    // Do not pass invalid custom id prefix (digital_library_assets.id is UUID)
    const { data, error } = await supabaseAdmin.from('digital_library_assets').insert({
      school_id: schoolId,
      title,
      author,
      file_url: fileUrl,
      file_type: fileType
    }).select().single();

    if (error || !data) {
      const fallbackId = 'dla-' + Math.random().toString(36).substr(2, 9);
      const fallbackAsset = {
        id: fallbackId,
        schoolId,
        title,
        author,
        fileUrl,
        fileType,
        createdAt: new Date().toISOString()
      };
      mockDb.digitalLibraryAssets.push(fallbackAsset);
      mockDb.saveAll();
    } else {
      const newAsset = {
        id: data.id,
        schoolId: data.school_id,
        title: data.title,
        author: data.author || 'Anonymous',
        fileUrl: data.file_url,
        fileType: data.file_type || 'pdf',
        createdAt: data.created_at
      };
      mockDb.digitalLibraryAssets.push(newAsset);
      mockDb.saveAll();
    }
  },

  async fetchLibraryInvoices(schoolId: string, studentId?: string): Promise<any[]> {
    let query = supabaseAdmin.from('library_invoices').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) {
      const local = mockDb.libraryInvoices.filter(li => li.schoolId === schoolId);
      if (studentId) return local.filter(li => li.studentId === studentId);
      return local;
    }
    return data;
  },

  // --- Dedicated Exams CRUD ---
  async fetchExams(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('exams')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.exams.filter(e => e.schoolId === schoolId);
    
    const mapped = data.map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id || 'session-1',
      name: r.name,
      term: r.term || '',
      startDate: r.start_date,
      endDate: r.end_date
    }));

    const otherSchools = mockDb.exams.filter(e => e.schoolId !== schoolId);
    mockDb.exams = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createExam(schoolId: string, academicSessionId: string, name: string, term: string, startDate: string, endDate: string): Promise<void> {
    let finalSessionId = academicSessionId;
    if (!finalSessionId || finalSessionId === 'session-1' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(finalSessionId)) {
      finalSessionId = await this.resolveActiveSessionId(schoolId);
    }

    const { data, error } = await supabaseAdmin.from('exams').insert({
      school_id: schoolId,
      academic_session_id: finalSessionId,
      name,
      term,
      start_date: startDate,
      end_date: endDate
    }).select().single();

    let resolvedExam = data;
    if (error) {
      // Graceful fallback: Retry insert without 'term' column
      const { data: retryData, error: retryErr } = await supabaseAdmin.from('exams').insert({
        school_id: schoolId,
        academic_session_id: finalSessionId,
        name,
        start_date: startDate,
        end_date: endDate
      }).select().single();
      
      if (retryErr) {
        const localExam = {
          id: 'ex-' + Math.random().toString(36).substr(2, 9),
          schoolId,
          academicSessionId: finalSessionId,
          name,
          term,
          startDate,
          endDate
        };
        mockDb.exams.push(localExam);
        mockDb.saveAll();
        return;
      } else {
        resolvedExam = retryData;
      }
    }

    if (resolvedExam) {
      const ex: Exam = {
        id: resolvedExam.id,
        schoolId: resolvedExam.school_id,
        academicSessionId: resolvedExam.academic_session_id || finalSessionId,
        name: resolvedExam.name,
        term: resolvedExam.term || term,
        startDate: resolvedExam.start_date,
        endDate: resolvedExam.end_date
      };
      mockDb.exams.push(ex);
      mockDb.saveAll();
    }
  },

  async deleteExam(id: string): Promise<void> {
    await supabaseAdmin.from('exams').delete().eq('id', id);
    const idx = mockDb.exams.findIndex(e => e.id === id);
    if (idx !== -1) {
      mockDb.exams.splice(idx, 1);
      mockDb.saveAll();
    }
  },

  async fetchExamSubjects(schoolId: string, examId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('exam_subjects')
      .select('*, subject:subjects(*)')
      .eq('school_id', schoolId)
      .eq('exam_id', examId);
    if (error || !data) return mockDb.examSubjects.filter(es => es.schoolId === schoolId && es.examId === examId);
    
    const mapped = data.map(es => ({
      id: es.id,
      schoolId: es.school_id,
      examId: es.exam_id,
      subjectId: es.subject_id,
      maxMarks: Number(es.max_marks || 100),
      passingMarks: Number(es.passing_marks || 40),
      createdAt: es.created_at,
      subject: es.subject
    }));

    const others = mockDb.examSubjects.filter(es => es.schoolId !== schoolId || es.examId !== examId);
    mockDb.examSubjects = [...others, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async createExamSubject(schoolId: string, examId: string, subjectId: string, maxMarks: number, passingMarks: number): Promise<void> {
    const { data, error } = await supabaseAdmin.from('exam_subjects').insert({
      school_id: schoolId,
      exam_id: examId,
      subject_id: subjectId,
      max_marks: maxMarks,
      passing_marks: passingMarks
    }).select().single();

    if (error) {
      mockDb.examSubjects.push({
        id: 'es-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        examId,
        subjectId,
        maxMarks,
        passingMarks,
        createdAt: new Date().toISOString()
      });
      mockDb.saveAll();
    } else if (data) {
      mockDb.examSubjects.push({
        id: data.id,
        schoolId: data.school_id,
        examId: data.exam_id,
        subjectId: data.subject_id,
        maxMarks: Number(data.max_marks || 100),
        passingMarks: Number(data.passing_marks || 40),
        createdAt: data.created_at
      });
      mockDb.saveAll();
    }
  },

  async fetchStudentMarks(schoolId: string, examId: string, subjectId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('student_marks')
      .select('*, student:students(*, userDetails:users(*))')
      .eq('school_id', schoolId)
      .eq('exam_id', examId)
      .eq('subject_id', subjectId);
    if (error || !data) return mockDb.studentMarks.filter(sm => sm.schoolId === schoolId && sm.examId === examId && sm.subjectId === subjectId);
    
    const mapped = data.map(sm => ({
      id: sm.id,
      schoolId: sm.school_id,
      examId: sm.exam_id,
      subjectId: sm.subject_id,
      studentId: sm.student_id,
      marksObtained: Number(sm.marks_obtained || 0),
      remarks: sm.remarks || '',
      createdAt: sm.created_at,
      student: sm.student
    }));

    const others = mockDb.studentMarks.filter(sm => sm.schoolId !== schoolId || sm.examId !== examId || sm.subjectId !== subjectId);
    mockDb.studentMarks = [...others, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async enterStudentMarks(schoolId: string, examId: string, subjectId: string, studentId: string, marksObtained: number, remarks: string): Promise<void> {
    const { data, error } = await supabaseAdmin.from('student_marks').upsert({
      school_id: schoolId,
      exam_id: examId,
      subject_id: subjectId,
      student_id: studentId,
      marks_obtained: marksObtained,
      remarks
    }, { onConflict: 'exam_id,subject_id,student_id' }).select().single();

    const idx = mockDb.studentMarks.findIndex(sm => sm.examId === examId && sm.subjectId === subjectId && sm.studentId === studentId);
    const resolvedId = data ? data.id : (idx >= 0 ? mockDb.studentMarks[idx].id : ('sm-' + Math.random().toString(36).substr(2, 9)));

    const newMark = {
      id: resolvedId,
      schoolId,
      examId,
      subjectId,
      studentId,
      marksObtained,
      remarks,
      createdAt: data ? data.created_at : new Date().toISOString()
    };

    if (idx === -1) {
      mockDb.studentMarks.push(newMark);
    } else {
      mockDb.studentMarks[idx] = newMark;
    }
    mockDb.saveAll();

    if (error) {
      throw new Error('Failed to enter student marks: ' + error.message);
    }
  },

  async fetchExamResults(schoolId: string, examId?: string, studentId?: string): Promise<any[]> {
    let query = supabaseAdmin.from('exam_results').select('*, student:students(*, userDetails:users(*)), exam:exams(*)').eq('school_id', schoolId);
    if (examId) query = query.eq('exam_id', examId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) {
      let local = mockDb.examResults.filter(er => er.schoolId === schoolId);
      if (examId) local = local.filter(er => er.examId === examId);
      if (studentId) local = local.filter(er => er.studentId === studentId);
      return local;
    }

    const mapped = data.map(er => ({
      id: er.id,
      schoolId: er.school_id,
      studentId: er.student_id,
      examId: er.exam_id,
      totalMarks: Number(er.total_marks || 0),
      marksObtained: Number(er.marks_obtained || 0),
      percentage: Number(er.percentage || 0),
      grade: er.grade,
      status: er.status,
      createdAt: er.created_at,
      student: er.student,
      exam: er.exam
    }));

    mapped.forEach(er => {
      const idx = mockDb.examResults.findIndex(mer => mer.id === er.id);
      if (idx === -1) mockDb.examResults.push(er);
      else mockDb.examResults[idx] = er;
    });
    mockDb.saveAll();

    return mapped;
  },

  async publishExamResults(schoolId: string, examId: string, studentId: string, totalMarks: number, marksObtained: number, percentage: number, grade: string, status: string): Promise<void> {
    const { data, error } = await supabaseAdmin.from('exam_results').upsert({
      school_id: schoolId,
      student_id: studentId,
      exam_id: examId,
      total_marks: totalMarks,
      marks_obtained: marksObtained,
      percentage,
      grade,
      status
    }, { onConflict: 'student_id,exam_id' }).select().single();

    const idx = mockDb.examResults.findIndex(er => er.examId === examId && er.studentId === studentId);
    const resolvedId = data ? data.id : (idx >= 0 ? mockDb.examResults[idx].id : ('er-' + Math.random().toString(36).substr(2, 9)));

    const resultObj = {
      id: resolvedId,
      schoolId,
      studentId,
      examId,
      totalMarks,
      marksObtained,
      percentage,
      grade,
      status: status as any,
      createdAt: data ? data.created_at : new Date().toISOString()
    };

    if (idx === -1) {
      mockDb.examResults.push(resultObj);
    } else {
      mockDb.examResults[idx] = resultObj;
    }
    mockDb.saveAll();

    if (error) {
      throw new Error('Failed to publish exam results: ' + error.message);
    }
  },

  async adminPromoteStudents(schoolId: string, studentIds: string[], targetClassId: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('students')
      .update({ class_id: targetClassId })
      .in('id', studentIds);
    if (error) {
      studentIds.forEach(id => {
        const student = mockDb.students.find(s => s.id === id);
        if (student) {
          student.classId = targetClassId;
        }
      });
      mockDb.saveAll();
    }
  },

  async createPickupPoint(schoolId: string, name: string, latitude: number, longitude: number, routeId: string): Promise<void> {
    await this.validateTransportAction(schoolId, 'create', undefined, undefined, { name, latitude, longitude, routeId });
    let localPpId = 'pp-' + Math.random().toString(36).substr(2, 9);
    const { error } = await supabaseAdmin.from('pickup_points').insert({
      school_id: schoolId,
      name,
      latitude,
      longitude,
      route_id: routeId
    });
    if (error) {
      mockDb.pickupPoints.push({
        id: localPpId,
        schoolId,
        name,
        latitude,
        longitude,
        routeId,
        createdAt: new Date().toISOString()
      });
      mockDb.saveAll();
    } else {
      // Find the created pickup point ID if possible (we can sync or leave it as localId since it falls back)
    }
    await this.logTransportAuditAction(schoolId, 'CREATE_PICKUP_POINT', localPpId, undefined, { name, latitude, longitude, routeId });
  },

  async deletePickupPoint(id: string): Promise<void> {
    const pp = mockDb.pickupPoints.find(p => p.id === id);
    if (pp) {
      await this.validateTransportAction(pp.schoolId, 'delete', id, pp);
    }
    const { error } = await supabaseAdmin.from('pickup_points').delete().eq('id', id);
    const idx = mockDb.pickupPoints.findIndex(x => x.id === id);
    if (idx !== -1) {
      mockDb.pickupPoints.splice(idx, 1);
      mockDb.saveAll();
    }
    if (pp) {
      await this.logTransportAuditAction(pp.schoolId, 'DELETE_PICKUP_POINT', id, pp);
    }
  },

  async fetchAllStudentMarks(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('student_marks')
      .select('*, student:students(*, userDetails:users(*))')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.studentMarks.filter(sm => sm.schoolId === schoolId);
    
    const mapped = data.map(sm => ({
      id: sm.id,
      schoolId: sm.school_id,
      examId: sm.exam_id,
      subjectId: sm.subject_id,
      studentId: sm.student_id,
      marksObtained: Number(sm.marks_obtained || 0),
      remarks: sm.remarks || '',
      createdAt: sm.created_at,
      student: sm.student
    }));

    const otherSchools = mockDb.studentMarks.filter(sm => sm.schoolId !== schoolId);
    mockDb.studentMarks = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async fetchAllExamSubjects(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('exam_subjects')
      .select('*, subject:subjects(*)')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.examSubjects.filter(es => es.schoolId === schoolId);
    
    const mapped = data.map(es => ({
      id: es.id,
      schoolId: es.school_id,
      examId: es.exam_id,
      subjectId: es.subject_id,
      maxMarks: Number(es.max_marks || 100),
      passingMarks: Number(es.passing_marks || 40),
      createdAt: es.created_at,
      subject: es.subject
    }));

    const otherSchools = mockDb.examSubjects.filter(es => es.schoolId !== schoolId);
    mockDb.examSubjects = [...otherSchools, ...mapped];
    mockDb.saveAll();

    return mapped;
  },

  async updateBook(id: string, title: string, author: string, isbn: string, subject: string, totalCopies: number): Promise<void> {
    const book = mockDb.books.find(b => b.id === id);
    if (!book) throw new Error('Book not found.');
    const copiesDiff = totalCopies - book.totalCopies;
    const newAvailable = Math.max(0, book.availableCopies + copiesDiff);

    const { error } = await supabaseAdmin.from('book_inventory').update({
      title,
      author,
      isbn,
      subject,
      total_copies: totalCopies,
      available_copies: newAvailable
    }).eq('id', id);

    book.title = title;
    book.author = author;
    book.isbn = isbn;
    book.subject = subject;
    book.totalCopies = totalCopies;
    book.availableCopies = newAvailable;
    mockDb.saveAll();

    if (error) throw new Error('Failed to update book: ' + error.message);
  },

  async deleteBook(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('book_inventory').delete().eq('id', id);
    const idx = mockDb.books.findIndex(b => b.id === id);
    if (idx !== -1) {
      mockDb.books.splice(idx, 1);
      mockDb.saveAll();
    }
    if (error) throw new Error('Failed to delete book: ' + error.message);
  },

  async updateBookCategory(id: string, name: string, code: string, description?: string): Promise<void> {
    const cat = mockDb.bookCategories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found.');

    const { error } = await supabaseAdmin.from('book_categories').update({
      name,
      code,
      description: description || ''
    }).eq('id', id);

    cat.name = name;
    cat.code = code;
    cat.description = description || '';
    mockDb.saveAll();

    if (error) throw new Error('Failed to update category: ' + error.message);
  },

  async updateBookIssue(id: string, dueDate: string, fineAmount: number, status: string, returnDate?: string): Promise<void> {
    const issue = mockDb.bookIssues.find(bi => bi.id === id);
    if (!issue) throw new Error('Book issue record not found.');

    const { error } = await supabaseAdmin.from('book_issues').update({
      due_date: dueDate,
      fine_amount: fineAmount,
      status,
      return_date: returnDate || null
    }).eq('id', id);

    issue.dueDate = dueDate;
    issue.fineAmount = fineAmount;
    issue.status = status as any;
    issue.returnDate = returnDate || null;
    mockDb.saveAll();

    if (error) throw new Error('Failed to update book issue: ' + error.message);
  },

  async deleteBookIssue(id: string): Promise<void> {
    const issue = mockDb.bookIssues.find(bi => bi.id === id);
    if (!issue) throw new Error('Book issue record not found.');

    const { error } = await supabaseAdmin.from('book_issues').delete().eq('id', id);
    
    if (issue.status === 'ISSUED' || issue.status === 'OVERDUE') {
      const book = mockDb.books.find(b => b.id === issue.bookId);
      if (book) {
        book.availableCopies = Math.min(book.totalCopies, book.availableCopies + 1);
      }
    }

    const idx = mockDb.bookIssues.findIndex(bi => bi.id === id);
    if (idx !== -1) {
      mockDb.bookIssues.splice(idx, 1);
      mockDb.saveAll();
    }

    if (error) throw new Error('Failed to delete book issue: ' + error.message);
  },

  async updateDigitalLibraryAsset(id: string, title: string, author: string, fileUrl: string, fileType: string): Promise<void> {
    const asset = mockDb.digitalLibraryAssets.find(da => da.id === id);
    if (!asset) throw new Error('Digital asset not found.');

    const { error } = await supabaseAdmin.from('digital_library_assets').update({
      title,
      author,
      file_url: fileUrl,
      file_type: fileType
    }).eq('id', id);

    asset.title = title;
    asset.author = author;
    asset.fileUrl = fileUrl;
    asset.fileType = fileType;
    mockDb.saveAll();

    if (error) throw new Error('Failed to update digital asset: ' + error.message);
  },

  async deleteDigitalLibraryAsset(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('digital_library_assets').delete().eq('id', id);
    const idx = mockDb.digitalLibraryAssets.findIndex(da => da.id === id);
    if (idx !== -1) {
      mockDb.digitalLibraryAssets.splice(idx, 1);
      mockDb.saveAll();
    }
    if (error) throw new Error('Failed to delete digital asset: ' + error.message);
  },

  async updateTransportAssignment(id: string, busId: string, routeId: string, pickupPointId: string): Promise<void> {
    const ta = mockDb.transportAssignments.find(t => t.id === id);
    if (!ta) throw new Error('Transit assignment not found.');
    await this.validateTransportAction(ta.schoolId, 'update', id, ta, { busId, routeId, pickupPointId });
    await this.validateSubscriptionFeature(ta.schoolId, 'School Transit', ['enterprise']);

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validPickupPointId = (pickupPointId && isUUID(pickupPointId)) ? pickupPointId : null;

    const { error } = await supabaseAdmin.from('transport_assignments').update({
      bus_id: busId,
      route_id: routeId,
      pickup_point_id: validPickupPointId
    }).eq('id', id);

    ta.busId = busId;
    ta.routeId = routeId;
    ta.pickupPointId = pickupPointId;
    mockDb.saveAll();

    if (error) throw new Error('Failed to update transport assignment: ' + error.message);
    await this.logTransportAuditAction(ta.schoolId, 'UPDATE_TRANSPORT_ASSIGNMENT', id, ta, { busId, routeId, pickupPointId });
  },

  async updateExam(id: string, name: string, term: string, startDate: string, endDate: string): Promise<void> {
    const ex = mockDb.exams.find(e => e.id === id);
    if (!ex) throw new Error('Exam not found.');

    const { error } = await supabaseAdmin.from('exams').update({
      name,
      term,
      start_date: startDate,
      end_date: endDate
    }).eq('id', id);

    ex.name = name;
    ex.term = term;
    ex.startDate = startDate;
    ex.endDate = endDate;
    mockDb.saveAll();

    if (error) throw new Error('Failed to update exam: ' + error.message);
  },

  async updateExamSubject(id: string, maxMarks: number, passingMarks: number): Promise<void> {
    const es = mockDb.examSubjects.find(x => x.id === id);
    if (!es) throw new Error('Subject criteria not found.');

    const { error } = await supabaseAdmin.from('exam_subjects').update({
      max_marks: maxMarks,
      passing_marks: passingMarks
    }).eq('id', id);

    es.maxMarks = maxMarks;
    es.passingMarks = passingMarks;
    mockDb.saveAll();

    if (error) throw new Error('Failed to update criteria: ' + error.message);
  },

  async deleteExamSubject(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('exam_subjects').delete().eq('id', id);
    const idx = mockDb.examSubjects.findIndex(x => x.id === id);
    if (idx !== -1) {
      mockDb.examSubjects.splice(idx, 1);
      mockDb.saveAll();
    }
    if (error) throw new Error('Failed to delete criteria: ' + error.message);
  },

  async deleteStudentMark(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('student_marks').delete().eq('id', id);
    const idx = mockDb.studentMarks.findIndex(x => x.id === id);
    if (idx !== -1) {
      mockDb.studentMarks.splice(idx, 1);
      mockDb.saveAll();
    }
    if (error) throw new Error('Failed to delete mark entry: ' + error.message);
  },

  async updateReportCard(id: string, term: string, attendancePercentage: number, gradePointAverage: number, remarks: string): Promise<void> {
    const rc = mockDb.reportCards.find(r => r.id === id);
    if (!rc) throw new Error('Report card not found.');

    const { error } = await supabaseAdmin.from('report_cards').update({
      term,
      attendance_percentage: attendancePercentage,
      grade_point_average: gradePointAverage,
      remarks
    }).eq('id', id);

    rc.term = term;
    rc.attendancePercentage = attendancePercentage;
    rc.gradePointAverage = gradePointAverage;
    rc.remarks = remarks;
    mockDb.saveAll();

    if (error) throw new Error('Failed to update report card: ' + error.message);
  },

  async deleteReportCard(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('report_cards').delete().eq('id', id);
    const idx = mockDb.reportCards.findIndex(r => r.id === id);
    if (idx !== -1) {
      mockDb.reportCards.splice(idx, 1);
      mockDb.saveAll();
    }
    if (error) throw new Error('Failed to delete report card: ' + error.message);
  },

  // ==========================================
  // HOSTEL MODULE ENDPOINTS
  // ==========================================

  async syncHostelData(schoolId: string): Promise<void> {
    if (!schoolId) return;
    try {
      await this.checkHostelAccess(schoolId);
    } catch (err) {
      console.warn("Skipping hostel data sync (non-Enterprise subscription):", err);
      return;
    }
    if (syncHostelDataPromises[schoolId]) {
      return syncHostelDataPromises[schoolId]!;
    }

    const syncPromise = (async () => {
      try {
        const [hRes, bRes, rRes, bdRes, aRes, attRes, fRes, pRes, lRes, vRes, cRes, mRes] = await Promise.all([
          supabaseAdmin.from('hostels').select('*').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_blocks').select('*').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_rooms').select('*').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_beds').select('*').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_admissions').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_attendance').select('*, student:students(*, userDetails:users(*)), recordedByDetails:users!recorded_by(*)').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_fees').select('*').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_payments').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_leave_requests').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_visitors').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_complaints').select('*, student:students(*, userDetails:users(*))').eq('school_id', schoolId),
          supabaseAdmin.from('hostel_mess_menu').select('*').eq('school_id', schoolId)
        ]);

        // Fetch hostel_wardens separately with a resilient fallback
        // The users(*) JOIN can fail if FK isn't configured on the DB
        let wRes: any = { data: null, error: null };
        try {
          wRes = await supabaseAdmin.from('hostel_wardens').select('*, userDetails:users(*)').eq('school_id', schoolId);
        } catch (joinErr) {
          console.warn('hostel_wardens JOIN with users failed, falling back to plain select:', joinErr);
        }
        if (!wRes.data || wRes.error) {
          // Fallback: query without the users JOIN
          wRes = await supabaseAdmin.from('hostel_wardens').select('*').eq('school_id', schoolId);
        }

        if (hRes.data) {
          mockDb.hostels = hRes.data.map(x => ({ id: x.id, schoolId: x.school_id, name: x.name, type: x.type, status: x.status, createdBy: x.created_by, updatedBy: x.updated_by }));
          mockDb.hostelBuildings = mockDb.hostels;
        }
        if (bRes.data) {
          mockDb.hostelBlocks = bRes.data.map(x => ({ id: x.id, schoolId: x.school_id, hostelId: x.hostel_id, name: x.name, status: x.status, wardenId: x.warden_id || null, createdBy: x.created_by, updatedBy: x.updated_by }));
        }
        if (rRes.data) {
          mockDb.hostelRooms = rRes.data.map(x => ({ id: x.id, schoolId: x.school_id, blockId: x.block_id, floor: Number(x.floor), roomNumber: x.room_number, capacity: Number(x.capacity), status: x.status, createdBy: x.created_by, updatedBy: x.updated_by }));
        }
        if (bdRes.data) {
          mockDb.hostelBeds = bdRes.data.map(x => ({ id: x.id, schoolId: x.school_id, roomId: x.room_id, bedName: x.bed_name, status: x.status, createdBy: x.created_by, updatedBy: x.updated_by }));
        }

        // Fetch warden assignments separately
        let assignmentsRes: any = { data: null, error: null };
        try {
          assignmentsRes = await supabaseAdmin.from('hostel_warden_assignments').select('*, warden:hostel_wardens(*)');
        } catch (assErr) {
          console.warn('hostel_warden_assignments select failed, using fallback:', assErr);
        }
        if (assignmentsRes.data) {
          mockDb.hostelWardenAssignments = assignmentsRes.data
            .filter((x: any) => x.warden && x.warden.school_id === schoolId)
            .map((x: any) => ({
              id: x.id,
              wardenId: x.warden_id,
              buildingId: x.building_id,
              blockId: x.block_id,
              assignedBy: x.assigned_by,
              assignedAt: x.assigned_at,
              status: x.status
            }));
        }

        if (wRes.data) {
          // For each warden row, resolve user details from the JOIN or from a separate users query
          const wardenUserIds = wRes.data.map((x: any) => x.user_id).filter(Boolean);
          let wardenUsersMap: Record<string, any> = {};
          if (wardenUserIds.length > 0) {
            const { data: wardenUsers } = await supabaseAdmin.from('users').select('*').in('id', wardenUserIds);
            if (wardenUsers) {
              wardenUsers.forEach((u: any) => {
                wardenUsersMap[u.id] = {
                  id: u.id, email: u.email, firstName: u.first_name, lastName: u.last_name,
                  phone: u.phone, role: u.role, isActive: u.is_active, schoolId: u.school_id,
                  employeeId: u.employee_id, avatarUrl: u.avatar_url || ''
                };
              });
            }
          }
          mockDb.hostelWardens = wRes.data.map((x: any) => {
            const joinedUser = x.userDetails; // From JOIN (may be null)
            const lookedUpUser = wardenUsersMap[x.user_id]; // From separate query
            const userDetails = joinedUser ? {
              id: joinedUser.id, email: joinedUser.email, firstName: joinedUser.first_name,
              lastName: joinedUser.last_name, phone: joinedUser.phone, role: joinedUser.role,
              isActive: joinedUser.is_active, schoolId: joinedUser.school_id,
              employeeId: joinedUser.employee_id, avatarUrl: joinedUser.avatar_url || ''
            } : lookedUpUser || null;
            
            // Also ensure this user is in mockDb.users
            if (userDetails && !mockDb.users.find((u: any) => u.id === userDetails.id)) {
              mockDb.users.push(userDetails);
            } else if (userDetails) {
              // Update existing user with latest data
              const idx = mockDb.users.findIndex((u: any) => u.id === userDetails.id);
              if (idx >= 0) mockDb.users[idx] = { ...mockDb.users[idx], ...userDetails };
            }
            
            const wardenAssignments = mockDb.hostelWardenAssignments.filter(a => a.wardenId === x.id && a.status === 'ACTIVE');
            const mappedLocations = wardenAssignments.map(a => ({
              buildingId: a.buildingId,
              blockId: a.blockId,
              floor: null,
              section: null
            }));
            const combinedLocations = [...(x.assigned_locations || [])];
            mappedLocations.forEach(ml => {
              const exists = combinedLocations.some(cl => cl.buildingId === ml.buildingId && cl.blockId === ml.blockId);
              if (!exists) combinedLocations.push(ml);
            });

            return {
              id: x.id,
              schoolId: x.school_id,
              userId: x.user_id,
              hostelId: x.hostel_id,
              phone: x.phone,
              username: x.username || '',
              gender: x.gender || '',
              address: x.address || '',
              assignedLocations: combinedLocations,
              employeeId: x.employee_id || userDetails?.employeeId || '',
              firstName: x.first_name || userDetails?.firstName || '',
              lastName: x.last_name || userDetails?.lastName || '',
              email: x.email || userDetails?.email || '',
              designation: x.designation || '',
              joiningDate: x.joining_date || '',
              status: x.status || 'ACTIVE',
              userDetails: userDetails,
              createdBy: x.created_by,
              updatedBy: x.updated_by
            };
          });
        }
        if (aRes.data) {
          mockDb.hostelAdmissions = aRes.data.map(x => ({ id: x.id, schoolId: x.school_id, studentId: x.student_id, hostelId: x.hostel_id, roomId: x.room_id, bedId: x.bed_id, admissionDate: x.admission_date, checkInDate: x.check_in_date, checkOutDate: x.check_out_date, status: x.status, student: x.student, createdBy: x.created_by, updatedBy: x.updated_by }));
        }
        if (attRes.data) {
          mockDb.hostelAttendance = attRes.data.map(x => {
            const joinedRecorder = x.recordedByDetails;
            const recorderDetails = joinedRecorder ? {
              id: joinedRecorder.id,
              email: joinedRecorder.email,
              firstName: joinedRecorder.first_name,
              lastName: joinedRecorder.last_name,
              phone: joinedRecorder.phone || '',
              role: joinedRecorder.role,
              isActive: joinedRecorder.is_active,
              schoolId: joinedRecorder.school_id,
              employeeId: joinedRecorder.employee_id,
              avatarUrl: joinedRecorder.avatar_url || '',
              createdAt: joinedRecorder.created_at || '',
              updatedAt: joinedRecorder.updated_at || ''
            } : null;

            if (recorderDetails && !mockDb.users.find((u: any) => u.id === recorderDetails.id)) {
              mockDb.users.push(recorderDetails as any);
            }

            return {
              id: x.id,
              schoolId: x.school_id,
              studentId: x.student_id,
              date: x.date,
              timeSlot: x.time_slot,
              status: x.status,
              recordedBy: x.recorded_by,
              student: x.student,
              recordedByDetails: recorderDetails,
              createdBy: x.created_by,
              updatedBy: x.updated_by
            };
          });
        }
        if (fRes.data) {
          mockDb.hostelFees = fRes.data.map(x => ({ id: x.id, schoolId: x.school_id, name: x.name, amount: Number(x.amount), feeType: x.fee_type, description: x.description, createdBy: x.created_by, updatedBy: x.updated_by }));
        }
        if (pRes.data) {
          mockDb.hostelPayments = pRes.data.map(x => ({ id: x.id, schoolId: x.school_id, studentId: x.student_id, feeId: x.fee_id, amountPaid: Number(x.amount_paid), paymentDate: x.payment_date, paymentMethod: x.payment_method, txId: x.tx_id, status: x.status, student: x.student, createdBy: x.created_by, updatedBy: x.updated_by }));
        }
        if (lRes.data) {
          mockDb.hostelLeaveRequests = lRes.data.map(x => ({
            id: x.id,
            schoolId: x.school_id,
            studentId: x.student_id,
            fromDate: x.from_date,
            toDate: x.to_date,
            reason: x.reason,
            parentApproval: x.parent_approval,
            wardenApproval: x.warden_approval,
            hostelAdminApproval: x.hostel_admin_approval || 'PENDING',
            adminApproval: x.admin_approval,
            status: x.status,
            approvedBy: x.approved_by,
            student: x.student,
            createdBy: x.created_by,
            updatedBy: x.updated_by
          }));
        }
        if (vRes.data) {
          mockDb.hostelVisitors = vRes.data.map(x => ({ id: x.id, schoolId: x.school_id, visitorName: x.visitor_name, relation: x.relation, studentId: x.student_id, entryTime: x.entry_time, exitTime: x.exit_time, purpose: x.purpose, student: x.student, createdBy: x.created_by, updatedBy: x.updated_by }));
        }
        if (cRes.data) {
          mockDb.hostelComplaints = cRes.data.map(x => ({ id: x.id, schoolId: x.school_id, studentId: x.student_id, category: x.category, description: x.description, assignedStaff: x.assigned_staff, resolutionNotes: x.resolution_notes, status: x.status, student: x.student, createdBy: x.created_by, updatedBy: x.updated_by }));
        }
        if (mRes.data) {
          mockDb.hostelMessMenu = mRes.data.map(x => ({ id: x.id, schoolId: x.school_id, hostelId: x.hostel_id, dayOfWeek: Number(x.day_of_week), breakfast: x.breakfast, lunch: x.lunch, dinner: x.dinner, specialMenu: x.special_menu, createdBy: x.created_by, updatedBy: x.updated_by }));
        }

        mockDb.saveAll();
      } catch (e) {
        console.error('Failed to sync hostel data:', e);
      } finally {
        setTimeout(() => {
          syncHostelDataPromises[schoolId] = null;
        }, 2000);
      }
    })();

    syncHostelDataPromises[schoolId] = syncPromise;
    return syncPromise;
  },
  clearHostelCache(schoolId: string) {
    if (schoolId) {
      syncHostelDataPromises[schoolId] = null;
    }
  },


  // Hostel CRUD
  async fetchHostels(schoolId: string): Promise<Hostel[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostels.filter(h => h.schoolId === schoolId);
  },

  async createHostel(schoolId: string, name: string, type: 'BOYS' | 'GIRLS' | 'MIXED', status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostels').insert({ school_id: schoolId, name, type, status, created_by: operatorId, updated_by: operatorId }).select().single();
    if (error) throw new Error('Failed to create hostel: ' + error.message);
    if (data) {
      mockDb.hostels.push({ id: data.id, schoolId: data.school_id, name: data.name, type: data.type, status: data.status, createdBy: data.created_by, updatedBy: data.updated_by });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async updateHostel(id: string, name: string, type: 'BOYS' | 'GIRLS' | 'MIXED', status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    const h = mockDb.hostels.find(x => x.id === id);
    if (h) await this.checkHostelAccess(h.schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostels').update({ name, type, status, updated_by: operatorId }).eq('id', id);
    if (error) throw new Error('Failed to update hostel: ' + error.message);
    if (h) {
      h.name = name;
      h.type = type;
      h.status = status;
      h.updatedBy = operatorId || undefined;
      mockDb.saveAll();
      this.clearHostelCache(h.schoolId);
    }
  },

  async deleteHostel(id: string): Promise<void> {
    const h = mockDb.hostels.find(x => x.id === id);
    if (h) await this.checkHostelAccess(h.schoolId);
    const { error } = await supabaseAdmin.from('hostels').delete().eq('id', id);
    if (error) throw new Error('Failed to delete hostel: ' + error.message);
    mockDb.hostels = mockDb.hostels.filter(x => x.id !== id);
    mockDb.saveAll();
    if (h) this.clearHostelCache(h.schoolId);
  },

  // Blocks CRUD
  async fetchHostelBlocks(schoolId: string): Promise<HostelBlock[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelBlocks.filter(b => b.schoolId === schoolId);
  },

  async createHostelBlock(schoolId: string, hostelId: string, name: string, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_blocks').insert({ school_id: schoolId, hostel_id: hostelId, name, status, created_by: operatorId, updated_by: operatorId }).select().single();
    if (error) throw new Error('Failed to create block: ' + error.message);
    if (data) {
      mockDb.hostelBlocks.push({ id: data.id, schoolId: data.school_id, hostelId: data.hostel_id, name: data.name, status: data.status, createdBy: data.created_by, updatedBy: data.updated_by });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async updateHostelBlock(id: string, name: string, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    const b = mockDb.hostelBlocks.find(x => x.id === id);
    if (b) await this.checkHostelAccess(b.schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostel_blocks').update({ name, status, updated_by: operatorId }).eq('id', id);
    if (error) throw new Error('Failed to update block: ' + error.message);
    if (b) {
      b.name = name;
      b.status = status;
      b.updatedBy = operatorId || undefined;
      mockDb.saveAll();
      this.clearHostelCache(b.schoolId);
    }
  },

  async deleteHostelBlock(id: string): Promise<void> {
    const b = mockDb.hostelBlocks.find(x => x.id === id);
    if (b) await this.checkHostelAccess(b.schoolId);
    const { error } = await supabaseAdmin.from('hostel_blocks').delete().eq('id', id);
    if (error) throw new Error('Failed to delete block: ' + error.message);
    mockDb.hostelBlocks = mockDb.hostelBlocks.filter(x => x.id !== id);
    mockDb.saveAll();
    if (b) this.clearHostelCache(b.schoolId);
  },

  // Rooms CRUD
  async fetchHostelRooms(schoolId: string): Promise<HostelRoom[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelRooms.filter(r => r.schoolId === schoolId);
  },

  async createHostelRoom(schoolId: string, blockId: string, floor: number, roomNumber: string, capacity: number, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const exists = mockDb.hostelRooms.some(r => r.blockId === blockId && r.roomNumber.toLowerCase() === roomNumber.toLowerCase());
    if (exists) {
      throw new Error(`A room with number "${roomNumber}" already exists in this block.`);
    }

    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_rooms').insert({ school_id: schoolId, block_id: blockId, floor, room_number: roomNumber, capacity, status, created_by: operatorId, updated_by: operatorId }).select().single();
    if (error) throw new Error('Failed to create room: ' + error.message);
    if (data) {
      mockDb.hostelRooms.push({ id: data.id, schoolId: data.school_id, blockId: data.block_id, floor: Number(data.floor), roomNumber: data.room_number, capacity: Number(data.capacity), status: data.status, createdBy: data.created_by, updatedBy: data.updated_by });
      
      // Auto generate beds for the room
      for (let i = 1; i <= capacity; i++) {
        await this.createHostelBed(schoolId, data.id, `Bed ${i}`);
      }
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async updateHostelRoom(id: string, floor: number, roomNumber: string, status: 'ACTIVE' | 'INACTIVE'): Promise<void> {
    const r = mockDb.hostelRooms.find(x => x.id === id);
    if (r) await this.checkHostelAccess(r.schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostel_rooms').update({ floor, room_number: roomNumber, status, updated_by: operatorId }).eq('id', id);
    if (error) throw new Error('Failed to update room: ' + error.message);
    if (r) {
      r.floor = floor;
      r.roomNumber = roomNumber;
      r.status = status;
      r.updatedBy = operatorId || undefined;
      mockDb.saveAll();
      this.clearHostelCache(r.schoolId);
    }
  },

  async deleteHostelRoom(id: string): Promise<void> {
    const r = mockDb.hostelRooms.find(x => x.id === id);
    if (r) await this.checkHostelAccess(r.schoolId);
    const { error } = await supabaseAdmin.from('hostel_rooms').delete().eq('id', id);
    if (error) throw new Error('Failed to delete room: ' + error.message);
    mockDb.hostelRooms = mockDb.hostelRooms.filter(x => x.id !== id);
    mockDb.hostelBeds = mockDb.hostelBeds.filter(x => x.roomId !== id);
    mockDb.saveAll();
    if (r) this.clearHostelCache(r.schoolId);
  },

  // Beds CRUD
  async fetchHostelBeds(schoolId: string): Promise<HostelBed[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelBeds.filter(b => b.schoolId === schoolId);
  },

  async createHostelBed(schoolId: string, roomId: string, bedName: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const exists = mockDb.hostelBeds.some(b => b.roomId === roomId && b.bedName.toLowerCase() === bedName.toLowerCase());
    if (exists) {
      throw new Error(`A bed with designation "${bedName}" already exists in this room.`);
    }

    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_beds').insert({ school_id: schoolId, room_id: roomId, bed_name: bedName, status: 'VACANT', created_by: operatorId, updated_by: operatorId }).select().single();
    if (error) throw new Error('Failed to create bed: ' + error.message);
    if (data) {
      mockDb.hostelBeds.push({ id: data.id, schoolId: data.school_id, roomId: data.room_id, bedName: data.bed_name, status: data.status, createdBy: data.created_by, updatedBy: data.updated_by });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async updateHostelBedStatus(id: string, status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE'): Promise<void> {
    const b = mockDb.hostelBeds.find(x => x.id === id);
    if (b) await this.checkHostelAccess(b.schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostel_beds').update({ status, updated_by: operatorId }).eq('id', id);
    if (error) throw new Error('Failed to update bed: ' + error.message);
    if (b) {
      b.status = status;
      mockDb.saveAll();
      this.clearHostelCache(b.schoolId);
    }
  },

  async deleteHostelBed(id: string): Promise<void> {
    const b = mockDb.hostelBeds.find(x => x.id === id);
    if (b) await this.checkHostelAccess(b.schoolId);
    const { error } = await supabaseAdmin.from('hostel_beds').delete().eq('id', id);
    if (error) throw new Error('Failed to delete bed: ' + error.message);
    mockDb.hostelBeds = mockDb.hostelBeds.filter(x => x.id !== id);
    mockDb.saveAll();
    if (b) this.clearHostelCache(b.schoolId);
  },

  // Wardens CRUD
  async fetchHostelWardens(schoolId: string): Promise<HostelWarden[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelWardens.filter(w => w.schoolId === schoolId);
  },

  async createHostelWarden(schoolId: string, userId: string, hostelId: string | null, phone?: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_wardens').insert({ school_id: schoolId, user_id: userId, hostel_id: hostelId || null, phone, created_by: operatorId, updated_by: operatorId }).select().single();
    if (error) throw new Error('Failed to assign warden: ' + error.message);
    if (data) {
      const user = mockDb.users.find(u => u.id === userId);
      mockDb.hostelWardens.push({ id: data.id, schoolId: data.school_id, userId: data.user_id, hostelId: data.hostel_id, phone: data.phone, userDetails: user, createdBy: data.created_by, updatedBy: data.updated_by });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async updateHostelWarden(
    id: string,
    fields: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      employeeId?: string;
      username?: string;
      gender?: string;
      address?: string;
      isActive?: boolean;
      assignedLocations?: any[];
      hostelId?: string | null;
      designation?: string;
      joiningDate?: string;
    }
  ): Promise<void> {
    const w = mockDb.hostelWardens.find(x => x.id === id);
    if (!w) throw new Error('Warden profile not found');
    await this.checkHostelAccess(w.schoolId);
    const operatorId = getActiveUser()?.id || null;
    
    // Update hostel_wardens table
    const updateObj: any = {
      updated_by: operatorId
    };
    if (fields.hostelId !== undefined) updateObj.hostel_id = fields.hostelId;
    if (fields.phone !== undefined) updateObj.phone = fields.phone;
    if (fields.username !== undefined) updateObj.username = fields.username;
    if (fields.gender !== undefined) updateObj.gender = fields.gender;
    if (fields.address !== undefined) updateObj.address = fields.address;
    if (fields.assignedLocations !== undefined) updateObj.assigned_locations = fields.assignedLocations;
    if (fields.firstName !== undefined) updateObj.first_name = fields.firstName;
    if (fields.lastName !== undefined) updateObj.last_name = fields.lastName;
    if (fields.email !== undefined) updateObj.email = fields.email;
    if (fields.employeeId !== undefined) updateObj.employee_id = fields.employeeId;
    if (fields.designation !== undefined) updateObj.designation = fields.designation;
    if (fields.joiningDate !== undefined) updateObj.joining_date = fields.joiningDate;
    if (fields.isActive !== undefined) updateObj.status = fields.isActive ? 'ACTIVE' : 'INACTIVE';

    const { error: wErr } = await supabaseAdmin.from('hostel_wardens').update(updateObj).eq('id', id);
    if (wErr) throw new Error('Failed to update warden database profile: ' + wErr.message);

    // Sync hostel_warden_assignments table in Supabase
    if (fields.assignedLocations !== undefined) {
      // Find old blocks that currently point to this warden and clear them
      const oldBlocks = mockDb.hostelBlocks.filter(b => b.wardenId === id);
      for (const b of oldBlocks) {
        b.wardenId = null;
        try {
          await supabaseAdmin.from('hostel_blocks').update({ warden_id: null }).eq('id', b.id);
        } catch (err) {
          console.error(err);
        }
      }

      await supabaseAdmin.from('hostel_warden_assignments').delete().eq('warden_id', id);
      const assignmentRows = fields.assignedLocations.map((loc: any) => ({
        warden_id: id,
        building_id: loc.buildingId || loc.hostelId,
        block_id: loc.blockId || null,
        assigned_by: operatorId,
        status: 'ACTIVE'
      }));
      if (assignmentRows.length > 0) {
        await supabaseAdmin.from('hostel_warden_assignments').insert(assignmentRows);
      }
      
      // Update mockDb cache
      mockDb.hostelWardenAssignments = mockDb.hostelWardenAssignments.filter(a => a.wardenId !== id);
      fields.assignedLocations.forEach((loc: any) => {
        mockDb.hostelWardenAssignments.push({
          id: Math.random().toString(36).substring(2, 11),
          wardenId: id,
          buildingId: loc.buildingId || loc.hostelId,
          blockId: loc.blockId || null,
          assignedBy: operatorId,
          assignedAt: new Date().toISOString(),
          status: 'ACTIVE'
        });
      });

      // Update new blocks to point to this warden
      const newBlockIds = fields.assignedLocations.map((loc: any) => loc.blockId).filter(Boolean);
      for (const blockId of newBlockIds) {
        const b = mockDb.hostelBlocks.find(x => x.id === blockId);
        if (b) {
          b.wardenId = id;
        }
        try {
          await supabaseAdmin.from('hostel_blocks').update({ warden_id: id }).eq('id', blockId);
        } catch (err) {
          console.error(err);
        }
      }
    }

    // Update users table
    const userUpdate: any = {};
    if (fields.firstName !== undefined) userUpdate.first_name = fields.firstName;
    if (fields.lastName !== undefined) userUpdate.last_name = fields.lastName;
    if (fields.email !== undefined) userUpdate.email = fields.email;
    if (fields.phone !== undefined) userUpdate.phone = fields.phone;
    if (fields.employeeId !== undefined) userUpdate.employee_id = fields.employeeId;
    if (fields.isActive !== undefined) userUpdate.is_active = fields.isActive;

    const { error: uErr } = await supabaseAdmin.from('users').update(userUpdate).eq('id', w.userId);
    if (uErr) throw new Error('Failed to update warden system user account: ' + uErr.message);

    // Sync mockDb state
    w.hostelId = fields.hostelId !== undefined ? fields.hostelId : w.hostelId;
    w.phone = fields.phone !== undefined ? fields.phone : w.phone;
    w.username = fields.username !== undefined ? fields.username : w.username;
    w.gender = fields.gender !== undefined ? fields.gender : w.gender;
    w.address = fields.address !== undefined ? fields.address : w.address;
    w.assignedLocations = fields.assignedLocations !== undefined ? fields.assignedLocations : w.assignedLocations;
    w.firstName = fields.firstName !== undefined ? fields.firstName : w.firstName;
    w.lastName = fields.lastName !== undefined ? fields.lastName : w.lastName;
    w.email = fields.email !== undefined ? fields.email : w.email;
    w.employeeId = fields.employeeId !== undefined ? fields.employeeId : w.employeeId;
    w.designation = fields.designation !== undefined ? fields.designation : w.designation;
    w.joiningDate = fields.joiningDate !== undefined ? fields.joiningDate : w.joiningDate;
    w.status = fields.isActive !== undefined ? (fields.isActive ? 'ACTIVE' : 'INACTIVE') : w.status;
    w.updatedBy = operatorId || undefined;

    const usrObj = mockDb.users.find(u => u.id === w.userId);
    if (usrObj) {
      if (fields.firstName !== undefined) usrObj.firstName = fields.firstName;
      if (fields.lastName !== undefined) usrObj.lastName = fields.lastName;
      if (fields.email !== undefined) usrObj.email = fields.email;
      if (fields.phone !== undefined) usrObj.phone = fields.phone || '';
      if (fields.employeeId !== undefined) usrObj.employeeId = fields.employeeId;
      if (fields.isActive !== undefined) usrObj.isActive = fields.isActive;
    }

    mockDb.saveAll();
    this.clearHostelCache(w.schoolId);
  },

  async deleteHostelWarden(id: string): Promise<void> {
    const w = mockDb.hostelWardens.find(x => x.id === id);
    if (!w) return;
    await this.checkHostelAccess(w.schoolId);

    // Delete from users table (cascades to delete hostel_wardens)
    const { error } = await supabaseAdmin.from('users').delete().eq('id', w.userId);
    if (error) throw new Error('Failed to remove warden: ' + error.message);

    // Delete auth user (bypasses SQL RLS)
    try {
      await supabaseAdmin.auth.admin.deleteUser(w.userId);
    } catch (e) {
      console.warn('Auth user deletion skipped or failed:', e);
    }

    // Sync cache
    mockDb.users = mockDb.users.filter(u => u.id !== w.userId);
    mockDb.hostelWardens = mockDb.hostelWardens.filter(x => x.id !== id);
    mockDb.hostelWardenAssignments = mockDb.hostelWardenAssignments.filter(x => x.wardenId !== id);
    mockDb.saveAll();
    this.clearHostelCache(w.schoolId);
  },

  // Admissions CRUD
  async fetchHostelAdmissions(schoolId: string): Promise<HostelAdmission[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelAdmissions.filter(a => a.schoolId === schoolId);
  },

  async admitStudentToHostel(schoolId: string, studentId: string, hostelId: string, roomId: string, bedId: string, admissionDate: string, checkInDate?: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    // 1. Validation: Prevent duplicate active admission for same student
    const active = mockDb.hostelAdmissions.find(a => a.studentId === studentId && a.status === 'ACTIVE');
    if (active) throw new Error('Student is already actively assigned to another hostel room.');

    // 2. Validation: Prevent overcapacity or occupied beds
    const bed = mockDb.hostelBeds.find(b => b.id === bedId);
    if (!bed || bed.status !== 'VACANT') {
      throw new Error('Selected bed is occupied or undergoing maintenance.');
    }

    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_admissions').insert({
      school_id: schoolId,
      student_id: studentId,
      hostel_id: hostelId,
      room_id: roomId,
      bed_id: bedId,
      admission_date: admissionDate,
      check_in_date: checkInDate || null,
      status: 'ACTIVE',
      created_by: operatorId,
      updated_by: operatorId
    }).select().single();

    if (error) throw new Error('Failed to admit student: ' + error.message);
    if (data) {
      // Set bed status to OCCUPIED
      await this.updateHostelBedStatus(bedId, 'OCCUPIED');

      const student = mockDb.students.find(s => s.id === studentId);
      mockDb.hostelAdmissions.push({
        id: data.id, schoolId: data.school_id, studentId: data.student_id, hostelId: data.hostel_id,
        roomId: data.room_id, bedId: data.bed_id, admissionDate: data.admission_date,
        checkInDate: data.check_in_date, status: data.status, student, createdBy: data.created_by, updatedBy: data.updated_by
      });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async checkoutStudentFromHostel(id: string, checkOutDate: string): Promise<void> {
    const ad = mockDb.hostelAdmissions.find(x => x.id === id);
    if (!ad) throw new Error('Admission record not found.');

    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostel_admissions').update({
      check_out_date: checkOutDate,
      status: 'CHECKED_OUT',
      updated_by: operatorId
    }).eq('id', id);

    if (error) throw new Error('Failed to checkout student: ' + error.message);

    // Free the bed
    await this.updateHostelBedStatus(ad.bedId, 'VACANT');

    ad.checkOutDate = checkOutDate;
    ad.status = 'CHECKED_OUT';
    ad.updatedBy = operatorId || undefined;
    mockDb.saveAll();
    this.clearHostelCache(ad.schoolId);
  },

  async deleteHostelAdmission(id: string): Promise<void> {
    const ad = mockDb.hostelAdmissions.find(x => x.id === id);
    if (!ad) throw new Error('Admission record not found.');
    await this.checkHostelAccess(ad.schoolId);

    const { error } = await supabaseAdmin.from('hostel_admissions').delete().eq('id', id);
    if (error) throw new Error('Failed to delete admission: ' + error.message);

    if (ad.status === 'ACTIVE') {
      await this.updateHostelBedStatus(ad.bedId, 'VACANT');
    }

    mockDb.hostelAdmissions = mockDb.hostelAdmissions.filter(x => x.id !== id);
    mockDb.saveAll();
    this.clearHostelCache(ad.schoolId);
  },

  // Attendance CRUD
  async fetchHostelAttendance(schoolId: string): Promise<HostelAttendance[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelAttendance.filter(a => a.schoolId === schoolId);
  },

  async recordHostelAttendance(schoolId: string, studentId: string, date: string, timeSlot: 'MORNING' | 'EVENING', status: 'PRESENT' | 'ABSENT' | 'LEAVE', recordedBy: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_attendance').upsert({
      school_id: schoolId,
      student_id: studentId,
      date,
      time_slot: timeSlot,
      status,
      recorded_by: recordedBy,
      created_by: operatorId,
      updated_by: operatorId
    }, { onConflict: 'student_id,date,time_slot' }).select().single();

    if (error) throw new Error('Failed to record attendance: ' + error.message);
    if (data) {
      const idx = mockDb.hostelAttendance.findIndex(x => x.studentId === studentId && x.date === date && x.timeSlot === timeSlot);
      const student = mockDb.students.find(s => s.id === studentId);
      const recorderUser = mockDb.users.find(u => u.id === recordedBy);
      const mapped = {
        id: data.id,
        schoolId: data.school_id,
        studentId: data.student_id,
        date: data.date,
        timeSlot: data.time_slot,
        status: data.status,
        recordedBy: data.recorded_by,
        student,
        recordedByDetails: recorderUser || null,
        createdBy: data.created_by,
        updatedBy: data.updated_by
      };
      
      if (idx === -1) mockDb.hostelAttendance.push(mapped);
      else mockDb.hostelAttendance[idx] = mapped;
      mockDb.saveAll();
      this.clearHostelCache(schoolId);

      // Notify student and parent of hostel attendance
      if (student) {
        this.sendNotificationToUserAndParents(
          student.userId,
          `Hostel Attendance Marked`,
          `Hostel attendance for ${timeSlot.toLowerCase()} check-in on ${date} has been marked ${status.toUpperCase()}.`,
          'Hostel',
          schoolId,
          recordedBy,
          status === 'ABSENT' ? 'HIGH' : 'MEDIUM'
        ).catch(e => console.error('Failed to notify hostel attendance:', e));
      }
    }
  },

  // Leave Requests CRUD
  async fetchHostelLeaveRequests(schoolId: string): Promise<HostelLeaveRequest[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelLeaveRequests.filter(l => l.schoolId === schoolId);
  },

  async createHostelLeaveRequest(schoolId: string, studentId: string, fromDate: string, toDate: string, reason: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_leave_requests').insert({
      school_id: schoolId,
      student_id: studentId,
      from_date: fromDate,
      to_date: toDate,
      reason,
      parent_approval: 'PENDING',
      warden_approval: 'PENDING',
      hostel_admin_approval: 'PENDING',
      admin_approval: 'PENDING',
      status: 'PENDING',
      created_by: operatorId,
      updated_by: operatorId
    }).select().single();

    if (error) throw new Error('Failed to submit leave request: ' + error.message);
    if (data) {
      const student = mockDb.students.find(s => s.id === studentId);
      mockDb.hostelLeaveRequests.push({
        id: data.id, schoolId: data.school_id, studentId: data.student_id, fromDate: data.from_date,
        toDate: data.to_date, reason: data.reason, parentApproval: data.parent_approval,
        wardenApproval: data.warden_approval, hostelAdminApproval: data.hostel_admin_approval || 'PENDING',
        adminApproval: data.admin_approval,
        status: data.status, student, createdBy: data.created_by, updatedBy: data.updated_by
      });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async approveHostelLeaveRequest(id: string, approverRole: 'PARENT' | 'WARDEN' | 'HOSTEL_ADMIN' | 'SCHOOL_ADMIN', approvalStatus: 'APPROVED' | 'REJECTED' | 'HOLD', approverUserId: string): Promise<void> {
    const l = mockDb.hostelLeaveRequests.find(x => x.id === id);
    if (!l) throw new Error('Leave request not found.');
    await this.checkHostelAccess(l.schoolId);

    const operatorId = getActiveUser()?.id || null;
    const updateObj: any = {};
    if (approverRole === 'PARENT') updateObj.parent_approval = approvalStatus;
    else if (approverRole === 'WARDEN') updateObj.warden_approval = approvalStatus;
    else if (approverRole === 'HOSTEL_ADMIN') updateObj.hostel_admin_approval = approvalStatus;
    else if (approverRole === 'SCHOOL_ADMIN') updateObj.admin_approval = approvalStatus;

    // Evaluate final request status
    const nextParent = approverRole === 'PARENT' ? approvalStatus : l.parentApproval;
    const nextWarden = approverRole === 'WARDEN' ? approvalStatus : l.wardenApproval;
    const nextHostelAdmin = approverRole === 'HOSTEL_ADMIN' ? approvalStatus : (l.hostelAdminApproval || 'PENDING');
    const nextSchoolAdmin = approverRole === 'SCHOOL_ADMIN' ? approvalStatus : l.adminApproval;

    if (nextParent === 'REJECTED' || nextWarden === 'REJECTED' || nextHostelAdmin === 'REJECTED' || nextSchoolAdmin === 'REJECTED') {
      updateObj.status = 'REJECTED';
    } else if (nextParent === 'HOLD' || nextWarden === 'HOLD' || nextHostelAdmin === 'HOLD' || nextSchoolAdmin === 'HOLD') {
      updateObj.status = 'HOLD';
    } else if (nextParent === 'APPROVED' && nextWarden === 'APPROVED' && nextHostelAdmin === 'APPROVED' && nextSchoolAdmin === 'APPROVED') {
      updateObj.status = 'APPROVED';
    } else {
      updateObj.status = 'PENDING';
    }

    updateObj.approved_by = approverUserId;
    updateObj.updated_by = operatorId;

    const { error } = await supabaseAdmin.from('hostel_leave_requests').update(updateObj).eq('id', id);
    if (error) throw new Error('Failed to approve request: ' + error.message);

    if (approverRole === 'PARENT') l.parentApproval = approvalStatus;
    else if (approverRole === 'WARDEN') l.wardenApproval = approvalStatus;
    else if (approverRole === 'HOSTEL_ADMIN') l.hostelAdminApproval = approvalStatus;
    else if (approverRole === 'SCHOOL_ADMIN') l.adminApproval = approvalStatus;

    l.status = updateObj.status || l.status;
    l.approvedBy = approverUserId;
    l.updatedBy = operatorId || undefined;
    mockDb.saveAll();
    this.clearHostelCache(l.schoolId);

    // Notify student and parent if state changes to APPROVED or REJECTED
    if (l.status === 'APPROVED' || l.status === 'REJECTED') {
      const student = mockDb.students.find(s => s.id === l.studentId);
      if (student) {
        const title = `Hostel Leave Request ${l.status}`;
        const message = `Your hostel leave request from ${new Date(l.fromDate).toLocaleDateString()} to ${new Date(l.toDate).toLocaleDateString()} has been ${l.status.toLowerCase()}.`;
        this.sendNotificationToUserAndParents(
          student.userId,
          title,
          message,
          'Hostel',
          l.schoolId,
          approverUserId,
          'HIGH'
        ).catch(e => console.error('Failed to notify hostel leave update:', e));
      }
    }
  },

  async deleteHostelLeaveRequest(id: string): Promise<void> {
    const l = mockDb.hostelLeaveRequests.find(x => x.id === id);
    const { error } = await supabaseAdmin.from('hostel_leave_requests').delete().eq('id', id);
    if (error) throw new Error('Failed to delete leave request: ' + error.message);
    mockDb.hostelLeaveRequests = mockDb.hostelLeaveRequests.filter(x => x.id !== id);
    mockDb.saveAll();
    if (l) this.clearHostelCache(l.schoolId);
  },

  // Visitors CRUD
  async fetchHostelVisitors(schoolId: string): Promise<HostelVisitor[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelVisitors.filter(v => v.schoolId === schoolId);
  },

  async createHostelVisitor(schoolId: string, visitorName: string, relation: string, studentId: string, purpose: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_visitors').insert({
      school_id: schoolId,
      visitor_name: visitorName,
      relation,
      student_id: studentId,
      purpose,
      entry_time: new Date().toISOString(),
      created_by: operatorId,
      updated_by: operatorId
    }).select().single();

    if (error) throw new Error('Failed to log visitor: ' + error.message);
    if (data) {
      const student = mockDb.students.find(s => s.id === studentId);
      mockDb.hostelVisitors.push({
        id: data.id, schoolId: data.school_id, visitorName: data.visitor_name, relation: data.relation,
        studentId: data.student_id, entryTime: data.entry_time, purpose: data.purpose, student, createdBy: data.created_by, updatedBy: data.updated_by
      });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async checkoutHostelVisitor(id: string): Promise<void> {
    const now = new Date().toISOString();
    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostel_visitors').update({ exit_time: now, updated_by: operatorId }).eq('id', id);
    if (error) throw new Error('Failed to check out visitor: ' + error.message);
    const v = mockDb.hostelVisitors.find(x => x.id === id);
    if (v) {
      v.exitTime = now;
      v.updatedBy = operatorId || undefined;
      mockDb.saveAll();
      this.clearHostelCache(v.schoolId);
    }
  },

  async deleteHostelVisitor(id: string): Promise<void> {
    const v = mockDb.hostelVisitors.find(x => x.id === id);
    const { error } = await supabaseAdmin.from('hostel_visitors').delete().eq('id', id);
    if (error) throw new Error('Failed to delete visitor log: ' + error.message);
    mockDb.hostelVisitors = mockDb.hostelVisitors.filter(x => x.id !== id);
    mockDb.saveAll();
    if (v) this.clearHostelCache(v.schoolId);
  },

  // Complaints CRUD
  async fetchHostelComplaints(schoolId: string): Promise<HostelComplaint[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelComplaints.filter(c => c.schoolId === schoolId);
  },

  async createHostelComplaint(schoolId: string, studentId: string, category: 'ROOM' | 'ELECTRICITY' | 'WATER' | 'MAINTENANCE' | 'OTHER', description: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_complaints').insert({
      school_id: schoolId,
      student_id: studentId,
      category,
      description,
      status: 'SUBMITTED',
      created_by: operatorId,
      updated_by: operatorId
    }).select().single();

    if (error) throw new Error('Failed to log complaint: ' + error.message);
    if (data) {
      const student = mockDb.students.find(s => s.id === studentId);
      mockDb.hostelComplaints.push({
        id: data.id, schoolId: data.school_id, studentId: data.student_id, category: data.category,
        description: data.description, status: data.status, student, createdBy: data.created_by, updatedBy: data.updated_by
      });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async updateHostelComplaint(id: string, status: 'SUBMITTED' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED', assignedStaff?: string, resolutionNotes?: string): Promise<void> {
    const c = mockDb.hostelComplaints.find(x => x.id === id);
    if (c) await this.checkHostelAccess(c.schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostel_complaints').update({
      status,
      assigned_staff: assignedStaff || null,
      resolution_notes: resolutionNotes || null,
      updated_by: operatorId
    }).eq('id', id);

    if (error) throw new Error('Failed to update complaint: ' + error.message);
    if (c) {
      c.status = status;
      c.assignedStaff = assignedStaff;
      c.resolutionNotes = resolutionNotes;
      c.updatedBy = operatorId || undefined;
      mockDb.saveAll();
      this.clearHostelCache(c.schoolId);
    }
  },

  async deleteHostelComplaint(id: string): Promise<void> {
    const c = mockDb.hostelComplaints.find(x => x.id === id);
    if (c) await this.checkHostelAccess(c.schoolId);
    const { error } = await supabaseAdmin.from('hostel_complaints').delete().eq('id', id);
    if (error) throw new Error('Failed to delete complaint: ' + error.message);
    mockDb.hostelComplaints = mockDb.hostelComplaints.filter(x => x.id !== id);
    mockDb.saveAll();
    if (c) this.clearHostelCache(c.schoolId);
  },

  // Hostel Fees CRUD
  async fetchHostelFees(schoolId: string): Promise<HostelFee[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelFees.filter(f => f.schoolId === schoolId);
  },

  async createHostelFee(schoolId: string, name: string, amount: number, feeType: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME' | 'MESS', description?: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_fees').insert({
      school_id: schoolId,
      name,
      amount,
      fee_type: feeType,
      description,
      created_by: operatorId,
      updated_by: operatorId
    }).select().single();

    if (error) throw new Error('Failed to create hostel fee structure: ' + error.message);
    if (data) {
      mockDb.hostelFees.push({
        id: data.id, schoolId: data.school_id, name: data.name, amount: Number(data.amount),
        feeType: data.fee_type, description: data.description, createdBy: data.created_by, updatedBy: data.updated_by
      });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);

      // Notify all active hostel students and their parents about the fee due
      try {
        const admissions = mockDb.hostelAdmissions.filter(a => a.schoolId === schoolId && a.status === 'ACTIVE');
        for (const ad of admissions) {
          const student = mockDb.students.find(s => s.id === ad.studentId);
          if (student) {
            const isMess = feeType === 'MESS';
            const title = isMess ? 'Mess Fee Due' : 'Hostel Fee Due';
            const message = isMess
              ? `Mess fee payment of $${amount.toFixed(2)} for "${name}" is due.`
              : `Hostel fee payment of $${amount.toFixed(2)} for "${name}" is due.`;

            this.sendNotificationToUserAndParents(
              student.userId,
              title,
              message,
              isMess ? 'Fee' : 'Hostel',
              schoolId,
              operatorId,
              'MEDIUM'
            ).catch(e => console.error('Failed to notify fee due:', e));
          }
        }
      } catch (err) {
        console.error('Failed to resolve hostel admissions for notifications:', err);
      }
    }
  },

  async updateHostelFee(id: string, name: string, amount: number, feeType: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME' | 'MESS', description?: string): Promise<void> {
    const operatorId = getActiveUser()?.id || null;
    const { error } = await supabaseAdmin.from('hostel_fees').update({ name, amount, fee_type: feeType, description, updated_by: operatorId }).eq('id', id);
    if (error) throw new Error('Failed to update fee: ' + error.message);
    const f = mockDb.hostelFees.find(x => x.id === id);
    if (f) {
      f.name = name;
      f.amount = amount;
      f.feeType = feeType;
      f.description = description;
      f.updatedBy = operatorId || undefined;
      mockDb.saveAll();
      this.clearHostelCache(f.schoolId);
    }
  },

  async deleteHostelFee(id: string): Promise<void> {
    const f = mockDb.hostelFees.find(x => x.id === id);
    const { error } = await supabaseAdmin.from('hostel_fees').delete().eq('id', id);
    if (error) throw new Error('Failed to delete fee structure: ' + error.message);
    mockDb.hostelFees = mockDb.hostelFees.filter(x => x.id !== id);
    mockDb.saveAll();
    if (f) this.clearHostelCache(f.schoolId);
  },

  // Payments / Receipts Ledger
  async fetchHostelPayments(schoolId: string): Promise<HostelPayment[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelPayments.filter(p => p.schoolId === schoolId);
  },

  async recordHostelPayment(schoolId: string, studentId: string, feeId: string, amountPaid: number, paymentMethod: 'CASH' | 'CARD' | 'ONLINE' | 'BANK_TRANSFER', txId?: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const feeObj = mockDb.hostelFees.find(f => f.id === feeId);
    if (!feeObj) throw new Error('Fee structure not found.');

    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_payments').insert({
      school_id: schoolId,
      student_id: studentId,
      fee_id: feeId,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
      tx_id: txId || null,
      status: amountPaid >= feeObj.amount ? 'PAID' : 'PARTIAL',
      created_by: operatorId,
      updated_by: operatorId
    }).select().single();

    if (error) throw new Error('Failed to record payment: ' + error.message);
    if (data) {
      // Integration with Finance Module: Generate a general invoice/receipt in invoices
      try {
        const student = mockDb.students.find(s => s.id === studentId);
        
        let sessionId = student?.academicSessionId;
        if (!sessionId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sessionId)) {
          const { data: sessData } = await supabaseAdmin
            .from('academic_sessions')
            .select('id')
            .eq('school_id', schoolId)
            .eq('is_active', true)
            .limit(1);
          if (sessData && sessData.length > 0) {
            sessionId = sessData[0].id;
          } else {
            const { data: sessData2 } = await supabaseAdmin
              .from('academic_sessions')
              .select('id')
              .eq('school_id', schoolId)
              .limit(1);
            if (sessData2 && sessData2.length > 0) {
              sessionId = sessData2[0].id;
            }
          }
        }

        if (sessionId) {
          const invNumber = 'INV-HST-' + Math.floor(100000 + Math.random() * 900000);
          const dueDate = new Date().toISOString().split('T')[0];
          
          await supabaseAdmin.from('invoices').insert({
            school_id: schoolId,
            academic_session_id: sessionId,
            student_id: studentId,
            invoice_number: invNumber,
            amount: amountPaid,
            due_date: dueDate,
            status: 'PAID'
          });
        }
      } catch (finErr) {
        console.error('Failed to link hostel fee to finance invoices:', finErr);
      }

      const student = mockDb.students.find(s => s.id === studentId);
      mockDb.hostelPayments.push({
        id: data.id, schoolId: data.school_id, studentId: data.student_id, feeId: data.fee_id,
        amountPaid: Number(data.amount_paid), paymentDate: data.payment_date, paymentMethod: data.payment_method,
        txId: data.tx_id, status: data.status, student, fee: feeObj, createdBy: data.created_by, updatedBy: data.updated_by
      });
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async deleteHostelPayment(id: string): Promise<void> {
    const p = mockDb.hostelPayments.find(x => x.id === id);
    const { error } = await supabaseAdmin.from('hostel_payments').delete().eq('id', id);
    if (error) throw new Error('Failed to delete payment log: ' + error.message);
    mockDb.hostelPayments = mockDb.hostelPayments.filter(x => x.id !== id);
    mockDb.saveAll();
    if (p) this.clearHostelCache(p.schoolId);
  },

  // Mess Menu CRUD
  async fetchHostelMessMenus(schoolId: string): Promise<HostelMessMenu[]> {
    await this.syncHostelData(schoolId);
    return mockDb.hostelMessMenu.filter(m => m.schoolId === schoolId);
  },

  async saveHostelMessMenu(schoolId: string, hostelId: string | null, dayOfWeek: number, breakfast: string, lunch: string, dinner: string, specialMenu?: string): Promise<void> {
    await this.checkHostelAccess(schoolId);
    const operatorId = getActiveUser()?.id || null;
    const { error, data } = await supabaseAdmin.from('hostel_mess_menu').upsert({
      school_id: schoolId,
      hostel_id: hostelId || null,
      day_of_week: dayOfWeek,
      breakfast,
      lunch,
      dinner,
      special_menu: specialMenu || null,
      created_by: operatorId,
      updated_by: operatorId
    }, { onConflict: 'hostel_id,day_of_week' }).select().single();

    if (error) throw new Error('Failed to update mess menu: ' + error.message);
    if (data) {
      const idx = mockDb.hostelMessMenu.findIndex(x => x.hostelId === hostelId && x.dayOfWeek === dayOfWeek);
      const mapped = { id: data.id, schoolId: data.school_id, hostelId: data.hostel_id, dayOfWeek: Number(data.day_of_week), breakfast: data.breakfast, lunch: data.lunch, dinner: data.dinner, specialMenu: data.special_menu, createdBy: data.created_by, updatedBy: data.updated_by };
      
      if (idx === -1) mockDb.hostelMessMenu.push(mapped);
      else mockDb.hostelMessMenu[idx] = mapped;
      mockDb.saveAll();
      this.clearHostelCache(schoolId);
    }
  },

  async ensureCbseStructure(schoolId: string, sessionId: string): Promise<void> {
    try {
      const { data: existingSubs } = await supabaseAdmin
        .from('subjects')
        .select('*')
        .eq('school_id', schoolId);

      const cbseSubjects = [
        { name: 'English', code: 'ENG101', description: 'English Language and Literature' },
        { name: 'Hindi', code: 'HIN101', description: 'Hindi Course A' },
        { name: 'Mathematics', code: 'MATH101', description: 'Mathematics Core' },
        { name: 'Science', code: 'SCI101', description: 'General Science' },
        { name: 'Social Science', code: 'SOC101', description: 'Social Sciences & History' },
        { name: 'Info. Tech.', code: 'IT101', description: 'Information Technology' }
      ];

      const subjectIdMap: Record<string, string> = {};

      for (const item of cbseSubjects) {
        const found = existingSubs?.find(s => s.name.toLowerCase() === item.name.toLowerCase() || s.code.toLowerCase() === item.code.toLowerCase());
        if (found) {
          subjectIdMap[item.name] = found.id;
        } else {
          const { data: newSub } = await supabaseAdmin
            .from('subjects')
            .insert({
              school_id: schoolId,
              name: item.name,
              code: item.code,
              description: item.description
            })
            .select()
            .single();
          if (newSub) {
            subjectIdMap[item.name] = newSub.id;
          }
        }
      }

      const { data: existingExams } = await supabaseAdmin
        .from('exams')
        .select('*')
        .eq('school_id', schoolId)
        .eq('academic_session_id', sessionId);

      const cbseExams = [
        { name: 'Pre-Mid Term Exam', term: 'TERM 1' },
        { name: 'Mid-Term Exam', term: 'TERM 1' },
        { name: 'Post-Mid Term Exam', term: 'TERM 2' },
        { name: 'Annual Exam', term: 'TERM 2' },
        { name: 'Practical Exam', term: 'PRACTICAL' }
      ];

      const examIdMap: Record<string, string> = {};

      for (const item of cbseExams) {
        const found = existingExams?.find(e => e.name.toLowerCase() === item.name.toLowerCase());
        if (found) {
          examIdMap[item.name] = found.id;
        } else {
          const today = new Date().toISOString().split('T')[0];
          const { data: newExam } = await supabaseAdmin
            .from('exams')
            .insert({
              school_id: schoolId,
              academic_session_id: sessionId,
              name: item.name,
              term: item.term,
              start_date: today,
              end_date: today
            })
            .select()
            .single();
          if (newExam) {
            examIdMap[item.name] = newExam.id;
          }
        }
      }

      const examNameKeys = Object.keys(examIdMap);
      const subjectNameKeys = Object.keys(subjectIdMap);

      if (examNameKeys.length > 0 && subjectNameKeys.length > 0) {
        const { data: existingES } = await supabaseAdmin
          .from('exam_subjects')
          .select('*')
          .eq('school_id', schoolId);

        for (const examName of examNameKeys) {
          const examId = examIdMap[examName];
          for (const subName of subjectNameKeys) {
            const subjectId = subjectIdMap[subName];
            const found = existingES?.find(es => es.exam_id === examId && es.subject_id === subjectId);
            if (!found) {
              let maxMarks = 100;
              let passingMarks = 33;
              if (examName === 'Pre-Mid Term Exam') {
                maxMarks = 10;
                passingMarks = 3;
              } else if (examName === 'Mid-Term Exam') {
                maxMarks = 30;
                passingMarks = 10;
              } else if (examName === 'Post-Mid Term Exam') {
                maxMarks = 10;
                passingMarks = 3;
              } else if (examName === 'Annual Exam') {
                maxMarks = 30;
                passingMarks = 10;
              } else if (examName === 'Practical Exam') {
                maxMarks = subName === 'Info. Tech.' ? 50 : 20;
                passingMarks = subName === 'Info. Tech.' ? 17 : 7;
              }

              await supabaseAdmin
                .from('exam_subjects')
                .insert({
                  school_id: schoolId,
                  exam_id: examId,
                  subject_id: subjectId,
                  max_marks: maxMarks,
                  passing_marks: passingMarks
                });
            }
          }
        }
      }

      const { data: allStudents } = await supabaseAdmin
        .from('students')
        .select('id')
        .eq('school_id', schoolId);

      if (allStudents && allStudents.length > 0 && examNameKeys.length > 0 && subjectNameKeys.length > 0) {
        const { data: existingMarks } = await supabaseAdmin
          .from('student_marks')
          .select('*')
          .eq('school_id', schoolId);

        const sampleScores: Record<string, Record<string, number>> = {
          'English': { 'Pre-Mid Term Exam': 9, 'Mid-Term Exam': 22, 'Post-Mid Term Exam': 9, 'Annual Exam': 23, 'Practical Exam': 20 },
          'Hindi': { 'Pre-Mid Term Exam': 7, 'Mid-Term Exam': 26, 'Post-Mid Term Exam': 9, 'Annual Exam': 26, 'Practical Exam': 19 },
          'Mathematics': { 'Pre-Mid Term Exam': 9, 'Mid-Term Exam': 15, 'Post-Mid Term Exam': 7, 'Annual Exam': 13, 'Practical Exam': 19 },
          'Science': { 'Pre-Mid Term Exam': 7, 'Mid-Term Exam': 14, 'Post-Mid Term Exam': 6, 'Annual Exam': 14, 'Practical Exam': 19 },
          'Social Science': { 'Pre-Mid Term Exam': 9, 'Mid-Term Exam': 22, 'Post-Mid Term Exam': 7, 'Annual Exam': 22, 'Practical Exam': 20 },
          'Info. Tech.': { 'Pre-Mid Term Exam': 8, 'Mid-Term Exam': 8, 'Post-Mid Term Exam': 8, 'Annual Exam': 10, 'Practical Exam': 50 }
        };

        const inserts = [];
        for (const student of allStudents) {
          const hasAny = existingMarks?.some(m => m.student_id === student.id);
          if (!hasAny) {
            for (const subName of subjectNameKeys) {
              const subjectId = subjectIdMap[subName];
              const subScores = sampleScores[subName] || {};
              for (const examName of examNameKeys) {
                const examId = examIdMap[examName];
                let score = subScores[examName] || 0;
                if (student.id !== 'ea1fa678-0e2b-4fa8-82d2-9f38f3952926') {
                  const maxPossible = examName === 'Pre-Mid Term Exam' || examName === 'Post-Mid Term Exam' ? 10 : (examName === 'Practical Exam' ? (subName === 'Info. Tech.' ? 50 : 20) : 30);
                  score = Math.max(0, Math.min(maxPossible, score + Math.floor(Math.random() * 5) - 2));
                }

                inserts.push({
                  school_id: schoolId,
                  exam_id: examId,
                  subject_id: subjectId,
                  student_id: student.id,
                  marks_obtained: score,
                  remarks: 'auto-graded'
                });
              }
            }
          }
        }

        if (inserts.length > 0) {
          await supabaseAdmin.from('student_marks').insert(inserts);
        }
      }

      await this.syncSubjectsData(schoolId);
      await this.syncExamsData(schoolId);
      await this.syncExamSchedulesData(schoolId);
      await this.fetchAllStudentMarks(schoolId);
    } catch (e) {
      console.error('Failed to self-heal CBSE structure:', e);
    }
  },

  async getStudentMarksheetData(studentId: string, termName: string): Promise<any> {
    const studentCheck = mockDb.students.find(s => s.id === studentId);
    if (!studentCheck) throw new Error('Student not found');
    const schoolId = studentCheck.schoolId;
    const sessionId = studentCheck.academicSessionId;

    // Sync all core database tables from Supabase before marksheet generation
    await this.syncSchoolsData(schoolId).catch(console.error);
    await this.syncStudentsData(schoolId).catch(console.error);
    await this.syncUsersData(schoolId).catch(console.error);
    await this.syncClassesData(schoolId).catch(console.error);
    await this.syncSectionsData(schoolId).catch(console.error);
    await this.syncAcademicSessionsData(schoolId).catch(console.error);
    await this.syncTeachersData(schoolId).catch(console.error);
    await this.syncParentsData(schoolId).catch(console.error);
    await this.syncParentStudentMappingsData(schoolId).catch(console.error);
    await this.syncAttendanceData(schoolId).catch(console.error);
    await this.syncSubjectsData(schoolId).catch(console.error);
    await this.syncExamsData(schoolId).catch(console.error);
    await this.syncExamSchedulesData(schoolId).catch(console.error);
    await this.fetchAllStudentMarks(schoolId).catch(console.error);
    await this.fetchReportCards(schoolId, studentId).catch(console.error);

    // 1. School Validation
    let school = mockDb.schools.find(s => s.id === schoolId);
    const { data: dbSchool } = await supabaseAdmin.from('schools').select('*').eq('id', schoolId).single();
    if (dbSchool) {
      school = {
        id: dbSchool.id,
        name: dbSchool.name,
        address: dbSchool.address || '',
        phone: dbSchool.phone || '',
        subscriptionPlan: dbSchool.subscription_plan || 'freemium',
        createdAt: dbSchool.created_at,
        country: dbSchool.country || '',
        currencyCode: dbSchool.currency_code || '',
        currencySymbol: dbSchool.currency_symbol || '',
        timezone: dbSchool.timezone || '',
        logoUrl: dbSchool.logo_url || '',
        logoFileName: dbSchool.logo_file_name || '',
        logoUploadedAt: dbSchool.logo_uploaded_at || '',
        sealUrl: dbSchool.seal_url || '',
        sealFileName: dbSchool.seal_file_name || '',
        sealUploadedAt: dbSchool.seal_uploaded_at || ''
      };
    }
    if (!school || !school.name) {
      throw new Error('Marksheet generation failed: School profile details are missing in the database.');
    }
    if (!school.logoUrl) {
      throw new Error('Marksheet generation failed: School logo is missing in the database. Please upload a logo in branding configuration.');
    }
    if (!school.sealUrl) {
      throw new Error('Marksheet generation failed: School seal is missing in the database. Please upload a seal in branding configuration.');
    }

    // 2. Student Validation
    const student = mockDb.students.find(s => s.id === studentId);
    if (!student) {
      throw new Error('Marksheet generation failed: Student profile not found.');
    }
    const studentUser = mockDb.users.find(u => u.id === student.userId);
    if (!studentUser || !studentUser.firstName) {
      throw new Error('Marksheet generation failed: Student user account details are missing in the database.');
    }

    // 3. Class and Section Validation
    const cls = mockDb.classes.find(c => c.id === student.classId);
    if (!cls) {
      throw new Error('Marksheet generation failed: Class assignment not found.');
    }
    const sec = student.sectionId ? mockDb.sections.find(s => s.id === student.sectionId) : null;
    const className = cls.name;
    const sectionName = sec?.name || '';

    // 4. Class Teacher Validation
    if (!cls.classTeacherId) {
      throw new Error('Marksheet generation failed: No Class Teacher has been assigned to this class.');
    }
    const teacher = mockDb.teachers.find(t => t.id === cls.classTeacherId);
    if (!teacher) {
      throw new Error('Marksheet generation failed: Assigned Class Teacher profile not found.');
    }
    const teacherUser = mockDb.users.find(u => u.id === teacher.userId);
    if (!teacherUser) {
      throw new Error('Marksheet generation failed: Class Teacher user account details are missing in the database.');
    }
    let teacherSignatureUrl = teacher.signatureUrl || '';
    try {
      const { data: dbTeacher } = await supabaseAdmin
        .from('teachers')
        .select('signature_url')
        .eq('id', cls.classTeacherId)
        .maybeSingle();
      if (dbTeacher?.signature_url) {
        teacherSignatureUrl = dbTeacher.signature_url;
      }
    } catch (err) {
      console.error('Failed to fetch teacher signature:', err);
    }
    if (!teacherSignatureUrl) {
      throw new Error('Marksheet generation failed: Class Teacher signature asset is missing in the database. Please upload a signature in Teacher settings.');
    }
    const teacherName = `${teacherUser.firstName} ${teacherUser.lastName}`;

    // 5. Principal Signature Validation
    let principalSignatureUrl = '';
    let principalName = '';
    const { data: dbAdmin } = await supabaseAdmin
      .from('school_admins')
      .select('signature_url, users(first_name, last_name)')
      .eq('school_id', schoolId)
      .eq('status', 'ACTIVE')
      .maybeSingle();
    if (dbAdmin) {
      if (dbAdmin.signature_url) {
        principalSignatureUrl = dbAdmin.signature_url;
      }
      if (dbAdmin.users) {
        const u = dbAdmin.users as any;
        principalName = `${u.first_name} ${u.last_name}`;
      }
    }
    if (!principalSignatureUrl) {
      throw new Error('Marksheet generation failed: Principal signature asset is missing in the database. Please upload a signature in School Admin settings.');
    }
    if (!principalName) {
      throw new Error('Marksheet generation failed: Active School Administrator (Principal) user details not found.');
    }

    // 6. Parent Details
    const mappings = mockDb.parentStudentMappings.filter(m => m.studentId === studentId);
    let fatherName = '';
    let motherName = '';
    let address = school.address || '';

    for (const m of mappings) {
      const parent = mockDb.parents.find(p => p.id === m.parentId);
      if (parent) {
        address = parent.address || address;
        const parentUser = mockDb.users.find(u => u.id === parent.userId);
        if (parentUser) {
          if (m.relationship?.toLowerCase() === 'father') {
            fatherName = `${parentUser.firstName} ${parentUser.lastName}`;
          } else if (m.relationship?.toLowerCase() === 'mother') {
            motherName = `${parentUser.firstName} ${parentUser.lastName}`;
          }
        }
      }
    }

    // 7. Exam and Marks Validation
    const sessionObj = mockDb.academicSessions.find(s => s.id === sessionId);
    const sessionName = sessionObj?.name || '2025-2026';
    const exams = mockDb.exams.filter(e => e.schoolId === schoolId && e.academicSessionId === sessionId);

    // Resolve the selected exam using termName argument (which can be a UUID or a name/term string)
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    let selectedExam: any = null;
    if (isUUID(termName)) {
      selectedExam = exams.find(e => e.id === termName);
    } else {
      selectedExam = exams.find(e => e.name === termName || e.term === termName) || exams[0];
    }

    if (!selectedExam) {
      throw new Error('Marksheet generation failed: Selected exam not found.');
    }

    // Fetch subjects assigned to the student's class for the selected exam
    const classSchedules = mockDb.examSchedules.filter(es => es.examId === selectedExam.id && es.classId === student.classId);
    const assignedSubjectIds = Array.from(new Set(classSchedules.map(es => es.subjectId)));
    const subjects = mockDb.subjects.filter(s => assignedSubjectIds.includes(s.id));

    if (subjects.length === 0) {
      throw new Error('Marksheet cannot be generated because no subjects are assigned to the student\'s class for the selected exam.');
    }

    const studentMarks = mockDb.studentMarks.filter(sm => sm.studentId === studentId);

    const preMidExam = exams.find(e => e.name.toLowerCase().includes('pre-mid') || e.name.toLowerCase().includes('pre mid'));
    const midTermExam = exams.find(e => e.name.toLowerCase().includes('mid-term') || e.name.toLowerCase().includes('midterm') || e.name.toLowerCase().includes('mid term'));
    const postMidExam = exams.find(e => e.name.toLowerCase().includes('post-mid') || e.name.toLowerCase().includes('post mid'));
    const annualExam = exams.find(e => e.name.toLowerCase().includes('annual') || e.name.toLowerCase().includes('final'));
    const practicalExam = exams.find(e => e.name.toLowerCase().includes('practical'));

    // Compare assigned subjects vs saved marks records
    const missingSubjects: string[] = [];
    for (const sub of subjects) {
      const hasMark = studentMarks.some(sm => sm.subjectId === sub.id && sm.examId === selectedExam.id);
      if (!hasMark) {
        missingSubjects.push(sub.name);
      }
    }

    if (missingSubjects.length > 0) {
      const missingList = missingSubjects.map(s => `• ${s}`).join('\n');
      throw new Error(`Marksheet cannot be generated because marks are missing for one or more subjects in the selected exam. Please complete marks entry and try again.\n\nThe following subjects do not have marks entered for the selected exam:\n\n${missingList}\n\nPlease complete marks entry before generating the marksheet.`);
    }

    const scholasticData = subjects.map(sub => {
      const preMid = preMidExam ? studentMarks.find(sm => sm.subjectId === sub.id && sm.examId === preMidExam.id) : null;
      const midTerm = midTermExam ? studentMarks.find(sm => sm.subjectId === sub.id && sm.examId === midTermExam.id) : null;
      const postMid = postMidExam ? studentMarks.find(sm => sm.subjectId === sub.id && sm.examId === postMidExam.id) : null;
      const annual = annualExam ? studentMarks.find(sm => sm.subjectId === sub.id && sm.examId === annualExam.id) : null;
      const practical = practicalExam ? studentMarks.find(sm => sm.subjectId === sub.id && sm.examId === practicalExam.id) : null;

      const preMidMarks = preMid ? preMid.marksObtained : 0;
      const midTermMarks = midTerm ? midTerm.marksObtained : 0;
      const postMidMarks = postMid ? postMid.marksObtained : 0;
      const annualMarks = annual ? annual.marksObtained : 0;
      const practicalMarks = practical ? practical.marksObtained : 0;

      const total = preMidMarks + midTermMarks + postMidMarks + annualMarks + practicalMarks;

      let grade = 'E';
      if (total >= 91) grade = 'A1';
      else if (total >= 81) grade = 'A2';
      else if (total >= 71) grade = 'B1';
      else if (total >= 61) grade = 'B2';
      else if (total >= 51) grade = 'C1';
      else if (total >= 41) grade = 'C2';
      else if (total >= 33) grade = 'D';

      return {
        subjectId: sub.id,
        subjectName: sub.name,
        preMid: preMidMarks,
        midTerm: midTermMarks,
        postMid: postMidMarks,
        annual: annualMarks,
        practical: practicalMarks,
        total: total,
        grade: grade
      };
    });

    const classStudents = mockDb.students.filter(s => s.classId === student.classId);
    const studentTotalScores = classStudents.map(cs => {
      const csMarks = mockDb.studentMarks.filter(sm => sm.studentId === cs.id);
      let totalScore = 0;
      subjects.forEach(sub => {
        const preMid = preMidExam ? csMarks.find(sm => sm.subjectId === sub.id && sm.examId === preMidExam.id) : null;
        const midTerm = midTermExam ? csMarks.find(sm => sm.subjectId === sub.id && sm.examId === midTermExam.id) : null;
        const postMid = postMidExam ? csMarks.find(sm => sm.subjectId === sub.id && sm.examId === postMidExam.id) : null;
        const annual = annualExam ? csMarks.find(sm => sm.subjectId === sub.id && sm.examId === annualExam.id) : null;
        const practical = practicalExam ? csMarks.find(sm => sm.subjectId === sub.id && sm.examId === practicalExam.id) : null;

        totalScore += (preMid?.marksObtained || 0) + (midTerm?.marksObtained || 0) + (postMid?.marksObtained || 0) + (annual?.marksObtained || 0) + (practical?.marksObtained || 0);
      });
      return { studentId: cs.id, score: totalScore };
    });

    studentTotalScores.sort((a, b) => b.score - a.score);
    const myRankIndex = studentTotalScores.findIndex(s => s.studentId === studentId);
    const classRank = myRankIndex >= 0 ? myRankIndex + 1 : 1;

    const attendanceLogs = mockDb.attendance.filter(a => a.studentId === studentId && a.academicSessionId === sessionId);
    const reportCard = mockDb.reportCards.find(rc => rc.studentId === studentId && rc.schoolId === schoolId && rc.term === termName);

    let totalWorkingDays = attendanceLogs.length;
    let presentDays = attendanceLogs.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    let attendancePercentage = totalWorkingDays > 0 ? Math.round((presentDays / totalWorkingDays) * 100) : 0;

    if (reportCard && reportCard.attendancePercentage !== undefined && reportCard.attendancePercentage !== null) {
      attendancePercentage = reportCard.attendancePercentage;
      if (totalWorkingDays === 0) {
        totalWorkingDays = 120; // Default total scale
        presentDays = Math.round((attendancePercentage / 100) * totalWorkingDays);
      }
    }

    if (totalWorkingDays === 0 && attendancePercentage === 0) {
      throw new Error('Marksheet generation failed: Attendance records are missing in the database.');
    }

    let parsedRemarks: any = null;
    if (reportCard?.remarks) {
      try {
        parsedRemarks = JSON.parse(reportCard.remarks);
      } catch {
        parsedRemarks = {
          classTeacherRemarks: reportCard.remarks
        };
      }
    }

    const coScholastic = {
      artEducation: { term1: parsedRemarks?.coScholastic?.artEducation?.term1 || 'A', term2: parsedRemarks?.coScholastic?.artEducation?.term2 || 'A' },
      games: { term1: parsedRemarks?.coScholastic?.games?.term1 || 'A', term2: parsedRemarks?.coScholastic?.games?.term2 || 'A' },
      healthAndFitness: { term1: parsedRemarks?.coScholastic?.healthAndFitness?.term1 || 'B', term2: parsedRemarks?.coScholastic?.healthAndFitness?.term2 || 'B' },
      sewa: { term1: parsedRemarks?.coScholastic?.sewa?.term1 || 'B', term2: parsedRemarks?.coScholastic?.sewa?.term2 || 'B' },
      discipline: { term1: parsedRemarks?.coScholastic?.discipline?.term1 || 'A', term2: parsedRemarks?.coScholastic?.discipline?.term2 || 'B' }
    };

    let reopeningDate = parsedRemarks?.reopeningDate || '';
    if (!reopeningDate && sessionObj) {
      try {
        const sessionEnd = new Date(sessionObj.endDate);
        const reopen = new Date(sessionEnd.getTime() + 60 * 24 * 3600 * 1000); // 2 months later
        reopeningDate = reopen.toLocaleDateString('en-GB') + ' (Monday)';
      } catch {
        reopeningDate = '';
      }
    }

    let promotedClass = parsedRemarks?.promotedClass || '';
    if (!promotedClass && className) {
      const match = className.match(/\d+/);
      if (match) {
        const currentNum = parseInt(match[0]);
        const nextNum = currentNum + 1;
        promotedClass = className.replace(String(currentNum), String(nextNum));
      } else {
        promotedClass = 'Next Grade';
      }
    }

    const failedSubjectsCount = scholasticData.filter(s => s.total < 33).length;
    let computedResult = 'Pass';
    if (failedSubjectsCount === 1) {
      computedResult = 'Compartment';
    } else if (failedSubjectsCount >= 2) {
      computedResult = 'Fail';
    }
    const resultStatus = parsedRemarks?.resultStatus || computedResult;

    const remarks = {
      classTeacherRemarks: parsedRemarks?.classTeacherRemarks || reportCard?.remarks || 'Progress is satisfactory.',
      dateOfIssue: parsedRemarks?.dateOfIssue || new Date().toLocaleDateString('en-GB'),
      reopeningDate: reopeningDate,
      promotedClass: promotedClass,
      resultStatus: resultStatus
    };

    const signatures = {
      classTeacherName: teacherName,
      classTeacherSignatureUrl: teacherSignatureUrl,
      principalName: principalName,
      principalSignatureUrl: principalSignatureUrl
    };

    const verificationCode = `MS-${sessionName.slice(0, 4)}-${student.admissionNumber.replace(/[^a-zA-Z0-9]/g, '')}`;

    return {
      school: {
        id: schoolId,
        name: school.name,
        address: school.address,
        phone: school.phone,
        email: school.email || `info@${school.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.edu.in`,
        sessionName: sessionName,
        logoUrl: school.logoUrl,
        sealUrl: school.sealUrl
      },
      student: {
        id: studentId,
        name: `${studentUser.firstName} ${studentUser.lastName}`,
        admissionNumber: student.admissionNumber,
        rollNumber: student.rollNumber,
        className: className,
        sectionName: sectionName,
        dateOfBirth: student.dateOfBirth,
        fatherName: fatherName,
        motherName: motherName,
        address: address,
        avatarUrl: studentUser.avatarUrl || ''
      },
      academic: {
        term: termName,
        subjects: scholasticData,
        classRank: classRank,
        attendance: {
          percentage: attendancePercentage,
          presentDays: presentDays,
          workingDays: totalWorkingDays
        }
      },
      coScholastic: coScholastic,
      remarks: remarks,
      signatures: signatures,
      verificationCode: verificationCode
    };
  },

  async fetchSystemStatuses(): Promise<SystemStatus[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('system_status')
        .select('*')
        .order('service_name', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          serviceName: item.service_name,
          status: item.status,
          description: item.description,
          updatedAt: item.updated_at
        }));
        mockDb.systemStatuses = mapped;
        mockDb.saveAll();
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch system statuses from Supabase. Falling back to local cache:', err);
    }
    return mockDb.systemStatuses;
  },

  async fetchKnowledgeBaseArticles(): Promise<KnowledgeBaseArticle[]> {
    const activeUser = getActiveUser();
    const userRole = (activeUser?.role || 'STUDENT') as UserRole;

    try {
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          title: item.title,
          category: item.category,
          content: item.content,
          targetRoles: item.target_roles as UserRole[],
          createdAt: item.created_at,
          updatedAt: item.updated_at
        }));
        
        mockDb.knowledgeBaseArticles = mapped;
        mockDb.saveAll();
        return mapped.filter(article => article.targetRoles.includes(userRole));
      }
    } catch (err) {
      console.warn('Failed to fetch knowledge base from Supabase. Falling back to local cache:', err);
    }

    return mockDb.knowledgeBaseArticles.filter(article => article.targetRoles.includes(userRole));
  },

  async fetchSupportTickets(schoolId: string): Promise<SupportTicket[]> {
    const activeUser = getActiveUser();
    if (!activeUser) return [];

    try {
      let query = supabaseAdmin
        .from('support_tickets')
        .select('*, userDetails:users!support_tickets_user_id_fkey(*), schoolDetails:schools(name), messages:support_ticket_messages(count)');

      if (activeUser.role === 'SUPER_ADMIN') {
        // Fetch all tickets globally
      } else {
        // School Admin (ADMIN) and all other users fetch their own tickets only
        query = query.eq('user_id', activeUser.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const mapped = data.map((t: any) => ({
          id: t.id,
          ticketNumber: t.ticket_number,
          schoolId: t.school_id,
          userId: t.user_id,
          userRole: t.user_role === 'SCHOOL_ADMIN' ? 'ADMIN' : t.user_role,
          category: t.category,
          priority: t.priority,
          subject: t.subject,
          description: t.description,
          attachmentUrl: t.attachment_url,
          status: t.status,
          assignedTo: t.assigned_to,
          createdAt: t.created_at,
          updatedAt: t.updated_at,
          userDetails: t.userDetails ? {
            id: t.userDetails.id,
            email: t.userDetails.email,
            firstName: t.userDetails.first_name,
            lastName: t.userDetails.last_name,
            avatarUrl: t.userDetails.avatar_url
          } : null,
          schoolName: t.schoolDetails?.name || undefined,
          replyCount: t.messages?.[0]?.count || 0
        }));

        mockDb.supportTickets = mapped;
        mockDb.saveAll();
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch support tickets from Supabase. Falling back to local cache:', err);
    }

    // Local DB Cache Fetch
    let localList = [...mockDb.supportTickets];
    if (activeUser.role === 'SUPER_ADMIN') {
      // return all
    } else {
      localList = localList.filter(t => t.userId === activeUser.id);
    }

    return localList.map(t => {
      const school = mockDb.schools.find(s => s.id === t.schoolId);
      return {
        ...t,
        schoolName: school?.name || undefined,
        replyCount: mockDb.supportTicketMessages.filter(m => m.ticketId === t.id).length
      };
    });
  },

  async createSupportTicket(
    schoolId: string,
    subject: string,
    description: string,
    category: string,
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    attachmentUrl?: string
  ): Promise<void> {
    const activeUser = getActiveUser();
    if (!activeUser) throw new Error('Unauthenticated');

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validSchoolId = isUUID(schoolId) ? schoolId : null;

    const ticketNumber = 'TKT-' + Date.now().toString().slice(-6) + Math.floor(10 + Math.random() * 90);

    try {
      const { error, data } = await supabaseAdmin
        .from('support_tickets')
        .insert({
          school_id: validSchoolId,
          user_id: activeUser.id,
          user_role: activeUser.role === 'ADMIN' ? 'SCHOOL_ADMIN' : activeUser.role,
          category,
          priority,
          subject,
          description,
          status: 'OPEN',
          attachment_url: attachmentUrl || null,
          ticket_number: ticketNumber
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const userDetails = mockDb.users.find(u => u.id === activeUser.id);
        const schoolDetails = mockDb.schools.find(s => s.id === validSchoolId);
        mockDb.supportTickets.unshift({
          id: data.id,
          ticketNumber: data.ticket_number,
          schoolId: data.school_id,
          userId: data.user_id,
          userRole: data.user_role === 'SCHOOL_ADMIN' ? 'ADMIN' : data.user_role,
          category: data.category,
          priority: data.priority,
          subject: data.subject,
          description: data.description,
          status: data.status,
          attachmentUrl: data.attachment_url,
          assignedTo: data.assigned_to,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          userDetails: userDetails ? {
            id: userDetails.id,
            email: userDetails.email,
            firstName: userDetails.firstName,
            lastName: userDetails.lastName,
            avatarUrl: userDetails.avatarUrl
          } : null,
          schoolName: schoolDetails?.name || undefined,
          replyCount: 0
        });

        // Notify Super Admins
        const { data: superAdmins } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('role', 'SUPER_ADMIN');

        const { data: dbUser } = await supabaseAdmin
          .from('users')
          .select('first_name, last_name')
          .eq('id', activeUser.id)
          .single();
        const requesterName = dbUser ? `${dbUser.first_name} ${dbUser.last_name}` : (userDetails ? `${userDetails.firstName} ${userDetails.lastName}` : 'System User');

        if (superAdmins && superAdmins.length > 0) {
          const notifInserts = superAdmins.map((admin: any) => ({
            user_id: admin.id,
            ticket_id: data.id,
            title: `New Support Request (${data.ticket_number})`,
            message: `A new ticket has been opened by ${requesterName} (${activeUser.role}): "${subject.substring(0, 40)}..."`
          }));
          await supabaseAdmin.from('support_notifications').insert(notifInserts);
        }

        mockDb.saveAll();
        return;
      }
    } catch (err) {
      console.warn('Failed to create ticket on Supabase. Saving to local mockDb cache:', err);
    }

    const mockId = 'stk-' + Math.random().toString(36).substring(2, 9);
    const fallbackTicketNumber = 'TKT-' + (1001 + mockDb.supportTickets.length).toString();
    const userDetails = mockDb.users.find(u => u.id === activeUser.id);
    const schoolDetails = mockDb.schools.find(s => s.id === validSchoolId);
    
    mockDb.supportTickets.unshift({
      id: mockId,
      ticketNumber: fallbackTicketNumber,
      schoolId: validSchoolId || undefined,
      userId: activeUser.id,
      userRole: activeUser.role,
      category,
      priority,
      subject,
      description,
      status: 'OPEN',
      attachmentUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      userDetails: userDetails ? {
        id: userDetails.id,
        email: userDetails.email,
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
        avatarUrl: userDetails.avatarUrl
      } : null,
      schoolName: schoolDetails?.name || undefined,
      replyCount: 0
    });

    const superAdmins = mockDb.users.filter(u => u.role === 'SUPER_ADMIN');
    superAdmins.forEach(admin => {
      mockDb.supportNotifications.push({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        userId: admin.id,
        ticketId: mockId,
        title: `New Support Request (${ticketNumber})`,
        message: `A new ticket has been opened by ${userDetails?.firstName || ''} ${userDetails?.lastName || ''} (${activeUser.role}): "${subject.substring(0, 40)}..."`,
        isRead: false,
        createdAt: new Date().toISOString()
      });
    });

    mockDb.saveAll();
  },

  async updateSupportTicketStatus(
    ticketId: string, 
    oldStatus: string, 
    newStatus: 'OPEN' | 'IN_PROGRESS' | 'AWAITING_USER_RESPONSE' | 'RESOLVED' | 'CLOSED' | 'REOPENED'
  ): Promise<void> {
    const activeUser = getActiveUser();
    if (!activeUser) throw new Error('Unauthenticated');

    try {
      // Update ticket status
      const { error } = await supabaseAdmin
        .from('support_tickets')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      // Log status changes
      await supabaseAdmin
        .from('support_ticket_status_logs')
        .insert({
          ticket_id: ticketId,
          old_status: oldStatus,
          new_status: newStatus,
          changed_by: activeUser.id
        });

      // Send status change notification to ticket creator
      const { data: ticketData } = await supabaseAdmin
        .from('support_tickets')
        .select('user_id, ticket_number')
        .eq('id', ticketId)
        .single();
      if (ticketData) {
        await supabaseAdmin
          .from('support_notifications')
          .insert({
            user_id: ticketData.user_id,
            ticket_id: ticketId,
            title: `Ticket Status Changed (${ticketData.ticket_number})`,
            message: `Your support request status has been updated from ${oldStatus} to ${newStatus}.`
          });
      }
    } catch (err) {
      console.warn('Failed to update status on Supabase. Falling back to local cache:', err);
    }

    // Local DB Cache Update
    const t = mockDb.supportTickets.find(x => x.id === ticketId);
    if (t) {
      t.status = newStatus;
      t.updatedAt = new Date().toISOString();

      mockDb.supportTicketStatusLogs.push({
        id: 'log-' + Math.random().toString(36).substring(2, 9),
        ticketId,
        oldStatus,
        newStatus,
        changedBy: activeUser.id,
        changedAt: new Date().toISOString()
      });

      mockDb.supportNotifications.push({
        id: 'notif-' + Math.random().toString(36).substring(2, 9),
        userId: t.userId,
        ticketId,
        title: `Ticket Status Changed (${t.ticketNumber})`,
        message: `Your support request status has been updated from ${oldStatus} to ${newStatus}.`,
        isRead: false,
        createdAt: new Date().toISOString()
      });

      mockDb.saveAll();
    }
  },

  async fetchTicketMessages(ticketId: string): Promise<SupportTicketMessage[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('support_ticket_messages')
        .select('*, senderDetails:users(*)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        const mapped = data.map((m: any) => ({
          id: m.id,
          ticketId: m.ticket_id,
          senderId: m.sender_id,
          senderRole: m.sender_role,
          message: m.message,
          attachmentUrl: m.attachment_url,
          createdAt: m.created_at,
          senderDetails: m.senderDetails ? {
            firstName: m.senderDetails.first_name,
            lastName: m.senderDetails.last_name,
            avatarUrl: m.senderDetails.avatar_url
          } : null
        }));

        // Cache message locally
        mockDb.supportTicketMessages = [
          ...mockDb.supportTicketMessages.filter(msg => msg.ticketId !== ticketId),
          ...mapped
        ];
        mockDb.saveAll();
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch ticket messages from Supabase:', err);
    }

    // Local mock DB lookup
    return mockDb.supportTicketMessages
      .filter(m => m.ticketId === ticketId)
      .map(m => {
        const sender = mockDb.users.find(u => u.id === m.senderId);
        return {
          ...m,
          senderDetails: sender ? {
            firstName: sender.firstName,
            lastName: sender.lastName,
            avatarUrl: sender.avatarUrl
          } : null
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async sendTicketMessage(ticketId: string, message: string, attachmentUrl?: string): Promise<void> {
    const activeUser = getActiveUser();
    if (!activeUser) throw new Error('Unauthenticated');

    try {
      const { error } = await supabaseAdmin
        .from('support_ticket_messages')
        .insert({
          ticket_id: ticketId,
          sender_id: activeUser.id,
          sender_role: activeUser.role,
          message,
          attachment_url: attachmentUrl || null
        });

      if (error) throw error;

      // Update support ticket update time
      await supabaseAdmin
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      // Trigger notification dispatch
      const { data: ticketData } = await supabaseAdmin
        .from('support_tickets')
        .select('user_id, assigned_to, ticket_number')
        .eq('id', ticketId)
        .single();

      if (ticketData) {
        // If message is not from owner, notify owner. If from owner, notify the assigned agent/Super Admin
        const targetUserId = ticketData.user_id === activeUser.id 
          ? (ticketData.assigned_to || '00000000-0000-0000-0000-000000000000') // Super Admin fallback
          : ticketData.user_id;

        if (targetUserId && targetUserId !== '00000000-0000-0000-0000-000000000000') {
          await supabaseAdmin
            .from('support_notifications')
            .insert({
              user_id: targetUserId,
              ticket_id: ticketId,
              title: `New Reply on Ticket ${ticketData.ticket_number}`,
              message: `${activeUser.role === 'SUPER_ADMIN' ? 'Support Helpdesk' : 'User'} replied: "${message.substring(0, 40)}..."`
            });
        } else if (ticketData.user_id === activeUser.id) {
          // Notify all Super Admins
          const { data: superAdmins } = await supabaseAdmin
            .from('users')
            .select('id')
            .eq('role', 'SUPER_ADMIN');
          if (superAdmins && superAdmins.length > 0) {
            const notifs = superAdmins.map((admin: any) => ({
              user_id: admin.id,
              ticket_id: ticketId,
              title: `New Reply on Ticket ${ticketData.ticket_number}`,
              message: `User replied: "${message.substring(0, 40)}..."`
            }));
            await supabaseAdmin.from('support_notifications').insert(notifs);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to insert ticket message on Supabase. Saving locally:', err);
    }

    // Local DB Cache Update
    const mockMsgId = 'msg-' + Math.random().toString(36).substring(2, 9);
    const newMsg: SupportTicketMessage = {
      id: mockMsgId,
      ticketId,
      senderId: activeUser.id,
      senderRole: activeUser.role,
      message,
      attachmentUrl,
      createdAt: new Date().toISOString()
    };
    mockDb.supportTicketMessages.push(newMsg);

    const t = mockDb.supportTickets.find(x => x.id === ticketId);
    if (t) {
      t.updatedAt = new Date().toISOString();

      if (t.userId === activeUser.id) {
        if (t.assignedTo) {
          mockDb.supportNotifications.push({
            id: 'notif-' + Math.random().toString(36).substring(2, 9),
            userId: t.assignedTo,
            ticketId,
            title: `New Reply on Ticket ${t.ticketNumber}`,
            message: `User replied: "${message.substring(0, 40)}..."`,
            isRead: false,
            createdAt: new Date().toISOString()
          });
        } else {
          const superAdmins = mockDb.users.filter(u => u.role === 'SUPER_ADMIN');
          superAdmins.forEach(admin => {
            mockDb.supportNotifications.push({
              id: 'notif-' + Math.random().toString(36).substring(2, 9),
              userId: admin.id,
              ticketId,
              title: `New Reply on Ticket ${t.ticketNumber}`,
              message: `User replied: "${message.substring(0, 40)}..."`,
              isRead: false,
              createdAt: new Date().toISOString()
            });
          });
        }
      } else {
        // From Super Admin or other support agent -> notify ticket owner
        mockDb.supportNotifications.push({
          id: 'notif-' + Math.random().toString(36).substring(2, 9),
          userId: t.userId,
          ticketId,
          title: `New Reply on Ticket ${t.ticketNumber}`,
          message: `Support Helpdesk replied: "${message.substring(0, 40)}..."`,
          isRead: false,
          createdAt: new Date().toISOString()
        });
      }
    }
    mockDb.saveAll();
  },

  async assignTicket(ticketId: string, assignedToUserId: string | null): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('support_tickets')
        .update({ assigned_to: assignedToUserId, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (err) {
      console.warn('Failed to assign ticket on Supabase:', err);
    }

    const t = mockDb.supportTickets.find(x => x.id === ticketId);
    if (t) {
      t.assignedTo = assignedToUserId;
      t.updatedAt = new Date().toISOString();
      mockDb.saveAll();
    }
  },

  async fetchSupportNotifications(): Promise<SupportNotification[]> {
    const activeUser = getActiveUser();
    if (!activeUser) return [];

    try {
      const { data, error } = await supabaseAdmin
        .from('support_notifications')
        .select('*')
        .eq('user_id', activeUser.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) {
        const mapped = data.map((n: any) => ({
          id: n.id,
          userId: n.user_id,
          ticketId: n.ticket_id,
          title: n.title,
          message: n.message,
          isRead: n.is_read,
          createdAt: n.created_at
        }));
        
        mockDb.supportNotifications = mapped;
        mockDb.saveAll();
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch support notifications from Supabase:', err);
    }

    return mockDb.supportNotifications.filter(n => n.userId === activeUser.id && !n.isRead);
  },

  async markSupportNotificationAsRead(notificationId: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('support_notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) throw error;
    } catch (err) {
      console.warn('Failed to mark notification read on Supabase:', err);
    }

    const n = mockDb.supportNotifications.find(x => x.id === notificationId);
    if (n) {
      n.isRead = true;
      mockDb.saveAll();
    }
  },

  async fetchBugReports(schoolId: string): Promise<BugReport[]> {
    const activeUser = getActiveUser();
    if (!activeUser) return [];

    try {
      let query = supabaseAdmin
        .from('bug_reports')
        .select('*, userDetails:users(*), schoolDetails:schools(name)');

      if (activeUser.role === 'SUPER_ADMIN') {
        // Fetch all bug reports globally
      } else {
        query = query.eq('user_id', activeUser.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      if (data) {
        const mapped = data.map((b: any) => ({
          id: b.id,
          schoolId: b.school_id,
          userId: b.user_id,
          pageUrl: b.page_url,
          bugTitle: b.bug_title,
          description: b.description,
          screenshotUrl: b.screenshot_url,
          status: b.status,
          createdAt: b.created_at,
          userDetails: b.userDetails ? {
            firstName: b.userDetails.first_name,
            lastName: b.userDetails.last_name,
            email: b.userDetails.email
          } : null,
          schoolName: b.schoolDetails?.name || undefined
        }));

        mockDb.bugReports = mapped;
        mockDb.saveAll();
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch bug reports from Supabase. Falling back to local cache:', err);
    }

    // Local DB Cache Fetch
    let localList = [...mockDb.bugReports];
    if (activeUser.role === 'SUPER_ADMIN') {
      // return all
    } else {
      localList = localList.filter(b => b.userId === activeUser.id);
    }

    return localList.map(b => {
      const user = mockDb.users.find(u => u.id === b.userId);
      const school = mockDb.schools.find(s => s.id === b.schoolId);
      return {
        ...b,
        userDetails: user ? {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        } : null,
        schoolName: school?.name || undefined
      };
    });
  },

  async createBugReport(
    schoolId: string,
    pageUrl: string,
    bugTitle: string,
    description: string,
    screenshotUrl?: string
  ): Promise<void> {
    const activeUser = getActiveUser();
    if (!activeUser) throw new Error('Unauthenticated');

    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validSchoolId = isUUID(schoolId) ? schoolId : null;

    try {
      const { error, data } = await supabaseAdmin
        .from('bug_reports')
        .insert({
          school_id: validSchoolId,
          user_id: activeUser.id,
          page_url: pageUrl,
          bug_title: bugTitle,
          description,
          screenshot_url: screenshotUrl || null,
          status: 'NEW'
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        const schoolDetails = mockDb.schools.find(s => s.id === validSchoolId);
        mockDb.bugReports.unshift({
          id: data.id,
          schoolId: data.school_id,
          userId: data.user_id,
          pageUrl: data.page_url,
          bugTitle: data.bug_title,
          description: data.description,
          screenshotUrl: data.screenshot_url,
          status: data.status,
          createdAt: data.created_at,
          schoolName: schoolDetails?.name || undefined
        });
        mockDb.saveAll();
        return;
      }
    } catch (err) {
      console.warn('Failed to create bug report on Supabase:', err);
    }

    // Local DB Cache Fallback
    const mockId = 'bug-' + Math.random().toString(36).substring(2, 9);
    const schoolDetails = mockDb.schools.find(s => s.id === validSchoolId);
    mockDb.bugReports.unshift({
      id: mockId,
      schoolId: validSchoolId || undefined,
      userId: activeUser.id,
      pageUrl,
      bugTitle,
      description,
      screenshotUrl,
      status: 'NEW',
      createdAt: new Date().toISOString(),
      schoolName: schoolDetails?.name || undefined
    });
    mockDb.saveAll();
  },

  async uploadSupportAttachment(schoolId: string, file: File): Promise<string> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validSchoolId = isUUID(schoolId) ? schoolId : 'global';

    await this.ensureBrandingBucketsExist();

    const extension = file.name.split('.').pop() || 'png';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
    const filePath = `support-attachments/${validSchoolId}/${uniqueName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('school-assets')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Failed to upload support attachment: ' + uploadError.message);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('school-assets')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  async fetchInternalNotes(ticketId: string): Promise<SupportInternalNote[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('support_internal_notes')
        .select('*, senderDetails:users(*)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data) {
        const mapped: SupportInternalNote[] = data.map((n: any) => ({
          id: n.id,
          ticketId: n.ticket_id,
          senderId: n.sender_id,
          noteText: n.note_text,
          createdAt: n.created_at,
          senderDetails: n.senderDetails ? {
            firstName: n.senderDetails.first_name,
            lastName: n.senderDetails.last_name,
            avatarUrl: n.senderDetails.avatar_url
          } : null
        }));

        mockDb.supportInternalNotes = [
          ...mockDb.supportInternalNotes.filter(x => x.ticketId !== ticketId),
          ...mapped
        ];
        mockDb.saveAll();
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch internal notes from Supabase:', err);
    }

    return mockDb.supportInternalNotes
      .filter(n => n.ticketId === ticketId)
      .map(n => {
        const sender = mockDb.users.find(u => u.id === n.senderId);
        return {
          ...n,
          senderDetails: sender ? {
            firstName: sender.firstName,
            lastName: sender.lastName,
            avatarUrl: sender.avatarUrl
          } : null
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  },

  async createInternalNote(ticketId: string, noteText: string): Promise<void> {
    const activeUser = getActiveUser();
    if (!activeUser) throw new Error('Unauthenticated');

    try {
      const { error, data } = await supabaseAdmin
        .from('support_internal_notes')
        .insert({
          ticket_id: ticketId,
          sender_id: activeUser.id,
          note_text: noteText
        })
        .select()
        .single();

      if (error) throw error;
      if (data) {
        mockDb.supportInternalNotes.push({
          id: data.id,
          ticketId: data.ticket_id,
          senderId: data.sender_id,
          noteText: data.note_text,
          createdAt: data.created_at
        });
        mockDb.saveAll();
        return;
      }
    } catch (err) {
      console.warn('Failed to insert internal note in Supabase:', err);
    }

    const mockId = 'note-' + Math.random().toString(36).substring(2, 9);
    mockDb.supportInternalNotes.push({
      id: mockId,
      ticketId,
      senderId: activeUser.id,
      noteText,
      createdAt: new Date().toISOString()
    });
    mockDb.saveAll();
  },

  async updateSupportTicketPriority(ticketId: string, newPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('support_tickets')
        .update({ priority: newPriority, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;
    } catch (err) {
      console.warn('Failed to update ticket priority in Supabase:', err);
    }

    const t = mockDb.supportTickets.find(x => x.id === ticketId);
    if (t) {
      t.priority = newPriority;
      t.updatedAt = new Date().toISOString();
      mockDb.saveAll();
    }
  },

  async fetchTicketStatusLogs(ticketId: string): Promise<SupportTicketStatusLog[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('support_ticket_status_logs')
        .select('*, actorDetails:users(*)')
        .eq('ticket_id', ticketId)
        .order('changed_at', { ascending: true });

      if (error) throw error;
      if (data) {
        const mapped: SupportTicketStatusLog[] = data.map((l: any) => ({
          id: l.id,
          ticketId: l.ticket_id,
          oldStatus: l.old_status,
          newStatus: l.new_status,
          changedBy: l.changed_by,
          changedAt: l.changed_at,
          actorDetails: l.actorDetails ? {
            firstName: l.actorDetails.first_name,
            lastName: l.actorDetails.last_name,
            role: l.actorDetails.role === 'ADMIN' ? 'School Admin' : l.actorDetails.role === 'SUPER_ADMIN' ? 'Super Admin' : l.actorDetails.role
          } : null
        }));

        mockDb.supportTicketStatusLogs = [
          ...mockDb.supportTicketStatusLogs.filter(x => x.ticketId !== ticketId),
          ...mapped
        ];
        mockDb.saveAll();
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch status logs from Supabase:', err);
    }

    return mockDb.supportTicketStatusLogs
      .filter(l => l.ticketId === ticketId)
      .map(l => {
        const actor = mockDb.users.find(u => u.id === l.changedBy);
        return {
          ...l,
          actorDetails: actor ? {
            firstName: actor.firstName,
            lastName: actor.lastName,
            role: actor.role === 'ADMIN' ? 'School Admin' : actor.role === 'SUPER_ADMIN' ? 'Super Admin' : actor.role
          } : null
        };
      })
      .sort((a, b) => new Date(a.changedAt).getTime() - new Date(b.changedAt).getTime());
  },

  async fetchPayrollRecords(schoolId: string): Promise<PayrollRecord[]> {
    const { data, error } = await supabaseAdmin
      .from('payroll_records')
      .select('*')
      .eq('school_id', schoolId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return mockDb.payrollRecords.filter(r => r.schoolId === schoolId && !r.deletedAt);
    }

    const mapped: PayrollRecord[] = data.map((r: any) => ({
      id: r.id,
      schoolId: r.school_id,
      employeeType: r.employee_type as any,
      employeeRole: r.employee_role,
      employeeName: r.employee_name,
      employeeIdNumber: r.employee_id_number,
      employeePhone: r.employee_phone,
      userId: r.user_id,
      payoutMonth: r.payout_month,
      baseSalary: Number(r.base_salary) || 0,
      allowances: Number(r.allowances) || 0,
      deductions: Number(r.deductions) || 0,
      netSalary: Number(r.net_salary) || 0,
      payoutStatus: r.payout_status as any,
      payoutDate: r.payout_date,
      paidByUserId: r.paid_by_user_id,
      transactionReference: r.transaction_reference,
      notes: r.notes,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      deletedAt: r.deleted_at,
      currencyCode: r.currency_code || 'USD',
      currencySymbol: r.currency_symbol || '$'
    }));

    // cache locally
    mapped.forEach(pr => {
      const idx = mockDb.payrollRecords.findIndex(p => p.id === pr.id);
      if (idx === -1) mockDb.payrollRecords.push(pr);
      else mockDb.payrollRecords[idx] = pr;
    });
    mockDb.payrollRecords = mockDb.payrollRecords.filter(pr => pr.schoolId !== schoolId || !pr.deletedAt || mapped.some(m => m.id === pr.id));
    mockDb.saveAll();

    return mapped;
  },

  async createPayrollRecord(
    adminId: string,
    schoolId: string,
    record: {
      employeeType: 'TEACHER' | 'STAFF';
      employeeRole: string;
      employeeName: string;
      employeeIdNumber?: string | null;
      employeePhone?: string | null;
      userId?: string | null;
      payoutMonth: string;
      baseSalary: number;
      allowances: number;
      deductions: number;
      notes?: string | null;
    }
  ): Promise<PayrollRecord> {
    // Role check
    const operator = mockDb.users.find(u => u.id === adminId);
    const { data: dbUser } = await supabaseAdmin.from('users').select('role').eq('id', adminId).maybeSingle();
    const currentRole = dbUser?.role || operator?.role;
    const normalizedRole = normalizeRole(currentRole || '');
    if (normalizedRole !== 'FINANCE_ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      throw new Error('Only Finance Admin is authorized to perform salary disbursement.');
    }

    const netSalary = Number(record.baseSalary || 0) + Number(record.allowances || 0) - Number(record.deductions || 0);
    const school = mockDb.schools.find(s => s.id === schoolId);
    const currencyCode = school?.currencyCode || 'USD';
    const currencySymbol = school?.currencySymbol || '$';

    const { data: dbRecord, error } = await supabaseAdmin.from('payroll_records').insert({
      school_id: schoolId,
      employee_type: record.employeeType,
      employee_role: record.employeeRole,
      employee_name: record.employeeName,
      employee_id_number: record.employeeIdNumber || null,
      employee_phone: record.employeePhone || null,
      user_id: record.userId || null,
      payout_month: record.payoutMonth,
      base_salary: record.baseSalary,
      allowances: record.allowances,
      deductions: record.deductions,
      net_salary: netSalary,
      payout_status: 'PENDING',
      notes: record.notes || null,
      currency_code: currencyCode,
      currency_symbol: currencySymbol
    }).select('*').single();

    if (error || !dbRecord) {
      const localRecord: PayrollRecord = {
        id: 'pr-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        employeeType: record.employeeType,
        employeeRole: record.employeeRole,
        employeeName: record.employeeName,
        employeeIdNumber: record.employeeIdNumber || null,
        employeePhone: record.employeePhone || null,
        userId: record.userId || null,
        payoutMonth: record.payoutMonth,
        baseSalary: record.baseSalary,
        allowances: record.allowances,
        deductions: record.deductions,
        netSalary: netSalary,
        payoutStatus: 'PENDING',
        notes: record.notes || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currencyCode,
        currencySymbol
      };
      mockDb.payrollRecords.push(localRecord);
      mockDb.saveAll();
      mockDb.addLog(adminId, 'SALARY_CREATED', { employeeName: record.employeeName, payoutMonth: record.payoutMonth, netSalary });
      await this.writeAuditLog(adminId, null, schoolId, 'finance', 'SALARY_CREATED', localRecord.id, null, localRecord);
      return localRecord;
    }

    const newRecord: PayrollRecord = {
      id: dbRecord.id,
      schoolId: dbRecord.school_id,
      employeeType: dbRecord.employee_type as any,
      employeeRole: dbRecord.employee_role,
      employeeName: dbRecord.employee_name,
      employeeIdNumber: dbRecord.employee_id_number,
      employeePhone: dbRecord.employee_phone,
      userId: dbRecord.user_id,
      payoutMonth: dbRecord.payout_month,
      baseSalary: Number(dbRecord.base_salary) || 0,
      allowances: Number(dbRecord.allowances) || 0,
      deductions: Number(dbRecord.deductions) || 0,
      netSalary: Number(dbRecord.net_salary) || 0,
      payoutStatus: dbRecord.payout_status as any,
      notes: dbRecord.notes,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.updated_at,
      currencyCode: dbRecord.currency_code || currencyCode,
      currencySymbol: dbRecord.currency_symbol || currencySymbol
    };

    mockDb.payrollRecords.push(newRecord);
    mockDb.saveAll();
    mockDb.addLog(adminId, 'SALARY_CREATED', { employeeName: record.employeeName, payoutMonth: record.payoutMonth, netSalary });
    await this.writeAuditLog(adminId, null, schoolId, 'finance', 'SALARY_CREATED', newRecord.id, null, newRecord);
    return newRecord;
  },

  async updatePayrollStatus(
    adminId: string,
    schoolId: string,
    recordId: string,
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' | 'REVERSED',
    notes?: string | null,
    transactionReference?: string | null
  ): Promise<PayrollRecord> {
    // Role check
    const operator = mockDb.users.find(u => u.id === adminId);
    const { data: dbUser } = await supabaseAdmin.from('users').select('role').eq('id', adminId).maybeSingle();
    const currentRole = dbUser?.role || operator?.role;
    const normalizedRole = normalizeRole(currentRole || '');
    if (normalizedRole !== 'FINANCE_ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      throw new Error('Only Finance Admin is authorized to perform salary disbursement.');
    }

    const localRecord = mockDb.payrollRecords.find(r => r.id === recordId);
    const oldRecordCopy = localRecord ? { ...localRecord } : null;

    let txRef = transactionReference;
    if (status === 'PAID' && !txRef) {
      txRef = 'TXS' + Math.random().toString(36).substr(2, 8).toUpperCase();
    }

    const { data: dbRecord, error } = await supabaseAdmin
      .from('payroll_records')
      .update({
        payout_status: status,
        notes: notes || undefined,
        transaction_reference: txRef || undefined,
        payout_date: status === 'PAID' ? new Date().toISOString() : undefined,
        paid_by_user_id: status === 'PAID' ? adminId : undefined,
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId)
      .select('*')
      .maybeSingle();

    let actionType = 'SALARY_UPDATED';
    if (status === 'APPROVED') actionType = 'SALARY_APPROVED';
    else if (status === 'PAID') actionType = 'SALARY_DISBURSED';
    else if (status === 'CANCELLED') actionType = 'SALARY_CANCELLED';
    else if (status === 'REVERSED') actionType = 'SALARY_REVERSED';

    if (error || !dbRecord) {
      if (!localRecord) throw new Error('Payroll record not found.');
      localRecord.payoutStatus = status;
      if (notes !== undefined) localRecord.notes = notes;
      if (txRef !== undefined) localRecord.transactionReference = txRef;
      if (status === 'PAID') {
        localRecord.payoutDate = new Date().toISOString();
        localRecord.paidByUserId = adminId;
      }
      localRecord.updatedAt = new Date().toISOString();
      mockDb.saveAll();
      mockDb.addLog(adminId, actionType, { recordId, status });
      await this.writeAuditLog(adminId, null, schoolId, 'finance', actionType, recordId, oldRecordCopy, localRecord);
      return localRecord;
    }

    const updatedRecord: PayrollRecord = {
      id: dbRecord.id,
      schoolId: dbRecord.school_id,
      employeeType: dbRecord.employee_type as any,
      employeeRole: dbRecord.employee_role,
      employeeName: dbRecord.employee_name,
      employeeIdNumber: dbRecord.employee_id_number,
      employeePhone: dbRecord.employee_phone,
      userId: dbRecord.user_id,
      payoutMonth: dbRecord.payout_month,
      baseSalary: Number(dbRecord.base_salary) || 0,
      allowances: Number(dbRecord.allowances) || 0,
      deductions: Number(dbRecord.deductions) || 0,
      netSalary: Number(dbRecord.net_salary) || 0,
      payoutStatus: dbRecord.payout_status as any,
      payoutDate: dbRecord.payout_date,
      paidByUserId: dbRecord.paid_by_user_id,
      transactionReference: dbRecord.transaction_reference,
      notes: dbRecord.notes,
      createdAt: dbRecord.created_at,
      updatedAt: dbRecord.updated_at,
      currencyCode: dbRecord.currency_code,
      currencySymbol: dbRecord.currency_symbol
    };

    const idx = mockDb.payrollRecords.findIndex(r => r.id === recordId);
    if (idx !== -1) mockDb.payrollRecords[idx] = updatedRecord;
    mockDb.saveAll();

    mockDb.addLog(adminId, actionType, { recordId, status });
    await this.writeAuditLog(adminId, null, schoolId, 'finance', actionType, recordId, oldRecordCopy, updatedRecord);
    return updatedRecord;
  },

  async deletePayrollRecord(adminId: string, schoolId: string, recordId: string): Promise<void> {
    // Role check
    const operator = mockDb.users.find(u => u.id === adminId);
    const { data: dbUser } = await supabaseAdmin.from('users').select('role').eq('id', adminId).maybeSingle();
    const currentRole = dbUser?.role || operator?.role;
    const normalizedRole = normalizeRole(currentRole || '');
    if (normalizedRole !== 'FINANCE_ADMIN' && normalizedRole !== 'SUPER_ADMIN') {
      throw new Error('Only Finance Admin is authorized to perform salary disbursement.');
    }

    const localRecord = mockDb.payrollRecords.find(r => r.id === recordId);
    const oldRecordCopy = localRecord ? { ...localRecord } : null;

    const { error } = await supabaseAdmin
      .from('payroll_records')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', recordId);

    if (error) {
      console.warn('Failed to soft delete in Supabase, performing locally:', error.message);
    }

    if (localRecord) {
      localRecord.deletedAt = new Date().toISOString();
      localRecord.updatedAt = new Date().toISOString();
      mockDb.payrollRecords = mockDb.payrollRecords.filter(r => r.id !== recordId);
      mockDb.saveAll();
    }

    mockDb.addLog(adminId, 'SALARY_DELETED', { recordId });
    await this.writeAuditLog(adminId, null, schoolId, 'finance', 'SALARY_DELETED', recordId, oldRecordCopy, null);
  },

  async uploadPaymentAsset(bucket: string, folder: string, filename: string, file: File): Promise<string> {
    try {
      const extension = file.name.split('.').pop() || 'png';
      const filePath = `${folder}/${Math.random().toString(36).substring(2, 9)}_${filename}.${extension}`;
      
      await supabaseAdmin.storage.createBucket(bucket, { public: true }).catch(() => {});
      
      const { error: uploadError } = await supabaseAdmin.storage
        .from(bucket)
        .upload(filePath, file, { cacheControl: '0', upsert: true });
        
      if (!uploadError) {
        const { data: { publicUrl } } = supabaseAdmin.storage
          .from(bucket)
          .getPublicUrl(filePath);
        return publicUrl;
      }
    } catch (e) {
      console.warn('Supabase storage upload failed, falling back to local base64:', e);
    }
    return readFileAsBase64(file);
  },

  async fetchSchoolPaymentSettings(schoolId: string, requesterRole: string): Promise<SchoolPaymentSettings | null> {
    let settings: SchoolPaymentSettings | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('school_payment_settings')
        .select('*')
        .eq('school_id', schoolId)
        .maybeSingle();
      if (data && !error) {
        settings = {
          id: data.id,
          schoolId: data.school_id,
          qrCodeUrl: data.qr_code_url,
          upiId: data.upi_id,
          accountHolderName: data.account_holder_name,
          bankName: data.bank_name,
          accountNumber: data.account_number,
          ifscCode: data.ifsc_code,
          branchName: data.branch_name,
          swiftCode: data.swift_code,
          qrPaymentEnabled: data.qr_payment_enabled,
          bankTransferEnabled: data.bank_transfer_enabled,
          showQrToParents: data.show_qr_to_parents,
          showBankToParents: data.show_bank_to_parents,
          enableUtrUpload: data.enable_utr_upload,
          autoRemindUnpaid: data.auto_remind_unpaid,
          paymentInstructions: data.payment_instructions
        };
      }
    } catch (e) {
      console.warn('Failed to query school_payment_settings from Supabase:', e);
    }

    if (!settings) {
      const mockSettings = mockDb.schoolPaymentSettings.find(s => s.schoolId === schoolId);
      if (mockSettings) {
        settings = { ...mockSettings };
      }
    }

    if (!settings) return null;

    let decryptedAcc = '';
    if (settings.accountNumber) {
      decryptedAcc = decryptAccountNumberSync(settings.accountNumber);
    }

    if (requesterRole === 'SUPER_ADMIN') {
      settings.accountNumber = decryptedAcc ? '••••••••' + decryptedAcc.slice(-4) : '';
      settings.ifscCode = '••••••••';
      settings.upiId = '••••••••';
    } else {
      settings.accountNumber = decryptedAcc;
    }

    return settings;
  },

  async saveSchoolPaymentSettings(
    adminId: string, 
    schoolId: string, 
    settings: Partial<SchoolPaymentSettings>,
    qrFile?: File | null
  ): Promise<SchoolPaymentSettings> {
    const operator = mockDb.users.find(u => u.id === adminId);
    const { data: dbUser } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).maybeSingle();
    const role = dbUser?.role || operator?.role || '';
    const userSchoolId = dbUser?.school_id || operator?.schoolId || '';

    if (role !== 'ADMIN' && role !== 'FINANCE_ADMIN') {
      throw new Error('Unauthorized: Only School Admin and Finance Admin can edit school payment settings.');
    }
    if (userSchoolId !== schoolId) {
      throw new Error('Unauthorized: You can only edit payment settings for your own school.');
    }

    let qrUrl = settings.qrCodeUrl;
    if (qrFile) {
      qrUrl = await this.uploadPaymentAsset('school-assets', `school-${schoolId}/payments`, 'qr_code', qrFile);
    }

    const encryptedAccountNumber = settings.accountNumber ? encryptAccountNumberSync(settings.accountNumber) : undefined;

    const payload = {
      school_id: schoolId,
      qr_code_url: qrUrl,
      upi_id: settings.upiId,
      account_holder_name: settings.accountHolderName,
      bank_name: settings.bankName,
      account_number: encryptedAccountNumber,
      ifsc_code: settings.ifscCode,
      branch_name: settings.branchName,
      swift_code: settings.swiftCode,
      qr_payment_enabled: settings.qrPaymentEnabled,
      bank_transfer_enabled: settings.bankTransferEnabled,
      show_qr_to_parents: settings.showQrToParents,
      show_bank_to_parents: settings.showBankToParents,
      enable_utr_upload: settings.enableUtrUpload,
      auto_remind_unpaid: settings.autoRemindUnpaid,
      payment_instructions: settings.paymentInstructions,
      updated_at: new Date().toISOString()
    };

    Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

    let savedRecord: SchoolPaymentSettings | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('school_payment_settings')
        .upsert(payload, { onConflict: 'school_id' })
        .select('*')
        .single();
      if (data && !error) {
        savedRecord = {
          id: data.id,
          schoolId: data.school_id,
          qrCodeUrl: data.qr_code_url,
          upiId: data.upi_id,
          accountHolderName: data.account_holder_name,
          bankName: data.bank_name,
          accountNumber: data.account_number,
          ifscCode: data.ifsc_code,
          branchName: data.branch_name,
          swiftCode: data.swift_code,
          qrPaymentEnabled: data.qr_payment_enabled,
          bankTransferEnabled: data.bank_transfer_enabled,
          showQrToParents: data.show_qr_to_parents,
          showBankToParents: data.show_bank_to_parents,
          enableUtrUpload: data.enable_utr_upload,
          autoRemindUnpaid: data.auto_remind_unpaid,
          paymentInstructions: data.payment_instructions
        };
      }
    } catch (e) {
      console.warn('Failed to save settings in Supabase:', e);
    }

    if (!savedRecord) {
      const idx = mockDb.schoolPaymentSettings.findIndex(s => s.schoolId === schoolId);
      const localRecord: SchoolPaymentSettings = {
        id: idx !== -1 ? mockDb.schoolPaymentSettings[idx].id : 'sps-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        qrCodeUrl: qrUrl || null,
        upiId: settings.upiId || null,
        accountHolderName: settings.accountHolderName || null,
        bankName: settings.bankName || null,
        accountNumber: encryptedAccountNumber || null,
        ifscCode: settings.ifscCode || null,
        branchName: settings.branchName || null,
        swiftCode: settings.swiftCode || null,
        qrPaymentEnabled: settings.qrPaymentEnabled ?? true,
        bankTransferEnabled: settings.bankTransferEnabled ?? true,
        showQrToParents: settings.showQrToParents ?? true,
        showBankToParents: settings.showBankToParents ?? true,
        enableUtrUpload: settings.enableUtrUpload ?? true,
        autoRemindUnpaid: settings.autoRemindUnpaid ?? false,
        paymentInstructions: settings.paymentInstructions || null
      };

      if (idx !== -1) {
        mockDb.schoolPaymentSettings[idx] = localRecord;
      } else {
        mockDb.schoolPaymentSettings.push(localRecord);
      }
      mockDb.saveAll();
      savedRecord = localRecord;
    }

    mockDb.addLog(adminId, 'SCHOOL_PAYMENT_SETTINGS_UPDATED', { schoolId });
    return savedRecord;
  },

  async fetchFacultyPaymentSettings(userId: string, requesterId: string, requesterRole: string, isDisbursement = false): Promise<FacultyPaymentSettings | null> {
    if (requesterRole === 'SUPER_ADMIN') {
      throw new Error('Access Denied: Super Admin cannot access faculty banking details.');
    }
    if (requesterRole === 'TEACHER' && requesterId !== userId) {
      throw new Error('Access Denied: You can only access your own banking details.');
    }
    if (requesterRole === 'PARENT' || requesterRole === 'STUDENT') {
      throw new Error('Access Denied: Parents and students cannot view faculty banking details.');
    }

    let settings: FacultyPaymentSettings | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('faculty_payment_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (data && !error) {
        settings = {
          id: data.id,
          userId: data.user_id,
          qrCodeUrl: data.qr_code_url,
          upiId: data.upi_id,
          bankName: data.bank_name,
          accountNumber: data.account_number,
          ifscCode: data.ifsc_code,
          branchName: data.branch_name
        };
      }
    } catch (e) {
      console.warn('Failed to fetch faculty settings from Supabase:', e);
    }

    if (!settings) {
      const mockSettings = mockDb.facultyPaymentSettings.find(f => f.userId === userId);
      if (mockSettings) {
        settings = { ...mockSettings };
      }
    }

    if (!settings) return null;

    let decrypted = '';
    if (settings.accountNumber) {
      decrypted = decryptAccountNumberSync(settings.accountNumber);
    }

    if (requesterRole === 'FINANCE_ADMIN' && !isDisbursement) {
      settings.accountNumber = decrypted ? '••••••••' + decrypted.slice(-4) : '';
      settings.ifscCode = '••••••••';
      settings.upiId = '••••••••';
    } else {
      settings.accountNumber = decrypted;
    }

    return settings;
  },

  async saveFacultyPaymentSettings(
    userId: string,
    settings: Partial<FacultyPaymentSettings>,
    qrFile?: File | null
  ): Promise<FacultyPaymentSettings> {
    let qrUrl = settings.qrCodeUrl;
    if (qrFile) {
      qrUrl = await this.uploadPaymentAsset('faculty-assets', `user-${userId}/payments`, 'qr_code', qrFile);
    }

    const encrypted = settings.accountNumber ? encryptAccountNumberSync(settings.accountNumber) : undefined;

    const payload = {
      user_id: userId,
      qr_code_url: qrUrl,
      upi_id: settings.upiId,
      bank_name: settings.bankName,
      account_number: encrypted,
      ifsc_code: settings.ifscCode,
      branch_name: settings.branchName,
      updated_at: new Date().toISOString()
    };

    Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

    let savedRecord: FacultyPaymentSettings | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('faculty_payment_settings')
        .upsert(payload, { onConflict: 'user_id' })
        .select('*')
        .single();
      if (data && !error) {
        savedRecord = {
          id: data.id,
          userId: data.user_id,
          qrCodeUrl: data.qr_code_url,
          upiId: data.upi_id,
          bankName: data.bank_name,
          accountNumber: data.account_number,
          ifscCode: data.ifsc_code,
          branchName: data.branch_name
        };
      }
    } catch (e) {
      console.warn('Failed to save faculty settings in Supabase:', e);
    }

    if (!savedRecord) {
      const idx = mockDb.facultyPaymentSettings.findIndex(f => f.userId === userId);
      const localRecord: FacultyPaymentSettings = {
        id: idx !== -1 ? mockDb.facultyPaymentSettings[idx].id : 'fps-' + Math.random().toString(36).substr(2, 9),
        userId,
        qrCodeUrl: qrUrl || null,
        upiId: settings.upiId || null,
        bankName: settings.bankName || null,
        accountNumber: encrypted || null,
        ifscCode: settings.ifscCode || null,
        branchName: settings.branchName || null
      };

      if (idx !== -1) {
        mockDb.facultyPaymentSettings[idx] = localRecord;
      } else {
        mockDb.facultyPaymentSettings.push(localRecord);
      }
      mockDb.saveAll();
      savedRecord = localRecord;
    }

    mockDb.addLog(userId, 'FACULTY_PAYMENT_SETTINGS_UPDATED', { userId });
    return savedRecord;
  },

  // ── PAYMENT AUDIT LOG ─────────────────────────────────────────────────

  async logPaymentAction(
    paymentId: string,
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'RE_UPLOADED',
    performedBy: string,
    details?: Record<string, any>
  ): Promise<void> {
    const now = new Date().toISOString();
    let resolvedUserId = performedBy;

    try {
      // 1. Check if performedBy exists directly in public.users
      const { data: userCheck } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', performedBy)
        .maybeSingle();

      if (!userCheck) {
        // 2. Check parents table for user_id
        const { data: parentCheck } = await supabaseAdmin
          .from('parents')
          .select('user_id')
          .eq('id', performedBy)
          .maybeSingle();
        
        if (parentCheck?.user_id) {
          resolvedUserId = parentCheck.user_id;
        } else {
          // 3. Check teachers table for user_id
          const { data: teacherCheck } = await supabaseAdmin
            .from('teachers')
            .select('user_id')
            .eq('id', performedBy)
            .maybeSingle();
            
          if (teacherCheck?.user_id) {
            resolvedUserId = teacherCheck.user_id;
          } else {
            // 4. Check students table for user_id
            const { data: studentCheck } = await supabaseAdmin
              .from('students')
              .select('user_id')
              .eq('id', performedBy)
              .maybeSingle();
              
            if (studentCheck?.user_id) {
              resolvedUserId = studentCheck.user_id;
            }
          }
        }
      }

      // Fallback: Check local mockDb cache if we couldn't resolve from database
      if (resolvedUserId === performedBy) {
        const localParent = mockDb.parents.find(p => p.id === performedBy);
        if (localParent) {
          resolvedUserId = localParent.userId;
        } else {
          const localTeacher = mockDb.teachers.find(t => t.id === performedBy);
          if (localTeacher) {
            resolvedUserId = localTeacher.userId;
          } else {
            const localStudent = mockDb.students.find(s => s.id === performedBy);
            if (localStudent) {
              resolvedUserId = localStudent.userId;
            }
          }
        }
      }

      // Validate that resolvedUserId exists in public.users, otherwise sync it from auth.users
      const { data: finalUserCheck } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('id', resolvedUserId)
        .maybeSingle();

      if (!finalUserCheck) {
        console.warn(`User profile for ID ${resolvedUserId} not found in public.users. Attempting auto-sync from auth.users...`);
        try {
          const { data: authUserRes } = await supabaseAdmin.auth.admin.getUserById(resolvedUserId);
          if (authUserRes?.user) {
            const authUser = authUserRes.user;
            const metadata = authUser.user_metadata || {};
            const email = authUser.email || '';
            const role = metadata.role || 'PARENT';
            const schoolId = metadata.school_id || 'school-1';
            
            const { error: insErr } = await supabaseAdmin.from('users').insert({
              id: resolvedUserId,
              email: email,
              role: role,
              first_name: metadata.first_name || 'User',
              last_name: metadata.last_name || '',
              phone: authUser.phone || '',
              school_id: schoolId,
              is_active: true
            });
            if (insErr) {
              console.error('Failed to auto-sync missing user profile to public.users:', insErr);
            } else {
              console.log(`Successfully auto-synced user ${resolvedUserId} to public.users.`);
            }
          } else {
            console.warn(`User ${resolvedUserId} not found in auth.users either.`);
          }
        } catch (syncErr) {
          console.error(`Error auto-syncing user ${resolvedUserId}:`, syncErr);
        }
      }
    } catch (resolveErr) {
      console.error('Error resolving performedBy user ID mapping:', resolveErr);
    }

    try {
      const { error } = await supabase.from('payment_audit_logs').insert({
        payment_id: paymentId,
        action,
        performed_by: resolvedUserId,
        performed_at: now,
        details: details ? JSON.stringify(details) : null,
      });
      if (error) {
        console.error('Database error inserting into payment_audit_logs:', error);
      }
    } catch (insertErr) {
      console.error('Exception inserting into payment_audit_logs:', insertErr);
    }
  },

  async submitFeePaymentProof(
    parentId: string,
    studentId: string,
    feeStructureId: string,
    method: string,
    utr: string,
    screenshotFile: File
  ): Promise<FeePayment> {
    // UTR uniqueness validation
    const dupLocal = mockDb.feePayments.find(p => p.utrNumber === utr && p.status !== 'REJECTED');
    if (dupLocal) throw new Error(`UTR "${utr}" has already been used for another fee payment.`);
    try {
      const { data: dupDb } = await supabase
        .from('fee_payments')
        .select('id')
        .eq('utr_number', utr)
        .neq('status', 'REJECTED')
        .maybeSingle();
      if (dupDb) throw new Error(`UTR "${utr}" has already been used for another fee payment.`);
    } catch (e: any) {
      if (e.message?.includes('UTR')) throw e;
      // Supabase unavailable — local check was already done above
    }
    const screenshotUrl = await this.uploadPaymentAsset(
      'payment-proofs', 
      `student-${studentId}/fees`, 
      `proof_${feeStructureId}`, 
      screenshotFile
    );

    const existingPayment = mockDb.feePayments.find(p => p.feeStructureId === feeStructureId && p.studentId === studentId);
    const isUUID = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const paymentId = (existingPayment?.id && isUUID(existingPayment.id))
      ? existingPayment.id
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
    
    const structure = mockDb.feeStructures.find(s => s.id === feeStructureId);
    const amount = structure?.amount || 0;

    const payload = {
      id: paymentId,
      fee_structure_id: feeStructureId,
      student_id: studentId,
      amount_paid: amount,
      payment_date: new Date().toISOString(),
      payment_method: method,
      transaction_id: utr,
      status: 'PENDING' as PaymentStatus,
      payment_screenshot_url: screenshotUrl,
      utr_number: utr,
      rejection_reason: null
    };

    let savedPayment: FeePayment | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('fee_payments')
        .upsert({
          id: payload.id,
          fee_structure_id: payload.fee_structure_id,
          student_id: payload.student_id,
          amount_paid: payload.amount_paid,
          payment_date: payload.payment_date,
          payment_method: payload.payment_method,
          transaction_id: payload.transaction_id,
          status: payload.status,
          payment_screenshot_url: payload.payment_screenshot_url,
          utr_number: payload.utr_number,
          rejection_reason: payload.rejection_reason
        })
        .select('*')
        .single();
      if (error) {
        console.error('Failed to upsert fee payment in Supabase:', error);
      } else if (data) {
        savedPayment = {
          id: data.id,
          feeStructureId: data.fee_structure_id,
          studentId: data.student_id,
          amountPaid: Number(data.amount_paid) || 0,
          paymentDate: data.payment_date,
          paymentMethod: data.payment_method,
          transactionId: data.transaction_id,
          status: data.status as any,
          createdAt: data.created_at || new Date().toISOString(),
          paymentScreenshotUrl: data.payment_screenshot_url,
          utrNumber: data.utr_number,
          rejectionReason: data.rejection_reason
        };
      }
    } catch (e) {
      console.warn('Failed to upsert fee payment in Supabase:', e);
    }

    if (!savedPayment) {
      const localPayment: FeePayment = {
        id: paymentId,
        feeStructureId,
        studentId,
        amountPaid: amount,
        paymentDate: new Date().toISOString(),
        paymentMethod: method,
        transactionId: utr,
        status: 'PENDING',
        createdAt: existingPayment?.createdAt || new Date().toISOString(),
        paymentScreenshotUrl: screenshotUrl,
        utrNumber: utr,
        rejectionReason: undefined
      };

      const idx = mockDb.feePayments.findIndex(p => p.id === paymentId);
      if (idx !== -1) {
        mockDb.feePayments[idx] = localPayment;
      } else {
        mockDb.feePayments.push(localPayment);
      }
      mockDb.saveAll();
      savedPayment = localPayment;
    }

    const isReUpload = existingPayment?.status === 'REJECTED';
    const auditAction = isReUpload ? 'FEE_PAYMENT_PROOF_RE_UPLOADED' : 'FEE_PAYMENT_PROOF_SUBMITTED';
    mockDb.addLog(parentId, auditAction, { studentId, feeStructureId, utr });
    await this.logPaymentAction(savedPayment.id, isReUpload ? 'RE_UPLOADED' : 'SUBMITTED', parentId, { studentId, feeStructureId, utr, method });
    return savedPayment;
  },

  async verifyFeePayment(
    adminId: string,
    paymentId: string,
    status: 'PAID' | 'REJECTED',
    rejectionReason?: string
  ): Promise<FeePayment> {
    const operator = mockDb.users.find(u => u.id === adminId);
    const { data: dbUser } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).maybeSingle();
    const role = dbUser?.role || operator?.role || '';

    if (role !== 'ADMIN' && role !== 'FINANCE_ADMIN' && role !== 'SUPER_ADMIN') {
      throw new Error('Unauthorized: Only Admin / Finance Admin is authorized to verify/approve payments.');
    }

    let savedPayment: FeePayment | null = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('fee_payments')
        .update({
          status: status,
          rejection_reason: status === 'REJECTED' ? (rejectionReason || 'Details mismatch') : null,
          payment_date: status === 'PAID' ? new Date().toISOString() : undefined
        })
        .eq('id', paymentId)
        .select('*')
        .single();
      if (data && !error) {
        savedPayment = {
          id: data.id,
          feeStructureId: data.fee_structure_id,
          studentId: data.student_id,
          amountPaid: Number(data.amount_paid) || 0,
          paymentDate: data.payment_date,
          paymentMethod: data.payment_method,
          transactionId: data.transaction_id,
          status: data.status as any,
          createdAt: data.created_at || new Date().toISOString(),
          paymentScreenshotUrl: data.payment_screenshot_url,
          utrNumber: data.utr_number,
          rejectionReason: data.rejection_reason
        };
      }
    } catch (e) {
      console.warn('Failed to update payment status in Supabase:', e);
    }

    if (!savedPayment) {
      const idx = mockDb.feePayments.findIndex(p => p.id === paymentId);
      if (idx === -1) {
        throw new Error('Fee payment record not found.');
      }
      const local = mockDb.feePayments[idx];
      local.status = status;
      if (status === 'REJECTED') {
        local.rejectionReason = rejectionReason || 'Details mismatch';
      } else {
        local.rejectionReason = undefined;
        local.paymentDate = new Date().toISOString();
      }
      mockDb.saveAll();
      savedPayment = local;
    }

    const auditAction = status === 'PAID' ? 'FEE_PAYMENT_APPROVED' : 'FEE_PAYMENT_REJECTED';
    mockDb.addLog(adminId, auditAction, { paymentId, rejectionReason });
    const logAction = status === 'PAID' ? 'APPROVED' as const : 'REJECTED' as const;
    await this.logPaymentAction(paymentId, logAction, adminId, { status, rejectionReason, invoiceId: savedPayment.feeStructureId });
    return savedPayment;
  },

  // ── SALARY PAYMENTS ─────────────────────────────────────────────────────

  async submitSalaryPayment(
    adminId: string,
    schoolId: string,
    payload: {
      employeeId: string;
      month: string;
      amount: number;
      utrNumber: string;
      paymentScreenshotUrl: string;
    }
  ): Promise<SalaryPayment> {
    await delay();
    
    // Check UTR uniqueness directly on Supabase (excluding REJECTED payments)
    const { data: dupData, error: dupError } = await supabase
      .from('salary_payments')
      .select('id')
      .eq('utr_number', payload.utrNumber)
      .neq('status', 'REJECTED')
      .maybeSingle();
      
    if (dupError) {
      console.error('Error checking UTR uniqueness:', dupError);
      throw dupError;
    }
    if (dupData) {
      throw new Error(`UTR "${payload.utrNumber}" already used for a salary payment.`);
    }

    const { data, error } = await supabase
      .from('salary_payments')
      .insert({
        employee_id: payload.employeeId,
        school_id: schoolId,
        month: payload.month,
        amount: payload.amount,
        utr_number: payload.utrNumber,
        payment_screenshot_url: payload.paymentScreenshotUrl,
        status: 'PENDING',
        created_by: adminId,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error submitting salary payment:', error);
      throw error;
    }
    if (!data) {
      throw new Error('Failed to submit salary payment: no data returned from database.');
    }

    const newPayment: SalaryPayment = {
      id: data.id,
      employeeId: data.employee_id,
      schoolId: data.school_id,
      month: data.month,
      amount: Number(data.amount),
      utrNumber: data.utr_number,
      paymentScreenshotUrl: data.payment_screenshot_url,
      status: data.status as SalaryPayment['status'],
      rejectionReason: data.rejection_reason,
      rejectedBy: data.rejected_by,
      rejectedAt: data.rejected_at,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    await this.logPaymentAction(newPayment.id, 'SUBMITTED', adminId, {
      employeeId: payload.employeeId,
      month: payload.month,
      amount: payload.amount,
      utrNumber: payload.utrNumber
    });

    return newPayment;
  },

  async getSalaryPayments(schoolId: string): Promise<SalaryPayment[]> {
    await delay(100);
    const { data, error } = await supabase
      .from('salary_payments')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading salary payments:', error);
      throw error;
    }
    if (!data) return [];

    return (data as any[]).map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      schoolId: r.school_id,
      month: r.month,
      amount: Number(r.amount),
      utrNumber: r.utr_number,
      paymentScreenshotUrl: r.payment_screenshot_url,
      status: r.status as SalaryPayment['status'],
      rejectionReason: r.rejection_reason,
      rejectedBy: r.rejected_by,
      rejectedAt: r.rejected_at,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  },

  async approveSalaryPayment(
    adminId: string,
    paymentId: string,
    action: 'APPROVED' | 'REJECTED',
    rejectionReason?: string
  ): Promise<SalaryPayment> {
    await delay();
    const now = new Date().toISOString();
    const patch: any = { status: action, updated_at: now };
    if (action === 'REJECTED') {
      patch.rejection_reason = rejectionReason || 'Details mismatch';
      patch.rejected_by = adminId;
      patch.rejected_at = now;
    }
    
    const { data, error } = await supabase
      .from('salary_payments')
      .update(patch)
      .eq('id', paymentId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating salary payment status:', error);
      throw error;
    }
    if (!data) {
      throw new Error('Salary payment not found.');
    }

    const updated: SalaryPayment = {
      id: data.id,
      employeeId: data.employee_id,
      schoolId: data.school_id,
      month: data.month,
      amount: Number(data.amount),
      utrNumber: data.utr_number,
      paymentScreenshotUrl: data.payment_screenshot_url,
      status: data.status as SalaryPayment['status'],
      rejectionReason: data.rejection_reason,
      rejectedBy: data.rejected_by,
      rejectedAt: data.rejected_at,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    if (action === 'APPROVED') {
      const { error: ledgerError } = await supabase
        .from('employee_salary_ledger')
        .insert({
          employee_id: updated.employeeId,
          salary_payment_id: paymentId,
          month: updated.month,
          amount: updated.amount,
          payment_date: now,
          utr_number: updated.utrNumber,
        });
        
      if (ledgerError) {
        console.error('Error creating ledger entry:', ledgerError);
        throw ledgerError;
      }
    }

    const salaryLogAction = action === 'APPROVED' ? 'APPROVED' as const : 'REJECTED' as const;
    await this.logPaymentAction(paymentId, salaryLogAction, adminId, {
      action,
      rejectionReason,
      employeeId: updated.employeeId,
      amount: updated.amount,
    });

    return updated;
  },

  async getSalaryLedger(schoolId: string, employeeId?: string): Promise<EmployeeSalaryLedger[]> {
    await delay(100);
    let query = supabase
      .from('employee_salary_ledger')
      .select('*, salary_payments!inner(school_id)')
      .eq('salary_payments.school_id', schoolId)
      .order('payment_date', { ascending: false });
    
    if (employeeId) {
      query = query.eq('employee_id', employeeId);
    }
    
    const { data, error } = await query;
    if (error) {
      console.error('Error fetching salary ledger:', error);
      throw error;
    }
    if (!data) return [];
    
    return (data as any[]).map(r => ({
      id: r.id,
      employeeId: r.employee_id,
      salaryPaymentId: r.salary_payment_id,
      month: r.month,
      amount: Number(r.amount),
      paymentDate: r.payment_date,
      utrNumber: r.utr_number,
      createdAt: r.created_at,
    }));
  },

  // ---------------------------------------------------------------------
  // SPORTS MODULE DYNAMIC API WRAPPER METHODS (SUPABASE DRIVEN)
  // ---------------------------------------------------------------------
  async fetchSportsCategories(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsCategories');
    const { data, error } = await supabaseAdmin
      .from('sports_categories')
      .select('*')
      .eq('school_id', schoolId)
      .order('name');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      name: r.name,
      description: r.description,
      createdAt: r.created_at
    }));
  },

  async fetchSports(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSports');
    const { data, error } = await supabaseAdmin
      .from('sports')
      .select('*, sports_categories(name)')
      .eq('school_id', schoolId)
      .order('name');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      categoryId: r.category_id,
      categoryName: r.sports_categories?.name || 'Uncategorized',
      name: r.name,
      description: r.description,
      type: r.type,
      format: r.format,
      status: r.status,
      createdAt: r.created_at
    }));
  },

  async addSport(sport: { schoolId: string; categoryId: string; name: string; description?: string; type: 'INDOOR' | 'OUTDOOR'; format: 'INDIVIDUAL' | 'TEAM'; status: string }): Promise<any> {
    validateSchoolId(sport.schoolId, 'addSport');
    const { data, error } = await supabaseAdmin
      .from('sports')
      .insert({
        school_id: sport.schoolId,
        category_id: sport.categoryId,
        name: sport.name,
        description: sport.description,
        type: sport.type,
        format: sport.format,
        status: sport.status
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSport(sportId: string, patch: any): Promise<any> {
    const dbPatch: any = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.categoryId !== undefined) dbPatch.category_id = patch.categoryId;
    if (patch.type !== undefined) dbPatch.type = patch.type;
    if (patch.format !== undefined) dbPatch.format = patch.format;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    dbPatch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('sports')
      .update(dbPatch)
      .eq('id', sportId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsCoaches(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsCoaches');
    const { data, error } = await supabaseAdmin
      .from('sports_coaches')
      .select('*, users(email)')
      .eq('school_id', schoolId)
      .order('coach_name');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      userId: r.user_id,
      employeeId: r.employee_id,
      coachName: r.coach_name,
      specialization: r.specialization,
      experienceYears: r.experience_years,
      certification: r.certification,
      salary: Number(r.salary),
      status: r.status,
      createdAt: r.created_at,
      coachEmail: r.users?.email || ''
    }));
  },

  async fetchSportsEnrollments(schoolId: string, academicSessionId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsEnrollments');
    const { data, error } = await supabaseAdmin
      .from('sports_enrollments')
      .select('*, students(*, users(first_name, last_name)), sports(name)')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      studentId: r.student_id,
      sportId: r.sport_id,
      enrollDate: r.enroll_date,
      status: r.status,
      rejectionReason: r.rejection_reason,
      createdAt: r.created_at,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student',
      sportName: r.sports?.name || 'Unknown Sport'
    }));
  },

  async submitSportsEnrollment(userId: string, enrollment: { schoolId: string; academicSessionId: string; studentId: string; sportId: string }): Promise<any> {
    validateSchoolId(enrollment.schoolId, 'submitSportsEnrollment');
    const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
    if (!user || !['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabaseAdmin
      .from('sports_enrollments')
      .insert({
        school_id: enrollment.schoolId,
        academic_session_id: enrollment.academicSessionId,
        student_id: enrollment.studentId,
        sport_id: enrollment.sportId,
        status: 'PENDING'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSportsEnrollmentStatus(userId: string, enrollmentId: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
    if (!user || !['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabaseAdmin
      .from('sports_enrollments')
      .update({
        status,
        rejection_reason: rejectionReason || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', enrollmentId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsTeams(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsTeams');
    const { data, error } = await supabaseAdmin
      .from('sports_teams')
      .select('*, sports(name), sports_coaches(users(first_name, last_name)), students!sports_teams_captain_id_fkey(users(first_name, last_name))')
      .eq('school_id', schoolId);
    if (error) throw error;

    // Fetch team member counts
    const { data: memberCounts, error: cntError } = await supabaseAdmin
      .from('sports_team_members')
      .select('team_id');
    
    return (data || []).map(r => {
      const cnt = (memberCounts || []).filter(m => m.team_id === r.id).length;
      const coachUser = r.sports_coaches?.users;
      const captUser = r.students?.users;
      return {
        id: r.id,
        schoolId: r.school_id,
        sportId: r.sport_id,
        name: r.name,
        coachId: r.coach_id,
        captainId: r.captain_id,
        viceCaptainId: r.vice_captain_id,
        ageGroup: r.age_group,
        gender: r.gender,
        status: r.status,
        createdAt: r.created_at,
        sportName: r.sports?.name || 'Unknown',
        coachName: coachUser ? `${coachUser.first_name} ${coachUser.last_name}` : 'Not Assigned',
        captainName: captUser ? `${captUser.first_name} ${captUser.last_name}` : 'Not Assigned',
        memberCount: cnt
      };
    });
  },

  async createSportsTeam(team: any): Promise<any> {
    validateSchoolId(team.schoolId, 'createSportsTeam');
    const { data, error } = await supabaseAdmin
      .from('sports_teams')
      .insert({
        school_id: team.schoolId,
        sport_id: team.sportId,
        name: team.name,
        coach_id: team.coachId,
        captain_id: team.captainId,
        vice_captain_id: team.viceCaptainId,
        age_group: team.ageGroup,
        gender: team.gender,
        status: team.status || 'ACTIVE'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSportsTeam(teamId: string, patch: any): Promise<any> {
    const dbPatch: any = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.coachId !== undefined) dbPatch.coach_id = patch.coachId;
    if (patch.captainId !== undefined) dbPatch.captain_id = patch.captainId;
    if (patch.viceCaptainId !== undefined) dbPatch.vice_captain_id = patch.viceCaptainId;
    if (patch.ageGroup !== undefined) dbPatch.age_group = patch.ageGroup;
    if (patch.gender !== undefined) dbPatch.gender = patch.gender;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    dbPatch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('sports_teams')
      .update(dbPatch)
      .eq('id', teamId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsTeamMembers(schoolId: string, teamId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsTeamMembers');
    const { data, error } = await supabaseAdmin
      .from('sports_team_members')
      .select('*, students(*, users(first_name, last_name))')
      .eq('school_id', schoolId)
      .eq('team_id', teamId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      teamId: r.team_id,
      studentId: r.student_id,
      joinedAt: r.joined_at,
      status: r.status,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student',
      studentRoll: r.students?.roll_number || 0
    }));
  },

  async addSportsTeamMember(teamId: string, studentId: string, schoolId: string): Promise<any> {
    validateSchoolId(schoolId, 'addSportsTeamMember');
    const { data, error } = await supabaseAdmin
      .from('sports_team_members')
      .insert({
        school_id: schoolId,
        team_id: teamId,
        student_id: studentId,
        status: 'ACTIVE'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async removeSportsTeamMember(memberId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('sports_team_members')
      .delete()
      .eq('id', memberId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsTrainingSessions(schoolId: string, academicSessionId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsTrainingSessions');
    const { data, error } = await supabaseAdmin
      .from('sports_training_sessions')
      .select('*, sports(name), sports_teams(name)')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      sportId: r.sport_id,
      teamId: r.team_id,
      coachId: r.coach_id,
      sessionName: r.session_name,
      sessionDate: r.session_date,
      startTime: r.start_time,
      endTime: r.end_time,
      venue: r.venue,
      recurrence: r.recurrence,
      status: r.status,
      createdAt: r.created_at,
      sportName: r.sports?.name || 'Unknown Sport',
      teamName: r.sports_teams?.name || 'Individual / General'
    }));
  },

  async createSportsTrainingSession(session: any): Promise<any> {
    validateSchoolId(session.schoolId, 'createSportsTrainingSession');
    const { data, error } = await supabaseAdmin
      .from('sports_training_sessions')
      .insert({
        school_id: session.schoolId,
        academic_session_id: session.academicSessionId,
        sport_id: session.sportId,
        team_id: session.teamId || null,
        coach_id: session.coachId || null,
        session_name: session.sessionName,
        session_date: session.sessionDate,
        start_time: session.startTime,
        end_time: session.endTime,
        venue: session.venue,
        recurrence: session.recurrence || 'NONE',
        status: session.status || 'SCHEDULED'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSportsTrainingSession(sessionId: string, patch: any): Promise<any> {
    const dbPatch: any = {};
    if (patch.sessionName !== undefined) dbPatch.session_name = patch.sessionName;
    if (patch.sessionDate !== undefined) dbPatch.session_date = patch.sessionDate;
    if (patch.startTime !== undefined) dbPatch.start_time = patch.startTime;
    if (patch.endTime !== undefined) dbPatch.end_time = patch.endTime;
    if (patch.venue !== undefined) dbPatch.venue = patch.venue;
    if (patch.status !== undefined) dbPatch.status = patch.status;
    dbPatch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('sports_training_sessions')
      .update(dbPatch)
      .eq('id', sessionId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsAttendance(schoolId: string, sessionId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsAttendance');
    const { data, error } = await supabaseAdmin
      .from('sports_attendance')
      .select('*, students(*, users(first_name, last_name))')
      .eq('school_id', schoolId)
      .eq('session_id', sessionId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      sessionId: r.session_id,
      studentId: r.student_id,
      date: r.date,
      status: r.status,
      remarks: r.remarks,
      markedBy: r.marked_by,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student'
    }));
  },

  async fetchStudentAttendance(schoolId: string, studentId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchStudentAttendance');
    const { data, error } = await supabaseAdmin
      .from('sports_attendance')
      .select('*, sports_training_sessions(session_name)')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      date: r.date,
      status: r.status,
      remarks: r.remarks,
      sessionName: r.sports_training_sessions?.session_name || 'General Session'
    }));
  },

  async markSportsAttendance(attendanceList: any[]): Promise<any[]> {
    if (!attendanceList || attendanceList.length === 0) return [];
    const schoolId = attendanceList[0].schoolId;
    validateSchoolId(schoolId, 'markSportsAttendance');
    
    const results = [];
    for (const att of attendanceList) {
      const { data, error } = await supabaseAdmin
        .from('sports_attendance')
        .upsert({
          school_id: att.schoolId,
          session_id: att.sessionId,
          student_id: att.studentId,
          status: att.status,
          remarks: att.remarks || null,
          marked_by: att.markedBy,
          date: att.date || new Date().toISOString().split('T')[0]
        }, { onConflict: 'session_id, student_id' })
        .select()
        .single();
      if (error) throw error;
      results.push(data);
    }
    return results;
  },

  async fetchSportsPerformanceMetrics(schoolId: string, academicSessionId: string, studentId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsPerformanceMetrics');
    let query = supabaseAdmin
      .from('sports_performance_metrics')
      .select('*, students(*, users(first_name, last_name)), sports(name)')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId);
    
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      studentId: r.student_id,
      sportId: r.sport_id,
      recordedDate: r.recorded_date,
      speed: r.speed,
      stamina: r.stamina,
      strength: r.strength,
      agility: r.agility,
      skill: r.skill,
      discipline: r.discipline,
      teamwork: r.teamwork,
      fitness: r.fitness,
      coachRating: r.coach_rating ? Number(r.coach_rating) : undefined,
      tournamentPerformance: r.tournament_performance,
      achievementProgress: r.achievement_progress,
      coachId: r.coach_id,
      remarks: r.remarks,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student',
      sportName: r.sports?.name || 'Unknown Sport'
    }));
  },

  async recordSportsPerformanceMetric(metric: any): Promise<any> {
    validateSchoolId(metric.schoolId, 'recordSportsPerformanceMetric');
    const { data, error } = await supabaseAdmin
      .from('sports_performance_metrics')
      .insert({
        school_id: metric.schoolId,
        academic_session_id: metric.academicSessionId,
        student_id: metric.studentId,
        sport_id: metric.sportId,
        speed: metric.speed,
        stamina: metric.stamina,
        strength: metric.strength,
        agility: metric.agility,
        skill: metric.skill,
        discipline: metric.discipline,
        teamwork: metric.teamwork,
        fitness: metric.fitness,
        coach_rating: metric.coachRating,
        tournament_performance: metric.tournamentPerformance || 70,
        achievement_progress: metric.achievementProgress || 70,
        coach_id: metric.coachId,
        remarks: metric.remarks
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsTournaments(schoolId: string, academicSessionId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsTournaments');
    const { data, error } = await supabaseAdmin
      .from('sports_tournaments')
      .select('*, sports(name)')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      sportId: r.sport_id,
      name: r.name,
      format: r.format,
      startDate: r.start_date,
      endDate: r.end_date,
      venue: r.venue,
      status: r.status,
      sportName: r.sports?.name || 'Unknown Sport'
    }));
  },

  async createSportsTournament(tournament: any): Promise<any> {
    validateSchoolId(tournament.schoolId, 'createSportsTournament');
    const { data, error } = await supabaseAdmin
      .from('sports_tournaments')
      .insert({
        school_id: tournament.schoolId,
        academic_session_id: tournament.academicSessionId,
        sport_id: tournament.sportId,
        name: tournament.name,
        format: tournament.format,
        start_date: tournament.startDate,
        end_date: tournament.endDate,
        venue: tournament.venue,
        status: tournament.status || 'UPCOMING'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsFixtures(schoolId: string, tournamentId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsFixtures');
    const { data, error } = await supabaseAdmin
      .from('sports_fixtures')
      .select('*, sports_teams!sports_fixtures_team1_id_fkey(name), sports_teams!sports_fixtures_team2_id_fkey(name), sports_matches(*, sports_results(*))')
      .eq('school_id', schoolId)
      .eq('tournament_id', tournamentId);
    if (error) throw error;
    return (data || []).map(r => {
      const match = r.sports_matches?.[0] || r.sports_matches;
      const res = match?.sports_results?.[0] || match?.sports_results;
      return {
        id: r.id,
        schoolId: r.school_id,
        tournamentId: r.tournament_id,
        team1Id: r.team1_id,
        team2Id: r.team2_id,
        matchDate: r.match_date,
        matchTime: r.match_time,
        venue: r.venue,
        status: r.status,
        round: r.round,
        refereeOfficials: r.referee_officials,
        team1Name: r.sports_teams_team1_id_fkey?.name || 'Our Team',
        team2Name: r.sports_teams_team2_id_fkey?.name || 'Opponent School Team',
        winnerTeamId: match?.winner_team_id || null,
        team1Score: match?.team1_score || '',
        team2Score: match?.team2_score || '',
        summary: match?.summary || ''
      };
    });
  },

  async createSportsFixture(fixture: any): Promise<any> {
    validateSchoolId(fixture.schoolId, 'createSportsFixture');
    const { data, error } = await supabaseAdmin
      .from('sports_fixtures')
      .insert({
        school_id: fixture.schoolId,
        tournament_id: fixture.tournamentId,
        team1_id: fixture.team1Id,
        team2_id: fixture.team2Id || null,
        match_date: fixture.matchDate,
        match_time: fixture.matchTime,
        venue: fixture.venue,
        status: 'SCHEDULED',
        round: fixture.round,
        referee_officials: fixture.refereeOfficials
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSportsFixtureStatus(fixtureId: string, status: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('sports_fixtures')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', fixtureId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async uploadMatchResult(result: { schoolId: string; fixtureId: string; winnerTeamId?: string | null; team1Score: string; team2Score: string; summary?: string }): Promise<any> {
    validateSchoolId(result.schoolId, 'uploadMatchResult');
    
    // First update the fixture status to COMPLETED
    await supabaseAdmin
      .from('sports_fixtures')
      .update({ status: 'COMPLETED' })
      .eq('id', result.fixtureId);

    // Insert into matches
    const { data: matchData, error: matchError } = await supabaseAdmin
      .from('sports_matches')
      .insert({
        school_id: result.schoolId,
        fixture_id: result.fixtureId,
        winner_team_id: result.winnerTeamId || null,
        team1_score: result.team1Score,
        team2_score: result.team2Score,
        summary: result.summary
      })
      .select()
      .single();

    if (matchError) throw matchError;

    // Insert into results
    const { data: resData, error: resError } = await supabaseAdmin
      .from('sports_results')
      .insert({
        school_id: result.schoolId,
        match_id: matchData.id,
        winner_team_id: result.winnerTeamId || null,
        team1_score: result.team1Score,
        team2_score: result.team2Score,
        summary: result.summary
      })
      .select()
      .single();

    if (resError) throw resError;
    return matchData;
  },

  async fetchSportsRankings(schoolId: string, academicSessionId: string, sportId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsRankings');
    let query = supabaseAdmin
      .from('sports_rankings')
      .select('*, sports_teams(name), students(*, users(first_name, last_name))')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId);
    
    if (sportId) {
      query = query.eq('sport_id', sportId);
    }
    
    const { data, error } = await query.order('points', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      sportId: r.sport_id,
      teamId: r.team_id,
      studentId: r.student_id,
      points: r.points,
      matchesPlayed: r.matches_played,
      matchesWon: r.matches_won,
      matchesLost: r.matches_lost,
      matchesDrawn: r.matches_drawn,
      rankScore: r.rank_score,
      rank: r.rank,
      teamName: r.sports_teams?.name || 'Individual Participant',
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Team Ranking'
    }));
  },

  async fetchSportsCertificates(schoolId: string, studentId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsCertificates');
    let query = supabaseAdmin
      .from('sports_certificates')
      .select('*, students(*, users(first_name, last_name)), sports(name), sports_tournaments(name)')
      .eq('school_id', schoolId);
    
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      studentId: r.student_id,
      sportId: r.sport_id,
      tournamentId: r.tournament_id,
      category: r.category,
      certificateNumber: r.certificate_number,
      issueDate: r.issue_date,
      fileUrl: r.file_url,
      verificationQrCode: r.verification_qr_code,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student',
      sportName: r.sports?.name || 'Unknown Sport',
      tournamentName: r.sports_tournaments?.name || 'General Event'
    }));
  },

  async issueSportsCertificate(cert: any): Promise<any> {
    validateSchoolId(cert.schoolId, 'issueSportsCertificate');
    const { data, error } = await supabaseAdmin
      .from('sports_certificates')
      .insert({
        school_id: cert.schoolId,
        academic_session_id: cert.academicSessionId,
        student_id: cert.studentId,
        sport_id: cert.sportId,
        tournament_id: cert.tournamentId || null,
        category: cert.category,
        certificate_number: cert.certificateNumber || `AEGIS-SP-${cert.schoolId.substring(0,4)}-${Math.floor(Math.random() * 90000 + 10000)}`,
        issue_date: cert.issueDate || new Date().toISOString().split('T')[0],
        file_url: cert.fileUrl || 'https://placeholder.aegis.com/certificates/sample.pdf',
        verification_qr_code: cert.verificationQrCode || `AEGIS-QR-VERIFY-${cert.studentId}`
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsAchievements(schoolId: string, studentId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsAchievements');
    let query = supabaseAdmin
      .from('sports_achievements')
      .select('*, students(*, users(first_name, last_name)), sports(name)')
      .eq('school_id', schoolId);
    
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query.order('date_awarded', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      studentId: r.student_id,
      sportId: r.sport_id,
      type: r.type,
      level: r.level,
      title: r.title,
      description: r.description,
      dateAwarded: r.date_awarded,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student',
      sportName: r.sports?.name || 'Unknown Sport'
    }));
  },

  async addSportsAchievement(ach: any): Promise<any> {
    validateSchoolId(ach.schoolId, 'addSportsAchievement');
    const { data, error } = await supabaseAdmin
      .from('sports_achievements')
      .insert({
        school_id: ach.schoolId,
        academic_session_id: ach.academicSessionId,
        student_id: ach.studentId,
        sport_id: ach.sportId,
        type: ach.type,
        level: ach.level,
        title: ach.title,
        description: ach.description,
        date_awarded: ach.dateAwarded || new Date().toISOString().split('T')[0]
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsMedicalRecords(schoolId: string, studentId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsMedicalRecords');
    let query = supabaseAdmin
      .from('sports_medical_records')
      .select('*, students(*, users(first_name, last_name))')
      .eq('school_id', schoolId);
    
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      studentId: r.student_id,
      bloodGroup: r.blood_group,
      medicalConditions: r.medical_conditions,
      emergencyContact: r.emergency_contact,
      injuryHistory: typeof r.injury_history === 'string' ? JSON.parse(r.injury_history) : r.injury_history,
      recoveryStatus: r.recovery_status,
      fitnessExpiryDate: r.fitness_expiry_date,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student'
    }));
  },

  async upsertSportsMedicalRecord(record: any): Promise<any> {
    validateSchoolId(record.schoolId, 'upsertSportsMedicalRecord');
    const { data, error } = await supabaseAdmin
      .from('sports_medical_records')
      .upsert({
        school_id: record.schoolId,
        student_id: record.studentId,
        blood_group: record.bloodGroup,
        medical_conditions: record.medicalConditions,
        emergency_contact: record.emergencyContact,
        injury_history: record.injuryHistory || [],
        recovery_status: record.recoveryStatus || 'FIT',
        fitness_expiry_date: record.fitnessExpiryDate
      }, { onConflict: 'student_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsEquipment(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsEquipment');
    const { data, error } = await supabaseAdmin
      .from('sports_equipment')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      name: r.name,
      category: r.category,
      totalQuantity: r.total_quantity,
      availableQuantity: r.available_quantity,
      condition: r.condition,
      location: r.location
    }));
  },

  async addSportsEquipment(equip: any): Promise<any> {
    validateSchoolId(equip.schoolId, 'addSportsEquipment');
    const { data, error } = await supabaseAdmin
      .from('sports_equipment')
      .insert({
        school_id: equip.schoolId,
        name: equip.name,
        category: equip.category,
        total_quantity: equip.totalQuantity,
        available_quantity: equip.totalQuantity, // initial same
        condition: equip.condition || 'GOOD',
        location: equip.location
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateSportsEquipment(equipId: string, patch: any): Promise<any> {
    const dbPatch: any = {};
    if (patch.name !== undefined) dbPatch.name = patch.name;
    if (patch.category !== undefined) dbPatch.category = patch.category;
    if (patch.totalQuantity !== undefined) {
      dbPatch.total_quantity = patch.totalQuantity;
      dbPatch.available_quantity = patch.availableQuantity !== undefined ? patch.availableQuantity : patch.totalQuantity;
    } else if (patch.availableQuantity !== undefined) {
      dbPatch.available_quantity = patch.availableQuantity;
    }
    if (patch.condition !== undefined) dbPatch.condition = patch.condition;
    if (patch.location !== undefined) dbPatch.location = patch.location;
    dbPatch.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('sports_equipment')
      .update(dbPatch)
      .eq('id', equipId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsEquipmentLogs(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsEquipmentLogs');
    const { data, error } = await supabaseAdmin
      .from('sports_equipment_logs')
      .select('*, sports_equipment(name), users(first_name, last_name)')
      .eq('school_id', schoolId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      equipmentId: r.equipment_id,
      assignedToUserId: r.assigned_to_user_id,
      quantity: r.quantity,
      issueDate: r.issue_date,
      returnDate: r.return_date,
      status: r.status,
      damageReport: r.damage_report,
      equipmentName: r.sports_equipment?.name || 'Unknown Item',
      assignedUserName: r.users ? `${r.users.first_name} ${r.users.last_name}` : 'Unknown Student/Staff'
    }));
  },

  async logSportsEquipmentIssue(log: any): Promise<any> {
    validateSchoolId(log.schoolId, 'logSportsEquipmentIssue');
    
    // Decrement available qty first
    const { data: equip } = await supabaseAdmin
      .from('sports_equipment')
      .select('available_quantity')
      .eq('id', log.equipmentId)
      .single();
    
    if (equip && equip.available_quantity >= log.quantity) {
      await supabaseAdmin
        .from('sports_equipment')
        .update({ available_quantity: equip.available_quantity - log.quantity })
        .eq('id', log.equipmentId);
    }

    const { data, error } = await supabaseAdmin
      .from('sports_equipment_logs')
      .insert({
        school_id: log.schoolId,
        equipment_id: log.equipmentId,
        assigned_to_user_id: log.assignedToUserId,
        quantity: log.quantity,
        status: 'ISSUED'
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async logSportsEquipmentReturn(logId: string, patch: { returnDate?: string; status: 'RETURNED' | 'DAMAGED' | 'LOST'; damageReport?: string }): Promise<any> {
    const { data: logRecord } = await supabaseAdmin
      .from('sports_equipment_logs')
      .select('equipment_id, quantity')
      .eq('id', logId)
      .single();
    
    if (logRecord && patch.status === 'RETURNED') {
      const { data: equip } = await supabaseAdmin
        .from('sports_equipment')
        .select('available_quantity')
        .eq('id', logRecord.equipment_id)
        .single();
      if (equip) {
        await supabaseAdmin
          .from('sports_equipment')
          .update({ available_quantity: equip.available_quantity + logRecord.quantity })
          .eq('id', logRecord.equipment_id);
      }
    }

    const { data, error } = await supabaseAdmin
      .from('sports_equipment_logs')
      .update({
        return_date: patch.returnDate || new Date().toISOString(),
        status: patch.status,
        damage_report: patch.damageReport || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', logId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchSportsInvoices(schoolId: string, studentId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsInvoices');
    let query = supabaseAdmin
      .from('sports_invoices')
      .select('*, students(*, users(first_name, last_name)), created_by_user:users!created_by(first_name, last_name)')
      .eq('school_id', schoolId);
    
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      studentId: r.student_id,
      invoiceNumber: r.invoice_number,
      invoiceTitle: r.title,
      invoiceDescription: r.description,
      invoiceCategory: r.category,
      amount: Number(r.amount),
      dueDate: r.due_date,
      lateFee: r.late_fee ? Number(r.late_fee) : 0,
      remarks: r.remarks,
      status: r.status,
      createdBy: r.created_by,
      createdByName: r.created_by_user ? `${r.created_by_user.first_name} ${r.created_by_user.last_name}` : 'System',
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student',
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async fetchSportsFees(schoolId: string, academicSessionId: string): Promise<any[]> {
    return this.fetchSportsInvoices(schoolId);
  },

  async createSportsInvoice(invoice: any): Promise<any> {
    validateSchoolId(invoice.schoolId, 'createSportsInvoice');
    const invoiceNumber = `INV-SP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await supabaseAdmin
      .from('sports_invoices')
      .insert({
        school_id: invoice.schoolId,
        student_id: invoice.studentId,
        invoice_number: invoiceNumber,
        title: invoice.invoiceTitle,
        description: invoice.invoiceDescription || '',
        category: invoice.invoiceCategory,
        amount: invoice.amount,
        due_date: invoice.dueDate,
        late_fee: invoice.lateFee || 0,
        remarks: invoice.remarks || '',
        status: 'UNPAID',
        created_by: invoice.createdBy
      })
      .select('*, students(*, users(first_name, last_name))')
      .single();

    if (error) throw error;

    // Log Sports Activity
    try {
      const { data: userProfile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', invoice.createdBy)
        .single();
      
      const creatorRole = userProfile?.role || 'FINANCE_ADMIN';
      await this.logSportsActivity(
        invoice.schoolId,
        invoice.createdBy,
        creatorRole,
        'Invoice Created',
        `Invoice ${invoiceNumber} created for student ${data.students?.users ? `${data.students.users.first_name} ${data.students.users.last_name}` : data.student_id}`,
        '127.0.0.1',
        'Vite Client',
        { invoiceId: data.id, amount: invoice.amount }
      );
    } catch (logErr) {
      console.warn('Audit logging failed for invoice creation:', logErr);
    }

    return data;
  },

  async createSportsFee(fee: any): Promise<any> {
    return this.createSportsInvoice(fee);
  },

  async updateSportsInvoice(userId: string, invoiceId: string, updates: any): Promise<any> {
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .single();
    if (!userProfile || !['FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(userProfile.role)) {
      throw new Error('Unauthorized');
    }

    const { data, error } = await supabaseAdmin
      .from('sports_invoices')
      .update({
        title: updates.invoiceTitle,
        description: updates.invoiceDescription,
        category: updates.invoiceCategory,
        amount: updates.amount,
        due_date: updates.dueDate,
        late_fee: updates.lateFee,
        remarks: updates.remarks,
        status: updates.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', invoiceId)
      .select('*, students(*, users(first_name, last_name))')
      .single();

    if (error) throw error;

    // Log Sports Activity
    try {
      await this.logSportsActivity(
        data.school_id,
        userId,
        userProfile.role,
        'Invoice Updated',
        `Invoice ${data.invoice_number} updated`,
        '127.0.0.1',
        'Vite Client',
        { invoiceId, updates }
      );
    } catch (logErr) {
      console.warn('Audit logging failed for invoice update:', logErr);
    }

    return data;
  },

  async deleteSportsInvoice(userId: string, invoiceId: string): Promise<void> {
    const { data: userProfile } = await supabaseAdmin
      .from('users')
      .select('school_id, role')
      .eq('id', userId)
      .single();
    if (!userProfile || !['FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(userProfile.role)) {
      throw new Error('Unauthorized');
    }

    const { data: invoice } = await supabaseAdmin
      .from('sports_invoices')
      .select('invoice_number, school_id')
      .eq('id', invoiceId)
      .single();

    const { error } = await supabaseAdmin
      .from('sports_invoices')
      .delete()
      .eq('id', invoiceId);

    if (error) throw error;

    // Log Sports Activity
    if (invoice) {
      try {
        await this.logSportsActivity(
          invoice.school_id,
          userId,
          userProfile.role,
          'Invoice Deleted',
          `Invoice ${invoice.invoice_number} deleted`,
          '127.0.0.1',
          'Vite Client',
          { invoiceId }
        );
      } catch (logErr) {
        console.warn('Audit logging failed for invoice deletion:', logErr);
      }
    }
  },

  async fetchSportsFeePayments(schoolId: string, invoiceId?: string, studentId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsFeePayments');
    let query = supabaseAdmin
      .from('sports_fee_payments')
      .select('*, students(*, users(first_name, last_name)), sports_invoices(*)')
      .eq('school_id', schoolId);
    
    if (invoiceId) {
      query = query.eq('invoice_id', invoiceId);
    }
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      invoiceId: r.invoice_id,
      studentId: r.student_id,
      parentId: r.submitted_by,
      amountPaid: Number(r.amount),
      utrNumber: r.utr_number,
      paymentScreenshotUrl: r.proof_image_url,
      status: r.status,
      submittedAt: r.submitted_at,
      approvedBy: r.approved_by,
      approvedAt: r.approved_at,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student',
      feeType: r.sports_invoices?.category || 'Sports Invoice',
      feeAmount: r.sports_invoices?.amount ? Number(r.sports_invoices.amount) : 0,
      invoiceTitle: r.sports_invoices?.title || 'Invoice Title'
    }));
  },

  async submitSportsFeePayment(payment: any): Promise<any> {
    validateSchoolId(payment.schoolId, 'submitSportsFeePayment');
    
    const invoiceId = payment.sportsFeeId;
    const studentId = payment.studentId;
    const parentId = payment.parentId;
    const schoolId = payment.schoolId;

    if (!invoiceId) throw new Error("Invoice ID missing");
    if (!studentId) throw new Error("Student ID missing");
    if (!parentId) throw new Error("Parent ID missing");
    if (!schoolId) throw new Error("School ID missing");

    const { data, error } = await supabaseAdmin
      .from('sports_fee_payments')
      .insert({
        school_id: schoolId,
        invoice_id: invoiceId,
        student_id: studentId,
        submitted_by: parentId,
        amount: payment.amountPaid,
        utr_number: payment.utrNumber,
        proof_image_url: payment.paymentScreenshotUrl,
        status: 'PENDING_VERIFICATION'
      })
      .select('*, sports_invoices(*)')
      .single();

    if (error) throw error;

    // Update invoice status to PENDING_VERIFICATION
    const { error: invoiceErr } = await supabaseAdmin
      .from('sports_invoices')
      .update({ status: 'PENDING_VERIFICATION' })
      .eq('id', invoiceId);
    
    if (invoiceErr) throw invoiceErr;

    // Log Sports Activity
    try {
      const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', parentId).single();
      await this.logSportsActivity(
        schoolId,
        parentId,
        user?.role || 'PARENT',
        'Payment Submitted',
        `Payment of ₹${payment.amountPaid} submitted for invoice ${data.sports_invoices?.invoice_number}`,
        '127.0.0.1',
        'Vite Client',
        { paymentId: data.id, invoiceId }
      );
    } catch (logErr) {
      console.warn('Audit logging failed for payment submission:', logErr);
    }

    return data;
  },

  async updateSportsFeePaymentStatus(
    userId: string, 
    paymentId: string, 
    status: 'APPROVED' | 'REJECTED', 
    remarksOrReason?: string
  ): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['FINANCE_ADMIN', 'SPORTS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error('Unauthorized');
    }

    const { data: currentPayment } = await supabaseAdmin
      .from('sports_fee_payments')
      .select('*, sports_invoices(*)')
      .eq('id', paymentId)
      .single();
    if (!currentPayment) throw new Error('Payment not found');

    const updateFields: any = {
      status
    };

    if (status === 'APPROVED') {
      updateFields.approved_by = userId;
      updateFields.approved_at = new Date().toISOString();
    }

    const { data, error } = await supabaseAdmin
      .from('sports_fee_payments')
      .update(updateFields)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;

    // Update sports_invoices status to APPROVED or REJECTED
    const { error: invoiceErr } = await supabaseAdmin
      .from('sports_invoices')
      .update({ status: status })
      .eq('id', currentPayment.invoice_id);

    if (invoiceErr) throw invoiceErr;

    // Log Sports Activity
    try {
      await this.logSportsActivity(
        currentPayment.school_id,
        userId,
        user.role,
        status === 'APPROVED' ? 'Payment Approved' : 'Payment Rejected',
        `Payment of ₹${currentPayment.amount} for invoice ${currentPayment.sports_invoices?.invoice_number} ${status.toLowerCase()}`,
        '127.0.0.1',
        'Vite Client',
        { paymentId, invoiceId: currentPayment.invoice_id, remarksOrReason }
      );
    } catch (logErr) {
      console.warn('Audit logging failed for payment status update:', logErr);
    }

    return data;
  },

  async uploadSportsPaymentProof(schoolId: string, file: File): Promise<string> {
    validateSchoolId(schoolId, 'uploadSportsPaymentProof');
    const extension = file.name.split('.').pop() || 'png';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
    const filePath = `payment-proofs/${schoolId}/${uniqueName}`;

    const { error: uploadError } = await supabaseAdmin.storage
      .from('sports-payment-proofs')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) {
      throw new Error('Failed to upload payment proof: ' + uploadError.message);
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('sports-payment-proofs')
      .getPublicUrl(filePath);

    return publicUrl;
  },

  async fetchAllSportsAttendance(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchAllSportsAttendance');
    const { data, error } = await supabaseAdmin
      .from('sports_attendance')
      .select('*')
      .eq('school_id', schoolId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      sessionId: r.session_id,
      studentId: r.student_id,
      date: r.date,
      status: r.status,
      remarks: r.remarks,
      markedBy: r.marked_by
    }));
  },

  async fetchSportsAdmins(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsAdmins');
    const { data, error } = await supabaseAdmin
      .from('sports_admins')
      .select('*')
      .eq('school_id', schoolId)
      .order('full_name');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      userId: r.user_id,
      employeeId: r.employee_id,
      fullName: r.full_name,
      email: r.email,
      mobile: r.mobile,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async createSportsAdmin(
    adminId: string, 
    email: string, 
    firstName: string, 
    lastName: string, 
    phone: string, 
    employeeId: string, 
    password: string
  ): Promise<any> {
    const { data: admin } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');
    const schoolId = admin.school_id;
    const normalizedEmail = validateAndNormalizeEmail(email);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'SPORTS_ADMIN' }
    });
    if (authError || !authData.user) throw new Error(authError?.message || 'Failed to create auth user');

    const newUserId = authData.user.id;

    // 2. Insert into users table
    const { error: dbUserError } = await supabaseAdmin.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
      role: 'SPORTS_ADMIN',
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      school_id: schoolId,
      employee_id: employeeId || null,
      is_active: true
    });
    if (dbUserError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw dbUserError;
    }

    // 3. Insert into sports_admins table
    const { data: sportsAdmin, error: saError } = await supabaseAdmin.from('sports_admins').insert({
      school_id: schoolId,
      user_id: newUserId,
      employee_id: employeeId || null,
      full_name: `${firstName} ${lastName}`,
      email: normalizedEmail,
      mobile: phone,
      status: 'ACTIVE'
    }).select().single();

    if (saError) {
      await supabaseAdmin.from('users').delete().eq('id', newUserId);
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw saError;
    }

    // Insert 'SPORTS_ADMIN' role into user_roles
    await supabaseAdmin.from('user_roles').insert({
      user_id: newUserId,
      school_id: schoolId,
      role_code: 'SPORTS_ADMIN',
      status: 'ACTIVE',
      assigned_by: adminId
    });

    // Log the audit event for role changes
    await supabaseAdmin.from('role_changes').insert({
      event_type: 'ROLE_CREATED',
      user_id: newUserId,
      school_id: schoolId,
      old_value: null,
      new_value: 'SPORTS_ADMIN',
      changed_by: adminId,
      ip_address: '127.0.0.1',
      device_id: 'browser'
    });

    await this.logSportsActivity(schoolId, adminId, 'ADMIN', 'CREATE_SPORTS_ADMIN', `Created Sports Admin ${firstName} ${lastName}`, undefined, undefined, { sportsAdminId: sportsAdmin.id });
    return sportsAdmin;
  },

  async updateSportsAdmin(adminId: string, sportsAdminId: string, updateData: any): Promise<any> {
    const { data: admin } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');
    
    const { data: currentAdmin, error: fetchErr } = await supabaseAdmin.from('sports_admins').select('*').eq('id', sportsAdminId).single();
    if (fetchErr || !currentAdmin) throw new Error('Sports admin profile not found');

    const { data, error } = await supabaseAdmin
      .from('sports_admins')
      .update({
        full_name: updateData.fullName,
        mobile: updateData.mobile,
        status: updateData.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', sportsAdminId)
      .select()
      .single();
    
    if (error) throw error;

    // Sync user status and name
    const [firstName, ...rest] = (updateData.fullName || '').split(' ');
    const lastName = rest.join(' ');
    await supabaseAdmin.from('users').update({
      first_name: firstName,
      last_name: lastName,
      phone: updateData.mobile,
      is_active: updateData.status === 'ACTIVE'
    }).eq('id', currentAdmin.user_id);

    await this.logSportsActivity(admin.school_id, adminId, 'ADMIN', 'EDIT_SPORTS_ADMIN', `Updated Sports Admin ${updateData.fullName}`, undefined, undefined, { sportsAdminId });
    return data;
  },
  async deactivateSportsAdmin(adminId: string, sportsAdminId: string, isActive: boolean): Promise<any> {
    const { data: admin } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const status = isActive ? 'ACTIVE' : 'INACTIVE';
    const { data: currentAdmin } = await supabaseAdmin.from('sports_admins').select('user_id, full_name').eq('id', sportsAdminId).single();
    if (!currentAdmin) throw new Error('Sports Admin not found');

    const { data, error } = await supabaseAdmin
      .from('sports_admins')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', sportsAdminId)
      .select()
      .single();
    
    if (error) throw error;

    // Check if the SPORTS_ADMIN role exists in user_roles
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', currentAdmin.user_id)
      .eq('role_code', 'SPORTS_ADMIN')
      .maybeSingle();

    if (existingRole) {
      await supabaseAdmin
        .from('user_roles')
        .update({ 
          status, 
          updated_at: new Date().toISOString(),
          ...(status === 'INACTIVE' ? {
            deactivated_by: adminId,
            deactivated_at: new Date().toISOString()
          } : {
            deactivated_by: null,
            deactivated_at: null
          })
        })
        .eq('user_id', currentAdmin.user_id)
        .eq('role_code', 'SPORTS_ADMIN');
    } else {
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: currentAdmin.user_id,
          school_id: admin.school_id,
          role_code: 'SPORTS_ADMIN',
          status: status,
          assigned_by: adminId,
          ...(status === 'INACTIVE' ? {
            deactivated_by: adminId,
            deactivated_at: new Date().toISOString()
          } : {})
        });
    }

    // Log in role_changes audit table
    await supabaseAdmin.from('role_changes').insert({
      event_type: status === 'ACTIVE' ? 'ROLE_REACTIVATED' : 'ROLE_DEACTIVATED',
      user_id: currentAdmin.user_id,
      school_id: admin.school_id,
      old_value: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      new_value: status,
      changed_by: adminId,
      ip_address: '127.0.0.1',
      device_id: 'browser'
    });

    // Check remaining active roles
    const { data: activeRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', currentAdmin.user_id)
      .eq('status', 'ACTIVE');

    const activeCount = activeRoles?.length || 0;
    const userIsActive = activeCount > 0;

    await supabaseAdmin.from('users').update({ is_active: userIsActive }).eq('id', currentAdmin.user_id);
    
    // Shift user active role fallback if current portal context is deactivated
    if (status === 'INACTIVE') {
      const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', currentAdmin.user_id).single();
      if (userProfile && userProfile.role === 'SPORTS_ADMIN') {
        const activeList = (activeRoles || []).map(r => r.role_code).filter(r => r !== 'SPORTS_ADMIN');
        if (activeList.length > 0) {
          const nextRole = this.getHighestPriorityRole(activeList);
          await supabaseAdmin.from('users').update({ role: nextRole }).eq('id', currentAdmin.user_id);
          
          // Update local mockDb user cache
          const localUserIdx = mockDb.users.findIndex(u => u.id === currentAdmin.user_id);
          if (localUserIdx !== -1) {
            mockDb.users[localUserIdx].role = nextRole;
            mockDb.saveAll();
          }
        }
      }
    }

    await this.logSportsActivity(admin.school_id, adminId, 'ADMIN', isActive ? 'ACTIVATE_SPORTS_ADMIN' : 'DEACTIVATE_SPORTS_ADMIN', `${isActive ? 'Activated' : 'Deactivated'} Sports Admin ${currentAdmin.full_name}`, undefined, undefined, { sportsAdminId });
    return data;
  },
  async resetSportsAdminPassword(adminId: string, sportsAdminId: string, newPassword: string): Promise<void> {
    const { data: admin } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const { data: currentAdmin } = await supabaseAdmin.from('sports_admins').select('user_id, full_name').eq('id', sportsAdminId).single();
    if (!currentAdmin) throw new Error('Sports Admin not found');

    const { error } = await supabaseAdmin.auth.admin.updateUserById(currentAdmin.user_id, {
      password: newPassword
    });
    if (error) throw error;

    await this.logSportsActivity(admin.school_id, adminId, 'ADMIN', 'RESET_PASSWORD_SPORTS_ADMIN', `Reset password for Sports Admin ${currentAdmin.full_name}`, undefined, undefined, { sportsAdminId });
  },

  async addSportsCoach(adminId: string, coach: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');
    
    const normalizedEmail = validateAndNormalizeEmail(coach.email);
    const password = coach.password || 'AegisSports123';
    
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { school_id: user.school_id, role: 'TEACHER' }
    });
    if (authError || !authData.user) throw new Error(authError?.message || 'Failed to create auth user');
    
    const newUserId = authData.user.id;
    
    const [firstName, ...rest] = coach.name.split(' ');
    const lastName = rest.join(' ');

    await supabaseAdmin.from('users').insert({
      id: newUserId,
      email: normalizedEmail,
      role: 'TEACHER',
      first_name: firstName,
      last_name: lastName,
      phone: coach.phone || null,
      school_id: user.school_id,
      employee_id: coach.employeeId || null,
      is_active: true
    });

    const isSportsAdmin = user.role === 'SPORTS_ADMIN';
    const coachSalary = isSportsAdmin ? 0 : Number(coach.salary || 0);

    const { data, error } = await supabaseAdmin
      .from('sports_coaches')
      .insert({
        school_id: user.school_id,
        user_id: newUserId,
        employee_id: coach.employeeId || null,
        coach_name: coach.name,
        specialization: coach.specialization,
        experience_years: Number(coach.experienceYears || 0),
        certification: coach.certification || null,
        salary: coachSalary,
        status: 'ACTIVE'
      })
      .select()
      .single();
    
    if (error) throw error;

    // Insert 'COACH' role into user_roles
    await supabaseAdmin.from('user_roles').insert({
      user_id: newUserId,
      school_id: user.school_id,
      role_code: 'COACH',
      status: 'ACTIVE',
      assigned_by: adminId
    });

    // Log the audit event for role changes
    await supabaseAdmin.from('role_changes').insert({
      event_type: 'ROLE_CREATED',
      user_id: newUserId,
      school_id: user.school_id,
      old_value: null,
      new_value: 'COACH',
      changed_by: adminId,
      ip_address: '127.0.0.1',
      device_id: 'browser'
    });

    await this.logSportsActivity(user.school_id, adminId, user.role, 'CREATE_COACH', `Added coach ${coach.name}`, undefined, undefined, { coachId: data.id });
    return data;
  },

  async updateSportsCoach(adminId: string, coachId: string, updateData: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    const isSportsAdmin = user.role === 'SPORTS_ADMIN';
    const updatePayload: any = {
      coach_name: updateData.name,
      specialization: updateData.specialization,
      experience_years: Number(updateData.experienceYears || 0),
      certification: updateData.certification || null,
      status: updateData.status,
      updated_at: new Date().toISOString()
    };
    if (!isSportsAdmin) {
      updatePayload.salary = Number(updateData.salary || 0);
    }

    const { data, error } = await supabaseAdmin
      .from('sports_coaches')
      .update(updatePayload)
      .eq('id', coachId)
      .select()
      .single();
    
    if (error) throw error;
    const [firstName, ...rest] = (updateData.name || '').split(' ');
    const lastName = rest.join(' ');

    const coachStatus = updateData.status; // 'ACTIVE' or 'INACTIVE'
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', data.user_id)
      .eq('role_code', 'COACH')
      .maybeSingle();

    if (existingRole) {
      await supabaseAdmin
        .from('user_roles')
        .update({ 
          status: coachStatus, 
          updated_at: new Date().toISOString(),
          ...(coachStatus === 'INACTIVE' ? {
            deactivated_by: adminId,
            deactivated_at: new Date().toISOString()
          } : {
            deactivated_by: null,
            deactivated_at: null
          })
        })
        .eq('id', existingRole.id);
    } else {
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: data.user_id,
          school_id: user.school_id,
          role_code: 'COACH',
          status: coachStatus,
          assigned_by: adminId,
          ...(coachStatus === 'INACTIVE' ? {
            deactivated_by: adminId,
            deactivated_at: new Date().toISOString()
          } : {})
        });
    }

    // Check remaining active roles
    const { data: activeRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', data.user_id)
      .eq('status', 'ACTIVE');
    const activeCount = activeRoles?.length || 0;
    const userIsActive = activeCount > 0;

    await supabaseAdmin.from('users').update({
      first_name: firstName,
      last_name: lastName,
      is_active: userIsActive
    }).eq('id', data.user_id);

    // Dynamic active role shift fallback if active role is deactivated
    if (coachStatus === 'INACTIVE') {
      const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', data.user_id).single();
      if (userProfile && userProfile.role === 'COACH') {
        const activeList = (activeRoles || []).map(r => r.role_code).filter(r => r !== 'COACH');
        if (activeList.length > 0) {
          const nextRole = this.getHighestPriorityRole(activeList);
          await supabaseAdmin.from('users').update({ role: nextRole }).eq('id', data.user_id);
          
          // Update local mockDb user cache
          const localUserIdx = mockDb.users.findIndex(u => u.id === data.user_id);
          if (localUserIdx !== -1) {
            mockDb.users[localUserIdx].role = nextRole;
            mockDb.saveAll();
          }
        }
      }
    }

    await this.logSportsActivity(user.school_id, adminId, user.role, 'EDIT_COACH', `Updated coach ${updateData.name}`, undefined, undefined, { coachId });
    return data;
  },

  async deactivateSportsCoach(adminId: string, coachId: string, isActive: boolean): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    const status = isActive ? 'ACTIVE' : 'INACTIVE';
    const { data, error } = await supabaseAdmin
      .from('sports_coaches')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', coachId)
      .select()
      .single();
    
    if (error) throw error;

    // Check if the COACH role exists in user_roles
    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', data.user_id)
      .eq('role_code', 'COACH')
      .maybeSingle();

    if (existingRole) {
      await supabaseAdmin
        .from('user_roles')
        .update({ 
          status, 
          updated_at: new Date().toISOString(),
          ...(status === 'INACTIVE' ? {
            deactivated_by: adminId,
            deactivated_at: new Date().toISOString()
          } : {
            deactivated_by: null,
            deactivated_at: null
          })
        })
        .eq('user_id', data.user_id)
        .eq('role_code', 'COACH');
    } else {
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: data.user_id,
          school_id: user.school_id,
          role_code: 'COACH',
          status: status,
          assigned_by: adminId,
          ...(status === 'INACTIVE' ? {
            deactivated_by: adminId,
            deactivated_at: new Date().toISOString()
          } : {})
        });
    }

    // Log in role_changes audit table
    await supabaseAdmin.from('role_changes').insert({
      event_type: status === 'ACTIVE' ? 'ROLE_REACTIVATED' : 'ROLE_DEACTIVATED',
      user_id: data.user_id,
      school_id: user.school_id,
      old_value: status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
      new_value: status,
      changed_by: adminId,
      ip_address: '127.0.0.1',
      device_id: 'browser'
    });

    // Check remaining active roles
    const { data: activeRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', data.user_id)
      .eq('status', 'ACTIVE');

    const activeCount = activeRoles?.length || 0;
    const userIsActive = activeCount > 0;

    await supabaseAdmin.from('users').update({ is_active: userIsActive }).eq('id', data.user_id);

    // Shift user active role fallback if current portal context is deactivated
    if (status === 'INACTIVE') {
      const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', data.user_id).single();
      if (userProfile && userProfile.role === 'COACH') {
        const activeList = (activeRoles || []).map(r => r.role_code).filter(r => r !== 'COACH');
        if (activeList.length > 0) {
          const nextRole = this.getHighestPriorityRole(activeList);
          await supabaseAdmin.from('users').update({ role: nextRole }).eq('id', data.user_id);
          
          // Update local mockDb user cache
          const localUserIdx = mockDb.users.findIndex(u => u.id === data.user_id);
          if (localUserIdx !== -1) {
            mockDb.users[localUserIdx].role = nextRole;
            mockDb.saveAll();
          }
        }
      }
    }

    await this.logSportsActivity(user.school_id, adminId, user.role, isActive ? 'ACTIVATE_COACH' : 'DEACTIVATE_COACH', `${isActive ? 'Activated' : 'Deactivated'} coach`, undefined, undefined, { coachId });
    return data;
  },
  async switchActiveRole(userId: string, schoolId: string, roleCode: UserRole): Promise<void> {
    const { data: userProfile } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
    const oldRole = userProfile?.role || null;

    // Update users.role to new role (caching the session active role for RLS)
    await supabaseAdmin
      .from('users')
      .update({ role: roleCode })
      .eq('id', userId);

    // Log event in role_changes audit table
    await supabaseAdmin
      .from('role_changes')
      .insert({
        event_type: 'ROLE_SWITCHED',
        user_id: userId,
        school_id: schoolId || null,
        old_value: oldRole,
        new_value: roleCode,
        changed_by: userId,
        ip_address: '127.0.0.1',
        device_id: 'browser'
      });

    // Update local mockDb user cache
    const localUserIdx = mockDb.users.findIndex(u => u.id === userId);
    if (localUserIdx !== -1) {
      mockDb.users[localUserIdx].role = roleCode;
      mockDb.saveAll();
    }
  },

  async assignUserRole(adminId: string, targetUserId: string, roleCode: UserRole): Promise<void> {
    const { data: admin } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

    const { data: targetUser } = await supabaseAdmin.from('users').select('school_id').eq('id', targetUserId).single();
    if (!targetUser || (admin.role !== 'SUPER_ADMIN' && targetUser.school_id !== admin.school_id)) {
      throw new Error('Access Denied: Target user belongs to a different school.');
    }

    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('*')
      .eq('user_id', targetUserId)
      .eq('role_code', roleCode)
      .maybeSingle();

    if (existingRole) {
      if (existingRole.status === 'ACTIVE') {
        throw new Error('User already has this role active.');
      }
      await supabaseAdmin
        .from('user_roles')
        .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
        .eq('id', existingRole.id);

      await supabaseAdmin.from('role_changes').insert({
        event_type: 'ROLE_REACTIVATED',
        user_id: targetUserId,
        school_id: targetUser.school_id,
        old_value: 'INACTIVE',
        new_value: 'ACTIVE',
        changed_by: adminId,
        ip_address: '127.0.0.1',
        device_id: 'browser'
      });
    } else {
      await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: targetUserId,
          school_id: targetUser.school_id,
          role_code: roleCode,
          status: 'ACTIVE',
          assigned_by: adminId
        });

      await supabaseAdmin.from('role_changes').insert({
        event_type: 'ROLE_CREATED',
        user_id: targetUserId,
        school_id: targetUser.school_id,
        old_value: null,
        new_value: roleCode,
        changed_by: adminId,
        ip_address: '127.0.0.1',
        device_id: 'browser'
      });
    }

    await supabaseAdmin.from('users').update({ is_active: true }).eq('id', targetUserId);
  },

  async removeUserRole(adminId: string, targetUserId: string, roleCode: UserRole): Promise<void> {
    const { data: admin } = await supabaseAdmin.from('users').select('school_id, role').eq('id', adminId).single();
    if (!admin || !['ADMIN', 'SUPER_ADMIN'].includes(admin.role)) throw new Error('Unauthorized');

    const { data: targetUser } = await supabaseAdmin.from('users').select('school_id').eq('id', targetUserId).single();
    if (!targetUser || (admin.role !== 'SUPER_ADMIN' && targetUser.school_id !== admin.school_id)) {
      throw new Error('Access Denied: Target user belongs to a different school.');
    }

    await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', targetUserId)
      .eq('role_code', roleCode);

    await supabaseAdmin.from('role_changes').insert({
      event_type: 'ROLE_REMOVED',
      user_id: targetUserId,
      school_id: targetUser.school_id,
      old_value: roleCode,
      new_value: null,
      changed_by: adminId,
      ip_address: '127.0.0.1',
      device_id: 'browser'
    });

    const { data: activeRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role_code')
      .eq('user_id', targetUserId)
      .eq('status', 'ACTIVE');

    const activeCount = activeRoles?.length || 0;
    if (activeCount === 0) {
      await supabaseAdmin.from('users').update({ is_active: false }).eq('id', targetUserId);
    } else if (activeRoles && activeRoles.length > 0) {
      const remainingRole = activeRoles[0].role_code;
      await supabaseAdmin.from('users').update({ role: remainingRole }).eq('id', targetUserId);
    }
  },

  async fetchBudgets(schoolId: string, academicSessionId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchBudgets');
    const { data, error } = await supabaseAdmin
      .from('sports_budget_allocations')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      allocatedAmount: Number(r.allocated_amount),
      spentAmount: Number(r.spent_amount),
      category: r.category,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async allocateBudget(userId: string, budget: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    // 1. Fetch old amount to record in history
    const { data: existing } = await supabaseAdmin
      .from('sports_budget_allocations')
      .select('id, allocated_amount')
      .eq('school_id', user.school_id)
      .eq('academic_session_id', budget.academicSessionId)
      .eq('category', budget.category)
      .maybeSingle();

    const oldAmount = existing ? Number(existing.allocated_amount) : 0;
    const newAmount = Number(budget.allocatedAmount);

    // 2. Upsert
    const { data, error } = await supabaseAdmin
      .from('sports_budget_allocations')
      .upsert({
        school_id: user.school_id,
        academic_session_id: budget.academicSessionId,
        allocated_amount: newAmount,
        category: budget.category,
        created_by: userId
      }, { onConflict: 'school_id,academic_session_id,category' })
      .select()
      .single();
    
    if (error) throw error;
    
    // 3. Log to budget history
    if (oldAmount !== newAmount) {
      await supabaseAdmin
        .from('sports_budget_history')
        .insert({
          school_id: user.school_id,
          category: budget.category,
          old_amount: oldAmount,
          new_amount: newAmount,
          updated_by: userId
        });
    }

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', 'ALLOCATE_BUDGET', `Allocated ₹${budget.allocatedAmount} budget for ${budget.category}`, undefined, undefined, { budgetId: data.id });
    return data;
  },

  async fetchExpenses(schoolId: string, academicSessionId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchExpenses');
    const { data, error } = await supabaseAdmin
      .from('sports_expense_requests')
      .select('*, requester:users!requested_by(first_name, last_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: academicSessionId,
      category: 'EQUIPMENT_PURCHASE',
      title: r.item_name,
      description: r.reason,
      amountRequested: Number(r.amount),
      amountApproved: r.status === 'APPROVED' ? Number(r.amount) : null,
      requestedBy: r.requested_by,
      approvedBy: null,
      status: r.status,
      vendor: r.vendor,
      invoiceNumber: r.invoice_id,
      paymentStatus: r.payment_status,
      referenceId: null,
      createdAt: r.created_at,
      updatedAt: r.created_at,
      requestedByName: r.requester ? `${r.requester.first_name} ${r.requester.last_name}` : 'Unknown',
      approvedByName: null
    }));
  },

  async requestExpense(userId: string, expense: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_expense_requests')
      .insert({
        school_id: user.school_id,
        item_name: expense.title,
        vendor: expense.vendor,
        invoice_id: expense.invoiceNumber || null,
        amount: Number(expense.amountRequested),
        requested_by: userId,
        reason: expense.description || 'No reason provided',
        status: 'PENDING',
        payment_status: 'PENDING'
      })
      .select()
      .single();
    
    if (error) throw error;

    await this.logSportsActivity(user.school_id, userId, user.role, 'REQUEST_EXPENSE', `Requested expense ₹${expense.amountRequested} for ${expense.title}`, undefined, undefined, { expenseId: data.id });
    return data;
  },

  async approveExpense(userId: string, expenseId: string, approveData: { status: 'APPROVED' | 'REJECTED'; amountApproved?: number }): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_expense_requests')
      .update({
        status: approveData.status,
        approved_at: approveData.status === 'APPROVED' ? new Date().toISOString() : null
      })
      .eq('id', expenseId)
      .select()
      .single();
    
    if (error) throw error;

    if (approveData.status === 'APPROVED') {
      const { data: budget } = await supabaseAdmin
        .from('sports_budget_allocations')
        .select('id, spent_amount')
        .eq('school_id', user.school_id)
        .eq('category', 'EQUIPMENT')
        .maybeSingle();
      
      if (budget) {
        await supabaseAdmin
          .from('sports_budget_allocations')
          .update({
            spent_amount: Number(budget.spent_amount) + Number(data.amount)
          })
          .eq('id', budget.id);
      }
    }

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', approveData.status === 'APPROVED' ? 'APPROVE_EXPENSE' : 'REJECT_EXPENSE', `${approveData.status === 'APPROVED' ? 'Approved' : 'Rejected'} expense of ₹${data.amount}`, undefined, undefined, { expenseId });
    return data;
  },

  async releaseExpensePayment(userId: string, expenseId: string): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_expense_requests')
      .update({
        payment_status: 'RELEASED'
      })
      .eq('id', expenseId)
      .select()
      .single();
    
    if (error) throw error;

    try {
      await supabaseAdmin.from('sports_finance_transactions').insert({
        school_id: user.school_id,
        academic_session_id: null,
        type: 'EXPENSE',
        category: 'EQUIPMENT_PURCHASE',
        amount: Number(data.amount),
        reference_id: expenseId,
        status: 'APPROVED',
        remarks: `Payment released for expense: ${data.item_name}`
      });
    } catch (e) {
      console.warn("Failed to write to sports_finance_transactions:", e);
    }

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', 'RELEASE_EXPENSE_PAYMENT', `Released payment for expense ${data.item_name}`, undefined, undefined, { expenseId });
    return data;
  },

  async generateMonthlyPayroll(userId: string, academicSessionId: string, month: string): Promise<void> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    // Fetch all active coaches for the school
    const { data: coaches, error: coachesErr } = await supabaseAdmin
      .from('sports_coaches')
      .select('*')
      .eq('school_id', user.school_id)
      .eq('status', 'ACTIVE');
    
    if (coachesErr) throw coachesErr;
    if (!coaches || coaches.length === 0) {
      throw new Error('No active coaches found in this school.');
    }

    // For each coach, check if request already exists for that month
    for (const coach of coaches) {
      const { data: existing } = await supabaseAdmin
        .from('sports_salary_requests')
        .select('id')
        .eq('school_id', user.school_id)
        .eq('employee_id', coach.user_id)
        .eq('salary_month', month)
        .maybeSingle();

      if (!existing) {
        // Create request
        await supabaseAdmin
          .from('sports_salary_requests')
          .insert({
            school_id: user.school_id,
            employee_id: coach.user_id,
            employee_type: 'COACH',
            salary_month: month,
            gross_salary: Number(coach.salary || 0),
            bonus: 0,
            deductions: 0,
            net_salary: Number(coach.salary || 0),
            status: 'PENDING',
            requested_by: userId
          });
      }
    }

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', 'GENERATE_PAYROLL', `Generated monthly payroll for: ${month}`, undefined, undefined, { month });
  },

  async fetchSalaryRequests(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSalaryRequests');
    const { data, error } = await supabaseAdmin
      .from('sports_salary_requests')
      .select('*, employee:users!employee_id(first_name, last_name), requester:users!requested_by(first_name, last_name)')
      .eq('school_id', schoolId)
      .order('salary_month', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      employeeId: r.employee_id,
      employeeType: r.employee_type,
      salaryMonth: r.salary_month,
      grossSalary: Number(r.gross_salary),
      bonus: Number(r.bonus),
      deductions: Number(r.deductions),
      netSalary: Number(r.net_salary),
      status: r.status,
      requestedBy: r.requested_by,
      approvedBy: r.approved_by,
      requestedAt: r.requested_at,
      approvedAt: r.approved_at,
      transactionId: r.transaction_id,
      paymentDate: r.payment_date,
      employeeName: r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : 'Unknown Employee',
      requestedByName: r.requester ? `${r.requester.first_name} ${r.requester.last_name}` : 'System'
    }));
  },

  async createSalaryRequest(userId: string, request: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['SPORTS_ADMIN', 'FINANCE_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error('Unauthorized');
    }
    const netSalary = Number(request.grossSalary) + Number(request.bonus || 0) - Number(request.deductions || 0);

    const { data, error } = await supabaseAdmin
      .from('sports_salary_requests')
      .insert({
        school_id: user.school_id,
        employee_id: request.employeeId,
        employee_type: request.employeeType,
        salary_month: request.salaryMonth,
        gross_salary: Number(request.grossSalary),
        bonus: Number(request.bonus || 0),
        deductions: Number(request.deductions || 0),
        net_salary: netSalary,
        status: 'PENDING',
        requested_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async approveSalaryRecord(userId: string, salaryId: string): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_salary_requests')
      .update({
        status: 'APPROVED',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', salaryId)
      .select()
      .single();
    
    if (error) throw error;

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', 'APPROVE_SALARY', `Approved salary payout request`, undefined, undefined, { salaryId });
    return data;
  },

  async rejectSalaryRecord(userId: string, salaryId: string): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_salary_requests')
      .update({
        status: 'REJECTED',
        approved_by: userId,
        approved_at: new Date().toISOString()
      })
      .eq('id', salaryId)
      .select()
      .single();
    
    if (error) throw error;

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', 'REJECT_SALARY', `Rejected salary payout request`, undefined, undefined, { salaryId });
    return data;
  },

  async paySalaryRecord(userId: string, salaryId: string, payData: { transactionId?: string }): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    const { data: existingRecord } = await supabaseAdmin
      .from('sports_salary_requests')
      .select('net_salary')
      .eq('id', salaryId)
      .single();
    
    if (!existingRecord) throw new Error('Salary request not found');

    const finalAmount = Number(existingRecord.net_salary);

    const { data, error } = await supabaseAdmin
      .from('sports_salary_requests')
      .update({
        status: 'PAID',
        transaction_id: payData.transactionId || `TXN-SAL-${Math.floor(Math.random() * 900000 + 100000)}`,
        payment_date: new Date().toISOString()
      })
      .eq('id', salaryId)
      .select()
      .single();
    
    if (error) throw error;

    try {
      await supabaseAdmin.from('sports_finance_transactions').insert({
        school_id: user.school_id,
        academic_session_id: null,
        type: 'EXPENSE',
        category: 'SALARY_PAYOUT',
        amount: finalAmount,
        reference_id: salaryId,
        status: 'APPROVED',
        remarks: `Salary payout processed for employee`
      });
    } catch (e) {
      console.warn("Failed to write to sports_finance_transactions:", e);
    }

    try {
      const { data: budget } = await supabaseAdmin
        .from('sports_budget_allocations')
        .select('id, spent_amount')
        .eq('school_id', user.school_id)
        .eq('category', 'SALARY')
        .maybeSingle();
      
      if (budget) {
        await supabaseAdmin
          .from('sports_budget_allocations')
          .update({
            spent_amount: Number(budget.spent_amount) + finalAmount
          })
          .eq('id', budget.id);
      }
    } catch (e) {
      console.warn("Failed to update budget allocations for salary payout:", e);
    }

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', 'PAY_SALARY', `Completed payment of ₹${finalAmount} for salary`, undefined, undefined, { salaryId });
    return data;
  },

  async fetchFines(schoolId: string, academicSessionId: string, studentId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchFines');
    let query = supabaseAdmin
      .from('sports_fines')
      .select('*, students(*, users(first_name, last_name))')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId);
    
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      studentId: r.student_id,
      amount: Number(r.amount),
      reason: r.reason,
      status: r.status,
      dueDate: r.due_date,
      paymentDate: r.payment_date,
      utrNumber: r.utr_number,
      paymentScreenshotUrl: r.payment_screenshot_url,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student'
    }));
  },

  async issueFine(userId: string, fine: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN', 'COACH', 'TEACHER'].includes(user.role)) throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_fines')
      .insert({
        school_id: user.school_id,
        academic_session_id: fine.academicSessionId,
        student_id: fine.studentId,
        amount: Number(fine.amount),
        reason: fine.reason,
        due_date: fine.dueDate,
        status: 'UNPAID'
      })
      .select()
      .single();
    
    if (error) throw error;

    await this.logSportsActivity(user.school_id, userId, user.role, 'ISSUE_FINE', `Issued fine of ₹${fine.amount} to student`, undefined, undefined, { fineId: data.id });
    return data;
  },

  async submitFinePayment(fineId: string, payData: { utrNumber: string; screenshotUrl?: string }): Promise<any> {
    const { data: fine } = await supabaseAdmin
      .from('sports_fines')
      .select('*')
      .eq('id', fineId)
      .single();
    if (!fine) throw new Error('Fine record not found');

    const { data, error } = await supabaseAdmin
      .from('sports_fine_payments')
      .insert({
        school_id: fine.school_id,
        student_id: fine.student_id,
        amount: Number(fine.amount),
        reason: fine.reason,
        utr_reference: payData.utrNumber,
        proof_image_url: payData.screenshotUrl || null,
        status: 'PENDING'
      })
      .select()
      .single();
    
    if (error) throw error;

    await supabaseAdmin
      .from('sports_fines')
      .update({
        utr_number: payData.utrNumber,
        payment_screenshot_url: payData.screenshotUrl || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', fineId);

    return data;
  },

  async approveFinePayment(userId: string, paymentId: string, status: 'APPROVED' | 'REJECTED'): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || user.role !== 'FINANCE_ADMIN') throw new Error('Unauthorized');

    const { data: payment, error } = await supabaseAdmin
      .from('sports_fine_payments')
      .update({
        status: status,
        approved_at: status === 'APPROVED' ? new Date().toISOString() : null
      })
      .eq('id', paymentId)
      .select()
      .single();
    
    if (error) throw error;

    const { data: matchingFines } = await supabaseAdmin
      .from('sports_fines')
      .select('id')
      .eq('student_id', payment.student_id)
      .eq('amount', payment.amount)
      .eq('status', 'UNPAID');

    if (matchingFines && matchingFines.length > 0) {
      const targetFineId = matchingFines[0].id;
      if (status === 'APPROVED') {
        await supabaseAdmin
          .from('sports_fines')
          .update({
            status: 'PAID',
            payment_date: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', targetFineId);
      } else {
        await supabaseAdmin
          .from('sports_fines')
          .update({
            utr_number: null,
            payment_screenshot_url: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', targetFineId);
      }
    }

    if (status === 'APPROVED') {
      try {
        await supabaseAdmin.from('sports_finance_transactions').insert({
          school_id: user.school_id,
          academic_session_id: null,
          type: 'REVENUE',
          category: 'FINE',
          amount: Number(payment.amount),
          reference_id: paymentId,
          status: 'APPROVED',
          remarks: `Fine payment approved: ${payment.reason}`
        });
      } catch (e) {
        console.warn("Failed to write to sports_finance_transactions:", e);
      }
    }

    await this.logSportsActivity(user.school_id, userId, 'FINANCE_ADMIN', status === 'APPROVED' ? 'APPROVE_FINE' : 'REJECT_FINE', `${status === 'APPROVED' ? 'Approved' : 'Rejected'} fine payment of ₹${payment.amount}`, undefined, undefined, { paymentId });
    return payment;
  },

  async fetchBudgetHistory(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchBudgetHistory');
    const { data, error } = await supabaseAdmin
      .from('sports_budget_history')
      .select('*, updater:users!updated_by(first_name, last_name)')
      .eq('school_id', schoolId)
      .order('updated_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      oldAmount: Number(r.old_amount),
      newAmount: Number(r.new_amount),
      updatedBy: r.updated_by,
      updatedAt: r.updated_at,
      category: r.category || 'General',
      updatedByName: r.updater ? `${r.updater.first_name} ${r.updater.last_name}` : 'Unknown Admin'
    }));
  },

  async fetchFinePayments(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchFinePayments');
    const { data, error } = await supabaseAdmin
      .from('sports_fine_payments')
      .select('*, students(*, users(first_name, last_name))')
      .eq('school_id', schoolId)
      .order('submitted_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      studentId: r.student_id,
      amount: Number(r.amount),
      reason: r.reason,
      utrNumber: r.utr_number,
      paymentScreenshotUrl: r.proof_image_url,
      status: r.status,
      submittedAt: r.submitted_at,
      studentName: r.students?.users ? `${r.students.users.first_name} ${r.students.users.last_name}` : 'Unknown Student'
    }));
  },


  async fetchFinanceTransactions(schoolId: string, academicSessionId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchFinanceTransactions');
    const { data, error } = await supabaseAdmin
      .from('sports_finance_transactions')
      .select('*')
      .eq('school_id', schoolId)
      .eq('academic_session_id', academicSessionId)
      .order('transaction_date', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      academicSessionId: r.academic_session_id,
      type: r.type,
      category: r.category,
      amount: Number(r.amount),
      referenceId: r.reference_id,
      transactionDate: r.transaction_date,
      status: r.status,
      remarks: r.remarks,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  },

  async fetchSportsActivityLogs(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsActivityLogs');
    const { data, error } = await supabaseAdmin
      .from('sports_activity_logs')
      .select('*, users(first_name, last_name)')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      userId: r.user_id,
      userRole: r.user_role,
      actionType: r.action_type,
      affectedRecord: r.affected_record,
      ipAddress: r.ip_address,
      device: r.device,
      details: r.details,
      createdAt: r.created_at,
      userName: r.users ? `${r.users.first_name} ${r.users.last_name}` : 'System'
    }));
  },

  async logSportsActivity(
    schoolId: string, 
    userId: string, 
    userRole: string, 
    actionType: string, 
    affectedRecord: string, 
    ipAddress?: string, 
    device?: string, 
    details?: any
  ): Promise<void> {
    await supabaseAdmin.from('sports_activity_logs').insert({
      school_id: schoolId,
      user_id: userId,
      user_role: userRole,
      action_type: actionType,
      affected_record: affectedRecord,
      ip_address: ipAddress || '127.0.0.1',
      device: device || 'Web Browser',
      details: details || {}
    });
  },

  async fetchSportsNotifications(schoolId: string, userId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchSportsNotifications');
    const { data, error } = await supabaseAdmin
      .from('sports_notifications')
      .select('*')
      .eq('school_id', schoolId)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      userId: r.user_id,
      title: r.title,
      message: r.message,
      channel: r.channel,
      isRead: r.is_read,
      createdAt: r.created_at
    }));
  },

  async markSportsNotificationRead(notificationId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('sports_notifications')
      .update({ is_read: true, updated_at: new Date().toISOString() })
      .eq('id', notificationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async fetchCoachAttendance(schoolId: string, date?: string, coachId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchCoachAttendance');
    let query = supabaseAdmin
      .from('sports_coach_attendance')
      .select('*, sports_coaches(*, users(email))')
      .eq('school_id', schoolId)
      .is('deleted_at', null); // Soft delete filter
    
    if (date) {
      query = query.eq('attendance_date', date);
    }
    if (coachId) {
      query = query.eq('coach_id', coachId);
    }

    const { data, error } = await query.order('attendance_date', { ascending: false });
    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      coachId: r.coach_id,
      attendanceDate: r.attendance_date,
      status: r.status,
      checkIn: r.check_in,
      checkOut: r.check_out,
      workingHours: Number(r.working_hours || 0),
      remarks: r.remarks,
      deviceId: r.device_id,
      ipAddress: r.ip_address,
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      attendanceSource: r.attendance_source,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      coachName: r.sports_coaches?.coach_name || 'Unknown Coach',
      coachEmail: r.sports_coaches?.users?.email || ''
    }));
  },

  async markCoachAttendance(userId: string, record: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    // Retrieve existing active record
    const { data: existing } = await supabaseAdmin
      .from('sports_coach_attendance')
      .select('*')
      .eq('school_id', user.school_id)
      .eq('coach_id', record.coachId)
      .eq('attendance_date', record.attendanceDate)
      .is('deleted_at', null)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      const hasChanges = existing.status !== record.status ||
                         existing.check_in !== (record.checkIn || null) ||
                         existing.check_out !== (record.checkOut || null) ||
                         existing.working_hours !== Number(record.workingHours || 0) ||
                         existing.remarks !== (record.remarks || null);
      
      if (hasChanges) {
        const oldValueStr = JSON.stringify({
          status: existing.status,
          check_in: existing.check_in,
          check_out: existing.check_out,
          working_hours: existing.working_hours,
          remarks: existing.remarks
        });
        const newValueStr = JSON.stringify({
          status: record.status,
          check_in: record.checkIn || null,
          check_out: record.checkOut || null,
          working_hours: record.workingHours || 0,
          remarks: record.remarks || null
        });

        const res = await supabaseAdmin
          .from('sports_coach_attendance')
          .update({
            status: record.status,
            check_in: record.checkIn || null,
            check_out: record.checkOut || null,
            working_hours: Number(record.workingHours || 0),
            remarks: record.remarks || null,
            device_id: record.deviceId || existing.device_id || null,
            ip_address: record.ipAddress || existing.ip_address || null,
            latitude: record.latitude || existing.latitude || null,
            longitude: record.longitude || existing.longitude || null,
            attendance_source: record.attendanceSource || existing.attendance_source || 'MANUAL',
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        
        data = res.data;
        error = res.error;

        if (!error && data) {
          // Log edit history
          await supabaseAdmin
            .from('sports_coach_attendance_history')
            .insert({
              school_id: user.school_id,
              attendance_id: existing.id,
              old_value: oldValueStr,
              new_value: newValueStr,
              edited_by: userId,
              edit_reason: record.editReason || 'Administrative update'
            });
        }
      } else {
        data = existing;
      }
    } else {
      const res = await supabaseAdmin
        .from('sports_coach_attendance')
        .insert({
          school_id: user.school_id,
          coach_id: record.coachId,
          attendance_date: record.attendanceDate,
          status: record.status,
          check_in: record.checkIn || null,
          check_out: record.checkOut || null,
          working_hours: Number(record.workingHours || 0),
          remarks: record.remarks || null,
          device_id: record.deviceId || null,
          ip_address: record.ipAddress || null,
          latitude: record.latitude || null,
          longitude: record.longitude || null,
          attendance_source: record.attendanceSource || 'MANUAL',
          created_by: userId
        })
        .select()
        .single();
      
      data = res.data;
      error = res.error;
    }

    if (error) throw error;

    await this.logSportsActivity(
      user.school_id, 
      userId, 
      user.role, 
      'MARK_COACH_ATTENDANCE', 
      `Marked attendance for coach on ${record.attendanceDate} as ${record.status}`,
      undefined,
      undefined,
      { attendanceId: data.id }
    );
    return data;
  },

  async fetchCoachLeaves(schoolId: string, coachId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchCoachLeaves');
    let query = supabaseAdmin
      .from('sports_coach_leaves')
      .select('*, sports_coaches(coach_name)')
      .eq('school_id', schoolId);
    
    if (coachId) {
      query = query.eq('coach_id', coachId);
    }

    const { data, error } = await query.order('start_date', { ascending: false });
    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      coachId: r.coach_id,
      startDate: r.start_date,
      endDate: r.end_date,
      leaveType: r.leave_type,
      status: r.status,
      reason: r.reason,
      approvedBy: r.approved_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      coachName: r.sports_coaches?.coach_name || 'Unknown Coach'
    }));
  },

  async applyCoachLeave(userId: string, leaveData: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id').eq('id', userId).single();
    if (!user) throw new Error('Unauthorized');
    
    const { data: coachProfile } = await supabaseAdmin
      .from('sports_coaches')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (!coachProfile) throw new Error('Coach profile not found for user');

    const { data, error } = await supabaseAdmin
      .from('sports_coach_leaves')
      .insert({
        school_id: user.school_id,
        coach_id: coachProfile.id,
        start_date: leaveData.startDate,
        end_date: leaveData.endDate,
        leave_type: leaveData.leaveType,
        reason: leaveData.reason || null,
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) throw error;

    await this.logSportsActivity(
      user.school_id, 
      userId, 
      'COACH', 
      'APPLY_LEAVE', 
      `Applied for leave from ${leaveData.startDate} to ${leaveData.endDate}`,
      undefined,
      undefined,
      { leaveId: data.id }
    );
    return data;
  },

  async approveCoachLeave(userId: string, leaveId: string, status: 'APPROVED' | 'REJECTED'): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_coach_leaves')
      .update({
        status,
        approved_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', leaveId)
      .select()
      .single();

    if (error) throw error;

    await this.logSportsActivity(
      user.school_id, 
      userId, 
      user.role, 
      status === 'APPROVED' ? 'APPROVE_LEAVE' : 'REJECT_LEAVE', 
      `${status === 'APPROVED' ? 'Approved' : 'Rejected'} leave application`,
      undefined,
      undefined,
      { leaveId }
    );
    return data;
  },

  async fetchCoachWorkLogs(schoolId: string, coachId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchCoachWorkLogs');
    let query = supabaseAdmin
      .from('sports_coach_work_logs')
      .select('*, sports_coaches(coach_name)')
      .eq('school_id', schoolId);
    
    if (coachId) {
      query = query.eq('coach_id', coachId);
    }

    const { data, error } = await query.order('log_date', { ascending: false });
    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      coachId: r.coach_id,
      logDate: r.log_date,
      sessionName: r.session_name,
      loginTime: r.login_time,
      logoutTime: r.logout_time,
      durationMinutes: r.duration_minutes,
      sessionType: r.session_type,
      deviceId: r.device_id,
      ipAddress: r.ip_address,
      latitude: r.latitude ? Number(r.latitude) : null,
      longitude: r.longitude ? Number(r.longitude) : null,
      attendanceSource: r.attendance_source,
      createdAt: r.created_at,
      coachName: r.sports_coaches?.coach_name || 'Unknown Coach'
    }));
  },

  async logCoachWorkSession(userId: string, logData: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id').eq('id', userId).single();
    if (!user) throw new Error('Unauthorized');

    const { data: coachProfile } = await supabaseAdmin
      .from('sports_coaches')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (!coachProfile) throw new Error('Coach profile not found for user');

    let duration = Number(logData.durationMinutes || 0);
    if (!duration && logData.loginTime && logData.logoutTime) {
      const diff = new Date(logData.logoutTime).getTime() - new Date(logData.loginTime).getTime();
      duration = Math.max(0, Math.floor(diff / 60000));
    }

    const { data, error } = await supabaseAdmin
      .from('sports_coach_work_logs')
      .insert({
        school_id: user.school_id,
        coach_id: coachProfile.id,
        log_date: logData.logDate,
        session_name: logData.sessionName || 'Training Session',
        login_time: logData.loginTime || null,
        logout_time: logData.logoutTime || null,
        duration_minutes: duration,
        session_type: logData.sessionType || 'PRACTICE',
        device_id: logData.deviceId || null,
        ip_address: logData.ipAddress || null,
        latitude: logData.latitude || null,
        longitude: logData.longitude || null,
        attendance_source: logData.attendanceSource || 'MANUAL'
      })
      .select()
      .single();

    if (error) throw error;

    // Recalculate total working hours for coach on logDate
    const { data: logs } = await supabaseAdmin
      .from('sports_coach_work_logs')
      .select('duration_minutes')
      .eq('coach_id', coachProfile.id)
      .eq('log_date', logData.logDate);
    
    const totalMinutes = (logs || []).reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
    const totalHours = Number((totalMinutes / 60).toFixed(2));

    const { data: existingAttendance } = await supabaseAdmin
      .from('sports_coach_attendance')
      .select('*')
      .eq('coach_id', coachProfile.id)
      .eq('attendance_date', logData.logDate)
      .is('deleted_at', null)
      .maybeSingle();

    if (existingAttendance) {
      await supabaseAdmin
        .from('sports_coach_attendance')
        .update({
          working_hours: totalHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAttendance.id);
    } else {
      await supabaseAdmin
        .from('sports_coach_attendance')
        .insert({
          school_id: user.school_id,
          coach_id: coachProfile.id,
          attendance_date: logData.logDate,
          status: 'PRESENT',
          working_hours: totalHours,
          created_by: userId,
          attendance_source: logData.attendanceSource || 'MANUAL',
          device_id: logData.deviceId || null,
          ip_address: logData.ipAddress || null,
          latitude: logData.latitude || null,
          longitude: logData.longitude || null
        });
    }

    return data;
  },

  async fetchCoachAttendanceCorrections(schoolId: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchCoachAttendanceCorrections');
    const { data, error } = await supabaseAdmin
      .from('sports_coach_attendance_corrections')
      .select('*, sports_coach_attendance(attendance_date, sports_coaches(coach_name))')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;

    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      attendanceId: r.attendance_id,
      requestedStatus: r.requested_status,
      requestedCheckIn: r.requested_check_in,
      requestedCheckOut: r.requested_check_out,
      reason: r.reason,
      status: r.status,
      approvedBy: r.approved_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      coachName: r.sports_coach_attendance?.sports_coaches?.coach_name || 'Unknown Coach',
      attendanceDate: r.sports_coach_attendance?.attendance_date
    }));
  },

  async submitAttendanceCorrection(userId: string, correctionRequest: any): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id').eq('id', userId).single();
    if (!user) throw new Error('Unauthorized');

    const { data, error } = await supabaseAdmin
      .from('sports_coach_attendance_corrections')
      .insert({
        school_id: user.school_id,
        attendance_id: correctionRequest.attendanceId,
        requested_status: correctionRequest.requestedStatus,
        requested_check_in: correctionRequest.requestedCheckIn || null,
        requested_check_out: correctionRequest.requestedCheckOut || null,
        reason: correctionRequest.reason,
        status: 'PENDING'
      })
      .select()
      .single();

    if (error) throw error;

    await this.logSportsActivity(
      user.school_id, 
      userId, 
      'COACH', 
      'SUBMIT_ATTENDANCE_CORRECTION', 
      `Submitted correction request for attendance log`,
      undefined,
      undefined,
      { correctionId: data.id }
    );
    return data;
  },

  async approveAttendanceCorrection(userId: string, correctionId: string, status: 'APPROVED' | 'REJECTED'): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    const { data: corr } = await supabaseAdmin
      .from('sports_coach_attendance_corrections')
      .select('*')
      .eq('id', correctionId)
      .single();
    
    if (!corr) throw new Error('Correction request not found');

    const { data, error } = await supabaseAdmin
      .from('sports_coach_attendance_corrections')
      .update({
        status,
        approved_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', correctionId)
      .select()
      .single();

    if (error) throw error;

    if (status === 'APPROVED') {
      let workingHours = 0;
      if (corr.requested_check_in && corr.requested_check_out) {
        const [inH, inM] = corr.requested_check_in.split(':').map(Number);
        const [outH, outM] = corr.requested_check_out.split(':').map(Number);
        workingHours = (outH + outM / 60) - (inH + inM / 60);
        if (workingHours < 0) workingHours += 24;
      }

      await supabaseAdmin
        .from('sports_coach_attendance')
        .update({
          status: corr.requested_status,
          check_in: corr.requested_check_in || null,
          check_out: corr.requested_check_out || null,
          working_hours: workingHours,
          updated_at: new Date().toISOString()
        })
        .eq('id', corr.attendance_id);
    }

    await this.logSportsActivity(
      user.school_id, 
      userId, 
      user.role, 
      status === 'APPROVED' ? 'APPROVE_ATTENDANCE_CORRECTION' : 'REJECT_ATTENDANCE_CORRECTION', 
      `${status === 'APPROVED' ? 'Approved' : 'Rejected'} attendance correction request`,
      undefined,
      undefined,
      { correctionId }
    );
    return data;
  },

  async softDeleteCoachAttendance(userId: string, attendanceId: string, reason: string): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('school_id, role').eq('id', userId).single();
    if (!user || !['ADMIN', 'SPORTS_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    const { data: existing } = await supabaseAdmin
      .from('sports_coach_attendance')
      .select('*')
      .eq('id', attendanceId)
      .is('deleted_at', null)
      .single();

    if (!existing) throw new Error('Attendance record not found or already deleted');

    const { data, error } = await supabaseAdmin
      .from('sports_coach_attendance')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', attendanceId)
      .select()
      .single();

    if (error) throw error;

    // Log the edit history for soft deletes
    await supabaseAdmin
      .from('sports_coach_attendance_history')
      .insert({
        school_id: user.school_id,
        attendance_id: attendanceId,
        old_value: JSON.stringify(existing),
        new_value: 'SOFT_DELETED',
        edited_by: userId,
        edit_reason: reason
      });

    await this.logSportsActivity(
      user.school_id,
      userId,
      user.role,
      'DELETE_COACH_ATTENDANCE',
      `Soft deleted attendance record for date ${existing.attendance_date}`,
      undefined,
      undefined,
      { attendanceId }
    );
    return data;
  },

  async fetchCoachAttendanceHistory(schoolId: string, attendanceId?: string): Promise<any[]> {
    validateSchoolId(schoolId, 'fetchCoachAttendanceHistory');
    let query = supabaseAdmin
      .from('sports_coach_attendance_history')
      .select('*, users(first_name, last_name)')
      .eq('school_id', schoolId);
    
    if (attendanceId) {
      query = query.eq('attendance_id', attendanceId);
    }
    
    const { data, error } = await query.order('edited_at', { ascending: false });
    if (error) throw error;
    
    return (data || []).map(r => ({
      id: r.id,
      schoolId: r.school_id,
      attendanceId: r.attendance_id,
      oldValue: r.old_value,
      newValue: r.new_value,
      editedBy: r.edited_by,
      editedAt: r.edited_at,
      editReason: r.edit_reason,
      editorName: r.users ? `${r.users.first_name} ${r.users.last_name}` : 'System'
    }));
  },

  async transferSportsAdmin(adminId: string, sportsAdminUserId: string, targetSchoolId: string): Promise<any> {
    const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', adminId).single();
    if (!user || !['ADMIN', 'SUPER_ADMIN'].includes(user.role)) throw new Error('Unauthorized');

    // Update target user school_id in users
    const { data: updatedUser, error: err1 } = await supabaseAdmin
      .from('users')
      .update({
        school_id: targetSchoolId,
        updated_at: new Date().toISOString()
      })
      .eq('id', sportsAdminUserId)
      .select()
      .single();

    if (err1) throw err1;

    // Update target user school_id in sports_admins
    await supabaseAdmin
      .from('sports_admins')
      .update({
        school_id: targetSchoolId,
        updated_at: new Date().toISOString()
      })
      .eq('user_id', sportsAdminUserId);

    await this.logSportsActivity(targetSchoolId, adminId, user.role, 'TRANSFER_SPORTS_ADMIN', `Transferred Sports Admin to school ${targetSchoolId}`, undefined, undefined, { sportsAdminUserId });
    return updatedUser;
  },

  async deleteSportsCoach(coachId: string): Promise<void> {
    const { data: coach } = await supabaseAdmin.from('sports_coaches').select('user_id').eq('id', coachId).maybeSingle();
    if (!coach) return;

    const { count: teamCount } = await supabaseAdmin.from('sports_teams').select('*', { count: 'exact', head: true }).eq('coach_id', coachId);
    if (teamCount && teamCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: sessionCount } = await supabaseAdmin.from('sports_training_sessions').select('*', { count: 'exact', head: true }).eq('coach_id', coachId);
    if (sessionCount && sessionCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: attCount } = await supabaseAdmin.from('sports_coach_attendance').select('*', { count: 'exact', head: true }).eq('coach_id', coachId);
    if (attCount && attCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: salaryCount } = await supabaseAdmin.from('sports_salary_records').select('*', { count: 'exact', head: true }).eq('user_id', coach.user_id);
    if (salaryCount && salaryCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { error } = await supabaseAdmin.from('sports_coaches').delete().eq('id', coachId);
    if (error) throw error;
  },

  async deleteSportsEnrollment(userId: string, enrollmentId: string): Promise<void> {
    const { data: user } = await supabaseAdmin.from('users').select('role').eq('id', userId).single();
    if (!user || !['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) {
      throw new Error('Unauthorized');
    }

    const { data: enrollment } = await supabaseAdmin.from('sports_enrollments').select('student_id, sport_id').eq('id', enrollmentId).maybeSingle();
    if (!enrollment) return;

    const { count: perfCount } = await supabaseAdmin.from('sports_performance_metrics').select('*', { count: 'exact', head: true }).eq('student_id', enrollment.student_id).eq('sport_id', enrollment.sport_id);
    if (perfCount && perfCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: memberCount } = await supabaseAdmin.from('sports_team_members').select('*', { count: 'exact', head: true }).eq('student_id', enrollment.student_id);
    if (memberCount && memberCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: certCount } = await supabaseAdmin.from('sports_certificates').select('*', { count: 'exact', head: true }).eq('student_id', enrollment.student_id).eq('sport_id', enrollment.sport_id);
    if (certCount && certCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: achCount } = await supabaseAdmin.from('sports_achievements').select('*', { count: 'exact', head: true }).eq('student_id', enrollment.student_id).eq('sport_id', enrollment.sport_id);
    if (achCount && achCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: fineCount } = await supabaseAdmin.from('sports_fines').select('*', { count: 'exact', head: true }).eq('student_id', enrollment.student_id);
    if (fineCount && fineCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { error } = await supabaseAdmin.from('sports_enrollments').delete().eq('id', enrollmentId);
    if (error) throw error;
  },

  async deleteSportsTeam(teamId: string): Promise<void> {
    const { count: memberCount } = await supabaseAdmin.from('sports_team_members').select('*', { count: 'exact', head: true }).eq('team_id', teamId);
    if (memberCount && memberCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: sessCount } = await supabaseAdmin.from('sports_training_sessions').select('*', { count: 'exact', head: true }).eq('team_id', teamId);
    if (sessCount && sessCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: fix1Count } = await supabaseAdmin.from('sports_fixtures').select('*', { count: 'exact', head: true }).eq('team1_id', teamId);
    if (fix1Count && fix1Count > 0) throw new Error("Cannot delete this record because related records exist.");

    const { count: fix2Count } = await supabaseAdmin.from('sports_fixtures').select('*', { count: 'exact', head: true }).eq('team2_id', teamId);
    if (fix2Count && fix2Count > 0) throw new Error("Cannot delete this record because related records exist.");

    const { error } = await supabaseAdmin.from('sports_teams').delete().eq('id', teamId);
    if (error) throw error;
  },

  async deleteSportsTrainingSession(sessionId: string): Promise<void> {
    const { count: attCount } = await supabaseAdmin.from('sports_attendance').select('*', { count: 'exact', head: true }).eq('session_id', sessionId);
    if (attCount && attCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { error } = await supabaseAdmin.from('sports_training_sessions').delete().eq('id', sessionId);
    if (error) throw error;
  },

  async deleteSportsTournament(tournamentId: string): Promise<void> {
    const { count: fixCount } = await supabaseAdmin.from('sports_fixtures').select('*', { count: 'exact', head: true }).eq('tournament_id', tournamentId);
    if (fixCount && fixCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { error } = await supabaseAdmin.from('sports_tournaments').delete().eq('id', tournamentId);
    if (error) throw error;
  },

  async deleteSportsEquipment(equipmentId: string): Promise<void> {
    const { count: issuedCount } = await supabaseAdmin.from('sports_equipment_logs').select('*', { count: 'exact', head: true }).eq('equipment_id', equipmentId).eq('status', 'ISSUED');
    if (issuedCount && issuedCount > 0) throw new Error("Cannot delete this record because related records exist.");

    await supabaseAdmin.from('sports_equipment_logs').delete().eq('equipment_id', equipmentId);

    const { error } = await supabaseAdmin.from('sports_equipment').delete().eq('id', equipmentId);
    if (error) throw error;
  },

  async deleteSportsCertificate(certificateId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('sports_certificates').delete().eq('id', certificateId);
    if (error) throw error;
  },

  async deleteSportsAchievement(achievementId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('sports_achievements').delete().eq('id', achievementId);
    if (error) throw error;
  },

  async deleteSportsBudget(budgetId: string): Promise<void> {
    const { data: budget } = await supabaseAdmin.from('sports_budget_allocations').select('spent_amount').eq('id', budgetId).maybeSingle();
    if (!budget) return;

    if (budget.spent_amount && Number(budget.spent_amount) > 0) {
      throw new Error("Cannot delete this record because related records exist.");
    }

    const { error } = await supabaseAdmin.from('sports_budget_allocations').delete().eq('id', budgetId);
    if (error) throw error;
  },

  async deleteSportsExpense(expenseId: string): Promise<void> {
    const { data: expense } = await supabaseAdmin.from('sports_expense_requests').select('status, payment_status').eq('id', expenseId).maybeSingle();
    if (!expense) return;

    if (expense.status === 'APPROVED' || expense.payment_status === 'RELEASED') {
      throw new Error("Cannot delete this record because related records exist.");
    }

    const { count: txCount } = await supabaseAdmin.from('sports_finance_transactions').select('*', { count: 'exact', head: true }).eq('reference_id', expenseId);
    if (txCount && txCount > 0) throw new Error("Cannot delete this record because related records exist.");

    const { error } = await supabaseAdmin.from('sports_expense_requests').delete().eq('id', expenseId);
    if (error) throw error;
  },

  async fetchSchools(): Promise<any[]> {
    const { data, error } = await supabaseAdmin.from('schools').select('id, name');
    if (error) throw error;
    return data || [];
  }
};


