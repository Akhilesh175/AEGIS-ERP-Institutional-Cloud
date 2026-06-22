import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import { PTMMeeting, PTMAttendance, PTMFeedback, PTMParentFeedback, PTMFollowup } from '../types';
import { 
  Calendar, Video, FileText, Download, Users, Plus, Trash, 
  Check, X, ClipboardCheck, AlertCircle, RefreshCw, BarChart2, 
  MessageSquare, UserPlus, Clock, MapPin, Eye, ExternalLink, Filter
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { jsPDF } from 'jspdf';

export const PTMManagement: React.FC = () => {
  const { session } = useStore();
  const schoolId = session?.user?.schoolId || '';
  const currentRole = session?.user?.role || 'TEACHER';
  const currentUserId = session?.user?.id || '';

  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<PTMMeeting[]>([]);
  const [roleSpecificId, setRoleSpecificId] = useState<string>('');

  // Fetch PTM meetings based on role
  const loadMeetings = async () => {
    if (!schoolId) return;
    setLoading(true);
    try {
      let resolvedId = '';
      let opts: any = {};
      
      if (currentRole === 'TEACHER') {
        const { data: teacher } = await supabase
          .from('teachers')
          .select('id')
          .eq('user_id', currentUserId)
          .single();
        if (teacher) {
          resolvedId = teacher.id;
          setRoleSpecificId(teacher.id);
          opts.teacherId = teacher.id;
        }
      } else if (currentRole === 'STUDENT') {
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('user_id', currentUserId)
          .single();
        if (student) {
          resolvedId = student.id;
          setRoleSpecificId(student.id);
          opts.studentId = student.id;
        }
      } else if (currentRole === 'PARENT') {
        resolvedId = currentUserId;
        setRoleSpecificId(currentUserId);
        opts.parentId = currentUserId;
      }

      const fetched = await mockApi.fetchPTMMeetings(schoolId, opts);
      setMeetings(fetched);
    } catch (err) {
      console.error('Error fetching PTM meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [schoolId, currentRole, currentUserId]);

  const downloadPTMSummary = async (meeting: PTMMeeting) => {
    try {
      const feedback = await mockApi.fetchPTMFeedback(meeting.id);
      const parentFeedback = await mockApi.fetchPTMParentFeedback(meeting.id);
      const followups = await mockApi.fetchPTMFollowups(meeting.id);
      const attendance = await mockApi.fetchPTMAttendance(meeting.id);

      const doc = new jsPDF();
      
      // Slate Header Accent
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.text("AEGIS ERP - PTM SUMMARY REPORT", 15, 25);
      
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated on: ${new Date().toLocaleString()}`, 15, 48);
      doc.text(`Meeting Mode: ${meeting.meetingMode}`, 15, 54);
      doc.text(`Scheduled Date: ${meeting.scheduledDate} (${meeting.startTime} - ${meeting.endTime})`, 15, 60);

      // Info Block Card
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 68, 182, 35, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.rect(14, 68, 182, 35);
      
      doc.setTextColor(15, 23, 42);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("PARTICIPANT DETAILS", 18, 75);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Teacher: ${meeting.teacherName}`, 18, 83);
      doc.text(`Parent: ${meeting.parentName}`, 18, 89);
      doc.text(`Student: ${meeting.studentName} (${meeting.className} ${meeting.sectionName || ''})`, 18, 95);

      // Attendance
      const attStatus = attendance?.attendanceStatus || 'ABSENT';
      doc.setFont("helvetica", "bold");
      doc.text("ATTENDANCE STATUS:", 110, 75);
      doc.setFont("helvetica", "normal");
      doc.text(`${attStatus}`, 110, 83);

      // Teacher feedback
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("TEACHER FEEDBACK & ACADEMIC REMARKS", 15, 115);
      doc.setLineWidth(0.5);
      doc.line(15, 117, 195, 117);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Strengths: ${feedback?.strengths || 'None logged'}`, 15, 125);
      doc.text(`Areas of Improvement: ${feedback?.weaknesses || 'None logged'}`, 15, 133);
      doc.text(`Recommendations: ${feedback?.recommendations || 'None logged'}`, 15, 141);
      doc.text(`Behavioural Notes: ${feedback?.behaviouralNotes || 'None logged'}`, 15, 149);

      // Parent feedback
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("PARENT FEEDBACK & CONCERNS", 15, 165);
      doc.line(15, 167, 195, 167);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Questions/Concerns: ${parentFeedback?.questions || 'None logged'}`, 15, 175);
      doc.text(`Suggestions: ${parentFeedback?.suggestions || 'None logged'}`, 15, 183);
      doc.text(`Comments: ${parentFeedback?.comments || 'None logged'}`, 15, 191);

      // Actions follow-up
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("ACTION PLAN & FOLLOW-UP TASKS", 15, 207);
      doc.line(15, 209, 195, 209);

      let yOffset = 217;
      if (followups && followups.length > 0) {
        followups.forEach((task, idx) => {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          doc.text(`${idx + 1}. [${task.assignedTo}] ${task.task} (Due: ${task.dueDate}, Priority: ${task.priority}) - Status: ${task.status}`, 15, yOffset);
          yOffset += 8;
        });
      } else {
        doc.text("No follow-up action plan tasks logged.", 15, yOffset);
      }

      doc.save(`PTM_Summary_Report_${meeting.id.substring(0, 8)}.pdf`);
    } catch (e) {
      console.error('Error generating PDF:', e);
    }
  };

  const handleJoinMeet = (meetingId: string) => {
    // Open full-screen video meeting room
    window.location.pathname = `/meet/${meetingId}`;
  };

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#070b13] min-h-screen text-slate-200 font-sans relative selection:bg-brand-500/30 selection:text-brand-200">
      
      {/* Background radial effects */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

      {/* Title Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6 relative">
        <div>
          <div className="flex items-center gap-2 text-brand-400 font-bold uppercase tracking-wider text-xs">
            <Calendar size={14} /> PTM Portal
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mt-1">
            Parent-Teacher Meetings
          </h1>
          <p className="text-slate-400 text-xs mt-1 max-w-xl">
            Enterprise grade portal for scheduling, parent feedback logging, academic performance updates, and native WebRTC video meeting tools.
          </p>
        </div>

        <button 
          onClick={loadMeetings} 
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-800 bg-[#0d1527]/60 hover:bg-[#131f3b] text-slate-300 font-semibold text-xs tracking-wider uppercase rounded-xl transition-all shadow-md active:scale-95"
        >
          <RefreshCw size={12} /> Sync Data
        </button>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <RefreshCw size={36} className="animate-spin text-brand-400" />
          <p className="text-xs uppercase font-extrabold tracking-widest">Retrieving PTM state from Supabase...</p>
        </div>
      ) : (
        <>
          {currentRole === 'TEACHER' && (
            <PTMTeacherView 
              schoolId={schoolId}
              teacherId={roleSpecificId} 
              meetings={meetings} 
              onReload={loadMeetings}
              onDownloadPDF={downloadPTMSummary}
              onJoinMeet={handleJoinMeet}
            />
          )}

          {currentRole === 'PARENT' && (
            <PTMParentView 
              schoolId={schoolId}
              parentId={roleSpecificId} 
              meetings={meetings} 
              onReload={loadMeetings}
              onDownloadPDF={downloadPTMSummary}
              onJoinMeet={handleJoinMeet}
            />
          )}

          {currentRole === 'STUDENT' && (
            <PTMStudentView 
              meetings={meetings} 
              onDownloadPDF={downloadPTMSummary}
            />
          )}

          {(currentRole === 'ADMIN' || currentRole === 'SUPER_ADMIN' || currentRole === 'ACADEMIC_ADMIN') && (
            <PTMAdminView 
              schoolId={schoolId} 
              meetings={meetings}
              onReload={loadMeetings}
            />
          )}
        </>
      )}

    </div>
  );
};

// ============================================================================
// 1. TEACHER PORTAL SUB-VIEW
// ============================================================================
interface TeacherViewProps {
  schoolId: string;
  teacherId: string;
  meetings: PTMMeeting[];
  onReload: () => void;
  onDownloadPDF: (meeting: PTMMeeting) => void;
  onJoinMeet: (id: string) => void;
}

const PTMTeacherView: React.FC<TeacherViewProps> = ({ schoolId, teacherId, meetings, onReload, onDownloadPDF, onJoinMeet }) => {
  const [classes, setClasses] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [resolvedParent, setResolvedParent] = useState<{ id: string; name: string } | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<'ONLINE' | 'OFFLINE' | 'HYBRID'>('ONLINE');
  const [venue, setVenue] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Modals state
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [activeFeedbackMeeting, setActiveFeedbackMeeting] = useState<PTMMeeting | null>(null);
  const [activeAttendanceMeeting, setActiveAttendanceMeeting] = useState<PTMMeeting | null>(null);

  // Feedback states
  const [strengths, setStrengths] = useState('');
  const [weaknesses, setWeaknesses] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [behaviouralNotes, setBehaviouralNotes] = useState('');
  const [actionPlan, setActionPlan] = useState('');

  // Attendance states
  const [attendanceRecord, setAttendanceRecord] = useState<PTMAttendance | null>(null);

  // Load scheduler config options
  useEffect(() => {
    const loadOpts = async () => {
      try {
        const cls = await mockApi.adminGetClasses();
        setClasses(cls);
        const sts = await mockApi.adminGetStudents();
        setStudents(sts);
      } catch (e) {
        console.error(e);
      }
    };
    if (isScheduleOpen) {
      loadOpts();
    }
  }, [isScheduleOpen]);

  // Resolve parent whenever student is picked
  useEffect(() => {
    const resolveParent = async () => {
      if (!selectedStudent) {
        setResolvedParent(null);
        return;
      }
      try {
        const { data: mapping } = await supabase
          .from('parent_student_mapping')
          .select('parent_id')
          .eq('student_id', selectedStudent)
          .maybeSingle();

        if (mapping) {
          const { data: user } = await supabase
            .from('users')
            .select('first_name, last_name')
            .eq('id', mapping.parent_id)
            .single();

          if (user) {
            setResolvedParent({
              id: mapping.parent_id,
              name: `${user.first_name || ''} ${user.last_name || ''}`.trim()
            });
          }
        }
      } catch (err) {
        console.error('Error resolving student parent:', err);
      }
    };
    resolveParent();
  }, [selectedStudent]);

  // Handle schedule submit
  const handleSchedulePTM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClass || !selectedStudent || !resolvedParent || !title || !date || !startTime || !endTime) {
      alert('Please fill out all required scheduling fields.');
      return;
    }

    try {
      const meetId = Math.random().toString(36).substring(2, 10);
      const link = mode === 'ONLINE' || mode === 'HYBRID' ? `https://aegiserp.xyz/meet/${meetId}` : undefined;
      
      await mockApi.createPTMMeeting({
        schoolId,
        classId: selectedClass,
        studentId: selectedStudent,
        parentId: resolvedParent.id,
        teacherId,
        title,
        description,
        meetingMode: mode,
        venue: mode === 'OFFLINE' || mode === 'HYBRID' ? venue : undefined,
        meetingLink: link,
        scheduledDate: date,
        startTime,
        endTime,
        status: 'SCHEDULED'
      });

      setIsScheduleOpen(false);
      // reset form
      setTitle('');
      setDescription('');
      setSelectedClass('');
      setSelectedStudent('');
      onReload();
    } catch (e) {
      console.error(e);
      alert('Failed to schedule PTM');
    }
  };

  // Open feedback panel
  const openFeedback = async (m: PTMMeeting) => {
    setActiveFeedbackMeeting(m);
    try {
      const f = await mockApi.fetchPTMFeedback(m.id);
      if (f) {
        setStrengths(f.strengths || '');
        setWeaknesses(f.weaknesses || '');
        setRecommendations(f.recommendations || '');
        setBehaviouralNotes(f.behaviouralNotes || '');
        setActionPlan(f.actionPlan || '');
      } else {
        setStrengths('');
        setWeaknesses('');
        setRecommendations('');
        setBehaviouralNotes('');
        setActionPlan('');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveFeedback = async () => {
    if (!activeFeedbackMeeting) return;
    try {
      await mockApi.submitPTMFeedback(activeFeedbackMeeting.id, {
        meetingId: activeFeedbackMeeting.id,
        strengths,
        weaknesses,
        recommendations,
        behaviouralNotes,
        actionPlan
      });
      setActiveFeedbackMeeting(null);
      onReload();
    } catch (err) {
      console.error(err);
      alert('Failed to submit feedback');
    }
  };

  // Open attendance modal
  const openAttendance = async (m: PTMMeeting) => {
    setActiveAttendanceMeeting(m);
    try {
      const att = await mockApi.fetchPTMAttendance(m.id);
      setAttendanceRecord(att);
    } catch (e) {
      console.error(e);
    }
  };

  const updateAttendanceStatus = async (status: 'PRESENT' | 'ABSENT' | 'LATE' | 'PARTIAL') => {
    if (!activeAttendanceMeeting) return;
    try {
      const updated = await mockApi.updatePTMAttendance(activeAttendanceMeeting.id, {
        attendanceStatus: status,
        teacherJoinTime: status === 'PRESENT' ? new Date().toISOString() : null,
        parentJoinTime: status === 'PRESENT' ? new Date().toISOString() : null
      });
      
      // Auto complete the meeting if marked present/absent
      if (status === 'PRESENT' || status === 'ABSENT') {
        await mockApi.updatePTMMeeting(activeAttendanceMeeting.id, { status: 'COMPLETED' });
      }

      setAttendanceRecord(updated);
      setActiveAttendanceMeeting(null);
      onReload();
    } catch (e) {
      console.error(e);
      alert('Failed to update attendance');
    }
  };

  const cancelPTM = async (meetingId: string) => {
    if (!confirm('Are you sure you want to cancel this meeting?')) return;
    try {
      await mockApi.updatePTMMeeting(meetingId, { status: 'CANCELLED' });
      onReload();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6 relative">
      
      {/* Action Buttons Panel */}
      <div className="flex justify-end relative">
        <button 
          onClick={() => setIsScheduleOpen(true)}
          className="flex items-center gap-2 px-5 py-3 bg-brand-600 hover:bg-brand-700 font-extrabold text-xs uppercase tracking-wider text-slate-950 rounded-xl transition-all shadow-lg active:scale-95 border border-brand-500/25"
        >
          <Plus size={16} /> Schedule PTM
        </button>
      </div>

      {/* Meetings Registry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {meetings.map(m => (
          <GlassCard key={m.id} className="p-6 bg-[#0b101d]/75 border-slate-800/80 hover:border-slate-700/60 shadow-xl transition-all hover:-translate-y-0.5 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  m.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  m.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  {m.status}
                </span>
                <h3 className="font-extrabold text-white text-base mt-2">{m.title}</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{m.description || 'No description provided'}</p>
              </div>

              {/* Meeting Mode Badge */}
              <div className="flex flex-col items-end text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-widest text-[9px] bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded">
                  {m.meetingMode}
                </span>
              </div>
            </div>

            {/* Meta Rows */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-900 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Student & Class</div>
                <div className="text-slate-200 font-bold">{m.studentName}</div>
                <div className="text-slate-400 font-semibold">{m.className} {m.sectionName || ''}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Scheduled Time</div>
                <div className="text-slate-200 font-bold">{m.scheduledDate}</div>
                <div className="text-slate-400 font-semibold">{m.startTime} - {m.endTime}</div>
              </div>
            </div>

            {m.parentPreQuestions && (
              <div className="bg-[#131b2e]/60 border border-slate-800/80 rounded-lg p-3 text-xs leading-relaxed text-slate-300">
                <span className="font-bold text-brand-400 block mb-1">Parent Questions:</span>
                "{m.parentPreQuestions}"
              </div>
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-900">
              
              <div className="flex gap-2">
                {m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && (
                  <>
                    <button 
                      onClick={() => openFeedback(m)}
                      className="px-3.5 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-slate-700/80 transition-all active:scale-95"
                    >
                      Feedback
                    </button>
                    <button 
                      onClick={() => openAttendance(m)}
                      className="px-3.5 py-2 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 font-bold text-[10px] uppercase tracking-wider rounded-lg border border-slate-700/80 transition-all active:scale-95"
                    >
                      Attendance
                    </button>
                  </>
                )}
                {m.status === 'COMPLETED' && (
                  <button 
                    onClick={() => onDownloadPDF(m)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/35 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all active:scale-95"
                  >
                    <Download size={12} /> Summary
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && (
                  <button 
                    onClick={() => cancelPTM(m.id)}
                    className="px-3.5 py-2 bg-red-600/25 border border-red-500/30 text-red-400 hover:bg-red-600/35 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                )}
                
                {(m.meetingMode === 'ONLINE' || m.meetingMode === 'HYBRID') && m.status !== 'CANCELLED' && m.status !== 'COMPLETED' && (
                  <button 
                    onClick={() => onJoinMeet(m.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white hover:bg-blue-600 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-md active:scale-95"
                  >
                    <Video size={12} /> Start Meet
                  </button>
                )}
              </div>

            </div>
          </GlassCard>
        ))}

        {meetings.length === 0 && (
          <div className="col-span-2 text-center py-20 bg-[#0c1222]/30 border border-dashed border-slate-800 rounded-2xl text-slate-500">
            <Calendar size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold uppercase tracking-wider">No Scheduled Meetings</p>
            <p className="text-xs text-slate-600 mt-1">Use the "Schedule PTM" button to request meeting blocks.</p>
          </div>
        )}
      </div>

      {/* SCHEDULE MODAL */}
      {isScheduleOpen && (
        <div className="fixed inset-0 z-50 bg-[#04060d]/80 flex items-center justify-center p-4 backdrop-blur-md">
          <GlassCard className="max-w-lg w-full p-6 bg-[#0b101d] border-slate-800 shadow-2xl relative space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-900 pb-3">
              <Calendar size={18} className="text-brand-400" /> Schedule PTM Meeting
            </h2>
            <form onSubmit={handleSchedulePTM} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Select Class *</label>
                  <select 
                    value={selectedClass} 
                    onChange={e => {
                      setSelectedClass(e.target.value);
                      setSelectedStudent('');
                    }}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                    required
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Select Student *</label>
                  <select 
                    value={selectedStudent} 
                    onChange={e => setSelectedStudent(e.target.value)}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none focus:border-brand-500"
                    disabled={!selectedClass}
                    required
                  >
                    <option value="">-- Choose Student --</option>
                    {students.filter(s => s.classId === selectedClass).map(s => (
                      <option key={s.id} value={s.id}>{s.userDetails.firstName} {s.userDetails.lastName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {resolvedParent && (
                <div className="bg-[#131b2e]/60 border border-slate-800 rounded-lg p-3 flex justify-between items-center text-xs">
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase font-bold block">Resolved Mapped Parent</span>
                    <span className="text-slate-200 font-bold">{resolvedParent.name}</span>
                  </div>
                  <Check size={16} className="text-emerald-400" />
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Meeting Title *</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. Academic Performance Discussion"
                  className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Briefly state meeting details..."
                  className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white h-20 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Meeting Mode *</label>
                  <select 
                    value={mode} 
                    onChange={e => setMode(e.target.value as any)}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                    required
                  >
                    <option value="ONLINE">ONLINE (AEGIS Meet)</option>
                    <option value="OFFLINE">OFFLINE (In-Person)</option>
                    <option value="HYBRID">HYBRID</option>
                  </select>
                </div>

                {(mode === 'OFFLINE' || mode === 'HYBRID') && (
                  <div>
                    <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Venue / Room Location *</label>
                    <input 
                      type="text" 
                      value={venue} 
                      onChange={e => setVenue(e.target.value)}
                      placeholder="e.g. Conference Room 3"
                      className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                      required
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Date *</label>
                  <input 
                    type="date" 
                    value={date} 
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Start Time *</label>
                  <input 
                    type="time" 
                    value={startTime} 
                    onChange={e => setStartTime(e.target.value)}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">End Time *</label>
                  <input 
                    type="time" 
                    value={endTime} 
                    onChange={e => setEndTime(e.target.value)}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-900">
                <button 
                  type="button" 
                  onClick={() => setIsScheduleOpen(false)}
                  className="px-4 py-2 border border-slate-800 bg-[#0d1527] hover:bg-[#131f3b] text-slate-300 font-bold uppercase rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-slate-950 font-black uppercase rounded-lg transition-all"
                >
                  Create Meeting
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* FEEDBACK MODAL */}
      {activeFeedbackMeeting && (
        <div className="fixed inset-0 z-50 bg-[#04060d]/80 flex items-center justify-center p-4 backdrop-blur-md">
          <GlassCard className="max-w-lg w-full p-6 bg-[#0b101d] border-slate-800 shadow-2xl relative space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-900 pb-3">
              <ClipboardCheck size={18} className="text-brand-400" /> Log Teacher Feedback
            </h2>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Student Strengths</label>
                <textarea 
                  value={strengths} 
                  onChange={e => setStrengths(e.target.value)}
                  placeholder="e.g. Excellent active participation in Mathematics class..."
                  className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white h-16 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Areas of Improvement</label>
                <textarea 
                  value={weaknesses} 
                  onChange={e => setWeaknesses(e.target.value)}
                  placeholder="e.g. Needs to submit homework assignments on time..."
                  className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white h-16 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">General Recommendations</label>
                <textarea 
                  value={recommendations} 
                  onChange={e => setRecommendations(e.target.value)}
                  placeholder="e.g. Recommend reading additional study books in Science..."
                  className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white h-16 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Behavioural Notes</label>
                  <input 
                    type="text"
                    value={behaviouralNotes} 
                    onChange={e => setBehaviouralNotes(e.target.value)}
                    placeholder="e.g. Attentive & respectful"
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Action Plan / Next Steps</label>
                  <input 
                    type="text"
                    value={actionPlan} 
                    onChange={e => setActionPlan(e.target.value)}
                    placeholder="e.g. Weekly review of tests"
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-slate-900">
                <button 
                  onClick={() => setActiveFeedbackMeeting(null)}
                  className="px-4 py-2 border border-slate-800 bg-[#0d1527] hover:bg-[#131f3b] text-slate-300 font-bold uppercase rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveFeedback}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-slate-950 font-black uppercase rounded-lg transition-all"
                >
                  Save Remarks
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ATTENDANCE MODAL */}
      {activeAttendanceMeeting && (
        <div className="fixed inset-0 z-50 bg-[#04060d]/80 flex items-center justify-center p-4 backdrop-blur-md">
          <GlassCard className="max-w-md w-full p-6 bg-[#0b101d] border-slate-800 shadow-2xl relative space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-900 pb-3">
              <ClipboardCheck size={18} className="text-brand-400" /> Log PTM Attendance
            </h2>
            <div className="space-y-4 text-xs text-center py-4">
              <p className="text-slate-300">Choose meeting status to mark participant attendance:</p>
              
              <div className="flex flex-col gap-2.5 max-w-xs mx-auto">
                <button 
                  onClick={() => updateAttendanceStatus('PRESENT')}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 font-extrabold uppercase rounded-lg text-white transition-all shadow"
                >
                  Present (Admitted)
                </button>
                <button 
                  onClick={() => updateAttendanceStatus('ABSENT')}
                  className="w-full py-2.5 bg-red-600 hover:bg-red-700 font-extrabold uppercase rounded-lg text-white transition-all shadow"
                >
                  Absent
                </button>
                <button 
                  onClick={() => updateAttendanceStatus('LATE')}
                  className="w-full py-2.5 bg-yellow-600 hover:bg-yellow-700 font-extrabold uppercase rounded-lg text-white transition-all shadow"
                >
                  Late Joined
                </button>
              </div>

              <div className="flex justify-center pt-6 border-t border-slate-900">
                <button 
                  onClick={() => setActiveAttendanceMeeting(null)}
                  className="px-4 py-2 border border-slate-800 bg-[#0d1527] hover:bg-[#131f3b] text-slate-300 font-bold uppercase rounded-lg transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

    </div>
  );
};

// ============================================================================
// 2. PARENT PORTAL SUB-VIEW
// ============================================================================
interface ParentViewProps {
  schoolId: string;
  parentId: string;
  meetings: PTMMeeting[];
  onReload: () => void;
  onDownloadPDF: (meeting: PTMMeeting) => void;
  onJoinMeet: (id: string) => void;
}

const PTMParentView: React.FC<ParentViewProps> = ({ schoolId, parentId, meetings, onReload, onDownloadPDF, onJoinMeet }) => {
  const [activeTab, setActiveTab] = useState<'UPCOMING' | 'HISTORY'>('UPCOMING');
  
  // Pre-questions state
  const [activePreQuestionMeeting, setActivePreQuestionMeeting] = useState<PTMMeeting | null>(null);
  const [questionsText, setQuestionsText] = useState('');

  // Reschedule state
  const [activeRescheduleMeeting, setActiveRescheduleMeeting] = useState<PTMMeeting | null>(null);
  const [reason, setReason] = useState('');
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');

  // Confirm attendance
  const confirmAttendance = async (meetingId: string) => {
    try {
      await mockApi.updatePTMMeeting(meetingId, { 
        parentConfirmedAttendance: true,
        status: 'CONFIRMED'
      });
      await mockApi.updatePTMAttendance(meetingId, {
        parentJoinTime: new Date().toISOString()
      });
      onReload();
    } catch (e) {
      console.error(e);
    }
  };

  // Submit questions
  const saveQuestions = async () => {
    if (!activePreQuestionMeeting) return;
    try {
      await mockApi.updatePTMMeeting(activePreQuestionMeeting.id, {
        parentPreQuestions: questionsText
      });
      setActivePreQuestionMeeting(null);
      setQuestionsText('');
      onReload();
    } catch (e) {
      console.error(e);
    }
  };

  // Reschedule request submit
  const submitReschedule = async () => {
    if (!activeRescheduleMeeting) return;
    try {
      await mockApi.updatePTMMeeting(activeRescheduleMeeting.id, {
        status: 'RESCHEDULE_REQUESTED',
        rescheduleReason: reason,
        rescheduleSuggestedDate: suggestedDate,
        rescheduleSuggestedTime: suggestedTime
      });
      setActiveRescheduleMeeting(null);
      setReason('');
      setSuggestedDate('');
      setSuggestedTime('');
      onReload();
    } catch (e) {
      console.error(e);
    }
  };

  const upcomingMeetings = meetings.filter(m => m.status !== 'COMPLETED' && m.status !== 'CANCELLED');
  const pastMeetings = meetings.filter(m => m.status === 'COMPLETED' || m.status === 'CANCELLED');

  return (
    <div className="space-y-6">
      
      {/* Tabs */}
      <div className="flex border-b border-slate-800/80">
        <button 
          onClick={() => setActiveTab('UPCOMING')}
          className={`px-6 py-3 text-xs uppercase tracking-widest font-black transition-all ${
            activeTab === 'UPCOMING' ? 'border-b-2 border-brand-500 text-brand-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Upcoming Meetings
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={`px-6 py-3 text-xs uppercase tracking-widest font-black transition-all ${
            activeTab === 'HISTORY' ? 'border-b-2 border-brand-500 text-brand-400' : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          Meeting History
        </button>
      </div>

      {/* Render Meetings grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(activeTab === 'UPCOMING' ? upcomingMeetings : pastMeetings).map(m => (
          <GlassCard key={m.id} className="p-6 bg-[#0b101d]/75 border-slate-800/80 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  m.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  m.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  {m.status}
                </span>
                <h3 className="font-extrabold text-white text-base mt-2">{m.title}</h3>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">{m.description || 'No description provided'}</p>
              </div>

              <div className="flex flex-col items-end text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-widest text-[9px] bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded">
                  {m.meetingMode}
                </span>
              </div>
            </div>

            {/* Meta Rows */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-900 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Teacher & Student</div>
                <div className="text-slate-200 font-bold">{m.teacherName}</div>
                <div className="text-slate-400 font-semibold">{m.studentName} ({m.className})</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Scheduled Date</div>
                <div className="text-slate-200 font-bold">{m.scheduledDate}</div>
                <div className="text-slate-400 font-semibold">{m.startTime} - {m.endTime}</div>
              </div>
            </div>

            {/* Questions area */}
            {m.parentPreQuestions ? (
              <div className="bg-[#131b2e]/60 border border-slate-800/80 rounded-lg p-3 text-xs leading-relaxed text-slate-300">
                <span className="font-bold text-brand-400 block mb-1">Your Questions:</span>
                "{m.parentPreQuestions}"
              </div>
            ) : (
              m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && (
                <button 
                  onClick={() => {
                    setActivePreQuestionMeeting(m);
                    setQuestionsText('');
                  }}
                  className="text-xs text-brand-400 hover:text-brand-300 underline font-bold tracking-wide"
                >
                  + Submit Questions/Concerns Before Meeting
                </button>
              )
            )}

            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-900">
              
              <div className="flex gap-2">
                {m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && !m.parentConfirmedAttendance && (
                  <button 
                    onClick={() => confirmAttendance(m.id)}
                    className="flex items-center gap-1 px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all shadow"
                  >
                    Confirm Attendance
                  </button>
                )}
                {m.status === 'COMPLETED' && (
                  <button 
                    onClick={() => onDownloadPDF(m)}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/35 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all"
                  >
                    <Download size={12} /> Download Report
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                {m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && (
                  <button 
                    onClick={() => setActiveRescheduleMeeting(m)}
                    className="px-3.5 py-2 bg-slate-850 hover:bg-slate-750 text-slate-300 border border-slate-800 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all"
                  >
                    Request Reschedule
                  </button>
                )}

                {(m.meetingMode === 'ONLINE' || m.meetingMode === 'HYBRID') && m.status !== 'COMPLETED' && m.status !== 'CANCELLED' && (
                  <button 
                    onClick={() => onJoinMeet(m.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-[#2563eb] text-white hover:bg-blue-600 font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all shadow-md active:scale-95"
                  >
                    <Video size={12} /> Join Call
                  </button>
                )}
              </div>

            </div>
          </GlassCard>
        ))}

        {((activeTab === 'UPCOMING' ? upcomingMeetings : pastMeetings).length === 0) && (
          <div className="col-span-2 text-center py-20 bg-[#0c1222]/30 border border-dashed border-slate-800 rounded-2xl text-slate-500">
            <Calendar size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold uppercase tracking-wider">No Meetings Found</p>
          </div>
        )}
      </div>

      {/* PRE-QUESTION MODAL */}
      {activePreQuestionMeeting && (
        <div className="fixed inset-0 z-50 bg-[#04060d]/80 flex items-center justify-center p-4 backdrop-blur-md">
          <GlassCard className="max-w-md w-full p-6 bg-[#0b101d] border-slate-800 shadow-2xl relative space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-900 pb-3">
              <MessageSquare size={18} className="text-brand-400" /> Submit Questions
            </h2>
            <div className="space-y-4 text-xs">
              <p className="text-slate-300">Enter questions or performance areas you wish to cover during the PTM:</p>
              <textarea 
                value={questionsText} 
                onChange={e => setQuestionsText(e.target.value)}
                placeholder="e.g. I would like to review the latest mathematics class tests and behavior marks..."
                className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white h-24 focus:outline-none"
              />
              <div className="flex gap-3 justify-end">
                <button 
                  onClick={() => setActivePreQuestionMeeting(null)}
                  className="px-4 py-2 border border-slate-800 bg-[#0d1527] text-slate-300 font-bold uppercase rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveQuestions}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-slate-950 font-black uppercase rounded-lg"
                >
                  Submit
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* RESCHEDULE REQUEST MODAL */}
      {activeRescheduleMeeting && (
        <div className="fixed inset-0 z-50 bg-[#04060d]/80 flex items-center justify-center p-4 backdrop-blur-md">
          <GlassCard className="max-w-md w-full p-6 bg-[#0b101d] border-slate-800 shadow-2xl relative space-y-4">
            <h2 className="text-lg font-black text-white flex items-center gap-2 border-b border-slate-900 pb-3">
              <Clock size={18} className="text-brand-400" /> Request Reschedule
            </h2>
            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Reason for Reschedule *</label>
                <textarea 
                  value={reason} 
                  onChange={e => setReason(e.target.value)}
                  placeholder="e.g. Work commitment conflict..."
                  className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white h-16 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Suggested Date *</label>
                  <input 
                    type="date" 
                    value={suggestedDate} 
                    onChange={e => setSuggestedDate(e.target.value)}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold mb-1 uppercase tracking-wider text-[9px]">Suggested Time *</label>
                  <input 
                    type="time" 
                    value={suggestedTime} 
                    onChange={e => setSuggestedTime(e.target.value)}
                    className="w-full bg-[#162038] border border-slate-700/80 rounded-lg p-2.5 text-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-3">
                <button 
                  onClick={() => setActiveRescheduleMeeting(null)}
                  className="px-4 py-2 border border-slate-800 bg-[#0d1527] text-slate-300 font-bold uppercase rounded-lg"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitReschedule}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-slate-950 font-black uppercase rounded-lg"
                >
                  Send Request
                </button>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

    </div>
  );
};

// ============================================================================
// 3. STUDENT PORTAL SUB-VIEW
// ============================================================================
interface StudentViewProps {
  meetings: PTMMeeting[];
  onDownloadPDF: (meeting: PTMMeeting) => void;
}

const PTMStudentView: React.FC<StudentViewProps> = ({ meetings, onDownloadPDF }) => {
  return (
    <div className="space-y-6">
      
      {/* Overview stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
        <GlassCard className="p-4 bg-[#0b101d]/60 border-slate-850">
          <div className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Total PTM Sessions</div>
          <div className="text-2xl font-black mt-1 text-white">{meetings.length}</div>
        </GlassCard>
        <GlassCard className="p-4 bg-[#0b101d]/60 border-slate-850">
          <div className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Completed PTMs</div>
          <div className="text-2xl font-black mt-1 text-emerald-400">{meetings.filter(m => m.status === 'COMPLETED').length}</div>
        </GlassCard>
        <GlassCard className="p-4 bg-[#0b101d]/60 border-slate-850">
          <div className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Upcoming PTMs</div>
          <div className="text-2xl font-black mt-1 text-yellow-400">{meetings.filter(m => m.status === 'SCHEDULED' || m.status === 'CONFIRMED').length}</div>
        </GlassCard>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {meetings.map(m => (
          <GlassCard key={m.id} className="p-6 bg-[#0b101d]/75 border-slate-800/80 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                  m.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  m.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                }`}>
                  {m.status}
                </span>
                <h3 className="font-extrabold text-white text-base mt-2">{m.title}</h3>
              </div>

              <div className="flex flex-col items-end text-xs">
                <span className="font-bold text-slate-300 uppercase tracking-widest text-[9px] bg-slate-800/60 border border-slate-700 px-2 py-0.5 rounded">
                  {m.meetingMode}
                </span>
              </div>
            </div>

            {/* Meta Rows */}
            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-900 text-xs">
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Teacher & Class</div>
                <div className="text-slate-200 font-bold">{m.teacherName}</div>
                <div className="text-slate-400 font-semibold">{m.className}</div>
              </div>
              <div className="space-y-1">
                <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Scheduled Date</div>
                <div className="text-slate-200 font-bold">{m.scheduledDate}</div>
                <div className="text-slate-400 font-semibold">{m.startTime} - {m.endTime}</div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-900">
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                Confirmed: {m.parentConfirmedAttendance ? 'Yes' : 'No'}
              </span>

              {m.status === 'COMPLETED' && (
                <button 
                  onClick={() => onDownloadPDF(m)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600/25 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600/35 font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all"
                >
                  <Download size={12} /> Download Report
                </button>
              )}
            </div>
          </GlassCard>
        ))}

        {meetings.length === 0 && (
          <div className="col-span-2 text-center py-20 bg-[#0c1222]/30 border border-dashed border-slate-800 rounded-2xl text-slate-500">
            <Calendar size={36} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold uppercase tracking-wider">No Meetings Found</p>
          </div>
        )}
      </div>

    </div>
  );
};

// ============================================================================
// 4. SCHOOL ADMIN PORTAL SUB-VIEW
// ============================================================================
interface AdminViewProps {
  schoolId: string;
  meetings: PTMMeeting[];
  onReload: () => void;
}

const PTMAdminView: React.FC<AdminViewProps> = ({ schoolId, meetings, onReload }) => {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        const res = await mockApi.fetchPTMAnalytics(schoolId);
        setAnalytics(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadAnalytics();
  }, [schoolId, meetings]);

  const COLORS = ['#38bdf8', '#10b981', '#f59e0b', '#ef4444'];

  const modeData = analytics ? [
    { name: 'ONLINE', value: analytics.modeCounts.ONLINE },
    { name: 'OFFLINE', value: analytics.modeCounts.OFFLINE },
    { name: 'HYBRID', value: analytics.modeCounts.HYBRID }
  ].filter(d => d.value > 0) : [];

  return (
    <div className="space-y-8">
      
      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading Analytics...</div>
      ) : analytics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
          
          {/* Card 1 */}
          <GlassCard className="p-5 bg-[#0b101d]/60 border-slate-850 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Total PTM Sessions</span>
              <div className="text-3xl font-black mt-1.5 text-white">{analytics.totalMeetings}</div>
            </div>
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/10 shadow-lg">
              <Calendar size={20} />
            </div>
          </GlassCard>

          {/* Card 2 */}
          <GlassCard className="p-5 bg-[#0b101d]/60 border-slate-850 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Completion Rate</span>
              <div className="text-3xl font-black mt-1.5 text-emerald-400">{analytics.completionRate}%</div>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 shadow-lg">
              <ClipboardCheck size={20} />
            </div>
          </GlassCard>

          {/* Card 3 */}
          <GlassCard className="p-5 bg-[#0b101d]/60 border-slate-850 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Parent Turnout</span>
              <div className="text-3xl font-black mt-1.5 text-yellow-400">{analytics.parentAttendanceRate}%</div>
            </div>
            <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400 border border-yellow-500/10 shadow-lg">
              <Users size={20} />
            </div>
          </GlassCard>

          {/* Card 4 */}
          <GlassCard className="p-5 bg-[#0b101d]/60 border-slate-850 flex items-center justify-between">
            <div>
              <span className="text-slate-500 uppercase tracking-widest text-[9px] font-bold">Teacher Turnout</span>
              <div className="text-3xl font-black mt-1.5 text-brand-400">{analytics.teacherAttendanceRate}%</div>
            </div>
            <div className="p-3 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/10 shadow-lg">
              <Users size={20} />
            </div>
          </GlassCard>

        </div>
      ) : null}

      {/* Visual Analytics */}
      {!loading && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          <GlassCard className="p-6 bg-[#0b101d]/75 border-slate-800/80">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-1.5">
              <BarChart2 size={16} /> Meeting Mode Distribution
            </h3>
            
            <div className="h-64 flex items-center justify-center">
              {modeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {modeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#0c1222', borderColor: '#1e293b', color: '#fff' }} />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-slate-600 text-xs">No mode data to report.</div>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6 bg-[#0b101d]/75 border-slate-800/80">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300 mb-6 flex items-center gap-1.5">
              <BarChart2 size={16} /> Meeting Completion Breakdown
            </h3>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Total', count: analytics?.totalMeetings || 0 },
                    { name: 'Completed', count: analytics?.completedMeetings || 0 },
                    { name: 'Cancelled', count: analytics?.cancelledMeetings || 0 },
                    { name: 'Scheduled', count: analytics?.scheduledMeetings || 0 }
                  ]}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                  <YAxis stroke="#94a3b8" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#0c1222', borderColor: '#1e293b', color: '#fff' }} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                    <Cell fill="#60a5fa" />
                    <Cell fill="#10b981" />
                    <Cell fill="#ef4444" />
                    <Cell fill="#f59e0b" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>

        </div>
      )}

      {/* Admin table report view */}
      <GlassCard className="p-6 bg-[#0b101d]/75 border-slate-800/80">
        <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-300 mb-4">Detailed Meetings Roster</h3>
        
        <div className="overflow-x-auto text-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-bold uppercase tracking-wider text-[9px] bg-slate-900/10">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Teacher</th>
                <th className="py-3 px-4">Student & Class</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Scheduled Date</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900">
              {meetings.map(m => (
                <tr key={m.id} className="hover:bg-[#11192e]/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">{m.title}</td>
                  <td className="py-3.5 px-4 text-slate-300">{m.teacherName}</td>
                  <td className="py-3.5 px-4">
                    <div className="text-slate-200 font-semibold">{m.studentName}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">{m.className}</div>
                  </td>
                  <td className="py-3.5 px-4 text-slate-400 uppercase tracking-widest text-[9px]">{m.meetingMode}</td>
                  <td className="py-3.5 px-4 text-slate-300">{m.scheduledDate} ({m.startTime})</td>
                  <td className="py-3.5 px-4">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      m.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      m.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                    }`}>
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
              {meetings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 uppercase font-semibold tracking-wider">No PTM meetings on record.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </GlassCard>

    </div>
  );
};

interface PTMErrorBoundaryProps {
  children?: React.ReactNode;
}

interface PTMErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PTMErrorBoundary extends React.Component<PTMErrorBoundaryProps, PTMErrorBoundaryState> {
  public state: PTMErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): PTMErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PTM Module Error Boundary caught an exception:', error, errorInfo);
  }

  private handleRetry = () => {
    console.log('Retrying PTM Module load...');
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 md:p-8 min-h-[60vh] flex flex-col items-center justify-center text-center animate-fade-in bg-[#070b13] text-slate-200 w-full">
          <GlassCard className="max-w-md p-8 border-red-500/10 shadow-red-500/5 space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center border border-red-500/20 mx-auto text-red-400">
              <AlertCircle size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100">Unable to load PTM module.</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                An unexpected exception occurred while loading or rendering the Parent-Teacher Meeting module.
              </p>
              {this.state.error && (
                <div className="p-2.5 bg-slate-950/40 border border-slate-850 rounded-lg text-left mt-2">
                  <p className="text-[9px] font-mono text-rose-400 break-all leading-normal font-semibold">
                    {this.state.error.name}: {this.state.error.message}
                  </p>
                </div>
              )}
            </div>
            <div className="flex justify-center pt-2">
              <button
                onClick={this.handleRetry}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs flex items-center gap-1.5 active:scale-95 transition-all shadow-lg shadow-brand-500/10"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          </GlassCard>
        </div>
      );
    }

    return this.props.children;
  }
}

export const TeacherPTMManagement: React.FC = () => {
  return (
    <PTMErrorBoundary>
      <PTMManagement />
    </PTMErrorBoundary>
  );
};

export const ParentPTMManagement: React.FC = () => {
  return (
    <PTMErrorBoundary>
      <PTMManagement />
    </PTMErrorBoundary>
  );
};

export const StudentPTMManagement: React.FC = () => {
  return (
    <PTMErrorBoundary>
      <PTMManagement />
    </PTMErrorBoundary>
  );
};

export const AdminPTMManagement: React.FC = () => {
  return (
    <PTMErrorBoundary>
      <PTMManagement />
    </PTMErrorBoundary>
  );
};

