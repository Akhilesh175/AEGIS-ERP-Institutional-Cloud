import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { mockDb } from '../services/mockDb';
import { Student, Teacher, Parent, Class, Subject, User, FeeStructure, FeePayment } from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Building, Users, UsersRound, Layers, BookMarked, DollarSign, 
  Eye, EyeOff, Plus, Link, Calendar, CheckCircle2, ShieldAlert, ArrowRight, Key, Crown, Trash2, AlertTriangle, CheckCircle, XCircle, Edit, CreditCard
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

  // Danger Zone states
  const [dangerEmail, setDangerEmail] = useState('');
  const [dangerLoading, setDangerLoading] = useState(false);
  const [dangerResults, setDangerResults] = useState<{ email: string; deleted: boolean; role: string; message: string }[]>([]);
  const [bulkEmails, setBulkEmails] = useState('jp@gmail.com\nakash@gmail.com\nsk@gmail.com\nram@gmail.com\njk@gmail.com\nmanan2@gmail.com\nbasant1@gmail.com\nrajan@gmail.com\nmanan3@gmail.com\nvishal1@gmail.com\njj@gmail.com\nak@gmail.com\nmanan@gmail.com\nmanan1@gmail.com\nvishal@gmail.com\nbasant@gmail.com');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [purgeLoading, setPurgeLoading] = useState(false);
  const [purgeResults, setPurgeResults] = useState<{ email: string; purged: boolean; message: string }[]>([]);

  // Academic Sessions states
  const [academicSessionsList, setAcademicSessionsList] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionStart, setNewSessionStart] = useState('');
  const [newSessionEnd, setNewSessionEnd] = useState('');
  const [newSessionActive, setNewSessionActive] = useState(true);

  // Edit Academic Session states
  const [editingSession, setEditingSession] = useState<any | null>(null);
  const [editSessionName, setEditSessionName] = useState('');
  const [editSessionStart, setEditSessionStart] = useState('');
  const [editSessionEnd, setEditSessionEnd] = useState('');

  // Invoicing Office States
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [feePayments, setFeePayments] = useState<FeePayment[]>([]);
  const [showAddFee, setShowAddFee] = useState(false);
  const [showEditFee, setShowEditFee] = useState(false);
  const [editFeeId, setEditFeeId] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [feeDueDate, setFeeDueDate] = useState('');
  const [feeDescription, setFeeDescription] = useState('');
  const [feeClassId, setFeeClassId] = useState('');
  const [selectedFeeStructure, setSelectedFeeStructure] = useState<FeeStructure | null>(null);

  // Payment Collection States
  const [collectingPayment, setCollectingPayment] = useState<{ student: Student & { userDetails: User }; structure: FeeStructure } | null>(null);
  const [paymentAmountPaid, setPaymentAmountPaid] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentTxId, setPaymentTxId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'PARTIAL' | 'OVERDUE'>('PAID');

  const loadAcademicSessions = async () => {
    if (!session?.user?.schoolId) return;
    setSessionsLoading(true);
    try {
      const data = await mockApi.adminGetAcademicSessions(session.user.schoolId);
      setAcademicSessionsList(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSessionsLoading(false);
    }
  };

  const handleCreateAcademicSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.schoolId || !newSessionName.trim() || !newSessionStart || !newSessionEnd) return;
    try {
      await mockApi.adminCreateAcademicSession(
        session.user.schoolId,
        newSessionName,
        newSessionStart,
        newSessionEnd,
        newSessionActive
      );
      setNewSessionName('');
      setNewSessionStart('');
      setNewSessionEnd('');
      setNewSessionActive(true);
      loadAcademicSessions();
      alert('Academic session created successfully!');
    } catch (err: any) {
      alert(err.message || 'Error creating academic session');
    }
  };

  const handleSetActiveSession = async (id: string) => {
    if (!session?.user?.schoolId) return;
    if (!window.confirm('Are you sure you want to change the active academic session? This will affect all timetables, fee calculations, and active terms.')) return;
    try {
      await mockApi.adminSetActiveAcademicSession(session.user.schoolId, id);
      loadAcademicSessions();
      alert('Active academic session updated!');
    } catch (err: any) {
      alert(err.message || 'Error updating active session');
    }
  };

  const handleStartEditSession = (sess: any) => {
    setEditingSession(sess);
    setEditSessionName(sess.name);
    setEditSessionStart(sess.startDate);
    setEditSessionEnd(sess.endDate);
  };

  const handleEditAcademicSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.schoolId || !editingSession || !editSessionName.trim() || !editSessionStart || !editSessionEnd) return;
    try {
      await mockApi.adminEditAcademicSession(
        session.user.schoolId,
        editingSession.id,
        editSessionName.trim(),
        editSessionStart,
        editSessionEnd
      );
      setEditingSession(null);
      setEditSessionName('');
      setEditSessionStart('');
      setEditSessionEnd('');
      loadAcademicSessions();
      alert('Academic session updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error updating academic session');
    }
  };

  const handleDeleteAcademicSession = async (sess: any) => {
    if (!session?.user?.schoolId) return;
    if (sess.isCurrent) {
      alert('Cannot delete the currently active academic session. Please activate a different session first.');
      return;
    }
    if (!window.confirm(`Are you sure you want to permanently delete the academic session "${sess.name}"?\n\nWARNING: This will also remove ALL associated classes, students, timetables, attendance, assignments, and quizzes linked to this session. This action cannot be undone.`)) return;
    try {
      await mockApi.adminDeleteAcademicSession(session.user.schoolId, sess.id);
      loadAcademicSessions();
      loadData();
      alert('Academic session and all associated data deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Error deleting academic session');
    }
  };

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

  const handleDeleteByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !dangerEmail.trim()) return;
    setDangerLoading(true);
    try {
      const result = await mockApi.adminDeleteUserByEmail(adminId, dangerEmail.trim().toLowerCase());
      setDangerResults(prev => [{ email: dangerEmail.trim(), ...result }, ...prev]);
      if (result.deleted) { loadData(); setDangerEmail(''); }
    } catch (err: any) {
      setDangerResults(prev => [{ email: dangerEmail.trim(), deleted: false, role: 'ERROR', message: err.message || 'Deletion failed' }, ...prev]);
    } finally {
      setDangerLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!adminId) return;
    const emails = bulkEmails.split('\n').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) return;
    if (!window.confirm(`This will permanently delete ${emails.length} user accounts and all their associated data. This action cannot be undone. Proceed?`)) return;
    setBulkLoading(true);
    setDangerResults([]);
    const results: { email: string; deleted: boolean; role: string; message: string }[] = [];
    for (const email of emails) {
      try {
        const result = await mockApi.adminDeleteUserByEmail(adminId, email);
        results.push({ email, ...result });
        setDangerResults([...results]);
      } catch (err: any) {
        results.push({ email, deleted: false, role: 'ERROR', message: err.message || 'Failed' });
        setDangerResults([...results]);
      }
    }
    loadData();
    setBulkLoading(false);
  };

  const handlePurgeOrphanAuth = async () => {
    if (!adminId) return;
    const emails = bulkEmails.split('\n').map(e => e.trim().toLowerCase()).filter(Boolean);
    if (emails.length === 0) return;
    if (!window.confirm(`This will force-delete the auth.users entries for ${emails.length} emails. Use this if you deleted from the SQL editor but still see "already registered" errors.`)) return;
    setPurgeLoading(true);
    setPurgeResults([]);
    try {
      const results = await mockApi.adminPurgeOrphanAuthByEmail(adminId, emails);
      setPurgeResults(results);
    } catch (err: any) {
      alert('Purge failed: ' + (err.message || 'Unknown error'));
    } finally {
      setPurgeLoading(false);
    }
  };

  const loadData = async () => {
    try {
      // Sync subscription plan in real time during load / poll
      await syncSubscriptionPlan();

      const [over, st, tc, pr, cls, sub, fees, pays] = await Promise.all([
        mockApi.adminGetInstitutionOverview(),
        mockApi.adminGetStudents(),
        mockApi.adminGetTeachers(),
        mockApi.adminGetParents(),
        mockApi.adminGetClasses(),
        mockApi.adminGetSubjects(),
        mockApi.adminGetFeeStructures(),
        mockApi.adminGetFeePayments()
      ]);
      setOverview(over);
      setStudents(st);
      setTeachers(tc);
      setParents(pr);
      setClasses(cls);
      setSubjects(sub);
      setFeeStructures(fees);
      setFeePayments(pays);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    if (activeTab === 'academicsessions') {
      loadAcademicSessions();
    }
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

  const handleCreateFeeStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !feeClassId || !feeAmount || !feeDueDate || !feeDescription) return;

    try {
      await mockApi.adminCreateFeeStructure(
        adminId,
        feeClassId,
        parseFloat(feeAmount),
        feeDueDate,
        feeDescription
      );
      setShowAddFee(false);
      setFeeClassId('');
      setFeeAmount('');
      setFeeDueDate('');
      setFeeDescription('');
      loadData();
      alert('Billing invoice defined and class-wide student records populated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error defining fee invoice structure');
    }
  };

  const handleEditFeeStructure = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !editFeeId || !feeAmount || !feeDueDate || !feeDescription) return;

    try {
      await mockApi.adminEditFeeStructure(
        adminId,
        editFeeId,
        parseFloat(feeAmount),
        feeDueDate,
        feeDescription
      );
      setShowEditFee(false);
      setEditFeeId('');
      setFeeAmount('');
      setFeeDueDate('');
      setFeeDescription('');
      loadData();
      alert('Fee invoice structure updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error updating fee invoice structure');
    }
  };

  const handleDeleteFeeStructure = async (id: string) => {
    if (!adminId) return;
    if (!window.confirm('WARNING: Deleting this billing structure will permanently erase ALL associated payments and invoicing history for all students! Are you absolutely sure?')) return;

    try {
      await mockApi.adminDeleteFeeStructure(adminId, id);
      setSelectedFeeStructure(null);
      loadData();
      alert('Fee invoice structure and all associated records permanently removed.');
    } catch (err: any) {
      alert(err.message || 'Error deleting fee structure');
    }
  };

  const handleRecordFeePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !collectingPayment) return;

    try {
      await mockApi.adminRecordFeePayment(
        adminId,
        collectingPayment.student.id,
        collectingPayment.structure.id,
        parseFloat(paymentAmountPaid) || 0.00,
        paymentMethod,
        paymentTxId,
        paymentStatus
      );
      setCollectingPayment(null);
      setPaymentAmountPaid('');
      setPaymentMethod('Cash');
      setPaymentTxId('');
      loadData();
      alert('Student invoice payment recorded successfully!');
    } catch (err: any) {
      alert(err.message || 'Error recording student payment');
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
                            ? `Class Teacher: ${teachers.find(t => t.id === c.classTeacherId)?.userDetails?.firstName || ''} ${teachers.find(t => t.id === c.classTeacherId)?.userDetails?.lastName || ''}` 
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

      {activeTab === 'academicsessions' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Academic Session Form */}
          <div className="lg:col-span-1 space-y-6">
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850 flex items-center gap-2">
                <Calendar className="text-brand-500" size={16} />
                Create Academic Session
              </h3>
              <form onSubmit={handleCreateAcademicSession} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Session Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. 2026-2027 Academic Year" 
                    value={newSessionName} 
                    onChange={(e) => setNewSessionName(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                  <input 
                    type="date" 
                    value={newSessionStart} 
                    onChange={(e) => setNewSessionStart(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">End Date</label>
                  <input 
                    type="date" 
                    value={newSessionEnd} 
                    onChange={(e) => setNewSessionEnd(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" 
                    required 
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="newSessionActive" 
                    checked={newSessionActive} 
                    onChange={(e) => setNewSessionActive(e.target.checked)} 
                    className="w-4 h-4 bg-slate-900 border border-slate-800 rounded text-brand-500 focus:ring-0 focus:ring-offset-0" 
                  />
                  <label htmlFor="newSessionActive" className="text-xs font-semibold text-slate-350 cursor-pointer select-none">
                    Set as Current Active Session
                  </label>
                </div>
                <button type="submit" className="w-full glass-btn-primary text-xs">
                  Establish Academic Session
                </button>
              </form>
            </GlassCard>

            {/* Edit Academic Session Drawer */}
            {editingSession && (
              <GlassCard className="space-y-4 border-amber-500/30 bg-amber-500/5">
                <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                  <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <Edit className="text-amber-400" size={16} />
                    Edit Session
                  </h3>
                  <button 
                    onClick={() => setEditingSession(null)} 
                    className="text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors"
                  >
                    ✕ Cancel
                  </button>
                </div>
                <form onSubmit={handleEditAcademicSession} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Session Name</label>
                    <input 
                      type="text" 
                      value={editSessionName} 
                      onChange={(e) => setEditSessionName(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/50" 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Start Date</label>
                    <input 
                      type="date" 
                      value={editSessionStart} 
                      onChange={(e) => setEditSessionStart(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/50" 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">End Date</label>
                    <input 
                      type="date" 
                      value={editSessionEnd} 
                      onChange={(e) => setEditSessionEnd(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-amber-500/50" 
                      required 
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 glass-btn-primary text-xs" style={{ background: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                      Save Changes
                    </button>
                    <button type="button" onClick={() => setEditingSession(null)} className="flex-1 glass-btn text-xs">
                      Cancel
                    </button>
                  </div>
                </form>
              </GlassCard>
            )}
          </div>

          {/* Academic Sessions List */}
          <div className="lg:col-span-2 space-y-6">
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Building className="text-brand-500" size={16} />
                  Academic Terms & Sessions Catalog
                </h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  {academicSessionsList.length} session{academicSessionsList.length !== 1 ? 's' : ''}
                </span>
              </div>

              {sessionsLoading ? (
                <div className="text-center py-12 text-slate-400 italic text-sm">
                  Loading academic sessions...
                </div>
              ) : academicSessionsList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 italic text-sm">
                  No academic sessions registered. Please establish a new term on the left.
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                  {academicSessionsList.map(sess => (
                    <div 
                      key={sess.id} 
                      className={`p-4 rounded-2xl border transition-all ${
                        sess.isCurrent 
                          ? 'bg-brand-500/5 border-brand-500/30' 
                          : 'bg-slate-950/20 border-slate-850 hover:border-slate-700'
                      } ${editingSession?.id === sess.id ? 'ring-1 ring-amber-500/40' : ''}`}
                    >
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-slate-200 text-sm">{sess.name}</h4>
                            {sess.isCurrent && (
                              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 uppercase tracking-wider">
                                Active Current Session
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Duration: {new Date(sess.startDate).toLocaleDateString()} &mdash; {new Date(sess.endDate).toLocaleDateString()}
                          </p>
                          <p className="text-[10px] text-slate-600 font-mono">
                            ID: {sess.id.substring(0, 8)}...
                          </p>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => handleStartEditSession(sess)}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/5 flex items-center gap-1.5 transition-all"
                            title="Edit session name and dates"
                          >
                            <Edit size={12} />
                            Edit
                          </button>
                          {!sess.isCurrent && (
                            <>
                              <button
                                onClick={() => handleSetActiveSession(sess.id)}
                                className="glass-btn-primary text-[11px] font-bold px-3 py-1.5 flex items-center gap-1.5 transition-all"
                              >
                                <CheckCircle2 size={13} />
                                Activate
                              </button>
                              <button
                                onClick={() => handleDeleteAcademicSession(sess)}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-400 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5 flex items-center gap-1.5 transition-all"
                                title="Permanently delete this session and all related data"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </>
                          )}
                          {sess.isCurrent && (
                            <span className="text-[10px] text-slate-600 italic">Active — cannot delete</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
          <div className="space-y-6">
            {/* Financial Overview Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <GlassCard className="p-4 flex items-center justify-between border-emerald-500/10 shadow-emerald-500/5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Collected Income</p>
                  <h3 className="text-xl font-extrabold text-emerald-400">
                    ${feePayments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + p.amountPaid, 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[9px] text-slate-500">Total cleared student payments</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                  <CheckCircle size={20} />
                </div>
              </GlassCard>

              <GlassCard className="p-4 flex items-center justify-between border-amber-500/10 shadow-amber-500/5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Outstanding Invoices</p>
                  <h3 className="text-xl font-extrabold text-amber-400">
                    ${(
                      feeStructures.reduce((acc, fs) => acc + (fs.amount * students.filter(s => s.classId === fs.classId).length), 0) -
                      feePayments.filter(p => p.status === 'PAID').reduce((acc, p) => acc + p.amountPaid, 0)
                    ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[9px] text-slate-500">Total pending collectable fees</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                  <AlertTriangle size={20} />
                </div>
              </GlassCard>

              <GlassCard className="p-4 flex items-center justify-between border-brand-500/10 shadow-brand-500/5">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Institutional Ledger</p>
                  <h3 className="text-xl font-extrabold text-brand-400">
                    ${feeStructures.reduce((acc, fs) => acc + (fs.amount * students.filter(s => s.classId === fs.classId).length), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </h3>
                  <span className="text-[9px] text-slate-500">Total institutional billing mapped</span>
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-400">
                  <DollarSign size={20} />
                </div>
              </GlassCard>
            </div>

            {/* Invoices List and Student payments ledger view split */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: List of class-wide Invoices */}
              <div className="lg:col-span-1 space-y-4">
                <GlassCard className="p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      <CreditCard className="text-brand-500" size={16} />
                      Class Billing Fees
                    </h3>
                    <button
                      onClick={() => setShowAddFee(true)}
                      className="px-2.5 py-1 text-[10px] font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors flex items-center gap-1 active:scale-95"
                    >
                      <Plus size={12} />
                      Create Invoice
                    </button>
                  </div>

                  <div className="space-y-3 max-h-[55vh] overflow-y-auto pr-1">
                    {feeStructures.length === 0 ? (
                      <div className="text-center py-8 text-slate-500 text-xs">No active invoices found. Create one to begin billing.</div>
                    ) : (
                      feeStructures.map(fs => {
                        const classObj = classes.find(c => c.id === fs.classId);
                        const isSelected = selectedFeeStructure?.id === fs.id;
                        return (
                          <div 
                            key={fs.id}
                            onClick={() => setSelectedFeeStructure(fs)}
                            className={`p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                              isSelected 
                                ? 'bg-brand-500/5 border-brand-500/30' 
                                : 'bg-slate-900/10 border-slate-850 hover:bg-slate-900/30'
                            }`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="text-[9px] font-bold uppercase tracking-wider text-brand-400 bg-brand-500/5 px-2 py-0.5 rounded-full border border-brand-500/15">
                                  {classObj ? classObj.name : 'Unknown Class'}
                                </span>
                                <h4 className="font-semibold text-slate-200 text-xs mt-1.5 line-clamp-1">{fs.description}</h4>
                              </div>
                              <span className="text-xs font-extrabold text-slate-100 shrink-0">${fs.amount.toFixed(2)}</span>
                            </div>

                            <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 border-t border-slate-850/60 pt-2">
                              <span>Due: {new Date(fs.dueDate).toLocaleDateString()}</span>
                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditFeeId(fs.id);
                                    setFeeAmount(fs.amount.toString());
                                    setFeeDueDate(fs.dueDate);
                                    setFeeDescription(fs.description);
                                    setFeeClassId(fs.classId);
                                    setShowEditFee(true);
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                                  title="Edit Invoice"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFeeStructure(fs.id);
                                  }}
                                  className="p-1 text-red-500/80 hover:text-red-400 transition-colors"
                                  title="Delete Invoice"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </GlassCard>
              </div>

              {/* Right Column: Invoiced Student payments ledger */}
              <div className="lg:col-span-2">
                <GlassCard className="p-5 space-y-4">
                  <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm">Student Payments Ledger</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {selectedFeeStructure 
                          ? `Reviewing records for "${selectedFeeStructure.description}"` 
                          : 'Select an invoice structure on the left to view payments details'}
                      </p>
                    </div>
                  </div>

                  {!selectedFeeStructure ? (
                    <div className="text-center py-20 text-slate-500 text-xs">
                      Please select a billing fee structure from the left panel to load the student ledger.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-850">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 font-bold">
                            <th className="py-3 px-4">Student Name</th>
                            <th className="py-3 px-4">Roll Number</th>
                            <th className="py-3 px-4">Amount Paid</th>
                            <th className="py-3 px-4">Status</th>
                            <th className="py-3 px-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/60">
                          {students
                            .filter(s => s.classId === selectedFeeStructure.classId)
                            .map(student => {
                              const payment = feePayments.find(
                                p => p.feeStructureId === selectedFeeStructure.id && p.studentId === student.id
                              );
                              const status = payment ? payment.status : 'PENDING';
                              return (
                                <tr key={student.id} className="hover:bg-slate-900/10 text-slate-200">
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-200">{student.userDetails.firstName} {student.userDetails.lastName}</div>
                                    <div className="text-[9px] text-slate-500 font-mono">{student.admissionNumber}</div>
                                  </td>
                                  <td className="py-3 px-4 text-slate-400">{student.rollNumber || '-'}</td>
                                  <td className="py-3 px-4">
                                    {payment && payment.amountPaid > 0 ? (
                                      <div className="font-semibold text-slate-200">${payment.amountPaid.toFixed(2)}</div>
                                    ) : (
                                      <span className="text-slate-500">$0.00</span>
                                    )}
                                    {payment?.paymentDate && (
                                      <div className="text-[8px] text-slate-500">{new Date(payment.paymentDate).toLocaleDateString()}</div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${
                                      status === 'PAID' 
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                                        : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    }`}>
                                      {status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <button
                                      onClick={() => {
                                        setCollectingPayment({ student, structure: selectedFeeStructure });
                                        setPaymentAmountPaid(selectedFeeStructure.amount.toString());
                                        setPaymentMethod('Cash');
                                        setPaymentTxId('TX' + Math.random().toString(36).substr(2, 8).toUpperCase());
                                        setPaymentStatus('PAID');
                                      }}
                                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all hover:shadow-lg active:scale-95 ${
                                        status === 'PAID'
                                          ? 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                                          : 'bg-brand-600 hover:bg-brand-500 text-white hover:shadow-brand-500/10'
                                      }`}
                                    >
                                      {status === 'PAID' ? 'Edit Payment' : 'Collect Fee'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          {students.filter(s => s.classId === selectedFeeStructure.classId).length === 0 && (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                                No students currently registered in this class section.
                              </td>
                            </tr>
                          )}
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

      {/* Create Invoicing Billing Structure Modal */}
      {showAddFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <CreditCard className="text-brand-500" size={16} />
                Define Institutional Invoice
              </h4>
              <button 
                onClick={() => {
                  setShowAddFee(false);
                  setFeeClassId('');
                  setFeeAmount('');
                  setFeeDueDate('');
                  setFeeDescription('');
                }} 
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreateFeeStructure} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Target Class Section</label>
                <select 
                  value={feeClassId} 
                  onChange={(e) => setFeeClassId(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200" 
                  required
                >
                  <option value="">-- Select Class --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Billing Amount ($ USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="3500.00" 
                  value={feeAmount} 
                  onChange={(e) => setFeeAmount(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Calendar Due Date</label>
                <input 
                  type="date" 
                  value={feeDueDate} 
                  onChange={(e) => setFeeDueDate(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Billing Description / Name</label>
                <input 
                  type="text" 
                  placeholder="Grade 10 Semester 2 Tuition & Materials Fee" 
                  value={feeDescription} 
                  onChange={(e) => setFeeDescription(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="pt-2 border-t border-slate-850 flex gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                >
                  Create Invoice Structure
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowAddFee(false);
                    setFeeClassId('');
                    setFeeAmount('');
                    setFeeDueDate('');
                    setFeeDescription('');
                  }} 
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Edit Invoicing Billing Structure Modal */}
      {showEditFee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Edit className="text-brand-500" size={16} />
                Edit Invoice Structure
              </h4>
              <button 
                onClick={() => {
                  setShowEditFee(false);
                  setEditFeeId('');
                  setFeeAmount('');
                  setFeeDueDate('');
                  setFeeDescription('');
                }} 
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleEditFeeStructure} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Billing Amount ($ USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="3500.00" 
                  value={feeAmount} 
                  onChange={(e) => setFeeAmount(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Calendar Due Date</label>
                <input 
                  type="date" 
                  value={feeDueDate} 
                  onChange={(e) => setFeeDueDate(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Billing Description / Name</label>
                <input 
                  type="text" 
                  placeholder="Grade 10 Semester 2 Tuition & Materials Fee" 
                  value={feeDescription} 
                  onChange={(e) => setFeeDescription(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="pt-2 border-t border-slate-850 flex gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                >
                  Save Changes
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowEditFee(false);
                    setEditFeeId('');
                    setFeeAmount('');
                    setFeeDueDate('');
                    setFeeDescription('');
                  }} 
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Collect Student Fee Payment Modal */}
      {collectingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <DollarSign className="text-brand-400" size={16} />
                Collect Payment Receipt
              </h4>
              <button 
                onClick={() => setCollectingPayment(null)} 
                className="text-xs text-slate-400 hover:text-slate-200"
              >
                Close
              </button>
            </div>

            <div className="p-3 bg-slate-900/30 border border-slate-850 rounded-xl">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest leading-none">Student Account</p>
              <h5 className="font-bold text-slate-200 mt-1">{collectingPayment.student.userDetails.firstName} {collectingPayment.student.userDetails.lastName}</h5>
              <p className="text-[10px] text-slate-400 mt-0.5">Structure: {collectingPayment.structure.description}</p>
            </div>

            <form onSubmit={handleRecordFeePayment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Amount Paid ($ USD)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="3500.00" 
                  value={paymentAmountPaid} 
                  onChange={(e) => setPaymentAmountPaid(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Payment Method</label>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200"
                    required
                  >
                    <option value="Cash">Cash Handover</option>
                    <option value="Bank Transfer">Bank Wire Transfer</option>
                    <option value="Stripe Credit Card">Stripe Credit Card</option>
                    <option value="Cheque">Physical Cheque</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Payment Status</label>
                  <select 
                    value={paymentStatus} 
                    onChange={(e) => setPaymentStatus(e.target.value as any)} 
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200"
                    required
                  >
                    <option value="PAID">PAID (Clear)</option>
                    <option value="PENDING">PENDING (Unpaid)</option>
                    <option value="OVERDUE">OVERDUE (Delayed)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Transaction ID / Reference</label>
                <input 
                  type="text" 
                  placeholder="TX_8B1293K1" 
                  value={paymentTxId} 
                  onChange={(e) => setPaymentTxId(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2.5 text-slate-200 focus:outline-none" 
                />
              </div>

              <div className="pt-2 border-t border-slate-850 flex gap-3">
                <button 
                  type="submit" 
                  className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-2 rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                >
                  Record Payment Received
                </button>
                <button 
                  type="button" 
                  onClick={() => setCollectingPayment(null)} 
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
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
      {activeTab === 'dangerzone' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-red-500/20 bg-red-950/10">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20">
                <AlertTriangle className="text-red-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-red-300 text-sm">Danger Zone — Permanent User Deletion</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Deleted accounts are permanently removed from the database, auth system, and all related records. This action is irreversible.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Single email delete */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Trash2 className="text-red-400" size={15} />
                Delete Single User by Email
              </h4>
              <form onSubmit={handleDeleteByEmail} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                  <input
                    id="danger-single-email"
                    type="email"
                    placeholder="user@example.com"
                    value={dangerEmail}
                    onChange={(e) => setDangerEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-red-500/50"
                    required
                  />
                </div>
                <button
                  id="danger-single-delete-btn"
                  type="submit"
                  disabled={dangerLoading}
                  className="w-full py-2 rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 transition-all disabled:opacity-50"
                >
                  {dangerLoading ? 'Deleting…' : 'Permanently Delete User'}
                </button>
              </form>
            </GlassCard>

            {/* Bulk email delete */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <ShieldAlert className="text-red-400" size={15} />
                Bulk Delete by Email List
              </h4>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email List (one per line)</label>
                <textarea
                  id="danger-bulk-emails"
                  rows={8}
                  value={bulkEmails}
                  onChange={(e) => setBulkEmails(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-red-500/50 font-mono resize-none"
                />
              </div>
              <button
                id="danger-bulk-delete-btn"
                type="button"
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="w-full py-2 rounded-xl text-xs font-bold bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 transition-all disabled:opacity-50"
              >
                {bulkLoading ? `Deleting… (${dangerResults.length} done)` : `Delete All ${bulkEmails.split('\n').filter(e => e.trim()).length} Accounts`}
              </button>
            </GlassCard>

            {/* Purge orphaned auth entries */}
            <GlassCard className="space-y-4 border border-orange-500/20 bg-orange-950/10 lg:col-span-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-orange-500/10 border border-orange-500/20">
                  <ShieldAlert className="text-orange-400" size={16} />
                </div>
                <div>
                  <h4 className="font-bold text-orange-300 text-sm">Purge Orphaned Auth Entries</h4>
                  <p className="text-[10px] text-slate-400">Use this if you deleted users via SQL Editor but still see "email already registered" errors. This force-removes the leftover auth.users entries using the service-role API.</p>
                </div>
              </div>
              <button
                id="danger-purge-auth-btn"
                type="button"
                onClick={handlePurgeOrphanAuth}
                disabled={purgeLoading}
                className="w-full py-2 rounded-xl text-xs font-bold bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-300 transition-all disabled:opacity-50"
              >
                {purgeLoading ? 'Purging auth entries…' : `Force-Purge Auth Entries for ${bulkEmails.split('\n').filter(e => e.trim()).length} Emails`}
              </button>
              {purgeResults.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {purgeResults.map((r, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded-lg border text-xs ${
                      r.purged ? 'bg-green-950/20 border-green-500/20' : 'bg-slate-900/50 border-slate-800'
                    }`}>
                      {r.purged
                        ? <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={12} />
                        : <XCircle className="text-slate-500 shrink-0 mt-0.5" size={12} />}
                      <div>
                        <span className={`font-mono font-bold ${r.purged ? 'text-green-300' : 'text-slate-400'}`}>{r.email}</span>
                        <p className="text-[10px] text-slate-500 mt-0.5">{r.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Results log */}
          {dangerResults.length > 0 && (
            <GlassCard className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-200 text-sm">Deletion Results</h4>
                <span className="text-[10px] text-slate-500">
                  {dangerResults.filter(r => r.deleted).length}/{dangerResults.length} deleted successfully
                </span>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {dangerResults.map((r, i) => (
                  <div key={i} className={`flex items-start gap-3 p-2.5 rounded-xl border text-xs ${
                    r.deleted
                      ? 'bg-green-950/20 border-green-500/20'
                      : 'bg-red-950/20 border-red-500/20'
                  }`}>
                    {r.deleted
                      ? <CheckCircle className="text-green-400 shrink-0 mt-0.5" size={13} />
                      : <XCircle className="text-red-400 shrink-0 mt-0.5" size={13} />}
                    <div>
                      <span className={`font-bold font-mono ${r.deleted ? 'text-green-300' : 'text-red-300'}`}>{r.email}</span>
                      {r.role !== 'UNKNOWN' && r.role !== 'ERROR' && (
                        <span className="ml-2 text-[10px] text-slate-500 uppercase">[{r.role}]</span>
                      )}
                      <p className="text-slate-400 mt-0.5 text-[10px]">{r.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

    </div>
  );
};

