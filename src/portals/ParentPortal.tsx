import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { Student, User } from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Eye, Award, DollarSign, Calendar, FileText, 
  User as UserIcon, ShieldAlert, CheckCircle, AlertCircle, UsersRound, Clock
} from 'lucide-react';

export const ParentPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session } = useStore();
  const parentId = session?.parentId;

  // States
  const [assignedStudents, setAssignedStudents] = useState<(Student & { userDetails: User; className: string })[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [academicRecord, setAcademicRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load parent's students
  const loadAssignedStudents = async () => {
    if (!parentId) return;
    try {
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
      const data = await mockApi.parentGetStudentAcademicRecord(parentId, selectedStudent);
      setAcademicRecord(data);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Access Denied: Isolation boundary violation');
      setAcademicRecord(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssignedStudents();
  }, [parentId]);

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
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          f.status === 'PAID' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
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
            )}

            {activeTab === 'forums' && (
              <GlassCard className="space-y-4">
                <h3 className="font-bold text-slate-100">Discussion Boards</h3>
                <p className="text-xs text-slate-400">
                  Discussion boards are currently in read-only mode for parents. To discuss academic performance or syllabus details, please open the direct secure Chat Messenger drawer and select your child's homeroom teacher.
                </p>
              </GlassCard>
            )}

          </div>
        )
      )}
    </div>
  );
};
