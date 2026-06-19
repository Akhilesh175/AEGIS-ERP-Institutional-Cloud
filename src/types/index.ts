// --- CORE ENUMS ---

export type UserRole = 'STUDENT' | 'PARENT' | 'TEACHER' | 'ADMIN' | 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'HOSTEL_ADMIN' | 'WARDEN' | 'SPORTS_ADMIN' | 'CUSTOM_SUB_ADMIN' | 'DRIVER' | 'COACH' | 'CLASS_TEACHER';

export type GenderType = 'MALE' | 'FEMALE' | 'OTHER';

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE' | 'REJECTED';

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
  roles?: string[];
  activeRoleSelected?: boolean;
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
  paymentScreenshotUrl?: string;
  utrNumber?: string;
  rejectionReason?: string;
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
  senderId?: string | null;
  recipientRole?: string | null;
  category?: string;
  priority?: string;
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
  employeeId?: string | null;
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
  driverName?: string | null;
  driverEmployeeId?: string | null;
  driverLicenseNumber?: string | null;
  driverPhone?: string | null;
}

export interface PayrollRecord {
  id: string;
  schoolId: string;
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
  netSalary: number;
  payoutStatus: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' | 'REVERSED';
  payoutDate?: string | null;
  paidByUserId?: string | null;
  transactionReference?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
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
  ticketNumber: string;
  schoolId?: string;
  userId: string;
  userRole: string;
  category: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  subject: string;
  description: string;
  attachmentUrl?: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'AWAITING_USER_RESPONSE' | 'RESOLVED' | 'CLOSED' | 'REOPENED';
  assignedTo?: string | null;
  createdAt: string;
  updatedAt: string;
  userDetails?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  } | null;
  schoolName?: string;
  replyCount?: number;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
  attachmentUrl?: string;
  createdAt: string;
  senderDetails?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  } | null;
}

export interface SupportTicketStatusLog {
  id: string;
  ticketId: string;
  oldStatus: string;
  newStatus: string;
  changedBy: string;
  changedAt: string;
  actorDetails?: {
    firstName: string;
    lastName: string;
    role: string;
  } | null;
}

export interface SupportInternalNote {
  id: string;
  ticketId: string;
  senderId: string;
  noteText: string;
  createdAt: string;
  senderDetails?: {
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  } | null;
}

