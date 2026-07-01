import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { supabase } from '../lib/supabase';
import { 
  TeacherClassSubjectMapping, Student, AssignmentSubmission, 
  Class, Subject, Assignment, User, Timetable, Exam, StudyMaterial, Quiz, Section, HomeworkAttachment, FacultyPaymentSettings, PayrollRecord, EmployeeSalaryLedger
} from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Clipboard, UserCheck, Edit3, Award, PlusCircle, PenTool,
  UploadCloud, FileText, CheckCircle, AlertCircle, Save, Calendar, Clock, MapPin, Layers, Users,
  Trash2, Eye, X, Video, File, MessageSquare, MessageCircle, BookOpen, Paperclip, Loader2, AlertTriangle, TrendingUp,
  QrCode, Banknote, ScanLine, ShieldCheck, ToggleLeft, ToggleRight, Download, Edit, Shield, Info, EyeOff
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans, isTabLocked, isTabLockedByEntitlements } from '../services/subscriptionConfig';
import { useFeatureEntitlements } from '../hooks/useFeatureEntitlements';
import { downloadMarksheetPdf } from '../components/MarksheetTemplate';
import { ClassDiscussion } from '../components/ClassDiscussion';
import { TeacherPTMManagement } from '../components/PTMManagement';

export const TeacherPortal: React.FC<{ activeTab: string; setActiveTab?: (tab: string) => void }> = ({ activeTab, setActiveTab }) => {
  const { session, syncSubscriptionPlan } = useStore();
  const teacherId = session?.teacherId;
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;
  const ent = useFeatureEntitlements();

  // Mappings
  const [classMappings, setClassMappings] = useState<(TeacherClassSubjectMapping & { className: string; subjectName: string; classId: string; subjectCode: string })[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<string>('');
  
  // Dynamic datasets based on selection
  const [students, setStudents] = useState<(Student & { userDetails: User; attendanceState?: string })[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});
  const [attendanceRemarks, setAttendanceRemarks] = useState<Record<string, string>>({});
  const [submissions, setSubmissions] = useState<(AssignmentSubmission & { studentName: string; assignmentTitle: string; maxMarks: number })[]>([]);

  // Action States
  const [gradingSubmission, setGradingSubmission] = useState<(AssignmentSubmission & { studentName: string; assignmentTitle: string; maxMarks: number }) | null>(null);
  const [gradesScore, setGradesScore] = useState<number>(0);
  const [gradesFeedback, setGradesFeedback] = useState<string>('');

  // Form states
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');
  const [assignIsHomework, setAssignIsHomework] = useState(false);
  const [assignSectionId, setAssignSectionId] = useState('');
  const [editAssignSectionId, setEditAssignSectionId] = useState('');
  const [availableSections, setAvailableSections] = useState<Section[]>([]);
  const [createdHomeworkId, setCreatedHomeworkId] = useState(() => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
  const [attachmentsList, setAttachmentsList] = useState<HomeworkAttachment[]>([]);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentProgress, setAttachmentProgress] = useState(0);
  const [attachmentError, setAttachmentError] = useState('');


  const [quizTitle, setQuizTitle] = useState('');
  const [quizDuration, setQuizDuration] = useState(15);
  const [quizQuestions, setQuizQuestions] = useState<{ question: string; options: string[]; correctOption: number; marks: number }[]>([]);
  
  // Single question input
  const [qText, setQText] = useState('');
  const [qOpt1, setQOpt1] = useState('');
  const [qOpt2, setQOpt2] = useState('');
  const [qOpt3, setQOpt3] = useState('');
  const [qOpt4, setQOpt4] = useState('');
  const [qCorrect, setQCorrect] = useState(0);
  const [qMarks, setQMarks] = useState(2);

  // Materials uploader
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [materialUrl, setMaterialUrl] = useState('');
  const [materialType, setMaterialType] = useState<'pdf' | 'docx' | 'mp4' | 'stream'>('pdf');
  const [materialStreamable, setMaterialStreamable] = useState(false);
  const [materialFile, setMaterialFile] = useState<File | null>(null);
  const [materialUploading, setMaterialUploading] = useState(false);

  // Managed class timetables (Class Teacher Hub)
  const [managedClasses, setManagedClasses] = useState<Class[]>([]);
  const [selectedManagedClass, setSelectedManagedClass] = useState<string>('');
  
  // Attendance gating and detailed visibility states
  const [teacherAttendanceDate, setTeacherAttendanceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [teacherAttendanceSubTab, setTeacherAttendanceSubTab] = useState<'mark' | 'analytics'>('mark');
  const [teacherAttendanceStudents, setTeacherAttendanceStudents] = useState<(Student & { userDetails: User; attendanceState?: string })[]>([]);
  const [teacherAttendanceAnalytics, setTeacherAttendanceAnalytics] = useState<any[]>([]);
  const [teacherAttendanceLoading, setTeacherAttendanceLoading] = useState<boolean>(false);
  const [selectedTardyStudent, setSelectedTardyStudent] = useState<any | null>(null);

  const [newAssignedTeacher, setNewAssignedTeacher] = useState('');
  const [newAssignedSubject, setNewAssignedSubject] = useState('');
  const [newAssignedDay, setNewAssignedDay] = useState(1);
  const [newAssignedStart, setNewAssignedStart] = useState('09:00');
  const [newAssignedEnd, setNewAssignedEnd] = useState('10:30');
  const [newAssignedClassroom, setNewAssignedClassroom] = useState('Room 101');

  // Timetable Edit Workflow states
  const [isEditingManagedTt, setIsEditingManagedTt] = useState(false);
  const [editingManagedTtId, setEditingManagedTtId] = useState('');
  const [editManagedSubject, setEditManagedSubject] = useState('');
  const [editManagedTeacher, setEditManagedTeacher] = useState('');
  const [editManagedDay, setEditManagedDay] = useState(1);
  const [editManagedClassroom, setEditManagedClassroom] = useState('');
  const [editManagedStart, setEditManagedStart] = useState('09:00');
  const [editManagedEnd, setEditManagedEnd] = useState('10:30');

  // Self-assigned timetable states
  const [selfAssignClass, setSelfAssignClass] = useState('');
  const [selfAssignSubject, setSelfAssignSubject] = useState('');
  const [selfAssignDay, setSelfAssignDay] = useState(1);
  const [selfAssignStart, setSelfAssignStart] = useState('09:00');
  const [selfAssignEnd, setSelfAssignEnd] = useState('10:30');
  const [selfAssignClassroom, setSelfAssignClassroom] = useState('Room 101');

  // Class Teacher Student & Parent management states
  const [showCTAddStudent, setShowCTAddStudent] = useState(false);
  const [ctStEmail, setCtStEmail] = useState('');
  const [ctStFirst, setCtStFirst] = useState('');
  const [ctStLast, setCtStLast] = useState('');
  const [ctStAdmission, setCtStAdmission] = useState('');
  const [ctStRoll, setCtStRoll] = useState(1);
  const [ctStGender, setCtStGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [ctStDob, setCtStDob] = useState('2010-01-01');
  const [ctStPassword, setCtStPassword] = useState('password');
  const [ctStPhone, setCtStPhone] = useState('');

  const [showCTAddParent, setShowCTAddParent] = useState(false);
  const [ctPrEmail, setCtPrEmail] = useState('');
  const [ctPrFirst, setCtPrFirst] = useState('');
  const [ctPrLast, setCtPrLast] = useState('');
  const [ctPrOccup, setCtPrOccup] = useState('');
  const [ctPrAddr, setCtPrAddr] = useState('');
  const [ctPrPhone, setCtPrPhone] = useState('');
  const [ctPrEmergencyPhone, setCtPrEmergencyPhone] = useState('');
  const [ctPrStudentId, setCtPrStudentId] = useState('');
  const [ctPrAdmissionNum, setCtPrAdmissionNum] = useState('');
  const [ctPrRelation, setCtPrRelation] = useState('Father');
  const [ctPrPassword, setCtPrPassword] = useState('password');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Assignments & Materials listing
  const [assignmentsList, setAssignmentsList] = useState<(Assignment & { className: string; subjectName: string })[]>([]);
  const [materialsList, setMaterialsList] = useState<(StudyMaterial & { subjectName: string })[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [quizzesList, setQuizzesList] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  // ── Teacher Signature States ───────────────────────
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [teacherSignatureUrl, setTeacherSignatureUrl] = useState<string>('');

  // Edit Assignment modal
  const [editingAssignment, setEditingAssignment] = useState<(Assignment & { className: string; subjectName: string }) | null>(null);
  const [editAssignTitle, setEditAssignTitle] = useState('');
  const [editAssignDesc, setEditAssignDesc] = useState('');
  const [editAssignDueDate, setEditAssignDueDate] = useState('');
  const [editAssignIsHomework, setEditAssignIsHomework] = useState(false);

  // Edit Material modal
  const [editingMaterial, setEditingMaterial] = useState<(StudyMaterial & { subjectName: string }) | null>(null);
  const [editMatTitle, setEditMatTitle] = useState('');
  const [editMatDesc, setEditMatDesc] = useState('');
  const [editMatUrl, setEditMatUrl] = useState('');
  const [editMatType, setEditMatType] = useState<'pdf' | 'docx' | 'mp4' | 'stream'>('pdf');
  const [editMatStreamable, setEditMatStreamable] = useState(false);

  // Edit Quiz modal
  const [editingQuiz, setEditingQuiz] = useState<any | null>(null);
  const [selectedQuizForAttempts, setSelectedQuizForAttempts] = useState<any | null>(null);
  const [editQuizTitle, setEditQuizTitle] = useState('');
  const [editQuizDuration, setEditQuizDuration] = useState(15);

  // Homeroom Marksheets
  const [hmExams, setHmExams] = useState<Exam[]>([]);
  const [hmSelectedExam, setHmSelectedExam] = useState('');
  const [hmSelectedStudent, setHmSelectedStudent] = useState('');
  const [hmReportCard, setHmReportCard] = useState<{ scheduleId: string; subjectId: string; subjectName: string; maxMarks: number; marksObtained?: number; remarks?: string }[]>([]);
  const [selectedRcStudent, setSelectedRcStudent] = useState('');
  const [selectedRcExam, setSelectedRcExam] = useState('');
  const [rcLoading, setRcLoading] = useState(false);
  const [rcError, setRcError] = useState('');
  const [rcData, setRcData] = useState<any>(null);

  // Forum/Discussion states
  const [forumCategories, setForumCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any | null>(null);
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [postReplies, setPostReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  
  // Category CRUD states
  const [showCreateCategory, setShowCreateCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catClassId, setCatClassId] = useState('');
  const [catSubjectId, setCatSubjectId] = useState('');

  // Post states
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');

  // ── Class Analytics states ──
  const [analyticsDateRange, setAnalyticsDateRange] = useState(() => localStorage.getItem('aegis_teacher_analytics_range') || '30d');
  const [analyticsClass, setAnalyticsClass] = useState(() => localStorage.getItem('aegis_teacher_analytics_class') || 'all');
  const [showReportCardPdf, setShowReportCardPdf] = useState<any | null>(null);

  // ── Payment Settings tab state ──
  const [fpSettings, setFpSettings] = useState<FacultyPaymentSettings | null>(null);
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSaving, setFpSaving] = useState(false);
  const [fpMsg, setFpMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fpShowEdit, setFpShowEdit] = useState(false);
  const [fpQrFile, setFpQrFile] = useState<File | null>(null);
  const [fpQrPreview, setFpQrPreview] = useState<string | null>(null);
  const [fpUpiId, setFpUpiId] = useState('');
  const [fpBankName, setFpBankName] = useState('');
  const [fpAccNumber, setFpAccNumber] = useState('');
  const [fpIfsc, setFpIfsc] = useState('');
  const [fpBranch, setFpBranch] = useState('');
  const [fpShowAccNumber, setFpShowAccNumber] = useState(false);
  // Salary history
  const [mySalaryLedger, setMySalaryLedger] = useState<EmployeeSalaryLedger[]>([]);

  // Helper to filter items by selected analyticsDateRange
  const filterByDateRange = (dateStr: string) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    if (analyticsDateRange === '30d') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return date >= thirtyDaysAgo;
    }
    if (analyticsDateRange === '90d') {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(now.getDate() - 90);
      return date >= ninetyDaysAgo;
    }
    if (analyticsDateRange === 'session') {
      const schoolId = session?.user.schoolId || '';
      const activeSession = mockDb.academicSessions.find(s => s.schoolId === schoolId && s.isCurrent);
      if (activeSession) {
        return date >= new Date(activeSession.startDate) && date <= new Date(activeSession.endDate);
      }
    }
    return true;
  };

  // Get dynamic attendance stats from DB records
  const getAttendanceStats = () => {
    if (!selectedMapping) return null;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return null;
    const schoolId = session?.user.schoolId || '';
    const academicSessionId = session?.user.academicSessionId || '';

    // Enforce multi-tenant school check
    const classStudents = mockDb.students.filter(s => 
      s.schoolId === schoolId && 
      s.classId === mapping.classId
    );
    const studentIds = classStudents.map(s => s.id);
    if (studentIds.length === 0) return null;

    const records = mockDb.attendance.filter(a => 
      studentIds.includes(a.studentId) &&
      a.classId === mapping.classId &&
      a.academicSessionId === academicSessionId &&
      filterByDateRange(a.date)
    );

    if (records.length === 0) return null;

    // Group by day of week or actual dates
    // To show daily trends for the last 4 dates with marked attendance:
    const dateMap = new Map<string, { present: number; absent: number; total: number }>();
    records.forEach(r => {
      if (!dateMap.has(r.date)) {
        dateMap.set(r.date, { present: 0, absent: 0, total: 0 });
      }
      const val = dateMap.get(r.date)!;
      if (r.status === 'PRESENT' || r.status === 'LATE') {
        val.present++;
      } else if (r.status === 'ABSENT') {
        val.absent++;
      }
      val.total++;
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    const lastDates = sortedDates.slice(-4); // last 4 active dates
    const trends = lastDates.map(d => {
      const val = dateMap.get(d)!;
      const pct = val.total > 0 ? (val.present / val.total) * 100 : 100;
      const dayName = new Date(d).toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
      return {
        date: d,
        dayName,
        percentage: pct,
        present: val.present,
        absent: val.absent
      };
    });

    const totalPresent = records.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    const overallPct = (totalPresent / records.length) * 100;

    return {
      overallPct,
      trends
    };
  };

  // Get dynamic homework stats from DB records
  const getHomeworkStats = () => {
    if (!selectedMapping) return null;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return null;
    const schoolId = session?.user.schoolId || '';
    const academicSessionId = session?.user.academicSessionId || '';

    const classAssignments = mockDb.assignments.filter(a => 
      a.schoolId === schoolId &&
      a.classId === mapping.classId &&
      a.subjectId === mapping.subjectId &&
      a.academicSessionId === academicSessionId &&
      filterByDateRange(a.createdAt || a.dueDate)
    );

    if (classAssignments.length === 0) return null;

    const classStudents = mockDb.students.filter(s => 
      s.schoolId === schoolId && 
      s.classId === mapping.classId
    );
    const studentIds = classStudents.map(s => s.id);
    const totalStudents = studentIds.length;
    if (totalStudents === 0) return null;

    const stats = classAssignments.map(a => {
      const subs = mockDb.assignmentSubmissions.filter(sub => 
        sub.assignmentId === a.id && 
        studentIds.includes(sub.studentId)
      );
      const submittedCount = subs.length;
      const pct = (submittedCount / totalStudents) * 100;
      return {
        id: a.id,
        title: a.title,
        percentage: pct
      };
    });

    return {
      totalAssignments: classAssignments.length,
      stats
    };
  };

  // Get dynamic quiz stats from DB records
  const getQuizStats = () => {
    if (!selectedMapping) return null;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return null;
    const schoolId = session?.user.schoolId || '';
    const academicSessionId = session?.user.academicSessionId || '';

    const classQuizzes = mockDb.quizzes.filter(q => 
      q.schoolId === schoolId &&
      q.classId === mapping.classId &&
      q.subjectId === mapping.subjectId &&
      q.academicSessionId === academicSessionId &&
      filterByDateRange(q.createdAt)
    );

    if (classQuizzes.length === 0) return null;

    const classStudents = mockDb.students.filter(s => 
      s.schoolId === schoolId && 
      s.classId === mapping.classId
    );
    const studentIds = classStudents.map(s => s.id);
    const totalStudents = studentIds.length;
    if (totalStudents === 0) return null;

    const stats = classQuizzes.map(q => {
      const attempts = mockDb.quizAttempts.filter(att => 
        att.quizId === q.id && 
        studentIds.includes(att.studentId)
      );
      const attemptsCount = attempts.length;
      const scores = attempts.map(a => a.score);
      const avgScore = attemptsCount > 0 ? scores.reduce((sum, s) => sum + s, 0) / attemptsCount : 0;
      const pct = (avgScore / q.totalMarks) * 100;
      return {
        id: q.id,
        title: q.title,
        percentage: pct,
        avgScore,
        totalMarks: q.totalMarks
      };
    });

    const overallAvgScore = stats.length > 0 ? stats.reduce((sum, q) => sum + q.avgScore, 0) / stats.length : 0;
    const overallTotalMarks = stats.length > 0 ? stats.reduce((sum, q) => sum + q.totalMarks, 0) / stats.length : 10;

    return {
      overallAvgScore,
      overallTotalMarks,
      stats
    };
  };

  const exportClassRosterToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Admission Number,Roll Number,First Name,Last Name,Email,Gender,Class\n";
    
    students.forEach(st => {
      const row = [
        st.admissionNumber,
        st.rollNumber,
        st.userDetails.firstName,
        st.userDetails.lastName,
        st.userDetails.email,
        st.gender,
        selectedMapping ? (() => { 
          const m = mockDb.teacherClassSubjectMappings.find(x => x.id === selectedMapping); 
          return m ? mockDb.classes.find(c => c.id === m.classId)?.name || 'N/A' : 'N/A'; 
        })() : 'N/A'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aegis_teacher_class_roster_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportClassGradesToCSV = () => {
    if (!selectedMapping) return;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return;

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student Name,Roll Number,Exam Name,Subject,Max Marks,Marks Obtained,Remarks\n";

    const classStudents = mockDb.students.filter(s => s.classId === mapping.classId);
    const subject = mockDb.subjects.find(sub => sub.id === mapping.subjectId);
    const subjectName = subject ? subject.name : 'Unknown Subject';

    classStudents.forEach(st => {
      const user = mockDb.users.find(u => u.id === st.userId);
      const studentName = user ? `${user.firstName} ${user.lastName}` : 'Unknown Student';
      
      // Get all marks for this student and subject
      const marks = mockDb.studentMarks.filter(m => m.studentId === st.id && m.subjectId === mapping.subjectId);
      
      marks.forEach(m => {
        const exam = mockDb.exams.find(e => e.id === m.examId);
        const examName = exam ? exam.name : 'N/A';
        // Get max marks from exam_subjects or default to 100
        const examSub = mockDb.examSubjects.find(es => es.examId === m.examId && es.subjectId === mapping.subjectId);
        const maxMarks = examSub ? examSub.maxMarks : 100;

        const row = [
          studentName,
          st.rollNumber,
          examName,
          subjectName,
          maxMarks,
          m.marksObtained,
          m.remarks || ''
        ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
        csvContent += row + "\n";
      });
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aegis_teacher_grades_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const loadForumsData = async () => {
    if (!session?.user.schoolId) return;
    try {
      await mockApi.syncForumCategoriesData(session.user.schoolId);
      await mockApi.syncForumPostsData(session.user.schoolId);
      await mockApi.syncForumRepliesData(session.user.schoolId);

      const cats = mockDb.forumCategories.filter(c => c.schoolId === session.user.schoolId);
      // Deduplicate forum categories by id
      setForumCategories(Array.from(new Map(cats.map(c => [c.id, c])).values()));

      const posts = await mockApi.getForumPosts();
      const filteredPosts = posts.filter(p => p.schoolId === session.user.schoolId);
      // Deduplicate forum posts by id
      setForumPosts(Array.from(new Map(filteredPosts.map(p => [p.id, p])).values()));
    } catch (err) {
      console.error('Failed to load forums:', err);
    }
  };

  const handleSelectPost = async (post: any) => {
    setSelectedPost(post);
    try {
      const reps = await mockApi.getForumPostReplies(post.id);
      setPostReplies(reps);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForumReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedPost || !replyText.trim()) return;

    try {
      await mockApi.replyToForumPost(session.user.id, selectedPost.id, replyText);
      setReplyText('');
      const reps = await mockApi.getForumPostReplies(selectedPost.id);
      setPostReplies(reps);
      loadForumsData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedCategory || !newPostTitle.trim() || !newPostContent.trim()) return;

    try {
      await mockApi.createForumPost(session.user.id, newPostTitle, newPostContent, selectedCategory.id);
      setNewPostTitle('');
      setNewPostContent('');
      loadForumsData();
      alert('Discussion thread published!');
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !catName.trim() || !catDesc.trim()) return;

    try {
      if (editingCategory) {
        await mockApi.updateForumCategory(
          editingCategory.id,
          catName,
          catDesc,
          catClassId || null,
          catSubjectId || null
        );
        alert('Discussion Board updated successfully!');
      } else {
        await mockApi.createForumCategory(
          session.user.schoolId,
          catName,
          catDesc,
          catClassId || null,
          catSubjectId || null
        );
        alert('Discussion Board created successfully!');
      }
      setShowCreateCategory(false);
      setEditingCategory(null);
      setCatName('');
      setCatDesc('');
      setCatClassId('');
      setCatSubjectId('');
      loadForumsData();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Operation failed');
    }
  };

  const handleEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatDesc(cat.description);
    setCatClassId(cat.classId || '');
    setCatSubjectId(cat.subjectId || '');
    setShowCreateCategory(true);
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this Discussion Board? All threads and replies will be permanently deleted!')) return;
    try {
      await mockApi.deleteForumCategory(id);
      if (selectedCategory?.id === id) {
        setSelectedCategory(null);
        setSelectedPost(null);
      }
      loadForumsData();
      alert('Discussion Board deleted!');
    } catch (err) {
      console.error(err);
    }
  };

  const loadManagedClasses = async () => {
    if (!teacherId) return;
    try {
      const data = await mockApi.classTeacherGetManagedClasses(teacherId);
      setManagedClasses(data);
      if (data.length > 0) {
        setSelectedManagedClass(prev => {
          if (prev && data.some(c => c.id === prev)) {
            return prev;
          }
          return data[0].id;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadMappings = async () => {
    if (!teacherId) return;
    try {
      const data = await mockApi.teacherGetClassSubjectMappings(teacherId);
      setClassMappings(data);
      if (data.length > 0) {
        setSelectedMapping(prev => {
          if (prev && data.some(m => m.id === prev)) {
            return prev;
          }
          return data[0].id;
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSelectionDetails = async () => {
    if (!teacherId || !selectedMapping) return;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return;

    try {
      // Load Class Students
      const stData = await mockApi.teacherGetClassStudentsReadOnly(teacherId, mapping.classId);
      setStudents(stData);
      
      const initialAttendance: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
      const initialRemarks: Record<string, string> = {};
      stData.forEach(s => {
        initialAttendance[s.id] = ((s as any).attendanceState as any) || 'PRESENT';
        initialRemarks[s.id] = '';
      });
      setAttendanceRecords(initialAttendance);
      setAttendanceRemarks(initialRemarks);

      // Load Submissions
      const subData = await mockApi.teacherGetSubmissions(teacherId, mapping.classId);
      setSubmissions(subData);

      // Load Class Sections dynamically
      const schoolId = mockDb.teachers.find(t => t.id === teacherId)?.schoolId || 'school-1';
      await mockApi.syncSectionsData(schoolId);
      const filteredSections = mockDb.sections.filter(sec => sec.classId === mapping.classId);
      setAvailableSections(filteredSections);
      if (filteredSections.length > 0) {
        setAssignSectionId(filteredSections[0].id);
      } else {
        setAssignSectionId('');
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const runCoreSyncs = async () => {
      const schoolId = session?.user.schoolId;
      if (schoolId) {
        try {
          await Promise.all([
            mockApi.syncSchoolsData(schoolId),
            mockApi.syncClassesData(schoolId),
            mockApi.syncTeachersData(schoolId),
            mockApi.syncSubjectsData(schoolId),
            mockApi.syncTeacherClassSubjectMappingsData(schoolId),
            mockApi.syncAcademicSessionsData(schoolId),
            mockApi.syncStudentsData(schoolId),
            mockApi.syncTimetablesData(schoolId).catch(console.error),
            mockApi.syncQuizzesData(schoolId).catch(console.error)
          ]);
          
          mockApi.classTeacherGetExams(schoolId).then(setHmExams);

          if (teacherId) {
            const { data: tcRow } = await supabase
              .from('teachers')
              .select('signature_url')
              .eq('id', teacherId)
              .maybeSingle();
            if (tcRow?.signature_url) {
              setTeacherSignatureUrl(tcRow.signature_url);
            } else {
              setTeacherSignatureUrl('');
            }
          }
        } catch (e) {
          console.error('Core sync failed in teacher portal:', e);
        }
      }
      await syncSubscriptionPlan();
      await loadMappings();
      await loadManagedClasses();
    };
    runCoreSyncs();
  }, [teacherId, session, refreshTrigger]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncSubscriptionPlan();
    }, 10000);
    return () => clearInterval(interval);
  }, [syncSubscriptionPlan]);

  useEffect(() => {
    const fetchRcData = async () => {
      if (!showReportCardPdf || !selectedRcStudent || !selectedRcExam) {
        setRcData(null);
        return;
      }
      setRcLoading(true);
      setRcError('');
      try {
        const data = await mockApi.getStudentMarksheetData(selectedRcStudent, selectedRcExam);
        setRcData(data);
      } catch (err: any) {
        console.error(err);
        setRcError(err.message || 'Failed to fetch report card data.');
        setRcData(null);
      } finally {
        setRcLoading(false);
      }
    };
    fetchRcData();
  }, [showReportCardPdf, selectedRcStudent, selectedRcExam]);

  useEffect(() => {
    if (selectedMapping) {
      loadSelectionDetails();
    }
  }, [selectedMapping, activeTab, refreshTrigger]);

  useEffect(() => {
    if (activeTab === 'paymentsettings' && session?.user.id) {
      const loadPaymentSettings = async () => {
        setFpLoading(true);
        try {
          const userId = session.user.id;
          const s = await mockApi.fetchFacultyPaymentSettings(userId, userId, session.user.role || 'TEACHER');
          setFpSettings(s);
          if (s) {
            setFpUpiId(s.upiId || '');
            setFpBankName(s.bankName || '');
            setFpAccNumber(s.accountNumber || '');
            setFpIfsc(s.ifscCode || '');
            setFpBranch(s.branchName || '');
            if (s.qrCodeUrl) setFpQrPreview(s.qrCodeUrl);
          } else {
            setFpUpiId('');
            setFpBankName('');
            setFpAccNumber('');
            setFpIfsc('');
            setFpBranch('');
            setFpQrPreview(null);
          }
          const schoolId = session.user.schoolId || '';
          if (schoolId) {
            const ledger = await mockApi.getSalaryLedger(schoolId, userId);
            setMySalaryLedger(ledger);
          }
        } catch (err) {
          console.error('Failed to load payment settings:', err);
        } finally {
          setFpLoading(false);
        }
      };
      loadPaymentSettings();
    }
  }, [activeTab, session, refreshTrigger]);

  useEffect(() => {
    if (teacherId && selectedManagedClass && hmSelectedStudent && hmSelectedExam) {
      mockApi.classTeacherGetStudentReportCard(
        teacherId,
        selectedManagedClass,
        hmSelectedStudent,
        hmSelectedExam
      ).then(setHmReportCard).catch(console.error);
    } else {
      setHmReportCard([]);
    }
  }, [teacherId, selectedManagedClass, hmSelectedStudent, hmSelectedExam, refreshTrigger]);

  const loadTeacherAttendanceDetails = async () => {
    if (!teacherId || !selectedManagedClass) return;
    setTeacherAttendanceLoading(true);
    try {
      if (teacherAttendanceSubTab === 'mark') {
        const data = await mockApi.teacherGetClassStudents(teacherId, selectedManagedClass, teacherAttendanceDate);
        setTeacherAttendanceStudents(data);
        
        // Populate current mark register states
        const initialAttendance: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
        const initialRemarks: Record<string, string> = {};
        data.forEach(s => {
          initialAttendance[s.id] = (s.attendanceState as any) || 'PRESENT';
          initialRemarks[s.id] = '';
        });
        setAttendanceRecords(prev => ({ ...prev, ...initialAttendance }));
        setAttendanceRemarks(prev => ({ ...prev, ...initialRemarks }));
      } else {
        const analytics = await mockApi.teacherGetClassAttendanceAnalytics(teacherId, selectedManagedClass);
        setTeacherAttendanceAnalytics(analytics);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setTeacherAttendanceLoading(false);
    }
  };

  const handleTeacherSaveAttendance = async () => {
    if (!teacherId || !selectedManagedClass) return;
    
    const records = teacherAttendanceStudents.map(s => ({
      studentId: s.id,
      status: attendanceRecords[s.id] || 'PRESENT',
      remarks: attendanceRemarks[s.id] || ''
    }));

    try {
      await mockApi.teacherMarkAttendance(teacherId, selectedManagedClass, teacherAttendanceDate, records);
      alert('Attendance register updated successfully!');
      loadTeacherAttendanceDetails();
    } catch (err: any) {
      alert(err.message || 'Error marking attendance');
    }
  };

  useEffect(() => {
    if (activeTab === 'attendance' && selectedManagedClass) {
      loadTeacherAttendanceDetails();
    }
  }, [activeTab, selectedManagedClass, teacherAttendanceDate, teacherAttendanceSubTab, refreshTrigger]);

  const loadAssignmentsList = async () => {
    if (!teacherId) return;
    setAssignmentsLoading(true);
    try {
      const data = await mockApi.teacherGetAssignments(teacherId);
      // Deduplicate assignments by id
      setAssignmentsList(Array.from(new Map(data.map(a => [a.id, a])).values()));
    } catch (err) {
      console.error(err);
    } finally {
      setAssignmentsLoading(false);
    }
  };

  const loadMaterialsList = async () => {
    if (!teacherId) return;
    setMaterialsLoading(true);
    try {
      const data = await mockApi.teacherGetStudyMaterials(teacherId);
      // Deduplicate study materials by id
      setMaterialsList(Array.from(new Map(data.map(m => [m.id, m])).values()));
    } catch (err) {
      console.error(err);
    } finally {
      setMaterialsLoading(false);
    }
  };

  const loadQuizzesList = async () => {
    if (!teacherId) return;
    setQuizzesLoading(true);
    try {
      const data = await mockApi.teacherGetQuizzes(teacherId);
      // Deduplicate quizzes by id
      setQuizzesList(Array.from(new Map(data.map(q => [q.id, q])).values()));
    } catch (err) {
      console.error(err);
    } finally {
      setQuizzesLoading(false);
    }
  };

  // Real-time Supabase Postgres changes subscription
  useEffect(() => {
    if (activeTab !== 'forums') return;

    const handleForumsSync = () => {
      loadForumsData();
    };

    const channel = supabase
      .channel('teacher-forums-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_categories' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_replies' }, handleForumsSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, selectedCategory, selectedPost]);

  // Real-time Supabase Postgres changes subscription for academic and class data
  useEffect(() => {
    if (!teacherId) return;

    const handleAcademicSync = () => {
      console.log('Realtime academic update detected, refreshing teacher portal lists...');
      setRefreshTrigger(prev => prev + 1);
    };

    const channel = supabase
      .channel('teacher-academic-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teachers' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homeworks' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_attachments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_submissions' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetables' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_materials' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_marks' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_schedules' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_results' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cards' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_points' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_assignments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_attendance' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salary_payments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_salary_ledger' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_subscriptions' }, () => {
        console.log('Realtime school_subscriptions change detected in teacher portal, refreshing plan...');
        syncSubscriptionPlan();
        handleAcademicSync();
      })
      .subscribe();

    // Subscribe to manual broadcast channel for instant, guaranteed real-time updates!
    const broadcastChannel = supabase
      .channel(`school-subscription-updates-${session?.user.schoolId}`)
      .on('broadcast', { event: 'plan_updated' }, () => {
        console.log('Realtime broadcast subscription update detected in TeacherPortal! Syncing plan and refreshing classes...');
        syncSubscriptionPlan();
        handleAcademicSync();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [teacherId, session, syncSubscriptionPlan]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeTab === 'assignments') {
      loadAssignmentsList();
    } else if (activeTab === 'materials') {
      loadMaterialsList();
    } else if (activeTab === 'quizzes') {
      loadQuizzesList();
    } else if (activeTab === 'forums') {
      loadForumsData();
      
      interval = setInterval(() => {
        loadForumsData();
      }, 5000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTab, teacherId, refreshTrigger]);

  useEffect(() => {
    if (analyticsDateRange) {
      localStorage.setItem('aegis_teacher_analytics_range', analyticsDateRange);
    }
  }, [analyticsDateRange]);

  useEffect(() => {
    if (analyticsClass) {
      localStorage.setItem('aegis_teacher_analytics_class', analyticsClass);
    }
  }, [analyticsClass]);

  useEffect(() => {
    if (analyticsClass !== 'all' && managedClasses.length > 0) {
      const exists = managedClasses.some(c => c.id === analyticsClass);
      if (!exists) {
        setAnalyticsClass('all');
      }
    }
  }, [managedClasses, analyticsClass]);

  const handleDeleteAssignment = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await mockApi.teacherDeleteAssignment(id);
      alert('Assignment deleted.');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error deleting assignment');
    }
  };

  const handleEditAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAssignment || !selectedMapping) return;
    const mapping = classMappings.find(m => m.id === selectedMapping)!;
    try {
      await mockApi.teacherEditAssignment(
        editingAssignment.id,
        mapping.classId,
        mapping.subjectId,
        editAssignTitle,
        editAssignDesc,
        new Date(editAssignDueDate).toISOString(),
        editAssignIsHomework,
        editAssignSectionId || null
      );
      alert('Assignment updated successfully!');
      setEditingAssignment(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error updating assignment');
    }
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this study material?')) return;
    try {
      await mockApi.teacherDeleteStudyMaterial(id);
      alert('Study material deleted.');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error deleting material');
    }
  };

  const handleEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMaterial || !selectedMapping) return;
    const mapping = classMappings.find(m => m.id === selectedMapping)!;
    try {
      await mockApi.teacherEditStudyMaterial(
        editingMaterial.id,
        mapping.subjectId,
        mapping.classId,
        editMatTitle,
        editMatDesc,
        editMatUrl,
        editMatType,
        editMatStreamable
      );
      alert('Study material updated successfully!');
      setEditingMaterial(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error updating material');
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await mockApi.teacherDeleteQuiz(id);
      alert('Quiz deleted.');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error deleting quiz');
    }
  };

  const handleEditQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingQuiz) return;
    try {
      await mockApi.teacherEditQuiz(
        editingQuiz.id,
        editQuizTitle,
        editQuizDuration
      );
      alert('Quiz updated successfully!');
      setEditingQuiz(null);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error updating quiz');
    }
  };

  const handleCreateManagedTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedManagedClass || !newAssignedSubject) return;

    try {
      await mockApi.classTeacherCreateTimetableEntry(
        teacherId,
        selectedManagedClass,
        newAssignedSubject,
        newAssignedTeacher,
        newAssignedDay,
        newAssignedStart,
        newAssignedEnd,
        newAssignedClassroom
      );
      setNewAssignedSubject('');
      setNewAssignedTeacher('');
      setNewAssignedDay(1);
      setNewAssignedStart('09:00');
      setNewAssignedEnd('10:30');
      setNewAssignedClassroom('Room 101');
      setRefreshTrigger(prev => prev + 1);
      alert('Class timetable entry created successfully!');
      loadSelectionDetails();
    } catch (err: any) {
      alert(err.message || 'Error creating timetable entry');
    }
  };

  const handleDeleteManagedTimetable = async (timetableId: string) => {
    if (!window.confirm('Are you sure you want to delete this lecture from the class timetable?')) return;
    try {
      await mockApi.classTeacherDeleteTimetableEntry(teacherId!, timetableId);
      setRefreshTrigger(prev => prev + 1);
      alert('Class lecture successfully removed from schedule sheets.');
      loadSelectionDetails();
    } catch (err: any) {
      alert(err.message || 'Error deleting timetable entry');
    }
  };

  const handleEditManagedTimetableClick = (lecture: Timetable) => {
    setEditingManagedTtId(lecture.id);
    setEditManagedSubject(lecture.subjectId);
    setEditManagedTeacher(lecture.teacherId || '');
    setEditManagedDay(lecture.dayOfWeek);
    setEditManagedClassroom(lecture.classroomNumber || '');
    setEditManagedStart(lecture.startTime);
    setEditManagedEnd(lecture.endTime);
    setIsEditingManagedTt(true);
  };

  const handleUpdateManagedTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedManagedClass || !editingManagedTtId || !editManagedSubject) return;

    try {
      await mockApi.classTeacherUpdateTimetableEntry(
        teacherId,
        editingManagedTtId,
        selectedManagedClass,
        editManagedSubject,
        editManagedTeacher,
        editManagedDay,
        editManagedStart,
        editManagedEnd,
        editManagedClassroom
      );
      setIsEditingManagedTt(false);
      setEditingManagedTtId('');
      setRefreshTrigger(prev => prev + 1);
      alert('Class timetable entry updated successfully!');
      loadSelectionDetails();
    } catch (err: any) {
      alert(err.message || 'Error updating timetable entry');
    }
  };
  const handleCreateSelfTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selfAssignClass || !selfAssignSubject) return;

    try {
      await mockApi.teacherCreateTimetableEntry(
        teacherId,
        selfAssignClass,
        selfAssignSubject,
        selfAssignDay,
        selfAssignStart,
        selfAssignEnd,
        selfAssignClassroom
      );
      setSelfAssignDay(1);
      setSelfAssignStart('09:00');
      setSelfAssignEnd('10:30');
      setSelfAssignClassroom('Room 101');
      setRefreshTrigger(prev => prev + 1);
      alert('Lecture scheduled successfully!');
    } catch (err: any) {
      alert(err.message || 'Error scheduling lecture');
    }
  };

  const handleDeleteSelfTimetable = async (timetableId: string) => {
    if (!teacherId) return;
    if (!window.confirm('Are you sure you want to delete this lecture from your timetable?')) return;
    
    try {
      await mockApi.teacherDeleteTimetableEntry(teacherId, timetableId);
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error deleting lecture');
    }
  };

  const handleCTCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedManagedClass || !ctStEmail.trim()) return;

    try {
      await mockApi.classTeacherCreateStudent(
        teacherId,
        ctStEmail,
        ctStFirst,
        ctStLast,
        selectedManagedClass,
        ctStAdmission,
        ctStRoll,
        ctStGender,
        ctStDob,
        ctStPassword,
        ctStPhone
      );
      setShowCTAddStudent(false);
      setCtStEmail('');
      setCtStFirst('');
      setCtStLast('');
      setCtStAdmission('');
      setCtStRoll(1);
      setCtStGender('MALE');
      setCtStDob('2010-01-01');
      setCtStPassword('password');
      setCtStPhone('');
      setRefreshTrigger(prev => prev + 1);
      loadSelectionDetails();
      alert('Student successfully registered and assigned to your class!');
    } catch (err: any) {
      alert(err.message || 'Error registering student');
    }
  };

  const handleCTCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !ctPrEmail.trim() || !ctPrStudentId) return;

    try {
      await mockApi.classTeacherCreateParent(
        teacherId,
        ctPrEmail,
        ctPrFirst,
        ctPrLast,
        ctPrOccup,
        ctPrAddr,
        ctPrPhone,
        ctPrStudentId,
        ctPrAdmissionNum,
        ctPrRelation,
        ctPrPassword,
        ctPrEmergencyPhone
      );
      setShowCTAddParent(false);
      setCtPrEmail('');
      setCtPrFirst('');
      setCtPrLast('');
      setCtPrOccup('');
      setCtPrAddr('');
      setCtPrPhone('');
      setCtPrEmergencyPhone('');
      setCtPrStudentId('');
      setCtPrAdmissionNum('');
      setCtPrRelation('Father');
      setCtPrPassword('password');
      setRefreshTrigger(prev => prev + 1);
      alert('Parent registered and linked to student ward successfully!');
    } catch (err: any) {
      alert(err.message || 'Error registering parent');
    }
  };

  const handleCTDeleteStudent = async (studentId: string, name: string) => {
    if (!teacherId) return;
    if (!window.confirm(`Are you sure you want to remove student ${name} from your managed class? This will also clear parent-student linkages.`)) return;

    try {
      await mockApi.classTeacherDeleteStudent(teacherId, studentId);
      setRefreshTrigger(prev => prev + 1);
      loadSelectionDetails();
      alert('Student successfully removed.');
    } catch (err: any) {
      alert(err.message || 'Error removing student');
    }
  };

  const handleCTDeleteParent = async (parentId: string, name: string) => {
    if (!teacherId) return;
    if (!window.confirm(`Are you sure you want to remove parent ${name}? This will clear parent-student linkages.`)) return;

    try {
      await mockApi.classTeacherDeleteParent(teacherId, parentId);
      setRefreshTrigger(prev => prev + 1);
      alert('Parent successfully removed.');
    } catch (err: any) {
      alert(err.message || 'Error removing parent');
    }
  };

  const handleMarkAttendance = async () => {
    if (!teacherId || !selectedMapping) return;
    const mapping = classMappings.find(m => m.id === selectedMapping)!;
    const dateStr = new Date().toISOString().split('T')[0];

    const records = students.map(s => ({
      studentId: s.id,
      status: attendanceRecords[s.id],
      remarks: attendanceRemarks[s.id]
    }));

    try {
      await mockApi.teacherMarkAttendance(teacherId, mapping.classId, dateStr, records);
      alert('Attendance register updated successfully!');
      loadSelectionDetails();
    } catch (err: any) {
      alert(err.message || 'Error marking attendance');
    }
  };

  const handleGradingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !gradingSubmission) return;

    try {
      await mockApi.teacherGradeSubmission(
        teacherId, 
        gradingSubmission.id, 
        gradesScore, 
        gradesFeedback
      );
      setGradingSubmission(null);
      setGradesScore(0);
      setGradesFeedback('');
      loadSelectionDetails();
      alert('Grading score and feedback locked in!');
    } catch (err: any) {
      alert(err.message || 'Error grading submission');
    }
  };

  const handleAttachmentUpload = async (file: File, homeworkId: string) => {
    if (!file || !homeworkId || !teacherId) return;

    // Validate size (max 50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setAttachmentError('File size exceeds the maximum limit of 50MB.');
      return;
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
      setAttachmentError('Unsupported file type. Supports PDF, DOC/DOCX, ZIP, MP4, JPG, PNG, WEBP.');
      return;
    }

    setAttachmentUploading(true);
    setAttachmentProgress(10);
    setAttachmentError('');

    try {
      // Simulate visual upload progress ticks
      const interval = setInterval(() => {
        setAttachmentProgress(prev => {
          if (prev >= 90) {
            clearInterval(interval);
            return 90;
          }
          return prev + 15;
        });
      }, 120);

      const schoolId = mockDb.teachers.find(t => t.id === teacherId)?.schoolId || 'school-1';
      
      if (homeworkId === createdHomeworkId) {
        // Creation Mode: Upload file to storage bucket only (avoid metadata insertion to bypass FK constraint)
        const publicUrl = await mockApi.uploadHomeworkFileOnly(schoolId, homeworkId, file);
        clearInterval(interval);
        setAttachmentProgress(100);

        const mockAtt: HomeworkAttachment = {
          id: 'local_' + Math.random().toString(36).substr(2, 9),
          homeworkId,
          fileUrl: publicUrl,
          fileName: file.name,
          fileType: file.type.split('/')[1] || 'document',
          mimeType: file.type,
          uploadedAt: new Date().toISOString()
        };

        setAttachmentsList(prev => [...prev, mockAtt]);
        setAttachmentUploading(false);
      } else {
        // Edit Mode: Homework already exists in DB, so we can insert metadata directly
        const att = await mockApi.teacherUploadHomeworkAttachment(
          schoolId,
          homeworkId,
          teacherId,
          file
        );
        clearInterval(interval);
        setAttachmentProgress(100);
        setAttachmentsList(prev => [...prev, att]);
        setAttachmentUploading(false);
      }
    } catch (err: any) {
      setAttachmentUploading(false);
      setAttachmentError(err.message || 'File upload failed.');
    }
  };

  const handleAttachmentDelete = async (attachmentId: string) => {
    if (!window.confirm('Are you sure you want to delete this resource file?')) return;
    try {
      if (attachmentId.startsWith('local_')) {
        // Local/Creation Mode: Remove file from storage bucket and local lists
        const attObj = attachmentsList.find(att => att.id === attachmentId);
        if (attObj) {
          await mockApi.deleteHomeworkSubmissionFile(attObj.fileUrl);
        }
        setAttachmentsList(prev => prev.filter(att => att.id !== attachmentId));
      } else {
        // Edit Mode: Delete from database and Storage bucket
        await mockApi.teacherDeleteHomeworkAttachment(attachmentId);
        setAttachmentsList(prev => prev.filter(att => att.id !== attachmentId));
      }
    } catch (err: any) {
      alert(err.message || 'Error deleting attachment');
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedMapping || !assignTitle.trim()) return;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return;

    try {
      // 1. Create the parent homework record first in Supabase
      await mockApi.teacherCreateAssignment(
        teacherId,
        mapping.classId,
        mapping.subjectId,
        assignTitle,
        assignDesc,
        new Date(assignDueDate).toISOString(),
        assignIsHomework,
        assignSectionId || null,
        createdHomeworkId
      );

      // 2. Insert metadata for each buffered local attachment (FK is now active & satisfied!)
      const schoolId = mockDb.teachers.find(t => t.id === teacherId)?.schoolId || 'school-1';
      for (const att of attachmentsList) {
        await mockApi.teacherInsertHomeworkAttachmentMetadata(
          schoolId,
          createdHomeworkId,
          teacherId,
          att.fileUrl,
          att.fileName,
          att.mimeType || 'application/octet-stream'
        );
      }

      setAssignTitle('');
      setAssignDesc('');
      setAssignDueDate('');
      setAssignIsHomework(false);
      setAttachmentsList([]);
      setCreatedHomeworkId('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16); }));
      setAttachmentError('');
      setAttachmentProgress(0);
      setAttachmentUploading(false);
      alert('Assignment released with secure attachments to classroom feeds!');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error releasing assignment');
    }
  };

  const handleAddQuizQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qText.trim() || !qOpt1.trim() || !qOpt2.trim()) return;

    const options = [qOpt1, qOpt2];
    if (qOpt3.trim()) options.push(qOpt3);
    if (qOpt4.trim()) options.push(qOpt4);

    setQuizQuestions(prev => [...prev, {
      question: qText,
      options,
      correctOption: qCorrect,
      marks: qMarks
    }]);

    setQText('');
    setQOpt1('');
    setQOpt2('');
    setQOpt3('');
    setQOpt4('');
    setQCorrect(0);
    setQMarks(2);
  };

  const handleCreateQuiz = async () => {
    if (!teacherId || !selectedMapping || !quizTitle.trim() || quizQuestions.length === 0) return;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return;

    try {
      await mockApi.teacherCreateQuiz(
        teacherId,
        mapping.subjectId,
        mapping.classId,
        quizTitle,
        quizDuration,
        quizQuestions
      );
      setQuizTitle('');
      setQuizDuration(15);
      setQuizQuestions([]);
      alert('Interactive online quiz published successfully!');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error creating quiz');
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedMapping || !materialTitle.trim()) return;
    const mapping = classMappings.find(m => m.id === selectedMapping);
    if (!mapping) return;

    if (materialType === 'stream') {
      if (!materialUrl.trim()) {
        alert('Please provide the live stream or external video URL.');
        return;
      }
      if (!/^https?:\/\//i.test(materialUrl)) {
        alert('Please enter a valid URL starting with http:// or https://');
        return;
      }
    } else {
      if (!materialFile) {
        alert('Please select a file to upload.');
        return;
      }
      // Validate file size (100MB)
      if (materialFile.size > 100 * 1024 * 1024) {
        alert('File size exceeds the 100 MB limit. Please optimize or compress your file.');
        return;
      }
      // Validate format
      const extension = materialFile.name.split('.').pop()?.toLowerCase() || '';
      if (materialType === 'pdf' && extension !== 'pdf') {
        alert('Selected format is PDF but the uploaded file extension is not .pdf.');
        return;
      }
      if (materialType === 'docx' && extension !== 'docx') {
        alert('Selected format is Word Document but the uploaded file extension is not .docx.');
        return;
      }
      if (materialType === 'mp4' && !['mp4', 'mov', 'webm', 'ogg', 'avi'].includes(extension)) {
        alert('Selected format is Video Lecture but the uploaded file extension is not a supported video format.');
        return;
      }
    }

    try {
      setMaterialUploading(true);
      await mockApi.teacherUploadStudyMaterial(
        teacherId,
        mapping.subjectId,
        mapping.classId,
        materialTitle,
        materialDesc,
        materialUrl,
        materialType,
        materialStreamable,
        materialFile || undefined
      );
      setMaterialTitle('');
      setMaterialDesc('');
      setMaterialUrl('');
      setMaterialFile(null);
      setMaterialType('pdf');
      setMaterialStreamable(false);
      alert('Study resource added to catalog!');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error uploading material');
    } finally {
      setMaterialUploading(false);
    }
  };

  const handleSaveReportCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedManagedClass || !hmSelectedStudent || !hmSelectedExam) return;
    try {
      const marksData = hmReportCard.map(rc => ({
        scheduleId: rc.scheduleId,
        marksObtained: rc.marksObtained || 0,
        remarks: rc.remarks || ''
      }));
      await mockApi.classTeacherSaveStudentReportCard(
        teacherId,
        selectedManagedClass,
        hmSelectedStudent,
        hmSelectedExam,
        marksData
      );
      alert('Report card marks saved successfully!');
      setRefreshTrigger(prev => prev + 1);
    } catch (err: any) {
      alert(err.message || 'Error saving marks');
    }
  };

  const handleUploadSignature = async (file: File) => {
    if (!teacherId || !session?.user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }
    try {
      setSignatureUploading(true);
      const url = await mockApi.uploadTeacherSignature(teacherId, file, session.user.id);
      setTeacherSignatureUrl(url);
      alert('Signature uploaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to upload signature');
    } finally {
      setSignatureUploading(false);
    }
  };

  const handleRemoveSignature = async () => {
    if (!teacherId || !session?.user?.id) return;
    if (!window.confirm('Are you sure you want to remove your signature?')) return;
    try {
      setSignatureUploading(true);
      await mockApi.removeTeacherSignature(teacherId, session.user.id);
      setTeacherSignatureUrl('');
      alert('Signature removed successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to remove signature');
    } finally {
      setSignatureUploading(false);
    }
  };

  const teacherEntity = mockDb.teachers.find(t => t.id === teacherId);
  const teacherUser = mockDb.users.find(u => u.id === session?.user?.id);
  const teacherSchool = mockDb.schools.find(s => s.id === teacherEntity?.schoolId) || mockDb.schools.find(s => s.id === teacherUser?.schoolId);
  const teacherSchoolName = teacherSchool?.name || 'Aegis Academy';
  const facultyId = teacherEntity?.employeeId || 'N/A';
  const teacherName = teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : 'Faculty Member';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Portal Identity Context Bar */}
      {activeTab !== 'groupdiscussion' && (
        <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
            {teacherUser?.avatarUrl ? (
              <img 
                src={teacherUser.avatarUrl} 
                alt="" 
                className="w-12 h-12 rounded-xl object-cover border border-slate-700 shadow-md shrink-0 animate-fade-in"
                onError={(e) => {
                  // If link fails or is broken, clear it visually
                  (e.target as HTMLImageElement).src = '';
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center shrink-0">
                <Clipboard className="text-brand-400" size={24} />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-slate-100 font-sans leading-none">{teacherName} <span className="text-xs text-slate-400 font-normal ml-1">(Faculty/Teacher)</span></h2>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono bg-slate-800 px-2 py-0.5 rounded">ID: {facultyId}</span>
                <span className="text-[10px] text-brand-400 uppercase tracking-widest font-mono bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">{teacherSchoolName}</span>
              </div>
            </div>
          </div>

          {/* Mappings Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Select Session:</span>
            <select 
              value={selectedMapping}
              onChange={(e) => setSelectedMapping(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
            >
              {classMappings.map(m => (
                <option key={m.id} value={m.id}>{m.className} - {m.subjectName} ({m.subjectCode})</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <GlassCard className="space-y-2">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Active Students</span>
            <h3 className="text-3xl font-extrabold text-brand-400">{students.length}</h3>
            <p className="text-xs text-slate-400">Enrolled in selected class section</p>
          </GlassCard>

          <GlassCard className="space-y-2">
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Pending Homeworks</span>
            <h3 className="text-3xl font-extrabold text-brand-400">
              {submissions.filter(s => s.marksObtained === undefined).length}
            </h3>
            <p className="text-xs text-slate-400">Submissions awaiting grading matrix</p>
          </GlassCard>

          <GlassCard 
            onClick={() => setActiveTab?.('timetable')}
            className="space-y-2 cursor-pointer hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-300 group"
          >
            <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none group-hover:text-brand-400 transition-colors">Timetable Classes</span>
            <h3 className="text-3xl font-extrabold text-brand-400 group-hover:scale-105 transition-transform duration-300 origin-left">
              {mockDb.timetables.filter(t => t.teacherId === teacherId).length}
            </h3>
            <p className="text-xs text-slate-400 group-hover:text-slate-200 transition-colors">Weekly lectures assigned on master sheets</p>
          </GlassCard>

          <div className="md:col-span-3 font-sans">
            <GlassCard className="space-y-4">
              <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                    <PenTool size={16} className="text-brand-500" />
                    Teacher Signature Upload
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Upload your official digital signature to authenticate student report cards, marksheets, and academic documents.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-3">
                  <div className="text-xs text-slate-350 space-y-2 leading-relaxed">
                    <p>• Allowed formats: <strong>PNG, JPG, JPEG, SVG, WEBP</strong>.</p>
                    <p>• Max file size: <strong>5 MB</strong>.</p>
                    <p>• Ensure your signature has a transparent or solid white background for high quality scaling.</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <label className="glass-btn-primary text-xs px-4 py-2 cursor-pointer inline-flex items-center gap-1.5">
                      <UploadCloud size={14} />
                      {teacherSignatureUrl ? 'Replace Signature' : 'Upload Signature'}
                      <input 
                        type="file" 
                        accept=".png,.jpg,.jpeg,.svg,.webp" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleUploadSignature(file);
                        }} 
                        className="hidden" 
                      />
                    </label>
                    {teacherSignatureUrl && (
                      <button 
                        type="button" 
                        onClick={handleRemoveSignature} 
                        className="text-red-400 hover:text-red-350 text-xs border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 px-4 py-2 rounded-xl transition-all"
                      >
                        Remove Signature
                      </button>
                    )}
                  </div>
                </div>

                <div className="h-32 bg-slate-950/45 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center relative group p-4">
                  {signatureUploading ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-slate-400">
                      <Loader2 className="animate-spin text-brand-500" size={20} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Uploading...</span>
                    </div>
                  ) : teacherSignatureUrl ? (
                    <img src={teacherSignatureUrl} alt="Signature Preview" className="max-h-full max-w-full object-contain p-2" />
                  ) : (
                    <div className="text-center text-slate-550 space-y-1">
                      <PenTool className="mx-auto text-slate-600 mb-1" size={24} />
                      <span className="block text-[10px] font-bold uppercase tracking-wider">No Signature Uploaded</span>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'groupdiscussion' && (
        <ClassDiscussion
          currentUserId={session?.user.id || ''}
          currentUserRole={session?.user.role || 'TEACHER'}
          schoolId={session?.user.schoolId || ''}
          academicSessionId={session?.user.academicSessionId || ''}
        />
      )}

      {activeTab === 'timetable' && (
        <div className="space-y-6">
          <GlassCard className="space-y-6 animate-fade-in">
            <div className="border-b border-slate-850 pb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Calendar className="text-brand-500" size={18} />
                Teaching Timetable Schedule
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Your weekly assigned lectures, homerooms, and lab classes across academic blocks.
              </p>
            </div>

            <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-3xl space-y-4 mb-6">
              <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest leading-none">Schedule Self Lecture Period</p>
              
              <form onSubmit={handleCreateSelfTimetable} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Class</label>
                  <select
                    value={selfAssignClass}
                    onChange={(e) => setSelfAssignClass(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Class --</option>
                    {classMappings.filter((v,i,a)=>a.findIndex(t=>(t.classId === v.classId))===i).map(m => (
                      <option key={m.classId} value={m.classId}>{m.className}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Subject</label>
                  <select
                    value={selfAssignSubject}
                    onChange={(e) => setSelfAssignSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Subject --</option>
                    {classMappings.filter(m => m.classId === selfAssignClass).map(m => (
                      <option key={m.subjectId} value={m.subjectId}>{m.subjectName} ({m.subjectCode})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Day</label>
                  <select
                    value={selfAssignDay}
                    onChange={(e) => setSelfAssignDay(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Classroom</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 303"
                    value={selfAssignClassroom}
                    onChange={(e) => setSelfAssignClassroom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Start Time</label>
                  <input
                    type="time"
                    value={selfAssignStart}
                    onChange={(e) => setSelfAssignStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">End Time</label>
                  <input
                    type="time"
                    value={selfAssignEnd}
                    onChange={(e) => setSelfAssignEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="submit"
                    className="w-full glass-btn-primary text-xs py-2.5"
                  >
                    Add to My Timetable
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6].map(dayNum => {
                const dayLectures = mockDb.timetables
                  .filter(t => t.teacherId === teacherId && t.dayOfWeek === dayNum)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                const dayName = dayNum === 1 ? 'Monday' : 
                                dayNum === 2 ? 'Tuesday' : 
                                dayNum === 3 ? 'Wednesday' : 
                                dayNum === 4 ? 'Thursday' : 
                                dayNum === 5 ? 'Friday' : 'Saturday';

                return (
                  <div key={dayNum} className="space-y-2">
                    <h4 className="text-xs font-bold text-brand-400 uppercase tracking-widest pl-1">
                      {dayName}
                    </h4>
                    {dayLectures.length === 0 ? (
                      <div className="p-3 bg-slate-900/10 border border-slate-850/50 rounded-xl text-slate-500 text-xs italic">
                        No lectures scheduled for today.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dayLectures.map(lecture => {
                          const subject = mockDb.subjects.find(s => s.id === lecture.subjectId);
                          const cls = mockDb.classes.find(c => c.id === lecture.classId);
                          
                          return (
                            <div 
                              key={lecture.id} 
                              className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex justify-between items-center hover:border-brand-500/20 transition-all duration-300 group"
                            >
                              <div className="space-y-1">
                                <span className="bg-brand-500/10 border border-brand-500/20 text-brand-400 font-bold px-2 py-0.5 rounded text-[9px] uppercase font-mono tracking-wider">
                                  {cls ? cls.name : 'Unknown Class'}
                                </span>
                                <h5 className="font-bold text-slate-200 text-xs group-hover:text-brand-400 transition-colors">
                                  {subject ? subject.name : 'Course Lecture'}
                                </h5>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1.5 font-sans">
                                  <span className="flex items-center gap-1">
                                    <Clock size={11} className="text-slate-500" />
                                    {lecture.startTime} - {lecture.endTime}
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <MapPin size={11} className="text-slate-500" />
                                    {lecture.classroomNumber || 'Main Lecture Hall'}
                                  </span>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDeleteSelfTimetable(lecture.id)}
                                className="text-red-400 hover:text-red-300 font-semibold text-xs border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 px-2.5 py-1.5 rounded-xl transition-all"
                              >
                                Delete
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {managedClasses.length > 0 && (
            <PremiumLock
              isLocked={!ent.hasBilling}
              requiredTier="Pro"
              featureName="Class Teacher Hub (Timetables, Students, Parents)"
            >
              <GlassCard className="space-y-6 animate-fade-in border-brand-500/10">
              <div className="border-b border-slate-850 pb-3 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Layers className="text-brand-500" size={18} />
                    Class Teacher Hub: Manage Student Timetables
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    As the Class Teacher, you can create and manage schedules, timetables, and teacher assignments for your class.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-slate-400">Class:</span>
                  <select
                    value={selectedManagedClass}
                    onChange={(e) => setSelectedManagedClass(e.target.value)}
                    className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-1.5 focus:outline-none"
                  >
                    {managedClasses.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-3xl space-y-4">
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest leading-none">Schedule New Lecture Period</p>
                
                <form onSubmit={handleCreateManagedTimetable} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Subject</label>
                    <select
                      value={newAssignedSubject}
                      onChange={(e) => setNewAssignedSubject(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                      required
                    >
                      <option value="">-- Choose Subject --</option>
                      {mockDb.subjects
                        .filter(s => s.schoolId === (session?.user.schoolId || mockDb.teachers.find(t => t.id === teacherId)?.schoolId))
                        .map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                        ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Assigned Teacher</label>
                    <select
                      value={newAssignedTeacher}
                      onChange={(e) => setNewAssignedTeacher(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                      required
                    >
                      <option value="">-- Choose Instructor --</option>
                      {(() => {
                        const sId = session?.user.schoolId || mockDb.teachers.find(t => t.id === teacherId)?.schoolId || '';
                        const schoolTeachers = mockDb.getSchoolTeachers(sId);
                        if (schoolTeachers.length === 0) {
                          return <option disabled>No active teachers found</option>;
                        }
                        return schoolTeachers.map(t => {
                          const u = mockDb.users.find(usr => usr.id === t.userId);
                          if (!u) return null;
                          return (
                            <option key={t.id} value={t.id}>
                              {u.firstName} {u.lastName} — {t.employeeId} ({t.specialization})
                            </option>
                          );
                        });
                      })()}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Day</label>
                    <select
                      value={newAssignedDay}
                      onChange={(e) => setNewAssignedDay(parseInt(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                    >
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                      <option value={6}>Saturday</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Classroom</label>
                    <input
                      type="text"
                      placeholder="e.g. Room 303"
                      value={newAssignedClassroom}
                      onChange={(e) => setNewAssignedClassroom(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Start Time</label>
                    <input
                      type="time"
                      value={newAssignedStart}
                      onChange={(e) => setNewAssignedStart(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">End Time</label>
                    <input
                      type="time"
                      value={newAssignedEnd}
                      onChange={(e) => setNewAssignedEnd(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      className="w-full glass-btn-primary text-xs py-2.5"
                    >
                      Add to Class Timetable
                    </button>
                  </div>
                </form>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-850">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Current Weekly Student Schedule</p>
                
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5, 6].map(dayNum => {
                    const classLectures = mockDb.timetables
                      .filter(t => t.classId === selectedManagedClass && t.dayOfWeek === dayNum)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));

                    const dayName = dayNum === 1 ? 'Monday' : 
                                    dayNum === 2 ? 'Tuesday' : 
                                    dayNum === 3 ? 'Wednesday' : 
                                    dayNum === 4 ? 'Thursday' : 
                                    dayNum === 5 ? 'Friday' : 'Saturday';

                    return (
                      <div key={dayNum} className="space-y-2">
                        <h4 className="text-xs font-bold text-brand-400 uppercase tracking-widest pl-1">{dayName}</h4>
                        
                        {classLectures.length === 0 ? (
                          <div className="p-3 bg-slate-900/10 border border-slate-850/50 rounded-xl text-slate-500 text-xs italic">No periods scheduled for today.</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {classLectures.map(lecture => {
                              const subject = mockDb.subjects.find(s => s.id === lecture.subjectId);
                              const teacher = lecture.teacherId ? mockDb.teachers.find(t => t.id === lecture.teacherId) : null;
                              const teacherUser = teacher ? mockDb.users.find(u => u.id === teacher.userId) : null;

                              return (
                                <div
                                  key={lecture.id}
                                  className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex justify-between items-center hover:border-brand-500/20 transition-all duration-300 group"
                                >
                                  <div className="space-y-1">
                                    <h5 className="font-bold text-slate-200 text-xs group-hover:text-brand-400 transition-colors">
                                      {subject ? subject.name : 'Unknown Subject'}
                                    </h5>
                                    <p className="text-[10px] text-slate-400">
                                      Instructor: {teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : 'Guest Faculty'}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-500 mt-1.5">
                                      <span className="flex items-center gap-1">
                                        <Clock size={11} />
                                        {lecture.startTime} - {lecture.endTime}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <MapPin size={11} />
                                        {lecture.classroomNumber}
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => handleEditManagedTimetableClick(lecture)}
                                      className="text-brand-400 hover:text-brand-300 font-semibold text-xs border border-brand-500/20 hover:border-brand-500/40 bg-brand-500/5 hover:bg-brand-500/10 px-2.5 py-1.5 rounded-xl transition-all"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      onClick={() => handleDeleteManagedTimetable(lecture.id)}
                                      className="text-red-400 hover:text-red-300 font-semibold text-xs border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 px-2.5 py-1.5 rounded-xl transition-all"
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </GlassCard>

            {/* Class Teacher Hub: Manage Class Students & Parents */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-slate-850">
              {/* Managed Students List */}
              <GlassCard className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">Managed Students</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Students enrolled in your homeroom class.</p>
                  </div>
                  <button
                    onClick={() => setShowCTAddStudent(true)}
                    className="glass-btn-primary text-xs flex items-center gap-1 py-1 px-2.5"
                  >
                    <PlusCircle size={14} /> Add Student
                  </button>
                </div>

                <div className="overflow-y-auto max-h-72 space-y-2">
                  {(() => {
                    const classStudents = mockDb.students.filter(s => s.classId === selectedManagedClass);
                    if (classStudents.length === 0) {
                      return <p className="text-xs text-slate-500 italic p-4 text-center">No students currently enrolled in this class.</p>;
                    }
                    return classStudents.map(s => {
                      const u = mockDb.users.find(usr => usr.id === s.userId);
                      if (!u) return null;
                      return (
                        <div key={s.id} className="p-3 bg-slate-900/20 border border-slate-850/60 rounded-xl flex items-center justify-between animate-fade-in">
                          <div>
                            <p className="font-bold text-slate-200 text-xs">{u.firstName} {u.lastName}</p>
                            <p className="text-[10px] text-slate-500 font-mono">Adm: {s.admissionNumber} | Roll: {s.rollNumber}</p>
                          </div>
                          <button
                            onClick={() => handleCTDeleteStudent(s.id, `${u.firstName} ${u.lastName}`)}
                            className="text-red-400 hover:text-red-300 font-semibold text-[10px] border border-red-500/10 hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </GlassCard>

              {/* Managed Parents List */}
              <GlassCard className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">Managed Parents & Guardians</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Parents linked to students in your class.</p>
                  </div>
                  <button
                    onClick={() => setShowCTAddParent(true)}
                    className="glass-btn-primary text-xs flex items-center gap-1 py-1 px-2.5"
                  >
                    <PlusCircle size={14} /> Add Parent
                  </button>
                </div>

                <div className="overflow-y-auto max-h-72 space-y-2">
                  {(() => {
                    const classStudents = mockDb.students.filter(s => s.classId === selectedManagedClass);
                    const classParentMappings = mockDb.parentStudentMappings.filter(m => classStudents.some(cs => cs.id === m.studentId));
                    const classParents = mockDb.parents.filter(p => classParentMappings.some(m => m.parentId === p.id));
                    
                    if (classParents.length === 0) {
                      return <p className="text-xs text-slate-500 italic p-4 text-center">No parent accounts linked to students in this class.</p>;
                    }

                    return classParents.map(p => {
                      const u = mockDb.users.find(usr => usr.id === p.userId);
                      if (!u) return null;
                      
                      // find linked students in this managed class
                      const linkedWards = mockDb.parentStudentMappings
                        .filter(m => m.parentId === p.id && classStudents.some(cs => cs.id === m.studentId))
                        .map(m => {
                          const cs = classStudents.find(st => st.id === m.studentId);
                          if (!cs) return null;
                          const csu = mockDb.users.find(usr => usr.id === cs.userId);
                          if (!csu) return null;
                          return `${csu.firstName} ${csu.lastName}`;
                        })
                        .filter(Boolean) as string[];

                      return (
                        <div key={p.id} className="p-3 bg-slate-900/20 border border-slate-850/60 rounded-xl flex items-center justify-between animate-fade-in">
                          <div>
                            <p className="font-bold text-slate-200 text-xs">{u.firstName} {u.lastName}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {linkedWards.map((name, idx) => (
                                <span key={idx} className="text-[9px] font-semibold text-brand-400 bg-brand-500/5 border border-brand-500/10 px-1.5 py-0.5 rounded">
                                  Ward: {name}
                                </span>
                              ))}
                            </div>
                          </div>
                          <button
                            onClick={() => handleCTDeleteParent(p.id, `${u.firstName} ${u.lastName}`)}
                            className="text-red-400 hover:text-red-300 font-semibold text-[10px] border border-red-500/10 hover:border-red-500/30 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded-lg transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </GlassCard>
            </div>
          </PremiumLock>
        )}
        </div>
      )}

      {activeTab === 'classroster' && (
        <PremiumLock
          isLocked={!ent.hasBilling}
          requiredTier="Basic"
          featureName="Class Roster"
        >
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="space-y-6">
              <div className="border-b border-slate-850 pb-3">
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <Users className="text-brand-500" size={18} />
                  Class Roster Directory
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Academic directory of students enrolled in the selected session along with their details and parents.
                </p>
              </div>

              {students.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/10 border border-slate-850/50 rounded-2xl text-slate-500 text-xs italic">
                  No students currently enrolled in this class.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[9px]">
                        <th className="py-3 px-4">Roll No</th>
                        <th className="py-3 px-4">Admission No</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Gender & DOB</th>
                        <th className="py-3 px-4">Parent / Guardian Contacts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                       {students.map(s => {
                        const parentMappings = mockDb.parentStudentMappings.filter(m => m.studentId === s.id);
                        const parentsList = parentMappings.map(m => {
                          const p = mockDb.parents.find(pDb => pDb.id === m.parentId);
                          const u = p ? mockDb.users.find(uDb => uDb.id === p.userId) : null;
                          return {
                            relationship: m.relationship || 'Guardian',
                            name: u ? `${u.firstName} ${u.lastName}` : 'N/A',
                            phone: u ? u.phone || 'N/A' : 'N/A',
                            email: u ? u.email : 'N/A',
                            userId: u ? u.id : null
                          };
                        });

                        return (
                          <tr key={s.id} className="hover:bg-slate-900/10 text-slate-200 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-brand-400">{s.rollNumber}</td>
                            <td className="py-3 px-4 font-mono text-slate-400">{s.admissionNumber}</td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-100">{s.userDetails.firstName} {s.userDetails.lastName}</div>
                              <div className="text-[10px] text-slate-500 font-semibold">{s.userDetails.email}</div>
                              {s.userDetails.phone && <div className="text-[10px] text-slate-400 font-mono mt-0.5">Primary: {s.userDetails.phone}</div>}
                              {(() => {
                                const emails = mockDb.emailAddresses.filter(ea => ea.userId === s.userDetails.id);
                                const contactEmails = emails.filter(ea => ea.emailType !== 'LOGIN');
                                return contactEmails.length > 0 ? (
                                  <div className="flex flex-col gap-0.5 mt-0.5 border-t border-slate-800/40 pt-0.5">
                                    {contactEmails.map(ea => (
                                      <span key={ea.id} className="text-[9px] text-slate-500 font-mono">
                                        ✉️ {ea.emailType}: {ea.email} {ea.isVerified && <span className="text-[8px] text-green-500">✓</span>}
                                      </span>
                                    ))}
                                  </div>
                                ) : null;
                              })()}
                            </td>
                            <td className="py-3 px-4 space-y-1">
                              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-300">
                                {s.gender}
                              </span>
                              <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                                {s.dateOfBirth}
                              </div>
                            </td>
                            <td className="py-3 px-4 space-y-2">
                              {parentsList.length === 0 ? (
                                <span className="text-[10px] text-slate-500 italic">No parent linked</span>
                              ) : (
                                parentsList.map((p, idx) => (
                                  <div key={idx} className="bg-slate-950/40 border border-slate-850 p-2 rounded-xl space-y-1 max-w-sm">
                                    <div className="flex items-center gap-1.5 justify-between">
                                      <span className="font-bold text-slate-200 text-[10px]">{p.name}</span>
                                      <span className="text-[8px] font-bold uppercase bg-brand-500/10 border border-brand-500/20 text-brand-400 px-1 py-0.2 rounded-md">
                                        {p.relationship}
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-slate-400 flex flex-col space-y-0.5">
                                      <div className="flex flex-wrap gap-x-3 mt-0.5">
                                        <span>📞 {p.phone}</span>
                                        <span>✉️ {p.email}</span>
                                      </div>
                                      {p.userId && (() => {
                                        const emergency = mockDb.phoneNumbers.find(pn => pn.userId === p.userId && pn.phoneType === 'EMERGENCY');
                                        const parentEmails = mockDb.emailAddresses.filter(ea => ea.userId === p.userId && ea.emailType !== 'LOGIN');
                                        return (
                                          <>
                                            {emergency && (
                                              <div className="text-amber-500 font-mono text-[9px] mt-0.5">🆘 Emergency: {emergency.fullNumber}</div>
                                            )}
                                            {parentEmails.map(ea => (
                                              <div key={ea.id} className="text-slate-500 font-mono text-[8px] mt-0.5">
                                                ✉️ {ea.emailType}: {ea.email} {ea.isVerified && <span className="text-[8px] text-green-500">✓</span>}
                                              </div>
                                            ))}
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>
                                ))
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </GlassCard>
          </div>
        </PremiumLock>
      )}

      {activeTab === 'attendance' && (
        <PremiumLock 
          isLocked={!ent.hasBilling} 
          requiredTier="Basic"
          featureName="School Attendance & Progress Analytics"
        >
          <div className="space-y-6 animate-fade-in">
            {/* Header section with Class selector and Date selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                  <UserCheck className="text-brand-500" size={24} />
                  Homeroom Attendance Ledger
                </h3>
                <p className="text-xs text-slate-400">
                  Manage class rosters, daily registries, and leverage progress analytics.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* Managed Class Dropdown */}
                {managedClasses.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 font-medium">Class:</span>
                    <select
                      value={selectedManagedClass}
                      onChange={(e) => setSelectedManagedClass(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-slate-100 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500"
                    >
                      {managedClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Sub Tab Toggles */}
                <div className="flex bg-slate-950 border border-slate-850 p-1 rounded-lg">
                  <button
                    onClick={() => setTeacherAttendanceSubTab('mark')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      teacherAttendanceSubTab === 'mark'
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Mark Register
                  </button>
                  <button
                    onClick={() => setTeacherAttendanceSubTab('analytics')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      teacherAttendanceSubTab === 'analytics'
                        ? 'bg-brand-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Analytics & Insights
                  </button>
                </div>
              </div>
            </div>

            {/* Sub-Tab 1: Mark Daily Register */}
            {teacherAttendanceSubTab === 'mark' && (
              <GlassCard className="space-y-6">
                <div className="border-b border-slate-850 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium">Select Register Date:</span>
                    <input 
                      type="date"
                      value={teacherAttendanceDate}
                      onChange={(e) => setTeacherAttendanceDate(e.target.value)}
                      className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg p-1.5 px-3 text-xs focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>
                  
                  <button 
                    onClick={handleTeacherSaveAttendance}
                    className="glass-btn-primary text-xs flex items-center gap-1.5 px-4 py-2"
                  >
                    <Save size={14} />
                    Commit Attendance Ledger
                  </button>
                </div>

                {teacherAttendanceLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                    <p className="text-xs text-slate-400">Loading homeroom class list...</p>
                  </div>
                ) : teacherAttendanceStudents.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    No students currently mapped to this class.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Roll</th>
                          <th className="py-3 px-4">Student Name</th>
                          <th className="py-3 px-4">Daily Status</th>
                          <th className="py-3 px-4">Detailed Remarks / Medical Tags</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {teacherAttendanceStudents.map(s => (
                          <tr key={s.id} className="hover:bg-slate-900/10 text-slate-200 transition-colors">
                            <td className="py-3 px-4 font-mono text-slate-400">{s.rollNumber}</td>
                            <td className="py-3 px-4 font-semibold text-slate-100">
                              {s.userDetails?.firstName} {s.userDetails?.lastName}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-1.5">
                                {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(status => {
                                  const isSelected = attendanceRecords[s.id] === status;
                                  return (
                                    <button
                                      key={status}
                                      onClick={() => setAttendanceRecords(prev => ({ ...prev, [s.id]: status as any }))}
                                      className={`px-2.5 py-1 rounded-md text-[9px] font-bold border transition-all duration-200 ${
                                        isSelected 
                                          ? status === 'PRESENT' 
                                            ? 'bg-green-500/10 border-green-500/40 text-green-400 shadow-sm' 
                                            : status === 'ABSENT' 
                                              ? 'bg-red-500/10 border-red-500/40 text-red-400 shadow-sm' 
                                              : status === 'LATE'
                                                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 shadow-sm'
                                                : 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400 shadow-sm'
                                          : 'bg-slate-950/80 border-slate-850 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                                      }`}
                                    >
                                      {status}
                                    </button>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="py-3 px-4">
                              <input 
                                type="text" 
                                placeholder="Medical notes, parent message, delay reason..."
                                value={attendanceRemarks[s.id] || ''}
                                onChange={(e) => setAttendanceRemarks(prev => ({ ...prev, [s.id]: e.target.value }))}
                                className="bg-slate-950/80 border border-slate-850 text-slate-100 rounded-lg p-1.5 px-3 text-xs focus:outline-none focus:border-brand-500 w-full max-w-sm"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>
            )}

            {/* Sub-Tab 2: Analytics & Insights */}
            {teacherAttendanceSubTab === 'analytics' && (
              <div className="space-y-6">
                {/* Stats row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <GlassCard className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Critical Chronic Absences</h4>
                      <p className="text-2xl font-black text-red-400 mt-1">
                        {teacherAttendanceAnalytics.filter(a => a.absenceRate > 20).length}
                      </p>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl">
                      <Clock size={24} />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Frequent Tardy Logins</h4>
                      <p className="text-2xl font-black text-amber-400 mt-1">
                        {teacherAttendanceAnalytics.filter(a => a.lateRate > 15).length}
                      </p>
                    </div>
                  </GlassCard>

                  <GlassCard className="p-4 flex items-center gap-4">
                    <div className="p-3 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl">
                      <CheckCircle size={24} />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Perfect Attendance</h4>
                      <p className="text-2xl font-black text-green-400 mt-1">
                        {teacherAttendanceAnalytics.filter(a => a.attendanceRate === 100).length}
                      </p>
                    </div>
                  </GlassCard>
                </div>

                <GlassCard className="p-6">
                  <h4 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
                    <TrendingUp className="text-brand-500" size={18} />
                    Class Roster Attendance Metric Matrix
                  </h4>

                  {teacherAttendanceLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-3">
                      <div className="w-8 h-8 border-4 border-brand-500/20 border-t-brand-500 rounded-full animate-spin"></div>
                      <p className="text-xs text-slate-400">Compiling class analytics...</p>
                    </div>
                  ) : teacherAttendanceAnalytics.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-xs">
                      No analytics data compiled for this class roster.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                            <th className="py-3 px-4">Student</th>
                            <th className="py-3 px-4">Attendance Rate</th>
                            <th className="py-3 px-4">Absence Rate</th>
                            <th className="py-3 px-4">Tardiness Index</th>
                            <th className="py-3 px-4 text-center">Alert Condition</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850">
                          {teacherAttendanceAnalytics.map(row => {
                            const isCritical = row.absenceRate > 20;
                            const isTardyAlert = row.lateRate > 15;
                            return (
                              <tr key={row.studentId} className="hover:bg-slate-900/10 text-slate-200 transition-colors">
                                <td className="py-3 px-4 font-semibold text-slate-100">{row.studentName}</td>
                                <td className="py-3 px-4 font-mono font-bold text-green-400">{row.attendanceRate}%</td>
                                <td className="py-3 px-4 font-mono text-slate-300">{row.absenceRate}%</td>
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono text-slate-300">{row.lateRate}%</span>
                                    {isTardyAlert && (
                                      <button 
                                        onClick={() => setSelectedTardyStudent(row)}
                                        className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded hover:bg-amber-500/20 transition-all font-bold animate-pulse"
                                      >
                                        Logs
                                      </button>
                                    )}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {isCritical ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-red-500/10 border border-red-500/30 text-red-400">
                                      CRITICAL ABSENTEE
                                    </span>
                                  ) : isTardyAlert ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-amber-500/10 border border-amber-500/30 text-amber-400">
                                      TARDY THRESHOLD
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase bg-green-500/10 border border-green-500/30 text-green-400">
                                      STABLE
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </GlassCard>
              </div>
            )}
          </div>
        </PremiumLock>
      )}

      {activeTab === 'grades' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <Award className="text-brand-500" size={24} />
                Gradebook Matrix
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Evaluate daily homework, assignments, and provide detailed feedback to your students.
              </p>
            </div>
            
            <div className="flex gap-2">
               <div className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-2 flex gap-4 shadow-inner">
                 <div className="text-center">
                   <span className="block text-xl font-bold text-slate-200">{submissions.length}</span>
                   <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Total</span>
                 </div>
                 <div className="w-px bg-slate-800"></div>
                 <div className="text-center">
                   <span className="block text-xl font-bold text-amber-400">{submissions.filter(s => s.marksObtained === undefined).length}</span>
                   <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Ungraded</span>
                 </div>
               </div>
            </div>
          </div>

          {submissions.length === 0 ? (
            <GlassCard className="text-center py-12 border-slate-850 bg-slate-900/20">
              <Award className="text-slate-600 mx-auto mb-4 opacity-50" size={48} />
              <p className="text-slate-400 font-medium">No submissions found for the selected session.</p>
              <p className="text-xs text-slate-500 mt-2">Wait for students to upload their assignments.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {submissions.map(sub => (
                <GlassCard key={sub.id} className="relative group hover:border-brand-500/30 hover:-translate-y-1 transition-all flex flex-col h-full border-slate-850">
                  {sub.marksObtained !== undefined ? (
                    <div className="absolute top-4 right-4 bg-green-500/10 border border-green-500/20 text-green-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                      Graded ({sub.marksObtained}/{sub.maxMarks})
                    </div>
                  ) : (
                    <div className="absolute top-4 right-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">
                      Needs Grading
                    </div>
                  )}

                  <div className="mb-4 pt-1">
                    <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest">{sub.assignmentTitle}</p>
                    <h4 className="text-lg font-bold text-slate-100 mt-1">{sub.studentName}</h4>
                    {sub.fileUrl ? (
                      <a 
                        href={sub.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-[11px] text-brand-400 hover:text-brand-300 mt-1.5 flex items-center gap-1.5 font-mono bg-brand-500/5 hover:bg-brand-500/10 px-2 py-1 rounded-md border border-brand-500/20 w-fit transition-colors"
                      >
                        <Paperclip size={12} className="text-brand-400" />
                        {sub.fileUrl.split('/').pop()?.split('_').slice(2).join('_') || 'Download Attachment'}
                      </a>
                    ) : (
                      <p className="text-[11px] text-slate-500 mt-1.5 flex items-center gap-1.5 font-mono bg-slate-900/50 inline-flex px-2 py-1 rounded-md border border-slate-800">
                        <FileText size={12} className="text-slate-600" />
                        No attachment provided
                      </p>
                    )}
                  </div>
                  
                  <div className="flex-1 mt-2">
                    {sub.feedback ? (
                      <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-850 shadow-inner">
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Feedback</p>
                        <p className="text-xs text-slate-300 italic line-clamp-3">"{sub.feedback}"</p>
                      </div>
                    ) : (
                      <div className="h-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <p className="text-[10px] text-slate-600 font-semibold uppercase tracking-widest">No feedback yet</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-850">
                    <button 
                      onClick={() => {
                        setGradingSubmission(sub);
                        setGradesScore(sub.marksObtained || 0);
                        setGradesFeedback(sub.feedback || '');
                      }}
                      className={`w-full text-xs font-semibold py-2.5 rounded-xl transition-all ${
                        sub.marksObtained !== undefined 
                          ? 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700' 
                          : 'glass-btn-primary shadow-lg shadow-brand-500/20'
                      }`}
                    >
                      {sub.marksObtained !== undefined ? 'Edit Grade & Feedback' : 'Grade Assignment'}
                    </button>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'marksheets' && (
        <PremiumLock
          isLocked={!ent.hasQuizzes}
          requiredTier="Pro"
          featureName="Homeroom Marksheets"
        >
          <div className="space-y-6 animate-fade-in">
            <GlassCard className="space-y-6">
              <div className="border-b border-slate-850 pb-3 flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Clipboard className="text-brand-500" size={18} />
                    Homeroom Marksheets Management
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Update report cards and marks for students in your assigned homeroom class.
                  </p>
                </div>
                {managedClasses.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={selectedManagedClass}
                      onChange={(e) => {
                        setSelectedManagedClass(e.target.value);
                        setHmSelectedStudent('');
                      }}
                      className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500"
                    >
                      {managedClasses.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    <select 
                      value={hmSelectedExam}
                      onChange={(e) => setHmSelectedExam(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500"
                    >
                      <option value="">-- Select Exam --</option>
                      {hmExams.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                    <select 
                      value={hmSelectedStudent}
                      onChange={(e) => setHmSelectedStudent(e.target.value)}
                      className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500"
                    >
                      <option value="">-- Select Student --</option>
                      {mockDb.students.filter(s => s.classId === selectedManagedClass).map(st => {
                        const u = mockDb.users.find(u => u.id === st.userId);
                        return <option key={st.id} value={st.id}>{u?.firstName} {u?.lastName}</option>;
                      })}
                    </select>
                  </div>
                )}
              </div>

              {managedClasses.length === 0 ? (
                <div className="text-center p-8 text-slate-400 italic text-sm">
                  You do not have any homeroom classes assigned.
                </div>
              ) : hmSelectedStudent && hmSelectedExam ? (
                <form onSubmit={handleSaveReportCard} className="space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 font-bold">
                          <th className="py-3 px-4">Subject</th>
                          <th className="py-3 px-4">Max Marks</th>
                          <th className="py-3 px-4">Marks Obtained</th>
                          <th className="py-3 px-4">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {hmReportCard.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-8 text-center text-slate-500 italic">No schedules found for this exam.</td>
                          </tr>
                        ) : (
                          hmReportCard.map((rc, idx) => (
                            <tr key={rc.scheduleId} className="hover:bg-slate-900/10 text-slate-200">
                              <td className="py-3 px-4 font-semibold">{rc.subjectName}</td>
                              <td className="py-3 px-4 text-slate-400">{rc.maxMarks}</td>
                              <td className="py-3 px-4">
                                <input 
                                  type="number"
                                  min={0}
                                  max={rc.maxMarks}
                                  value={rc.marksObtained ?? ''}
                                  onChange={(e) => {
                                    const newRc = [...hmReportCard];
                                    newRc[idx].marksObtained = parseFloat(e.target.value) || 0;
                                    setHmReportCard(newRc);
                                  }}
                                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs w-20 focus:outline-none focus:border-brand-500"
                                />
                              </td>
                              <td className="py-3 px-4">
                                <input 
                                  type="text"
                                  value={rc.remarks ?? ''}
                                  onChange={(e) => {
                                    const newRc = [...hmReportCard];
                                    newRc[idx].remarks = e.target.value;
                                    setHmReportCard(newRc);
                                  }}
                                  className="bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs w-full focus:outline-none focus:border-brand-500"
                                  placeholder="Optional remarks..."
                                />
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {hmReportCard.length > 0 && (
                    <div className="flex justify-end pt-4 gap-3">
                      <button 
                        type="button"
                        onClick={async () => {
                          try {
                            const exam = hmExams.find(e => e.id === hmSelectedExam);
                            const termName = exam?.term || 'TERM 1';
                            const marksheetData = await mockApi.getStudentMarksheetData(hmSelectedStudent, termName);
                            await downloadMarksheetPdf(marksheetData.student.name, termName, marksheetData);
                          } catch (err: any) {
                            console.error(err);
                            alert('Failed to generate marksheet: ' + err.message);
                          }
                        }}
                        className="px-4 py-2 border border-brand-500/30 text-brand-400 bg-brand-500/5 hover:bg-brand-500/10 rounded-xl text-xs font-bold transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText size={14} /> Download Marksheet (PDF)
                      </button>
                      <button type="submit" className="glass-btn-primary text-xs flex items-center gap-1.5 cursor-pointer">
                        <Save size={14} /> Save Report Card
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <div className="text-center p-8 text-slate-400 italic text-sm border border-slate-850/50 bg-slate-900/20 rounded-2xl">
                  Please select both an Exam and a Student to view and edit the report card.
                </div>
              )}
            </GlassCard>
          </div>
        </PremiumLock>
      )}
      {activeTab === 'assignments' && (
        <PremiumLock
          isLocked={!ent.hasLibraryAccess}
          requiredTier="Enterprise"
          featureName="Assignment Creator"
          customMessage="This feature is available only with an active Enterprise Subscription. Please contact your School Administrator."
        >
          <div className="animate-fade-in">
            <GlassCard className="space-y-4 max-w-xl mx-auto">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <PlusCircle className="text-brand-500" size={16} />
              Deploy Homework / Assignment
            </h3>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Task Title</label>
                <input 
                  type="text"
                  placeholder="e.g. Spacetime Calculus Proofs"
                  value={assignTitle}
                  onChange={(e) => setAssignTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Problem Description</label>
                <textarea 
                  placeholder="Provide full problem questions or equations..."
                  rows={4}
                  value={assignDesc}
                  onChange={(e) => setAssignDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
               <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Due Date</label>
                <input 
                  type="datetime-local"
                  value={assignDueDate}
                  onChange={(e) => setAssignDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              {availableSections.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Section</label>
                  <select 
                    value={assignSectionId}
                    onChange={(e) => setAssignSectionId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                    required
                  >
                    {availableSections.map(sec => (
                      <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Premium Attachment Uploader Section */}
              <div className="space-y-2.5 pt-2 border-t border-slate-850">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Homework Resource Attachments</label>
                
                {/* Drag and Drop Zone */}
                {!attachmentUploading ? (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleAttachmentUpload(e.dataTransfer.files[0], createdHomeworkId);
                      }
                    }}
                    onClick={() => document.getElementById(`teacher-file-picker-${createdHomeworkId}`)?.click()}
                    className="border-2 border-dashed border-slate-850 hover:border-brand-500/50 hover:bg-brand-500/5 rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 group"
                  >
                    <input 
                      type="file" 
                      id={`teacher-file-picker-${createdHomeworkId}`} 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleAttachmentUpload(e.target.files[0], createdHomeworkId);
                        }
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip,.mp4"
                    />
                    <UploadCloud size={24} className="text-slate-500 group-hover:text-brand-400 group-hover:scale-110 transition-all duration-300 shrink-0" />
                    <p className="text-xs font-semibold text-slate-300">Drag & drop resource here, or <span className="text-brand-400 hover:underline">browse</span></p>
                    <p className="text-[9px] text-slate-500 font-medium">Supports PDF, DOCX, ZIP, JPG, PNG, MP4 up to 50MB</p>
                  </div>
                ) : (
                  /* Uploading Indicator */
                  <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <Loader2 size={18} className="text-brand-400 animate-spin shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">Uploading attachment...</p>
                        <p className="text-[9px] text-slate-500">Securing resource file in Supabase CDN</p>
                      </div>
                      <span className="text-xs font-bold text-brand-400 font-mono shrink-0">{attachmentProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                        style={{ width: `${attachmentProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Alert */}
                {attachmentError && (
                  <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-lg flex items-start gap-2 animate-fade-in">
                    <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Upload Failed</p>
                      <p className="text-[9.5px] text-red-400 mt-0.5">{attachmentError}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setAttachmentError('')}
                      className="text-[9px] font-bold text-slate-500 hover:text-slate-300 uppercase font-mono tracking-widest"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Uploaded Attachments Grid/List */}
                {attachmentsList.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {attachmentsList.map((att) => (
                      <div key={att.id} className="border border-slate-850 bg-slate-950/40 hover:bg-slate-950/65 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors animate-fade-in group/item">
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip size={14} className="text-brand-400 shrink-0" />
                          <span className="text-xs text-slate-300 truncate" title={att.fileName}>
                            {att.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a 
                            href={att.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                            title="View File"
                          >
                            <Eye size={13} />
                          </a>
                          <button 
                            type="button" 
                            onClick={() => handleAttachmentDelete(att.id)}
                            className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Resource File"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="isHomeworkCheck"
                  checked={assignIsHomework}
                  onChange={(e) => setAssignIsHomework(e.target.checked)}
                  className="bg-slate-900 border border-slate-800 rounded focus:ring-brand-500 h-4 w-4 text-brand-500"
                />
                <label htmlFor="isHomeworkCheck" className="text-xs text-slate-300">Mark as daily read/write homework</label>
              </div>
              <button type="submit" className="w-full glass-btn-primary text-xs">
                Publish Assignment
              </button>
            </form>
          </GlassCard>

          <div className="mt-8 space-y-4 max-w-4xl mx-auto">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Layers className="text-brand-500" size={16} />
              Manage Uploaded Assignments
            </h3>
            
            {assignmentsLoading ? (
              <p className="text-xs text-slate-500">Loading assignments...</p>
            ) : assignmentsList.length === 0 ? (
              <p className="text-xs text-slate-500 italic border border-slate-850/50 bg-slate-900/20 p-4 rounded-xl text-center">No assignments published yet.</p>
            ) : (
              <div className="overflow-x-auto bg-slate-900/10 border border-slate-850/50 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 font-bold">
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Class</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">Due Date</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {assignmentsList.map(a => (
                      <tr key={a.id} className="hover:bg-slate-900/10 text-slate-200">
                        <td className="py-3 px-4 font-semibold">
                          <div>
                            <p>{a.title}</p>
                            {a.attachments && a.attachments.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {a.attachments.map((att) => (
                                  <a 
                                    key={att.id}
                                    href={att.fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="text-[9px] text-slate-400 hover:text-brand-400 font-mono bg-slate-900/40 px-1.5 py-0.2 rounded border border-slate-800 flex items-center gap-0.5 shrink-0"
                                  >
                                    <Paperclip size={8} />
                                    <span className="truncate max-w-[80px]">{att.fileName}</span>
                                  </a>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{a.className}</td>
                        <td className="py-3 px-4 text-slate-400">{a.subjectName}</td>
                        <td className="py-3 px-4 text-slate-400">{new Date(a.dueDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${a.isHomework ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'}`}>
                            {a.isHomework ? 'Homework' : 'Assignment'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <button 
                            onClick={() => {
                              setEditingAssignment(a);
                              setEditAssignTitle(a.title);
                              setEditAssignDesc(a.description);
                              setEditAssignDueDate(new Date(a.dueDate).toISOString().slice(0, 16));
                              setEditAssignIsHomework(a.isHomework);
                              setEditAssignSectionId(a.sectionId || '');
                              setAttachmentsList(a.attachments || []);
                            }}
                            className="px-2 py-1 bg-brand-500/10 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 rounded-md font-semibold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteAssignment(a.id)}
                            className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-md font-semibold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
        </PremiumLock>
      )}

      {activeTab === 'quizzes' && (
        <PremiumLock 
          isLocked={!ent.hasQuizzes}
          requiredTier="Pro"
          featureName="Interactive MCQ Online Quizzes"
        >
          <div className="space-y-6 animate-fade-in">
            <div>
              <h3 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                <PenTool className="text-brand-500" size={24} />
                Interactive MCQ Online Quizzes
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Build online multiple-choice tests and view student attempt grades in real time.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Quiz Builder */}
              <div className="lg:col-span-1">
                <GlassCard className="space-y-4">
                  <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <PlusCircle className="text-brand-500" size={16} />
                    Create New MCQ Quiz
                  </h3>

                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quiz Title</label>
                      <input 
                        type="text"
                        placeholder="e.g. Spacetime Physics MCQ"
                        value={quizTitle}
                        onChange={(e) => setQuizTitle(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Duration (Minutes)</label>
                      <input 
                        type="number"
                        value={quizDuration}
                        onChange={(e) => setQuizDuration(parseInt(e.target.value) || 15)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="p-3 bg-slate-950/40 border border-slate-850 rounded-xl space-y-2">
                      <h4 className="text-xs font-semibold text-slate-200">Added Questions ({quizQuestions.length})</h4>
                      <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                        {quizQuestions.length === 0 ? (
                          <p className="text-[10px] text-slate-500 italic">No questions added yet. Use form on right.</p>
                        ) : (
                          quizQuestions.map((q, idx) => (
                            <div key={idx} className="text-[10px] text-slate-400 truncate">
                              {idx + 1}. {q.question} ({q.marks}m)
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <button 
                      onClick={handleCreateQuiz}
                      disabled={!quizTitle.trim() || quizQuestions.length === 0}
                      className="w-full glass-btn-primary text-xs disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Publish Quiz & Deploy
                    </button>
                  </div>

                  {/* Add single question */}
                  <form onSubmit={handleAddQuizQuestion} className="bg-slate-900/20 border border-slate-850 p-3 rounded-2xl space-y-3 mt-4">
                    <h4 className="text-xs font-semibold text-slate-200">Add Question</h4>
                    <div className="space-y-1">
                      <input 
                        type="text" 
                        placeholder="Question string..." 
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded p-1.5 text-[11px] text-slate-200 focus:outline-none"
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Option A" value={qOpt1} onChange={(e) => setQOpt1(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200" required />
                      <input type="text" placeholder="Option B" value={qOpt2} onChange={(e) => setQOpt2(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200" required />
                      <input type="text" placeholder="Option C (Opt)" value={qOpt3} onChange={(e) => setQOpt3(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200" />
                      <input type="text" placeholder="Option D (Opt)" value={qOpt4} onChange={(e) => setQOpt4(e.target.value)} className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-slate-200" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[8px] text-slate-500 block uppercase">Correct Index</label>
                        <select value={qCorrect} onChange={(e) => setQCorrect(parseInt(e.target.value))} className="bg-slate-950 border border-slate-800 text-[10px] rounded p-1 w-full">
                          <option value={0}>Option A</option>
                          <option value={1}>Option B</option>
                          <option value={2}>Option C</option>
                          <option value={3}>Option D</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[8px] text-slate-500 block uppercase">Marks weight</label>
                        <input type="number" value={qMarks} onChange={(e) => setQMarks(parseInt(e.target.value) || 1)} className="bg-slate-950 border border-slate-800 text-[10px] rounded p-1 w-full" />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-slate-800 hover:bg-slate-750 text-slate-200 py-1.5 rounded font-semibold text-[10px] transition-colors">
                      Add to Question List
                    </button>
                  </form>
                </GlassCard>
              </div>

              {/* Published Quizzes & Attempts */}
              <div className="lg:col-span-2 space-y-6">
                <GlassCard className="space-y-4">
                  <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <Clipboard className="text-brand-500" size={16} />
                    Published Quizzes & Student Performance
                  </h3>

                  {quizzesLoading ? (
                    <div className="text-center py-12 text-slate-400 italic text-sm">
                      Loading quizzes...
                    </div>
                  ) : quizzesList.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 italic text-sm">
                      No quizzes published by you yet. Use the creator form on the left.
                    </div>
                  ) : (
                    <div className="overflow-x-auto bg-slate-900/10 border border-slate-850/50 rounded-2xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-400 font-bold">
                            <th className="py-3 px-4">Quiz Title</th>
                            <th className="py-3 px-4">Duration</th>
                            <th className="py-3 px-4">Total Marks</th>
                            <th className="py-3 px-4">Attempts</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/60">
                          {quizzesList.map(quiz => {
                            const quizAttempts = mockDb.quizAttempts.filter(a => a.quizId === quiz.id);
                            return (
                              <tr key={quiz.id} className="hover:bg-slate-900/10 text-slate-200">
                                <td className="py-3 px-4 font-semibold">{quiz.title}</td>
                                <td className="py-3 px-4 text-slate-400">{quiz.durationMinutes} mins</td>
                                <td className="py-3 px-4 text-slate-400">{quiz.totalMarks} pts</td>
                                <td className="py-3 px-4">
                                  <button
                                    onClick={() => setSelectedQuizForAttempts(quiz)}
                                    className="px-2 py-0.5 rounded-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 font-bold active:scale-95 transition-all cursor-pointer text-[10px]"
                                  >
                                    {quizAttempts.length} Attempts
                                  </button>
                                </td>
                                <td className="py-3 px-4 text-right space-x-2">
                                  <button
                                    onClick={() => {
                                      setEditingQuiz(quiz);
                                      setEditQuizTitle(quiz.title);
                                      setEditQuizDuration(quiz.durationMinutes);
                                    }}
                                    className="px-2 py-1 bg-brand-500/10 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 rounded-md font-semibold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Edit3 size={11} /> Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteQuiz(quiz.id)}
                                    className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-md font-semibold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Trash2 size={11} /> Delete
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </GlassCard>
              </div>
            </div>
          </div>
        </PremiumLock>
      )}
      {activeTab === 'materials' && (
        <PremiumLock
          isLocked={!ent.hasLibraryAccess}
          requiredTier="Enterprise"
          featureName="Study Materials Upload"
          customMessage="This feature is available only with an active Enterprise Subscription. Please contact your School Administrator."
        >
          <GlassCard className="space-y-4 max-w-xl mx-auto">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <UploadCloud className="text-brand-500" size={16} />
              Publish Class Notes, PDFs, and MP4 Videos
            </h3>

            <form onSubmit={handleUploadMaterial} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource Title</label>
                <input 
                  type="text"
                  placeholder="e.g. Spacetime Curvature Video Lecture"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                  disabled={materialUploading}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource Description</label>
                <textarea 
                  placeholder="Summarize the core syllabus contents covered..."
                  rows={2}
                  value={materialDesc}
                  onChange={(e) => setMaterialDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  disabled={materialUploading}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Format</label>
                  <select 
                    value={materialType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setMaterialType(val);
                      if (val === 'stream' || val === 'mp4') {
                        setMaterialStreamable(true);
                      } else {
                        setMaterialStreamable(false);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                    disabled={materialUploading}
                  >
                    <option value="pdf">PDF Handbook</option>
                    <option value="docx">Word Docx</option>
                    <option value="mp4">MP4 Video Clip</option>
                    <option value="stream">Live Stream / External Video</option>
                  </select>
                </div>
                {materialType === 'stream' ? (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource Live Link</label>
                    <input 
                      type="text"
                      placeholder="https://youtube.com/..."
                      value={materialUrl}
                      onChange={(e) => setMaterialUrl(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                      disabled={materialUploading}
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select File (Max 100MB)</label>
                    <input 
                      type="file"
                      accept={
                        materialType === 'pdf' ? '.pdf' :
                        materialType === 'docx' ? '.docx' :
                        'video/*'
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setMaterialFile(file);
                      }}
                      className="w-full text-slate-300 text-xs bg-slate-900 border border-slate-800 rounded-lg p-1.5 focus:outline-none file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-[10px] file:font-semibold file:bg-brand-500/10 file:text-brand-400 file:cursor-pointer"
                      required
                      disabled={materialUploading}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="isStreamCheck"
                  checked={materialStreamable}
                  onChange={(e) => setMaterialStreamable(e.target.checked)}
                  className="bg-slate-900 border border-slate-800 rounded h-4 w-4 text-brand-500 focus:ring-brand-500"
                  disabled={materialUploading || materialType === 'stream' || materialType === 'mp4'}
                />
                <label htmlFor="isStreamCheck" className="text-xs text-slate-300">Mark as streamable in-browser lecture video</label>
              </div>
              <button 
                type="submit" 
                className="w-full glass-btn-primary text-xs flex items-center justify-center gap-2"
                disabled={materialUploading}
              >
                {materialUploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Uploading & encrypting to storage node...
                  </>
                ) : (
                  'Upload study files'
                )}
              </button>
            </form>
          </GlassCard>

          <div className="mt-8 space-y-4 max-w-4xl mx-auto">
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Layers className="text-brand-500" size={16} />
              Manage Uploaded Materials
            </h3>
            
            {materialsLoading ? (
              <p className="text-xs text-slate-500">Loading materials...</p>
            ) : materialsList.length === 0 ? (
              <p className="text-xs text-slate-500 italic border border-slate-850/50 bg-slate-900/20 p-4 rounded-xl text-center">No study materials uploaded yet.</p>
            ) : (
              <div className="overflow-x-auto bg-slate-900/10 border border-slate-850/50 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 font-bold">
                      <th className="py-3 px-4">Title</th>
                      <th className="py-3 px-4">Subject</th>
                      <th className="py-3 px-4">File Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/60">
                    {materialsList.map(m => (
                      <tr key={m.id} className="hover:bg-slate-900/10 text-slate-200">
                        <td className="py-3 px-4 font-semibold">
                          <div>
                            <p>{m.title}</p>
                            <p className="text-[10px] text-slate-500 font-normal line-clamp-1">{m.description}</p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-slate-400">{m.subjectName}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            m.fileType === 'pdf' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
                            m.fileType === 'mp4' ? 'bg-brand-500/10 text-brand-400 border border-brand-500/20' : 
                            'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          }`}>
                            {m.fileType}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {m.isVideoStreamable ? (
                            <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-450">
                              <Video size={10} /> Streamable
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-500">Standard File</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2">
                          <a 
                            href={m.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="px-2 py-1 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded-md font-semibold inline-flex items-center gap-1 active:scale-95 transition-all text-[11px]"
                          >
                            <Eye size={11} /> View
                          </a>
                          <button 
                            onClick={() => {
                              setEditingMaterial(m);
                              setEditMatTitle(m.title);
                              setEditMatDesc(m.description || '');
                              setEditMatUrl(m.fileUrl);
                              setEditMatType(m.fileType);
                              setEditMatStreamable(m.isVideoStreamable);
                            }}
                            className="px-2 py-1 bg-brand-500/10 hover:bg-brand-500/25 border border-brand-500/30 text-brand-400 rounded-md font-semibold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <Edit3 size={11} /> Edit
                          </button>
                          <button 
                            onClick={() => handleDeleteMaterial(m.id)}
                            className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-md font-semibold inline-flex items-center gap-1 active:scale-95 transition-all cursor-pointer"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </PremiumLock>
      )}

      {activeTab === 'forums' && (
        <PremiumLock 
          isLocked={!ent.hasCommunications} 
          requiredTier="Basic" 
          featureName="Communications & Forums"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Left Column - Category List */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Layers className="text-brand-500" size={18} />
                    Forums & Boards
                  </h3>
                  <button 
                    onClick={() => {
                      setEditingCategory(null);
                      setCatName('');
                      setCatDesc('');
                      setCatClassId('');
                      setCatSubjectId('');
                      setShowCreateCategory(true);
                    }}
                    className="p-1 hover:bg-slate-800 rounded-lg text-brand-400 hover:text-brand-300 transition-colors"
                    title="Create Board"
                  >
                    <PlusCircle size={20} />
                  </button>
                </div>

                <div className="overflow-x-auto bg-slate-900/10 border border-slate-850/50 rounded-xl">
                  {forumCategories.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">No active boards. Create one to begin!</div>
                  ) : (
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 font-bold">
                          <th className="py-2.5 px-3">Board</th>
                          <th className="py-2.5 px-3">Scope</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60">
                        {forumCategories.map(cat => {
                          const classObj = mockDb.classes.find(c => c.id === cat.classId);
                          const subObj = mockDb.subjects.find(s => s.id === cat.subjectId);
                          const isSelected = selectedCategory?.id === cat.id;
                          return (
                            <tr 
                              key={cat.id} 
                              onClick={() => {
                                setSelectedCategory(cat);
                                setSelectedPost(null);
                              }}
                              className={`hover:bg-slate-900/10 cursor-pointer transition-colors ${
                                isSelected ? 'bg-brand-600/10 text-brand-400 font-semibold' : 'text-slate-200'
                              }`}
                            >
                              <td className="py-2.5 px-3">
                                <div>
                                  <p className="font-bold">{cat.name}</p>
                                  <p className="text-[9px] text-slate-500 line-clamp-1 font-normal">{cat.description}</p>
                                </div>
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="flex flex-col gap-0.5">
                                  {classObj && (
                                    <span className="text-[8px] font-bold text-indigo-400">
                                      {classObj.name}
                                    </span>
                                  )}
                                  {subObj && (
                                    <span className="text-[8px] font-bold text-emerald-450">
                                      {subObj.name}
                                    </span>
                                  )}
                                  {!classObj && !subObj && (
                                    <span className="text-[8px] font-bold text-slate-500">General</span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2.5 px-3 text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={() => handleEditCategory(cat)}
                                  className="p-1 hover:bg-slate-850 text-slate-400 hover:text-slate-200 rounded transition-colors cursor-pointer"
                                  title="Edit Board"
                                >
                                  <Edit3 size={11} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="p-1 hover:bg-slate-800 text-red-400 hover:text-red-300 rounded transition-colors cursor-pointer"
                                  title="Delete Board"
                                >
                                  <Trash2 size={11} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </GlassCard>
            </div>

            {/* Right Column - Posts and replies inside selected Category */}
            <div className="lg:col-span-2 space-y-6">
              {selectedCategory ? (
                selectedPost ? (
                  // Deep thread view
                  <GlassCard className="space-y-6">
                    <button 
                      onClick={() => setSelectedPost(null)}
                      className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                    >
                      &larr; Back to category threads
                    </button>
                    
                    <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-100 text-sm">{selectedPost.title}</h4>
                        <span className="text-[10px] text-slate-500">{new Date(selectedPost.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{selectedPost.content}</p>
                      <p className="text-[10px] text-slate-500">Posted by: {selectedPost.authorName}</p>
                    </div>

                    <div className="space-y-4">
                      <h5 className="font-semibold text-slate-200 text-xs">Replies & Comments</h5>
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {postReplies.length === 0 ? (
                          <div className="text-center py-6 text-slate-500 text-xs">No answers posted yet. Write one below!</div>
                        ) : (
                          postReplies.map(r => (
                            <div key={r.id} className="p-3 bg-slate-900/20 border border-slate-850 rounded-xl space-y-1">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-semibold text-slate-200 text-xs">{r.authorName}</span>
                                <span className="text-[9px] uppercase tracking-wider text-slate-500">{r.authorRole}</span>
                              </div>
                              <p className="text-xs text-slate-300 leading-relaxed">{r.content}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <form onSubmit={handleForumReplySubmit} className="space-y-3">
                      <textarea 
                        placeholder="Write a professional review or answer..."
                        rows={3}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-xs text-slate-100 rounded-xl p-3 focus:outline-none focus:border-brand-500 transition-colors"
                        required
                      />
                      <button type="submit" className="glass-btn-primary text-xs">
                        Publish Comment
                      </button>
                    </form>
                  </GlassCard>
                ) : (
                  // Threads listing & Thread Creator
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="md:col-span-2">
                      <GlassCard className="space-y-4">
                        <h3 className="font-bold text-slate-100 border-b border-slate-850 pb-3 flex items-center gap-2">
                          <MessageSquare className="text-brand-500" size={16} />
                          Discussions: {selectedCategory.name}
                        </h3>

                        <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                          {forumPosts.filter(p => p.categoryId === selectedCategory.id).length === 0 ? (
                            <div className="text-center py-12 text-slate-500 text-xs">No active discussions in this board yet.</div>
                          ) : (
                            forumPosts
                              .filter(p => p.categoryId === selectedCategory.id)
                              .map(p => (
                                <div 
                                  key={p.id}
                                  onClick={() => handleSelectPost(p)}
                                  className="p-3 bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-xl cursor-pointer transition-all"
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-brand-400 truncate">{p.authorName}</span>
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                      <MessageCircle size={10} />
                                      {p.repliesCount}
                                    </span>
                                  </div>
                                  <h4 className="font-semibold text-slate-200 text-xs truncate">{p.title}</h4>
                                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">{p.content}</p>
                                </div>
                              ))
                          )}
                        </div>
                      </GlassCard>
                    </div>

                    <div>
                      <GlassCard className="space-y-4">
                        <h4 className="font-bold text-slate-200 text-xs">Start New Discussion Thread</h4>
                        <form onSubmit={handleCreateForumPost} className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Post Title</label>
                            <input 
                              type="text"
                              placeholder="e.g., Announcement regarding Midterm exam content"
                              value={newPostTitle}
                              onChange={(e) => setNewPostTitle(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                              required
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Post Content</label>
                            <textarea 
                              placeholder="Details, announcements, or equations to discuss..."
                              rows={4}
                              value={newPostContent}
                              onChange={(e) => setNewPostContent(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                              required
                            />
                          </div>
                          <button type="submit" className="w-full glass-btn-primary text-xs">
                            Publish Thread
                          </button>
                        </form>
                      </GlassCard>
                    </div>
                  </div>
                )
              ) : (
                <GlassCard className="flex flex-col items-center justify-center text-center py-16 space-y-3">
                  <div className="w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center text-brand-500 text-lg border border-slate-800/80 animate-pulse">💬</div>
                  <div>
                    <h4 className="font-bold text-slate-200 text-sm">No board selected</h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm">Select an active discussion board from the sidebar to inspect topics, answer parent queries, or broadcast class announcements!</p>
                  </div>
                </GlassCard>
              )}
            </div>
          </div>

          {/* Create / Edit category modal */}
          {showCreateCategory && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
              <GlassCard className="w-full max-w-md space-y-6">
                <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-100 text-sm">
                    {editingCategory ? 'Modify Discussion Board' : 'Create Discussion Board'}
                  </h4>
                  <button 
                    onClick={() => {
                      setShowCreateCategory(false);
                      setEditingCategory(null);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-200"
                  >
                    Close
                  </button>
                </div>

                <form onSubmit={handleCreateCategorySubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Board Name</label>
                    <input 
                      type="text"
                      placeholder="e.g. Grade 10-A Calculus Q&A"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
                    <textarea 
                      placeholder="Describe the topics and target audience for this forum..."
                      rows={3}
                      value={catDesc}
                      onChange={(e) => setCatDesc(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Link to Class (Optional)</label>
                      <select 
                        value={catClassId}
                        onChange={(e) => setCatClassId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                      >
                        <option value="">General (School Wide)</option>
                        {mockDb.classes.filter(c => c.schoolId === session?.user.schoolId).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Link to Subject (Optional)</label>
                      <select 
                        value={catSubjectId}
                        onChange={(e) => setCatSubjectId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                      >
                        <option value="">None (General)</option>
                        {mockDb.subjects.filter(s => s.schoolId === session?.user.schoolId).map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                    <button 
                      type="button" 
                      onClick={() => {
                        setShowCreateCategory(false);
                        setEditingCategory(null);
                      }}
                      className="glass-btn-secondary text-xs"
                    >
                      Cancel
                    </button>
                    <button type="submit" className="glass-btn-primary text-xs">
                      {editingCategory ? 'Update Board' : 'Establish Board'}
                    </button>
                  </div>
                </form>
              </GlassCard>
            </div>
          )}
        </PremiumLock>
      )}

      {/* Homework Grading Modal overlay */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-6 border-brand-500/25">
            <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-100">Grade Homework Submission</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Student: {gradingSubmission.studentName} | Task: {gradingSubmission.assignmentTitle}</p>
              </div>
              <button onClick={() => setGradingSubmission(null)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleGradingSubmit} className="space-y-4">
              {gradingSubmission.fileUrl && (
                <div className="space-y-1.5 p-3.5 bg-slate-950/60 border border-slate-850 rounded-xl">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Student's File Attachment</span>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 truncate">
                      <Paperclip size={14} className="text-brand-400 shrink-0" />
                      <span className="text-xs text-slate-300 truncate" title={gradingSubmission.fileUrl}>
                        {gradingSubmission.fileUrl.split('/').pop()?.split('_').slice(2).join('_') || 'attachment'}
                      </span>
                    </div>
                    <a 
                      href={gradingSubmission.fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="glass-btn-primary py-1 px-3 text-[10px] inline-flex items-center gap-1 shrink-0"
                    >
                      <Eye size={12} /> View / Download
                    </a>
                  </div>
                  {/\.(jpg|jpeg|png)$/i.test(gradingSubmission.fileUrl) && (
                    <div className="mt-2.5 border border-slate-800 rounded-lg overflow-hidden max-h-48 flex items-center justify-center bg-slate-900/50">
                      <img 
                        src={gradingSubmission.fileUrl} 
                        alt="Submission Preview" 
                        className="max-h-48 object-contain" 
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Marks Scored (Max {gradingSubmission.maxMarks})</label>
                <input 
                  type="number" 
                  max={gradingSubmission.maxMarks}
                  value={gradesScore}
                  onChange={(e) => setGradesScore(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Constructive Feedback Remarks</label>
                <textarea 
                  placeholder="Excellent derivations, pay attention to syntax in pointers..."
                  rows={3}
                  value={gradesFeedback}
                  onChange={(e) => setGradesFeedback(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setGradingSubmission(null)}
                  className="glass-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" className="glass-btn-primary text-xs">
                  Lock Grade
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Class Teacher Add Student Modal */}
      {showCTAddStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <PlusCircle className="text-brand-500" size={15} />
                Register Student to Class
              </h4>
              <button onClick={() => setShowCTAddStudent(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCTCreateStudent} className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input type="email" placeholder="student@aegis.com" value={ctStEmail} onChange={(e) => setCtStEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Account Password</label>
                <input type="text" placeholder="Secure password (e.g. password)" value={ctStPassword} onChange={(e) => setCtStPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" placeholder="First Name" value={ctStFirst} onChange={(e) => setCtStFirst(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" placeholder="Last Name" value={ctStLast} onChange={(e) => setCtStLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Admission Number</label>
                <input type="text" placeholder="e.g. ADM2025001" value={ctStAdmission} onChange={(e) => setCtStAdmission(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Roll Number</label>
                <input type="number" value={ctStRoll} onChange={(e) => setCtStRoll(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required min={1} />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Gender</label>
                <select value={ctStGender} onChange={(e) => setCtStGender(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-200 focus:outline-none">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Date of Birth</label>
                <input type="date" value={ctStDob} onChange={(e) => setCtStDob(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 text-slate-100 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone</label>
                <input type="text" placeholder="+1 (555) 000-0000" value={ctStPhone} onChange={(e) => setCtStPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-100" />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowCTAddStudent(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Register Student</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Class Teacher Add Parent Modal */}
      {showCTAddParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Register Parent Account</h4>
              <button onClick={() => setShowCTAddParent(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCTCreateParent} className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input type="email" placeholder="parent@aegis.com" value={ctPrEmail} onChange={(e) => setCtPrEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Occupation</label>
                <input type="text" placeholder="Architect, Doctor, etc." value={ctPrOccup} onChange={(e) => setCtPrOccup(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Account Password</label>
                <input type="text" placeholder="Secure password (e.g. password)" value={ctPrPassword} onChange={(e) => setCtPrPassword(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" placeholder="First Name" value={ctPrFirst} onChange={(e) => setCtPrFirst(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" placeholder="Last Name" value={ctPrLast} onChange={(e) => setCtPrLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Home Address</label>
                <input type="text" placeholder="100 Silicon Valley Way" value={ctPrAddr} onChange={(e) => setCtPrAddr(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone</label>
                <input type="text" placeholder="+1 (555) 000-0000" value={ctPrPhone} onChange={(e) => setCtPrPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
                <label className="text-[9px] font-bold uppercase tracking-wider text-amber-500 mt-2">Emergency Contact Phone</label>
                <input type="text" placeholder="+91 98765 43210" value={ctPrEmergencyPhone} onChange={(e) => setCtPrEmergencyPhone(e.target.value)} className="w-full bg-slate-900 border border-amber-900/40 text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500/60 text-slate-100" />
              </div>

              {/* Secure Student Link verification panel */}
              <div className="col-span-1 sm:col-span-2 p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3 mt-1">
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest leading-none">Secure Student Ward Linking</p>
                <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">Select your child ward and enter their exact school Admission Number to securely verify and establish the guardian mapping.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Choose Student Ward</label>
                    <select 
                      value={ctPrStudentId} 
                      onChange={(e) => setCtPrStudentId(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full text-slate-200 focus:outline-none focus:border-brand-500"
                      required
                    >
                      <option value="">-- Choose Student --</option>
                      {mockDb.students.filter(s => s.classId === selectedManagedClass).map(s => {
                        const u = mockDb.users.find(usr => usr.id === s.userId);
                        if (!u) return null;
                        return (
                          <option key={s.id} value={s.id}>{u.firstName} {u.lastName}</option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Admission Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. ADM2025001" 
                      value={ctPrAdmissionNum} 
                      onChange={(e) => setCtPrAdmissionNum(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                      required
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Relationship</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Father, Mother" 
                      value={ctPrRelation} 
                      onChange={(e) => setCtPrRelation(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowCTAddParent(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Register Guardian</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Edit Assignment Modal overlay */}
      {editingAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-6 border-brand-500/25">
            <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-100">Edit Assignment</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Task: {editingAssignment.title}</p>
              </div>
              <button onClick={() => { setEditingAssignment(null); setAttachmentsList([]); }} className="text-xs text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditAssignment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Task Title</label>
                <input 
                  type="text"
                  value={editAssignTitle}
                  onChange={(e) => setEditAssignTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Problem Description</label>
                <textarea 
                  rows={4}
                  value={editAssignDesc}
                  onChange={(e) => setEditAssignDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Due Date</label>
                <input 
                  type="datetime-local"
                  value={editAssignDueDate}
                  onChange={(e) => setEditAssignDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              {availableSections.length > 0 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Section</label>
                  <select 
                    value={editAssignSectionId}
                    onChange={(e) => setEditAssignSectionId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                    required
                  >
                    {availableSections.map(sec => (
                      <option key={sec.id} value={sec.id}>Section {sec.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Premium Attachment Uploader Section */}
              <div className="space-y-2.5 pt-2 border-t border-slate-850">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Homework Resource Attachments</label>
                
                {/* Drag and Drop Zone */}
                {!attachmentUploading ? (
                  <div 
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleAttachmentUpload(e.dataTransfer.files[0], editingAssignment.id);
                      }
                    }}
                    onClick={() => document.getElementById(`teacher-file-picker-${editingAssignment.id}`)?.click()}
                    className="border-2 border-dashed border-slate-850 hover:border-brand-500/50 hover:bg-brand-500/5 rounded-xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all duration-300 group"
                  >
                    <input 
                      type="file" 
                      id={`teacher-file-picker-${editingAssignment.id}`} 
                      className="hidden" 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleAttachmentUpload(e.target.files[0], editingAssignment.id);
                        }
                      }}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.zip,.mp4"
                    />
                    <UploadCloud size={24} className="text-slate-500 group-hover:text-brand-400 group-hover:scale-110 transition-all duration-300 shrink-0" />
                    <p className="text-xs font-semibold text-slate-300">Drag & drop resource here, or <span className="text-brand-400 hover:underline">browse</span></p>
                    <p className="text-[9px] text-slate-500 font-medium">Supports PDF, DOCX, ZIP, JPG, PNG, MP4 up to 50MB</p>
                  </div>
                ) : (
                  /* Uploading Indicator */
                  <div className="border border-slate-800 bg-slate-950/40 rounded-xl p-4 flex flex-col gap-2.5">
                    <div className="flex items-center gap-3">
                      <Loader2 size={18} className="text-brand-400 animate-spin shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-300 truncate">Uploading attachment...</p>
                        <p className="text-[9px] text-slate-500">Securing resource file in Supabase CDN</p>
                      </div>
                      <span className="text-xs font-bold text-brand-400 font-mono shrink-0">{attachmentProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-brand-500 h-full rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]" 
                        style={{ width: `${attachmentProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Alert */}
                {attachmentError && (
                  <div className="p-3 bg-red-500/5 border border-red-500/15 rounded-lg flex items-start gap-2 animate-fade-in">
                    <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold text-slate-300 uppercase tracking-wide">Upload Failed</p>
                      <p className="text-[9.5px] text-red-400 mt-0.5">{attachmentError}</p>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setAttachmentError('')}
                      className="text-[9px] font-bold text-slate-500 hover:text-slate-300 uppercase font-mono tracking-widest"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Uploaded Attachments Grid/List */}
                {attachmentsList.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 mt-2">
                    {attachmentsList.map((att) => (
                      <div key={att.id} className="border border-slate-850 bg-slate-950/40 hover:bg-slate-950/65 rounded-xl p-3 flex items-center justify-between gap-3 transition-colors animate-fade-in group/item">
                        <div className="flex items-center gap-2 truncate">
                          <Paperclip size={14} className="text-brand-400 shrink-0" />
                          <span className="text-xs text-slate-300 truncate" title={att.fileName}>
                            {att.fileName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <a 
                            href={att.fileUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-colors"
                            title="View File"
                          >
                            <Eye size={13} />
                          </a>
                          <button 
                            type="button" 
                            onClick={() => handleAttachmentDelete(att.id)}
                            className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                            title="Delete Resource File"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="editIsHomeworkCheck"
                  checked={editAssignIsHomework}
                  onChange={(e) => setEditAssignIsHomework(e.target.checked)}
                  className="bg-slate-900 border border-slate-800 rounded focus:ring-brand-500 h-4 w-4 text-brand-500"
                />
                <label htmlFor="editIsHomeworkCheck" className="text-xs text-slate-300">Mark as daily read/write homework</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setEditingAssignment(null); setAttachmentsList([]); }} className="flex-1 glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="flex-1 glass-btn-primary text-xs">Save Changes</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Edit Study Material Modal overlay */}
      {editingMaterial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-6 border-brand-500/25">
            <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-100">Edit Study Material</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Resource: {editingMaterial.title}</p>
              </div>
              <button onClick={() => setEditingMaterial(null)} className="text-xs text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditMaterial} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource Title</label>
                <input 
                  type="text"
                  value={editMatTitle}
                  onChange={(e) => setEditMatTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource Description</label>
                <textarea 
                  rows={2}
                  value={editMatDesc}
                  onChange={(e) => setEditMatDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource File Link</label>
                  <input 
                    type="text"
                    value={editMatUrl}
                    onChange={(e) => setEditMatUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Format</label>
                  <select 
                    value={editMatType}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setEditMatType(val);
                      if (val === 'stream' || val === 'mp4') {
                        setEditMatStreamable(true);
                      } else {
                        setEditMatStreamable(false);
                      }
                    }}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="pdf">PDF Handbook</option>
                    <option value="docx">Word Docx</option>
                    <option value="mp4">MP4 Video Clip</option>
                    <option value="stream">Live Stream / External Video</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="editIsStreamCheck"
                  checked={editMatStreamable}
                  onChange={(e) => setEditMatStreamable(e.target.checked)}
                  className="bg-slate-900 border border-slate-800 rounded h-4 w-4 text-brand-500 focus:ring-brand-500"
                  disabled={editMatType === 'stream' || editMatType === 'mp4'}
                />
                <label htmlFor="editIsStreamCheck" className="text-xs text-slate-300">Mark as streamable in-browser lecture video</label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingMaterial(null)} className="flex-1 glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="flex-1 glass-btn-primary text-xs">Save Changes</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Edit Quiz Modal overlay */}
      {editingQuiz && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-6 border-brand-500/25">
            <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-100">Edit Quiz</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Quiz: {editingQuiz.title}</p>
              </div>
              <button onClick={() => setEditingQuiz(null)} className="text-xs text-slate-400 hover:text-slate-200">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleEditQuiz} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quiz Title</label>
                <input 
                  type="text"
                  value={editQuizTitle}
                  onChange={(e) => setEditQuizTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Duration (Minutes)</label>
                <input 
                  type="number"
                  value={editQuizDuration}
                  onChange={(e) => setEditQuizDuration(parseInt(e.target.value) || 15)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setEditingQuiz(null)} className="flex-1 glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="flex-1 glass-btn-primary text-xs">Save Changes</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Quiz Attempts Modal Overlay */}
      {selectedQuizForAttempts && (() => {
        const quizAttempts = mockDb.quizAttempts.filter(a => a.quizId === selectedQuizForAttempts.id);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
            <GlassCard className="w-full max-w-2xl space-y-6 border-brand-500/25">
              <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-100">Student Attempts & Performance</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Quiz: {selectedQuizForAttempts.title} | {quizAttempts.length} Total Attempts</p>
                </div>
                <button onClick={() => setSelectedQuizForAttempts(null)} className="text-xs text-slate-400 hover:text-slate-200">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {quizAttempts.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-6 text-center">No student has attempted this quiz yet.</p>
                ) : (
                  <div className="overflow-x-auto bg-slate-900/20 border border-slate-850/60 rounded-xl">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 font-bold uppercase tracking-wider">
                          <th className="py-2.5 px-3">Student Name</th>
                          <th className="py-2.5 px-3">Marks Scored</th>
                          <th className="py-2.5 px-3">Correct Ans</th>
                          <th className="py-2.5 px-3">Incorrect Ans</th>
                          <th className="py-2.5 px-3">Attempt Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-300">
                        {quizAttempts.map(attempt => {
                          const student = mockDb.students.find(s => s.id === attempt.studentId);
                          const studentUser = student ? mockDb.users.find(u => u.id === student.userId) : null;
                          const name = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Unknown Student';

                          // Calculate correct/incorrect counts
                          const questions = mockDb.quizQuestions.filter(q => q.quizId === selectedQuizForAttempts.id);
                          let correctCount = 0;
                          let incorrectCount = 0;
                          questions.forEach(q => {
                            const ans = attempt.answers ? attempt.answers[q.id] : undefined;
                            if (ans !== undefined && ans === q.correctOption) {
                              correctCount++;
                            } else {
                              incorrectCount++;
                            }
                          });

                          return (
                            <tr key={attempt.id} className="hover:bg-slate-900/15">
                              <td className="py-2.5 px-3 font-semibold text-slate-200">{name}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-100">{attempt.score} / {selectedQuizForAttempts.totalMarks}</td>
                              <td className="py-2.5 px-3 text-green-400 font-bold">{correctCount}</td>
                              <td className="py-2.5 px-3 text-red-400 font-bold">{incorrectCount}</td>
                              <td className="py-2.5 px-3 text-slate-500 font-mono">{new Date(attempt.attemptedAt).toLocaleDateString()}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <button type="button" onClick={() => setSelectedQuizForAttempts(null)} className="glass-btn-secondary text-xs cursor-pointer">Close</button>
              </div>
            </GlassCard>
          </div>
        );
      })()}

      {/* Class Timetable Edit Modal Overlay */}
      {isEditingManagedTt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-lg space-y-6 border-brand-500/20 shadow-2xl relative">
            <div className="flex justify-between items-center pb-3 border-b border-slate-800">
              <div>
                <h4 className="font-bold text-slate-100 uppercase tracking-widest text-xs flex items-center gap-2">
                  <Layers className="text-brand-500" size={16} />
                  Edit Timetable Lecture Period
                </h4>
                <p className="text-[10px] text-slate-400 mt-1">Modify scheduling information and instructor assignments in real time.</p>
              </div>
              <button 
                onClick={() => setIsEditingManagedTt(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateManagedTimetable} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Subject</label>
                  <select
                    value={editManagedSubject}
                    onChange={(e) => setEditManagedSubject(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Subject --</option>
                    {mockDb.subjects
                      .filter(s => s.schoolId === (session?.user.schoolId || mockDb.teachers.find(t => t.id === teacherId)?.schoolId))
                      .map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Assigned Teacher</label>
                  <select
                    value={editManagedTeacher}
                    onChange={(e) => setEditManagedTeacher(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                    required
                  >
                    <option value="">-- Choose Instructor --</option>
                    {(() => {
                      const sId = session?.user.schoolId || mockDb.teachers.find(t => t.id === teacherId)?.schoolId || '';
                      const schoolTeachers = mockDb.getSchoolTeachers(sId);
                      if (schoolTeachers.length === 0) {
                        return <option disabled>No active teachers found</option>;
                      }
                      return schoolTeachers.map(t => {
                        const u = mockDb.users.find(usr => usr.id === t.userId);
                        if (!u) return null;
                        return (
                          <option key={t.id} value={t.id}>
                            {u.firstName} {u.lastName} — {t.employeeId} ({t.specialization})
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Day</label>
                  <select
                    value={editManagedDay}
                    onChange={(e) => setEditManagedDay(parseInt(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-200 focus:outline-none"
                  >
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Classroom</label>
                  <input
                    type="text"
                    placeholder="e.g. Room 303"
                    value={editManagedClassroom}
                    onChange={(e) => setEditManagedClassroom(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Start Time</label>
                  <input
                    type="time"
                    value={editManagedStart}
                    onChange={(e) => setEditManagedStart(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">End Time</label>
                  <input
                    type="time"
                    value={editManagedEnd}
                    onChange={(e) => setEditManagedEnd(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-xs rounded-xl p-2 text-slate-100 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsEditingManagedTt(false)} 
                  className="flex-1 glass-btn-secondary text-xs py-2.5"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="flex-1 glass-btn-primary text-xs py-2.5"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
      {activeTab === 'analytics' && (
        <PremiumLock
          isLocked={!ent.hasAnalyticsAccess}
          requiredTier="Enterprise"
          featureName="Class Academic Analytics"
          customMessage="This feature is available only with an active Enterprise Subscription. Please contact your School Administrator."
        >
          <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Layers className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Class Academic Analytics</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Access daily attendance averages, homework submission graphs, and export grade report sheets locally.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select 
                value={analyticsDateRange} 
                onChange={(e) => setAnalyticsDateRange(e.target.value)}
                className="bg-slate-905 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="session">Current Term</option>
              </select>
            </div>
          </GlassCard>

          {/* 3 Custom CSS Charts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Attendance Chart */}
            {(() => {
              const att = getAttendanceStats();
              return (
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Class Attendance Ratios</span>
                    <span className="text-[10px] text-green-450 font-mono">
                      {att ? `Avg: ${att.overallPct.toFixed(1)}%` : 'No Data'}
                    </span>
                  </h4>
                  {!att ? (
                    <div className="h-40 flex items-center justify-center text-slate-500 text-xs italic">
                      No Data Available
                    </div>
                  ) : (
                    <div className="h-40 flex items-end justify-around gap-2 pt-4 pb-2 border-b border-slate-850">
                      {att.trends.map((t, idx) => (
                        <div key={idx} className="w-10 flex flex-col items-center gap-1.5 animate-fade-in">
                          <div className="w-full bg-slate-900 rounded h-28 relative overflow-hidden">
                            <div 
                              className="absolute bottom-0 left-0 right-0 bg-brand-600/80 rounded transition-all duration-300" 
                              style={{ height: `${t.percentage}%` }} 
                            />
                          </div>
                          <span className="text-[9px] font-mono text-slate-500" title={t.date}>{t.dayName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })()}

            {/* Homework Submissions Chart */}
            {(() => {
              const hw = getHomeworkStats();
              return (
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Homework Completion rates</span>
                    <span className="text-[10px] text-brand-400 font-mono">
                      {hw ? `${hw.totalAssignments} ${hw.totalAssignments === 1 ? 'Assignment' : 'Assignments'}` : 'No Data'}
                    </span>
                  </h4>
                  {!hw ? (
                    <div className="h-40 flex items-center justify-center text-slate-500 text-xs italic">
                      No Data Available
                    </div>
                  ) : (
                    <div className="h-40 flex flex-col justify-center gap-3 overflow-y-auto">
                      {hw.stats.map((item, idx) => (
                        <div key={item.id} className="space-y-1 animate-fade-in">
                          <div className="flex justify-between text-[10px] text-slate-450">
                            <span className="truncate w-32" title={item.title}>{item.title}</span>
                            <span className="font-bold text-slate-200">{item.percentage.toFixed(0)}% Done</span>
                          </div>
                          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-brand-500 rounded-full transition-all duration-300" 
                              style={{ width: `${item.percentage}%` }} 
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })()}

            {/* Class Marks Average */}
            {(() => {
              const qz = getQuizStats();
              return (
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Quiz & Online Test Averages</span>
                    <span className="text-[10px] text-indigo-400 font-mono">
                      {qz ? `Avg Score: ${qz.overallAvgScore.toFixed(1)}/${qz.overallTotalMarks.toFixed(0)}` : 'No Data'}
                    </span>
                  </h4>
                  {!qz ? (
                    <div className="h-40 flex items-center justify-center text-slate-500 text-xs italic">
                      No Data Available
                    </div>
                  ) : (
                    <div className="h-40 flex items-end justify-around gap-2 pt-4 pb-2 border-b border-slate-850 overflow-x-auto">
                      {qz.stats.map((item, idx) => (
                        <div key={item.id} className="w-12 flex flex-col items-center gap-1 animate-fade-in">
                          <div className="w-full bg-slate-900 rounded-t h-28 relative overflow-hidden">
                            <div 
                              className="absolute bottom-0 left-0 right-0 bg-indigo-500/80 transition-all duration-300" 
                              style={{ height: `${item.percentage}%` }} 
                            />
                          </div>
                          <span className="text-[9px] font-mono text-slate-500 truncate w-12" title={item.title}>{item.title}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })()}
          </div>

          {/* Action exporters */}
          <GlassCard className="space-y-4">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Layers className="text-brand-400" size={15} />
              Excel/CSV Registries Exporters & Report cards preview
            </h4>
            <p className="text-[10px] text-slate-400 leading-normal">Compile student grades and class roster schedules directly inside your browser cache and trigger local downloads instantly.</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button 
                onClick={exportClassRosterToCSV}
                className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 rounded-xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers size={14} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Export Class Directory</h5>
                  <p className="text-[9px] text-slate-500 mt-0.5">Spreadsheet of assigned roster</p>
                </div>
              </button>

              <button 
                onClick={exportClassGradesToCSV}
                className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 rounded-xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers size={14} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Export Student Grades</h5>
                  <p className="text-[9px] text-slate-500 mt-0.5">CSV report of term scores</p>
                </div>
              </button>

              <button 
                onClick={() => {
                  setShowReportCardPdf(true);
                  setSelectedRcStudent('');
                  setSelectedRcExam('');
                  setRcData(null);
                  setRcError('');
                }}
                className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 rounded-xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
              >
                <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <Layers size={14} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Print Report Cards</h5>
                  <p className="text-[9px] text-slate-500 mt-0.5">High fidelity printable PDF sheet</p>
                </div>
              </button>
            </div>
          </GlassCard>
        </div>
        </PremiumLock>
      )}

      {activeTab === 'ptm' && (
        <PremiumLock
          isLocked={isTabLockedByEntitlements('TEACHER', 'ptm', ent)}
          requiredTier="Pro"
          featureName="PTM Meetings"
        >
          <TeacherPTMManagement />
        </PremiumLock>
      )}

      {/* ── PAYMENT SETTINGS TAB ── */}
      {activeTab === 'paymentsettings' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-violet-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Banknote className="text-violet-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">My Banking & Payment Details</h3>
                <p className="text-[10px] text-slate-400 mt-0.5 font-sans">Manage your bank account details for salary disbursement. Data is encrypted and only visible to Finance Admin during payroll.</p>
              </div>
            </div>
            {fpMsg && (
              <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                fpMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              }`}>
                {fpMsg.text}
              </div>
            )}
          </GlassCard>



          {fpLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Bank Details Card */}
              <GlassCard className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                    <Banknote className="text-sky-400" size={15} />
                    Bank Account Details
                  </h4>
                  <button
                    onClick={() => {
                      setFpShowEdit(true);
                      setFpUpiId(fpSettings?.upiId || '');
                      setFpBankName(fpSettings?.bankName || '');
                      setFpAccNumber(fpSettings?.accountNumber || '');
                      setFpIfsc(fpSettings?.ifscCode || '');
                      setFpBranch(fpSettings?.branchName || '');
                    }}
                    className="text-xs font-bold text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors"
                  >
                    <Edit size={12} /> Edit
                  </button>
                </div>

                {fpSettings ? (
                  <div className="space-y-3">
                    {[
                      { label: 'Account Holder', value: `${session?.user.firstName || ''} ${session?.user.lastName || ''}`.trim() || '—' },
                      { label: 'Bank Name', value: fpSettings.bankName || '—' },
                      { label: 'Account Number', value: fpShowAccNumber ? (fpSettings.accountNumber || '—') : (fpSettings.accountNumber ? '•••• •••• ' + fpSettings.accountNumber.slice(-4) : '—') },
                      { label: 'IFSC Code', value: fpSettings.ifscCode || '—' },
                      { label: 'Branch', value: fpSettings.branchName || '—' },
                      { label: 'UPI ID', value: fpSettings.upiId || '—' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between py-2 border-b border-slate-850 last:border-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</span>
                        <span className="text-xs font-semibold text-slate-200 font-mono">{item.value}</span>
                      </div>
                    ))}
                    <button
                      onClick={() => setFpShowAccNumber(!fpShowAccNumber)}
                      className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {fpShowAccNumber ? <EyeOff size={11} /> : <Eye size={11} />}
                      {fpShowAccNumber ? 'Hide' : 'Show'} account number
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <Banknote className="mx-auto text-slate-700" size={32} />
                    <p className="text-slate-500 text-xs">No banking details added yet.</p>
                    <button
                      onClick={() => setFpShowEdit(true)}
                      className="glass-btn-primary text-xs mx-auto"
                    >
                      + Add Bank Details
                    </button>
                  </div>
                )}
              </GlassCard>

              {/* QR Code Card */}
              <GlassCard className="p-5 space-y-4">
                <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                  <QrCode className="text-violet-400" size={15} />
                  UPI QR Code
                </h4>
                <div
                  className="w-full h-48 rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500/50 transition-colors flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 overflow-hidden"
                  onClick={() => document.getElementById('fp-qr-upload')?.click()}
                >
                  {fpQrPreview ? (
                    <img src={fpQrPreview} alt="My QR Code" className="h-44 w-44 object-contain rounded-lg" />
                  ) : (
                    <div className="text-center space-y-1">
                      <ScanLine className="mx-auto text-slate-600" size={28} />
                      <p className="text-[11px] text-slate-500">Upload your UPI QR code</p>
                      <p className="text-[10px] text-slate-600">PNG, JPG up to 2MB</p>
                    </div>
                  )}
                </div>
                <input
                  id="fp-qr-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFpQrFile(file);
                      const reader = new FileReader();
                      reader.onload = (ev) => setFpQrPreview(ev.target?.result as string);
                      reader.readAsDataURL(file);
                      // Auto-save QR on upload
                      const userId = session?.user.id || '';
                      setFpSaving(true);
                      mockApi.saveFacultyPaymentSettings(userId, {
                        upiId: fpUpiId, bankName: fpBankName, accountNumber: fpAccNumber,
                        ifscCode: fpIfsc, branchName: fpBranch
                      }, file)
                        .then(s => { setFpSettings(s); setFpMsg({ type: 'success', text: '✓ QR code saved' }); setTimeout(() => setFpMsg(null), 3000); })
                        .catch(err => setFpMsg({ type: 'error', text: err?.message || 'Upload failed' }))
                        .finally(() => setFpSaving(false));
                    }
                  }}
                />
                <p className="text-[10px] text-slate-600 flex items-center gap-1">
                  <Shield size={10} className="text-slate-600" />
                  Your QR code is stored securely and only shared with Finance Admin during disbursement.
                </p>
              </GlassCard>
            </div>
          )}

          {/* Salary History */}
          <GlassCard className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Banknote className="text-emerald-400" size={15} /> Salary History
              </h4>
              <button
                onClick={async () => {
                  const schoolId = session?.user.schoolId || '';
                  const userId = session?.user.id || '';
                  if (schoolId && userId) {
                    try {
                      const ledger = await mockApi.getSalaryLedger(schoolId, userId);
                      setMySalaryLedger(ledger);
                    } catch (e) { console.warn(e); }
                  }
                }}
                className="text-xs font-bold text-slate-400 hover:text-slate-200 flex items-center gap-1 transition-colors"
              >
                <CheckCircle size={11} /> Refresh
              </button>
            </div>

            {mySalaryLedger.length === 0 ? (
              <div className="text-center py-8">
                <Banknote className="mx-auto text-slate-700 mb-2" size={28} />
                <p className="text-slate-500 text-xs">No salary records found.</p>
                <p className="text-slate-600 text-[10px] mt-0.5">Contact Finance Admin if your records are missing.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-850">
                      {['Month', 'Amount Disbursed', 'Payment Date', 'UTR Number', 'Status', 'Action'].map(h => (
                        <th key={h} className="text-left py-2 px-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {mySalaryLedger.map(rec => (
                      <tr key={rec.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="py-2.5 px-2 font-semibold text-slate-200">{rec.month || '—'}</td>
                        <td className="py-2.5 px-2 text-emerald-400 font-bold">₹{rec.amount.toLocaleString()}</td>
                        <td className="py-2.5 px-2 text-slate-300">{new Date(rec.paymentDate).toLocaleDateString()}</td>
                        <td className="py-2.5 px-2 text-slate-300 font-mono">{rec.utrNumber}</td>
                        <td className="py-2.5 px-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PAID</span>
                        </td>
                        <td className="py-2.5 px-2">
                          <button
                            onClick={() => {
                              // Generate a simple text-based payslip download from database ledger
                              const content = [
                                'SALARY PAYMENT SLIP',
                                '===================',
                                `Employee Name: ${session?.user.firstName || ''} ${session?.user.lastName || ''}`.trim(),
                                `Employee ID:   ${rec.employeeId}`,
                                `Month:         ${rec.month}`,
                                `Amount Paid:   ₹${(rec.amount || 0).toLocaleString()}`,
                                `Payment Date:  ${new Date(rec.paymentDate).toLocaleString()}`,
                                `UTR Number:    ${rec.utrNumber}`,
                                `Reference ID:  ${rec.id}`,
                                '',
                                'Status: PAID (Disbursed)',
                                '',
                                'Generated by AEGIS ERP Institutional Cloud'
                              ].join('\n');
                              const blob = new Blob([content], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `payslip_${rec.month.replace(/\s+/g, '_')}.txt`;
                              a.click();
                              URL.revokeObjectURL(url);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <Download size={11} /> Payslip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          {/* Security Notice */}
          <GlassCard className="p-4 border border-violet-500/10 bg-violet-500/5">
            <div className="flex items-start gap-3">
              <ShieldCheck className="text-violet-400 flex-shrink-0 mt-0.5" size={16} />
              <div>
                <p className="text-xs font-bold text-violet-300">End-to-End Encrypted Banking Data</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Your bank account number is AES-256 encrypted at rest. Only Finance Admin can access the full details during salary disbursement.
                  Your UPI ID and IFSC are masked in all other views.
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Edit Banking Details Modal */}
      {fpShowEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Banknote className="text-violet-400" size={15} />
                Update Banking Details
              </h4>
              <button onClick={() => setFpShowEdit(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Bank Name', val: fpBankName, set: setFpBankName, placeholder: 'e.g. State Bank of India' },
                { label: 'Account Number', val: fpAccNumber, set: setFpAccNumber, placeholder: 'Your account number' },
                { label: 'IFSC Code', val: fpIfsc, set: setFpIfsc, placeholder: 'e.g. SBIN0001234' },
                { label: 'Branch', val: fpBranch, set: setFpBranch, placeholder: 'e.g. Main Branch' },
                { label: 'UPI ID', val: fpUpiId, set: setFpUpiId, placeholder: 'e.g. name@oksbi' },
              ].map(f => (
                <div key={f.label}>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">{f.label}</label>
                  <input
                    type="text"
                    value={f.val}
                    onChange={e => f.set(e.target.value)}
                    placeholder={f.placeholder}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-colors"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-slate-850">
              <button onClick={() => setFpShowEdit(false)} className="glass-btn-secondary text-xs">Cancel</button>
              <button
                disabled={fpSaving}
                onClick={async () => {
                  setFpSaving(true);
                  setFpMsg(null);
                  try {
                    const userId = session?.user.id || '';
                    const saved = await mockApi.saveFacultyPaymentSettings(
                      userId,
                      { upiId: fpUpiId, bankName: fpBankName, accountNumber: fpAccNumber, ifscCode: fpIfsc, branchName: fpBranch },
                      fpQrFile
                    );
                    setFpSettings(saved);
                    setFpShowEdit(false);
                    setFpMsg({ type: 'success', text: '✓ Banking details updated' });
                    setTimeout(() => setFpMsg(null), 4000);
                  } catch (err: any) {
                    setFpMsg({ type: 'error', text: err?.message || 'Failed to save' });
                  }
                  setFpSaving(false);
                }}
                className="glass-btn-primary text-xs flex items-center gap-1.5"
              >
                {fpSaving ? <><div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin" /> Saving...</> : <><ShieldCheck size={13} /> Save Details</>}
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Report card pdf layout modal */}
      {showReportCardPdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <GlassCard className="w-full max-w-2xl bg-white text-slate-900 p-8 space-y-6 relative my-8">
            <button 
              onClick={() => setShowReportCardPdf(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors border border-slate-200"
              title="Close Preview"
            >
              <Trash2 size={16} />
            </button>

            {/* Selection controls */}
            <div className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs mb-4">
              <div className="flex-1 space-y-1">
                <label className="font-bold text-slate-700">Select Student</label>
                <select
                  value={selectedRcStudent}
                  onChange={(e) => setSelectedRcStudent(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none"
                >
                  <option value="">-- Choose Student --</option>
                  {(() => {
                    const mapping = classMappings.find(m => m.id === selectedMapping);
                    if (!mapping) return null;
                    const classStudents = mockDb.students.filter(s => s.classId === mapping.classId);
                    return classStudents.map(st => {
                      const user = mockDb.users.find(u => u.id === st.userId);
                      return (
                        <option key={st.id} value={st.id}>
                          {user ? `${user.firstName} ${user.lastName}` : 'Unknown'} (Roll: {st.rollNumber})
                        </option>
                      );
                    });
                  })()}
                </select>
              </div>

              <div className="flex-1 space-y-1">
                <label className="font-bold text-slate-700">Select Exam / Term</label>
                <select
                  value={selectedRcExam}
                  onChange={(e) => setSelectedRcExam(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-800 focus:outline-none"
                >
                  <option value="">-- Choose Exam Term --</option>
                  {(() => {
                    const schoolId = session?.user.schoolId || '';
                    const exams = mockDb.exams.filter(e => e.schoolId === schoolId);
                    return exams.map(ex => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ));
                  })()}
                </select>
              </div>
            </div>

            {/* Loading / Error States */}
            {rcLoading && (
              <div className="h-64 flex flex-col items-center justify-center gap-3 text-slate-500">
                <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-semibold">Generating Academic Report Card...</span>
              </div>
            )}

            {rcError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl space-y-2 text-xs">
                <h4 className="font-bold flex items-center gap-2">
                  <span>Marksheet Generation Blocked</span>
                </h4>
                <p className="whitespace-pre-line leading-relaxed font-sans">{rcError}</p>
              </div>
            )}

            {!selectedRcStudent || !selectedRcExam ? (
              (!rcLoading && !rcError) && (
                <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Layers size={32} />
                  <span className="text-xs">Please select a student and exam term to generate the official report card.</span>
                </div>
              )
            ) : (
              rcData && (
                <div className="space-y-6">
                  {/* Header */}
                  <div className="flex justify-between items-start border-b-2 border-slate-150 pb-4">
                    <div className="flex items-center gap-3">
                      {rcData.school.logoUrl ? (
                        <img src={rcData.school.logoUrl} alt="Logo" className="w-12 h-12 object-contain rounded" />
                      ) : (
                        <div className="w-12 h-12 bg-brand-500/10 text-brand-600 rounded flex items-center justify-center font-black text-lg">A</div>
                      )}
                      <div>
                        <h2 className="text-lg font-black text-slate-800 uppercase leading-none">{rcData.school.name}</h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono mt-1">Academic Report Card</p>
                        <p className="text-[10px] text-slate-400">{rcData.school.address}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="px-2.5 py-0.5 rounded bg-brand-100 text-brand-700 text-[10px] font-bold border border-brand-200 uppercase">OFFICIAL REPORT</span>
                      <p className="text-xs font-mono font-bold text-slate-600 mt-2">{rcData.academic.term}</p>
                      <p className="text-[9px] text-slate-450 mt-0.5 font-mono">Date Issued: {rcData.remarks.dateOfIssue}</p>
                    </div>
                  </div>

                  {/* Student Info */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Student Identity</span>
                      <p className="font-bold text-slate-700">{rcData.student.name}</p>
                      <p className="text-slate-500">Class: {rcData.student.className} (Roll #{rcData.student.rollNumber})</p>
                      <p className="text-slate-500">Adm No: {rcData.student.admissionNumber}</p>
                      <p className="text-slate-500">DOB: {new Date(rcData.student.dateOfBirth).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <span className="text-[9px] text-slate-400 uppercase tracking-wider font-bold">Guardian Details</span>
                      <p className="font-bold text-slate-700">Father: {rcData.student.fatherName}</p>
                      <p className="text-slate-500">Mother: {rcData.student.motherName}</p>
                      <p className="text-slate-450">{rcData.student.address}</p>
                    </div>
                  </div>

                  {/* Grades table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                          <th className="py-2.5 px-3">Subject</th>
                          <th className="py-2.5 px-3 text-right">Pre-Mid (10)</th>
                          <th className="py-2.5 px-3 text-right">Mid-Term (80)</th>
                          <th className="py-2.5 px-3 text-right">Post-Mid (10)</th>
                          <th className="py-2.5 px-3 text-right">Annual (80)</th>
                          <th className="py-2.5 px-3 text-right">Practical (20)</th>
                          <th className="py-2.5 px-3 text-right font-bold">Total (200)</th>
                          <th className="py-2.5 px-3 text-center">Grade</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-150">
                        {rcData.academic.subjects.map((sub: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-semibold text-slate-700">{sub.subjectName}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">{sub.preMid}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">{sub.midTerm}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">{sub.postMid}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">{sub.annual}</td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-500">{sub.practical}</td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">{sub.total}</td>
                            <td className="py-2.5 px-3 text-center font-bold text-brand-600">{sub.grade}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Co-Scholastic & Attendance */}
                  <div className="grid grid-cols-2 gap-6 text-xs">
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Co-Scholastic Assessments</h4>
                      <div className="space-y-1 text-slate-600 border border-slate-100 rounded-lg p-2 bg-slate-50/50 font-sans">
                        <div className="flex justify-between">
                          <span>Art Education:</span>
                          <span className="font-bold">{rcData.coScholastic.artEducation.term2}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Health & Fitness:</span>
                          <span className="font-bold">{rcData.coScholastic.healthAndFitness.term2}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Discipline:</span>
                          <span className="font-bold">{rcData.coScholastic.discipline.term2}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[9px]">Attendance & Results</h4>
                      <div className="space-y-1 text-slate-600 border border-slate-100 rounded-lg p-2 bg-slate-50/50 font-mono">
                        <div className="flex justify-between">
                          <span>Working Days:</span>
                          <span>{rcData.academic.attendance.workingDays}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Attended Days:</span>
                          <span>{rcData.academic.attendance.presentDays}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Attendance %:</span>
                          <span className="font-bold text-slate-800">{rcData.academic.attendance.percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Remarks and Status */}
                  <div className="bg-slate-50 border border-slate-150 rounded-xl p-4 text-xs space-y-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Class Teacher Remarks</span>
                      <p className="text-slate-700 italic mt-0.5">"{rcData.remarks.classTeacherRemarks}"</p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Result status</span>
                        <p className="font-bold text-brand-700">{rcData.remarks.resultStatus}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Class Rank</span>
                        <p className="font-bold text-slate-700">#{rcData.academic.classRank}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Promoted Class</span>
                        <p className="font-bold text-slate-700">{rcData.remarks.promotedClass}</p>
                      </div>
                    </div>
                  </div>

                  {/* Signatures and Seals */}
                  <div className="grid grid-cols-3 gap-4 text-center text-xs pt-4 border-t border-slate-200">
                    <div className="flex flex-col items-center justify-end h-20">
                      {rcData.signatures.classTeacherSignatureUrl ? (
                        <img src={rcData.signatures.classTeacherSignatureUrl} alt="Teacher Signature" className="h-10 object-contain" />
                      ) : (
                        <div className="h-10 w-24 border-b border-dashed border-slate-300" />
                      )}
                      <p className="font-bold text-slate-700 mt-2">{rcData.signatures.classTeacherName}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider">Class Teacher</p>
                    </div>

                    <div className="flex flex-col items-center justify-end h-20">
                      {rcData.school.sealUrl ? (
                        <img src={rcData.school.sealUrl} alt="School Seal" className="h-12 object-contain" />
                      ) : (
                        <div className="h-12 w-12 rounded-full border border-dashed border-slate-300 flex items-center justify-center text-[8px] text-slate-300">SEAL</div>
                      )}
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider mt-2">School Seal</p>
                    </div>

                    <div className="flex flex-col items-center justify-end h-20">
                      {rcData.signatures.principalSignatureUrl ? (
                        <img src={rcData.signatures.principalSignatureUrl} alt="Principal Signature" className="h-10 object-contain" />
                      ) : (
                        <div className="h-10 w-24 border-b border-dashed border-slate-300" />
                      )}
                      <p className="font-bold text-slate-700 mt-2">{rcData.signatures.principalName}</p>
                      <p className="text-[9px] text-slate-400 uppercase tracking-wider">Principal</p>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              {rcData && (
                <button 
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors active:scale-[0.98]"
                >
                  Print report Card
                </button>
              )}
              <button 
                onClick={() => setShowReportCardPdf(null)}
                className="px-4 py-2 border border-slate-205 text-slate-550 rounded-xl text-xs font-bold hover:bg-slate-555 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Tardiness Details Modal */}
      {selectedTardyStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <GlassCard className="w-full max-w-md p-6 space-y-4 border border-slate-800 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-slate-850 pb-3">
              <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                <Clock className="text-amber-400 animate-pulse" size={20} />
                Tardiness Logs: {selectedTardyStudent.studentName}
              </h3>
              <button 
                onClick={() => setSelectedTardyStudent(null)}
                className="text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-850 text-xs">
                <span className="text-slate-400">Class Room:</span>
                <span className="font-semibold text-slate-200">
                  {managedClasses.find(c => c.id === selectedManagedClass)?.name || 'N/A'}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-850 text-xs">
                <span className="text-slate-400">Late Login Rate:</span>
                <span className="font-mono font-bold text-amber-400">{selectedTardyStudent.lateRate}%</span>
              </div>

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Recent Tardy Indicators</span>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {selectedTardyStudent.logs && selectedTardyStudent.logs.length > 0 ? (
                    selectedTardyStudent.logs.map((log: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-950 p-2.5 rounded-lg border border-slate-900 text-xs font-mono">
                        <span className="text-slate-400">{log.date}</span>
                        <span className="text-amber-400 font-semibold">{log.timestamp}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs text-slate-500">
                      No timestamps logged for this period.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setSelectedTardyStudent(null)}
                className="glass-btn-secondary text-xs px-4 py-2"
              >
                Close Logs
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
