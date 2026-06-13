import { 
  User, Student, Parent, Teacher, School, Class, Subject, 
  ParentStudentMapping, TeacherClassSubjectMapping, Timetable, 
  Attendance, Assignment, AssignmentSubmission, Quiz, QuizQuestion, 
  QuizAttempt, Exam, ExamSchedule, ExamMark, FeeStructure, FeePayment, 
  ForumCategory, ForumPost, ForumReply, ChatMessage, AuditLog, 
  StudyMaterial, Announcement, Notification, SystemTelemetry, PhoneNumber, EmailAddress,
  Section, HomeworkAttachment, Book,
  Driver, Bus, Route, PickupPoint, TransportAssignment, TransportFeeRecord, VehicleLog,
  MaintenanceLog, DriverAttendance, BookCategory, BookIssue, BookReturn, LibraryFine,
  LibraryInvoice, DigitalLibraryAsset, ExamSubject, StudentMark, ReportCard, ExamResult, QuizResult, DriverSalaryPayout,
  SystemStatus, KnowledgeBaseArticle, SupportTicket, BugReport,
  SupportTicketMessage, SupportTicketStatusLog, SupportNotification, SupportInternalNote
} from '../types';

// Storage keys
const DB_PREFIX = 'aegis_erp_db_';

function getStorage<T>(key: string, defaultValue: T): T {
  const data = localStorage.getItem(DB_PREFIX + key);
  if (!data) {
    localStorage.setItem(DB_PREFIX + key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

function setStorage<T>(key: string, data: T): void {
  localStorage.setItem(DB_PREFIX + key, JSON.stringify(data));
}

// --- SEED SEED SEED DATA ---

const SEED_SCHOOL: School = {
  id: 'school-1',
  name: 'Aegis Academy of Excellence',
  address: '100 Silicon Valley Way, Tech District',
  phone: '+1 (555) 123-4567',
  subscriptionPlan: 'enterprise',
  createdAt: new Date('2024-01-01').toISOString(),
  country: 'USA',
  currencyCode: 'USD',
  currencySymbol: '$',
  timezone: 'America/New_York'
};

const SEED_ACADEMIC_SESSIONS = [
  { id: 'session-1', schoolId: 'school-1', name: '2025-2026 Academic Year', startDate: '2025-09-01', endDate: '2026-06-30', isCurrent: true }
];

const SEED_USERS: User[] = [
  // Super Admin
  { id: 'u-superadmin', email: 'superadmin@aegis.com', role: 'SUPER_ADMIN', firstName: 'Sarah', lastName: 'Vance', phone: '+1 (555) 999-0000', avatarUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Admins
  { id: 'u-admin1', email: 'admin@aegis.com', role: 'ADMIN', firstName: 'Richard', lastName: 'Hendricks', phone: '+1 (555) 888-1111', avatarUrl: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150', isActive: true, schoolId: 'school-1', password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Teachers
  { id: 'u-teacher1', email: 'teacher1@aegis.com', role: 'TEACHER', firstName: 'Marcus', lastName: 'Aurelius', phone: '+1 (555) 777-2222', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-teacher2', email: 'teacher2@aegis.com', role: 'TEACHER', firstName: 'Hypatia', lastName: 'of Alexandria', phone: '+1 (555) 777-3333', avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Students
  { id: 'u-student1', email: 'student1@aegis.com', role: 'STUDENT', firstName: 'Leo', lastName: 'da Vinci', phone: '+1 (555) 444-1111', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-student2', email: 'student2@aegis.com', role: 'STUDENT', firstName: 'Albert', lastName: 'Einstein', phone: '+1 (555) 444-2222', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-student3', email: 'student3@aegis.com', role: 'STUDENT', firstName: 'Marie', lastName: 'Curie', phone: '+1 (555) 444-3333', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Parents
  { id: 'u-parent1', email: 'parent1@aegis.com', role: 'PARENT', firstName: 'Robert', lastName: 'da Vinci', phone: '+1 (555) 555-9999', avatarUrl: 'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-parent2', email: 'parent2@aegis.com', role: 'PARENT', firstName: 'Pierre', lastName: 'Curie', phone: '+1 (555) 555-8888', avatarUrl: 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Hostel Sub-admins
  { id: 'u-hosteladmin', email: 'hosteladmin@aegis.com', role: 'HOSTEL_ADMIN', firstName: 'Jack', lastName: 'Harper', phone: '+1 (555) 333-8888', avatarUrl: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150', isActive: true, schoolId: 'school-1', password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-warden1', email: 'warden@aegis.com', role: 'WARDEN', firstName: 'Clara', lastName: 'Oswald', phone: '+1 (555) 333-9999', avatarUrl: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150', isActive: true, schoolId: 'school-1', password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const SEED_CLASSES: Class[] = [
  { id: 'c-10a', schoolId: 'school-1', name: 'Grade 10-A', academicSessionId: 'session-1', classTeacherId: 't-1', createdAt: new Date().toISOString() },
  { id: 'c-11b', schoolId: 'school-1', name: 'Grade 11-B', academicSessionId: 'session-1', classTeacherId: 't-2', createdAt: new Date().toISOString() }
];

const SEED_SECTIONS: Section[] = [
  { id: 'sec-10a', schoolId: 'school-1', classId: 'c-10a', name: 'A', createdAt: new Date().toISOString() },
  { id: 'sec-11b', schoolId: 'school-1', classId: 'c-11b', name: 'B', createdAt: new Date().toISOString() }
];

const SEED_SUBJECTS: Subject[] = [
  { id: 's-math', schoolId: 'school-1', name: 'Mathematics', code: 'MATH101', description: 'Calculus, Trigonometry, and Matrix Algebra' },
  { id: 's-phys', schoolId: 'school-1', name: 'Physics', code: 'PHY102', description: 'Classical Mechanics, Electromagnetism, and Quantum Basics' },
  { id: 's-comp', schoolId: 'school-1', name: 'Computer Science', code: 'CS103', description: 'Intro to Algorithms, Data Structures, and Programming in TypeScript' }
];

const SEED_TEACHERS: Teacher[] = [
  { id: 't-1', userId: 'u-teacher1', schoolId: 'school-1', employeeId: 'EMP001', qualification: 'Ph.D. in Theoretical Physics', joiningDate: '2020-08-15', specialization: 'Physics & Applied Mathematics', createdAt: new Date().toISOString() },
  { id: 't-2', userId: 'u-teacher2', schoolId: 'school-1', employeeId: 'EMP002', qualification: 'M.S. in Computer Science', joiningDate: '2021-01-10', specialization: 'Computer Engineering & Logic Systems', createdAt: new Date().toISOString() }
];

const SEED_STUDENTS: Student[] = [
  { id: 'st-1', userId: 'u-student1', schoolId: 'school-1', classId: 'c-10a', sectionId: 'sec-10a', academicSessionId: 'session-1', admissionNumber: 'ADM2025001', rollNumber: 10, dateOfBirth: '2010-04-12', gender: 'MALE', createdAt: new Date().toISOString() },
  { id: 'st-2', userId: 'u-student2', schoolId: 'school-1', classId: 'c-10a', sectionId: 'sec-10a', academicSessionId: 'session-1', admissionNumber: 'ADM2025002', rollNumber: 11, dateOfBirth: '2010-06-25', gender: 'MALE', createdAt: new Date().toISOString() },
  { id: 'st-3', userId: 'u-student3', schoolId: 'school-1', classId: 'c-11b', sectionId: 'sec-11b', academicSessionId: 'session-1', admissionNumber: 'ADM2025003', rollNumber: 1, dateOfBirth: '2009-11-07', gender: 'FEMALE', createdAt: new Date().toISOString() }
];

const SEED_PARENTS: Parent[] = [
  { id: 'p-1', userId: 'u-parent1', schoolId: 'school-1', occupation: 'Senior Software Architect', address: '42 Galaxy Meadows, Cupertino, CA', createdAt: new Date().toISOString() },
  { id: 'p-2', userId: 'u-parent2', schoolId: 'school-1', occupation: 'Research Scientist', address: '88 Radium Boulevard, Boston, MA', createdAt: new Date().toISOString() }
];

const SEED_PARENT_STUDENT_MAPPINGS: ParentStudentMapping[] = [
  // Parent 1 (Robert) is linked to both Student 1 (Leo) and Student 2 (Albert)
  { parentId: 'p-1', studentId: 'st-1', relationship: 'Father' },
  { parentId: 'p-1', studentId: 'st-2', relationship: 'Father' },
  // Parent 2 (Pierre) is linked to Student 3 (Marie)
  { parentId: 'p-2', studentId: 'st-3', relationship: 'Father' }
];

const SEED_TEACHER_CLASS_SUBJECT_MAPPINGS: TeacherClassSubjectMapping[] = [
  // Marcus teaches Math & Physics to Grade 10-A
  { id: 'tcsm-1', teacherId: 't-1', classId: 'c-10a', subjectId: 's-math', createdAt: new Date().toISOString() },
  { id: 'tcsm-2', teacherId: 't-1', classId: 'c-10a', subjectId: 's-phys', createdAt: new Date().toISOString() },
  // Ada teaches CS to Grade 10-A and Physics to Grade 11-B
  { id: 'tcsm-3', teacherId: 't-2', classId: 'c-10a', subjectId: 's-comp', createdAt: new Date().toISOString() },
  { id: 'tcsm-4', teacherId: 't-2', classId: 'c-11b', subjectId: 's-phys', createdAt: new Date().toISOString() }
];

const SEED_TIMETABLE: Timetable[] = [
  // Grade 10-A Schedule
  { id: 'tt-1', classId: 'c-10a', subjectId: 's-math', teacherId: 't-1', dayOfWeek: 1, startTime: '09:00', endTime: '10:30', classroomNumber: 'Room 303', academicSessionId: 'session-1' },
  { id: 'tt-2', classId: 'c-10a', subjectId: 's-phys', teacherId: 't-1', dayOfWeek: 1, startTime: '11:00', endTime: '12:30', classroomNumber: 'Lab B', academicSessionId: 'session-1' },
  { id: 'tt-3', classId: 'c-10a', subjectId: 's-comp', teacherId: 't-2', dayOfWeek: 2, startTime: '09:00', endTime: '10:30', classroomNumber: 'CS Lab 1', academicSessionId: 'session-1' },
  { id: 'tt-4', classId: 'c-10a', subjectId: 's-math', teacherId: 't-1', dayOfWeek: 3, startTime: '09:00', endTime: '10:30', classroomNumber: 'Room 303', academicSessionId: 'session-1' },
  { id: 'tt-5', classId: 'c-10a', subjectId: 's-comp', teacherId: 't-2', dayOfWeek: 4, startTime: '11:00', endTime: '12:30', classroomNumber: 'CS Lab 1', academicSessionId: 'session-1' }
];

const SEED_ATTENDANCE: Attendance[] = [
  // Student 1 (Leo)
  { id: 'at-1', studentId: 'st-1', classId: 'c-10a', date: '2026-05-20', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-2', studentId: 'st-1', classId: 'c-10a', date: '2026-05-21', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-3', studentId: 'st-1', classId: 'c-10a', date: '2026-05-22', status: 'LATE', remarks: 'Bus was delayed by traffic', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-4', studentId: 'st-1', classId: 'c-10a', date: '2026-05-23', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-5', studentId: 'st-1', classId: 'c-10a', date: '2026-05-24', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' },

  // Student 2 (Albert)
  { id: 'at-6', studentId: 'st-2', classId: 'c-10a', date: '2026-05-20', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-7', studentId: 'st-2', classId: 'c-10a', date: '2026-05-21', status: 'ABSENT', remarks: 'Medical appointment', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-8', studentId: 'st-2', classId: 'c-10a', date: '2026-05-22', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-9', studentId: 'st-2', classId: 'c-10a', date: '2026-05-23', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' },
  { id: 'at-10', studentId: 'st-2', classId: 'c-10a', date: '2026-05-24', status: 'PRESENT', markedBy: 'u-teacher1', academicSessionId: 'session-1' }
];

const SEED_ASSIGNMENTS: Assignment[] = [
  { id: 'as-1', classId: 'c-10a', subjectId: 's-math', teacherId: 't-1', title: 'Vector Space Calculus Proofs', description: 'Prove that the vector space properties hold for standard matrices. Write all proofs clearly. Submit in PDF format.', dueDate: '2026-05-30T23:59:00Z', maxMarks: 100, fileAttachmentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', isHomework: false, academicSessionId: 'session-1', createdAt: new Date('2026-05-20').toISOString() },
  { id: 'as-2', classId: 'c-10a', subjectId: 's-phys', teacherId: 't-1', title: 'Schrödinger wave packet simulation', description: 'Answer problems 1 to 5 from chapter 8 on wave function collapse. Submit screenshots of your plotted probability density curves.', dueDate: '2026-06-03T18:00:00Z', maxMarks: 50, fileAttachmentUrl: '', isHomework: false, academicSessionId: 'session-1', createdAt: new Date('2026-05-22').toISOString() },
  { id: 'as-3', classId: 'c-10a', subjectId: 's-comp', teacherId: 't-2', title: 'Linked List and Pointer Operations', description: 'Complete tasks 1-3. Write a program to reverse a doubly linked list in O(n) time and O(1) space. Submit code file.', dueDate: '2026-05-28T23:59:00Z', maxMarks: 100, fileAttachmentUrl: '', isHomework: true, academicSessionId: 'session-1', createdAt: new Date('2026-05-24').toISOString() }
];

const SEED_SUBMISSIONS: AssignmentSubmission[] = [
  { id: 'sub-1', assignmentId: 'as-1', studentId: 'st-1', submissionText: 'Here is my solution for the Vector Calculus proof.', fileUrl: 'vector_calculus_sub.pdf', submittedAt: '2026-05-24T14:32:00Z', marksObtained: 95, feedback: 'Excellent rigorous derivations! Your proof for Theorem 3 is very elegant.', gradedBy: 't-1', gradedAt: '2026-05-24T18:00:00Z' },
  { id: 'sub-2', assignmentId: 'as-1', studentId: 'st-2', submissionText: 'Completed proofs.', fileUrl: 'albert_matrix_proofs.pdf', submittedAt: '2026-05-25T01:10:00Z' } // Ungraded yet
];

const SEED_QUIZZES: Quiz[] = [
  { id: 'q-1', subjectId: 's-comp', teacherId: 't-2', title: 'TypeScript Types and Generics Quiz', durationMinutes: 10, totalMarks: 10, dueDate: '2026-05-29T23:59:00Z', academicSessionId: 'session-1', createdAt: new Date('2026-05-24').toISOString() }
];

const SEED_QUIZ_QUESTIONS: QuizQuestion[] = [
  { id: 'qq-1', quizId: 'q-1', question: 'Which keyword is used to declare a type that can represent multiple other types (union type) in TypeScript?', options: ['&', '|', 'union', 'interface'], correctOption: 1, marks: 3 },
  { id: 'qq-2', quizId: 'q-1', question: 'What is the utility type that makes all properties in Type T optional?', options: ['Partial<T>', 'Omit<T>', 'Readonly<T>', 'Pick<T>'], correctOption: 0, marks: 3 },
  { id: 'qq-3', quizId: 'q-1', question: 'Does TypeScript perform type-checking at runtime?', options: ['Yes, always', 'Only when using target ESNext', 'No, types are compiled away', 'Yes, for interfaces only'], correctOption: 2, marks: 4 }
];

const SEED_QUIZ_ATTEMPTS: QuizAttempt[] = [
  { id: 'qa-1', quizId: 'q-1', studentId: 'st-1', answers: { 'qq-1': 1, 'qq-2': 0, 'qq-3': 2 }, score: 10, attemptedAt: '2026-05-24T16:20:00Z' }
];

export const SEED_EXAMS: Exam[] = [
  { id: 'ex-1', schoolId: 'school-1', academicSessionId: 'session-1', name: 'Midterm Assessments 2026', startDate: '2026-03-10', endDate: '2026-03-20' }
];

export const SEED_EXAM_SCHEDULES: ExamSchedule[] = [
  { id: 'es-1', examId: 'ex-1', classId: 'c-10a', subjectId: 's-math', examDate: '2026-03-11', startTime: '09:00', endTime: '12:00', classroom: 'Main Exam Hall', maxMarks: 100 },
  { id: 'es-2', examId: 'ex-1', classId: 'c-10a', subjectId: 's-phys', examDate: '2026-03-13', startTime: '09:00', endTime: '12:00', classroom: 'Lab B', maxMarks: 100 },
  { id: 'es-3', examId: 'ex-1', classId: 'c-10a', subjectId: 's-comp', examDate: '2026-03-15', startTime: '13:00', endTime: '16:00', classroom: 'Main Exam Hall', maxMarks: 100 }
];

export const SEED_EXAM_MARKS: ExamMark[] = [
  // Leo (Student 1) Midterm grades
  { id: 'em-1', examScheduleId: 'es-1', studentId: 'st-1', marksObtained: 88, remarks: 'Excellent performance in Algebra', gradedBy: 't-1', createdAt: new Date('2026-03-12').toISOString() },
  { id: 'em-2', examScheduleId: 'es-2', studentId: 'st-1', marksObtained: 92, remarks: 'Superb conceptual understanding of Mechanics', gradedBy: 't-1', createdAt: new Date('2026-03-14').toISOString() },
  { id: 'em-3', examScheduleId: 'es-3', studentId: 'st-1', marksObtained: 85, remarks: 'Good programming logic, minor documentation errors', gradedBy: 't-2', createdAt: new Date('2026-03-16').toISOString() },

  // Albert (Student 2) Midterm grades
  { id: 'em-4', examScheduleId: 'es-1', studentId: 'st-2', marksObtained: 99, remarks: 'Genius mathematical deductions. Top of class!', gradedBy: 't-1', createdAt: new Date('2026-03-12').toISOString() },
  { id: 'em-5', examScheduleId: 'es-2', studentId: 'st-2', marksObtained: 98, remarks: 'Incredible mastery of spacetime concepts.', gradedBy: 't-1', createdAt: new Date('2026-03-14').toISOString() },
  { id: 'em-6', examScheduleId: 'es-3', studentId: 'st-2', marksObtained: 74, remarks: 'Strong reasoning, but syntax errors in array operations.', gradedBy: 't-2', createdAt: new Date('2026-03-16').toISOString() }
];

const SEED_FEE_STRUCTURES: FeeStructure[] = [
  { id: 'fs-1', schoolId: 'school-1', academicSessionId: 'session-1', classId: 'c-10a', amount: 3500.00, dueDate: '2026-06-01', description: 'Grade 10 Semester 2 Tuition & Materials Fee' },
  { id: 'fs-2', schoolId: 'school-1', academicSessionId: 'session-1', classId: 'c-11b', amount: 3800.00, dueDate: '2026-06-01', description: 'Grade 11 Semester 2 Tuition & Science Lab Fee' }
];

const SEED_FEE_PAYMENTS: FeePayment[] = [
  // Leo has paid Tuition Fee fs-1
  { id: 'fp-1', feeStructureId: 'fs-1', studentId: 'st-1', amountPaid: 3500.00, paymentDate: '2026-05-10T11:20:00Z', paymentMethod: 'Stripe Credit Card', transactionId: 'ch_8A82F1J9293', status: 'PAID', createdAt: new Date('2026-05-10').toISOString() },
  // Albert has pending payment (nothing paid yet)
  { id: 'fp-2', feeStructureId: 'fs-1', studentId: 'st-2', amountPaid: 0, paymentDate: '', paymentMethod: '', transactionId: '', status: 'PENDING', createdAt: new Date().toISOString() }
];

const SEED_STUDY_MATERIALS: StudyMaterial[] = [
  { id: 'sm-1', schoolId: 'school-1', subjectId: 's-math', classId: 'c-10a', teacherId: 't-1', uploadedBy: 'u-teacher1', academicSessionId: 'session-1', title: 'Infinite Series Convergence Theorems Cheatsheet', description: 'Comprehensive formulas for Ratio, Root, and Integral convergence tests with solved examples.', fileUrl: 'convergence_cheatsheet.pdf', thumbnailUrl: null, fileType: 'pdf', mimeType: 'application/pdf', isVideoStreamable: false, createdAt: new Date('2026-05-18').toISOString() },
  { id: 'sm-2', schoolId: 'school-1', subjectId: 's-phys', classId: 'c-10a', teacherId: 't-1', uploadedBy: 'u-teacher1', academicSessionId: 'session-1', title: 'Video Lecture: Spacetime Geodesics Intro', description: 'An introductory overview of how light and matter curve along spacetime geodesics.', fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', thumbnailUrl: null, fileType: 'mp4', mimeType: 'video/mp4', isVideoStreamable: true, createdAt: new Date('2026-05-20').toISOString() },
  { id: 'sm-3', schoolId: 'school-1', subjectId: 's-comp', classId: 'c-10a', teacherId: 't-2', uploadedBy: 'u-teacher2', academicSessionId: 'session-1', title: 'TypeScript Advanced Types and Mapped Types Handbook', description: 'Deep-dive manual explaining Generics, Index signatures, Mapped Types, and Utility operations.', fileUrl: 'ts_generics_handbook.pdf', thumbnailUrl: null, fileType: 'pdf', mimeType: 'application/pdf', isVideoStreamable: false, createdAt: new Date('2026-05-23').toISOString() }
];

const SEED_ANNOUNCEMENTS: Announcement[] = [
  { id: 'an-1', schoolId: 'school-1', senderId: 'u-admin1', title: 'Annual STEM Exhibition Registration Open', content: 'Our Annual STEM Exhibition is scheduled for June 15th. Showcase your creative science models, robotic prototypes, or code solutions! Register by contacting your homeroom teacher before June 1st.', targetRoles: ['STUDENT', 'PARENT', 'TEACHER'], createdAt: new Date('2026-05-20').toISOString() },
  { id: 'an-2', schoolId: 'school-1', senderId: 'u-admin1', title: 'Quarterly Teacher-Parent Portal Training Seminar', content: 'There will be a brief 30-minute introductory meeting on using the portal tracking dashboards on Saturday, June 2nd, at 10 AM. Link will be shared in active feeds.', targetRoles: ['TEACHER', 'PARENT'], createdAt: new Date('2026-05-24').toISOString() }
];

const SEED_NOTIFICATIONS: Notification[] = [
  { id: 'n-1', userId: 'u-student1', title: 'Assignment Graded', message: 'Marcus Aurelius graded "Vector Space Calculus Proofs". Score: 95/100', isRead: false, createdAt: new Date('2026-05-24T18:05:00Z').toISOString() },
  { id: 'n-2', userId: 'u-parent1', title: 'Report Available', message: 'Leo DaVinci\'s Midterm assessments marks are finalized. Select his account to review grades.', isRead: false, createdAt: new Date('2026-05-24T18:10:00Z').toISOString() }
];

const SEED_FORUM_CATEGORIES: ForumCategory[] = [
  { id: 'fc-1', schoolId: 'school-1', name: 'General Q&A', description: 'Standard school topics, general academic questions' },
  { id: 'fc-2', schoolId: 'school-1', name: 'Computer Science & Tech', description: 'Share coding concepts, programming bugs, and tech advancements' }
];

const SEED_FORUM_POSTS: ForumPost[] = [
  { id: 'fpt-1', categoryId: 'fc-2', authorId: 'u-student1', title: 'Is O(N log N) sorting always better than O(N^2)?', content: 'Hi everyone, I was looking at sorting algorithms. Is it possible that for small arrays, an O(N^2) sorting algorithm like Insertion Sort performs better than Quick Sort or Merge Sort? Let me know your thoughts!', createdAt: new Date('2026-05-23T10:00:00Z').toISOString() }
];

const SEED_FORUM_REPLIES: ForumReply[] = [
  { id: 'frp-1', postId: 'fpt-1', authorId: 'u-teacher2', content: 'Yes, Leo! Excellent question. Insertion sort has very low constant factor overhead. For small arrays (typically N < 15 to 20), it is very fast. In fact, many standard libraries use a hybrid approach (like Timsort or IntroSort) that switches to insertion sort when array slices become small!', createdAt: new Date('2026-05-23T11:45:00Z').toISOString() }
];

const SEED_CHAT_MESSAGES: ChatMessage[] = [
  { id: 'cm-1', senderId: 'u-parent1', receiverId: 'u-teacher1', message: 'Hello Mr. Marcus. I wanted to ask how Leo is doing in Physics? Is there any extra syllabus I can review with him?', isRead: true, createdAt: new Date('2026-05-24T09:00:00Z').toISOString() },
  { id: 'cm-2', senderId: 'u-teacher1', receiverId: 'u-parent1', message: 'Hello Robert. Leo is doing phenomenally! He scored 92% on his midterm mechanics exam. I have uploaded a SPACETIME lecture in materials. He will love studying that!', isRead: false, createdAt: new Date('2026-05-24T10:15:00Z').toISOString() }
];

const SEED_AUDIT_LOGS: AuditLog[] = [
  { id: 'al-1', userId: 'u-admin1', ipAddress: '192.168.1.10', action: 'INIT_SCHOOL', details: { schoolName: 'Aegis Academy' }, createdAt: new Date('2026-05-24T08:00:00Z').toISOString() },
  { id: 'al-2', userId: 'u-teacher1', ipAddress: '192.168.1.12', action: 'GRADE_ASSIGNMENT', details: { studentId: 'st-1', score: 95 }, createdAt: new Date('2026-05-24T18:00:00Z').toISOString() }
];

const SEED_PHONE_NUMBERS: PhoneNumber[] = [
  { id: 'pn-1', userId: 'u-superadmin', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5559990000', fullNumber: '+15559990000', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-2', userId: 'u-admin1', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5558881111', fullNumber: '+15558881111', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-3', userId: 'u-teacher1', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5557772222', fullNumber: '+15557772222', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-4', userId: 'u-teacher2', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5557773333', fullNumber: '+15557773333', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-5', userId: 'u-student1', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5556664444', fullNumber: '+15556664444', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-6', userId: 'u-student2', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5556665555', fullNumber: '+15556665555', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-7', userId: 'u-student3', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5556666666', fullNumber: '+15556666666', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-8', userId: 'u-parent1', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5555557777', fullNumber: '+15555557777', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-9', userId: 'u-parent1', schoolId: 'school-1', phoneType: 'EMERGENCY', countryCode: '+1', nationalNumber: '5559119999', fullNumber: '+15559119999', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-10', userId: 'u-parent2', schoolId: 'school-1', phoneType: 'PRIMARY', countryCode: '+1', nationalNumber: '5555558888', fullNumber: '+15555558888', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'pn-11', userId: 'u-parent2', schoolId: 'school-1', phoneType: 'EMERGENCY', countryCode: '+1', nationalNumber: '5559118888', fullNumber: '+15559118888', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const SEED_EMAIL_ADDRESSES: EmailAddress[] = [
  { id: 'ea-1', userId: 'u-superadmin', emailType: 'LOGIN', email: 'superadmin@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-2', userId: 'u-admin1', schoolId: 'school-1', emailType: 'LOGIN', email: 'admin@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-3', userId: 'u-teacher1', schoolId: 'school-1', emailType: 'LOGIN', email: 'teacher1@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-4', userId: 'u-teacher2', schoolId: 'school-1', emailType: 'LOGIN', email: 'teacher2@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-5', userId: 'u-student1', schoolId: 'school-1', emailType: 'LOGIN', email: 'student1@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-6', userId: 'u-student2', schoolId: 'school-1', emailType: 'LOGIN', email: 'student2@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-7', userId: 'u-student3', schoolId: 'school-1', emailType: 'LOGIN', email: 'student3@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-8', userId: 'u-parent1', schoolId: 'school-1', emailType: 'LOGIN', email: 'parent1@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'ea-9', userId: 'u-parent2', schoolId: 'school-1', emailType: 'LOGIN', email: 'parent2@aegis.com', isPrimary: true, isVerified: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];

const SEED_BOOKS: Book[] = [
  { id: 'bk-1', schoolId: 'school-1', title: 'Advanced Calculus and Applications', author: 'Dr. Ramanujan Iyer', isbn: '978-0-13-110362-7', subject: 'Mathematics', totalCopies: 15, availableCopies: 9, createdAt: new Date('2024-06-01').toISOString() },
  { id: 'bk-2', schoolId: 'school-1', title: 'Principles of Quantum Mechanics', author: 'R. Shankar', isbn: '978-0-306-44790-7', subject: 'Physics', totalCopies: 12, availableCopies: 7, createdAt: new Date('2024-06-01').toISOString() },
  { id: 'bk-3', schoolId: 'school-1', title: 'Introduction to Algorithms', author: 'Thomas H. Cormen', isbn: '978-0-262-03384-8', subject: 'Computer Science', totalCopies: 20, availableCopies: 14, createdAt: new Date('2024-06-01').toISOString() },
  { id: 'bk-4', schoolId: 'school-1', title: 'Organic Chemistry: Structure & Function', author: 'K. Peter C. Vollhardt', isbn: '978-1-319-18871-5', subject: 'Chemistry', totalCopies: 10, availableCopies: 6, createdAt: new Date('2024-06-01').toISOString() },
  { id: 'bk-5', schoolId: 'school-1', title: 'Modern Biology: Principles & Processes', author: 'H. Curtis & N. Barnes', isbn: '978-0-07-015834-5', subject: 'Biology', totalCopies: 18, availableCopies: 11, createdAt: new Date('2024-06-01').toISOString() },
  { id: 'bk-6', schoolId: 'school-1', title: 'A Brief History of Time', author: 'Stephen Hawking', isbn: '978-0-553-38016-3', subject: 'Physics', totalCopies: 8, availableCopies: 3, createdAt: new Date('2024-06-01').toISOString() },
  { id: 'bk-7', schoolId: 'school-1', title: 'The Art of Electronics', author: 'Paul Horowitz', isbn: '978-0-521-80926-9', subject: 'Electronics', totalCopies: 6, availableCopies: 4, createdAt: new Date('2024-06-01').toISOString() },
  { id: 'bk-8', schoolId: 'school-1', title: 'Linear Algebra Done Right', author: 'Sheldon Axler', isbn: '978-3-319-11079-0', subject: 'Mathematics', totalCopies: 14, availableCopies: 10, createdAt: new Date('2024-06-01').toISOString() }
];

const SEED_DRIVERS: Driver[] = [
  { id: 'dr-1', schoolId: 'school-1', name: 'Robert Peterson', licenseNumber: 'DL-9938812', phone: '+1 555-0199', status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'dr-2', schoolId: 'school-1', name: 'David Miller', licenseNumber: 'DL-2299834', phone: '+1 555-0144', status: 'ACTIVE', createdAt: new Date().toISOString() }
];

const SEED_BUSES: Bus[] = [
  { id: 'bus-1', schoolId: 'school-1', numberPlate: 'MH-12-AB-3456', capacity: 40, status: 'ACTIVE', driverId: 'dr-1', createdAt: new Date().toISOString() },
  { id: 'bus-2', schoolId: 'school-1', numberPlate: 'MH-12-XY-9876', capacity: 32, status: 'ACTIVE', driverId: 'dr-2', createdAt: new Date().toISOString() }
];

const SEED_ROUTES: Route[] = [
  { id: 'rt-1', schoolId: 'school-1', name: 'Downtown Expressway Route', routeCode: 'R-102', startPoint: 'Main Depot', endPoint: 'Aegis High Campus', fare: 45.0, createdAt: new Date().toISOString() },
  { id: 'rt-2', schoolId: 'school-1', name: 'Westside Suburbs Route', routeCode: 'R-105', startPoint: 'West Mall Stop', endPoint: 'Aegis High Campus', fare: 60.0, createdAt: new Date().toISOString() }
];

const SEED_PICKUP_POINTS: PickupPoint[] = [
  { id: 'pp-1', schoolId: 'school-1', name: 'Main Square Crossing', latitude: 40.7128, longitude: -74.0060, routeId: 'rt-1', createdAt: new Date().toISOString() },
  { id: 'pp-2', schoolId: 'school-1', name: 'Highway Exit 4 Junction', latitude: 40.7589, longitude: -73.9851, routeId: 'rt-1', createdAt: new Date().toISOString() },
  { id: 'pp-3', schoolId: 'school-1', name: 'Greenwood Park Stop', latitude: 40.6782, longitude: -73.9442, routeId: 'rt-2', createdAt: new Date().toISOString() }
];

const SEED_TRANSPORT_ASSIGNMENTS: TransportAssignment[] = [
  { id: 'ta-1', schoolId: 'school-1', studentId: 'st-1', routeId: 'rt-1', busId: 'bus-1', pickupPointId: 'pp-1', status: 'ACTIVE', createdAt: new Date().toISOString() },
  { id: 'ta-2', schoolId: 'school-1', studentId: 'st-2', routeId: 'rt-1', busId: 'bus-1', pickupPointId: 'pp-2', status: 'ACTIVE', createdAt: new Date().toISOString() }
];

const SEED_TRANSPORT_FEE_RECORDS: TransportFeeRecord[] = [
  { id: 'tfr-1', schoolId: 'school-1', academicSessionId: 'session-1', studentId: 'st-1', routeId: 'rt-1', amount: 180.00, status: 'UNPAID', createdAt: new Date().toISOString() },
  { id: 'tfr-2', schoolId: 'school-1', academicSessionId: 'session-1', studentId: 'st-2', routeId: 'rt-1', amount: 180.00, status: 'PAID', createdAt: new Date().toISOString() }
];

const SEED_VEHICLE_LOGS: VehicleLog[] = [
  { id: 'vl-1', schoolId: 'school-1', busId: 'bus-1', logType: 'FUEL', description: 'Diesel refill 60 Liters', amount: 90.0, createdAt: new Date().toISOString() },
  { id: 'vl-2', schoolId: 'school-1', busId: 'bus-2', logType: 'TRIP_START', description: 'Morning trip start', amount: 0, createdAt: new Date().toISOString() }
];

const SEED_MAINTENANCE_LOGS: MaintenanceLog[] = [
  { id: 'ml-1', schoolId: 'school-1', busId: 'bus-1', logDate: new Date().toISOString().split('T')[0], description: 'Engine oil replacement and filters clean', cost: 120.00, createdAt: new Date().toISOString() }
];

const SEED_DRIVER_ATTENDANCE: DriverAttendance[] = [
  { id: 'da-1', schoolId: 'school-1', driverId: 'dr-1', date: new Date().toISOString().split('T')[0], status: 'PRESENT', createdAt: new Date().toISOString() },
  { id: 'da-2', schoolId: 'school-1', driverId: 'dr-2', date: new Date().toISOString().split('T')[0], status: 'PRESENT', createdAt: new Date().toISOString() }
];

const SEED_BOOK_CATEGORIES: BookCategory[] = [
  { id: 'bc-1', schoolId: 'school-1', name: 'Mathematics & Algebra', code: 'MATH', description: 'Textbooks and reference materials for mathematics, algebra, calculus and statistics.', createdAt: new Date().toISOString() },
  { id: 'bc-2', schoolId: 'school-1', name: 'Physics & Thermodynamics', code: 'PHYS', description: 'Physics, mechanics, thermodynamics and quantum theory references.', createdAt: new Date().toISOString() },
  { id: 'bc-3', schoolId: 'school-1', name: 'Computer Coding', code: 'CS', description: 'Programming languages, algorithms, data structures and software engineering.', createdAt: new Date().toISOString() }
];

const SEED_BOOK_ISSUES: BookIssue[] = [
  { id: 'bi-1', schoolId: 'school-1', bookId: 'bk-1', studentId: 'st-1', issueDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), dueDate: new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString(), returnDate: null, fineAmount: 0, status: 'ISSUED', createdAt: new Date().toISOString() },
  { id: 'bi-2', schoolId: 'school-1', bookId: 'bk-2', studentId: 'st-2', issueDate: new Date(Date.now() - 20 * 24 * 3600 * 1000).toISOString(), dueDate: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(), returnDate: null, fineAmount: 3.50, status: 'OVERDUE', createdAt: new Date().toISOString() }
];

const SEED_BOOK_RETURNS: BookReturn[] = [
  { id: 'br-1', schoolId: 'school-1', issueId: 'bi-1', returnDate: new Date().toISOString(), fineAmount: 0, status: 'RETURNED', createdAt: new Date().toISOString() }
];

const SEED_LIBRARY_FINES: LibraryFine[] = [
  { id: 'lf-1', schoolId: 'school-1', issueId: 'bi-2', studentId: 'st-2', amount: 3.50, isPaid: false, createdAt: new Date().toISOString() }
];

const SEED_LIBRARY_INVOICES: LibraryInvoice[] = [
  { id: 'li-1', schoolId: 'school-1', studentId: 'st-2', amount: 3.50, status: 'UNPAID', createdAt: new Date().toISOString() }
];

const SEED_DIGITAL_LIBRARY_ASSETS: DigitalLibraryAsset[] = [
  { id: 'dla-1', schoolId: 'school-1', title: 'Calculus Made Easy - PDF TextBook', author: 'Silvanus P. Thompson', fileUrl: 'https://aegis-erp.s3.amazonaws.com/calculus_easy.pdf', fileType: 'pdf', createdAt: new Date().toISOString() },
  { id: 'dla-2', schoolId: 'school-1', title: 'Interactive Algorithms 3D Visualizer', author: 'CLRS', fileUrl: 'https://aegis-erp.s3.amazonaws.com/algorithms.zip', fileType: 'epub', createdAt: new Date().toISOString() }
];

const SEED_EXAM_SUBJECTS: ExamSubject[] = [
  { id: 'es-1', schoolId: 'school-1', examId: 'ex-1', subjectId: 's-math', maxMarks: 100, passingMarks: 40, createdAt: new Date().toISOString() },
  { id: 'es-2', schoolId: 'school-1', examId: 'ex-1', subjectId: 's-physics', maxMarks: 100, passingMarks: 40, createdAt: new Date().toISOString() }
];

const SEED_STUDENT_MARKS: StudentMark[] = [
  { id: 'sm-1', schoolId: 'school-1', examId: 'ex-1', subjectId: 's-math', studentId: 'st-1', marksObtained: 85, remarks: 'Excellent score', createdAt: new Date().toISOString() },
  { id: 'sm-2', schoolId: 'school-1', examId: 'ex-1', subjectId: 's-physics', studentId: 'st-1', marksObtained: 78, remarks: 'Good analytical skills', createdAt: new Date().toISOString() },
  { id: 'sm-3', schoolId: 'school-1', examId: 'ex-1', subjectId: 's-math', studentId: 'st-2', marksObtained: 55, remarks: 'Needs revision', createdAt: new Date().toISOString() },
  { id: 'sm-4', schoolId: 'school-1', examId: 'ex-1', subjectId: 's-physics', studentId: 'st-2', marksObtained: 60, remarks: 'Average response', createdAt: new Date().toISOString() }
];

const SEED_EXAM_RESULTS: ExamResult[] = [
  { id: 'er-1', schoolId: 'school-1', studentId: 'st-1', examId: 'ex-1', totalMarks: 200, marksObtained: 163, percentage: 81.5, grade: 'A', status: 'PASSED', createdAt: new Date().toISOString() },
  { id: 'er-2', schoolId: 'school-1', studentId: 'st-2', examId: 'ex-1', totalMarks: 200, marksObtained: 115, percentage: 57.5, grade: 'C', status: 'PASSED', createdAt: new Date().toISOString() }
];

const SEED_REPORT_CARDS: ReportCard[] = [
  { id: 'rc-1', schoolId: 'school-1', academicSessionId: 'session-1', studentId: 'st-1', term: 'TERM 1', attendancePercentage: 92, gradePointAverage: 8.15, remarks: 'Distinction performance in mathematical studies.', fileUrl: '', createdAt: new Date().toISOString() },
  { id: 'rc-2', schoolId: 'school-1', academicSessionId: 'session-1', studentId: 'st-2', term: 'TERM 1', attendancePercentage: 88, gradePointAverage: 5.75, remarks: 'Needs concentration on logic sciences.', fileUrl: '', createdAt: new Date().toISOString() }
];

const SEED_QUIZ_RESULTS: QuizResult[] = [
  { id: 'qr-1', schoolId: 'school-1', studentId: 'st-1', quizId: 'q-1', score: 9, totalMarks: 10, createdAt: new Date().toISOString() },
  { id: 'qr-2', schoolId: 'school-1', studentId: 'st-2', quizId: 'q-1', score: 7, totalMarks: 10, createdAt: new Date().toISOString() }
];

const SEED_SYSTEM_STATUSES: SystemStatus[] = [
  { id: 'status-1', serviceName: 'Core ERP Console', status: 'OPERATIONAL', description: 'All core modules are performing normally.', updatedAt: new Date().toISOString() },
  { id: 'status-2', serviceName: 'Database Engine', status: 'OPERATIONAL', description: 'Data operations and replication are fully functional.', updatedAt: new Date().toISOString() },
  { id: 'status-3', serviceName: 'Aegis Communicator', status: 'OPERATIONAL', description: 'Realtime chat and messaging server online.', updatedAt: new Date().toISOString() },
  { id: 'status-4', serviceName: 'Document Engine', status: 'OPERATIONAL', description: 'Report cards, receipts, and templates printing service operational.', updatedAt: new Date().toISOString() },
  { id: 'status-5', serviceName: 'Payment Gateway Integration', status: 'OPERATIONAL', description: 'Stripe, card, and net banking systems operational.', updatedAt: new Date().toISOString() },
  { id: 'status-6', serviceName: 'Transit & Fleet Telemetry', status: 'OPERATIONAL', description: 'Bus logs, driver registry, and routing functional.', updatedAt: new Date().toISOString() },
  { id: 'status-7', serviceName: 'Hostel Hub Core', status: 'OPERATIONAL', description: 'Warden registers, bed vacancy, and check-in APIs operational.', updatedAt: new Date().toISOString() }
];

const SEED_KNOWLEDGE_BASE: KnowledgeBaseArticle[] = [
  {
    id: 'kb-1',
    title: 'Aegis Communicator: Contact Discovery Help',
    category: 'Communicator',
    content: `### Aegis Communicator Guide\n\nThe Aegis Communicator allows direct messaging between permitted roles under strict administrative safety controls:\n\n* **School Admins** can discover and chat with all Super Admins, all Sub-Admins, and all Teachers.\n* **Super Admins** can discover and chat with School Admins from their respective registered institutions.\n* **Teachers, Parents, and Students** have role-specific discovery permissions synchronized in real-time.\n\n**Common Troubleshooting:**\n* If you see "0 contacts available", try logging out and logging back in to force a refresh of your cached credentials.`,
    targetRoles: ['STUDENT', 'PARENT', 'TEACHER', 'ADMIN', 'SUPER_ADMIN'],
    createdAt: new Date('2026-06-01').toISOString(),
    updatedAt: new Date('2026-06-01').toISOString()
  },
  {
    id: 'kb-2',
    title: 'How to Download and Verify Student Report Cards',
    category: 'Academics',
    content: `### Student Report Cards & Grades\n\nReport cards are generated digitally by Homeroom teachers and can be verified by anyone globally via a unique secure QR link.\n\n* **Parents & Students:** Navigate to **Report Cards** or **Grades Progress** from your dashboard to view marks.\n* **Verification:** Every printed report card contains a verification URL at the bottom: \`#/verify/marksheet/[UUID]\`. Navigating to this URL allows anyone (e.g., colleges, boards) to instantly pull the original record directly from our secure disaster recovery ledger.`,
    targetRoles: ['STUDENT', 'PARENT', 'TEACHER', 'ADMIN'],
    createdAt: new Date('2026-06-02').toISOString(),
    updatedAt: new Date('2026-06-02').toISOString()
  },
  {
    id: 'kb-3',
    title: 'Hostel Hub: Student Check-In and Leave Workflow',
    category: 'Hostel Management',
    content: `### Hostel Hub Guide\n\nHostel administration follows a strict 4-level validation flow:\n\n1. **Room Assignment:** Admin checks in a student into a vacant bed. The bed status automatically shifts from \`VACANT\` to \`OCCUPIED\`.\n2. **Leave Request:** Students or parents submit leave requests detailing travel plans.\n3. **Approval Sequence:** Leave requests must go through **Parent Approval** → **Warden Approval** → **Hostel Admin Approval** → **School Admin Approval**.\n4. **Status Updates:** The request status shifts to \`APPROVED\` only after all four checkpoints approve.`,
    targetRoles: ['STUDENT', 'PARENT', 'TEACHER', 'ADMIN'],
    createdAt: new Date('2026-06-03').toISOString(),
    updatedAt: new Date('2026-06-03').toISOString()
  },
  {
    id: 'kb-4',
    title: 'Billing and Online Fee Invoicing',
    category: 'Billing & Fees',
    content: `### Fee Invoicing and Ledgers\n\n* **Tuition Fees:** Invoiced automatically per academic session based on the student's class registry.\n* **Hostel Fees:** Created by the Hostel Admin and invoiced directly to student portal ledgers.\n* **Payments:** Can be paid online via Stripe or logged manually as Cash/Bank Transfer in the Invoicing Office. Live receipts are automatically appended to the Documents Center.`,
    targetRoles: ['STUDENT', 'PARENT', 'ADMIN'],
    createdAt: new Date('2026-06-04').toISOString(),
    updatedAt: new Date('2026-06-04').toISOString()
  },
  {
    id: 'kb-5',
    title: 'Transit Registry & Route Assignments',
    category: 'Transport & Transit',
    content: `### School Transit & Route Assignment\n\n* **Students:** Under the **School Transit** tab, students can view their assigned route, vehicle number plate, driver name, driver phone number, and pickup point details.\n* **Admins:** Manage drivers, vehicle logs (maintenance, fuel), routes, and assignments. All mutation actions are logged to the global transport audit stream for security compliance.`,
    targetRoles: ['STUDENT', 'PARENT', 'ADMIN'],
    createdAt: new Date('2026-06-05').toISOString(),
    updatedAt: new Date('2026-06-05').toISOString()
  }
];

// --- MOCK DATABASE CLASS ---

class MockDatabase {
  users: User[];
  schools: School[];
  academicSessions: typeof SEED_ACADEMIC_SESSIONS;
  classes: Class[];
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  students: Student[];
  parents: Parent[];
  parentStudentMappings: ParentStudentMapping[];
  teacherClassSubjectMappings: TeacherClassSubjectMapping[];
  timetables: Timetable[];
  attendance: Attendance[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  quizzes: Quiz[];
  quizQuestions: QuizQuestion[];
  quizAttempts: QuizAttempt[];
  exams: Exam[];
  examSchedules: ExamSchedule[];
  examMarks: ExamMark[];
  feeStructures: FeeStructure[];
  feePayments: FeePayment[];
  studyMaterials: StudyMaterial[];
  announcements: Announcement[];
  notifications: Notification[];
  forumCategories: ForumCategory[];
  forumPosts: ForumPost[];
  forumReplies: ForumReply[];
  chatMessages: ChatMessage[];
  auditLogs: AuditLog[];
  phoneNumbers: PhoneNumber[];
  emailAddresses: EmailAddress[];
  homeworkAttachments: HomeworkAttachment[];
  books: Book[];
  drivers: Driver[];
  buses: Bus[];
  routes: Route[];
  pickupPoints: PickupPoint[];
  transportAssignments: TransportAssignment[];
  transportFeeRecords: TransportFeeRecord[];
  vehicleLogs: VehicleLog[];
  maintenanceLogs: MaintenanceLog[];
  driverAttendance: DriverAttendance[];
  bookCategories: BookCategory[];
  bookIssues: BookIssue[];
  bookReturns: BookReturn[];
  libraryFines: LibraryFine[];
  libraryInvoices: LibraryInvoice[];
  digitalLibraryAssets: DigitalLibraryAsset[];
  examSubjects: ExamSubject[];
  studentMarks: StudentMark[];
  examResults: ExamResult[];
  reportCards: ReportCard[];
  quizResults: QuizResult[];
  driverSalaryPayouts: DriverSalaryPayout[];
  hostels: any[];
  hostelBlocks: any[];
  hostelRooms: any[];
  hostelBeds: any[];
  hostelWardens: any[];
  hostelBuildings: any[];
  hostelWardenAssignments: any[];
  hostelAdmissions: any[];
  hostelAttendance: any[];
  hostelFees: any[];
  hostelPayments: any[];
  hostelLeaveRequests: any[];
  hostelVisitors: any[];
  hostelComplaints: any[];
  hostelMessMenu: any[];
  supportTickets: SupportTicket[];
  supportTicketMessages: SupportTicketMessage[];
  supportTicketStatusLogs: SupportTicketStatusLog[];
  supportInternalNotes: SupportInternalNote[];
  supportNotifications: SupportNotification[];
  bugReports: BugReport[];
  systemStatuses: SystemStatus[];
  knowledgeBaseArticles: KnowledgeBaseArticle[];

  constructor() {
    this.users = getStorage<User[]>('users', SEED_USERS);
    this.schools = getStorage<School[]>('schools', [SEED_SCHOOL]);
    let schoolsMigrated = false;
    this.schools.forEach((s, idx) => {
      if (!s.country || !s.currencyCode || !s.currencySymbol) {
        this.schools[idx].country = s.country || 'USA';
        this.schools[idx].currencyCode = s.currencyCode || 'USD';
        this.schools[idx].currencySymbol = s.currencySymbol || '$';
        this.schools[idx].timezone = s.timezone || 'America/New_York';
        schoolsMigrated = true;
      }
    });
    if (schoolsMigrated) {
      setStorage('schools', this.schools);
    }
    this.academicSessions = getStorage<typeof SEED_ACADEMIC_SESSIONS>('academic_sessions', SEED_ACADEMIC_SESSIONS);
    this.classes = getStorage<Class[]>('classes', SEED_CLASSES);
    this.sections = getStorage<Section[]>('sections', SEED_SECTIONS);

    // Self-healing class migration
    let migrated = false;
    this.classes.forEach((c, idx) => {
      const seed = SEED_CLASSES.find(s => s.id === c.id);
      if (seed && !c.classTeacherId) {
        this.classes[idx].classTeacherId = seed.classTeacherId;
        migrated = true;
      }
    });
    if (migrated) {
      setStorage('classes', this.classes);
    }
    this.subjects = getStorage<Subject[]>('subjects', SEED_SUBJECTS);
    this.teachers = getStorage<Teacher[]>('teachers', SEED_TEACHERS);
    this.students = getStorage<Student[]>('students', SEED_STUDENTS);
    this.parents = getStorage<Parent[]>('parents', SEED_PARENTS);
    this.parentStudentMappings = getStorage<ParentStudentMapping[]>('parent_student_mappings', SEED_PARENT_STUDENT_MAPPINGS);
    this.teacherClassSubjectMappings = getStorage<TeacherClassSubjectMapping[]>('teacher_class_subject_mappings', SEED_TEACHER_CLASS_SUBJECT_MAPPINGS);
    this.timetables = getStorage<Timetable[]>('timetables', SEED_TIMETABLE);
    this.attendance = getStorage<Attendance[]>('attendance', SEED_ATTENDANCE);
    this.assignments = getStorage<Assignment[]>('assignments', SEED_ASSIGNMENTS);
    this.assignmentSubmissions = getStorage<AssignmentSubmission[]>('assignment_submissions', SEED_SUBMISSIONS);
    this.quizzes = getStorage<Quiz[]>('quizzes', SEED_QUIZZES);
    this.quizQuestions = getStorage<QuizQuestion[]>('quiz_questions', SEED_QUIZ_QUESTIONS);
    this.quizAttempts = getStorage<QuizAttempt[]>('quiz_attempts', SEED_QUIZ_ATTEMPTS);
    this.exams = getStorage<Exam[]>('exams', SEED_EXAMS);
    this.examSchedules = getStorage<ExamSchedule[]>('exam_schedules', SEED_EXAM_SCHEDULES);
    this.examMarks = getStorage<ExamMark[]>('exam_marks', SEED_EXAM_MARKS);
    this.feeStructures = getStorage<FeeStructure[]>('fee_structures', SEED_FEE_STRUCTURES);
    this.feePayments = getStorage<FeePayment[]>('fee_payments', SEED_FEE_PAYMENTS);
    this.studyMaterials = getStorage<StudyMaterial[]>('study_materials', SEED_STUDY_MATERIALS);
    this.announcements = getStorage<Announcement[]>('announcements', SEED_ANNOUNCEMENTS);
    this.notifications = getStorage<Notification[]>('notifications', SEED_NOTIFICATIONS);
    this.forumCategories = getStorage<ForumCategory[]>('forum_categories', SEED_FORUM_CATEGORIES);
    this.forumPosts = getStorage<ForumPost[]>('forum_posts', SEED_FORUM_POSTS);
    this.forumReplies = getStorage<ForumReply[]>('forum_replies', SEED_FORUM_REPLIES);
    this.chatMessages = getStorage<ChatMessage[]>('chat_messages', []);
    this.auditLogs = getStorage<AuditLog[]>('audit_logs', SEED_AUDIT_LOGS);
    this.phoneNumbers = getStorage<PhoneNumber[]>('phone_numbers', SEED_PHONE_NUMBERS);
    this.emailAddresses = getStorage<EmailAddress[]>('email_addresses', SEED_EMAIL_ADDRESSES);
    this.homeworkAttachments = getStorage<HomeworkAttachment[]>('homework_attachments', []);
    this.books = getStorage<Book[]>('books', SEED_BOOKS);
    this.drivers = getStorage<Driver[]>('drivers', SEED_DRIVERS);
    this.buses = getStorage<Bus[]>('buses', SEED_BUSES);
    this.routes = getStorage<Route[]>('routes', SEED_ROUTES);
    this.pickupPoints = getStorage<PickupPoint[]>('pickup_points', SEED_PICKUP_POINTS);
    this.transportAssignments = getStorage<TransportAssignment[]>('transport_assignments', SEED_TRANSPORT_ASSIGNMENTS);
    this.transportFeeRecords = getStorage<TransportFeeRecord[]>('transport_fee_records', SEED_TRANSPORT_FEE_RECORDS);
    this.vehicleLogs = getStorage<VehicleLog[]>('vehicle_logs', SEED_VEHICLE_LOGS);
    this.maintenanceLogs = getStorage<MaintenanceLog[]>('maintenance_logs', SEED_MAINTENANCE_LOGS);
    this.driverAttendance = getStorage<DriverAttendance[]>('driver_attendance', SEED_DRIVER_ATTENDANCE);
    this.bookCategories = getStorage<BookCategory[]>('book_categories', SEED_BOOK_CATEGORIES);
    this.bookIssues = getStorage<BookIssue[]>('book_issues', SEED_BOOK_ISSUES);
    this.bookReturns = getStorage<BookReturn[]>('book_returns', SEED_BOOK_RETURNS);
    this.libraryFines = getStorage<LibraryFine[]>('library_fines', SEED_LIBRARY_FINES);
    this.libraryInvoices = getStorage<LibraryInvoice[]>('library_invoices', SEED_LIBRARY_INVOICES);
    this.digitalLibraryAssets = getStorage<DigitalLibraryAsset[]>('digital_library_assets', SEED_DIGITAL_LIBRARY_ASSETS);
    this.examSubjects = getStorage<ExamSubject[]>('exam_subjects', SEED_EXAM_SUBJECTS);
    this.studentMarks = getStorage<StudentMark[]>('student_marks', SEED_STUDENT_MARKS);
    this.examResults = getStorage<ExamResult[]>('exam_results', SEED_EXAM_RESULTS);
    this.reportCards = getStorage<ReportCard[]>('report_cards', SEED_REPORT_CARDS);
    this.quizResults = getStorage<QuizResult[]>('quiz_results', SEED_QUIZ_RESULTS);
    this.driverSalaryPayouts = getStorage<DriverSalaryPayout[]>('driver_salary_payouts', []);
    this.hostels = getStorage<any[]>('hostels', []);
    this.hostelBlocks = getStorage<any[]>('hostel_blocks', []);
    this.hostelRooms = getStorage<any[]>('hostel_rooms', []);
    this.hostelBeds = getStorage<any[]>('hostel_beds', []);
    this.hostelWardens = getStorage<any[]>('hostel_wardens', []);
    this.hostelBuildings = getStorage<any[]>('hostel_buildings', []);
    this.hostelWardenAssignments = getStorage<any[]>('hostel_warden_assignments', []);
    this.hostelAdmissions = getStorage<any[]>('hostel_admissions', []);
    this.hostelAttendance = getStorage<any[]>('hostel_attendance', []);
    this.hostelFees = getStorage<any[]>('hostel_fees', []);
    this.hostelPayments = getStorage<any[]>('hostel_payments', []);
    this.hostelLeaveRequests = getStorage<any[]>('hostel_leave_requests', []);
    this.hostelVisitors = getStorage<any[]>('hostel_visitors', []);
    this.hostelComplaints = getStorage<any[]>('hostel_complaints', []);
    this.hostelMessMenu = getStorage<any[]>('hostel_mess_menu', []);
    this.supportTickets = getStorage<SupportTicket[]>('support_tickets', []);
    this.supportTicketMessages = getStorage<SupportTicketMessage[]>('support_ticket_messages', []);
    this.supportTicketStatusLogs = getStorage<SupportTicketStatusLog[]>('support_ticket_status_logs', []);
    this.supportInternalNotes = getStorage<SupportInternalNote[]>('support_internal_notes', []);
    this.supportNotifications = getStorage<SupportNotification[]>('support_notifications', []);
    this.bugReports = getStorage<BugReport[]>('bug_reports', []);
    this.systemStatuses = getStorage<SystemStatus[]>('system_statuses', SEED_SYSTEM_STATUSES);
    this.knowledgeBaseArticles = getStorage<KnowledgeBaseArticle[]>('knowledge_base_articles', SEED_KNOWLEDGE_BASE);
  }

  saveAll() {
    setStorage('users', this.users);
    setStorage('schools', this.schools);
    setStorage('classes', this.classes);
    setStorage('sections', this.sections);
    setStorage('subjects', this.subjects);
    setStorage('teachers', this.teachers);
    setStorage('students', this.students);
    setStorage('parents', this.parents);
    setStorage('parent_student_mappings', this.parentStudentMappings);
    setStorage('teacher_class_subject_mappings', this.teacherClassSubjectMappings);
    setStorage('timetables', this.timetables);
    setStorage('attendance', this.attendance);
    setStorage('assignments', this.assignments);
    setStorage('assignment_submissions', this.assignmentSubmissions);
    setStorage('quizzes', this.quizzes);
    setStorage('quiz_questions', this.quizQuestions);
    setStorage('quiz_attempts', this.quizAttempts);
    setStorage('exams', this.exams);
    setStorage('exam_schedules', this.examSchedules);
    setStorage('exam_marks', this.examMarks);
    setStorage('fee_structures', this.feeStructures);
    setStorage('fee_payments', this.feePayments);
    setStorage('study_materials', this.studyMaterials);
    setStorage('announcements', this.announcements);
    setStorage('notifications', this.notifications);
    setStorage('forum_categories', this.forumCategories);
    setStorage('forum_posts', this.forumPosts);
    setStorage('forum_replies', this.forumReplies);
    setStorage('chat_messages', this.chatMessages);
    setStorage('audit_logs', this.auditLogs);
    setStorage('phone_numbers', this.phoneNumbers);
    setStorage('email_addresses', this.emailAddresses);
    setStorage('academic_sessions', this.academicSessions);
    setStorage('homework_attachments', this.homeworkAttachments);
    setStorage('books', this.books);
    setStorage('drivers', this.drivers);
    setStorage('buses', this.buses);
    setStorage('routes', this.routes);
    setStorage('pickup_points', this.pickupPoints);
    setStorage('transport_assignments', this.transportAssignments);
    setStorage('transport_fee_records', this.transportFeeRecords);
    setStorage('vehicle_logs', this.vehicleLogs);
    setStorage('maintenance_logs', this.maintenanceLogs);
    setStorage('driver_attendance', this.driverAttendance);
    setStorage('book_categories', this.bookCategories);
    setStorage('book_issues', this.bookIssues);
    setStorage('book_returns', this.bookReturns);
    setStorage('library_fines', this.libraryFines);
    setStorage('library_invoices', this.libraryInvoices);
    setStorage('digital_library_assets', this.digitalLibraryAssets);
    setStorage('exam_subjects', this.examSubjects);
    setStorage('student_marks', this.studentMarks);
    setStorage('exam_results', this.examResults);
    setStorage('report_cards', this.reportCards);
    setStorage('quiz_results', this.quizResults);
    setStorage('driver_salary_payouts', this.driverSalaryPayouts);
    setStorage('hostels', this.hostels);
    setStorage('hostel_blocks', this.hostelBlocks);
    setStorage('hostel_rooms', this.hostelRooms);
    setStorage('hostel_beds', this.hostelBeds);
    setStorage('hostel_wardens', this.hostelWardens);
    setStorage('hostel_buildings', this.hostelBuildings);
    setStorage('hostel_warden_assignments', this.hostelWardenAssignments);
    setStorage('hostel_admissions', this.hostelAdmissions);
    setStorage('hostel_attendance', this.hostelAttendance);
    setStorage('hostel_fees', this.hostelFees);
    setStorage('hostel_payments', this.hostelPayments);
    setStorage('hostel_leave_requests', this.hostelLeaveRequests);
    setStorage('hostel_visitors', this.hostelVisitors);
    setStorage('hostel_complaints', this.hostelComplaints);
    setStorage('hostel_mess_menu', this.hostelMessMenu);
    setStorage('support_tickets', this.supportTickets);
    setStorage('support_ticket_messages', this.supportTicketMessages);
    setStorage('support_ticket_status_logs', this.supportTicketStatusLogs);
    setStorage('support_internal_notes', this.supportInternalNotes);
    setStorage('support_notifications', this.supportNotifications);
    setStorage('bug_reports', this.bugReports);
    setStorage('system_statuses', this.systemStatuses);
    setStorage('knowledge_base_articles', this.knowledgeBaseArticles);
  }

  // --- CRUD HELPERS ---

  addLog(userId: string | null, action: string, details?: Record<string, any>) {
    const log: AuditLog = {
      id: 'al-' + Math.random().toString(36).substr(2, 9),
      userId,
      ipAddress: '127.0.0.1',
      action,
      details,
      createdAt: new Date().toISOString()
    };
    this.auditLogs.unshift(log);
    this.saveAll();
  }

  addNotification(
    userId: string, 
    title: string, 
    message: string, 
    category = 'Announcement', 
    senderId: string | null = null, 
    recipientRole?: string | null, 
    priority = 'MEDIUM'
  ) {
    const notify: Notification = {
      id: 'n-' + Math.random().toString(36).substr(2, 9),
      userId,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString(),
      senderId,
      recipientRole: recipientRole || null,
      category,
      priority
    };
    this.notifications.unshift(notify);
    this.saveAll();
  }

  getSchoolTeachers(schoolId: string): Teacher[] {
    const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    return this.teachers.filter(t => {
      if (!isUUID(t.id)) return false; // Exclude seed teachers
      if (t.schoolId !== schoolId) return false;
      const user = this.users.find(u => u.id === t.userId);
      if (!user || !user.isActive) return false;
      return true;
    });
  }
}

export const mockDb = new MockDatabase();

// --- TELEMETRY TRACKER ---
export const getSystemTelemetry = (): SystemTelemetry => {
  // Semi-random values mimicking real production loads
  const activeSess = mockDb.users.filter(u => u.isActive).length + Math.floor(Math.random() * 4);
  return {
    cpuLoad: 24.5 + Math.sin(Date.now() / 10000) * 12,
    memoryUsage: 61.2 + Math.cos(Date.now() / 20000) * 4,
    diskUsage: 48.7,
    activeSessions: activeSess,
    apiRequestsCount: 14829 + Math.floor((Date.now() % 86400000) / 1000),
    dbLatencyMs: 3.4 + Math.random() * 1.5
  };
};
