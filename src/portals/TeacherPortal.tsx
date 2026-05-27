import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { 
  TeacherClassSubjectMapping, Student, AssignmentSubmission, 
  Class, Subject, Assignment, User, Timetable, Exam
} from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Clipboard, UserCheck, Edit3, Award, PlusCircle, 
  UploadCloud, FileText, CheckCircle, AlertCircle, Save, Calendar, Clock, MapPin, Layers
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';

export const TeacherPortal: React.FC<{ activeTab: string; setActiveTab?: (tab: string) => void }> = ({ activeTab, setActiveTab }) => {
  const { session, syncSubscriptionPlan } = useStore();
  const teacherId = session?.teacherId;
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;

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
  const [materialType, setMaterialType] = useState<'pdf' | 'docx' | 'mp4'>('pdf');
  const [materialStreamable, setMaterialStreamable] = useState(false);

  // Managed class timetables (Class Teacher Hub)
  const [managedClasses, setManagedClasses] = useState<Class[]>([]);
  const [selectedManagedClass, setSelectedManagedClass] = useState<string>('');
  const [newAssignedTeacher, setNewAssignedTeacher] = useState('');
  const [newAssignedSubject, setNewAssignedSubject] = useState('');
  const [newAssignedDay, setNewAssignedDay] = useState(1);
  const [newAssignedStart, setNewAssignedStart] = useState('09:00');
  const [newAssignedEnd, setNewAssignedEnd] = useState('10:30');
  const [newAssignedClassroom, setNewAssignedClassroom] = useState('Room 101');

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

  const [showCTAddParent, setShowCTAddParent] = useState(false);
  const [ctPrEmail, setCtPrEmail] = useState('');
  const [ctPrFirst, setCtPrFirst] = useState('');
  const [ctPrLast, setCtPrLast] = useState('');
  const [ctPrOccup, setCtPrOccup] = useState('');
  const [ctPrAddr, setCtPrAddr] = useState('');
  const [ctPrPhone, setCtPrPhone] = useState('');
  const [ctPrStudentId, setCtPrStudentId] = useState('');
  const [ctPrAdmissionNum, setCtPrAdmissionNum] = useState('');
  const [ctPrRelation, setCtPrRelation] = useState('Father');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Homeroom Marksheets
  const [hmExams, setHmExams] = useState<Exam[]>([]);
  const [hmSelectedExam, setHmSelectedExam] = useState('');
  const [hmSelectedStudent, setHmSelectedStudent] = useState('');
  const [hmReportCard, setHmReportCard] = useState<{ scheduleId: string; subjectId: string; subjectName: string; maxMarks: number; marksObtained?: number; remarks?: string }[]>([]);

  const loadManagedClasses = async () => {
    if (!teacherId) return;
    try {
      const data = await mockApi.classTeacherGetManagedClasses(teacherId);
      setManagedClasses(data);
      if (data.length > 0) {
        setSelectedManagedClass(data[0].id);
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
        setSelectedMapping(data[0].id);
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
      const stData = await mockApi.teacherGetClassStudents(teacherId, mapping.classId);
      setStudents(stData);
      
      const initialAttendance: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
      const initialRemarks: Record<string, string> = {};
      stData.forEach(s => {
        initialAttendance[s.id] = (s.attendanceState as any) || 'PRESENT';
        initialRemarks[s.id] = '';
      });
      setAttendanceRecords(initialAttendance);
      setAttendanceRemarks(initialRemarks);

      // Load Submissions
      const subData = await mockApi.teacherGetSubmissions(teacherId, mapping.classId);
      setSubmissions(subData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    syncSubscriptionPlan();
    loadMappings();
    loadManagedClasses();
    if (session?.user.schoolId) {
      mockApi.classTeacherGetExams(session.user.schoolId).then(setHmExams);
    }
  }, [teacherId, session]);

  useEffect(() => {
    if (selectedMapping) {
      loadSelectionDetails();
    }
  }, [selectedMapping, activeTab]);

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
  }, [teacherId, selectedManagedClass, hmSelectedStudent, hmSelectedExam]);

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
      alert('Class lecture successfully removed from schedule sheets.');
      loadSelectionDetails();
    } catch (err: any) {
      alert(err.message || 'Error deleting timetable entry');
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
        ctStDob
      );
      setShowCTAddStudent(false);
      setCtStEmail('');
      setCtStFirst('');
      setCtStLast('');
      setCtStAdmission('');
      setCtStRoll(1);
      setCtStGender('MALE');
      setCtStDob('2010-01-01');
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
        ctPrRelation
      );
      setShowCTAddParent(false);
      setCtPrEmail('');
      setCtPrFirst('');
      setCtPrLast('');
      setCtPrOccup('');
      setCtPrAddr('');
      setCtPrPhone('');
      setCtPrStudentId('');
      setCtPrAdmissionNum('');
      setCtPrRelation('Father');
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

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedMapping || !assignTitle.trim()) return;
    const mapping = classMappings.find(m => m.id === selectedMapping)!;

    try {
      await mockApi.teacherCreateAssignment(
        teacherId,
        mapping.classId,
        mapping.subjectId,
        assignTitle,
        assignDesc,
        new Date(assignDueDate).toISOString(),
        assignIsHomework
      );
      setAssignTitle('');
      setAssignDesc('');
      setAssignDueDate('');
      setAssignIsHomework(false);
      alert('Assignment released to classroom feeds!');
    } catch (err: any) {
      alert(err.message || 'Error creating assignment');
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
    const mapping = classMappings.find(m => m.id === selectedMapping)!;

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
    } catch (err: any) {
      alert(err.message || 'Error creating quiz');
    }
  };

  const handleUploadMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teacherId || !selectedMapping || !materialTitle.trim() || !materialUrl.trim()) return;
    const mapping = classMappings.find(m => m.id === selectedMapping)!;

    try {
      await mockApi.teacherUploadStudyMaterial(
        teacherId,
        mapping.subjectId,
        materialTitle,
        materialDesc,
        materialUrl,
        materialType,
        materialStreamable
      );
      setMaterialTitle('');
      setMaterialDesc('');
      setMaterialUrl('');
      setMaterialType('pdf');
      setMaterialStreamable(false);
      alert('Study resource added to catalog!');
    } catch (err: any) {
      alert(err.message || 'Error uploading material');
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
        marksData
      );
      alert('Report card marks saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Error saving marks');
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
      <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center shrink-0">
            <Clipboard className="text-brand-400" size={24} />
          </div>
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
        </div>
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
              {[1, 2, 3, 4, 5].map(dayNum => {
                const dayLectures = mockDb.timetables
                  .filter(t => t.teacherId === teacherId && t.dayOfWeek === dayNum)
                  .sort((a, b) => a.startTime.localeCompare(b.startTime));

                const dayName = dayNum === 1 ? 'Monday' : 
                                dayNum === 2 ? 'Tuesday' : 
                                dayNum === 3 ? 'Wednesday' : 
                                dayNum === 4 ? 'Thursday' : 'Friday';

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
              isLocked={currentPlanName !== 'pro' && currentPlanName !== 'enterprise'}
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
                      {mockDb.subjects.map(s => (
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
                      {mockDb.teachers.map(t => {
                        const u = mockDb.users.find(usr => usr.id === t.userId)!;
                        return (
                          <option key={t.id} value={t.id}>{u.firstName} {u.lastName} ({t.specialization})</option>
                        );
                      })}
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
                  {[1, 2, 3, 4, 5].map(dayNum => {
                    const classLectures = mockDb.timetables
                      .filter(t => t.classId === selectedManagedClass && t.dayOfWeek === dayNum)
                      .sort((a, b) => a.startTime.localeCompare(b.startTime));

                    const dayName = dayNum === 1 ? 'Monday' : 
                                    dayNum === 2 ? 'Tuesday' : 
                                    dayNum === 3 ? 'Wednesday' : 
                                    dayNum === 4 ? 'Thursday' : 'Friday';

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

                                  <button
                                    onClick={() => handleDeleteManagedTimetable(lecture.id)}
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
                          const cs = classStudents.find(st => st.id === m.studentId)!;
                          const csu = mockDb.users.find(usr => usr.id === cs.userId)!;
                          return `${csu.firstName} ${csu.lastName}`;
                        });

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

      {activeTab === 'attendance' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <UserCheck className="text-brand-500" size={18} />
              Single-Click Attendance Register Roll
            </h3>
            <button 
              onClick={handleMarkAttendance}
              className="glass-btn-primary text-xs flex items-center gap-1.5"
            >
              <Save size={14} />
              Save Register Logs
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold">
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Status Indicators</th>
                  <th className="py-3 px-4">Attendance Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {students.map(s => (
                  <tr key={s.id} className="hover:bg-slate-900/10 text-slate-200">
                    <td className="py-3 px-4 font-mono">{s.rollNumber}</td>
                    <td className="py-3 px-4 font-semibold">{s.userDetails.firstName} {s.userDetails.lastName}</td>
                    <td className="py-3 px-4 flex gap-2">
                      {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(status => {
                        const isSelected = attendanceRecords[s.id] === status;
                        return (
                          <button
                            key={status}
                            onClick={() => setAttendanceRecords(prev => ({ ...prev, [s.id]: status as any }))}
                            className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors ${
                              isSelected 
                                ? status === 'PRESENT' 
                                  ? 'bg-green-500/10 border-green-500/40 text-green-400' 
                                  : status === 'ABSENT' 
                                    ? 'bg-red-500/10 border-red-500/40 text-red-400' 
                                    : 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                            }`}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </td>
                    <td className="py-3 px-4">
                      <input 
                        type="text" 
                        placeholder="Delay logs, medical notes..."
                        value={attendanceRemarks[s.id] || ''}
                        onChange={(e) => setAttendanceRemarks(prev => ({ ...prev, [s.id]: e.target.value }))}
                        className="bg-slate-950 border border-slate-800 text-slate-100 rounded-lg p-1 px-2 text-xs focus:outline-none focus:border-brand-500 w-full max-w-xs"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
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
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5 font-mono bg-slate-900/50 inline-flex px-2 py-1 rounded-md border border-slate-800">
                      <FileText size={12} className="text-slate-500" />
                      {sub.fileUrl || 'No attachment provided'}
                    </p>
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
                  <div className="flex justify-end pt-4">
                    <button type="submit" className="glass-btn-primary text-xs flex items-center gap-1.5">
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
      )}

      {activeTab === 'assignments' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Create Homework Form */}
          <div className="lg:col-span-1">
            <GlassCard className="space-y-4">
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
          </div>

          {/* Quiz Creator Form */}
          <div className="lg:col-span-2">
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <PlusCircle className="text-brand-500" size={16} />
                Interactive MCQ Online Quiz Builder
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Quiz Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. TypeScript Type Safety Test"
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
                <form onSubmit={handleAddQuizQuestion} className="bg-slate-900/20 border border-slate-850 p-3 rounded-2xl space-y-3">
                  <h4 className="text-xs font-semibold text-slate-200">Add Question Form</h4>
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
                    Push to quiz list
                  </button>
                </form>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
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
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resource File Link</label>
                <input 
                  type="text"
                  placeholder="https://example.com/lecture.mp4"
                  value={materialUrl}
                  onChange={(e) => setMaterialUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Format</label>
                <select 
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="pdf">PDF Handbook</option>
                  <option value="docx">Word Docx</option>
                  <option value="mp4">MP4 Video Clip</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input 
                type="checkbox"
                id="isStreamCheck"
                checked={materialStreamable}
                onChange={(e) => setMaterialStreamable(e.target.checked)}
                className="bg-slate-900 border border-slate-800 rounded h-4 w-4 text-brand-500 focus:ring-brand-500"
              />
              <label htmlFor="isStreamCheck" className="text-xs text-slate-300">Mark as streamable in-browser lecture video</label>
            </div>
            <button type="submit" className="w-full glass-btn-primary text-xs">
              Upload study files
            </button>
          </form>
        </GlassCard>
      )}

      {activeTab === 'forums' && (
        <PremiumLock 
          isLocked={!plan.features.communications} 
          requiredTier="Basic" 
          featureName="Communications & Forums"
        >
          <GlassCard className="space-y-4">
            <h3 className="font-bold text-slate-100">Discussion Boards</h3>
            <p className="text-xs text-slate-400">
              Forums are available inside portal contexts. Homeroom teachers can reply to students via the Student Portal forum link, or open secure direct chats to communicate individually with parents and students!
            </p>
          </GlassCard>
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
                        const u = mockDb.users.find(usr => usr.id === s.userId)!;
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
    </div>
  );
};
