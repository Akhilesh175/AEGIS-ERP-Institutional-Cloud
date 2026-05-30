import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { Student, User, Quiz, QuizAttempt } from '../types';
import { GlassCard } from '../components/GlassCard';
import { supabase } from '../lib/supabase';
import { 
  Eye, Award, DollarSign, Calendar, FileText, 
  User as UserIcon, ShieldAlert, CheckCircle, AlertCircle, UsersRound, Clock,
  BookOpen, Play, Download, MessageCircle, Paperclip,
  Filter, Search, ChevronDown, ChevronRight, ExternalLink,
  BookMarked, Layers
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';

const renderVideoPlayer = (url: string) => {
  if (!url) return null;
  
  // Detect YouTube
  const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch) {
    const embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    return (
      <iframe
        src={embedUrl}
        className="w-full aspect-video rounded-xl border border-slate-800 bg-black"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    );
  }

  // Detect Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?([0-9]+)/i);
  if (vimeoMatch) {
    const embedUrl = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
    return (
      <iframe
        src={embedUrl}
        className="w-full aspect-video rounded-xl border border-slate-800 bg-black"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
    );
  }

  // Fallback to native video player
  return (
    <video
      key={url}
      src={url}
      controls
      className="w-full max-h-96 rounded-xl border border-slate-800 bg-black"
      autoPlay
      controlsList="nodownload"
    />
  );
};

