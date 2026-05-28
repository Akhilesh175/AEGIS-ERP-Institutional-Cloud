import { 
  User, Student, Parent, Teacher, School, Class, Subject, 
  ParentStudentMapping, TeacherClassSubjectMapping, Timetable, 
  Attendance, Assignment, AssignmentSubmission, Quiz, QuizQuestion, 
  QuizAttempt, Exam, ExamSchedule, ExamMark, FeeStructure, FeePayment, 
  ForumCategory, ForumPost, ForumReply, ChatMessage, AuditLog, 
  StudyMaterial, Announcement, Notification, SystemTelemetry
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
  createdAt: new Date('2024-01-01').toISOString()
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
  { id: 'u-teacher1', email: 'teacher1@aegis.com', role: 'TEACHER', firstName: 'Marcus', lastName: 'Aurelius', phone: '+1 (555) 777-2222', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-teacher2', email: 'teacher2@aegis.com', role: 'TEACHER', firstName: 'Ada', lastName: 'Lovelace', phone: '+1 (555) 777-3333', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Students
  { id: 'u-student1', email: 'student1@aegis.com', role: 'STUDENT', firstName: 'Leo', lastName: 'DaVinci', phone: '+1 (555) 666-4444', avatarUrl: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-student2', email: 'student2@aegis.com', role: 'STUDENT', firstName: 'Albert', lastName: 'Einstein', phone: '+1 (555) 666-5555', avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-student3', email: 'student3@aegis.com', role: 'STUDENT', firstName: 'Marie', lastName: 'Curie', phone: '+1 (555) 666-6666', avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  // Parents
  { id: 'u-parent1', email: 'parent1@aegis.com', role: 'PARENT', firstName: 'Robert', lastName: 'DaVinci', phone: '+1 (555) 555-7777', avatarUrl: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'u-parent2', email: 'parent2@aegis.com', role: 'PARENT', firstName: 'Pierre', lastName: 'Curie', phone: '+1 (555) 555-8888', avatarUrl: 'https://images.unsplash.com/photo-1489980508314-941910ded1f4?w=150', isActive: true, password: 'password', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
];


const SEED_CLASSES: Class[] = [
  { id: 'c-10a', schoolId: 'school-1', name: 'Grade 10-A', academicSessionId: 'session-1', classTeacherId: 't-1', createdAt: new Date().toISOString() },
  { id: 'c-11b', schoolId: 'school-1', name: 'Grade 11-B', academicSessionId: 'session-1', classTeacherId: 't-2', createdAt: new Date().toISOString() }
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
  { id: 'st-1', userId: 'u-student1', schoolId: 'school-1', classId: 'c-10a', academicSessionId: 'session-1', admissionNumber: 'ADM2025001', rollNumber: 10, dateOfBirth: '2010-04-12', gender: 'MALE', createdAt: new Date().toISOString() },
  { id: 'st-2', userId: 'u-student2', schoolId: 'school-1', classId: 'c-10a', academicSessionId: 'session-1', admissionNumber: 'ADM2025002', rollNumber: 11, dateOfBirth: '2010-06-25', gender: 'MALE', createdAt: new Date().toISOString() },
  { id: 'st-3', userId: 'u-student3', schoolId: 'school-1', classId: 'c-11b', academicSessionId: 'session-1', admissionNumber: 'ADM2025003', rollNumber: 1, dateOfBirth: '2009-11-07', gender: 'FEMALE', createdAt: new Date().toISOString() }
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

const SEED_EXAMS: Exam[] = [
  { id: 'ex-1', schoolId: 'school-1', academicSessionId: 'session-1', name: 'Midterm Assessments 2026', startDate: '2026-03-10', endDate: '2026-03-20' }
];

const SEED_EXAM_SCHEDULES: ExamSchedule[] = [
  { id: 'es-1', examId: 'ex-1', classId: 'c-10a', subjectId: 's-math', examDate: '2026-03-11', startTime: '09:00', endTime: '12:00', classroom: 'Main Exam Hall', maxMarks: 100 },
  { id: 'es-2', examId: 'ex-1', classId: 'c-10a', subjectId: 's-phys', examDate: '2026-03-13', startTime: '09:00', endTime: '12:00', classroom: 'Lab B', maxMarks: 100 },
  { id: 'es-3', examId: 'ex-1', classId: 'c-10a', subjectId: 's-comp', examDate: '2026-03-15', startTime: '13:00', endTime: '16:00', classroom: 'Main Exam Hall', maxMarks: 100 }
];

const SEED_EXAM_MARKS: ExamMark[] = [
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
  { id: 'sm-1', subjectId: 's-math', teacherId: 't-1', title: 'Infinite Series Convergence Theorems Cheatsheet', description: 'Comprehensive formulas for Ratio, Root, and Integral convergence tests with solved examples.', fileUrl: 'convergence_cheatsheet.pdf', fileType: 'pdf', isVideoStreamable: false, createdAt: new Date('2026-05-18').toISOString() },
  { id: 'sm-2', subjectId: 's-phys', teacherId: 't-1', title: 'Video Lecture: Spacetime Geodesics Intro', description: 'An introductory overview of how light and matter curve along spacetime geodesics.', fileUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', fileType: 'mp4', isVideoStreamable: true, createdAt: new Date('2026-05-20').toISOString() },
  { id: 'sm-3', subjectId: 's-comp', teacherId: 't-2', title: 'TypeScript Advanced Types and Mapped Types Handbook', description: 'Deep-dive manual explaining Generics, Index signatures, Mapped Types, and Utility operations.', fileUrl: 'ts_generics_handbook.pdf', fileType: 'pdf', isVideoStreamable: false, createdAt: new Date('2026-05-23').toISOString() }
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

// --- MOCK DATABASE CLASS ---

class MockDatabase {
  users: User[];
  schools: School[];
  academicSessions: typeof SEED_ACADEMIC_SESSIONS;
  classes: Class[];
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

  constructor() {
    this.users = getStorage<User[]>('users', SEED_USERS);
    this.schools = getStorage<School[]>('schools', [SEED_SCHOOL]);
    this.academicSessions = getStorage<typeof SEED_ACADEMIC_SESSIONS>('academic_sessions', SEED_ACADEMIC_SESSIONS);
    this.classes = getStorage<Class[]>('classes', SEED_CLASSES);

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
    this.chatMessages = getStorage<ChatMessage[]>('chat_messages', SEED_CHAT_MESSAGES);
    this.auditLogs = getStorage<AuditLog[]>('audit_logs', SEED_AUDIT_LOGS);
  }

  saveAll() {
    setStorage('users', this.users);
    setStorage('schools', this.schools);
    setStorage('classes', this.classes);
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

  addNotification(userId: string, title: string, message: string) {
    const notify: Notification = {
      id: 'n-' + Math.random().toString(36).substr(2, 9),
      userId,
      title,
      message,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    this.notifications.unshift(notify);
    this.saveAll();
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
