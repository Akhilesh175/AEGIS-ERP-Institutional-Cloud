import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { 
  Timetable, Assignment, AssignmentSubmission, Quiz, QuizAttempt, 
  Subject, ExamSchedule, ExamMark, StudyMaterial, Announcement, ForumPost 
} from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Calendar, Clock, BookOpen, PenTool, Award, Download, 
  ExternalLink, UploadCloud, MessageCircle, DollarSign, PlayCircle 
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';

export const StudentPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session, syncSubscriptionPlan } = useStore();
  const studentId = session?.studentId;
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;

  // General States
  const [timetable, setTimetable] = useState<Timetable[]>([]);
  const [assignments, setAssignments] = useState<{ assignment: Assignment; submission?: AssignmentSubmission }[]>([]);
  const [grades, setGrades] = useState<{ schedule: ExamSchedule; mark?: ExamMark; subject: Subject; examName: string }[]>([]);
  const [quizzes, setQuizzes] = useState<{ quiz: Quiz; attempt?: QuizAttempt }[]>([]);
  const [materials, setMaterials] = useState<(StudyMaterial & { subjectName: string; teacherName: string })[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [forumPosts, setForumPosts] = useState<(ForumPost & { authorName: string; categoryName: string; repliesCount: number })[]>([]);
  const [fees, setFees] = useState<{ structure: any; payment?: any }[]>([]);

  // Interactive Action States
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [submittingText, setSubmittingText] = useState('');
  const [submittingFile, setSubmittingFile] = useState('');
  
  // Video player state
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Quiz active state
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<any[]>([]);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizDurationLeft, setQuizDurationLeft] = useState(0);

  // Discussion state
  const [postTitle, setPostTitle] = useState('');
  const [postContent, setPostContent] = useState('');
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [postReplies, setPostReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');

  const loadData = async () => {
    if (!studentId) return;
    try {
      await syncSubscriptionPlan();
      const tt = await mockApi.studentGetTimetable(studentId);
      setTimetable(tt);

      const ass = await mockApi.studentGetAssignments(studentId);
      setAssignments(ass);

      const grd = await mockApi.studentGetGrades(studentId);
      setGrades(grd);

      const qz = await mockApi.studentGetQuizzes(studentId);
      setQuizzes(qz);

      const mat = await mockApi.getStudyMaterials();
      setMaterials(mat);

      const ann = await mockApi.getAnnouncements('STUDENT');
      setAnnouncements(ann);

      const posts = await mockApi.getForumPosts();
      setForumPosts(posts);

      const f = await mockApi.studentGetFees(studentId);
      setFees(f);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, [studentId, activeTab]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncSubscriptionPlan();
    }, 10000);
    return () => clearInterval(interval);
  }, [syncSubscriptionPlan]);

  // Quiz Timer
  useEffect(() => {
    if (activeQuiz && quizDurationLeft > 0) {
      const timer = setInterval(() => {
        setQuizDurationLeft(prev => {
          if (prev <= 1) {
            handleQuizSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
    return;
  }, [activeQuiz, quizDurationLeft]);

  // Submit Homework / Assignment
  const handleAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId || !selectedAssignment || !submittingFile.trim()) return;

    try {
      await mockApi.studentSubmitAssignment(
        studentId, 
        selectedAssignment.id, 
        submittingText, 
        submittingFile
      );
      setSelectedAssignment(null);
      setSubmittingText('');
      setSubmittingFile('');
      loadData();
      alert('Homework submitted successfully!');
    } catch (err) {
      alert(err);
    }
  };

  // Launch Quiz
  const handleStartQuiz = async (quiz: Quiz) => {
    // Load questions
    const allQuestions = mockDb.quizQuestions.filter(q => q.quizId === quiz.id);
    setQuizQuestions(allQuestions);
    setQuizAnswers({});
    setQuizDurationLeft(quiz.durationMinutes * 60);
    setActiveQuiz(quiz);
  };

  // Submit Quiz Attempts
  const handleQuizSubmit = async () => {
    if (!studentId || !activeQuiz) return;

    // Calculate score
    let score = 0;
    quizQuestions.forEach(q => {
      const answer = quizAnswers[q.id];
      if (answer !== undefined && answer === q.correctOption) {
        score += q.marks;
      }
    });

    try {
      await mockApi.studentAttemptQuiz(studentId, activeQuiz.id, quizAnswers, score);
      setActiveQuiz(null);
      loadData();
      alert(`Quiz submitted! Your calculated score: ${score}/${activeQuiz.totalMarks}`);
    } catch (err) {
      alert(err);
    }
  };

  // View Forum Thread
  const handleSelectPost = async (post: any) => {
    setSelectedPost(post);
    try {
      const reps = await mockApi.getForumPostReplies(post.id);
      setPostReplies(reps);
    } catch (err) {
      console.error(err);
    }
  };

  // Reply to Forum
  const handleForumReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !selectedPost || !replyText.trim()) return;

    try {
      await mockApi.replyToForumPost(session.user.id, selectedPost.id, replyText);
      setReplyText('');
      const reps = await mockApi.getForumPostReplies(selectedPost.id);
      setPostReplies(reps);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  // Add Discussion Thread
  const handleCreateForumPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !postTitle.trim() || !postContent.trim()) return;

    try {
      await mockApi.createForumPost(session.user.id, postTitle, postContent);
      setPostTitle('');
      setPostContent('');
      loadData();
      alert('Discussion thread published!');
    } catch (err) {
      console.error(err);
    }
  };

  const calculateAttendancePercentage = () => {
    const presentCount = mockDb.attendance.filter(a => a.studentId === studentId && (a.status === 'PRESENT' || a.status === 'LATE')).length;
    const totalCount = mockDb.attendance.filter(a => a.studentId === studentId).length;
    return totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 100;
  };

  const calculateAverageGPA = () => {
    const scoredGrades = grades.filter(g => g.mark !== undefined);
    if (scoredGrades.length === 0) return 'A';
    const sum = scoredGrades.reduce((acc, g) => acc + (g.mark!.marksObtained / g.schedule.maxMarks), 0);
    const avg = sum / scoredGrades.length;
    if (avg >= 0.9) return 'A+';
    if (avg >= 0.8) return 'A';
    if (avg >= 0.7) return 'B';
    return 'C';
  };

  const studentEntity = mockDb.students.find(s => s.id === studentId);
  const studentUser = mockDb.users.find(u => u.id === session?.user?.id);
  const studentClass = mockDb.classes.find(c => c.id === studentEntity?.classId);
  const studentSchool = mockDb.schools.find(s => s.id === studentEntity?.schoolId) || mockDb.schools.find(s => s.id === studentUser?.schoolId);
  
  const studentName = studentUser ? `${studentUser.firstName} ${studentUser.lastName}` : 'Student';
  const className = studentClass ? studentClass.name : 'Unassigned Class';
  const admissionNumber = studentEntity ? studentEntity.admissionNumber : 'N/A';
  const schoolName = studentSchool ? studentSchool.name : 'Aegis Academy';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Portal Identity Context Bar */}
      <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center shrink-0">
            <BookOpen className="text-brand-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 font-sans leading-none">{studentName} <span className="text-xs text-slate-400 font-normal ml-1">(Student)</span></h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono bg-slate-800 px-2 py-0.5 rounded">Adm No: {admissionNumber}</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono bg-slate-800 px-2 py-0.5 rounded">Class: {className}</span>
              <span className="text-[10px] text-brand-400 uppercase tracking-widest font-mono bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">{schoolName}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Active Tab Routing switch */}

      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Welcome Banner */}
          <div className="bg-gradient-to-r from-brand-900/60 to-slate-950 border border-brand-500/20 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="text-center md:text-left space-y-2">
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-100 font-sans tracking-tight leading-none">
                Welcome back, <span className="text-brand-400 text-glow-brand">{session?.user.firstName}!</span>
              </h2>
              <p className="text-xs text-slate-400 max-w-md">
                Monitor your daily classes, attend active quizzes, submit major projects, and view grades analytics.
              </p>
            </div>
            
            <div className="flex gap-4">
              <div className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Attendance</span>
                <span className="text-lg font-bold text-brand-400 mt-1">{calculateAttendancePercentage()}%</span>
              </div>
              <div className="px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-2xl text-center">
                <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Term Grade</span>
                <span className="text-lg font-bold text-brand-400 mt-1">{calculateAverageGPA()}</span>
              </div>
            </div>
          </div>

          {/* Core Dashboard Metric grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Today's Lectures */}
            <GlassCard className="col-span-1 md:col-span-2 space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Calendar className="text-brand-500" size={16} />
                  Today's Lecture Schedule
                </h3>
              </div>
              
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {timetable.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">No lecture schedules registered for today.</div>
                ) : (
                  timetable.map(t => {
                    const subject = mockDb.subjects.find(s => s.id === t.subjectId)!;
                    return (
                      <div 
                        key={t.id}
                        className="flex items-center justify-between p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl hover:border-slate-800 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center font-bold text-xs text-brand-400 border border-slate-800">
                            {subject.code}
                          </div>
                          <div>
                            <h4 className="font-semibold text-slate-200 text-xs">{subject.name}</h4>
                            <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                              <Clock size={10} />
                              {t.startTime} - {t.endTime} | {t.classroomNumber}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </GlassCard>

            {/* General school alerts */}
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">STEM Announcements</h3>
              <div className="space-y-3 max-h-72 overflow-y-auto">
                {announcements.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs">No active notices published yet.</div>
                ) : (
                  announcements.map(a => (
                    <div key={a.id} className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl space-y-1">
                      <h4 className="font-semibold text-slate-200 text-xs truncate">{a.title}</h4>
                      <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">{a.content}</p>
                    </div>
                  ))
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'timetable' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Calendar className="text-brand-500" size={18} />
              Assignments & Timetable Master
            </h3>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* List Timetable */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-200 text-xs">Weekly Timetable Schedule</h4>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {timetable.map(t => {
                  const subject = mockDb.subjects.find(s => s.id === t.subjectId)!;
                  return (
                    <div key={t.id} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded bg-slate-800 flex items-center justify-center font-bold text-xs text-brand-400">
                          {t.dayOfWeek === 1 ? 'M' : t.dayOfWeek === 2 ? 'T' : t.dayOfWeek === 3 ? 'W' : 'Th'}
                        </span>
                        <div>
                          <p className="font-semibold text-xs text-slate-200">{subject.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">{t.classroomNumber || 'Main hall'} | {t.startTime} - {t.endTime}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Assignments Homework */}
            <div className="space-y-4">
              <h4 className="font-semibold text-slate-200 text-xs">Upcoming Homework & Project Deadlines</h4>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {assignments.map(({ assignment, submission }) => {
                  const subject = mockDb.subjects.find(s => s.id === assignment.subjectId)!;
                  return (
                    <div key={assignment.id} className="p-3.5 bg-slate-900/40 border border-slate-850 rounded-xl space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            assignment.isHomework ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                          }`}>
                            {assignment.isHomework ? 'Daily Homework' : 'Major Assignment'}
                          </span>
                          <h5 className="font-semibold text-slate-200 text-xs mt-1.5">{assignment.title}</h5>
                          <p className="text-[10px] text-slate-400 mt-0.5">{subject.name} | Due: {new Date(assignment.dueDate).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg ${
                            submission 
                              ? submission.marksObtained !== undefined 
                                ? 'bg-green-500/10 text-green-400' 
                                : 'bg-blue-500/10 text-blue-400'
                              : 'bg-slate-850 text-slate-400'
                          }`}>
                            {submission 
                              ? submission.marksObtained !== undefined 
                                ? `Graded: ${submission.marksObtained}/${assignment.maxMarks}` 
                                : 'Submitted' 
                              : 'Pending'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-relaxed">{assignment.description}</p>
                      
                      {!submission && (
                        <button 
                          onClick={() => setSelectedAssignment(assignment)}
                          className="w-full bg-brand-600/10 hover:bg-brand-600 border border-brand-500/20 text-brand-400 hover:text-white font-medium text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                        >
                          <UploadCloud size={13} />
                          Upload Submissions
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {activeTab === 'materials' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <BookOpen className="text-brand-500" size={18} />
              Academic Materials & Video Portal
            </h3>
          </div>

          {activeVideoUrl && (
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl animate-fade-in space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold text-slate-200">Active Lecture Streaming Node</h4>
                <button 
                  onClick={() => setActiveVideoUrl(null)}
                  className="text-xs text-red-400 hover:text-red-300 font-semibold"
                >
                  Close Screen
                </button>
              </div>
              <video 
                src={activeVideoUrl} 
                controls 
                className="w-full max-h-96 rounded-xl border border-slate-800 bg-black"
                autoPlay
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {materials.map(m => (
              <div key={m.id} className="p-4 bg-slate-900/30 border border-slate-850 hover:border-brand-500/20 rounded-2xl flex flex-col justify-between gap-4 transition-all">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-brand-400 font-mono uppercase tracking-wider">{m.subjectName}</span>
                  <h4 className="font-bold text-slate-200 text-sm mt-0.5">{m.title}</h4>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{m.description || 'No description provided.'}</p>
                </div>
                <div className="pt-2 flex items-center justify-between border-t border-slate-850">
                  <span className="text-[10px] text-slate-500 truncate">Faculty: {m.teacherName}</span>
                  {m.isVideoStreamable ? (
                    <button 
                      onClick={() => setActiveVideoUrl(m.fileUrl)}
                      className="text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                    >
                      <PlayCircle size={14} />
                      Stream Live
                    </button>
                  ) : (
                    <a 
                      href={m.fileUrl} 
                      download 
                      className="text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                    >
                      <Download size={14} />
                      Download Resource
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {activeTab === 'quizzes' && (
        <PremiumLock 
          isLocked={!plan.features.quizzes} 
          requiredTier="Basic" 
          featureName="Quizzes & Online Tests"
        >
          <div className="space-y-6 animate-fade-in">
          
          {/* Active Quiz player frame */}
          {activeQuiz ? (
            <GlassCard className="space-y-6 border-brand-500/30">
              <div className="flex items-center justify-between border-b border-slate-850 pb-3 bg-slate-950/20 px-2 rounded">
                <div>
                  <h3 className="font-bold text-brand-400">{activeQuiz.title}</h3>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest mt-0.5">Secure Exam Assessment Panel</p>
                </div>
                <div className="px-4 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 font-mono font-bold text-sm rounded-xl">
                  Timer: {Math.floor(quizDurationLeft / 60)}m {quizDurationLeft % 60}s
                </div>
              </div>

              <div className="space-y-6">
                {quizQuestions.map((q, idx) => (
                  <div key={q.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-xl space-y-3">
                    <p className="text-slate-100 font-medium text-sm leading-relaxed">
                      {idx + 1}. {q.question}
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {q.options.map((opt: string, optIdx: number) => {
                        const isSelected = quizAnswers[q.id] === optIdx;
                        return (
                          <div 
                            key={optIdx}
                            onClick={() => setQuizAnswers(prev => ({ ...prev, [q.id]: optIdx }))}
                            className={`p-3 rounded-xl border text-xs cursor-pointer transition-all duration-200 ${
                              isSelected 
                                ? 'bg-brand-600/15 border-brand-500 text-brand-400 font-semibold' 
                                : 'bg-slate-900/20 border-slate-800 text-slate-300 hover:bg-slate-900/40 hover:border-slate-750'
                            }`}
                          >
                            {opt}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button 
                  onClick={() => setActiveQuiz(null)}
                  className="glass-btn-secondary text-xs"
                >
                  Cancel Attempt
                </button>
                <button 
                  onClick={handleQuizSubmit}
                  className="glass-btn-primary text-xs"
                >
                  Submit Secure Test
                </button>
              </div>
            </GlassCard>
          ) : (
            // Quiz listing
            <GlassCard className="space-y-6">
              <h3 className="font-bold text-slate-100 flex items-center gap-2 pb-3 border-b border-slate-850">
                <PenTool className="text-brand-500" size={18} />
                Quizzes & Interactive Online Tests
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {quizzes.map(({ quiz, attempt }) => {
                  const subject = mockDb.subjects.find(s => s.id === quiz.subjectId)!;
                  return (
                    <div key={quiz.id} className="p-4 bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-2xl flex flex-col justify-between gap-4 transition-all">
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{subject.name}</span>
                        <h4 className="font-bold text-slate-200 text-sm mt-0.5">{quiz.title}</h4>
                        <p className="text-xs text-slate-400">Duration: {quiz.durationMinutes} minutes | Marks: {quiz.totalMarks}</p>
                      </div>
                      
                      <div className="pt-3 border-t border-slate-850 flex items-center justify-between">
                        {attempt ? (
                          <span className="text-xs font-semibold text-green-400 bg-green-500/10 px-2.5 py-1 rounded-lg">
                            Attempted: {attempt.score}/{quiz.totalMarks} score
                          </span>
                        ) : (
                          <>
                            <span className="text-[10px] text-slate-500">Available Test</span>
                            <button 
                              onClick={() => handleStartQuiz(quiz)}
                              className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-4 py-1.5 rounded-lg transition-colors"
                            >
                              Launch Quiz
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}
        </div>
        </PremiumLock>
      )}

      {activeTab === 'grades' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Award className="text-brand-500" size={18} />
              Term Progress & Midterm Assessment Records
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold">
                  <th className="py-3 px-4">Subject</th>
                  <th className="py-3 px-4">Assessment name</th>
                  <th className="py-3 px-4">Marks Scored</th>
                  <th className="py-3 px-4">Max Marks</th>
                  <th className="py-3 px-4">Remarks & Feedbacks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {grades.map(({ schedule, mark, subject, examName }) => (
                  <tr key={schedule.id} className="hover:bg-slate-900/10 text-slate-200">
                    <td className="py-3 px-4 font-semibold">{subject.name}</td>
                    <td className="py-3 px-4 text-slate-400">{examName}</td>
                    <td className="py-3 px-4">
                      {mark ? (
                        <span className={`font-bold text-sm ${mark.marksObtained >= 80 ? 'text-green-400' : 'text-slate-200'}`}>
                          {mark.marksObtained}
                        </span>
                      ) : (
                        <span className="text-slate-500">Grading Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-400">{schedule.maxMarks}</td>
                    <td className="py-3 px-4 text-slate-400 italic truncate max-w-xs">{mark ? mark.remarks : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'forums' && (
        <PremiumLock 
          isLocked={!plan.features.communications} 
          requiredTier="Basic" 
          featureName="Discussions & Forums"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            
            {/* Create Post and list posts */}
            <div className="lg:col-span-2 space-y-6">
              {selectedPost ? (
                <GlassCard className="space-y-6">
                  <button 
                    onClick={() => setSelectedPost(null)}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                  >
                    &larr; Back to discussion catalog
                  </button>
                  
                  <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl space-y-3">
                    <h4 className="font-bold text-slate-100 text-base">{selectedPost.title}</h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line">{selectedPost.content}</p>
                    <p className="text-[10px] text-slate-500">Posted by: {selectedPost.authorName}</p>
                  </div>

                  <div className="space-y-4">
                    <h5 className="font-semibold text-slate-200 text-xs">Activity replies</h5>
                    <div className="space-y-3 max-h-72 overflow-y-auto">
                      {postReplies.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">No responses posted yet. Be the first to reply!</div>
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

                  {/* Forum response creator */}
                  <form onSubmit={handleForumReplySubmit} className="space-y-3">
                    <textarea 
                      placeholder="Write a constructive response..."
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      className="w-full bg-slate-900/50 border border-slate-800 text-xs text-slate-100 rounded-xl p-3 focus:outline-none focus:border-brand-500 transition-colors"
                      required
                    />
                    <button type="submit" className="glass-btn-primary text-xs">
                      Publish Reply
                    </button>
                  </form>
                </GlassCard>
              ) : (
                // List posts
                <GlassCard className="space-y-6">
                  <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Homeroom Classroom Forums</h3>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                    {forumPosts.length === 0 ? (
                      <div className="text-center py-12 text-slate-500 text-xs">No active discussions.</div>
                    ) : (
                      forumPosts.map(p => (
                        <div 
                          key={p.id}
                          onClick={() => handleSelectPost(p)}
                          className="p-4 bg-slate-900/30 border border-slate-850 hover:border-slate-800 rounded-2xl cursor-pointer transition-all"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-bold text-brand-400 uppercase tracking-widest">{p.categoryName}</span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <MessageCircle size={10} />
                              {p.repliesCount} replies
                            </span>
                          </div>
                          <h4 className="font-bold text-slate-200 text-sm truncate">{p.title}</h4>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">{p.content}</p>
                          <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500">
                            <span>By: {p.authorName}</span>
                            <span>{new Date(p.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </GlassCard>
              )}
            </div>

            {/* Create Post Form */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h3 className="font-bold text-slate-200 text-sm">Start New Discussion Thread</h3>
                <form onSubmit={handleCreateForumPost} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Post Title</label>
                    <input 
                      type="text"
                      placeholder="e.g. Help with Vector calculus question 4"
                      value={postTitle}
                      onChange={(e) => setPostTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Thread Context</label>
                    <textarea 
                      placeholder="Explain your queries or share thoughts clearly..."
                      rows={4}
                      value={postContent}
                      onChange={(e) => setPostContent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>
                  <button type="submit" className="w-full glass-btn-primary text-xs">
                    Create Thread
                  </button>
                </form>
              </GlassCard>
            </div>
          </div>
        </PremiumLock>
      )}

      {/* Assignment Upload Drawer Overlay */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-6">
            <div className="border-b border-slate-850 pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-100">Upload Homework Submission</h4>
                <p className="text-[10px] text-slate-400 mt-0.5">{selectedAssignment.title}</p>
              </div>
              <button 
                onClick={() => setSelectedAssignment(null)}
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close Drawer
              </button>
            </div>

            <form onSubmit={handleAssignmentSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Submission Note</label>
                <textarea 
                  placeholder="Explain your workings or summarize submission details..."
                  rows={3}
                  value={submittingText}
                  onChange={(e) => setSubmittingText(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">File Attachment Name (e.g. proof.pdf)</label>
                <input 
                  type="text"
                  placeholder="homework_sub.pdf"
                  value={submittingFile}
                  onChange={(e) => setSubmittingFile(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-100 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button 
                  type="button" 
                  onClick={() => setSelectedAssignment(null)}
                  className="glass-btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="glass-btn-primary text-xs"
                >
                  Submit File
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
};
