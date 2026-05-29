// --- CORE ENUMS ---

export type UserRole = 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN';

export type GenderType = 'MALE' | 'FEMALE' | 'OTHER';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE';

// --- ENTITIES ---

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  phone?: string;
  avatarUrl?: string;
  isActive: boolean;
  schoolId?: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
}



export interface School {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  subscriptionPlan: string;
  createdAt: string;
}

export interface AcademicSession {
  id: string;
  schoolId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
}

export interface Class {
  id: string;
  schoolId: string;
  name: string; // e.g., "Grade 10-A"
  academicSessionId: string;
  classTeacherId?: string | null;
  createdAt: string;
}

export interface Subject {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  description?: string;
}

export interface Teacher {
  id: string;
  userId: string;
  schoolId: string;
  employeeId: string;
  qualification: string;
  joiningDate: string;
  specialization: string;
  createdAt: string;
}

export interface SchoolAdmin {
  id: string;
  userId: string;
  schoolId: string;
  roleSettings: string;
  permissions: Record<string, any>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export type PhoneNumberType = 'PRIMARY' | 'EMERGENCY' | 'HOME' | 'WORK';

export interface PhoneNumber {
  id: string;
  userId: string;
  schoolId?: string;
  phoneType: PhoneNumberType;
  countryCode: string;
  nationalNumber: string;
  fullNumber: string;
  createdAt: string;
  updatedAt: string;
}

export type EmailAddressType = 'LOGIN' | 'CONTACT' | 'PERSONAL' | 'WORK';

export interface EmailAddress {
  id: string;
  userId: string;
  schoolId?: string;
  emailType: EmailAddressType;
  email: string;
  isPrimary: boolean;
  isVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  userId: string;
  schoolId: string;
  classId: string | null;
  academicSessionId: string;
  admissionNumber: string;
  rollNumber: number;
  dateOfBirth: string;
  gender: GenderType;
  createdAt: string;
}

export interface Parent {
  id: string;
  userId: string;
  schoolId: string;
  occupation: string;
  address: string;
  createdAt: string;
}

export interface ParentStudentMapping {
  parentId: string;
  studentId: string;
  relationship: string; // e.g. "Father", "Mother"
}

export interface TeacherClassSubjectMapping {
  id: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  createdAt: string;
}

export interface Timetable {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  dayOfWeek: number; // 1 = Monday, 5 = Friday
  startTime: string; // "HH:MM"
  endTime: string;
  classroomNumber?: string;
  academicSessionId: string;
}

export interface Attendance {
  id: string;
  studentId: string;
  classId: string;
  academicSessionId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  remarks?: string;
  markedBy: string;
}

export interface Assignment {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string | null;
  title: string;
  description: string;
  dueDate: string;
  maxMarks: number;
  fileAttachmentUrl?: string;
  isHomework: boolean;
  academicSessionId: string;
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  submissionText?: string;
  fileUrl: string;
  submittedAt: string;
  marksObtained?: number;
  feedback?: string;
  gradedBy?: string;
  gradedAt?: string;
}

export interface Quiz {
  id: string;
  subjectId: string;
  teacherId: string | null;
  title: string;
  durationMinutes: number;
  totalMarks: number;
  dueDate?: string;
  academicSessionId: string;
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  quizId: string;
  question: string;
  options: string[];
  correctOption: number; // index of option
  marks: number;
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  studentId: string;
  answers: Record<string, number>; // questionId -> selectedOptionIndex
  score: number;
  attemptedAt: string;
}

export interface Exam {
  id: string;
  schoolId: string;
  academicSessionId: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface ExamSchedule {
  id: string;
  examId: string;
  classId: string;
  subjectId: string;
  examDate: string;
  startTime: string;
  endTime: string;
  classroom: string;
  maxMarks: number;
}

export interface ExamMark {
  id: string;
  examScheduleId: string;
  studentId: string;
  marksObtained: number;
  remarks?: string;
  gradedBy: string;
  createdAt: string;
}

export interface FeeStructure {
  id: string;
  schoolId: string;
  academicSessionId: string;
  classId: string;
  amount: number;
  dueDate: string;
  description: string;
}

export interface FeePayment {
  id: string;
  feeStructureId: string;
  studentId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  transactionId?: string;
  status: PaymentStatus;
  createdAt: string;
}

export interface ForumCategory {
  id: string;
  schoolId: string;
  name: string;
  description: string;
  classId?: string | null;
  subjectId?: string | null;
  academicSessionId?: string | null;
}

export interface ForumPost {
  id: string;
  categoryId: string;
  authorId: string;
  title: string;
  content: string;
  academicSessionId?: string | null;
  createdAt: string;
}

export interface ForumReply {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  academicSessionId?: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  userId: string | null;
  ipAddress?: string;
  action: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface StudyMaterial {
  id: string;
  subjectId: string;
  teacherId: string | null;
  title: string;
  description?: string;
  fileUrl: string;
  fileType: 'pdf' | 'docx' | 'mp4';
  isVideoStreamable: boolean;
  createdAt: string;
}

export interface Announcement {
  id: string;
  schoolId: string;
  senderId: string | null;
  title: string;
  content: string;
  targetRoles: UserRole[];
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

// --- TELEMETRY ---

export interface SystemTelemetry {
  cpuLoad: number;
  memoryUsage: number; // in %
  diskUsage: number; // in %
  activeSessions: number;
  apiRequestsCount: number;
  dbLatencyMs: number;
}