export interface SupportNotification {
  id: string;
  userId: string;
  ticketId: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface BugReport {
  id: string;
  schoolId?: string;
  userId: string;
  pageUrl?: string;
  bugTitle: string;
  description: string;
  screenshotUrl?: string;
  status: 'NEW' | 'INVESTIGATING' | 'FIXED' | 'CLOSED';
  createdAt: string;
  userDetails?: {
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  schoolName?: string;
}

export interface SchoolPaymentSettings {
  id: string;
  schoolId: string;
  qrCodeUrl?: string | null;
  upiId?: string | null;
  accountHolderName?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  branchName?: string | null;
  swiftCode?: string | null;
  qrPaymentEnabled: boolean;
  bankTransferEnabled: boolean;
  showQrToParents: boolean;
  showBankToParents: boolean;
  enableUtrUpload: boolean;
  autoRemindUnpaid: boolean;
  paymentInstructions?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface FacultyPaymentSettings {
  id: string;
  userId: string;
  qrCodeUrl?: string | null;
  upiId?: string | null;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  branchName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SalaryPayment {
  id: string;
  employeeId: string;
  schoolId: string;
  month: string;               // e.g. "2026-06"
  amount: number;
  utrNumber: string;
  paymentScreenshotUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeSalaryLedger {
  id: string;
  employeeId: string;
  salaryPaymentId: string;
  month: string;
  amount: number;
  paymentDate: string;
  utrNumber: string;
  createdAt: string;
}

export interface PaymentAuditLog {
  id: string;
  paymentId: string;
  action: 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  performedBy: string;
  performedAt: string;
  details?: Record<string, any>;
}

// --- GROUP DISCUSSION ---

export interface ClassChatGroup {
  id: string;
  schoolId: string;
  academicSessionId: string;
  classId: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
}

export interface ClassChatMember {
  id: string;
  schoolId: string;
  academicSessionId: string;
  groupId: string;
  userId: string;
  role: 'STUDENT' | 'TEACHER' | 'CLASS_TEACHER' | 'ACADEMIC_ADMIN' | 'SCHOOL_ADMIN';
  mutedUntil: string | null;
  isPermanentlyMuted: boolean;
  joinedAt: string;
  userFirst?: string;
  userLast?: string;
  avatarUrl?: string;
}

export interface ClassMessageReaction {
  id: string;
  schoolId: string;
  academicSessionId: string;
  messageId: string;
  userId: string;
  reaction: string;
  createdAt: string;
  userFirst?: string;
  userLast?: string;
}

export interface ClassMessageAttachment {
  id: string;
  schoolId: string;
  academicSessionId: string;
  messageId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  createdAt: string;
}

export interface ClassMessage {
  id: string;
  schoolId: string;
  academicSessionId: string;
  groupId: string;
  senderId: string;
  content: string | null;
  messageType: 'CHAT' | 'ANNOUNCEMENT' | 'SYSTEM';
  systemNoticeType?: 'HOMEWORK' | 'ASSIGNMENT' | 'EXAM' | 'TIMETABLE' | 'NOTICE' | null;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  senderName?: string;
  senderAvatar?: string;
  senderRole?: string;
  attachments?: ClassMessageAttachment[];
  reactions?: ClassMessageReaction[];
  pinnedBy?: string;
  pinnedAt?: string;
  replyToMessageId?: string | null;
  replyToSenderName?: string | null;
  replyToContent?: string | null;
}

export interface ClassPinnedMessage {
  id: string;
  schoolId: string;
  academicSessionId: string;
  groupId: string;
  messageId: string;
  pinnedBy: string;
  pinnedAt: string;
}

export interface ClassAnnouncement {
  id: string;
  schoolId: string;
  academicSessionId: string;
  groupId: string;
  messageId: string;
  title: string;
  createdAt: string;
}

// --- SPORTS MODULE ---
export interface SportCategory {
  id: string;
  schoolId: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface Sport {
  id: string;
  schoolId: string;
  categoryId?: string;
  name: string;
  description?: string;
  type: 'INDOOR' | 'OUTDOOR';
  format: 'INDIVIDUAL' | 'TEAM';
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
}

export interface SportCoach {
  id: string;
  schoolId: string;
  userId: string;
  specialization: string;
  bio?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  coachName?: string;
  coachEmail?: string;
}

export interface SportEnrollment {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  sportId: string;
  enrollDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  createdAt: string;
  studentName?: string;
  sportName?: string;
}

export interface SportTeam {
  id: string;
  schoolId: string;
  sportId: string;
  name: string;
  coachId?: string | null;
  captainId?: string | null;
  viceCaptainId?: string | null;
  ageGroup?: string;
  gender?: 'MALE' | 'FEMALE' | 'MIXED';
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  sportName?: string;
  coachName?: string;
  captainName?: string;
  memberCount?: number;
}

export interface SportTrainingSession {
  id: string;
  schoolId: string;
  academicSessionId: string;
  sportId: string;
  teamId?: string | null;
  coachId?: string | null;
  sessionName: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  recurrence?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  sportName?: string;
  teamName?: string;
}

export interface SportAttendance {
  id: string;
  schoolId: string;
  sessionId?: string | null;
  studentId: string;
  date: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' | 'MEDICAL_LEAVE';
  remarks?: string;
  markedBy: string;
  createdAt: string;
  studentName?: string;
}

export interface SportPerformanceMetric {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  sportId: string;
  recordedDate: string;
  speed: number;
  stamina: number;
  strength: number;
  agility: number;
  skill: number;
  discipline: number;
  teamwork: number;
  fitness: number;
  coachRating?: number;
  tournamentPerformance?: number;
  achievementProgress?: number;
  coachId?: string | null;
  remarks?: string;
  createdAt: string;
  studentName?: string;
  sportName?: string;
}

export interface SportTournament {
  id: string;
  schoolId: string;
  academicSessionId: string;
  sportId: string;
  name: string;
  format: 'LEAGUE' | 'KNOCKOUT' | 'ROUND_ROBIN' | 'GROUP_STAGE' | 'HYBRID';
  startDate: string;
  endDate: string;
  venue: string;
  status: 'UPCOMING' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  sportName?: string;
}

export interface SportFixture {
  id: string;
  schoolId: string;
  tournamentId: string;
  team1Id?: string | null;
  team2Id?: string | null;
  matchDate: string;
  matchTime: string;
  venue: string;
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  round?: string;
  refereeOfficials?: string;
  createdAt: string;
  tournamentName?: string;
  team1Name?: string;
  team2Name?: string;
  sportName?: string;
}

export interface SportMatch {
  id: string;
  schoolId: string;
  fixtureId: string;
  winnerTeamId?: string | null;
  team1Score?: string;
  team2Score?: string;
  summary?: string;
  createdAt: string;
  winnerTeamName?: string;
}

export interface SportRanking {
  id: string;
  schoolId: string;
  academicSessionId: string;
  sportId: string;
  teamId?: string | null;
  studentId?: string | null;
  points: number;
  matchesPlayed: number;
  matchesWon: number;
  matchesLost: number;
  matchesDrawn: number;
  rankScore: number;
  rank?: number;
  createdAt: string;
  teamName?: string;
  studentName?: string;
}

export interface SportCertificate {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  sportId: string;
  tournamentId?: string | null;
  category: 'PARTICIPATION' | 'WINNER' | 'RUNNER_UP' | 'BEST_PLAYER' | 'SPORTS_EXCELLENCE';
  certificateNumber: string;
  issueDate: string;
  fileUrl: string;
  verificationQrCode: string;
  createdAt: string;
  studentName?: string;
  sportName?: string;
}

export interface SportAchievement {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  sportId: string;
  type: 'GOLD' | 'SILVER' | 'BRONZE' | 'PARTICIPATION' | 'WINNER' | 'RUNNER_UP' | 'BEST_PLAYER' | 'SPORTS_EXCELLENCE';
  level: 'SCHOOL' | 'DISTRICT' | 'STATE' | 'NATIONAL' | 'INTERNATIONAL';
  title: string;
  description?: string;
  dateAwarded: string;
  createdAt: string;
  studentName?: string;
  sportName?: string;
}

export interface SportMedicalRecord {
  id: string;
  schoolId: string;
  studentId: string;
  bloodGroup?: string;
  medicalConditions?: string;
  emergencyContact?: string;
  injuryHistory?: any;
  recoveryStatus: 'FIT' | 'INJURED' | 'RECOVERING';
  fitnessExpiryDate?: string;
  createdAt: string;
  studentName?: string;
}

export interface SportEquipment {
  id: string;
  schoolId: string;
  name: string;
  category: string;
  totalQuantity: number;
  availableQuantity: number;
  condition: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED';
  location?: string;
  createdAt: string;
}

export interface SportEquipmentLog {
  id: string;
  schoolId: string;
  equipmentId: string;
  assignedToUserId: string;
  quantity: number;
  issueDate: string;
  returnDate?: string | null;
  status: 'ISSUED' | 'RETURNED' | 'DAMAGED' | 'LOST';
  damageReport?: string;
  createdAt: string;
  equipmentName?: string;
  assignedUserName?: string;
}

export interface SportFee {
  id: string;
  schoolId: string;
  academicSessionId: string;
  feeType: 'REGISTRATION_FEE' | 'TRAINING_FEE' | 'TOURNAMENT_FEE' | 'EQUIPMENT_FEE' | 'UNIFORM_FEE';
  amount: number;
  dueDate: string;
  description?: string;
  createdAt: string;
}

export interface SportFeePayment {
  id: string;
  schoolId: string;
  sportsFeeId: string;
  studentId: string;
  amountPaid: number;
  paymentDate: string;
  paymentMethod: string;
  transactionId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  paymentScreenshotUrl?: string;
  utrNumber?: string;
  rejectionReason?: string;
  createdAt: string;
  studentName?: string;
  feeType?: string;
  feeAmount?: number;
}

export interface SportNotification {
  id: string;
  schoolId: string;
  userId: string;
  title: string;
  message: string;
  channel: 'IN_APP' | 'EMAIL' | 'SMS';
  isRead: boolean;
  createdAt: string;
}

export interface SportAdmin {
  id: string;
  schoolId: string;
  userId: string;
  employeeId?: string;
  fullName: string;
  email: string;
  mobile?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface SportFinanceTransaction {
  id: string;
  schoolId: string;
  academicSessionId: string;
  type: 'REVENUE' | 'EXPENSE';
  category: 'FEE_PAYMENT' | 'EQUIPMENT_PURCHASE' | 'SALARY_PAYOUT' | 'TOURNAMENT_EXPENSE' | 'FINE' | 'OTHER';
  amount: number;
  referenceId: string;
  transactionDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SportSalaryRecord {
  id: string;
  schoolId: string;
  academicSessionId: string;
  userId: string;
  employeeRole: 'SPORTS_ADMIN' | 'COACH';
  amount: number;
  bonus: number;
  deductions: number;
  month: string;
  status: 'GENERATED' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
  approvedBy?: string | null;
  paymentDate?: string | null;
  transactionId?: string | null;
  createdAt: string;
  updatedAt: string;
  employeeName?: string;
}

export interface SportBudgetAllocation {
  id: string;
  schoolId: string;
  academicSessionId: string;
  allocatedAmount: number;
  spentAmount: number;
  category: 'EQUIPMENT' | 'TOURNAMENT' | 'SALARY' | 'TRAVEL' | 'OTHER';
  createdAt: string;
  updatedAt: string;
}

export interface SportExpense {
  id: string;
  schoolId: string;
  academicSessionId: string;
  category: 'EQUIPMENT_PURCHASE' | 'TOURNAMENT_EXPENSE' | 'OTHER';
  title: string;
  description?: string;
  amountRequested: number;
  amountApproved?: number | null;
  requestedBy: string;
  approvedBy?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  vendor?: string;
  invoiceNumber?: string;
  paymentStatus: 'PENDING' | 'RELEASED';
  referenceId?: string | null;
  createdAt: string;
  updatedAt: string;
  requestedByName?: string;
  approvedByName?: string;
}

export interface SportFine {
  id: string;
  schoolId: string;
  academicSessionId: string;
  studentId: string;
  amount: number;
  reason: string;
  status: 'UNPAID' | 'PAID';
  dueDate: string;
  paymentDate?: string | null;
  utrNumber?: string | null;
  paymentScreenshotUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  studentName?: string;
}

export interface SportActivityLog {
  id: string;
  schoolId: string;
  userId: string;
  userRole: string;
  actionType: string;
  affectedRecord?: string;
  ipAddress?: string;
  device?: string;
  details?: any;
  createdAt: string;
  userName?: string;
}

export interface SportCoachAttendance {
  id: string;
  schoolId: string;
  coachId: string;
  attendanceDate: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE' | 'TRAINING_DUTY' | 'TOURNAMENT_DUTY' | 'MEDICAL_LEAVE';
  checkIn?: string | null;
  checkOut?: string | null;
  workingHours: number;
  remarks?: string | null;
  
  // Biometric/Device/GPS Metadata
  deviceId?: string | null;
  ipAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendanceSource?: 'MANUAL' | 'QR_CODE' | 'BIOMETRIC' | 'FACE_RECOGNITION' | 'MOBILE_GPS' | null;

  // Soft Delete
  deletedAt?: string | null;
  deletedBy?: string | null;

  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  coachName?: string;
  coachEmail?: string;
}

export interface SportCoachLeave {
  id: string;
  schoolId: string;
  coachId: string;
  startDate: string;
  endDate: string;
  leaveType: 'CASUAL' | 'SICK' | 'MEDICAL' | 'MATERNITY' | 'PATERNITY' | 'DUTY_LEAVE' | 'OTHER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  coachName?: string;
}

export interface SportCoachWorkLog {
  id: string;
  schoolId: string;
  coachId: string;
  logDate: string;
  sessionName?: string | null; // e.g. "Cricket Training"
  loginTime?: string | null;
  logoutTime?: string | null;
  durationMinutes: number;
  sessionType: string;

  // Biometric/Device/GPS Metadata
  deviceId?: string | null;
  ipAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendanceSource?: 'MANUAL' | 'QR_CODE' | 'BIOMETRIC' | 'FACE_RECOGNITION' | 'MOBILE_GPS' | null;

  createdAt: string;
  coachName?: string;
}

export interface SportCoachAttendanceCorrection {
  id: string;
  schoolId: string;
  attendanceId: string;
  requestedStatus: 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY' | 'LEAVE' | 'TRAINING_DUTY' | 'TOURNAMENT_DUTY' | 'MEDICAL_LEAVE';
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
  coachName?: string;
  attendanceDate?: string;
}

export interface SportCoachAttendanceHistory {
  id: string;
  schoolId: string;
  attendanceId: string;
  oldValue: string;
  newValue: string;
  editedBy?: string | null;
  editedAt: string;
  editReason?: string | null;
  editorName?: string;
}


