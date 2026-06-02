import { mockDb, getSystemTelemetry } from './mockDb';
import { 
  User, Student, Parent, Teacher, Class, Subject, Timetable, 
  Attendance, Assignment, AssignmentSubmission, Quiz, QuizAttempt, 
  Exam, ExamMark, FeeStructure, FeePayment, PaymentStatus, ChatMessage, Announcement, 
  Notification, AuditLog, StudyMaterial, ExamSchedule, 
  TeacherClassSubjectMapping, QuizQuestion, School, ForumPost, ForumReply, ParentStudentMapping, ForumCategory, PhoneNumber, EmailAddress, Section, HomeworkAttachment,
  Role, RolePermission, DriverSalaryPayout, UserRole
} from '../types';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { subscriptionPlans, SubscriptionFeatures } from './subscriptionConfig';

// Helper to simulate network latency
const delay = (ms = 400) => new Promise(resolve => setTimeout(resolve, ms));

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
      if (['ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN'].includes(session.user.role) && session.user.schoolId) {
        return session.user.schoolId;
      }
    }
  } catch (e) {
    console.error(e);
  }
  return 'school-1'; // default fallback
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

export const isChatAllowed = (roleA: string, roleB: string): boolean => {
  if (roleA === roleB) return false;
  const subAdmins = ['FINANCE_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'ACADEMIC_ADMIN', 'CUSTOM_SUB_ADMIN'];
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


// ── Super Admin Identity Lock ────────────────────────────────────────────────
// ONLY this exact email address is permitted to log in as SUPER_ADMIN.
// Any other email attempting to use a SUPER_ADMIN role will be rejected.
const SUPER_ADMIN_EMAIL = 'jy7018080@gmail.com';

export const mockApi = {
  async validateEnterpriseSubscription(schoolId: string, featureName: string): Promise<void> {
    const livePlan = await this.getLiveSchoolSubscriptionPlan(schoolId);
    if (!livePlan || livePlan.toLowerCase() !== 'enterprise') {
      throw new Error(`Security Policy Violation: Accessing ${featureName} requires an active Enterprise Tier subscription.`);
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

    if (userProfile.is_active === false) {
      mockDb.addLog(userProfile.id, 'LOGIN_BLOCKED', { email });
      throw new Error('Your account has been deactivated. Please contact your school administrator.');
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
          timezone: dbSchool.timezone || 'America/New_York'
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

    // Apply strict boundaries: match class, section (if active), and academic session
    const assignments = mockDb.assignments.filter(a => {
      const classMatches = a.classId === student.classId;
      const sectionMatches = !student.sectionId || !a.sectionId || a.sectionId === student.sectionId;
      const sessionMatches = a.academicSessionId === student.academicSessionId;
      return classMatches && sectionMatches && sessionMatches;
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
          timezone: dbSchool.timezone || 'America/New_York'
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
        .select('*')
        .eq('school_id', schoolId);

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
            createdAt: r.created_at
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
            createdAt: r.created_at
          };
          mockDb.notifications.push(notify);
        });
        mockDb.saveAll();
      }
    } catch (e) {
      console.error('Failed to sync notifications:', e);
    }
  },

  async sendNotification(userId: string, title: string, message: string, type = 'ANNOUNCEMENT', schoolId?: string): Promise<Notification> {
    const student = mockDb.students.find(s => s.userId === userId);
    const teacher = mockDb.teachers.find(t => t.userId === userId);
    const parent = mockDb.parents.find(p => p.userId === userId);
    const resolvedSchoolId = schoolId || student?.schoolId || teacher?.schoolId || parent?.schoolId || null;

    let dbRow: any = null;
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert({
          school_id: resolvedSchoolId,
          user_id: userId,
          title: title,
          content: message,
          type: type,
          is_read: false
        })
        .select()
        .single();
      if (error) throw error;
      dbRow = data;
    } catch (e) {
      console.error('Failed to save notification in DB:', e);
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

    // Assignments Homework with strict section boundaries
    const assignments = mockDb.assignments.filter(a => {
      const classMatches = a.classId === student.classId;
      const sectionMatches = !student.sectionId || !a.sectionId || a.sectionId === student.sectionId;
      const sessionMatches = a.academicSessionId === student.academicSessionId;
      return classMatches && sectionMatches && sessionMatches;
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

  async verifySchoolFeature(schoolId: string, feature: string): Promise<void> {
    const { data: dbSchool } = await supabaseAdmin
      .from('schools')
      .select('subscription_plan')
      .eq('id', schoolId)
      .maybeSingle();
    const planName = dbSchool?.subscription_plan?.toLowerCase() || 'freemium';
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

  async adminMarkAttendance(
    adminId: string, 
    classId: string, 
    date: string, 
    records: { studentId: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; remarks?: string }[]
  ): Promise<void> {
    await delay(500);
    const admin = mockDb.users.find(u => u.id === adminId);
    if (!admin) throw new Error('Admin user not found');
    const schoolId = admin.schoolId;
    if (!schoolId) throw new Error('Admin schoolId is undefined');
    const academicSessionId = await this.resolveActiveSessionId(schoolId);

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
              remarks: rec.remarks || null
            })
            .eq('id', existingRecord.id);
          if (error) throw error;
        } else {
          const { error } = await supabaseAdmin
            .from('attendance')
            .insert({
              school_id: schoolId,
              academic_session_id: academicSessionId,
              student_id: rec.studentId,
              date,
              status: rec.status,
              remarks: rec.remarks || null
            });
          if (error) throw error;
        }
      } catch (err) {
        console.error('Failed to save attendance record to database:', err);
      }
    }

    await this.syncAttendanceData(schoolId);
    mockDb.addLog(adminId, 'MARK_ATTENDANCE_ADMIN', { classId, count: records.length, date });
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

    // Notify all students in class (filtered by section if section boundary is active)
    const studentsInClass = mockDb.students.filter(s => s.classId === classId && (!sectionId || s.sectionId === sectionId));
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

    await this.syncAssignmentsData(schoolId);
    mockDb.addLog(adminId, 'CREATE_HOMEWORK_ADMIN', { title, classId });
    mockDb.saveAll();
    return ass;
  },

  async teacherEditAssignment(assignmentId: string, classId: string, subjectId: string, title: string, description: string, dueDate: string, isHomework: boolean, sectionId?: string | null): Promise<Assignment> {
    await delay(500);

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
          timezone: dbSchool.timezone || 'America/New_York'
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
    const schoolId = getAdminSchoolId();

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
    const schoolId = getAdminSchoolId();

    // Fetch live teacher profiles from Supabase (source of truth)
    const { data: teacherRows, error } = await supabase
      .from('teachers')
      .select(`
        id, user_id, school_id, employee_id, qualification, joining_date, specialization, created_at,
        users!inner(id, email, first_name, last_name, phone, avatar_url, role, school_id, is_active, created_at)
      `)
      .eq('school_id', schoolId);

    if (error || !teacherRows || teacherRows.length === 0) {
      // Graceful fallback to local seed data
      const localT = mockDb.teachers.filter(t => t.schoolId === schoolId);
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
    checkCoreAdminOrAcademicAdmin();
    const schoolId = getAdminSchoolId();
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
    role: 'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER', 
    password: string,
    employeeId?: string
  ): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    const { data: schoolObj } = await supabaseAdmin.from('schools').select('subscription_plan').eq('id', schoolId).single();
    if (schoolObj?.subscription_plan?.toLowerCase() !== 'enterprise') {
      throw new Error('Provisioning sub-admin operators requires an active Enterprise Subscription plan.');
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
      'CUSTOM_SUB_ADMIN': 'Custom Operator'
    };
    const roleDescMap: Record<string, string> = {
      'FINANCE_ADMIN': 'Responsible for billing, invoices, payment structures, and fee tracking.',
      'ACADEMIC_ADMIN': 'Manages classes, sections, timetables, subjects, and study structures.',
      'EXAM_CONTROLLER': 'Administers examinations, quiz configurations, marksheets, and grading books.',
      'LIBRARIAN': 'Manages library book inventory, issue/return logs, and late fee tracking.',
      'TRANSPORT_MANAGER': 'Administers school buses, routes, driver information, and passenger maps.',
      'CUSTOM_SUB_ADMIN': 'Customizable operator role with custom-assigned modular access tags.'
    };
    const defaultRolePermissions: Record<string, Record<string, boolean>> = {
      'FINANCE_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true },
      'ACADEMIC_ADMIN': { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true },
      'EXAM_CONTROLLER': { billing: false, directory: true, academics: true, grading: true, security: false, books: false, transport: false },
      'LIBRARIAN': { billing: false, directory: true, academics: true, grading: false, security: false, books: true, transport: false },
      'TRANSPORT_MANAGER': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true },
      'CUSTOM_SUB_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false }
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
      is_active: true
    };
    if (trimmedEmployeeId) userInsert.employee_id = trimmedEmployeeId;

    const { error: dbError } = await supabaseAdmin.from('users').insert(userInsert);
    
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error('Failed to create user database profile: ' + dbError.message);
    }

    // Dynamically insert into matching dedicated sub-admin table with employee_id
    let dedicatedTable = '';
    if (role === 'FINANCE_ADMIN') dedicatedTable = 'finance_admins';
    else if (role === 'ACADEMIC_ADMIN') dedicatedTable = 'academic_admins';
    else if (role === 'EXAM_CONTROLLER') dedicatedTable = 'exam_controllers';
    else if (role === 'LIBRARIAN') dedicatedTable = 'librarians';
    else if (role === 'TRANSPORT_MANAGER') dedicatedTable = 'transport_managers';
    else if (role === 'CUSTOM_SUB_ADMIN') dedicatedTable = 'custom_sub_admins';

    if (dedicatedTable) {
      const profileInsert: any = {
        user_id: newUserId,
        school_id: schoolId,
        role_id: roleId,
        status: 'ACTIVE',
        permissions: {}
      };
      if (trimmedEmployeeId) profileInsert.employee_id = trimmedEmployeeId;

      const { error: profileErr } = await supabaseAdmin.from(dedicatedTable).insert(profileInsert);
      if (profileErr) {
        // Rollback
        await supabaseAdmin.from('users').delete().eq('id', newUserId);
        await supabaseAdmin.auth.admin.deleteUser(newUserId);
        throw new Error('Failed to create dedicated sub-admin profile record: ' + profileErr.message);
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

    mockDb.addLog(adminId, 'CREATE_SUB_ADMIN', { subAdminName: `${firstName} ${lastName}`, role: role, email: normalizedEmail, employeeId: trimmedEmployeeId || undefined });
    mockDb.saveAll();
  },

  async adminEditSubAdmin(
    adminId: string,
    userId: string,
    email: string,
    firstName: string,
    lastName: string,
    phone: string,
    role: 'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'CUSTOM_SUB_ADMIN',
    employeeId: string,
    isActive: boolean
  ): Promise<void> {
    await delay(600);
    const { data: admin, error: adminErr } = await supabaseAdmin.from('users').select('role, school_id').eq('id', adminId).single();
    if (adminErr || !admin || admin.role !== 'ADMIN') throw new Error('Unauthorized');

    const schoolId = admin.school_id;
    if (!schoolId) throw new Error('Admin has no associated school');

    const { data: schoolObj } = await supabaseAdmin.from('schools').select('subscription_plan').eq('id', schoolId).single();
    if (schoolObj?.subscription_plan?.toLowerCase() !== 'enterprise') {
      throw new Error('Modifying sub-admin operators requires an active Enterprise Subscription plan.');
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
      'CUSTOM_SUB_ADMIN': 'Custom Operator'
    };
    const roleDescMap: Record<string, string> = {
      'FINANCE_ADMIN': 'Responsible for billing, invoices, payment structures, and fee tracking.',
      'ACADEMIC_ADMIN': 'Manages classes, sections, timetables, subjects, and study structures.',
      'EXAM_CONTROLLER': 'Administers examinations, quiz configurations, marksheets, and grading books.',
      'LIBRARIAN': 'Manages library book inventory, issue/return logs, and late fee tracking.',
      'TRANSPORT_MANAGER': 'Administers school buses, routes, driver information, and passenger maps.',
      'CUSTOM_SUB_ADMIN': 'Customizable operator role with custom-assigned modular access tags.'
    };
    const defaultRolePermissions: Record<string, Record<string, boolean>> = {
      'FINANCE_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true },
      'ACADEMIC_ADMIN': { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true },
      'EXAM_CONTROLLER': { billing: false, directory: true, academics: true, grading: true, security: false, books: false, transport: false },
      'LIBRARIAN': { billing: false, directory: true, academics: true, grading: false, security: false, books: true, transport: false },
      'TRANSPORT_MANAGER': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true },
      'CUSTOM_SUB_ADMIN': { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false }
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
      if (roleCode === 'CUSTOM_SUB_ADMIN') return 'custom_sub_admins';
      return '';
    };

    const oldTable = getTableName(oldRole);
    const newTable = getTableName(role);

    if (oldTable && newTable) {
      if (oldTable !== newTable) {
        // Delete old profile, insert new
        await supabaseAdmin.from(oldTable).delete().eq('user_id', userId);
        
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
      } else {
        // Just update existing
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
    const schoolId = getAdminSchoolId();
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
    const schoolId = getAdminSchoolId();
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
        timezone: s.timezone || 'America/New_York'
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
    timezone: string = 'America/New_York'
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

    const schoolMapped: School = {
      id: data.id,
      name: data.name,
      address: data.address || '',
      phone: data.phone || '',
      subscriptionPlan: data.subscription_plan ? (data.subscription_plan.toLowerCase() as any) : 'freemium',
      createdAt: data.created_at,
      country: data.country || country,
      currencyCode: data.currency_code || currencyCode,
      currencySymbol: data.currency_symbol || currencySymbol,
      timezone: data.timezone || timezone
    };

    const idx = mockDb.schools.findIndex(x => x.id === data.id);
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

    const currentUsr = mockDb.users.find(u => u.id === userId);
    if (!currentUsr) return [];

    // Filter contacts based on role contexts (Strict boundary checking) and school isolation
    const allowedContactUserIds = mockDb.users.filter(u => {
      if (u.id === userId) return false;
      
      // Enforce strict school tenant isolation (unless super admin is involved)
      if (currentUsr.role !== 'SUPER_ADMIN' && u.role !== 'SUPER_ADMIN') {
        if (currentUsr.schoolId !== u.schoolId) return false;
      }
      
      // Enforce strict RBAC direct messaging allowed contacts
      return isChatAllowed(currentUsr.role, u.role);
    }).map(u => u.id);

    const chats = mockDb.users.filter(u => allowedContactUserIds.includes(u.id));

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

    const sender = mockDb.users.find(u => u.id === senderId);
    const receiver = mockDb.users.find(u => u.id === receiverId);

    if (!sender || !receiver) throw new Error('Sender or receiver not found');

    // Enforce school isolation
    if (sender.role !== 'SUPER_ADMIN' && receiver.role !== 'SUPER_ADMIN') {
      if (sender.schoolId !== receiver.schoolId) {
        throw new Error('Access Denied: School-scoped tenant isolation violation.');
      }
    }

    // Enforce school subscription validation for communications
    if (sender.role !== 'SUPER_ADMIN' && sender.schoolId) {
      const school = mockDb.schools.find(s => s.id === sender.schoolId);
      if (school) {
        const plan = subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium;
        if (!plan.features.communications) {
          throw new Error(`Direct messaging and communications are not enabled on your ${school.subscriptionPlan} subscription tier. Please upgrade.`);
        }
      }
    }

    // Enforce role DM rules
    if (!isChatAllowed(sender.role, receiver.role)) {
      throw new Error('Unauthorized messaging channel: Direct messaging is restricted between these roles.');
    }

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
    const { data: dbSchool } = await supabaseAdmin
      .from('schools')
      .select('subscription_plan')
      .eq('id', schoolId)
      .maybeSingle();
    const planName = dbSchool?.subscription_plan?.toLowerCase() || 'freemium';
    if (planName !== 'enterprise') {
      throw new Error('Study Materials upload features are only available in the Enterprise subscription plan.');
    }

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
      FINANCE_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true },
      ACADEMIC_ADMIN: { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true },
      EXAM_CONTROLLER: { billing: false, directory: false, academics: true, grading: true, security: false, books: false, transport: false },
      LIBRARIAN: { billing: false, directory: false, academics: true, grading: false, security: false, books: true, transport: false },
      TRANSPORT_MANAGER: { billing: true, directory: false, academics: false, grading: false, security: false, books: false, transport: true },
      CUSTOM_SUB_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false }
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
      'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN'
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
    if (error || !data) return [];
    return data;
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
    return data.map(d => ({
      id: d.id,
      term: d.term,
      attendancePercentage: Number(d.attendance_percentage || 0),
      gradePointAverage: Number(d.grade_point_average || 0),
      remarks: d.remarks || '',
      fileUrl: d.file_url || '',
      createdAt: d.created_at,
      studentName: d.student?.userDetails ? `${d.student.userDetails.first_name} ${d.student.userDetails.last_name}` : 'Unknown Student'
    }));
  },

  async createReportCard(
    schoolId: string, sessionId: string, studentId: string, term: string, 
    attendancePercentage: number, gradePointAverage: number, remarks: string, fileUrl: string
  ): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const resolvedSessionId = (sessionId && isUUID(sessionId)) 
      ? sessionId 
      : await this.resolveActiveSessionId(schoolId);

    const { error } = await supabaseAdmin.from('report_cards').insert({
      school_id: schoolId,
      academic_session_id: resolvedSessionId,
      student_id: studentId,
      term: term,
      attendance_percentage: attendancePercentage,
      grade_point_average: gradePointAverage,
      remarks: remarks,
      file_url: fileUrl
    });
    if (error) throw new Error('Failed to publish student report card: ' + error.message);
  },

  async fetchQuizResults(schoolId: string, studentId?: string): Promise<any[]> {
    let query = supabaseAdmin.from('quiz_results').select('*, student:students(*, userDetails:users(*)), quiz:quizzes(*)').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) return [];
    return data;
  },

  // --- Dedicated Librarian Helpers ---
  async fetchBookInventory(schoolId: string): Promise<any[]> {
    await this.validateEnterpriseSubscription(schoolId, 'Library Books');
    const { data, error } = await supabaseAdmin
      .from('book_inventory')
      .select('*, book:books(*)')
      .eq('school_id', schoolId);
    if (error || !data) return [];
    return data;
  },

  async fetchDigitalLibraryAssets(schoolId: string): Promise<any[]> {
    await this.validateEnterpriseSubscription(schoolId, 'Digital Library Resources');
    const { data, error } = await supabaseAdmin
      .from('digital_library_assets')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return [];
    return data.map(d => ({
      id: d.id,
      title: d.title,
      author: d.author || 'Anonymous',
      fileUrl: d.file_url,
      fileType: d.file_type || 'pdf',
      createdAt: d.created_at
    }));
  },

  // --- Dedicated Transport Manager Helpers ---
  async fetchDrivers(schoolId: string): Promise<any[]> {
    await this.validateEnterpriseSubscription(schoolId, 'School Transit');
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
        createdAt: d.created_at
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

  async createDriver(schoolId: string, sessionId: string, name: string, licenseNumber: string, phone: string): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const resolvedSessionId = (sessionId && isUUID(sessionId)) ? sessionId : null;

    const { error } = await supabaseAdmin.from('drivers').insert({
      school_id: schoolId,
      academic_session_id: resolvedSessionId,
      name: name,
      license_number: licenseNumber,
      phone: phone,
      status: 'ACTIVE'
    });
    if (error) {
      mockDb.drivers.push({
        id: 'dr-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        name,
        licenseNumber,
        phone,
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      });
      mockDb.saveAll();
    }
  },

  async fetchPickupPoints(schoolId: string): Promise<any[]> {
    await this.validateEnterpriseSubscription(schoolId, 'School Transit');
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
    const { data, error } = await supabaseAdmin
      .from('vehicle_logs')
      .select('*, bus:buses(*)')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.vehicleLogs.filter(vl => vl.schoolId === schoolId);
    return data;
  },

  // --- Dedicated Buses & Transport CRUD ---
  async fetchBuses(schoolId: string): Promise<any[]> {
    await this.validateEnterpriseSubscription(schoolId, 'School Transit');
    const { data, error } = await supabaseAdmin
      .from('buses')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.buses.filter(b => b.schoolId === schoolId);
    
    if (data.length > 0) {
      const mapped = data.map(b => ({
        id: b.id,
        schoolId: b.school_id || schoolId,
        numberPlate: b.number_plate || b.plate_number || b.numberPlate || '',
        capacity: Number(b.capacity || 0),
        status: b.status || 'ACTIVE',
        driverId: b.driver_id || b.driverId || null,
        createdAt: b.created_at
      }));
      
      mapped.forEach(b => {
        const idx = mockDb.buses.findIndex(mb => mb.id === b.id);
        if (idx === -1) mockDb.buses.push(b);
        else mockDb.buses[idx] = b;
      });
      mockDb.buses = mockDb.buses.filter(mb => mb.schoolId !== schoolId || mapped.some(m => m.id === mb.id));
      mockDb.saveAll();

      return mapped;
    }
    return mockDb.buses.filter(b => b.schoolId === schoolId);
  },

  async createBus(schoolId: string, numberPlate: string, capacity: number, status: string, driverId: string | null): Promise<void> {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validDriverId = (driverId && isUUID(driverId)) ? driverId : null;

    // Save to local cache first
    const localId = 'bus-' + Math.random().toString(36).substr(2, 9);
    const busObject = {
      id: localId,
      schoolId,
      numberPlate,
      capacity,
      status: status as any,
      driverId,
      createdAt: new Date().toISOString()
    };
    mockDb.buses.push(busObject);
    mockDb.saveAll();

    const { error } = await supabaseAdmin.from('buses').insert({
      school_id: schoolId,
      number_plate: numberPlate,
      plate_number: numberPlate,
      capacity,
      status,
      driver_id: validDriverId
    });
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
      await supabaseAdmin.from('buses').insert({
        school_id: schoolId,
        plate_number: numberPlate,
        driver_name: driverName,
        driver_phone: driverPhone,
        capacity
      });
    }
  },

  async deleteBus(id: string): Promise<void> {
    await supabaseAdmin.from('buses').delete().eq('id', id);
    const idx = mockDb.buses.findIndex(b => b.id === id);
    if (idx !== -1) {
      mockDb.buses.splice(idx, 1);
      mockDb.saveAll();
    }
  },

  async fetchRoutes(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('routes')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.routes.filter(r => r.schoolId === schoolId);
    
    if (data.length > 0) {
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

      mapped.forEach(r => {
        const idx = mockDb.routes.findIndex(mr => mr.id === r.id);
        if (idx === -1) mockDb.routes.push(r);
        else mockDb.routes[idx] = r;
      });
      mockDb.routes = mockDb.routes.filter(mr => mr.schoolId !== schoolId || mapped.some(m => m.id === mr.id));
      mockDb.saveAll();

      return mapped;
    }
    return mockDb.routes.filter(r => r.schoolId === schoolId);
  },

  async createRoute(schoolId: string, name: string, routeCode: string, startPoint: string, endPoint: string, fare: number): Promise<void> {
    const { error } = await supabaseAdmin.from('routes').insert({
      school_id: schoolId,
      name: `${name}::${routeCode}`,
      route_code: routeCode,
      start_point: startPoint,
      end_point: endPoint,
      fare
    });
    if (error) {
      // Resilient fallback: Retry inserting with name = name::routeCode to avoid missing route_code column error
      const { error: retryErr } = await supabaseAdmin.from('routes').insert({
        school_id: schoolId,
        name: `${name}::${routeCode}`,
        start_point: startPoint,
        end_point: endPoint,
        fare
      });
      if (retryErr) {
        mockDb.routes.push({
          id: 'rt-' + Math.random().toString(36).substr(2, 9),
          schoolId,
          name,
          routeCode,
          startPoint,
          endPoint,
          fare,
          createdAt: new Date().toISOString()
        });
        mockDb.saveAll();
      }
    }
  },

  async deleteRoute(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('routes').delete().eq('id', id);
    const idx = mockDb.routes.findIndex(r => r.id === id);
    if (idx !== -1) {
      mockDb.routes.splice(idx, 1);
      mockDb.saveAll();
    }
  },

  async fetchTransportAssignments(schoolId: string): Promise<any[]> {
    await this.validateEnterpriseSubscription(schoolId, 'School Transit');
    const { data, error } = await supabaseAdmin
      .from('transport_assignments')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.transportAssignments.filter(ta => ta.schoolId === schoolId);
    
    if (data.length > 0) {
      const mapped = data.map(ta => ({
        id: ta.id,
        schoolId: ta.school_id || schoolId,
        studentId: ta.student_id || ta.studentId,
        routeId: ta.route_id || ta.routeId,
        busId: ta.bus_id || ta.busId,
        pickupPointId: ta.pickup_point_id || ta.pickupPointId || '',
        status: ta.status || 'ACTIVE',
        createdAt: ta.created_at
      }));

      mapped.forEach(ta => {
        const idx = mockDb.transportAssignments.findIndex(mta => mta.id === ta.id);
        if (idx === -1) mockDb.transportAssignments.push(ta);
        else mockDb.transportAssignments[idx] = ta;
      });
      mockDb.transportAssignments = mockDb.transportAssignments.filter(mta => mta.schoolId !== schoolId || mapped.some(m => m.id === mta.id));
      mockDb.saveAll();

      return mapped;
    }
    return mockDb.transportAssignments.filter(ta => ta.schoolId === schoolId);
  },

  async createTransportAssignment(schoolId: string, studentId: string, routeId: string, busId: string, pickupPointId: string): Promise<void> {
    await this.validateEnterpriseSubscription(schoolId, 'School Transit');
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const validPickupPointId = (pickupPointId && isUUID(pickupPointId)) ? pickupPointId : null;

    // Save to local cache first
    const localId = 'ta-' + Math.random().toString(36).substr(2, 9);
    mockDb.transportAssignments.push({
      id: localId,
      schoolId,
      studentId,
      routeId,
      busId,
      pickupPointId,
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
    mockDb.saveAll();

    const { error } = await supabaseAdmin.from('transport_assignments').insert({
      school_id: schoolId,
      student_id: studentId,
      route_id: routeId,
      bus_id: busId,
      pickup_point_id: validPickupPointId,
      status: 'ACTIVE'
    });
    if (error) {
      // Resilient fallback: Retry inserting without pickup_point_id and status columns
      await supabaseAdmin.from('transport_assignments').insert({
        school_id: schoolId,
        student_id: studentId,
        route_id: routeId,
        bus_id: busId
      });
    }
  },

  async deleteTransportAssignment(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('transport_assignments').delete().eq('id', id);
    const idx = mockDb.transportAssignments.findIndex(ta => ta.id === id);
    if (idx !== -1) {
      mockDb.transportAssignments.splice(idx, 1);
      mockDb.saveAll();
    }
  },

  async fetchMaintenanceLogs(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('maintenance_logs')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.maintenanceLogs.filter(ml => ml.schoolId === schoolId);
    return data;
  },

  async createMaintenanceLog(schoolId: string, busId: string, logDate: string, description: string, cost: number): Promise<void> {
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
  },

  async fetchDriverSalaryPayouts(schoolId: string): Promise<DriverSalaryPayout[]> {
    const { data, error } = await supabaseAdmin
      .from('driver_salary_payouts')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) {
      return mockDb.driverSalaryPayouts.filter(p => p.schoolId === schoolId);
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
      currencySymbol: r.currency_symbol || '$'
    }));

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
    await delay(600);
    // RBAC Validation
    const operators = mockDb.users.filter(u => u.schoolId === schoolId);
    const operator = operators.find(o => o.id === adminId);
    const allowedRoles: UserRole[] = ['ADMIN', 'FINANCE_ADMIN'];
    if (!operator || !allowedRoles.includes(operator.role)) {
      throw new Error('Security Policy Alert: Unauthorized salary disbursement attempt. Payouts require ADMIN or FINANCE_ADMIN privilege.');
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
      notes: notes || 'Daily attendance disburse',
      currency_code: currencyCode,
      currency_symbol: currencySymbol
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
        notes: notes || 'Daily attendance disburse',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currencyCode,
        currencySymbol
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
      currencySymbol: dbPayout.currency_symbol || currencySymbol
    };

    mockDb.driverSalaryPayouts.push(newPayout);
    mockDb.saveAll();
    return newPayout;
  },

  async fetchDriverAttendance(schoolId: string): Promise<any[]> {
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
  },

  // --- Admin Book CRUD ---
  async adminCreateBook(title: string, author: string, isbn: string, subject: string, totalCopies: number): Promise<void> {
    const schoolId = getAdminSchoolId();
    const newBook = {
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
    const { error } = await supabaseAdmin.from('book_inventory').insert({
      school_id: schoolId,
      title,
      author,
      isbn,
      subject,
      total_copies: totalCopies,
      available_copies: totalCopies
    });
    if (error) {
      mockDb.books.push(newBook);
      mockDb.saveAll();
    }
  },

  // --- Dedicated Library CRUD ---
  async fetchBookCategories(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('book_categories')
      .select('*')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.bookCategories.filter(bc => bc.schoolId === schoolId);
    return data;
  },

  async createBookCategory(schoolId: string, name: string, code: string): Promise<void> {
    const id = 'bc-' + Math.random().toString(36).substr(2, 9);
    const newCategory = {
      id,
      schoolId,
      name,
      code,
      createdAt: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin.from('book_categories').insert({
      id,
      school_id: schoolId,
      name,
      code
    }).select().single();

    if (data) {
      newCategory.id = data.id;
      newCategory.createdAt = data.created_at;
    }

    mockDb.bookCategories.push(newCategory);
    mockDb.saveAll();
  },

  async deleteBookCategory(id: string): Promise<void> {
    await supabaseAdmin.from('book_categories').delete().eq('id', id);
    const idx = mockDb.bookCategories.findIndex(bc => bc.id === id);
    if (idx !== -1) {
      mockDb.bookCategories.splice(idx, 1);
      mockDb.saveAll();
    }
  },

  async fetchBookIssues(schoolId: string, studentId?: string): Promise<any[]> {
    let query = supabaseAdmin.from('book_issues').select('*, book:books(*), student:students(*, userDetails:users(*))').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) {
      const local = mockDb.bookIssues.filter(bi => bi.schoolId === schoolId);
      if (studentId) return local.filter(bi => bi.studentId === studentId);
      return local;
    }
    return data;
  },

  async issueBook(schoolId: string, bookId: string, studentId: string, issueDate: string, dueDate: string): Promise<void> {
    const { error } = await supabaseAdmin.from('book_issues').insert({
      school_id: schoolId,
      book_id: bookId,
      student_id: studentId,
      issue_date: issueDate,
      due_date: dueDate,
      status: 'ISSUED'
    });
    if (error) {
      mockDb.bookIssues.push({
        id: 'bi-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        bookId,
        studentId,
        issueDate,
        dueDate,
        returnDate: null,
        fineAmount: 0,
        status: 'ISSUED',
        createdAt: new Date().toISOString()
      });
      mockDb.saveAll();
    }
  },

  async returnBook(schoolId: string, issueId: string, returnDate: string, fineAmount: number, status: string): Promise<void> {
    const { error } = await supabaseAdmin.from('book_returns').insert({
      school_id: schoolId,
      issue_id: issueId,
      return_date: returnDate,
      fine_amount: fineAmount,
      status
    });
    await supabaseAdmin.from('book_issues').update({ status: 'RETURNED', return_date: returnDate, fine_amount: fineAmount }).eq('id', issueId);
    if (error) {
      const idx = mockDb.bookIssues.findIndex(bi => bi.id === issueId);
      if (idx !== -1) {
        mockDb.bookIssues[idx].status = 'RETURNED';
        mockDb.bookIssues[idx].returnDate = returnDate;
        mockDb.bookIssues[idx].fineAmount = fineAmount;
      }
      mockDb.bookReturns.push({
        id: 'br-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        issueId,
        returnDate,
        fineAmount,
        status: status as any,
        createdAt: new Date().toISOString()
      });
      mockDb.saveAll();
    }
  },

  async fetchLibraryFines(schoolId: string, studentId?: string): Promise<any[]> {
    let query = supabaseAdmin.from('library_fines').select('*, issue:book_issues(*, book:books(*)), student:students(*, userDetails:users(*))').eq('school_id', schoolId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data) {
      const local = mockDb.libraryFines.filter(lf => lf.schoolId === schoolId);
      if (studentId) return local.filter(lf => lf.studentId === studentId);
      return local;
    }
    return data;
  },

  async payLibraryFine(schoolId: string, fineId: string): Promise<void> {
    const { error } = await supabaseAdmin.from('library_fines').update({ is_paid: true }).eq('id', fineId);
    if (error) {
      const idx = mockDb.libraryFines.findIndex(lf => lf.id === fineId);
      if (idx !== -1) {
        mockDb.libraryFines[idx].isPaid = true;
        mockDb.saveAll();
      }
    }
  },

  async createDigitalLibraryAsset(schoolId: string, title: string, author: string, fileUrl: string, fileType: string): Promise<void> {
    await this.validateEnterpriseSubscription(schoolId, 'Digital Library Resources');
    const id = 'dla-' + Math.random().toString(36).substr(2, 9);
    const newAsset = {
      id,
      schoolId,
      title,
      author,
      fileUrl,
      fileType,
      createdAt: new Date().toISOString()
    };

    const { data, error } = await supabaseAdmin.from('digital_library_assets').insert({
      id,
      school_id: schoolId,
      title,
      author,
      file_url: fileUrl,
      file_type: fileType
    }).select().single();

    if (data) {
      newAsset.id = data.id;
      newAsset.createdAt = data.created_at;
    }

    mockDb.digitalLibraryAssets.push(newAsset);
    mockDb.saveAll();
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
    if (error || !data || data.length === 0) return mockDb.exams.filter(e => e.schoolId === schoolId);
    return data;
  },

  async createExam(schoolId: string, academicSessionId: string, name: string, term: string, startDate: string, endDate: string): Promise<void> {
    const { error } = await supabaseAdmin.from('exams').insert({
      school_id: schoolId,
      academic_session_id: academicSessionId,
      name,
      term,
      start_date: startDate,
      end_date: endDate
    });
    if (error) {
      // Graceful fallback: Retry insert without 'term' column
      const { error: retryErr } = await supabaseAdmin.from('exams').insert({
        school_id: schoolId,
        academic_session_id: academicSessionId,
        name,
        start_date: startDate,
        end_date: endDate
      });
      if (retryErr) {
        mockDb.exams.push({
          id: 'ex-' + Math.random().toString(36).substr(2, 9),
          schoolId,
          academicSessionId,
          name,
          startDate,
          endDate
        });
        mockDb.saveAll();
      }
    }
  },

  async deleteExam(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('exams').delete().eq('id', id);
    if (error) {
      const idx = mockDb.exams.findIndex(e => e.id === id);
      if (idx !== -1) {
        mockDb.exams.splice(idx, 1);
        mockDb.saveAll();
      }
    }
  },

  async fetchExamSubjects(schoolId: string, examId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('exam_subjects')
      .select('*, subject:subjects(*)')
      .eq('school_id', schoolId)
      .eq('exam_id', examId);
    if (error || !data) return mockDb.examSubjects.filter(es => es.schoolId === schoolId && es.examId === examId);
    return data;
  },

  async createExamSubject(schoolId: string, examId: string, subjectId: string, maxMarks: number, passingMarks: number): Promise<void> {
    const { error } = await supabaseAdmin.from('exam_subjects').insert({
      school_id: schoolId,
      exam_id: examId,
      subject_id: subjectId,
      max_marks: maxMarks,
      passing_marks: passingMarks
    });
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
    return data;
  },

  async enterStudentMarks(schoolId: string, examId: string, subjectId: string, studentId: string, marksObtained: number, remarks: string): Promise<void> {
    const { error } = await supabaseAdmin.from('student_marks').upsert({
      school_id: schoolId,
      exam_id: examId,
      subject_id: subjectId,
      student_id: studentId,
      marks_obtained: marksObtained,
      remarks
    }, { onConflict: 'exam_id,subject_id,student_id' });
    if (error) {
      const idx = mockDb.studentMarks.findIndex(sm => sm.examId === examId && sm.subjectId === subjectId && sm.studentId === studentId);
      if (idx === -1) {
        mockDb.studentMarks.push({
          id: 'sm-' + Math.random().toString(36).substr(2, 9),
          schoolId,
          examId,
          subjectId,
          studentId,
          marksObtained,
          remarks,
          createdAt: new Date().toISOString()
        });
      } else {
        mockDb.studentMarks[idx].marksObtained = marksObtained;
        mockDb.studentMarks[idx].remarks = remarks;
      }
      mockDb.saveAll();
    }
  },

  async fetchExamResults(schoolId: string, examId?: string, studentId?: string): Promise<any[]> {
    let query = supabaseAdmin.from('exam_results').select('*, student:students(*, userDetails:users(*)), exam:exams(*)').eq('school_id', schoolId);
    if (examId) query = query.eq('exam_id', examId);
    if (studentId) query = query.eq('student_id', studentId);
    const { data, error } = await query;
    if (error || !data || data.length === 0) {
      let local = mockDb.examResults.filter(er => er.schoolId === schoolId);
      if (examId) local = local.filter(er => er.examId === examId);
      if (studentId) local = local.filter(er => er.studentId === studentId);
      return local;
    }
    return data;
  },

  async publishExamResults(schoolId: string, examId: string, studentId: string, totalMarks: number, marksObtained: number, percentage: number, grade: string, status: string): Promise<void> {
    const { error } = await supabaseAdmin.from('exam_results').upsert({
      school_id: schoolId,
      student_id: studentId,
      exam_id: examId,
      total_marks: totalMarks,
      marks_obtained: marksObtained,
      percentage,
      grade,
      status
    }, { onConflict: 'student_id,exam_id' });
    if (error) {
      const idx = mockDb.examResults.findIndex(er => er.examId === examId && er.studentId === studentId);
      if (idx === -1) {
        mockDb.examResults.push({
          id: 'er-' + Math.random().toString(36).substr(2, 9),
          schoolId,
          studentId,
          examId,
          totalMarks,
          marksObtained,
          percentage,
          grade,
          status: status as any,
          createdAt: new Date().toISOString()
        });
      } else {
        mockDb.examResults[idx].totalMarks = totalMarks;
        mockDb.examResults[idx].marksObtained = marksObtained;
        mockDb.examResults[idx].percentage = percentage;
        mockDb.examResults[idx].grade = grade;
        mockDb.examResults[idx].status = status as any;
      }
      mockDb.saveAll();
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
    const { error } = await supabaseAdmin.from('pickup_points').insert({
      school_id: schoolId,
      name,
      latitude,
      longitude,
      route_id: routeId
    });
    if (error) {
      mockDb.pickupPoints.push({
        id: 'pp-' + Math.random().toString(36).substr(2, 9),
        schoolId,
        name,
        latitude,
        longitude,
        routeId,
        createdAt: new Date().toISOString()
      });
      mockDb.saveAll();
    }
  },

  async deletePickupPoint(id: string): Promise<void> {
    const { error } = await supabaseAdmin.from('pickup_points').delete().eq('id', id);
    if (error) {
      const idx = mockDb.pickupPoints.findIndex(pp => pp.id === id);
      if (idx !== -1) {
        mockDb.pickupPoints.splice(idx, 1);
        mockDb.saveAll();
      }
    }
  },

  async fetchAllStudentMarks(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('student_marks')
      .select('*, student:students(*, userDetails:users(*))')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.studentMarks.filter(sm => sm.schoolId === schoolId);
    return data;
  },

  async fetchAllExamSubjects(schoolId: string): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('exam_subjects')
      .select('*, subject:subjects(*)')
      .eq('school_id', schoolId);
    if (error || !data) return mockDb.examSubjects.filter(es => es.schoolId === schoolId);
    return data;
  }
};

