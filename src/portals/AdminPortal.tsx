import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { Student, Teacher, Parent, Class, Subject, User } from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Building, Users, UsersRound, Layers, BookMarked, DollarSign, 
  Eye, EyeOff, Plus, Link, Calendar, CheckCircle2, ShieldAlert, ArrowRight, Key, Crown
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';

export const AdminPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session, setSession, syncSubscriptionPlan } = useStore();
  const adminId = session?.user.id;
  const currentPlanName = session?.schoolSubscriptionPlan || 'freemium';
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;

  // Datasets
  const [overview, setOverview] = useState<any | null>(null);
  const [students, setStudents] = useState<(Student & { userDetails: User; className: string })[]>([]);
  const [teachers, setTeachers] = useState<(Teacher & { userDetails: User })[]>([]);
  const [parents, setParents] = useState<(Parent & { userDetails: User; linkedStudentNames: string[] })[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // Directory Search states
  const [studentSearch, setStudentSearch] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [parentSearch, setParentSearch] = useState('');

  // Creation/Action States
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [tcEmail, setTcEmail] = useState('');
  const [tcFirst, setTcFirst] = useState('');
  const [tcLast, setTcLast] = useState('');
  const [tcEmpId, setTcEmpId] = useState('');
  const [tcSpecial, setTcSpecial] = useState('');
  const [tcQual, setTcQual] = useState('');
  const [tcPhone, setTcPhone] = useState('');
  const [tcPassword, setTcPassword] = useState('');
  const [showTcPassword, setShowTcPassword] = useState(false);

  const [showAddParent, setShowAddParent] = useState(false);
  const [prEmail, setPrEmail] = useState('');
  const [prFirst, setPrFirst] = useState('');
  const [prLast, setPrLast] = useState('');
  const [prOccup, setPrOccup] = useState('');
  const [prAddr, setPrAddr] = useState('');
  const [prPhone, setPrPhone] = useState('');
  const [prStudentId, setPrStudentId] = useState('');
  const [prAdmissionNum, setPrAdmissionNum] = useState('');
  const [prRelation, setPrRelation] = useState('Father');
  const [prPassword, setPrPassword] = useState('');
  const [showPrPassword, setShowPrPassword] = useState(false);

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [stEmail, setStEmail] = useState('');
  const [stFirst, setStFirst] = useState('');
  const [stLast, setStLast] = useState('');
  const [stClass, setStClass] = useState('');
  const [stAdmission, setStAdmission] = useState('');
  const [stRoll, setStRoll] = useState(1);
  const [stGender, setStGender] = useState<'MALE' | 'FEMALE' | 'OTHER'>('MALE');
  const [stDob, setStDob] = useState('2010-01-01');
  const [stPassword, setStPassword] = useState('');
  const [showStPassword, setShowStPassword] = useState(false);

  const [showAddClass, setShowAddClass] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  const [showAddSubject, setShowAddSubject] = useState(false);
  const [subName, setSubName] = useState('');
  const [subCode, setSubCode] = useState('');
  const [subDesc, setSubDesc] = useState('');

  const [showLinkParent, setShowLinkParent] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [parentRelationship, setParentRelationship] = useState('Father');

  const [showAssignClassTeacher, setShowAssignClassTeacher] = useState(false);
  const [assignCtClassId, setAssignCtClassId] = useState('');
  const [assignCtTeacherId, setAssignCtTeacherId] = useState('');

  const [showMapTeacher, setShowMapTeacher] = useState(false);
  const [mapTeacherId, setMapTeacherId] = useState('');
  const [mapClassId, setMapClassId] = useState('');
  const [mapSubjectId, setMapSubjectId] = useState('');
  const [mapDayOfWeek, setMapDayOfWeek] = useState(1);
  const [mapStartTime, setMapStartTime] = useState('09:00');
  const [mapEndTime, setMapEndTime] = useState('10:30');
  const [mapClassroom, setMapClassroom] = useState('Room 101');

  // Password Reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserName, setResetUserName] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleResetPassword = (userId: string, name: string) => {
    setResetUserId(userId);
    setResetUserName(name);
    setNewPassword('password');
    setShowResetModal(true);
  };

  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !resetUserId || !newPassword.trim()) return;

    try {
      await mockApi.adminResetPassword(adminId, resetUserId, newPassword);
      setShowResetModal(false);
      setResetUserId('');
      setResetUserName('');
      setNewPassword('');
      alert('User credentials updated inside secure registry!');
    } catch (err: any) {
      alert(err.message || 'Error resetting password');
    }
  };

  const handleDeleteTeacher = async (teacherId: string, name: string) => {
    if (!adminId) return;
    if (!window.confirm(`Are you sure you want to delete teacher ${name}? This will remove their user credentials and clear their homeroom assignment.`)) return;
    try {
      await mockApi.adminDeleteTeacher(adminId, teacherId);
      loadData();
      alert('Teacher deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Error deleting teacher');
    }
  };

  const handleDeleteStudent = async (studentId: string, name: string) => {
    if (!adminId) return;
    if (!window.confirm(`Are you sure you want to delete student ${name}? This will clear their record from registries.`)) return;
    try {
      await mockApi.adminDeleteStudent(adminId, studentId);
      loadData();
      alert('Student deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Error deleting student');
    }
  };

  const handleDeleteParent = async (parentId: string, name: string) => {
    if (!adminId) return;
    if (!window.confirm(`Are you sure you want to delete parent ${name}? This will remove their user credentials and clear parent-student linkages.`)) return;
    try {
      await mockApi.adminDeleteParent(adminId, parentId);
      loadData();
      alert('Parent deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Error deleting parent');
    }
  };

  const loadData = async () => {
    try {
      // Sync subscription plan in real time during load / poll
      await syncSubscriptionPlan();

      const [over, st, tc, pr, cls, sub] = await Promise.all([
        mockApi.adminGetInstitutionOverview(),
        mockApi.adminGetStudents(),
        mockApi.adminGetTeachers(),
        mockApi.adminGetParents(),
        mockApi.adminGetClasses(),
        mockApi.adminGetSubjects()
      ]);
      setOverview(over);
      setStudents(st);
      setTeachers(tc);
      setParents(pr);
      setClasses(cls);
      setSubjects(sub);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    // Auto-poll every 30 seconds so external DB deletions are reflected
    const pollInterval = setInterval(loadData, 30000);
    return () => clearInterval(pollInterval);
  }, [activeTab]);

  // CRUD Submissions
  const handleCreateTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !tcEmail.trim()) return;
    if (!tcPassword || tcPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    try {
      await mockApi.adminCreateTeacher(
        adminId, tcEmail, tcFirst, tcLast, tcEmpId, tcSpecial, tcQual, tcPhone, tcPassword
      );
      setShowAddTeacher(false);
      setTcEmail('');
      setTcFirst('');
      setTcLast('');
      setTcEmpId('');
      setTcSpecial('');
      setTcQual('');
      setTcPhone('');
      setTcPassword('');
      setShowTcPassword(false);
      loadData();
      alert('Teacher account created successfully!');
    } catch (err: any) {
      alert(err.message || 'Error creating teacher');
    }
  };

  const handleCreateParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !prEmail.trim()) return;
    if (!prPassword || prPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }
    try {
      await mockApi.adminCreateParent(
        adminId, prEmail, prFirst, prLast, prOccup, prAddr, prPhone,
        prStudentId, prAdmissionNum, prRelation, prPassword
      );
      setShowAddParent(false);
      setPrEmail('');
      setPrFirst('');
      setPrLast('');
      setPrOccup('');
      setPrAddr('');
      setPrPhone('');
      setPrStudentId('');
      setPrAdmissionNum('');
      setPrRelation('Father');
      setPrPassword('');
      setShowPrPassword(false);
      loadData();
      alert('Parent account created and linked successfully!');
    } catch (err: any) {
      alert(err.message || 'Error creating parent');
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !stEmail.trim()) return;
    if (!stPassword || stPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    try {
      await mockApi.adminCreateStudent(
        adminId, stEmail, stFirst, stLast, stClass, stAdmission, stRoll, stGender, stDob, stPassword
      );
      setShowAddStudent(false);
      setStEmail('');
      setStFirst('');
      setStLast('');
      setStClass('');
      setStAdmission('');
      setStPassword('');
      setShowStPassword(false);
      loadData();
      alert('Student registered in classroom listings!');
    } catch (err: any) {
      alert(err.message || 'Error creating student');
    }
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !newClassName.trim()) return;

    try {
      await mockApi.adminCreateClass(adminId, newClassName);
      setShowAddClass(false);
      setNewClassName('');
      loadData();
      alert('Class section established!');
    } catch (err: any) {
      alert(err.message || 'Error creating class');
    }
  };

  const handleCreateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !subName.trim()) return;

    try {
      await mockApi.adminCreateSubject(adminId, subName, subCode, subDesc);
      setShowAddSubject(false);
      setSubName('');
      setSubCode('');
      setSubDesc('');
      loadData();
      alert('Syllabus subject registered!');
    } catch (err: any) {
      alert(err.message || 'Error creating subject');
    }
  };

  const handleLinkParentStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !selectedParentId || !selectedStudentId) return;

    try {
      await mockApi.adminLinkParentStudent(
        adminId, selectedParentId, selectedStudentId, parentRelationship
      );
      setShowLinkParent(false);
      setSelectedParentId('');
      setSelectedStudentId('');
      loadData();
      alert('Guardian and ward mapped successfully!');
    } catch (err: any) {
      alert(err.message || 'Error linking parent and student');
    }
  };

  const handleMapTeacherClassSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !mapTeacherId || !mapClassId || !mapSubjectId) return;

    try {
      await mockApi.adminMapTeacherClassSubject(
        adminId,
        mapTeacherId,
        mapClassId,
        mapSubjectId,
        mapDayOfWeek,
        mapStartTime,
        mapEndTime,
        mapClassroom
      );
      setShowMapTeacher(false);
      setMapTeacherId('');
      setMapClassId('');
      setMapSubjectId('');
      setMapDayOfWeek(1);
      setMapStartTime('09:00');
      setMapEndTime('10:30');
      setMapClassroom('Room 101');
      loadData();
      alert('Faculty curriculum schedule mapped successfully!');
    } catch (err: any) {
      alert(err.message || 'Error mapping teacher assignment');
    }
  };

  const handleAssignClassTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !assignCtClassId || !assignCtTeacherId) return;

    try {
      await mockApi.adminAssignClassTeacher(adminId, assignCtClassId, assignCtTeacherId);
      setShowAssignClassTeacher(false);
      setAssignCtClassId('');
      setAssignCtTeacherId('');
      loadData();
      alert('Class Teacher assigned successfully!');
    } catch (err: any) {
      alert(err.message || 'Error assigning class teacher');
    }
  };

  // Safe Impersonation trigger
  const handleImpersonateUser = async (email: string) => {
    if (!window.confirm(`Initiating security portal gateway entry for: ${email}\nAre you sure you want to impersonate this session?`)) return;
    try {
      const sess = await mockApi.login(email, 'pass_hash'); // Behind the scenes login
      setSession(sess);
      alert('Impersonated login success! Redirecting to target portal dashboard.');
    } catch (err: any) {
      alert(err.message || 'Error processing impersonation');
    }
  };

  const filteredStudents = students.filter(s => 
    `${s.userDetails.firstName} ${s.userDetails.lastName}`.toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredTeachers = teachers.filter(t => 
    `${t.userDetails.firstName} ${t.userDetails.lastName}`.toLowerCase().includes(teacherSearch.toLowerCase())
  );

  const filteredParents = parents.filter(p => 
    `${p.userDetails.firstName} ${p.userDetails.lastName}`.toLowerCase().includes(parentSearch.toLowerCase()) ||
    p.userDetails.email.toLowerCase().includes(parentSearch.toLowerCase()) ||
    (p.occupation && p.occupation.toLowerCase().includes(parentSearch.toLowerCase()))
  );

  const adminSchoolName = mockDb.schools.find(s => s.id === session?.user.schoolId)?.name || 'Aegis Academy';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      
      {/* Portal Identity Header */}
      <div className="bg-gradient-to-r from-brand-950 to-slate-900 border border-slate-800 rounded-3xl p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
            <Building className="text-brand-400" size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-100 font-sans leading-none">School Administrator Portal</h2>
            <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-widest font-mono">Institution: {adminSchoolName}</p>
          </div>
        </div>
      </div>

      {activeTab === 'dashboard' && overview && (
        <div className="space-y-6">
          {/* Institutional Metrics Overview */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <GlassCard className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                <Users className="text-brand-400" size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Total Students</span>
                <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalStudents}</h3>
              </div>
            </GlassCard>

            <GlassCard className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                <UsersRound className="text-brand-400" size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Registered Faculty</span>
                <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalTeachers}</h3>
              </div>
            </GlassCard>

            <GlassCard className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                <Layers className="text-brand-400" size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Active Sections</span>
                <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalClasses}</h3>
              </div>
            </GlassCard>

            <GlassCard className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                <DollarSign className="text-brand-400" size={20} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Total Income</span>
                <h3 className="text-2xl font-extrabold text-slate-100 mt-1">${overview.feeCollections.paid.toLocaleString()}</h3>
              </div>
            </GlassCard>
          </div>

          {/* Subscription Quota Widget */}
          <GlassCard className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-brand-500/30 bg-brand-500/5">
            <div>
              <h3 className="text-sm font-bold text-brand-300 flex items-center gap-2">
                <Crown size={16} /> 
                {overview.subscription.plan.toUpperCase()} PLAN 
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                You are currently utilizing {overview.totalStudents} of {overview.subscription.limits.maxStudents > 10000 ? 'Unlimited' : overview.subscription.limits.maxStudents} student slots, 
                and {overview.totalTeachers} of {overview.subscription.limits.maxTeachers > 10000 ? 'Unlimited' : overview.subscription.limits.maxTeachers} teacher slots.
              </p>
            </div>
            <div className="flex gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Student Quota</span>
                <div className="w-32 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="h-full bg-brand-500" 
                    style={{ width: `${Math.min(100, (overview.totalStudents / overview.subscription.limits.maxStudents) * 100)}%` }} 
                  />
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Teacher Quota</span>
                <div className="w-32 h-1.5 bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="h-full bg-blue-500" 
                    style={{ width: `${Math.min(100, (overview.totalTeachers / overview.subscription.limits.maxTeachers) * 100)}%` }} 
                  />
                </div>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick Actions Panel */}
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Curriculum Fast-Track Options</h3>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowAddStudent(true)}
                  disabled={overview.totalStudents >= overview.subscription.limits.maxStudents}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={overview.totalStudents >= overview.subscription.limits.maxStudents ? 'Student limit reached for your plan' : ''}
                >
                  <Plus className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Register Student</span>
                </button>
                <button 
                  onClick={() => setShowAddTeacher(true)}
                  disabled={overview.totalTeachers >= overview.subscription.limits.maxTeachers}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={overview.totalTeachers >= overview.subscription.limits.maxTeachers ? 'Teacher limit reached for your plan' : ''}
                >
                  <UsersRound className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Register Teacher</span>
                </button>
                <button 
                  onClick={() => setShowAddParent(true)}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
                >
                  <Users className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Register Parent</span>
                </button>
                <button 
                  onClick={() => setShowAddClass(true)}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
                >
                  <Layers className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Establish Class</span>
                </button>
                <button 
                  onClick={() => setShowLinkParent(true)}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
                >
                  <Link className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Map Parent-Student</span>
                </button>
                <button 
                  onClick={() => setShowAssignClassTeacher(true)}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group"
                >
                  <BookMarked className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Assign Class Teacher</span>
                </button>
              </div>
            </GlassCard>

            {/* Income balance sheet */}
            <GlassCard className="space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Billing Invoicing Office</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  Tuition invoices are generated by class structures. Outstanding dues are monitored by parents. Take administrative action to update ledger sheets or record hand-delivered manual school fee collections.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-850">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase leading-none">Paid Ledger</span>
                  <p className="text-lg font-bold text-green-400 mt-1">${overview.feeCollections.paid.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase leading-none">Outstanding Dues</span>
                  <p className="text-lg font-bold text-red-400 mt-1">${overview.feeCollections.pending.toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'students' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Users className="text-brand-500" size={18} />
              Enrolled Student Directory
            </h3>
            
            <div className="flex gap-2 w-full sm:w-auto items-center">
              {overview && (
                <div className="text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">QUOTA:</span> <span className={overview.totalStudents >= overview.subscription.limits.maxStudents ? "text-red-400" : "text-brand-400"}>{overview.totalStudents} / {overview.subscription.limits.maxStudents}</span>
                </div>
              )}
              <input 
                type="text" 
                placeholder="Search name / admission..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none w-full sm:w-48"
              />
              <button 
                onClick={() => setShowAddStudent(true)}
                disabled={overview?.totalStudents >= overview?.subscription.limits.maxStudents}
                className="glass-btn-primary text-xs flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title={overview?.totalStudents >= overview?.subscription.limits.maxStudents ? 'Student limit reached for your plan' : ''}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold">
                  <th className="py-3 px-4">Adm Number</th>
                  <th className="py-3 px-4">Student Name</th>
                  <th className="py-3 px-4">Homeroom Class</th>
                  <th className="py-3 px-4">Roll</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredStudents.map(s => (
                  <tr key={s.id} className="hover:bg-slate-900/10 text-slate-200">
                    <td className="py-3 px-4 font-mono font-bold text-brand-400">{s.admissionNumber}</td>
                    <td className="py-3 px-4 font-semibold">{s.userDetails.firstName} {s.userDetails.lastName}</td>
                    <td className="py-3 px-4 text-slate-400">{s.className}</td>
                    <td className="py-3 px-4 text-slate-400">{s.rollNumber}</td>
                    <td className="py-3 px-4 text-slate-450">{s.userDetails.email}</td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <button 
                        onClick={() => handleImpersonateUser(s.userDetails.email)}
                        className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Login <ArrowRight size={12} />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(s.userDetails.id, s.userDetails.firstName + ' ' + s.userDetails.lastName)}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(s.id, s.userDetails.firstName + ' ' + s.userDetails.lastName)}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'teachers' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <UsersRound className="text-brand-500" size={18} />
              Academic Faculty Directory
            </h3>

            <div className="flex gap-2 w-full sm:w-auto items-center">
              {overview && (
                <div className="text-[10px] font-bold tracking-wider px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-400">QUOTA:</span> <span className={overview.totalTeachers >= overview.subscription.limits.maxTeachers ? "text-red-400" : "text-brand-400"}>{overview.totalTeachers} / {overview.subscription.limits.maxTeachers}</span>
                </div>
              )}
              <input 
                type="text" 
                placeholder="Search teacher..."
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none w-full sm:w-48"
              />
              <button 
                onClick={() => setShowMapTeacher(true)}
                className="glass-btn-primary text-xs flex items-center gap-1 shrink-0"
              >
                <Link size={14} /> Map Faculty
              </button>
              <button 
                onClick={() => setShowAddTeacher(true)}
                disabled={overview?.totalTeachers >= overview?.subscription.limits.maxTeachers}
                className="glass-btn-primary text-xs flex items-center gap-1 shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                title={overview?.totalTeachers >= overview?.subscription.limits.maxTeachers ? 'Teacher limit reached for your plan' : ''}
              >
                <Plus size={14} /> Add
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold">
                  <th className="py-3 px-4">ID</th>
                  <th className="py-3 px-4">Faculty Name</th>
                  <th className="py-3 px-4">Specialization</th>
                  <th className="py-3 px-4">Qualification</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Gateway</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredTeachers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-900/10 text-slate-200">
                    <td className="py-3 px-4 font-mono">{t.employeeId}</td>
                    <td className="py-3 px-4 font-semibold">{t.userDetails.firstName} {t.userDetails.lastName}</td>
                    <td className="py-3 px-4 text-slate-400">{t.specialization}</td>
                    <td className="py-3 px-4 text-slate-400">{t.qualification}</td>
                    <td className="py-3 px-4 text-slate-450">{t.userDetails.email}</td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <button 
                        onClick={() => handleImpersonateUser(t.userDetails.email)}
                        className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Login <ArrowRight size={12} />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(t.userDetails.id, t.userDetails.firstName + ' ' + t.userDetails.lastName)}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(t.id, t.userDetails.firstName + ' ' + t.userDetails.lastName)}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'parents' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <UsersRound className="text-brand-500" size={18} />
              Guardian & Parent Directory
            </h3>

            <div className="flex gap-2 w-full sm:w-auto">
              <input 
                type="text" 
                placeholder="Search name / occupation..."
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none w-full sm:w-64"
              />
              <button 
                onClick={() => setShowAddParent(true)}
                className="glass-btn-primary text-xs flex items-center gap-1 shrink-0"
              >
                <Plus size={14} /> Add Parent
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold">
                  <th className="py-3 px-4">Guardian Name</th>
                  <th className="py-3 px-4">Occupation</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Linked Student Wards</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {filteredParents.map(p => (
                  <tr key={p.id} className="hover:bg-slate-900/10 text-slate-200">
                    <td className="py-3 px-4 font-semibold">{p.userDetails.firstName} {p.userDetails.lastName}</td>
                    <td className="py-3 px-4 text-slate-400">{p.occupation || 'N/A'}</td>
                    <td className="py-3 px-4 text-slate-400">{p.address || 'N/A'}</td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {p.linkedStudentNames && p.linkedStudentNames.length > 0 ? (
                          p.linkedStudentNames.map((name, idx) => (
                            <span key={idx} className="text-[10px] font-semibold text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded-lg">
                              {name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-slate-500">None linked</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-450">{p.userDetails.email}</td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <button 
                        onClick={() => handleImpersonateUser(p.userDetails.email)}
                        className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Login <ArrowRight size={12} />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(p.userDetails.id, p.userDetails.firstName + ' ' + p.userDetails.lastName)}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteParent(p.id, p.userDetails.firstName + ' ' + p.userDetails.lastName)}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'classes' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2">
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Syllabus Classes & Grade Sections</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {classes.map(c => {
                  const studentCount = students.filter(s => s.classId === c.id).length;
                  return (
                    <div key={c.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-200 text-sm">{c.name}</h4>
                        <p className="text-[10px] text-slate-500 uppercase mt-0.5">
                          {c.classTeacherId 
                            ? `Class Teacher: ${teachers.find(t => t.id === c.classTeacherId)?.userDetails.firstName} ${teachers.find(t => t.id === c.classTeacherId)?.userDetails.lastName}` 
                            : 'No Class Teacher Assigned'}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-xl">
                        {studentCount} Students
                      </span>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </div>

          <div className="lg:col-span-1">
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-200 text-sm">Establish Class Group</h3>
              <form onSubmit={handleCreateClass} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Class Name</label>
                  <input 
                    type="text"
                    placeholder="e.g. Grade 12-A"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                    required
                  />
                </div>
                <button type="submit" className="w-full glass-btn-primary text-xs">
                  Create Section Group
                </button>
              </form>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2">
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Subject Catalog Directory</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subjects.map(s => (
                  <div key={s.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-2">
                    <span className="text-[9px] font-bold text-brand-400 font-mono uppercase tracking-widest">{s.code}</span>
                    <h4 className="font-bold text-slate-200 text-sm mt-0.5">{s.name}</h4>
                    <p className="text-xs text-slate-450 leading-relaxed line-clamp-3">{s.description || 'No description added.'}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <div className="lg:col-span-1">
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-200 text-sm">Register Syllabus Subject</h3>
              <form onSubmit={handleCreateSubject} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Name</label>
                  <input type="text" placeholder="e.g. Organic Chemistry" value={subName} onChange={(e) => setSubName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Code</label>
                  <input type="text" placeholder="e.g. CHEM201" value={subCode} onChange={(e) => setSubCode(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
                  <textarea placeholder="Outline course syllabus topics..." rows={3} value={subDesc} onChange={(e) => setSubDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none" />
                </div>
                <button type="submit" className="w-full glass-btn-primary text-xs">
                  Publish Subject
                </button>
              </form>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'impersonation' && (
        <GlassCard className="space-y-6 max-w-xl mx-auto">
          <div className="border-b border-slate-850 pb-3">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Eye className="text-brand-500" size={18} />
              Institutional Portal Impersonation Gateway
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select any student, teacher, or parent below to instantly log in to their respective portals. This allows administrators to audit dashboards, troubleshoot grades, or review tuition billing sheets.
            </p>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {mockDb.users.filter(u => u.role !== 'SUPER_ADMIN' && u.role !== 'ADMIN').map(u => (
              <div 
                key={u.id}
                onClick={() => handleImpersonateUser(u.email)}
                className="p-3 bg-slate-900/30 border border-slate-850 hover:border-brand-500/25 rounded-2xl cursor-pointer flex items-center justify-between group active:scale-[0.99] transition-all"
              >
                <div className="flex items-center gap-3">
                  <img src={u.avatarUrl || ''} alt="" className="w-8 h-8 rounded object-cover border border-slate-800" />
                  <div>
                    <h4 className="font-semibold text-xs text-slate-200">{u.firstName} {u.lastName}</h4>
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{u.role}</span>
                  </div>
                </div>
                <button className="text-[11px] font-bold text-brand-500 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                  Access Portal &rarr;
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {activeTab === 'fees' && (
        <PremiumLock 
          isLocked={!plan.features.billing} 
          requiredTier="Pro" 
          featureName="Billing & Invoicing"
        >
          <GlassCard className="space-y-6">
            <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Institutional Finance Ledger</h3>
            <p className="text-xs text-slate-400">
              For advanced institutional billing reports, please access your head admin payment drawer. In this version, manual collections are fully managed. Click custom mapping links above to tie student billing structures.
            </p>
          </GlassCard>
        </PremiumLock>
      )}

      {/* Register Student Drawer overlay */}
      {showAddStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Register Student Account</h4>
              <button onClick={() => setShowAddStudent(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input type="email" placeholder="student@aegis.com" value={stEmail} onChange={(e) => setStEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Admission number</label>
                <input type="text" placeholder="ADM202509" value={stAdmission} onChange={(e) => setStAdmission(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" placeholder="Leo" value={stFirst} onChange={(e) => setStFirst(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" placeholder="DaVinci" value={stLast} onChange={(e) => setStLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Assign Class Section</label>
                <select value={stClass} onChange={(e) => setStClass(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full" required>
                  <option value="">-- Choose Class --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Roll Number</label>
                <input type="number" value={stRoll} onChange={(e) => setStRoll(parseInt(e.target.value) || 1)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Gender</label>
                <select value={stGender} onChange={(e) => setStGender(e.target.value as any)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full">
                  <option value="MALE">Male</option>
                  <option value="FEMALE">Female</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Date of Birth</label>
                <input type="date" value={stDob} onChange={(e) => setStDob(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Student Portal Password</label>
                <div className="relative">
                  <input 
                    type={showStPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={stPassword}
                    onChange={(e) => setStPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 pr-9 focus:outline-none focus:border-brand-500 text-slate-100"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowStPassword(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showStPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAddStudent(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Register</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Link Parent-Student Drawer Overlay */}
      {showLinkParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Link Parent & Student</h4>
              <button onClick={() => setShowLinkParent(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleLinkParentStudent} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Select Parent Guardian</label>
                <select value={selectedParentId} onChange={(e) => setSelectedParentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full" required>
                  <option value="">-- Choose Parent --</option>
                  {parents.map(p => (
                    <option key={p.id} value={p.id}>{p.userDetails.firstName} {p.userDetails.lastName} ({p.occupation})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Select Student Ward</label>
                <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full" required>
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.userDetails.firstName} {s.userDetails.lastName} ({s.className})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Guardian Relationship Type</label>
                <input type="text" placeholder="e.g. Father, Mother, Uncle" value={parentRelationship} onChange={(e) => setParentRelationship(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowLinkParent(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Link Accounts</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Assign Class Teacher Drawer overlay */}
      {showMapTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Assign Faculty Mapping</h4>
              <button onClick={() => setShowMapTeacher(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleMapTeacherClassSubject} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Choose Faculty Teacher</label>
                <select value={mapTeacherId} onChange={(e) => setMapTeacherId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full text-slate-200" required>
                  <option value="">-- Choose Teacher --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.userDetails.firstName} {t.userDetails.lastName} ({t.specialization})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Choose Homeroom Class</label>
                <select value={mapClassId} onChange={(e) => setMapClassId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full text-slate-200" required>
                  <option value="">-- Choose Class --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Choose Course Subject</label>
                <select value={mapSubjectId} onChange={(e) => setMapSubjectId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full text-slate-200" required>
                  <option value="">-- Choose Subject --</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                  ))}
                </select>
              </div>

              {/* Weekly Class Schedule Period Section */}
              <div className="p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3">
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest leading-none">Weekly Class Schedule Period</p>
                <p className="text-[9px] text-slate-450 mt-1 leading-relaxed">Specify class period times to automatically synchronize with student and teacher timetables.</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Day of Week</label>
                    <select 
                      value={mapDayOfWeek} 
                      onChange={(e) => setMapDayOfWeek(parseInt(e.target.value))} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full text-slate-200 focus:outline-none focus:border-brand-500"
                    >
                      <option value={1}>Monday</option>
                      <option value={2}>Tuesday</option>
                      <option value={3}>Wednesday</option>
                      <option value={4}>Thursday</option>
                      <option value={5}>Friday</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Classroom Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Room 303, Lab B" 
                      value={mapClassroom} 
                      onChange={(e) => setMapClassroom(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Start Time</label>
                    <input 
                      type="time" 
                      value={mapStartTime} 
                      onChange={(e) => setMapStartTime(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">End Time</label>
                    <input 
                      type="time" 
                      value={mapEndTime} 
                      onChange={(e) => setMapEndTime(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowMapTeacher(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Assign Mapping</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Assign Class Teacher Modal */}
      {showAssignClassTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-sm space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <BookMarked className="text-brand-500" size={16} />
                  Assign Class Teacher
                </h3>
                <p className="text-[10px] text-slate-400 mt-1">Designate a teacher to manage a homeroom class.</p>
              </div>
              <button onClick={() => setShowAssignClassTeacher(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleAssignClassTeacher} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Select Class</label>
                <select 
                  value={assignCtClassId} 
                  onChange={(e) => setAssignCtClassId(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                  required
                >
                  <option value="">-- Choose Class --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Select Teacher</label>
                <select 
                  value={assignCtTeacherId} 
                  onChange={(e) => setAssignCtTeacherId(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                  required
                >
                  <option value="">-- Choose Teacher --</option>
                  {teachers.map(t => (
                    <option key={t.id} value={t.id}>{t.userDetails.firstName} {t.userDetails.lastName} ({t.specialization})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAssignClassTeacher(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Assign Teacher</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
      {/* Register Teacher Modal */}
      {showAddTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Register Teacher Account</h4>
              <button onClick={() => setShowAddTeacher(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreateTeacher} className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input type="email" placeholder="teacher@aegis.com" value={tcEmail} onChange={(e) => setTcEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Employee ID</label>
                <input type="text" placeholder="EMP123" value={tcEmpId} onChange={(e) => setTcEmpId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" placeholder="First Name" value={tcFirst} onChange={(e) => setTcFirst(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" placeholder="Last Name" value={tcLast} onChange={(e) => setTcLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Specialization</label>
                <input type="text" placeholder="Physics & Mathematics" value={tcSpecial} onChange={(e) => setTcSpecial(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Qualification</label>
                <input type="text" placeholder="Ph.D. in Physics" value={tcQual} onChange={(e) => setTcQual(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone</label>
                <input type="text" placeholder="+1 (555) 000-0000" value={tcPhone} onChange={(e) => setTcPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Teacher Portal Password</label>
                <div className="relative">
                  <input 
                    type={showTcPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={tcPassword}
                    onChange={(e) => setTcPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 pr-9 focus:outline-none focus:border-brand-500 text-slate-100"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowTcPassword(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showTcPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAddTeacher(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Register Faculty</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Register Parent Modal */}
      {showAddParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Register Parent Account</h4>
              <button onClick={() => setShowAddParent(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreateParent} className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input type="email" placeholder="parent@aegis.com" value={prEmail} onChange={(e) => setPrEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Occupation</label>
                <input type="text" placeholder="Architect, Doctor, etc." value={prOccup} onChange={(e) => setPrOccup(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" placeholder="First Name" value={prFirst} onChange={(e) => setPrFirst(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" placeholder="Last Name" value={prLast} onChange={(e) => setPrLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Home Address</label>
                <input type="text" placeholder="100 Silicon Valley Way" value={prAddr} onChange={(e) => setPrAddr(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone</label>
                <input type="text" placeholder="+1 (555) 000-0000" value={prPhone} onChange={(e) => setPrPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
              </div>

              {/* Secure Student Link verification panel */}
              <div className="col-span-1 sm:col-span-2 p-3.5 bg-slate-950/40 border border-slate-850 rounded-2xl space-y-3 mt-1">
                <p className="text-[10px] font-bold text-brand-400 uppercase tracking-widest leading-none">Secure Student Ward Linking</p>
                <p className="text-[9px] text-slate-400 mt-1 leading-relaxed">Select your child ward and enter their exact school Admission Number to securely verify and establish the guardian mapping.</p>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Choose Student Ward</label>
                    <select 
                      value={prStudentId} 
                      onChange={(e) => setPrStudentId(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full text-slate-200 focus:outline-none focus:border-brand-500"
                      required
                    >
                      <option value="">-- Choose Student --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.userDetails.firstName} {s.userDetails.lastName} ({s.className})</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Admission Number</label>
                    <input 
                      type="text" 
                      placeholder="e.g. ADM2025001" 
                      value={prAdmissionNum} 
                      onChange={(e) => setPrAdmissionNum(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                      required
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-1">
                    <label className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Relationship</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Father, Mother" 
                      value={prRelation} 
                      onChange={(e) => setPrRelation(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-100" 
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1 sm:col-span-2 mt-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Parent Portal Password</label>
                <div className="relative">
                  <input 
                    type={showPrPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={prPassword}
                    onChange={(e) => setPrPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 pr-9 focus:outline-none focus:border-brand-500 text-slate-100"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPrPassword(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPrPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="col-span-1 sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAddParent(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Register Guardian</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Establish Class Modal */}
      {showAddClass && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Layers className="text-brand-500" size={15} />
                Establish Class Group
              </h4>
              <button onClick={() => setShowAddClass(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreateClass} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Class Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Grade 12-A" 
                  value={newClassName} 
                  onChange={(e) => setNewClassName(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAddClass(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Create Section Group</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Password Reset Modal Overlay */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-sm space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Key className="text-brand-500" size={15} />
                Reset User Credentials
              </h4>
              <button onClick={() => setShowResetModal(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handlePerformReset} className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target User Account</span>
                <p className="text-xs font-semibold text-slate-200">{resetUserName}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Set New Security Key</label>
                <input 
                  type="text" 
                  placeholder="Enter new password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowResetModal(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Apply Credentials</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>
  );
};

