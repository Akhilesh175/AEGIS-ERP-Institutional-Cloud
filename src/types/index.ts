// --- CORE ENUMS ---

export type UserRole = 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'HOSTEL_ADMIN' | 'WARDEN' | 'CUSTOM_SUB_ADMIN';

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
  academicSessionId?: string;
  password?: string;
  createdAt: string;
  updatedAt: string;
  roleId?: string;
  employeeId?: string;
  lastLoginAt?: string;
  loginDevice?: string;
  sessionStatus?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
}

export interface Role {
  id: string;
  roleName: string;
  roleCode: string;
  description?: string;
  schoolId: string;
  createdAt: string;
  updatedAt: string;
}

export interface RolePermission {
  id: string;
  roleId: string;
  moduleName: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
  canApprove: boolean;
  createdAt: string;
}





export interface School {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  subscriptionPlan: string;
  createdAt: string;
  country?: string;
  currencyCode?: string;
  currencySymbol?: string;
  timezone?: string;
  logoUrl?: string;
  logoFileName?: string;
  logoUploadedAt?: string;
  sealUrl?: string;
  sealFileName?: string;
  sealUploadedAt?: string;
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
  signatureUrl?: string;
  signatureUploadedAt?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  deletedAt?: string | null;
}

export interface SchoolAdmin {
  id: string;
  userId: string;
  schoolId: string;
  roleSettings: string;
  permissions: Record<string, any>;
  status: string;
  createdAt: string;
  signatureUrl?: string;
  signatureUploadedAt?: string;
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

export interface Section {
  id: string;
  schoolId: string;
  classId: string;
  name: string;
  createdAt: string;
}

export interface Student {
  id: string;
  userId: string;
  schoolId: string;
  classId: string | null;
  sectionId?: string | null;
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
  dayOfWeek: number; // 1 = Monday, 6 = Saturday
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

export interface HomeworkAttachment {
  id: string;
  homeworkId: string;
  fileUrl: string;
  fileName: string;
  fileType?: string | null;
  mimeType?: string | null;
  uploadedBy?: string | null;
  schoolId?: string;
  academicSessionId?: string;
  uploadedAt: string;
}

export interface Assignment {
  id: string;
  schoolId?: string;
  classId: string;
  sectionId?: string | null;
  subjectId: string;
  teacherId: string | null;
  title: string;
  description: string;
  dueDate: string;
  maxMarks: number;
  fileAttachmentUrl?: string; // Backwards compatibility for single main link
  attachments?: HomeworkAttachment[];
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
  schoolId?: string;
  academicSessionId?: string;
}

export interface Quiz {
  id: string;
  schoolId?: string;
  subjectId: string;
  classId?: string;
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
  term?: string;
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
  status?: string;
  deletedAt?: string | null;
}

export interface ForumPost {
  id: string;
  categoryId: string;
  authorId: string;
  title: string;
  content: string;
  academicSessionId?: string | null;
  createdAt: string;
  status?: string;
  deletedAt?: string | null;
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
  action?: string;
  details?: Record<string, any>;
  createdAt: string;
  roleId?: string | null;
  moduleName?: string;
  actionType?: string;
  targetId?: string | null;
  oldData?: any;
  newData?: any;
  userAgent?: string;
  schoolId?: string;
}

export interface StudyMaterial {
  id: string;
  schoolId: string;
  subjectId: string;
  classId?: string | null;
  teacherId: string | null;
  uploadedBy: string;
  academicSessionId: string;
  title: string;
  description?: string;
  fileUrl: string;
  thumbnailUrl?: string | null;
  fileType: 'pdf' | 'docx' | 'mp4' | 'stream';
  mimeType?: string | null;
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

// --- LIBRARY ---

export interface Book {
  id: string;
  schoolId: string;
  title: string;
  author: string;
  isbn: string;
  subject: string;
  totalCopies: number;
  availableCopies: number;
  categoryId?: string;
  publisher?: string;
  edition?: string;
  shelfNumber?: string;
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

// --- DEDICATED EXTRA MODULES ---

export interface Driver {
  id: string;
  schoolId: string;
  academicSessionId?: string | null;
  name: string;
  licenseNumber: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface Bus {
  id: string;
  schoolId: string;
  numberPlate: string;
  capacity: number;
  status: 'ACTIVE' | 'MAINTENANCE' | 'INACTIVE';
  driverId?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  createdAt: string;
}

export interface Route {
  id: string;
  schoolId: string;
  name: string;
  routeCode: string;
  startPoint: string;
  endPoint: string;
  fare: number;
  createdAt: string;
}

export interface PickupPoint {
  id: string;
  schoolId: string;
  name: string;
  latitude?: number | null;
  longitude?: number | null;
  routeId?: string | null;
  createdAt: string;
}

export interface TransportAssignment {
  id: string;
  schoolId: string;
  studentId: string;
  routeId: string;
  busId: string;
  pickupPointId: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
}

export interface TransportFeeRecord {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  routeId: string;
  amount: number;
  status: 'UNPAID' | 'PAID';
  createdAt: string;
}

export interface VehicleLog {
  id: string;
  schoolId: string;
  busId: string;
  logType: 'MAINTENANCE' | 'TRIP_START' | 'TRIP_END' | 'FUEL';
  description?: string;
  amount?: number;
  createdAt: string;
}

export interface MaintenanceLog {
  id: string;
  schoolId: string;
  busId: string;
  logDate: string;
  description: string;
  cost: number;
  createdAt: string;
}

export interface DriverAttendance {
  id: string;
  schoolId: string;
  driverId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LEAVE';
  createdAt: string;
}

export interface BookCategory {
  id: string;
  schoolId: string;
  name: string;
  code: string;
  description?: string;
  createdAt: string;
}

export interface BookIssue {
  id: string;
  schoolId: string;
  bookId: string;
  studentId: string;
  issueDate: string;
  dueDate: string;
  returnDate?: string | null;
  fineAmount: number;
  status: 'ISSUED' | 'RETURNED' | 'OVERDUE';
  issuedBy?: string;
  createdAt: string;
}

export interface BookReturn {
  id: string;
  schoolId: string;
  issueId: string;
  returnDate: string;
  fineAmount: number;
  status: 'RETURNED' | 'DAMAGED' | 'LOST';
  returnedTo?: string;
  createdAt: string;
}

export interface LibraryFine {
  id: string;
  schoolId: string;
  issueId: string;
  studentId: string;
  amount: number;
  isPaid: boolean;
  reason?: string;
  status?: 'UNPAID' | 'PAID' | 'WAIVED';
  createdAt: string;
}

export interface LibraryInvoice {
  id: string;
  schoolId: string;
  studentId: string;
  amount: number;
  status: 'UNPAID' | 'PAID';
  createdAt: string;
}

export interface DigitalLibraryAsset {
  id: string;
  schoolId: string;
  title: string;
  author?: string;
  fileUrl: string;
  fileType: string;
  categoryId?: string;
  assetType?: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface ExamSubject {
  id: string;
  schoolId: string;
  examId: string;
  subjectId: string;
  maxMarks: number;
  passingMarks: number;
  createdAt: string;
}

export interface StudentMark {
  id: string;
  schoolId: string;
  examId: string;
  subjectId: string;
  studentId: string;
  marksObtained: number;
  remarks?: string;
  createdAt: string;
}

export interface ReportCard {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  term: string;
  attendancePercentage?: number;
  gradePointAverage?: number;
  remarks?: string;
  fileUrl?: string;
  createdAt: string;
  studentName?: string;
}

export interface ExamResult {
  id: string;
  schoolId: string;
  studentId: string;
  examId: string;
  totalMarks: number;
  marksObtained: number;
  percentage: number;
  grade: string;
  status: 'PASSED' | 'FAILED';
  createdAt: string;
}

export interface QuizResult {
  id: string;
  schoolId: string;
  studentId: string;
  quizId: string;
  score: number;
  totalMarks: number;
  createdAt: string;
}

export interface DriverSalaryPayout {
  id: string;
  schoolId: string;
  driverId: string;
  attendanceRecordId?: string | null;
  payoutAmount: number;
  payoutStatus: 'PAID' | 'PENDING' | 'REJECTED';
  payoutDate: string;
  paidByUserId?: string | null;
  transactionReference?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  currencyCode?: string;
  currencySymbol?: string;
}

export interface Hostel {
  id: string;
  schoolId: string;
  name: string;
  type: 'BOYS' | 'GIRLS' | 'MIXED';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface HostelBlock {
  id: string;
  schoolId: string;
  hostelId: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  wardenId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface HostelRoom {
  id: string;
  schoolId: string;
  blockId: string;
  floor: number;
  roomNumber: string;
  capacity: number;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface HostelBed {
  id: string;
  schoolId: string;
  roomId: string;
  bedName: string;
  status: 'VACANT' | 'OCCUPIED' | 'MAINTENANCE';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface HostelWarden {
  id: string;
  schoolId: string;
  userId: string;
  hostelId: string | null;
  phone?: string;
  username?: string;
  gender?: string;
  address?: string;
  assignedLocations?: any[];
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  designation?: string;
  joiningDate?: string;
  status?: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  userDetails?: User;
  hostelDetails?: Hostel;
}

export interface HostelWardenAssignment {
  id: string;
  wardenId: string;
  buildingId: string;
  blockId: string | null;
  assignedBy?: string | null;
  assignedAt?: string;
  status: 'ACTIVE' | 'INACTIVE';
  wardenDetails?: HostelWarden;
  buildingDetails?: Hostel;
  blockDetails?: HostelBlock;
}

export interface HostelAdmission {
  id: string;
  schoolId: string;
  studentId: string;
  hostelId: string;
  roomId: string;
  bedId: string;
  admissionDate: string;
  checkInDate?: string;
  checkOutDate?: string;
  status: 'ACTIVE' | 'CHECKED_OUT';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  student?: any;
  hostel?: Hostel;
  room?: HostelRoom;
  bed?: HostelBed;
}

export interface HostelAttendance {
  id: string;
  schoolId: string;
  studentId: string;
  date: string;
  timeSlot: 'MORNING' | 'EVENING';
  status: 'PRESENT' | 'ABSENT' | 'LEAVE';
  recordedBy: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  student?: any;
  recordedByDetails?: any;
}

export interface HostelFee {
  id: string;
  schoolId: string;
  name: string;
  amount: number;
  feeType: 'MONTHLY' | 'ANNUAL' | 'ONE_TIME' | 'MESS';
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface HostelPayment {
  id: string;
  schoolId: string;
  studentId: string;
  feeId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: 'CASH' | 'CARD' | 'ONLINE' | 'BANK_TRANSFER';
  txId?: string;
  status: 'PAID' | 'PENDING' | 'PARTIAL';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  student?: any;
  fee?: HostelFee;
}

export interface HostelLeaveRequest {
  id: string;
  schoolId: string;
  studentId: string;
  fromDate: string;
  toDate: string;
  reason: string;
  parentApproval: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HOLD';
  wardenApproval: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HOLD';
  hostelAdminApproval?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HOLD';
  adminApproval: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HOLD';
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'HOLD';
  approvedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  student?: any;
}

export interface HostelVisitor {
  id: string;
  schoolId: string;
  visitorName: string;
  relation: string;
  studentId: string;
  entryTime: string;
  exitTime?: string;
  purpose: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  student?: any;
}

export interface HostelComplaint {
  id: string;
  schoolId: string;
  studentId: string;
  category: 'ROOM' | 'ELECTRICITY' | 'WATER' | 'MAINTENANCE' | 'OTHER';
  description: string;
  assignedStaff?: string;
  resolutionNotes?: string;
  status: 'SUBMITTED' | 'ASSIGNED' | 'RESOLVED' | 'CLOSED';
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  student?: any;
}

export interface HostelMessMenu {
  id: string;
  schoolId: string;
  hostelId: string | null;
  dayOfWeek: number;
  breakfast: string;
  lunch: string;
  dinner: string;
  specialMenu?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  hostel?: Hostel;
}

export interface SystemStatus {
  id: string;
  serviceName: string;
  status: 'OPERATIONAL' | 'DEGRADED_PERFORMANCE' | 'PARTIAL_OUTAGE' | 'MAJOR_OUTAGE';
  description?: string;
  updatedAt: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  category: string;
  content: string;
  targetRoles: UserRole[];
  createdAt: string;
  updatedAt: string;
}

export interface SupportTicket {
  id: string;
  schoolId?: string;
  userId: string;
  userRole: string;
  title: string;
  description: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  attachmentUrl?: string;
  createdAt: string;
  updatedAt: string;
  userDetails?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  } | null;
}

export interface BugReport {
  id: string;
  schoolId?: string;
  userId: string;
  userRole: string;
  title: string;
  description: string;
  stepsToReproduce?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'NEW' | 'INVESTIGATING' | 'FIXED' | 'CLOSED';
  attachmentUrl?: string;
  createdAt: string;
  updatedAt: string;
}



