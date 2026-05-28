import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { Student, User } from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Eye, Award, DollarSign, Calendar, FileText, 
  User as UserIcon, ShieldAlert, CheckCircle, AlertCircle, UsersRound, Clock,
  BookOpen, Play, Download
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';

export const ParentPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session, syncSubscriptionPlan } = useStore();
  const parentId = session?.parentId;
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;

  // States
  const [assignedStudents, setAssignedStudents] = useState<(Student & { userDetails: User; className: string })[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [academicRecord, setAcademicRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<{ quiz: any; attempt?: any }[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Load parent's students
  const loadAssignedStudents = async () => {
    if (!parentId) return;
    try {
      await syncSubscriptionPlan();
      setLoading(true);
      const data = await mockApi.parentGetStudents(parentId);
      setAssignedStudents(data);
      if (data.length > 0) {
        setSelectedStudent(data[0].id);
      }
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Error loading mapped student records');
      setLoading(false);
    }
  };

  // Load student records
  const loadAcademicRecord = async () => {
    if (!parentId || !selectedStudent) return;
    try {
      setLoading(true);
      setError(null);
      setMaterialsLoading(true);
      const data = await mockApi.parentGetStudentAcademicRecord(parentId, selectedStudent);
      setAcademicRecord(data);
      const qz = await mockApi.studentGetQuizzes(selectedStudent);
      setQuizzes(qz);
      
      const mat = await mockApi.getStudyMaterials();
      const studentObj = mockDb.students.find(s => s.id === selectedStudent);
      if (studentObj) {
        const classSubjectIds = mockDb.teacherClassSubjectMappings
          .filter(m => m.classId === studentObj.classId)
          .map(m => m.subjectId);
        const filteredMat = mat.filter(m => classSubjectIds.includes(m.subjectId));
        setMaterials(filteredMat);
      } else {
        setMaterials([]);
      }
      setMaterialsLoading(false);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Access Denied: Isolation boundary violation');
      setAcademicRecord(null);
      setQuizzes([]);
      setMaterials([]);
      setMaterialsLoading(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedStudents();
  }, [parentId]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncSubscriptionPlan();
    }, 10000);
    return () => clearInterval(interval);
  }, [syncSubscriptionPlan]);

  useEffect(() => {
    if (selectedStudent) {
      loadAcademicRecord();
    }
  }, [selectedStudent, activeTab]);

  const getAttendanceSummary = () => {
    if (!academicRecord || academicRecord.attendance.length === 0) return { present: 0, total: 0, pct: 100 };
    const attList = academicRecord.attendance;
    const present = attList.filter((a: any) => a.status === 'PRESENT' || a.status === 'LATE').length;
    return {
      present,
      total: attList.length,
      pct: Math.round((present / attList.length) * 100)
    };
  };

  const parentUser = mockDb.users.find(u => u.id === session?.user?.id);
  const parentName = parentUser ? `${parentUser.firstName} ${parentUser.lastName}` : 'Guardian';
  
  // Get unique school names from assigned students
  const schoolIds = Array.from(new Set(assignedStudents.map(s => s.schoolId)));
  const schoolNames = schoolIds.map(id => mockDb.schools.find(sch => sch.id === id)?.name).filter(Boolean).join(', ') || 'Aegis Academy';

  // Get student names
  const studentNames = assignedStudents.map(s => `${s.userDetails.firstName} ${s.userDetails.lastName}`).join(', ') || 'No linked wards';

  if (loading && !academicRecord) {
    return (
      <div className="py-12 text-center text-slate-400 text-sm">
        Retrieving secure child records...
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      {/* Portal Identity Context Bar */}
      <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center shrink-0">
            <UsersRound className="text-brand-400" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-100 font-sans leading-none">{parentName} <span className="text-xs text-slate-400 font-normal ml-1">(Parent/Guardian)</span></h2>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono bg-slate-800 px-2 py-0.5 rounded">Wards: {studentNames}</span>
              <span className="text-[10px] text-brand-400 uppercase tracking-widest font-mono bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">{schoolNames}</span>
            </div>
          </div>
        </div>

        {/* Dropdown child selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Select Child:</span>
          <select 
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-brand-500"
          >
            {assignedStudents.map(s => (
              <option key={s.id} value={s.id}>{s.userDetails.firstName} {s.userDetails.lastName} ({s.className})</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400">
          <ShieldAlert size={24} />
          <div>
            <h4 className="font-bold text-sm">Security Policy Alert</h4>
            <p className="text-xs leading-relaxed opacity-90">{error}</p>
          </div>
        </div>
      ) : (
        academicRecord && (
          <div className="space-y-6">
            
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Ward Profile Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  
                  {/* Stats Card Attendance */}
                  <GlassCard className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                      <Calendar className="text-brand-400" size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold font-mono tracking-widest leading-none">Attendance Tracker</span>
                      <h4 className="text-lg font-bold text-slate-200 mt-1">
                        {getAttendanceSummary().pct}% <span className="text-xs font-normal text-slate-400">({getAttendanceSummary().present}/{getAttendanceSummary().total} days)</span>
                      </h4>
                    </div>
                  </GlassCard>

                  {/* Ward ID and Roll Number */}
                  <GlassCard className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                      <UserIcon className="text-brand-400" size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold font-mono tracking-widest leading-none">Enrollment Metadata</span>
                      <h4 className="text-xs font-semibold text-slate-300 mt-1">
                        Roll No: {academicRecord.studentProfile.rollNumber} | Adm No: {academicRecord.studentProfile.admissionNumber}
                      </h4>
                    </div>
                  </GlassCard>

                  {/* Class homeroom details */}
                  <GlassCard className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                      <Award className="text-brand-400" size={20} />
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 uppercase font-bold font-mono tracking-widest leading-none">Class Homeroom</span>
                      <h4 className="text-sm font-bold text-slate-200 mt-1">
                        Active in {academicRecord.studentProfile.className}
                      </h4>
                    </div>
                  </GlassCard>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Homework list */}
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Homework & Project Submissions</h3>
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {academicRecord.assignments.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">No active assignments on log.</div>
                      ) : (
                        academicRecord.assignments.map((a: any, idx: number) => (
                          <div key={idx} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-xs text-slate-200">{a.title}</p>
                              <span className="text-[9px] text-slate-500">Due: {new Date(a.dueDate).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${
                                a.submitted ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                              }`}>
                                {a.submitted ? 'Submitted' : 'Pending'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </GlassCard>

                  {/* Attendance Ledger logs */}
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Daily Attendance Ledger</h3>
                    <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                      {academicRecord.attendance.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs">No attendance marked yet.</div>
                      ) : (
                        academicRecord.attendance.map((a: any) => (
                          <div key={a.id} className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-xs text-slate-200">{new Date(a.date).toLocaleDateString()}</p>
                              <p className="text-[9px] text-slate-500 italic mt-0.5">{a.remarks || 'Standard Check-in'}</p>
                            </div>
                            <span className={`text-[10px] font-bold flex items-center gap-1 ${
                              a.status === 'PRESENT' ? 'text-green-400' : a.status === 'ABSENT' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                              {a.status === 'PRESENT' && <CheckCircle size={12} />}
                              {a.status === 'ABSENT' && <AlertCircle size={12} />}
                              {a.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {activeTab === 'timetable' && (
              <GlassCard className="space-y-6 animate-fade-in">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Calendar className="text-brand-500" size={18} />
                    Class Timetable Schedule
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Weekly academic lectures and class schedule for {academicRecord?.studentProfile?.firstName} {academicRecord?.studentProfile?.lastName}.
                  </p>
                </div>

                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(dayNum => {
                    const dayLectures = mockDb.timetables
                      .filter(t => t.classId === academicRecord?.studentProfile?.classId && t.dayOfWeek === dayNum)
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
                              const teacher = lecture.teacherId ? mockDb.teachers.find(t => t.id === lecture.teacherId) : null;
                              const teacherUser = teacher ? mockDb.users.find(u => u.id === teacher.userId) : null;
                              
                              return (
                                <div 
                                  key={lecture.id} 
                                  className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex justify-between items-center hover:border-brand-500/20 transition-all duration-300 group"
                                >
                                  <div className="space-y-1">
                                    <h5 className="font-bold text-slate-200 text-xs group-hover:text-brand-400 transition-colors">
                                      {subject ? subject.name : 'Course Lecture'}
                                    </h5>
                                    <p className="text-[10px] text-slate-450 font-medium">
                                      Instructor: {teacherUser ? `${teacherUser.firstName} ${teacherUser.lastName}` : 'Guest Faculty'}
                                    </p>
                                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-1.5 font-sans">
                                      <span className="flex items-center gap-1">
                                        <Clock size={11} className="text-slate-500" />
                                        {lecture.startTime} - {lecture.endTime}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <UserIcon size={11} className="text-slate-500" />
                                        {lecture.classroomNumber || 'Main Lecture Hall'}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="w-9 h-9 rounded-xl bg-slate-900/60 border border-slate-850 flex items-center justify-center font-bold text-xs text-slate-500 group-hover:text-brand-400 group-hover:border-brand-500/25 transition-all">
                                    {lecture.startTime.split(':')[0]}
                                  </span>
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
            )}

            {activeTab === 'grades' && (
              <GlassCard className="space-y-6">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Award className="text-brand-500" size={18} />
                    Midterm Exam Report Card Grades
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 font-bold">
                        <th className="py-3 px-4">Subject Name</th>
                        <th className="py-3 px-4">Subject Code</th>
                        <th className="py-3 px-4">Marks Obtained</th>
                        <th className="py-3 px-4">Max Marks</th>
                        <th className="py-3 px-4">Remarks Feedback</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {academicRecord.examMarks.map((em: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-900/10 text-slate-200">
                          <td className="py-3 px-4 font-semibold">{em.subjectName}</td>
                          <td className="py-3 px-4 text-slate-400">{em.subjectCode}</td>
                          <td className="py-3 px-4">
                            {em.marksObtained !== null ? (
                              <span className={`font-bold text-sm ${em.marksObtained >= 80 ? 'text-green-400' : 'text-slate-200'}`}>
                                {em.marksObtained}
                              </span>
                            ) : (
                              <span className="text-slate-500">Ungraded</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-400">{em.maxMarks}</td>
                          <td className="py-3 px-4 text-slate-400 italic max-w-xs truncate">{em.remarks || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            )}

            {activeTab === 'fees' && (
              <PremiumLock 
                isLocked={!plan.features.billing} 
                requiredTier="Basic" 
                featureName="Fee Management"
              >
                <GlassCard className="space-y-6">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <DollarSign className="text-brand-500" size={18} />
                      Outstanding Fee Structure & Invoices
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {academicRecord.fees.map((f: any, idx: number) => (
                      <div key={idx} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div className="space-y-1">
                          <span className={`text-[9.5px] font-bold tracking-wider px-2.5 py-0.5 rounded-full uppercase border ${
                            f.status === 'PAID' 
                              ? 'bg-green-500/10 border-green-500/15 text-green-400' 
                              : f.status === 'PENDING' 
                                ? 'bg-amber-500/10 border-amber-500/15 text-amber-400' 
                                : 'bg-red-500/10 border-red-500/15 text-red-400'
                          }`}>
                            {f.status}
                          </span>
                          <h4 className="font-bold text-slate-200 text-sm mt-2">{f.description}</h4>
                          <p className="text-xs text-slate-400">Total Bill Amount: ${f.amount.toFixed(2)}</p>
                          <p className="text-[10px] text-slate-500">Bill Due: {new Date(f.dueDate).toLocaleDateString()}</p>
                        </div>

                        {f.status === 'PAID' && (
                          <div className="text-[10px] text-slate-500 border-t border-slate-850 pt-2 flex justify-between">
                            <span>Receipt Download Ready</span>
                            <span>Paid on {new Date(f.paymentDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </PremiumLock>
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
                    Discussion boards are currently in read-only mode for parents. To discuss academic performance or syllabus details, please open the direct secure Chat Messenger drawer and select your child's homeroom teacher.
                  </p>
                </GlassCard>
              </PremiumLock>
            )}

            {activeTab === 'materials' && (
              <GlassCard className="space-y-6">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <BookOpen className="text-brand-500" size={18} />
                    Ward's Academic Study Materials & Video Lectures
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

                {materialsLoading ? (
                  <div className="text-center py-12 text-slate-400 italic text-sm">
                    Loading study materials...
                  </div>
                ) : materials.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic text-sm">
                    No academic materials uploaded for this student's subjects yet.
                  </div>
                ) : (
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
                              <Play size={14} className="text-brand-500" />
                              Stream Live
                            </button>
                          ) : (
                            <a 
                              href={m.fileUrl} 
                              download 
                              className="text-brand-400 hover:text-brand-300 flex items-center gap-1 font-semibold text-xs transition-colors"
                            >
                              <Download size={14} className="text-brand-500" />
                              Get File
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>
            )}

            {activeTab === 'quizzes' && (
              <PremiumLock 
                isLocked={!plan.features.quizzes} 
                requiredTier="Basic" 
                featureName="Quizzes & Interactive Online Tests"
              >
                <GlassCard className="space-y-6">
                  <div className="border-b border-slate-850 pb-3">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2">
                      <Award className="text-brand-500" size={18} />
                      Ward's Quizzes & Interactive Test Results
                    </h3>
                  </div>

                  {quizzes.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 italic text-xs">
                      No quizzes published for this student's subjects yet.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {quizzes.map(({ quiz, attempt }) => {
                        const subject = mockDb.subjects.find(s => s.id === quiz.subjectId);
                        
                        // Calculate score details if attempted
                        let correctCount = 0;
                        let incorrectCount = 0;
                        if (attempt) {
                          const questions = mockDb.quizQuestions.filter(q => q.quizId === quiz.id);
                          questions.forEach(q => {
                            const studentAns = attempt.answers ? attempt.answers[q.id] : undefined;
                            if (studentAns !== undefined && studentAns === q.correctOption) {
                              correctCount++;
                            } else {
                              incorrectCount++;
                            }
                          });
                        }

                        return (
                          <div key={quiz.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                            <div className="space-y-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{subject ? subject.name : 'Subject'}</span>
                              <h4 className="font-bold text-slate-200 text-sm mt-0.5">{quiz.title}</h4>
                              <p className="text-xs text-slate-400">Duration: {quiz.durationMinutes} minutes | Marks: {quiz.totalMarks}</p>
                            </div>
                            
                            <div className="pt-3 border-t border-slate-850 flex flex-col gap-2">
                              {attempt ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Status:</span>
                                    <span className="text-green-400 font-bold bg-green-500/10 px-2 py-0.5 rounded uppercase tracking-wider text-[10px]">Attempted</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Marks:</span>
                                    <span className="text-slate-200 font-bold">{attempt.score} / {quiz.totalMarks} ({Math.round((attempt.score / quiz.totalMarks) * 100)}%)</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Correct Answers:</span>
                                    <span className="text-green-400 font-bold">{correctCount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-xs">
                                    <span className="text-slate-400 font-semibold">Incorrect Answers:</span>
                                    <span className="text-red-400 font-bold">{incorrectCount}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 italic mt-1">
                                    <span>Taken: {new Date(attempt.attemptedAt).toLocaleString()}</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-slate-500">Status:</span>
                                  <span className="text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded uppercase tracking-wider text-[10px]">Not Taken Yet</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </GlassCard>
              </PremiumLock>
            )}

          </div>
        )
      )}
    </div>
  );
};