export const ParentPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session, syncSubscriptionPlan } = useStore();
  const parentId = session?.parentId;
  
  // States
  const [assignedStudents, setAssignedStudents] = useState<(Student & { userDetails: User; className: string })[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  
  // Dynamically resolve school subscription plan from selected student's school context
  const studentObj = mockDb.students.find(s => s.id === selectedStudent);
  const studentSchool = studentObj ? mockDb.schools.find(sch => sch.id === studentObj.schoolId) : null;
  const currentPlanName = studentSchool?.subscriptionPlan || session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;
  const [academicRecord, setAcademicRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quizzes, setQuizzes] = useState<{ quiz: Quiz; attempt?: QuizAttempt }[]>([]);
  
  // Discussion state
  const [forumPosts, setForumPosts] = useState<any[]>([]);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [postReplies, setPostReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [materials, setMaterials] = useState<any[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);

  // Homework tab state
  const [hwSubjectFilter, setHwSubjectFilter] = useState<string>('all');
  const [hwSearchQuery, setHwSearchQuery] = useState('');
  const [hwStatusFilter, setHwStatusFilter] = useState<string>('all');
  const [expandedHomeworkId, setExpandedHomeworkId] = useState<string | null>(null);

  // Load parent's students
  const loadAssignedStudents = async () => {
    if (!parentId) return;
    try {
      await syncSubscriptionPlan();
      setLoading(true);
      
      const parentUser = mockDb.users.find(u => u.id === session?.user?.id);
      const parentSchoolId = mockDb.parents.find(p => p.id === parentId)?.schoolId || parentUser?.schoolId;
      if (parentSchoolId) {
        await mockApi.syncSchoolsData(parentSchoolId);
        await mockApi.syncClassesData(parentSchoolId);
        await mockApi.syncTeachersData(parentSchoolId);
        await mockApi.syncSubjectsData(parentSchoolId);
        await mockApi.syncTeacherClassSubjectMappingsData(parentSchoolId);
        await mockApi.syncAcademicSessionsData(parentSchoolId);
        await mockApi.syncStudentsData(parentSchoolId);
        await mockApi.syncParentsData(parentSchoolId);
        await mockApi.syncParentStudentMappingsData(parentSchoolId);
      }

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
      
      const studentObj = mockDb.students.find(s => s.id === selectedStudent);
      if (studentObj) {
        const mat = await mockApi.getStudyMaterials(studentObj.schoolId, studentObj.classId);
        setMaterials(mat);
      } else {
        setMaterials([]);
      }
      setMaterialsLoading(false);

      if (studentObj) {
        await mockApi.syncSchoolsData(studentObj.schoolId);
        await mockApi.syncClassesData(studentObj.schoolId);
        await mockApi.syncTeachersData(studentObj.schoolId);
        await mockApi.syncSubjectsData(studentObj.schoolId);
        await mockApi.syncTeacherClassSubjectMappingsData(studentObj.schoolId);
        await mockApi.syncAcademicSessionsData(studentObj.schoolId);
        await mockApi.syncStudentsData(studentObj.schoolId);
        await mockApi.syncParentsData(studentObj.schoolId);
        await mockApi.syncParentStudentMappingsData(studentObj.schoolId);

        await mockApi.syncForumCategoriesData(studentObj.schoolId);
        await mockApi.syncForumPostsData(studentObj.schoolId);
        await mockApi.syncForumRepliesData(studentObj.schoolId);
        
        const allPosts = await mockApi.getForumPosts();
        const cats = await mockApi.getForumCategories(studentObj.schoolId);
        const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
        const allowedCatIds = allowedCats.map(c => c.id);
        
        setForumPosts(allPosts.filter(p => allowedCatIds.includes(p.categoryId)));
      }

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

  // Real-time Supabase Postgres changes subscription
  useEffect(() => {
    if (activeTab !== 'forums' || !selectedStudent) return;

    const studentObj = mockDb.students.find(s => s.id === selectedStudent);
    if (!studentObj) return;

    const handleForumsSync = () => {
      mockApi.syncStudentsData(studentObj.schoolId).then(() => {
        mockApi.syncParentsData(studentObj.schoolId).then(() => {
          mockApi.syncParentStudentMappingsData(studentObj.schoolId).then(() => {
            mockApi.syncForumCategoriesData(studentObj.schoolId).then(() => {
              mockApi.syncForumPostsData(studentObj.schoolId).then(() => {
                mockApi.syncForumRepliesData(studentObj.schoolId).then(() => {
                  mockApi.getForumPosts().then(allPosts => {
                    mockApi.getForumCategories(studentObj.schoolId).then(cats => {
                      const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
                      const allowedCatIds = allowedCats.map(c => c.id);
                      setForumPosts(allPosts.filter(p => allowedCatIds.includes(p.categoryId)));
                    });
                  });
                  if (selectedPost) {
                    mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
                  }
                });
              });
            });
          });
        });
      });
    };

    const channel = supabase
      .channel('parent-forums-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_categories' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_posts' }, handleForumsSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forum_replies' }, handleForumsSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab, selectedStudent, selectedPost]);

  // Real-time Supabase Postgres changes subscription for child academic data
  useEffect(() => {
    if (!parentId || !selectedStudent) return;

    const handleAcademicSync = () => {
      console.log('Realtime academic update detected, refreshing parent portal...');
      loadAcademicRecord();
    };

    const channel = supabase
      .channel('parent-academic-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homeworks' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_attachments' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_submissions' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetables' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_materials' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cards' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_results' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_inventory' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'digital_library_assets' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, handleAcademicSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_points' }, handleAcademicSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [parentId, selectedStudent]);

  useEffect(() => {
    const interval = setInterval(() => {
      syncSubscriptionPlan();
      
      if (activeTab === 'forums' && selectedStudent) {
        const studentObj = mockDb.students.find(s => s.id === selectedStudent);
        if (studentObj) {
          mockApi.syncStudentsData(studentObj.schoolId).then(() => {
            mockApi.syncParentsData(studentObj.schoolId).then(() => {
              mockApi.syncParentStudentMappingsData(studentObj.schoolId).then(() => {
                mockApi.syncForumCategoriesData(studentObj.schoolId).then(() => {
                  mockApi.syncForumPostsData(studentObj.schoolId).then(() => {
                    mockApi.syncForumRepliesData(studentObj.schoolId).then(() => {
                      mockApi.getForumPosts().then(allPosts => {
                        mockApi.getForumCategories(studentObj.schoolId).then(cats => {
                          const allowedCats = cats.filter(c => c.classId === studentObj.classId || !c.classId);
                          const allowedCatIds = allowedCats.map(c => c.id);
                          setForumPosts(allPosts.filter(p => allowedCatIds.includes(p.categoryId)));
                        });
                      });
                      if (selectedPost) {
                        mockApi.getForumPostReplies(selectedPost.id).then(reps => setPostReplies(reps));
                      }
                    });
                  });
                });
              });
            });
          });
        }
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [syncSubscriptionPlan, activeTab, selectedStudent, selectedPost]);

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
      loadAcademicRecord();
    } catch (err) {
      console.error(err);
    }
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
          {parentUser?.avatarUrl ? (
            <img 
              src={parentUser.avatarUrl} 
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
              <UsersRound className="text-brand-400" size={24} />
            </div>
          )}
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
                          <div key={idx} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col gap-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <h4 className="font-bold text-xs text-slate-200">{a.title}</h4>
                                <p className="text-[9px] text-slate-550 mt-0.5">Due: {new Date(a.dueDate).toLocaleDateString()}</p>
                              </div>
                              <span className={`text-[9.5px] font-bold px-2.5 py-0.5 rounded-lg ${
                                a.submitted ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}>
                                {a.submitted ? 'Submitted' : 'Pending'}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 leading-relaxed mt-0.5">{a.description}</p>
                            
                            {a.attachments && a.attachments.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-850/40 space-y-1.5">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Classroom Resources ({a.attachments.length})</span>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {a.attachments.map((att: any) => (
                                    <div 
                                      key={att.id} 
                                      className="flex items-center justify-between gap-2 p-2 bg-slate-950/40 border border-slate-850 rounded-xl"
                                    >
                                      <div className="flex items-center gap-2 truncate">
                                        <Paperclip size={11} className="text-brand-400 shrink-0" />
                                        <span className="text-[10px] text-slate-350 truncate" title={att.fileName}>
                                          {att.fileName}
                                        </span>
                                      </div>
                                      <a 
                                        href={att.fileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="p-1 hover:bg-slate-850 text-slate-450 hover:text-slate-200 rounded-lg transition-colors flex items-center justify-center shrink-0"
                                        title="View File"
                                      >
                                        <Eye size={12} />
                                      </a>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
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

            {activeTab === 'homework' && (
              <div className="space-y-6 animate-fade-in">
                {/* Homework Header */}
                <GlassCard className="space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-100 text-lg flex items-center gap-2">
                        <FileText className="text-brand-500" size={20} />
                        Homework & Assignments
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        View all homework assigned to {academicRecord?.studentProfile?.fullName || 'your child'} with due dates, attachments, and submission status.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 px-3 py-1 rounded-full">
                        {academicRecord?.assignments?.length || 0} Total
                      </span>
                      <span className="text-[10px] font-bold bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 rounded-full">
                        {academicRecord?.assignments?.filter((a: any) => a.submitted).length || 0} Submitted
                      </span>
                      <span className="text-[10px] font-bold bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 rounded-full">
                        {academicRecord?.assignments?.filter((a: any) => !a.submitted && new Date(a.dueDate) < new Date()).length || 0} Overdue
                      </span>
                    </div>
                  </div>

                  {/* Filters Row */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2 border-t border-slate-850">
                    {/* Search */}
                    <div className="relative flex-1 min-w-0">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        placeholder="Search homework..."
                        value={hwSearchQuery}
                        onChange={(e) => setHwSearchQuery(e.target.value)}
                        className="w-full bg-slate-900/50 border border-slate-800 text-xs text-slate-200 rounded-xl pl-9 pr-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors"
                      />
                    </div>
                    {/* Subject Filter */}
                    <div className="flex items-center gap-2">
                      <Filter size={14} className="text-slate-500 shrink-0" />
                      <select
                        value={hwSubjectFilter}
                        onChange={(e) => setHwSubjectFilter(e.target.value)}
                        className="bg-slate-900/50 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors"
                      >
                        <option value="all">All Subjects</option>
                        {Array.from(new Set(academicRecord?.assignments?.map((a: any) => a.subjectName) || [])).map((subj: any) => (
                          <option key={subj} value={subj}>{subj}</option>
                        ))}
                      </select>
                    </div>
                    {/* Status Filter */}
                    <select
                      value={hwStatusFilter}
                      onChange={(e) => setHwStatusFilter(e.target.value)}
                      className="bg-slate-900/50 border border-slate-800 text-xs text-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-brand-500 transition-colors"
                    >
                      <option value="all">All Status</option>
                      <option value="submitted">Submitted</option>
                      <option value="pending">Pending</option>
                      <option value="overdue">Overdue</option>
                    </select>
                  </div>
                </GlassCard>

                {/* Homework List */}
                <div className="space-y-3">
                  {(() => {
                    const allAssignments = academicRecord?.assignments || [];
                    const filtered = allAssignments.filter((a: any) => {
                      const matchesSearch = !hwSearchQuery || a.title?.toLowerCase().includes(hwSearchQuery.toLowerCase()) || a.description?.toLowerCase().includes(hwSearchQuery.toLowerCase());
                      const matchesSubject = hwSubjectFilter === 'all' || a.subjectName === hwSubjectFilter;
                      const isOverdue = !a.submitted && new Date(a.dueDate) < new Date();
                      const matchesStatus = hwStatusFilter === 'all' 
                        || (hwStatusFilter === 'submitted' && a.submitted) 
                        || (hwStatusFilter === 'pending' && !a.submitted && !isOverdue)
                        || (hwStatusFilter === 'overdue' && isOverdue);
                      return matchesSearch && matchesSubject && matchesStatus;
                    });

                    if (filtered.length === 0) {
                      return (
                        <GlassCard>
                          <div className="text-center py-12 space-y-3">
                            <FileText size={40} className="mx-auto text-slate-600" />
                            <p className="text-sm text-slate-400">No homework found matching your filters.</p>
                            <button
                              onClick={() => { setHwSearchQuery(''); setHwSubjectFilter('all'); setHwStatusFilter('all'); }}
                              className="text-xs text-brand-400 hover:text-brand-300 font-semibold"
                            >
                              Clear all filters
                            </button>
                          </div>
                        </GlassCard>
                      );
                    }

                    return filtered.map((a: any) => {
                      const isExpanded = expandedHomeworkId === a.id;
                      const dueDate = new Date(a.dueDate);
                      const now = new Date();
                      const isOverdue = !a.submitted && dueDate < now;
                      const isDueSoon = !a.submitted && !isOverdue && (dueDate.getTime() - now.getTime()) < 2 * 24 * 60 * 60 * 1000;
                      const hasAttachments = a.attachments && a.attachments.length > 0;

                      return (
                        <GlassCard key={a.id} className="overflow-hidden">
                          {/* Clickable header */}
                          <button
                            onClick={() => setExpandedHomeworkId(isExpanded ? null : a.id)}
                            className="w-full flex items-start gap-4 text-left group"
                          >
                            <div className="mt-0.5 shrink-0">
                              {isExpanded 
                                ? <ChevronDown size={16} className="text-brand-400" /> 
                                : <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-300 transition-colors" />
                              }
                            </div>
                            <div className="flex-1 min-w-0 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[9px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                  {a.subjectName}
                                </span>
                                {a.isHomework && (
                                  <span className="text-[9px] font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest">
                                    Homework
                                  </span>
                                )}
                                {hasAttachments && (
                                  <span className="text-[9px] text-slate-400 flex items-center gap-1">
                                    <Paperclip size={10} /> {a.attachments.length} file{a.attachments.length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <h4 className="font-bold text-sm text-slate-200 group-hover:text-slate-100 transition-colors">{a.title}</h4>
                              <div className="flex items-center gap-4 text-[10px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Calendar size={11} /> Due: {dueDate.toLocaleDateString()}
                                </span>
                                <span className="flex items-center gap-1">
                                  <UserIcon size={11} /> {a.teacherName}
                                </span>
                              </div>
                            </div>
                            <div className="shrink-0 flex flex-col items-end gap-1.5">
                              {/* Status badge */}
                              <span className={`text-[9.5px] font-bold px-2.5 py-0.5 rounded-lg whitespace-nowrap ${
                                a.submitted 
                                  ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                                  : isOverdue 
                                    ? 'bg-red-500/10 text-red-400 border border-red-500/20' 
                                    : isDueSoon
                                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                      : 'bg-slate-700/30 text-slate-400 border border-slate-700'
                              }`}>
                                {a.submitted ? '✓ Submitted' : isOverdue ? '⚠ Overdue' : isDueSoon ? '⏰ Due Soon' : 'Pending'}
                              </span>
                              {a.submitted && a.marksObtained !== null && (
                                <span className="text-[10px] font-bold text-slate-300">
                                  {a.marksObtained}/{a.maxMarks} marks
                                </span>
                              )}
                            </div>
                          </button>

                          {/* Expanded details */}
                          {isExpanded && (
                            <div className="mt-4 pt-4 border-t border-slate-850 space-y-4 animate-fade-in">
                              {/* Description */}
                              {a.description && (
                                <div className="space-y-1">
                                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Instructions</span>
                                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line bg-slate-900/40 border border-slate-850 rounded-xl p-3">
                                    {a.description}
                                  </p>
                                </div>
                              )}

                              {/* Attachments */}
                              {hasAttachments && (
                                <div className="space-y-2">
                                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Teacher Attachments ({a.attachments.length})</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {a.attachments.map((att: any) => {
                                      const ext = att.fileName?.split('.').pop()?.toLowerCase() || '';
                                      const isImage = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext);
                                      const isPdf = ext === 'pdf';
                                      const isDoc = ['doc', 'docx'].includes(ext);
                                      return (
                                        <div 
                                          key={att.id} 
                                          className="flex items-center justify-between gap-2 p-3 bg-slate-950/50 border border-slate-850 rounded-xl hover:border-brand-500/20 transition-all group/att"
                                        >
                                          <div className="flex items-center gap-2.5 truncate">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                              isImage ? 'bg-emerald-500/10 border border-emerald-500/20' :
                                              isPdf ? 'bg-red-500/10 border border-red-500/20' :
                                              isDoc ? 'bg-blue-500/10 border border-blue-500/20' :
                                              'bg-slate-800 border border-slate-700'
                                            }`}>
                                              <Paperclip size={13} className={`${
                                                isImage ? 'text-emerald-400' :
                                                isPdf ? 'text-red-400' :
                                                isDoc ? 'text-blue-400' :
                                                'text-slate-400'
                                              }`} />
                                            </div>
                                            <div className="truncate">
                                              <span className="text-[11px] text-slate-300 truncate block font-medium" title={att.fileName}>
                                                {att.fileName}
                                              </span>
                                              <span className="text-[9px] text-slate-500 uppercase">{ext}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1 shrink-0">
                                            <a 
                                              href={att.fileUrl} 
                                              target="_blank" 
                                              rel="noopener noreferrer" 
                                              className="p-1.5 hover:bg-slate-800 text-slate-450 hover:text-slate-200 rounded-lg transition-colors" 
                                              title="View File"
                                            >
                                              <Eye size={13} />
                                            </a>
                                            <a 
                                              href={att.fileUrl} 
                                              download 
                                              className="p-1.5 hover:bg-slate-800 text-slate-450 hover:text-slate-200 rounded-lg transition-colors" 
                                              title="Download File"
                                            >
                                              <Download size={13} />
                                            </a>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Submission Info */}
                              <div className="space-y-2">
                                <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-500">Submission Status</span>
                                {a.submitted ? (
                                  <div className="p-3 bg-green-500/5 border border-green-500/15 rounded-xl space-y-2">
                                    <div className="flex items-center gap-2">
                                      <CheckCircle size={14} className="text-green-400" />
                                      <span className="text-xs font-semibold text-green-400">Submitted</span>
                                      {a.submittedAt && (
                                        <span className="text-[10px] text-slate-400 ml-auto">on {new Date(a.submittedAt).toLocaleString()}</span>
                                      )}
                                    </div>
                                    {a.submissionFileUrl && (
                                      <a 
                                        href={a.submissionFileUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        className="inline-flex items-center gap-1.5 text-[10px] text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                                      >
                                        <ExternalLink size={11} /> View Submitted Work
                                      </a>
                                    )}
                                    {a.marksObtained !== null && a.marksObtained !== undefined && (
                                      <div className="flex items-center justify-between text-xs pt-1 border-t border-green-500/10">
                                        <span className="text-slate-400">Marks Awarded:</span>
                                        <span className={`font-bold text-sm ${
                                          a.marksObtained >= (a.maxMarks * 0.8) ? 'text-green-400' : 
                                          a.marksObtained >= (a.maxMarks * 0.5) ? 'text-amber-400' : 'text-red-400'
                                        }`}>
                                          {a.marksObtained} / {a.maxMarks}
                                        </span>
                                      </div>
                                    )}
                                    {a.feedback && (
                                      <div className="pt-1 border-t border-green-500/10">
                                        <span className="text-[9px] text-slate-500 font-bold uppercase">Teacher Feedback:</span>
                                        <p className="text-xs text-slate-300 mt-1 italic">{a.feedback}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className={`p-3 rounded-xl space-y-1 ${
                                    isOverdue 
                                      ? 'bg-red-500/5 border border-red-500/15' 
                                      : 'bg-slate-900/40 border border-slate-850'
                                  }`}>
                                    <div className="flex items-center gap-2">
                                      <AlertCircle size={14} className={isOverdue ? 'text-red-400' : 'text-amber-400'} />
                                      <span className={`text-xs font-semibold ${isOverdue ? 'text-red-400' : 'text-amber-400'}`}>
                                        {isOverdue ? 'Not submitted — overdue' : 'Awaiting submission'}
                                      </span>
                                    </div>
                                    <p className="text-[10px] text-slate-500">
                                      {isOverdue 
                                        ? `This assignment was due on ${dueDate.toLocaleDateString()}. Please follow up with your child's teacher.`
                                        : `Due on ${dueDate.toLocaleDateString()} — ${Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} day(s) remaining.`
                                      }
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </GlassCard>
                      );
                    });
                  })()}
                </div>
              </div>
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

            {activeTab === 'library' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
                <div className="lg:col-span-2 space-y-6">
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-100 flex items-center gap-2 pb-2 border-b border-slate-850">
                      <BookMarked className="text-brand-500" size={18} />
                      School Library Catalog
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-1">
                      {mockDb.books.map(b => (
                        <div key={b.id} className="p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl space-y-2">
                          <h4 className="font-bold text-slate-200 text-xs">{b.title}</h4>
                          <p className="text-[10px] text-slate-400">Author: {b.author} | ISBN: {b.isbn}</p>
                          <span className="inline-block text-[9px] font-bold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400">
                            Genre: {b.subject}
                          </span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
                <div className="space-y-6">
                  <GlassCard className="space-y-4">
                    <h3 className="font-bold text-slate-200 text-xs pb-2 border-b border-slate-850">Ward's Issued Books & Fines</h3>
                    <div className="space-y-3">
                      <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl">
                        <h4 className="font-bold text-slate-200 text-xs">Introduction to Quantum Mechanics</h4>
                        <p className="text-[10px] text-slate-400 mt-1">Due Date: 2026-06-15</p>
                        <p className="text-[9px] text-green-400 font-bold mt-1">Status: Checked Out</p>
                      </div>
                      <div className="p-3 bg-red-500/5 border border-red-500/10 rounded-xl">
                        <h4 className="font-bold text-slate-200 text-xs">Library Fines Due</h4>
                        <p className="text-xs text-slate-400 mt-1">Outstanding Balance: <span className="text-red-400 font-bold">$3.50</span></p>
                        <p className="text-[9px] text-slate-500">Fine Reason: Late Return fee</p>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {activeTab === 'transit' && (
              <GlassCard className="space-y-6 animate-fade-in">
                <div className="border-b border-slate-850 pb-3">
                  <h3 className="font-bold text-slate-100 flex items-center gap-2">
                    <Layers className="text-brand-500" size={18} />
                    Ward's School Transit Details
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3">
                    <h4 className="font-bold text-slate-200 text-xs">Assigned Route & Stop</h4>
                    <p className="text-xs text-slate-350">Route Code: <span className="font-semibold text-brand-400">R-102</span> (Downtown Expressway)</p>
                    <p className="text-xs text-slate-350">Pickup Stop: <span className="font-semibold text-slate-200">Main Square Crossing</span></p>
                    <p className="text-xs text-slate-350">Pickup Time: <span className="font-semibold text-slate-200">07:15 AM</span></p>
                  </div>
                  <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3">
                    <h4 className="font-bold text-slate-200 text-xs">Vehicle & Driver Details</h4>
                    <p className="text-xs text-slate-350">Bus Number Plate: <span className="font-semibold text-slate-200">MH-12-AB-3456</span> (Bus #4)</p>
                    <p className="text-xs text-slate-350">Driver Name: <span className="font-semibold text-slate-200">Robert Peterson</span></p>
                    <p className="text-xs text-slate-350">Contact: <span className="font-semibold text-slate-200">+1 555-0199</span></p>
                  </div>
                </div>
              </GlassCard>
            )}

            {activeTab === 'forums' && (
              <PremiumLock 
                isLocked={!plan.features.communications} 
                requiredTier="Basic" 
                featureName="Communications & Forums"
              >
                <div className="space-y-6">
                  {selectedPost ? (
                    <GlassCard className="space-y-4 animate-fade-in">
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
                    <GlassCard className="space-y-6">
                      <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Homeroom Classroom Forums</h3>
                      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                        {forumPosts.length === 0 ? (
                          <div className="text-center py-12 text-slate-500 text-xs">No active discussions available for this class.</div>
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
                    {renderVideoPlayer(activeVideoUrl)}
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
