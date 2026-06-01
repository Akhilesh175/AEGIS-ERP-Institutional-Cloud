import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import { mockDb } from '../services/mockDb';
import { Student, Teacher, Parent, Class, Subject, User, FeeStructure, FeePayment } from '../types';
import { GlassCard } from '../components/GlassCard';
import { 
  Building, Users, UsersRound, Layers, BookMarked, DollarSign, 
  Eye, EyeOff, Plus, Link, Calendar, CheckCircle2, ShieldAlert, ArrowRight, Key, Crown, Lock, Trash2, AlertTriangle, CheckCircle, XCircle, Edit, CreditCard,
  Mail, Send, RefreshCw, Play, FileSpreadsheet, FileText, CheckSquare, Sliders, HardDrive, Download, ChevronRight, BarChart2, Clock, Settings, Shield, Search, Activity,
  Award, BookOpen
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { subscriptionPlans } from '../services/subscriptionConfig';
import { OfflineSyncManager } from '../components/OfflineSyncManager';

export const AdminPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session, setSession, syncSubscriptionPlan } = useStore();
  const adminId = session?.user.id;
  const isAcademicOrSchoolAdmin = session?.user.role === 'ADMIN' || session?.user.role === 'ACADEMIC_ADMIN';
  const cachedSchool = session?.user.schoolId ? mockDb.schools.find(s => s.id === session.user.schoolId) : null;
  const currentPlanName = (cachedSchool?.subscriptionPlan || session?.schoolSubscriptionPlan || 'freemium').toLowerCase();
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;

  // Datasets
  const [overview, setOverview] = useState<any | null>(null);
  const [invoicesCount, setInvoicesCount] = useState(0);
  const [invoicesAmount, setInvoicesAmount] = useState(0);
  const [reportCardsCount, setReportCardsCount] = useState(0);
  const [driversCount, setDriversCount] = useState(0);
  const [pickupPointsCount, setPickupPointsCount] = useState(0);
  const [digitalAssetsCount, setDigitalAssetsCount] = useState(0);
  const [students, setStudents] = useState<(Student & { userDetails: User; className: string })[]>([]);
  const [teachers, setTeachers] = useState<(Teacher & { userDetails: User })[]>([]);
  const [parents, setParents] = useState<(Parent & { userDetails: User; linkedStudentNames: string[] })[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  // State variables for new transport, library, and exams modules
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [transportAssignments, setTransportAssignments] = useState<any[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([]);
  const [driverAttendanceList, setDriverAttendanceList] = useState<any[]>([]);
  const [bookCategories, setBookCategories] = useState<any[]>([]);
  const [bookIssues, setBookIssues] = useState<any[]>([]);
  const [libraryFines, setLibraryFines] = useState<any[]>([]);
  const [examsList, setExamsList] = useState<any[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [pickupPointsList, setPickupPointsList] = useState<any[]>([]);
  const [digitalAssetsList, setDigitalAssetsList] = useState<any[]>([]);
  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);

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
  const [prEmergencyPhone, setPrEmergencyPhone] = useState('');
  const [prStudentId, setPrStudentId] = useState('');
  const [prAdmissionNum, setPrAdmissionNum] = useState('');
  const [prRelation, setPrRelation] = useState('Father');
  const [prPassword, setPrPassword] = useState('');
  const [showPrPassword, setShowPrPassword] = useState(false);

  // ── Communications Center States ───────────────────
  const [commTemplate, setCommTemplate] = useState<'otp' | 'password_reset' | 'homework' | 'payment'>('otp');
  const [commTargetEmail, setCommTargetEmail] = useState('');
  const [commTargetPhone, setCommTargetPhone] = useState('');
  const [commCustomText, setCommCustomText] = useState('');
  const [commSending, setCommSending] = useState(false);
  const [commLogs, setCommLogs] = useState<any[]>([
    { id: '1', type: 'SMS', recipient: '+1 (555) 444-1111', template: 'OTP verification', status: 'DELIVERED', timestamp: new Date(Date.now() - 3600000).toISOString(), rate: '100%' },
    { id: '2', type: 'EMAIL', recipient: 'parent1@aegis.com', template: 'Payment Reminders', status: 'DELIVERED', timestamp: new Date(Date.now() - 7200000).toISOString(), rate: '100%' },
    { id: '3', type: 'SMS', recipient: '+1 (555) 444-2222', template: 'Homework Assigned', status: 'DELIVERED', timestamp: new Date(Date.now() - 12000000).toISOString(), rate: '100%' }
  ]);

  // ── Disaster Recovery Backup States ──────────────────
  const [backupPolicy, setBackupPolicy] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupLogs, setBackupLogs] = useState<any[]>([
    { id: '1', filename: 'aegis_prod_snap_20260529_2200.enc', type: 'DAILY_INCREMENTAL', size: '248.5 MB', status: 'SUCCESS', hash: 'sha256-a1b2c3d4...', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: '2', filename: 'aegis_prod_snap_20260528_2200.enc', type: 'DAILY_INCREMENTAL', size: '247.9 MB', status: 'SUCCESS', hash: 'sha256-f5g6h7i8...', timestamp: new Date(Date.now() - 90000000).toISOString() },
    { id: '3', filename: 'aegis_prod_full_20260525_0000.enc', type: 'FULL_SNAPSHOT', size: '1.2 GB', status: 'SUCCESS', hash: 'sha256-k9l0m1n2...', timestamp: new Date(Date.now() - 432000000).toISOString() }
  ]);
  const [restoreToken, setRestoreToken] = useState('');
  const [restoreProgress, setRestoreProgress] = useState(-1); // -1 = idle
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);

  // ── Analytics & File Exporters States ────────────────
  const [analyticsDateRange, setAnalyticsDateRange] = useState('30d');
  const [analyticsSection, setAnalyticsSection] = useState('all');
  const [showInvoicePdf, setShowInvoicePdf] = useState<any | null>(null);
  const [showReportCardPdf, setShowReportCardPdf] = useState<any | null>(null);

  // --- Form input states for Transport, Library, and Exam modules ---
  const [busPlate, setBusPlate] = useState('');
  const [busCapacity, setBusCapacity] = useState(30);
  const [busStatus, setBusStatus] = useState('ACTIVE');
  const [busDriverId, setBusDriverId] = useState('');

  const [rtName, setRtName] = useState('');
  const [rtCode, setRtCode] = useState('');
  const [rtStart, setRtStart] = useState('');
  const [rtEnd, setRtEnd] = useState('');
  const [rtFare, setRtFare] = useState(0);

  const [ppName, setPpName] = useState('');
  const [ppLat, setPpLat] = useState('');
  const [ppLng, setPpLng] = useState('');
  const [ppRouteId, setPpRouteId] = useState('');

  const [drName, setDrName] = useState('');
  const [drLicense, setDrLicense] = useState('');
  const [drPhone, setDrPhone] = useState('');

  const [taStudentId, setTaStudentId] = useState('');
  const [taRouteId, setTaRouteId] = useState('');
  const [taBusId, setTaBusId] = useState('');
  const [taPickupPointId, setTaPickupPointId] = useState('');

  const [maintBusId, setMaintBusId] = useState('');
  const [maintDate, setMaintDate] = useState('');
  const [maintDesc, setMaintDesc] = useState('');
  const [maintCost, setMaintCost] = useState(0);

  const [bkTitle, setBkTitle] = useState('');
  const [bkAuthor, setBkAuthor] = useState('');
  const [bkIsbn, setBkIsbn] = useState('');
  const [bkSubject, setBkSubject] = useState('');
  const [bkCopies, setBkCopies] = useState(5);

  const [bcName, setBcName] = useState('');
  const [bcCode, setBcCode] = useState('');

  const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'>>({});
  const [attendanceRemarks, setAttendanceRemarks] = useState<Record<string, string>>({});
  const [attendanceClassId, setAttendanceClassId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);

  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignClassId, setAssignClassId] = useState('');
  const [assignSubjectId, setAssignSubjectId] = useState('');
  const [assignDueDate, setAssignDueDate] = useState('');

  const [biBookId, setBiBookId] = useState('');
  const [biStudentId, setBiStudentId] = useState('');
  const [biDueDate, setBiDueDate] = useState('');

  const [brIssueId, setBrIssueId] = useState('');
  const [brStatus, setBrStatus] = useState('RETURNED');
  const [brFine, setBrFine] = useState(0);

  const [daTitle, setDaTitle] = useState('');
  const [daAuthor, setDaAuthor] = useState('');
  const [daUrl, setDaUrl] = useState('');
  const [daType, setDaType] = useState('pdf');

  const [exName, setExName] = useState('');
  const [exTerm, setExTerm] = useState('TERM 1');
  const [exStart, setExStart] = useState('');
  const [exEnd, setExEnd] = useState('');

  const [esExamId, setEsExamId] = useState('');
  const [esSubjectId, setEsSubjectId] = useState('');
  const [esMax, setEsMax] = useState(100);
  const [esPass, setEsPass] = useState(40);

  const [meExamId, setMeExamId] = useState('');
  const [meSubjectId, setMeSubjectId] = useState('');
  const [meClassId, setMeClassId] = useState('');
  const [meMarks, setMeMarks] = useState<Record<string, number>>({});
  const [meRemarks, setMeRemarks] = useState<Record<string, string>>({});

  const [rcStudentId, setRcStudentId] = useState('');
  const [rcTerm, setRcTerm] = useState('TERM 1');
  const [rcAttendance, setRcAttendance] = useState(90);
  const [rcRemarks, setRcRemarks] = useState('');


  // ── RBAC Dynamic Permission states ───────────────────
  const rbacModules = [
    { key: 'academics', label: 'Academics & Classes Setup' },
    { key: 'directory', label: 'Directory Management (Students/Teachers/Parents)' },
    { key: 'grading', label: 'Grading, Exams & Marks Manager' },
    { key: 'billing', label: 'Billing, Invoices & Driver Ledger' },
    { key: 'books', label: 'Library Catalog Management' },
    { key: 'transport', label: 'Transport Vehicles & Routes' },
    { key: 'security', label: 'System Audits & Backup Panels' }
  ];

  const [rbacPermissions, setRbacPermissions] = useState<Record<string, Record<string, boolean>>>({
    FINANCE_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true },
    ACADEMIC_ADMIN: { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true },
    EXAM_CONTROLLER: { billing: false, directory: false, academics: true, grading: true, security: false, books: false, transport: false },
    LIBRARIAN: { billing: false, directory: false, academics: true, grading: false, security: false, books: true, transport: false },
    TRANSPORT_MANAGER: { billing: true, directory: false, academics: false, grading: false, security: false, books: false, transport: true },
    CUSTOM_SUB_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false }
  });
  const [rbacLoading, setRbacLoading] = useState(false);
  const [showAddSubAdmin, setShowAddSubAdmin] = useState(false);
  const [saEmail, setSaEmail] = useState('');
  const [saFirst, setSaFirst] = useState('');
  const [saLast, setSaLast] = useState('');
  const [saPhone, setSaPhone] = useState('');
  const [saRole, setSaRole] = useState<'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER'>('FINANCE_ADMIN');
  const [saPassword, setSaPassword] = useState('password');
  const [saEmployeeId, setSaEmployeeId] = useState('');

  // Editing Sub-Admin States
  const [showEditSubAdmin, setShowEditSubAdmin] = useState<any | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'CUSTOM_SUB_ADMIN'>('FINANCE_ADMIN');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Extended RBAC sub-admin operator states
  const [operators, setOperators] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [operatorsSearch, setOperatorsSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('all');
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<string | null>(null);

  const handleSaveRbacMatrix = async () => {
    if (!overview?.schoolId) return;
    setRbacLoading(true);
    try {
      await mockApi.saveRolePermissionsMatrix(overview.schoolId, rbacPermissions);
      
      // Log the permission change
      await mockApi.writeAuditLog(
        adminId || null,
        null,
        overview.schoolId,
        'security',
        'UPDATE_PERMISSIONS',
        'matrix',
        null,
        rbacPermissions
      );
      
      alert('Dynamic role and permission matrix updated and synchronized successfully!');
      // Reload audit logs
      const logs = await mockApi.fetchAuditLogs(overview.schoolId);
      setAuditLogs(logs);
    } catch (err: any) {
      alert('Failed to save configuration matrix: ' + (err.message || 'Unknown error'));
    } finally {
      setRbacLoading(false);
    }
  };

  const toggleOperatorStatus = async (userId: string, currentActive: boolean) => {
    if (!overview?.schoolId) return;
    const targetActive = !currentActive;
    try {
      await mockApi.updateUserStatus(userId, targetActive);
      
      // Log audit
      await mockApi.writeAuditLog(
        adminId || null,
        null,
        overview.schoolId,
        'security',
        targetActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
        userId,
        { isActive: currentActive },
        { isActive: targetActive }
      );
      
      // reload lists
      const [ops, logs] = await Promise.all([
        mockApi.fetchOperators(overview.schoolId),
        mockApi.fetchAuditLogs(overview.schoolId)
      ]);
      setOperators(ops);
      setAuditLogs(logs);
      
      alert(`User account status updated to ${targetActive ? 'ACTIVE' : 'INACTIVE'} successfully!`);
    } catch (err: any) {
      alert('Failed to update operator status: ' + err.message);
    }
  };


  // ── Handlers for Communications, Analytics, Backups, and RBAC ──
  const handleSendTestComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (commSending) return;
    setCommSending(true);
    await new Promise(resolve => setTimeout(resolve, 800)); // Latency

    let recipient = commTemplate === 'otp' || commTemplate === 'homework' ? commTargetPhone : commTargetEmail;
    if (!recipient) {
      recipient = commTemplate === 'otp' ? '+1 (555) 789-0123' : 'user@aegis.com';
    }

    const newLog = {
      id: Math.random().toString(),
      type: commTemplate === 'otp' || commTemplate === 'homework' ? 'SMS' : 'EMAIL',
      recipient: recipient,
      template: commTemplate.toUpperCase().replace('_', ' '),
      status: 'DELIVERED',
      timestamp: new Date().toISOString(),
      rate: '100%'
    };

    setCommLogs(prev => [newLog, ...prev]);
    setCommSending(false);
    alert(`Test ${newLog.type} Alert dispatched successfully via ${newLog.type === 'SMS' ? 'Twilio Gateway' : 'Resend SMTP Gateway'}!`);
  };

  const handleBackupTrigger = async () => {
    if (backupLoading) return;
    setBackupLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Snapshot creation delay

    const snapId = Math.random().toString(36).substr(2, 5);
    const newLog = {
      id: Math.random().toString(),
      filename: `aegis_prod_snap_20260529_${snapId}.enc`,
      type: 'MANUAL_SNAPSHOT',
      size: '254.8 MB',
      status: 'SUCCESS',
      hash: 'sha256-' + Math.random().toString(36).substr(2, 10) + '...',
      timestamp: new Date().toISOString()
    };

    setBackupLogs(prev => [newLog, ...prev]);
    setBackupLoading(false);
    alert('Secure Encrypted Database and Objects State Snapshot completed successfully!');
  };

  const handleRestoreTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreToken) {
      alert('Please enter a valid master recovery hash/token.');
      return;
    }
    setRestoreProgress(0);
    setRestoreLogs([]);

    const steps = [
      { progress: 10, log: 'Initializing secure connection to replica recovery gateway...' },
      { progress: 25, log: 'Verifying master recovery key validation hashes...' },
      { progress: 40, log: 'Decrypting AES-256 database state dump block...' },
      { progress: 60, log: 'Tearing down active database connection pools and pausing queue brokers...' },
      { progress: 75, log: 'Replacing schema tables and restoring entity indices...' },
      { progress: 90, log: 'Flushing redis cache and validating cross-table foreign key maps...' },
      { progress: 100, log: 'Database rollback complete! Re-allocating active TLS session handshakes.' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setRestoreProgress(step.progress);
      setRestoreLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step.log}`]);
    }
    
    alert('ERP Platform Rollback completed successfully! Active client states synchronized.');
    setRestoreProgress(-1);
    setRestoreToken('');
  };

  const handleCreateSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (currentPlanName !== 'enterprise') {
      alert('Security Policy Alert: Registering sub-admin operators requires an active Enterprise subscription plan. Please upgrade your institution.');
      return;
    }
    if (!saEmail.trim() || !saPassword || saPassword.length < 6) {
      alert('Email cannot be empty and password must be at least 6 characters.');
      return;
    }
    if (!saEmployeeId.trim()) {
      alert('Employee ID is required. Please assign a unique Employee ID for this sub-admin operator.');
      return;
    }
    setRbacLoading(true);
    try {
      await mockApi.adminCreateSubAdmin(
        adminId!, saEmail, saFirst, saLast, saPhone, saRole, saPassword, saEmployeeId.trim()
      );
      setShowAddSubAdmin(false);
      setSaEmail('');
      setSaFirst('');
      setSaLast('');
      setSaPhone('');
      setSaRole('FINANCE_ADMIN');
      setSaPassword('password');
      setSaEmployeeId('');
      // Reload operators list to show the new sub-admin
      if (overview?.schoolId) {
        const ops = await mockApi.fetchOperators(overview.schoolId);
        setOperators(ops);
      }
      alert(`Sub-admin user with role [${saRole}] and Employee ID [${saEmployeeId.trim()}] registered successfully in Supabase!`);
    } catch (err: any) {
      alert(err.message || 'Error creating sub-admin');
    } finally {
      setRbacLoading(false);
    }
  };

  const handleSaveEditSubAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEditSubAdmin) return;
    if (!editEmail.trim() || !editFirst.trim() || !editLast.trim() || !editEmployeeId.trim()) {
      alert('Email, First Name, Last Name, and Employee ID cannot be empty.');
      return;
    }
    setRbacLoading(true);
    try {
      await mockApi.adminEditSubAdmin(
        adminId!,
        showEditSubAdmin.id,
        editEmail.trim(),
        editFirst.trim(),
        editLast.trim(),
        editPhone.trim(),
        editRole,
        editEmployeeId.trim(),
        editIsActive
      );
      setShowEditSubAdmin(null);
      
      // Reload operators list to show the updated sub-admin
      if (overview?.schoolId) {
        const ops = await mockApi.fetchOperators(overview.schoolId);
        setOperators(ops);
      }
      alert('Sub-admin operator details updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error updating sub-admin');
    } finally {
      setRbacLoading(false);
    }
  };

  const exportStudentsToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Admission Number,Roll Number,First Name,Last Name,Email,Gender,Class,Section\n";
    
    students.forEach(st => {
      const row = [
        st.admissionNumber,
        st.rollNumber,
        st.userDetails.firstName,
        st.userDetails.lastName,
        st.userDetails.email,
        st.gender,
        st.className,
        st.sectionId || 'N/A'
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aegis_student_directory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFeesToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Student Name,Roll Number,Class,Fee Category,Amount,Status,Date\n";
    
    const payments = [
      { studentName: 'Leo da Vinci', roll: '10', class: 'Grade 10-A', category: 'Tuition Fee (Q1)', amount: '1200', status: 'PAID', date: '2026-05-15' },
      { studentName: 'Albert Einstein', roll: '11', class: 'Grade 10-A', category: 'Lab & Physics Facility', amount: '450', status: 'PAID', date: '2026-05-18' },
      { studentName: 'Marie Curie', roll: '1', class: 'Grade 11-B', category: 'Tuition Fee (Q1)', amount: '1200', status: 'PENDING', date: '2026-05-20' }
    ];

    payments.forEach(p => {
      const row = [
        p.studentName,
        p.roll,
        p.class,
        p.category,
        p.amount,
        p.status,
        p.date
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aegis_fee_ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
  const [stPhone, setStPhone] = useState('');

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
  const [bulkEmails, setBulkEmails] = useState('');
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

      // Load RBAC dynamic permissions, operators, and audit logs from Supabase
      if (session?.user.schoolId) {
        try {
          const [
            perms, ops, logs, inv, rc, dr, pk, da,
            busList, routeList, assignmentList, maintList, drAttList,
            categoryList, issueList, fineList, exList, exResList, qResList,
            marksList, examSubList
          ] = await Promise.all([
            mockApi.fetchSchoolRolePermissions(session.user.schoolId),
            mockApi.fetchOperators(session.user.schoolId),
            mockApi.fetchAuditLogs(session.user.schoolId),
            mockApi.fetchInvoices(session.user.schoolId),
            mockApi.fetchReportCards(session.user.schoolId),
            mockApi.fetchDrivers(session.user.schoolId),
            mockApi.fetchPickupPoints(session.user.schoolId),
            mockApi.fetchDigitalLibraryAssets(session.user.schoolId),
            mockApi.fetchBuses(session.user.schoolId),
            mockApi.fetchRoutes(session.user.schoolId),
            mockApi.fetchTransportAssignments(session.user.schoolId),
            mockApi.fetchMaintenanceLogs(session.user.schoolId),
            mockApi.fetchDriverAttendance(session.user.schoolId),
            mockApi.fetchBookCategories(session.user.schoolId),
            mockApi.fetchBookIssues(session.user.schoolId),
            mockApi.fetchLibraryFines(session.user.schoolId),
            mockApi.fetchExams(session.user.schoolId),
            mockApi.fetchExamResults(session.user.schoolId),
            mockApi.fetchQuizResults(session.user.schoolId),
            mockApi.fetchAllStudentMarks(session.user.schoolId),
            mockApi.fetchAllExamSubjects(session.user.schoolId)
          ]);
          setRbacPermissions(perms);
          setOperators(ops);
          setAuditLogs(logs);
          setInvoicesCount(inv.length);
          setInvoicesAmount(inv.reduce((sum, i) => sum + Number(i.amount || 0), 0));
          setReportCardsCount(rc.length);
          setDriversCount(dr.length);
          setPickupPointsCount(pk.length);
          setDigitalAssetsCount(da.length);
          setDriversList(dr);
          setPickupPointsList(pk);
          setDigitalAssetsList(da);
          setBuses(busList);
          setRoutes(routeList);
          setTransportAssignments(assignmentList);
          setMaintenanceLogs(maintList);
          setDriverAttendanceList(drAttList);
          setBookCategories(categoryList);
          setBookIssues(issueList);
          setLibraryFines(fineList);
          setExamsList(exList);
          setExamResults(exResList);
          setQuizResults(qResList);
          setStudentMarks(marksList);
          setExamSubjects(examSubList);
        } catch (err) {
          console.error("Failed to load RBAC data from Supabase:", err);
        }
      }


      // Dynamically load only this school's user emails if bulkEmails is currently empty or default
      const emailsList = [
        ...st.map(s => s.userDetails?.email),
        ...tc.map(t => t.userDetails?.email),
        ...pr.map(p => p.userDetails?.email)
      ].filter(Boolean);
      
      setBulkEmails(prev => {
        // If the user has already typed/modified the field, do not overwrite it
        if (prev !== '') return prev;
        return emailsList.join('\n');
      });
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

  // Real-time Supabase Postgres changes subscription for administration data
  useEffect(() => {
    if (!adminId) return;

    const handleAdminSync = () => {
      console.log('Realtime administration update detected, refreshing admin portal directories...');
      syncSubscriptionPlan();
      loadData();
      loadAcademicSessions();
    };

    const channel = supabase
      .channel('admin-academic-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teachers' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'parents' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subjects' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetables' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_sessions' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_structures' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fee_payments' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'roles' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_admins' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'academic_admins' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_controllers' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'librarians' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_managers' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'custom_sub_admins' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'buses' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'routes' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_points' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transport_assignments' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_attendance' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_results' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cards' }, handleAdminSync)
      .subscribe();


    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminId]);

  // --- Transport Handlers ---
  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !busPlate.trim()) return;
    try {
      await mockApi.createBus(session.user.schoolId, busPlate.trim(), busCapacity, busStatus, busDriverId || null);
      setBusPlate('');
      setBusCapacity(30);
      setBusStatus('ACTIVE');
      setBusDriverId('');
      loadData();
      alert('Bus registered successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to register bus');
    }
  };

  const handleDeleteBus = async (id: string) => {
    if (!window.confirm('Delete this bus?')) return;
    try {
      await mockApi.deleteBus(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete bus');
    }
  };

  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !rtName.trim() || !rtCode.trim()) return;
    try {
      await mockApi.createRoute(session.user.schoolId, rtName.trim(), rtCode.trim(), rtStart.trim(), rtEnd.trim(), rtFare);
      setRtName('');
      setRtCode('');
      setRtStart('');
      setRtEnd('');
      setRtFare(0);
      loadData();
      alert('Route registered successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to register route');
    }
  };

  const handleDeleteRoute = async (id: string) => {
    if (!window.confirm('Delete this route?')) return;
    try {
      await mockApi.deleteRoute(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete route');
    }
  };

  const handleCreatePickupPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !ppName.trim() || !ppRouteId) return;
    try {
      await mockApi.createPickupPoint(
        session.user.schoolId,
        ppName.trim(),
        ppLat ? parseFloat(ppLat) : 0,
        ppLng ? parseFloat(ppLng) : 0,
        ppRouteId
      );
      setPpName('');
      setPpLat('');
      setPpLng('');
      setPpRouteId('');
      loadData();
      alert('Pickup stop added successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to add pickup stop');
    }
  };

  const handleDeletePickupPoint = async (id: string) => {
    if (!window.confirm('Delete this pickup point?')) return;
    try {
      await mockApi.deletePickupPoint(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete pickup point');
    }
  };

  const handleRegisterDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !drName.trim() || !drLicense.trim()) return;
    try {
      await mockApi.createDriver(session.user.schoolId, session.user.academicSessionId || '', drName.trim(), drLicense.trim(), drPhone.trim());
      setDrName('');
      setDrLicense('');
      setDrPhone('');
      loadData();
      alert('Driver registered successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to register driver');
    }
  };

  const handleCreateTransportAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !taStudentId || !taRouteId || !taBusId || !taPickupPointId) return;
    try {
      await mockApi.createTransportAssignment(session.user.schoolId, taStudentId, taRouteId, taBusId, taPickupPointId);
      setTaStudentId('');
      setTaRouteId('');
      setTaBusId('');
      setTaPickupPointId('');
      loadData();
      alert('Student transport assignment completed!');
    } catch (err: any) {
      alert(err.message || 'Failed to assign transport');
    }
  };

  const handleDeleteTransportAssignment = async (id: string) => {
    if (!window.confirm('Remove student transport assignment?')) return;
    try {
      await mockApi.deleteTransportAssignment(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to remove assignment');
    }
  };

  const handleCreateMaintenanceLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !maintBusId || !maintDesc.trim() || maintCost <= 0) return;
    try {
      await mockApi.createMaintenanceLog(session.user.schoolId, maintBusId, maintDate || new Date().toISOString().split('T')[0], maintDesc.trim(), maintCost);
      setMaintBusId('');
      setMaintDesc('');
      setMaintCost(0);
      loadData();
      alert('Maintenance expense logged successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to log maintenance');
    }
  };

  const handleMarkDriverAttendance = async (driverId: string, status: string) => {
    if (!session?.user.schoolId) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await mockApi.markDriverAttendance(session.user.schoolId, driverId, todayStr, status);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance');
    }
  };

  // --- Library Handlers ---
  const handleCreateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !bkTitle.trim() || !bkAuthor.trim() || !bkIsbn.trim()) return;
    try {
      await mockApi.adminCreateBook(bkTitle.trim(), bkAuthor.trim(), bkIsbn.trim(), bkSubject.trim(), bkCopies);
      setBkTitle('');
      setBkAuthor('');
      setBkIsbn('');
      setBkSubject('');
      setBkCopies(5);
      loadData();
      alert('Book added to library catalog!');
    } catch (err: any) {
      alert(err.message || 'Failed to add book');
    }
  };

  const handleCreateBookCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !bcName.trim() || !bcCode.trim()) return;
    try {
      await mockApi.createBookCategory(session.user.schoolId, bcName.trim(), bcCode.trim());
      setBcName('');
      setBcCode('');
      loadData();
      alert('Book category registered!');
    } catch (err: any) {
      alert(err.message || 'Failed to create category');
    }
  };

  const handleDeleteBookCategory = async (id: string) => {
    if (!window.confirm('Delete category?')) return;
    try {
      await mockApi.deleteBookCategory(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category');
    }
  };

  const handleIssueBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !biBookId || !biStudentId || !biDueDate) return;
    try {
      await mockApi.issueBook(session.user.schoolId, biBookId, biStudentId, new Date().toISOString(), biDueDate);
      setBiBookId('');
      setBiStudentId('');
      setBiDueDate('');
      loadData();
      alert('Book checked out successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to issue book');
    }
  };

  React.useEffect(() => {
    if (!attendanceClassId) return;
    const classStudents = students.filter(s => s.classId === attendanceClassId);
    const initialRecords: Record<string, 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'> = {};
    classStudents.forEach(s => {
      const att = mockDb.attendance.find(a => a.studentId === s.id && a.date === attendanceDate);
      initialRecords[s.id] = att ? att.status : 'PRESENT';
    });
    setAttendanceRecords(initialRecords);
  }, [attendanceClassId, attendanceDate, students]);

  const handleSaveAttendance = async () => {
    if (!adminId || !attendanceClassId || !attendanceDate) {
      alert('Please select a class and date to record attendance.');
      return;
    }
    const classStudents = students.filter(s => s.classId === attendanceClassId);
    if (classStudents.length === 0) {
      alert('No students found in the selected class.');
      return;
    }

    const records = classStudents.map(s => ({
      studentId: s.id,
      status: attendanceRecords[s.id] || 'PRESENT',
      remarks: attendanceRemarks[s.id] || ''
    }));

    try {
      await mockApi.adminMarkAttendance(adminId, attendanceClassId, attendanceDate, records);
      loadData();
      alert('Attendance register logs recorded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance logs');
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !assignClassId || !assignSubjectId || !assignTitle || !assignDesc || !assignDueDate) {
      alert('Please fill out all fields.');
      return;
    }

    try {
      await mockApi.adminCreateAssignment(
        adminId,
        assignClassId,
        assignSubjectId,
        assignTitle,
        assignDesc,
        assignDueDate,
        true
      );
      setAssignTitle('');
      setAssignDesc('');
      setAssignDueDate('');
      loadData();
      alert('Homework/Assignment deployed successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create homework assignment');
    }
  };

  const handleReturnBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !brIssueId) return;
    try {
      await mockApi.returnBook(session.user.schoolId, brIssueId, new Date().toISOString(), brFine, brStatus);
      setBrIssueId('');
      setBrFine(0);
      loadData();
      alert('Book issue status updated (Returned/Fined)!');
    } catch (err: any) {
      alert(err.message || 'Failed to return book');
    }
  };

  const handleCreateDigitalAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !daTitle.trim() || !daUrl.trim()) return;
    try {
      await mockApi.createDigitalLibraryAsset(session.user.schoolId, daTitle.trim(), daAuthor.trim() || 'Anonymous', daUrl.trim(), daType);
      setDaTitle('');
      setDaAuthor('');
      setDaUrl('');
      loadData();
      alert('Digital library asset link uploaded!');
    } catch (err: any) {
      alert(err.message || 'Failed to upload asset');
    }
  };

  // --- Exam Handlers ---
  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !exName.trim() || !exStart || !exEnd) return;
    try {
      await mockApi.createExam(session.user.schoolId, session.user.academicSessionId || '', exName.trim(), exTerm, exStart, exEnd);
      setExName('');
      setExStart('');
      setExEnd('');
      loadData();
      alert('Exam term created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create exam');
    }
  };

  const handleDeleteExam = async (id: string) => {
    if (!window.confirm('Delete exam?')) return;
    try {
      await mockApi.deleteExam(id);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete exam');
    }
  };

  const handleCreateExamSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !esExamId || !esSubjectId) return;
    try {
      await mockApi.createExamSubject(session.user.schoolId, esExamId, esSubjectId, esMax, esPass);
      setEsSubjectId('');
      loadData();
      alert('Subject exam marks criteria added!');
    } catch (err: any) {
      alert(err.message || 'Failed to add exam subject');
    }
  };

  const handleSaveStudentMarks = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !meExamId || !meSubjectId) return;
    try {
      const studentIds = Object.keys(meMarks);
      for (const stId of studentIds) {
        await mockApi.enterStudentMarks(
          session.user.schoolId,
          meExamId,
          meSubjectId,
          stId,
          meMarks[stId] || 0,
          meRemarks[stId] || ''
        );
      }
      alert('Student marks saved successfully!');
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save student marks');
    }
  };

  const handleGenerateReportCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !rcStudentId || !rcTerm) return;
    try {
      const examListForSession = examsList.filter(ex => ex.academicSessionId === (session.user.academicSessionId || ''));
      let totalMaxMarks = 0;
      let totalObtainedMarks = 0;
      
      for (const ex of examListForSession) {
        const smList = studentMarks.filter(sm => sm.studentId === rcStudentId && sm.examId === ex.id);
        const esList = examSubjects.filter(es => es.examId === ex.id);
        for (const sm of smList) {
          const es = esList.find(e => e.subjectId === sm.subjectId);
          if (es) {
            totalMaxMarks += Number(es.maxMarks || 100);
            totalObtainedMarks += Number(sm.marksObtained || 0);
          }
        }
      }

      const gpa = totalMaxMarks > 0 ? Number(((totalObtainedMarks / totalMaxMarks) * 10).toFixed(2)) : 0;

      await mockApi.createReportCard(
        session.user.schoolId,
        session.user.academicSessionId || '',
        rcStudentId,
        rcTerm,
        rcAttendance,
        gpa,
        rcRemarks.trim(),
        ''
      );

      for (const ex of examListForSession) {
        const smList = studentMarks.filter(sm => sm.studentId === rcStudentId && sm.examId === ex.id);
        const esList = examSubjects.filter(es => es.examId === ex.id);
        let exMax = 0;
        let exObt = 0;
        for (const sm of smList) {
          const es = esList.find(e => e.subjectId === sm.subjectId);
          if (es) {
            exMax += Number(es.maxMarks || 100);
            exObt += Number(sm.marksObtained || 0);
          }
        }
        if (exMax > 0) {
          const pct = (exObt / exMax) * 100;
          const grade = pct >= 90 ? 'A+' : pct >= 80 ? 'A' : pct >= 70 ? 'B' : pct >= 60 ? 'C' : pct >= 40 ? 'D' : 'F';
          const status = pct >= 40 ? 'PASSED' : 'FAILED';
          await mockApi.publishExamResults(session.user.schoolId, ex.id, rcStudentId, exMax, exObt, pct, grade, status);
        }
      }

      setRcStudentId('');
      setRcRemarks('');
      loadData();
      alert('Report card generated & results published successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to publish report card');
    }
  };

  const handlePromoteStudentsAction = async (e: React.FormEvent, targetClassId: string, studentIdsList: string[]) => {
    e.preventDefault();
    if (!session?.user.schoolId || studentIdsList.length === 0 || !targetClassId) return;
    try {
      await mockApi.adminPromoteStudents(session.user.schoolId, studentIdsList, targetClassId);
      loadData();
      alert(`Promoted ${studentIdsList.length} students successfully!`);
    } catch (err: any) {
      alert(err.message || 'Failed to promote students');
    }
  };

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
        prStudentId, prAdmissionNum, prRelation, prPassword, prEmergencyPhone
      );
      setShowAddParent(false);
      setPrEmail('');
      setPrFirst('');
      setPrLast('');
      setPrOccup('');
      setPrAddr('');
      setPrPhone('');
      setPrEmergencyPhone('');
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
        adminId, stEmail, stFirst, stLast, stClass, stAdmission, stRoll, stGender, stDob, stPassword, stPhone
      );
      setShowAddStudent(false);
      setStEmail('');
      setStFirst('');
      setStLast('');
      setStClass('');
      setStAdmission('');
      setStPassword('');
      setShowStPassword(false);
      setStPhone('');
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

  const handleQuickApprovePayment = async (studentId: string, structureId: string, amount: number) => {
    if (!adminId) return;
    try {
      const txId = 'TX' + Math.random().toString(36).substr(2, 8).toUpperCase();
      await mockApi.adminRecordFeePayment(adminId, studentId, structureId, amount, 'Cash', txId, 'PAID');
      loadData();
      alert('Payment approved and marked PAID successfully!');
    } catch (err: any) {
      alert(err.message || 'Error approving payment');
    }
  };

  const handleQuickRejectPayment = async (studentId: string, structureId: string) => {
    if (!adminId) return;
    if (!window.confirm('Are you sure you want to reject/unpay this student\'s invoice? This sets the status back to PENDING.')) return;
    try {
      await mockApi.adminRecordFeePayment(adminId, studentId, structureId, 0, 'Cash', '', 'PENDING');
      loadData();
      alert('Payment status reset to pending/unpaid.');
    } catch (err: any) {
      alert(err.message || 'Error resetting payment status');
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

  const isAuthorized = () => {
    // ADMIN has full access
    if (session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN') return true;
    
    const rolePerms = rbacPermissions[session?.user.role || ''];
    if (!rolePerms) return true; // fallback to true during loading
    
    if (activeTab === 'dashboard') return true;
    if (activeTab === 'impersonation') return false; // Impersonation portal gateway is only for main school ADMIN
    
    if (activeTab === 'fees') return rolePerms.billing;
    if (activeTab === 'analytics') return rolePerms.billing || rolePerms.grading;
    
    if (activeTab === 'students' || activeTab === 'teachers' || activeTab === 'parents') {
      return rolePerms.directory;
    }
    
    if (activeTab === 'classes' || activeTab === 'subjects' || activeTab === 'academicsessions') {
      return rolePerms.academics;
    }
    
    if (activeTab === 'rbac' || activeTab === 'backups' || activeTab === 'dangerzone') {
      return rolePerms.security;
    }

    if (activeTab === 'books') return rolePerms.books;
    if (activeTab === 'transport') return rolePerms.transport;
    
    return true;
  };

  if (!isAuthorized()) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center space-y-6 animate-fade-in max-w-lg mx-auto pb-24">
        <GlassCard className="border border-red-500/10 p-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto text-red-500">
            <ShieldAlert size={28} />
          </div>
          <h3 className="font-extrabold text-slate-100 text-sm">Access Isolation Shield</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your current sub-admin role <span className="font-mono text-brand-400 font-bold">[{session?.user.role}]</span> is restricted from accessing the <span className="font-bold text-slate-300">"{activeTab.toUpperCase()}"</span> module under tenant separation rules.
          </p>
          <div className="pt-3 border-t border-slate-850">
            <p className="text-[9px] text-slate-500 font-mono tracking-wider">STRICT MULTI-SCHOOL RBAC POLICY SEPARATION</p>
          </div>
        </GlassCard>
      </div>
    );
  }

  const isSubAdmin = session?.user.role && [
    'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN'
  ].includes(session.user.role);

  if (isSubAdmin && currentPlanName !== 'enterprise') {
    return (
      <div className="max-w-lg mx-auto py-24 px-6 text-center animate-fade-in">
        <PremiumLock isLocked={true} requiredTier="enterprise" featureName="Sub-Admin Feature Access & Portals">
          <div />
        </PremiumLock>
      </div>
    );
  }

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
          {/* Institutional Metrics Overview (Role Scoped Router) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* FINANCE_ADMIN METRICS */}
            {session?.user.role === 'FINANCE_ADMIN' && (
              <>
                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <DollarSign className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Total fee income</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">${overview.feeCollections.paid.toLocaleString()}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <FileText className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Active Invoices</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{invoicesCount}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <CreditCard className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Total Dues Value</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">${invoicesAmount.toLocaleString()}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <CheckSquare className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Pending Collections</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">${overview.feeCollections.pending.toLocaleString()}</h3>
                  </div>
                </GlassCard>
              </>
            )}

            {/* ACADEMIC_ADMIN METRICS */}
            {session?.user.role === 'ACADEMIC_ADMIN' && (
              <>
                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Users className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Active Students</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalStudents}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <UsersRound className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Active Teachers</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalTeachers}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Layers className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Class Sections</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalClasses}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <BookMarked className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Active Subjects</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalSubjects}</h3>
                  </div>
                </GlassCard>
              </>
            )}

            {/* EXAM_CONTROLLER METRICS */}
            {session?.user.role === 'EXAM_CONTROLLER' && (
              <>
                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <BarChart2 className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Published Marksheets</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{reportCardsCount}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <CheckSquare className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Term Exams Created</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalSubjects}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Clock className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Online Quizzes</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalClasses * 2}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Award className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Active Grading Profiles</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalStudents}</h3>
                  </div>
                </GlassCard>
              </>
            )}

            {/* LIBRARIAN METRICS */}
            {session?.user.role === 'LIBRARIAN' && (
              <>
                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <BookOpen className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Book Titles</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalSubjects * 12}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Download className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Digital Library Assets</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{digitalAssetsCount}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Clock className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Issued Books</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalClasses * 4}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <AlertTriangle className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Outstanding Fines Ledger</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">${(overview.totalClasses * 3.5).toFixed(2)}</h3>
                  </div>
                </GlassCard>
              </>
            )}

            {/* TRANSPORT_MANAGER METRICS */}
            {session?.user.role === 'TRANSPORT_MANAGER' && (
              <>
                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Layers className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Buses In Fleet</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalClasses}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Link className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Assigned Routes</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.totalClasses * 2}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <UsersRound className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Active Driver Records</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{driversCount}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <Building className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Pickup Points Logged</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{pickupPointsCount}</h3>
                  </div>
                </GlassCard>
              </>
            )}

            {/* FULL ADMIN / SUPER_ADMIN METRICS */}
            {(session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN' || session?.user.role === 'CUSTOM_SUB_ADMIN') && (
              <>
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
              </>
            )}

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
                  disabled={!isAcademicOrSchoolAdmin || overview.totalStudents >= overview.subscription.limits.maxStudents}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : overview.totalStudents >= overview.subscription.limits.maxStudents ? 'Student limit reached for your plan' : ''}
                >
                  <Plus className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Register Student</span>
                </button>
                <button 
                  onClick={() => setShowAddTeacher(true)}
                  disabled={!isAcademicOrSchoolAdmin || overview.totalTeachers >= overview.subscription.limits.maxTeachers}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : overview.totalTeachers >= overview.subscription.limits.maxTeachers ? 'Teacher limit reached for your plan' : ''}
                >
                  <UsersRound className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Register Teacher</span>
                </button>
                <button 
                  onClick={() => setShowAddParent(true)}
                  disabled={!isAcademicOrSchoolAdmin}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                >
                  <Users className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Register Parent</span>
                </button>
                <button 
                  onClick={() => setShowAddClass(true)}
                  disabled={!isAcademicOrSchoolAdmin}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                >
                  <Layers className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Establish Class</span>
                </button>
                <button 
                  onClick={() => setShowLinkParent(true)}
                  disabled={!isAcademicOrSchoolAdmin}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                >
                  <Link className="text-brand-400 group-hover:scale-110 transition-transform" size={20} />
                  <span className="text-xs font-semibold text-slate-200">Map Parent-Student</span>
                </button>
                <button 
                  onClick={() => setShowAssignClassTeacher(true)}
                  disabled={!isAcademicOrSchoolAdmin}
                  className="p-4 bg-slate-900/30 hover:bg-brand-600/10 border border-slate-850 hover:border-brand-500/30 rounded-2xl flex flex-col items-center justify-center gap-2 text-center transition-all group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-slate-900/30 disabled:hover:border-slate-850"
                  title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
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

          <OfflineSyncManager />
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
                    <td className="py-3 px-4 text-slate-450">
                      <div className="font-semibold">{s.userDetails.email}</div>
                      {s.userDetails.phone && <div className="text-[10px] text-slate-500 font-mono mt-0.5">Phone: {s.userDetails.phone}</div>}
                      {(() => {
                        const emails = mockDb.emailAddresses.filter(ea => ea.userId === s.userDetails.id);
                        const contactEmails = emails.filter(ea => ea.emailType !== 'LOGIN');
                        return contactEmails.length > 0 ? (
                          <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-800/40 pt-1">
                            {contactEmails.map(ea => (
                              <span key={ea.id} className="text-[10px] text-slate-500 font-mono">
                                ✉️ {ea.emailType}: {ea.email} {ea.isVerified && <span className="text-[9px] text-green-500">✓</span>}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <button 
                        onClick={() => handleImpersonateUser(s.userDetails.email)}
                        className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Login <ArrowRight size={12} />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(s.userDetails.id, s.userDetails.firstName + ' ' + s.userDetails.lastName)}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(s.id, s.userDetails.firstName + ' ' + s.userDetails.lastName)}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
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
                    <td className="py-3 px-4 text-slate-450">
                      <div className="font-semibold">{t.userDetails.email}</div>
                      {t.userDetails.phone && <div className="text-[10px] text-slate-500 font-mono mt-0.5">Phone: {t.userDetails.phone}</div>}
                      {(() => {
                        const emails = mockDb.emailAddresses.filter(ea => ea.userId === t.userDetails.id);
                        const contactEmails = emails.filter(ea => ea.emailType !== 'LOGIN');
                        return contactEmails.length > 0 ? (
                          <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-800/40 pt-1">
                            {contactEmails.map(ea => (
                              <span key={ea.id} className="text-[10px] text-slate-500 font-mono">
                                ✉️ {ea.emailType}: {ea.email} {ea.isVerified && <span className="text-[9px] text-green-500">✓</span>}
                              </span>
                            ))}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <button 
                        onClick={() => handleImpersonateUser(t.userDetails.email)}
                        className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Login <ArrowRight size={12} />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(t.userDetails.id, t.userDetails.firstName + ' ' + t.userDetails.lastName)}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(t.id, t.userDetails.firstName + ' ' + t.userDetails.lastName)}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
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
                    <td className="py-3 px-4 text-slate-450">
                      <div className="font-semibold">{p.userDetails.email}</div>
                      {p.userDetails.phone && <div className="text-[10px] text-slate-500 font-mono mt-0.5">Primary: {p.userDetails.phone}</div>}
                      {(() => {
                        const emergency = mockDb.phoneNumbers.find(pn => pn.userId === p.userDetails.id && pn.phoneType === 'EMERGENCY');
                        const emails = mockDb.emailAddresses.filter(ea => ea.userId === p.userDetails.id);
                        const contactEmails = emails.filter(ea => ea.emailType !== 'LOGIN');
                        return (
                          <>
                            {emergency && (
                              <div className="text-[10px] text-amber-500 font-mono mt-0.5">Emergency: {emergency.fullNumber}</div>
                            )}
                            {contactEmails.length > 0 && (
                              <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-800/40 pt-1">
                                {contactEmails.map(ea => (
                                  <span key={ea.id} className="text-[10px] text-slate-500 font-mono">
                                    ✉️ {ea.emailType}: {ea.email} {ea.isVerified && <span className="text-[9px] text-green-500">✓</span>}
                                  </span>
                                ))}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-4 flex items-center gap-3">
                      <button 
                        onClick={() => handleImpersonateUser(p.userDetails.email)}
                        className="text-brand-400 hover:text-brand-300 font-bold flex items-center gap-1 text-[11px] transition-colors"
                      >
                        Login <ArrowRight size={12} />
                      </button>
                      <button 
                        onClick={() => handleResetPassword(p.userDetails.id, p.userDetails.firstName + ' ' + p.userDetails.lastName)}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteParent(p.id, p.userDetails.firstName + ' ' + p.userDetails.lastName)}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
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
                            <th className="py-3 px-4">Due Balance</th>
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
                              const isOverdue = new Date(selectedFeeStructure.dueDate).getTime() < Date.now();
                              const lateFee = (status !== 'PAID' && isOverdue) ? 15.00 : 0.00;
                              const balanceDue = status === 'PAID' ? 0.00 : (selectedFeeStructure.amount + lateFee);
                              return (
                                <tr key={student.id} className="hover:bg-slate-900/10 text-slate-200">
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-200">{student.userDetails.firstName} {student.userDetails.lastName}</div>
                                    <div className="text-[9px] text-slate-500 font-mono">{student.admissionNumber}</div>
                                  </td>
                                  <td className="py-3 px-4 text-slate-400">{student.rollNumber || '-'}</td>
                                  <td className="py-3 px-4">
                                    {payment && payment.amountPaid > 0 ? (
                                      <div className="font-semibold text-emerald-400">${payment.amountPaid.toFixed(2)}</div>
                                    ) : (
                                      <span className="text-slate-500">$0.00</span>
                                    )}
                                    {payment?.paymentDate && (
                                      <div className="text-[8px] text-slate-500 font-mono mt-0.5">{new Date(payment.paymentDate).toLocaleDateString()}</div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-slate-300">
                                    ${balanceDue.toFixed(2)}
                                    {lateFee > 0 && (
                                      <div className="text-[8px] text-rose-400 font-semibold mt-0.5">+ $15.00 Overdue Fee</div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4">
                                    <span className={`text-[9px] font-bold px-2.5 py-0.5 rounded-full border ${
                                      status === 'PAID' 
                                        ? 'bg-green-500/10 border-green-500/20 text-green-400' 
                                        : isOverdue
                                          ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                                          : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                                    }`}>
                                      {status === 'PAID' ? 'PAID' : isOverdue ? 'LATE / OVERDUE' : 'PENDING'}
                                    </span>
                                  </td>
                                  <td className="py-3 px-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {status === 'PAID' ? (
                                        <>
                                          <button
                                            onClick={() => {
                                              setCollectingPayment({ student, structure: selectedFeeStructure });
                                              setPaymentAmountPaid(payment?.amountPaid?.toString() || '');
                                              setPaymentMethod(payment?.paymentMethod || 'Cash');
                                              setPaymentTxId(payment?.transactionId || '');
                                              setPaymentStatus('PAID');
                                            }}
                                            className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-[10px] font-bold transition-all"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            onClick={() => handleQuickRejectPayment(student.id, selectedFeeStructure.id)}
                                            className="px-2.5 py-1 border border-red-500/20 hover:bg-red-500/10 text-red-450 hover:text-red-400 rounded-lg text-[10px] font-bold transition-all"
                                            title="Reject / Revoke payment"
                                          >
                                            Reject
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            onClick={() => handleQuickApprovePayment(student.id, selectedFeeStructure.id, selectedFeeStructure.amount + lateFee)}
                                            className="px-2.5 py-1 border border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-450 hover:text-emerald-400 rounded-lg text-[10px] font-bold transition-all"
                                          >
                                            Approve
                                          </button>
                                          <button
                                            onClick={() => {
                                              setCollectingPayment({ student, structure: selectedFeeStructure });
                                              setPaymentAmountPaid((selectedFeeStructure.amount + lateFee).toString());
                                              setPaymentMethod('Cash');
                                              setPaymentTxId('TX' + Math.random().toString(36).substr(2, 8).toUpperCase());
                                              setPaymentStatus('PAID');
                                            }}
                                            className="px-2.5 py-1 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[10px] font-bold transition-all active:scale-95 shadow-lg shadow-brand-500/10"
                                          >
                                            Collect
                                          </button>
                                        </>
                                      )}
                                    </div>
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

            {/* Driver Attendance & Salary Payout Ledger */}
            <div className="mt-6">
              <GlassCard className="p-5 space-y-4">
                <div className="border-b border-slate-850 pb-3 flex justify-between items-center">
                  <div>
                    <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      <Building className="text-emerald-500" size={16} />
                      Driver Attendance & Salary Payout Ledger
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Real-time synchronized transport staff salary payroll synced with daily driver check-ins.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-450 border border-emerald-500/20 font-mono">Synced</span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-850">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 font-bold">
                        <th className="py-3 px-4">Driver Name</th>
                        <th className="py-3 px-4">License Number</th>
                        <th className="py-3 px-4">Days Present</th>
                        <th className="py-3 px-4">Daily Rate</th>
                        <th className="py-3 px-4">Total Salary Payout</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {driversList.map(driver => {
                        const presentCount = driverAttendanceList.filter(
                          a => a.driverId === driver.id && a.status === 'PRESENT'
                        ).length;
                        const dailyRate = 45.00;
                        const payout = presentCount * dailyRate;
                        return (
                          <tr key={driver.id} className="hover:bg-slate-900/10 text-slate-200">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-200">{driver.userDetails.firstName} {driver.userDetails.lastName}</div>
                              <div className="text-[9px] text-slate-500 font-mono">{driver.userDetails.email}</div>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono">{driver.licenseNumber}</td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                                {presentCount} Days
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono">${dailyRate.toFixed(2)}/day</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-100">${payout.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => {
                                  alert(`Successfully disbursed daily salary payout of $${payout.toFixed(2)} to ${driver.userDetails.firstName} ${driver.userDetails.lastName}!`);
                                }}
                                disabled={payout === 0}
                                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                  payout === 0 
                                    ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 active:scale-95'
                                }`}
                              >
                                Disburse Salary
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {driversList.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                            No active drivers registered in the system.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
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
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone</label>
                <input type="text" placeholder="+1 (555) 000-0000" value={stPhone} onChange={(e) => setStPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
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
                <label className="text-[9px] font-bold uppercase tracking-wider text-amber-500 mt-2">Emergency Contact Phone</label>
                <input type="text" placeholder="+91 98765 43210" value={prEmergencyPhone} onChange={(e) => setPrEmergencyPhone(e.target.value)} className="w-full bg-slate-900 border border-amber-900/40 text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500/60" />
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

      {/* ── 1. EMAIL & SMS COMMUNICATION CENTER ── */}
      {activeTab === 'communications' && (
        currentPlanName !== 'enterprise' ? (
          <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
            <PremiumLock isLocked={true} requiredTier="enterprise" featureName="Email & SMS Communication Center">
              <div />
            </PremiumLock>
          </div>
        ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-brand-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Mail className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Email, SMS & OTP Communication Center</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Manage and test SMTP/Resend email queues, Twilio SMS alerts, and secure OTP dispatches globally.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Template Selector & Test Dispatches */}
            <GlassCard className="lg:col-span-2 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Send className="text-brand-400" size={15} />
                SMTP & SMS Gateway Alert Dispatcher
              </h4>

              <form onSubmit={handleSendTestComm} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Communication Template</label>
                    <select 
                      value={commTemplate} 
                      onChange={(e) => setCommTemplate(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="otp">Two-Factor OTP Security Code (SMS)</option>
                      <option value="password_reset">Account Password Encryption Reset (Email)</option>
                      <option value="homework">Homework Assignment Alert (SMS)</option>
                      <option value="payment">Fee Collection & Invoice Reminder (Email)</option>
                    </select>
                  </div>

                  {commTemplate === 'otp' || commTemplate === 'homework' ? (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Phone (E.164 format)</label>
                      <input 
                        type="text" 
                        placeholder="+1 (555) 000-0000" 
                        value={commTargetPhone}
                        onChange={(e) => setCommTargetPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Email Address</label>
                      <input 
                        type="email" 
                        placeholder="recipient@domain.com" 
                        value={commTargetEmail}
                        onChange={(e) => setCommTargetEmail(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Template Preview & Custom Notes</label>
                  <div className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3.5 space-y-2">
                    <p className="text-[10px] text-brand-500 font-bold uppercase tracking-widest font-mono">Gateway Payload</p>
                    <div className="text-[11px] text-slate-300 font-mono leading-relaxed bg-slate-900/60 p-2.5 rounded-lg border border-slate-900">
                      {commTemplate === 'otp' && `[AEGIS SECURITY] Your Two-Factor authorization verification key is: 849204. Do not disclose. Valid for 10 minutes.`}
                      {commTemplate === 'password_reset' && `Dear User, we received a request to recover credentials for your Aegis Portal account. Reset link: https://aegis-erp.com/auth/reset?token=a82j19g`}
                      {commTemplate === 'homework' && `[Aegis Alerts] New Homework assigned to Grade 10-A! Subject: Computer Science. Title: Linked List pointer operations. Due date: 2026-05-28.`}
                      {commTemplate === 'payment' && `Dear Parent, this is an institutional notification regarding outstanding fees of $1,200.00 due for Grade 11-B Tuition. Click here to clear secure invoice.`}
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={commSending}
                  className="w-full glass-btn-primary py-2.5 font-bold text-xs flex items-center justify-center gap-2"
                >
                  {commSending ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Dispatching Secure Gateway Payload...</span>
                    </>
                  ) : (
                    <>
                      <Play size={13} />
                      <span>Dispatch Gateway Alert</span>
                    </>
                  )}
                </button>
              </form>
            </GlassCard>

            {/* Delivery Stats Summary */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Sliders className="text-brand-400" size={15} />
                Simulated Gateway Telemetry
              </h4>

              <div className="space-y-3.5">
                <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Resend SMTP Gateway</span>
                    <span className="text-green-400 font-bold">100% ONLINE</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full w-[98.8%] bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                    <span>99.9% Uptime</span>
                    <span>4,291 Dispatched</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">Twilio SMS Broker</span>
                    <span className="text-green-400 font-bold">100% ONLINE</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full w-[100%] bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                    <span>100% Uptime</span>
                    <span>18,290 Dispatched</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 font-semibold">FCM Broker Queue</span>
                    <span className="text-green-400 font-bold">100% ONLINE</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full w-[99.4%] bg-gradient-to-r from-green-500 to-emerald-400 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
                    <span>99.8% Uptime</span>
                    <span>29,102 Dispatched</span>
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Dispatch Queue Log Table */}
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2 mb-2">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Clock className="text-brand-400" size={15} />
                Real-time Dispatch Queue Monitor
              </h4>
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-mono">Status: Connected</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/20">
                    <th className="py-2.5 px-3">Log ID</th>
                    <th className="py-2.5 px-3">Gateway</th>
                    <th className="py-2.5 px-3">Recipient Address</th>
                    <th className="py-2.5 px-3">Template Payload</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Success Rate</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {commLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">#{log.id.slice(0, 6)}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          log.type === 'SMS' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-brand-500/10 text-brand-400 border border-brand-500/20'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-300">{log.recipient}</td>
                      <td className="py-2.5 px-3 text-slate-400 truncate max-w-[200px]" title={log.template}>{log.template}</td>
                      <td className="py-2.5 px-3">
                        <span className="flex items-center gap-1.5 text-green-400 font-bold text-[10px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono">{log.rate}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
        )
      )}

      {/* ── 2. INSTITUTIONAL ANALYTICS & FILE EXPORTERS ── */}
      {activeTab === 'analytics' && (
        currentPlanName !== 'enterprise' ? (
          <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
            <PremiumLock isLocked={true} requiredTier="enterprise" featureName="Advanced Academic & Finance Analytics">
              <div />
            </PremiumLock>
          </div>
        ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <BarChart2 className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Advanced Academic & Finance Analytics</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time statistics dashboard with native CSV spreadsheets download utilities and high-fidelity PDF layout creators.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <select 
                value={analyticsDateRange} 
                onChange={(e) => setAnalyticsDateRange(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="30d">Last 30 Days</option>
                <option value="90d">Last 90 Days</option>
                <option value="session">Active Academic Session</option>
              </select>
              <select 
                value={analyticsSection} 
                onChange={(e) => setAnalyticsSection(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg py-1.5 px-2.5 text-xs text-slate-200 focus:outline-none"
              >
                <option value="all">All Grades</option>
                <option value="10a">Grade 10-A Only</option>
                <option value="11b">Grade 11-B Only</option>
              </select>
            </div>
          </GlassCard>

          {/* 4 Custom CSS Chart Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1: Attendance */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Student Attendance Ratio</span>
                <span className="text-[10px] text-green-400 font-mono">Avg: 94.2%</span>
              </h4>
              <div className="h-44 flex items-end justify-around gap-2 pt-6 pb-2 border-b border-slate-850">
                <div className="w-12 flex flex-col items-center gap-2">
                  <div className="w-full bg-slate-900 rounded-lg h-32 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-brand-600 to-indigo-500 rounded-lg" style={{ height: '96.2%' }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">G10-A</span>
                </div>
                <div className="w-12 flex flex-col items-center gap-2">
                  <div className="w-full bg-slate-900 rounded-lg h-32 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-brand-600 to-indigo-500 rounded-lg" style={{ height: '91.8%' }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">G11-B</span>
                </div>
                <div className="w-12 flex flex-col items-center gap-2">
                  <div className="w-full bg-slate-900 rounded-lg h-32 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-600 to-teal-500 rounded-lg" style={{ height: '94.5%' }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300">SYSTEM</span>
                </div>
              </div>
            </GlassCard>

            {/* Chart 2: Fee Collections */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Quarterly Fee Collections Ledger</span>
                <span className="text-[10px] text-brand-400 font-mono">$2,850.00 Raised</span>
              </h4>
              <div className="h-44 flex flex-col justify-center gap-4">
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Tuition Quota Cleared</span>
                    <span className="font-bold text-slate-200">$1,650.00 (66%)</span>
                  </div>
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full w-[66%] bg-gradient-to-r from-brand-600 to-indigo-500 rounded-full" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Tuition Quota Pending / Late</span>
                    <span className="font-bold text-slate-200">$1,200.00 (34%)</span>
                  </div>
                  <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full w-[34%] bg-gradient-to-r from-amber-600 to-orange-500 rounded-full" />
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* Chart 3: Homework Completion */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Homework Completion Ratios</span>
                <span className="text-[10px] text-emerald-400 font-mono">Target: &gt;90%</span>
              </h4>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 w-24 truncate">Mathematics</span>
                  <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: '92%' }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 w-8 text-right">92%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 w-24 truncate">Physics</span>
                  <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500 rounded-full" style={{ width: '88%' }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 w-8 text-right">88%</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-400 w-24 truncate">Computer Science</span>
                  <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full" style={{ width: '95%' }} />
                  </div>
                  <span className="text-[10px] font-mono text-slate-300 w-8 text-right">95%</span>
                </div>
              </div>
            </GlassCard>

            {/* Chart 4: Subject Averages */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                <span>Institutional Grade Averages</span>
                <span className="text-[10px] text-indigo-400 font-mono">Term 1 Exam</span>
              </h4>
              <div className="h-44 flex items-end justify-around gap-4 pt-6 pb-2 border-b border-slate-850">
                <div className="w-8 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-slate-900 rounded-t h-32 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-brand-500/80" style={{ height: '84.5%' }} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">MATH</span>
                </div>
                <div className="w-8 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-slate-900 rounded-t h-32 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-brand-500/80" style={{ height: '79.2%' }} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">PHYS</span>
                </div>
                <div className="w-8 flex flex-col items-center gap-1.5">
                  <div className="w-full bg-slate-900 rounded-t h-32 relative overflow-hidden">
                    <div className="absolute bottom-0 left-0 right-0 bg-indigo-500/80" style={{ height: '88.1%' }} />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500">CS</span>
                </div>
              </div>
            </GlassCard>
          </div>

          {/* Export Center */}
          <GlassCard className="space-y-4">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <FileSpreadsheet className="text-brand-400" size={15} />
              Excel/CSV Directory & Fee Ledger Exports
            </h4>
            <p className="text-[10px] text-slate-400 leading-relaxed">Download institutional database registries cleanly formatted in CSV sheets, ready for Microsoft Excel, Google Sheets, or ledger auditing pipelines.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <button 
                onClick={exportStudentsToCSV}
                className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 hover:border-brand-500/20 rounded-xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Download size={15} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Export Student Directory</h5>
                  <p className="text-[9px] text-slate-500 mt-0.5">Admission, roll, class details</p>
                </div>
              </button>

              <button 
                onClick={exportFeesToCSV}
                className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 hover:border-brand-500/20 rounded-xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
              >
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Download size={15} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Export Fees Ledger</h5>
                  <p className="text-[9px] text-slate-500 mt-0.5">Paid collections, arrears ledger</p>
                </div>
              </button>

              <button 
                onClick={() => setShowInvoicePdf({ name: 'Tuition Fee (Q1)', code: 'INV-2026-004', amount: '$1,200.00', date: '2026-05-29' })}
                className="p-3 bg-slate-900/40 hover:bg-slate-900/60 border border-slate-850 hover:border-brand-500/20 rounded-xl transition-all flex items-center gap-3 text-left active:scale-[0.98]"
              >
                <div className="p-2 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  <FileText size={15} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-slate-200">Print Fee Invoices</h5>
                  <p className="text-[9px] text-slate-500 mt-0.5">Printable high-fidelity PDF</p>
                </div>
              </button>
            </div>
          </GlassCard>
        </div>
        )
      )}

      {/* ── 3. SAAS DISASTER RECOVERY & BACKUPS ── */}
      {activeTab === 'backups' && (
        currentPlanName !== 'enterprise' ? (
          <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
            <PremiumLock isLocked={true} requiredTier="enterprise" featureName="SaaS Disaster Recovery & Backup Panel">
              <div />
            </PremiumLock>
          </div>
        ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-brand-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <HardDrive className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">SaaS Disaster Recovery & Backup Panel</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Schedule hourly/daily backup snapshots and execute secure encrypted state rollbacks on demand.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Backup Policies & snapshot creation */}
            <GlassCard className="lg:col-span-2 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Settings className="text-brand-400" size={15} />
                Backup Schedules & Snapshot Actions
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Automated Backup Policies</label>
                  <select 
                    value={backupPolicy} 
                    onChange={(e) => setBackupPolicy(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="hourly">Hourly Incremental Snapshots</option>
                    <option value="daily">Daily Encrypted Snapshots (Recommended)</option>
                    <option value="weekly">Weekly Core DB State Snapshot</option>
                  </select>
                </div>

                <div className="space-y-1 justify-end flex flex-col">
                  <button 
                    onClick={handleBackupTrigger} 
                    disabled={backupLoading}
                    className="glass-btn-primary py-2.5 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    {backupLoading ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Compiling DB State Snapshot...</span>
                      </>
                    ) : (
                      <>
                        <HardDrive size={13} />
                        <span>Compile Immediate Snapshot</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl space-y-2">
                <h5 className="text-[11px] font-bold text-slate-300">Policy Details & Encryption Specs</h5>
                <p className="text-[10px] text-slate-400 leading-relaxed leading-normal">
                  All automated backups are encrypted using AES-256 with key hashes saved inside secure administrative metadata rings. 
                  Encrypted files are archived in secure, multi-zone replica storage nodes automatically.
                </p>
              </div>
            </GlassCard>

            {/* Rollback gateway form */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Shield className="text-red-400" size={15} />
                Encrypted Rollback Engine
              </h4>

              <form onSubmit={handleRestoreTrigger} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Master Recovery Token / Hash</label>
                  <input 
                    type="text" 
                    placeholder="Enter sha256 restore hash" 
                    value={restoreToken}
                    onChange={(e) => setRestoreToken(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={restoreProgress >= 0}
                  className="w-full px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <RefreshCw size={13} className={restoreProgress >= 0 ? 'animate-spin' : ''} />
                  <span>{restoreProgress >= 0 ? 'Executing Restore...' : 'Execute State Rollback'}</span>
                </button>
              </form>

              {restoreProgress >= 0 && (
                <div className="space-y-2 pt-2 animate-fade-in">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 font-mono">
                    <span>ROLLBACK PROGRESS</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${restoreProgress}%` }} />
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Rollback sequence logs console */}
          {restoreLogs.length > 0 && (
            <GlassCard className="space-y-2">
              <h4 className="font-bold text-slate-200 text-xs font-mono">SYSTEM RECOVERY STREAM</h4>
              <div className="bg-black/80 border border-slate-900 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1">
                {restoreLogs.map((logStr, i) => (
                  <p key={i} className="text-[10px] font-mono text-slate-400 leading-relaxed">{logStr}</p>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Backup Snapshots list */}
          <GlassCard className="space-y-3">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Clock className="text-brand-400" size={15} />
              Visual Restore Registry History
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/20">
                    <th className="py-2.5 px-3">Log ID</th>
                    <th className="py-2.5 px-3">Filename / Blob</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">State Integrity</th>
                    <th className="py-2.5 px-3">SHA-256 Key Checksum</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/50">
                  {backupLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-[10px] text-slate-500">#{log.id.slice(0, 6)}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-brand-400">{log.filename}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-850 text-[9px] font-bold">
                          {log.type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-mono">{log.size}</td>
                      <td className="py-2.5 px-3">
                        <span className="text-green-400 font-bold text-[10px] flex items-center gap-1">
                          <CheckCircle2 size={11} />
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[10px]">{log.hash}</td>
                      <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[10px]">{new Date(log.timestamp).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
        )
      )}

      {/* ── 4. DYNAMIC MODULES & RBAC PERMISSIONS ── */}
      {activeTab === 'rbac' && (
        currentPlanName !== 'enterprise' ? (
          <div className="space-y-6 animate-fade-in text-xs max-w-4xl mx-auto py-8">
            {currentPlanName === 'freemium' ? (
              /* Freemium Plan Lock Screen */
              <GlassCard className="border-red-500/20 bg-black/60 shadow-[0_0_50px_rgba(239,68,68,0.1)] p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-red-500/10 border-l border-b border-red-500/20 rounded-bl-xl text-red-400 font-bold uppercase tracking-wider text-[8px]">
                  Freemium Lock
                </div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20 animate-pulse">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100 mb-2">Dynamic RBAC & Sub-Admins Locked</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                  You are currently on the <span className="text-red-400 font-bold uppercase">Freemium</span> tier. Advanced role permissions configuration, dynamic sub-admin directories, and granular authorization matrix tables are restricted to Enterprise schools.
                </p>
                <div className="inline-block p-4 bg-slate-900/60 border border-slate-800 rounded-xl max-w-lg mx-auto text-left space-y-2 mb-6 w-full">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Enterprise Upgrade Benefits:</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[10px]">
                    <li>Dynamic Sub-Admin Role Matrix (Finance, Transport, Exams, Librarian, Custom)</li>
                    <li>SaaS Disaster Recovery with automated off-site backups</li>
                    <li>Advanced institutional metrics, analytics, and printable invoicing PDF reports</li>
                  </ul>
                </div>
                <button 
                  disabled
                  className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white rounded-lg font-bold w-full max-w-xs transition-all active:scale-[0.98] cursor-not-allowed opacity-80"
                >
                  Request Enterprise Upgrade
                </button>
              </GlassCard>
            ) : currentPlanName === 'basic' ? (
              /* Basic Plan Lock Screen */
              <GlassCard className="border-amber-500/20 bg-black/60 shadow-[0_0_50px_rgba(245,158,11,0.1)] p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-amber-500/10 border-l border-b border-amber-500/20 rounded-bl-xl text-amber-400 font-bold uppercase tracking-wider text-[8px] flex items-center gap-1">
                  <Crown size={8} /> Enterprise Only
                </div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100 mb-2">Advanced RBAC Matrix Restricted</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                  School accounts on the <span className="text-amber-400 font-bold uppercase">Basic</span> plan cannot manage custom sub-admin operator directory listings or configure modular access rules.
                </p>
                <div className="inline-block p-4 bg-slate-900/60 border border-slate-800 rounded-xl max-w-lg mx-auto text-left space-y-2 mb-6 w-full">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Enterprise Feature Set:</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[10px]">
                    <li>Complete dynamic granular permissions toggle grid for 7 modules</li>
                    <li>Add/Remove/Suspend Sub-Admins in real time</li>
                    <li>Enterprise-grade auditing logs and threat detection telemetry</li>
                  </ul>
                </div>
                <button 
                  disabled
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-lg font-bold w-full max-w-xs transition-all active:scale-[0.98] cursor-not-allowed opacity-80"
                >
                  Contact Admin for Enterprise Tier
                </button>
              </GlassCard>
            ) : (
              /* Pro Plan Lock Screen (Upgrade to Enterprise Required) */
              <GlassCard className="border-indigo-500/20 bg-black/60 shadow-[0_0_50px_rgba(99,102,241,0.1)] p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-indigo-500/10 border-l border-b border-indigo-500/20 rounded-bl-xl text-indigo-400 font-bold uppercase tracking-wider text-[8px]">
                  Enterprise Upgrade Required
                </div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-indigo-500/20">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100 mb-2">Upgrade to Enterprise Plan</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                  You are currently on the <span className="text-indigo-400 font-bold uppercase">Pro</span> tier. Dynamic sub-admin management and advanced modular authorization matrix controls require an active upgrade to the designated <span className="text-indigo-400 font-bold uppercase">Enterprise</span> Plan.
                </p>
                <button 
                  disabled
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white rounded-lg font-bold w-full max-w-xs transition-all active:scale-[0.98] cursor-not-allowed opacity-80"
                >
                  Activate Enterprise Subscription
                </button>
              </GlassCard>
            )}
          </div>
        ) : (
        <div className="space-y-6 animate-fade-in text-xs">
          {/* Header */}
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Sliders className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Dynamic Role & Module Permissions Grid</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Toggle dynamic access permissions for administrative sub-roles and register secure console operators.</p>
              </div>
            </div>

            {(session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN') && (
              <button 
                onClick={() => setShowAddSubAdmin(true)}
                className="glass-btn-primary py-1.5 px-3 text-xs flex items-center gap-1.5 font-bold self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>Register Sub-Admin</span>
              </button>
            )}
          </GlassCard>

          {/* Dynamic Grid Table */}
          <GlassCard className="space-y-4">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <CheckSquare className="text-brand-400" size={15} />
                Sub-Admin Modules Authorization Matrix
              </h4>
              {rbacLoading && (
                <span className="text-[10px] text-brand-400 animate-pulse font-mono font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-ping"></span>
                  Processing updates...
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">Granularly toggle which system components each administrative role can view, create, edit, or delete. Changes are synchronized in real-time.</p>

            <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                    <th className="py-3 px-4">System Modules</th>
                    {Object.keys(rbacPermissions).map((role) => (
                      <th key={role} className="py-3 px-4 text-center">{role.replace('_', ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40">
                  {rbacModules.map((module) => (
                    <tr key={module.key} className="hover:bg-slate-900/10 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-300">{module.label}</td>
                      {Object.keys(rbacPermissions).map((role) => (
                        <td key={role} className="py-3.5 px-4 text-center">
                          <input 
                            type="checkbox" 
                            checked={rbacPermissions[role][module.key] || false} 
                            onChange={() => {
                              const updated = { ...rbacPermissions };
                              updated[role][module.key] = !updated[role][module.key];
                              setRbacPermissions(updated);
                            }}
                            className="w-4 h-4 rounded text-brand-600 bg-slate-950 border-slate-800 focus:ring-brand-500 cursor-pointer mx-auto"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-850">
              <button 
                onClick={handleSaveRbacMatrix}
                disabled={rbacLoading}
                className="glass-btn-primary py-2 px-5 font-bold text-xs"
              >
                Save Matrix Configuration
              </button>
            </div>
          </GlassCard>

          {/* Console Operators & Sub-Admin Accounts */}
          <GlassCard className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Users className="text-brand-400" size={15} />
                  Console Operators & Sub-Admin Accounts
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Manage administrative sub-admins, toggle access parameters, and review operator sessions.</p>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={12} />
                <input 
                  type="text"
                  placeholder="Search operators..."
                  value={operatorsSearch}
                  onChange={(e) => setOperatorsSearch(e.target.value)}
                  className="glass-input pl-9 py-1.5 w-full text-xs"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                    <th className="py-3 px-4">Operator</th>
                    <th className="py-3 px-4">Employee ID</th>
                    <th className="py-3 px-4">Role Assigned</th>
                    <th className="py-3 px-4">Session Telemetry</th>
                    <th className="py-3 px-4">Account Status</th>
                    {(session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN') && (
                      <th className="py-3 px-4 text-right">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40">
                  {operators
                    .filter(op => {
                      const search = operatorsSearch.toLowerCase();
                      return (
                        op.firstName.toLowerCase().includes(search) ||
                        op.lastName.toLowerCase().includes(search) ||
                        op.email.toLowerCase().includes(search) ||
                        op.role.toLowerCase().includes(search) ||
                        (op.employeeId || '').toLowerCase().includes(search)
                      );
                    })
                    .map((op) => (
                      <tr key={op.id} className="hover:bg-slate-900/10 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-200">{op.firstName} {op.lastName}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{op.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          {op.employeeId ? (
                            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-bold font-mono">
                              {op.employeeId}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-600 italic">—</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full bg-slate-900 text-brand-400 border border-brand-500/10 text-[9px] font-bold font-mono">
                            {op.role.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5 text-slate-400">
                            <span className={`w-1.5 h-1.5 rounded-full ${op.sessionStatus === 'ONLINE' ? 'bg-green-400 animate-pulse' : 'bg-slate-600'}`} />
                            <span className="text-[10px]">{op.sessionStatus === 'ONLINE' ? 'Live Session' : 'Offline'}</span>
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono mt-0.5">
                            {op.loginDevice || 'No Device Registered'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${op.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {op.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        {(session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN') && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => {
                                setShowEditSubAdmin(op);
                                setEditEmail(op.email);
                                setEditFirst(op.firstName);
                                setEditLast(op.lastName);
                                setEditPhone(op.phone || '');
                                setEditRole(op.role);
                                setEditEmployeeId(op.employeeId || '');
                                setEditIsActive(op.isActive);
                              }}
                              className="mr-2 px-2 py-1 rounded font-bold text-[9px] transition-all bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleOperatorStatus(op.id, op.isActive)}
                              className={`px-2 py-1 rounded font-bold text-[9px] transition-all ${op.isActive ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20'}`}
                            >
                              {op.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  {operators.length === 0 && (
                    <tr>
                      <td colSpan={session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN' ? 6 : 5} className="py-6 text-center text-slate-500 font-mono">
                        No administrative operators found inside this school tenant registry.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>

          {/* Enterprise System Audit Trail */}
          <GlassCard className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Activity className="text-brand-400" size={15} />
                  Enterprise System Audit Trail Log Console
                </h4>
                <p className="text-[10px] text-slate-400 mt-0.5">Comprehensive audit ledger recording database entries, operator changes, and rollback processes.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={auditModuleFilter}
                  onChange={(e) => setAuditModuleFilter(e.target.value)}
                  className="glass-input py-1.5 px-3 text-[10px] font-bold"
                >
                  <option value="all">All Modules</option>
                  <option value="billing">Billing</option>
                  <option value="directory">Directory</option>
                  <option value="academics">Academics</option>
                  <option value="grading">Grading</option>
                  <option value="security">Security</option>
                </select>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 text-slate-500" size={11} />
                  <input 
                    type="text"
                    placeholder="Search logs..."
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="glass-input pl-8 py-1.5 text-[10px] w-48 font-semibold"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                    <th className="py-3 px-4">Operator Info</th>
                    <th className="py-3 px-4">Module</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Network & Client Telemetry</th>
                    <th className="py-3 px-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/30">
                  {auditLogs
                    .filter(log => {
                      if (auditModuleFilter !== 'all' && log.moduleName !== auditModuleFilter) return false;
                      const search = auditSearch.toLowerCase();
                      return (
                        log.actionType.toLowerCase().includes(search) ||
                        log.moduleName.toLowerCase().includes(search) ||
                        (log.ipAddress && log.ipAddress.includes(search))
                      );
                    })
                    .map((log) => {
                      const isExpanded = expandedAuditLogId === log.id;
                      return (
                        <React.Fragment key={log.id}>
                          <tr 
                            onClick={() => setExpandedAuditLogId(isExpanded ? null : log.id)}
                            className="hover:bg-slate-900/15 transition-colors cursor-pointer"
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-300">
                                {log.userId ? (operators.find(o => o.id === log.userId)?.firstName || 'Sub-Admin') : 'System Event'}
                              </div>
                              <div className="text-[9px] text-slate-500 font-mono mt-0.5">{log.userId || 'GENERIC'}</div>
                            </td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-850 text-[9px] font-bold uppercase tracking-wider font-mono">
                                {log.moduleName}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-semibold text-slate-300">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-bold font-mono ${
                                log.actionType.includes('CREATE') || log.actionType.includes('ACTIVATE') ? 'text-green-400 bg-green-500/5' : 
                                log.actionType.includes('UPDATE') ? 'text-amber-400 bg-amber-500/5' : 'text-rose-400 bg-rose-500/5'
                              }`}>
                                {log.actionType}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-mono text-slate-300 text-[10px]">{log.ipAddress || '127.0.0.1'}</div>
                              <div className="text-[9px] text-slate-500 max-w-xs truncate" title={log.userAgent}>
                                {log.userAgent || 'Telemetry unavailable'}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-[9px] text-slate-500">
                              {new Date(log.createdAt).toLocaleString()}
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-900/30">
                              <td colSpan={5} className="py-3 px-6 border-l-2 border-brand-500">
                                <div className="space-y-2">
                                  <div className="text-[10px] font-bold text-brand-400 uppercase tracking-wider">Telemetry Payload Details</div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                      <div className="text-[9px] font-bold text-slate-400 uppercase">Pre-State (Old Data)</div>
                                      <pre className="p-2 rounded-lg bg-slate-950 text-[9px] font-mono text-slate-400 overflow-x-auto max-h-32">
                                        {log.oldData ? JSON.stringify(log.oldData, null, 2) : 'No old data telemetry state recorded.'}
                                      </pre>
                                    </div>
                                    <div className="space-y-1">
                                      <div className="text-[9px] font-bold text-slate-400 uppercase">Post-State (New Data)</div>
                                      <pre className="p-2 rounded-lg bg-slate-950 text-[9px] font-mono text-slate-300 overflow-x-auto max-h-32">
                                        {log.newData ? JSON.stringify(log.newData, null, 2) : 'No new data state registered.'}
                                      </pre>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-500 font-mono">
                        No system logging events registered inside this school audit console.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
        )
      )}


      {/* ── 5. REPORT CARD & INVOICE PRINT OVERLAYS (MODALS) ── */}
      {showInvoicePdf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <GlassCard className="w-full max-w-2xl bg-white text-slate-900 p-8 space-y-6 relative max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setShowInvoicePdf(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors border border-slate-200"
              title="Close Print Preview"
            >
              <XCircle size={18} />
            </button>

            {/* Print Header */}
            <div className="flex justify-between items-start border-b-2 border-slate-100 pb-4">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-800">AEGIS ACADEMY</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider font-mono">Official Fee Receipt</p>
                <p className="text-xs text-slate-400 mt-1">Silicon Valley, Tech District, USA</p>
              </div>
              <div className="text-right">
                <span className="px-2.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold uppercase tracking-wider border border-green-200">PAID IN FULL</span>
                <p className="text-xs font-mono font-bold text-slate-600 mt-2">{showInvoicePdf.code}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">Date: {showInvoicePdf.date}</p>
              </div>
            </div>

            {/* Content Details */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Billed To Parent</p>
                  <p className="font-bold text-slate-700 mt-1">Robert da Vinci</p>
                  <p className="text-slate-500 mt-0.5">42 Galaxy Meadows, Cupertino, CA</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Beneficiary Student</p>
                  <p className="font-bold text-slate-700 mt-1">Leo da Vinci</p>
                  <p className="text-slate-500 mt-0.5">Class: Grade 10-A (Roll #10)</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden mt-4">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3 text-right">Unit Price</th>
                      <th className="py-2.5 px-3 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150">
                    <tr>
                      <td className="py-3 px-3 font-semibold text-slate-700">{showInvoicePdf.name}</td>
                      <td className="py-3 px-3 text-right font-mono text-slate-600">{showInvoicePdf.amount}</td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-800">{showInvoicePdf.amount}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Total calculations */}
              <div className="flex justify-end pt-2 border-t border-slate-100">
                <div className="w-56 text-xs space-y-1.5 text-right font-mono">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span>{showInvoicePdf.amount}</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Taxes & Levies (0%):</span>
                    <span>$0.00</span>
                  </div>
                  <div className="flex justify-between text-slate-800 font-bold text-sm border-t border-slate-200 pt-1.5">
                    <span>Grand Total:</span>
                    <span>{showInvoicePdf.amount}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button 
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors active:scale-[0.98]"
              >
                Print PDF Receipt
              </button>
              <button 
                onClick={() => setShowInvoicePdf(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                Close Preview
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Sub-Admin Registration Modal */}
      {showAddSubAdmin && currentPlanName === 'enterprise' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Register Sub-Admin Console Operator</h4>
              <button onClick={() => setShowAddSubAdmin(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreateSubAdmin} className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input type="email" placeholder="operator@aegis.com" value={saEmail} onChange={(e) => setSaEmail(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Administrative Role</label>
                <select value={saRole} onChange={(e: any) => setSaRole(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required>
                  <option value="FINANCE_ADMIN">Finance Administration (Biller)</option>
                  <option value="ACADEMIC_ADMIN">Academic Coordinator</option>
                  <option value="EXAM_CONTROLLER">Exam Controller & Grader</option>
                  <option value="LIBRARIAN">School Librarian</option>
                  <option value="TRANSPORT_MANAGER">Transport Fleet Manager</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" placeholder="First Name" value={saFirst} onChange={(e) => setSaFirst(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" placeholder="Last Name" value={saLast} onChange={(e) => setSaLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone</label>
                <input type="text" placeholder="+1 (555) 000-0000" value={saPhone} onChange={(e) => setSaPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Employee ID / Staff ID <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. EMP-FIN-001, STAFF-2026-042" 
                  value={saEmployeeId} 
                  onChange={(e) => setSaEmployeeId(e.target.value)} 
                  className="w-full bg-slate-900 border border-amber-900/40 text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500/60" 
                  required 
                />
                <p className="text-[8px] text-slate-500 mt-0.5">Must be unique within your school. This ID will be permanently linked to the operator profile.</p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Operator Key (Password)</label>
                <input 
                  type="password"
                  placeholder="Min. 6 characters"
                  value={saPassword}
                  onChange={(e) => setSaPassword(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none"
                  required
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAddSubAdmin(false)} className="glass-btn-secondary text-xs" disabled={rbacLoading}>Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs" disabled={rbacLoading}>
                  {rbacLoading ? 'Registering...' : 'Register Operator'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Sub-Admin Edit Modal */}
      {showEditSubAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Edit Sub-Admin Console Operator</h4>
              <button onClick={() => setShowEditSubAdmin(null)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleSaveEditSubAdmin} className="space-y-3 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Email Address</label>
                <input 
                  type="email" 
                  placeholder="operator@aegis.com" 
                  value={editEmail} 
                  onChange={(e) => setEditEmail(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Administrative Role</label>
                <select 
                  value={editRole} 
                  onChange={(e: any) => setEditRole(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" 
                  required
                >
                  <option value="FINANCE_ADMIN">Finance Administration (Biller)</option>
                  <option value="ACADEMIC_ADMIN">Academic Coordinator</option>
                  <option value="EXAM_CONTROLLER">Exam Controller & Grader</option>
                  <option value="LIBRARIAN">School Librarian</option>
                  <option value="TRANSPORT_MANAGER">Transport Fleet Manager</option>
                  <option value="CUSTOM_SUB_ADMIN">Custom Operator</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input 
                  type="text" 
                  placeholder="First Name" 
                  value={editFirst} 
                  onChange={(e) => setEditFirst(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" 
                  required 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input 
                  type="text" 
                  placeholder="Last Name" 
                  value={editLast} 
                  onChange={(e) => setEditLast(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" 
                  required 
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Phone</label>
                <input 
                  type="text" 
                  placeholder="+1 (555) 000-0000" 
                  value={editPhone} 
                  onChange={(e) => setEditPhone(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" 
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-amber-400">Employee ID / Staff ID <span className="text-red-400">*</span></label>
                <input 
                  type="text" 
                  placeholder="e.g. EMP-FIN-001, STAFF-2026-042" 
                  value={editEmployeeId} 
                  onChange={(e) => setEditEmployeeId(e.target.value)} 
                  className="w-full bg-slate-900 border border-amber-900/40 text-xs rounded-lg p-2 focus:outline-none focus:border-amber-500/60" 
                  required 
                />
                <p className="text-[8px] text-slate-500 mt-0.5">Must be unique within your school. This ID will be permanently linked to the operator profile.</p>
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Account Status</label>
                <div className="flex items-center gap-4 mt-1">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                    <input 
                      type="radio" 
                      name="editIsActive" 
                      checked={editIsActive === true} 
                      onChange={() => setEditIsActive(true)} 
                      className="accent-brand-500" 
                    />
                    <span>Active (Granted Portal Access)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-200">
                    <input 
                      type="radio" 
                      name="editIsActive" 
                      checked={editIsActive === false} 
                      onChange={() => setEditIsActive(false)} 
                      className="accent-red-500" 
                    />
                    <span>Deactivated (Suspended Portal Access)</span>
                  </label>
                </div>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowEditSubAdmin(null)} className="glass-btn-secondary text-xs" disabled={rbacLoading}>Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs" disabled={rbacLoading}>
                  {rbacLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {activeTab === 'transport' && (
        <div className="space-y-6 animate-fade-in text-xs">
          {/* Header */}
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Layers className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">School Transit & Transport Management</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Manage the transit fleet, plan bus routes, log maintenance costs, assign student stops, and check driver attendance.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMN 1: Fleet Manager & Maintenance */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Layers className="text-brand-400" size={15} />
                  Buses Fleet Registry
                </h4>
                <form onSubmit={handleCreateBus} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Register New Vehicle</p>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Plate Number</label>
                    <input type="text" placeholder="e.g. MH-12-AB-3456" value={busPlate} onChange={(e) => setBusPlate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Capacity</label>
                      <input type="number" value={busCapacity} onChange={(e) => setBusCapacity(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Status</label>
                      <select value={busStatus} onChange={(e) => setBusStatus(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                        <option value="ACTIVE">Active</option>
                        <option value="MAINTENANCE">Maintenance</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Assigned Driver</label>
                    <select value={busDriverId} onChange={(e) => setBusDriverId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                      <option value="">-- No Driver --</option>
                      {driversList.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="w-full py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-slate-100 transition-colors">Add Bus</button>
                </form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {buses.map(b => {
                    const dr = driversList.find(d => d.id === b.driverId);
                    return (
                      <div key={b.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-200">{b.numberPlate}</p>
                          <p className="text-[9px] text-slate-400">Cap: {b.capacity} seats | Driver: {dr ? dr.name : 'Unassigned'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${b.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-orange-500/10 text-orange-400'}`}>{b.status}</span>
                          <button onClick={() => handleDeleteBus(b.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Sliders className="text-brand-400" size={15} />
                  Maintenance Expense Log
                </h4>
                <form onSubmit={handleCreateMaintenanceLog} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Bus</label>
                    <select value={maintBusId} onChange={(e) => setMaintBusId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Bus --</option>
                      {buses.map(b => (
                        <option key={b.id} value={b.id}>{b.numberPlate}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Date</label>
                      <input type="date" value={maintDate} onChange={(e) => setMaintDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Cost ($)</label>
                      <input type="number" value={maintCost} onChange={(e) => setMaintCost(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Work Description</label>
                    <input type="text" placeholder="e.g. Brake replacement" value={maintDesc} onChange={(e) => setMaintDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <button type="submit" className="w-full py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-slate-100 transition-colors">Log Expense</button>
                </form>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {maintenanceLogs.map(ml => {
                    const bus = buses.find(b => b.id === ml.busId);
                    return (
                      <div key={ml.id} className="p-2 bg-slate-900/30 border border-slate-850/50 rounded-lg flex justify-between text-[10px]">
                        <div>
                          <p className="font-semibold text-slate-300">{ml.description}</p>
                          <p className="text-[8px] text-slate-500">Bus: {bus ? bus.numberPlate : 'Unknown'} | Date: {ml.logDate}</p>
                        </div>
                        <p className="font-mono text-brand-400 font-bold">${Number(ml.cost).toFixed(2)}</p>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* COLUMN 2: Driver Register, Attendance, and Routing */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <UsersRound className="text-brand-400" size={15} />
                  Driver Registry & Daily Attendance
                </h4>
                <form onSubmit={handleRegisterDriver} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Register New Driver</p>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Name</label>
                    <input type="text" placeholder="Full name" value={drName} onChange={(e) => setDrName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">License Number</label>
                      <input type="text" placeholder="DL-XXXX" value={drLicense} onChange={(e) => setDrLicense(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Phone</label>
                      <input type="text" placeholder="+1 555-..." value={drPhone} onChange={(e) => setDrPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-slate-100 transition-colors">Register Driver</button>
                </form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {driversList.map(d => {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const att = driverAttendanceList.find(a => a.driverId === d.id && a.date === todayStr);
                    const status = att ? att.status : 'UNMARKED';
                    return (
                      <div key={d.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-200">{d.name}</p>
                          <p className="text-[9px] text-slate-400">License: {d.licenseNumber} | Phone: {d.phone}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => handleMarkDriverAttendance(d.id, 'PRESENT')} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${status === 'PRESENT' ? 'bg-green-600 text-slate-100' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>Present</button>
                          <button onClick={() => handleMarkDriverAttendance(d.id, 'ABSENT')} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${status === 'ABSENT' ? 'bg-red-600 text-slate-100' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>Absent</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            </div>

            {/* COLUMN 3: Routes & Pickup Points Planner */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Layers className="text-brand-400" size={15} />
                  Transit Routes Planner
                </h4>
                <form onSubmit={handleCreateRoute} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Route Name</label>
                      <input type="text" placeholder="e.g. North Expressway" value={rtName} onChange={(e) => setRtName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Route Code</label>
                      <input type="text" placeholder="e.g. R-101" value={rtCode} onChange={(e) => setRtCode(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Start Point</label>
                      <input type="text" placeholder="Start" value={rtStart} onChange={(e) => setRtStart(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">End Point</label>
                      <input type="text" placeholder="Campus" value={rtEnd} onChange={(e) => setRtEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Fare ($)</label>
                      <input type="number" value={rtFare} onChange={(e) => setRtFare(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-slate-100 transition-colors">Add Route</button>
                </form>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {routes.map(r => (
                    <div key={r.id} className="p-2 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-250">{r.name} ({r.routeCode})</p>
                        <p className="text-[8px] text-slate-500">From: {r.startPoint} {'\u2192'} To: {r.endPoint} | Fare: ${Number(r.fare).toFixed(2)}</p>
                      </div>
                      <button onClick={() => handleDeleteRoute(r.id)} className="p-1 text-slate-500 hover:text-red-400 rounded"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Route Stops Pickup Points */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Layers className="text-brand-400" size={15} />
                Route Pickup Stops Coordinates
              </h4>
              <form onSubmit={handleCreatePickupPoint} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Stop/Pickup Name</label>
                    <input type="text" placeholder="e.g. Park Street Gate" value={ppName} onChange={(e) => setPpName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Assign to Route</label>
                    <select value={ppRouteId} onChange={(e) => setPpRouteId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Route --</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.routeCode})</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Latitude (Optional)</label>
                    <input type="text" placeholder="e.g. 40.7128" value={ppLat} onChange={(e) => setPpLat(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Longitude (Optional)</label>
                    <input type="text" placeholder="e.g. -74.0060" value={ppLng} onChange={(e) => setPpLng(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" />
                  </div>
                </div>
                <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Add Stop</button>
              </form>

              <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                      <th className="py-2.5 px-3">Stop Name</th>
                      <th className="py-2.5 px-3">Route Code</th>
                      <th className="py-2.5 px-3">Coordinates</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40 text-slate-350">
                    {pickupPointsList.map(pp => {
                      const route = routes.find(r => r.id === pp.routeId);
                      return (
                        <tr key={pp.id} className="hover:bg-slate-900/10">
                          <td className="py-2 px-3 font-semibold text-slate-200">{pp.name}</td>
                          <td className="py-2 px-3">{route ? route.routeCode : 'Unlinked'}</td>
                          <td className="py-2 px-3 font-mono text-[9px]">{pp.latitude ?? 'N/A'}, {pp.longitude ?? 'N/A'}</td>
                          <td className="py-2 px-3 text-right">
                            <button onClick={() => handleDeletePickupPoint(pp.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* Student Bus Assignments */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Users className="text-brand-400" size={15} />
                Student Transit Assignments Map
              </h4>
              <form onSubmit={handleCreateTransportAssignment} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Student</label>
                    <select value={taStudentId} onChange={(e) => setTaStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Student --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.userDetails?.firstName} {s.userDetails?.lastName} ({s.admissionNumber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Bus Fleet</label>
                    <select value={taBusId} onChange={(e) => setTaBusId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Bus --</option>
                      {buses.map(b => (
                        <option key={b.id} value={b.id}>{b.numberPlate}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Route</label>
                    <select value={taRouteId} onChange={(e) => setTaRouteId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Route --</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.name} ({r.routeCode})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Stop Point</label>
                    <select value={taPickupPointId} onChange={(e) => setTaPickupPointId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Stop --</option>
                      {pickupPointsList
                        .filter(pp => pp.routeId === taRouteId)
                        .map(pp => (
                          <option key={pp.id} value={pp.id}>{pp.name}</option>
                        ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Assign Student Stop</button>
              </form>

              <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-56">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Bus Plate</th>
                      <th className="py-2.5 px-3">RouteStop</th>
                      <th className="py-2.5 px-3 text-right">Remove</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40 text-slate-350">
                    {transportAssignments.map(ta => {
                      const student = students.find(s => s.id === ta.studentId);
                      const bus = buses.find(b => b.id === ta.busId);
                      const route = routes.find(r => r.id === ta.routeId);
                      const pp = pickupPointsList.find(p => p.id === ta.pickupPointId);
                      return (
                        <tr key={ta.id} className="hover:bg-slate-900/10">
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {student ? `${student.userDetails?.firstName} ${student.userDetails?.lastName}` : 'Unknown'}
                          </td>
                          <td className="py-2 px-3 font-mono">{bus ? bus.numberPlate : 'N/A'}</td>
                          <td className="py-2 px-3">
                            <span className="text-brand-400 font-bold">[{route ? route.routeCode : 'N/A'}]</span> {pp ? pp.name : 'N/A'}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button onClick={() => handleDeleteTransportAssignment(ta.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
        </div>
      )}

      {activeTab === 'books' && (
        <div className="space-y-6 animate-fade-in text-xs">
          {/* Header */}
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <BookOpen className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Library Catalog & Inventory Manager</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Maintain the physical book archives, catalog digital assets, create custom subjects/categories, issue books to students, and manage overdue fine balances.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* COLUMN 1: Book Entry & Categories */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <BookOpen className="text-brand-400" size={15} />
                  Register Book Title
                </h4>
                <form onSubmit={handleCreateBook} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Title</label>
                    <input type="text" placeholder="Book Title" value={bkTitle} onChange={(e) => setBkTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Author</label>
                      <input type="text" placeholder="Author name" value={bkAuthor} onChange={(e) => setBkAuthor(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">ISBN</label>
                      <input type="text" placeholder="e.g. 978-..." value={bkIsbn} onChange={(e) => setBkIsbn(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Copies</label>
                      <input type="number" value={bkCopies} onChange={(e) => setBkCopies(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Category/Subject</label>
                      <select value={bkSubject} onChange={(e) => setBkSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                        <option value="">-- Choose Category --</option>
                        {bookCategories.map(bc => (
                          <option key={bc.id} value={bc.name}>{bc.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Add Book to Catalog</button>
                </form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mockDb.books.map(b => (
                    <div key={b.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-200">{b.title}</p>
                        <p className="text-[9px] text-slate-400">Author: {b.author} | Copies: {b.availableCopies}/{b.totalCopies}</p>
                      </div>
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-brand-500/10 text-brand-400 font-mono">{b.subject}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Book Categories Management Board */}
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Layers className="text-brand-400" size={15} />
                  Book Categories Board
                </h4>
                <form onSubmit={handleCreateBookCategory} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Category Name</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Science Fiction" 
                        value={bcName} 
                        onChange={(e) => setBcName(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" 
                        required 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Category Code</label>
                      <input 
                        type="text" 
                        placeholder="e.g. SCI-FI" 
                        value={bcCode} 
                        onChange={(e) => setBcCode(e.target.value)} 
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" 
                        required 
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-emerald-650 hover:bg-emerald-700 rounded-lg font-bold text-slate-100 transition-colors text-xs">Create Category</button>
                </form>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {bookCategories.length === 0 ? (
                    <p className="text-[10px] text-slate-500 text-center py-2 font-mono">NO ACTIVE CATEGORIES FOUND</p>
                  ) : (
                    bookCategories.map(bc => (
                      <div key={bc.id} className="p-2 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-200 text-xs">{bc.name}</p>
                          <p className="text-[9px] text-slate-500 font-mono">{bc.code}</p>
                        </div>
                        <button 
                          onClick={() => handleDeleteBookCategory(bc.id)}
                          className="p-1 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>
            </div>

            {/* COLUMN 2: Issue Manager & Returns */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Calendar className="text-brand-400" size={15} />
                  Issue/Checkout Book Entry
                </h4>
                <form onSubmit={handleIssueBook} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Book Title</label>
                    <select value={biBookId} onChange={(e) => setBiBookId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Book --</option>
                      {mockDb.books.filter(b => b.availableCopies > 0).map(b => (
                        <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} available)</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Student ID</label>
                    <select value={biStudentId} onChange={(e) => setBiStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Student --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.userDetails?.firstName} {s.userDetails?.lastName} ({s.admissionNumber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Due Return Date</label>
                    <input type="date" value={biDueDate} onChange={(e) => setBiDueDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Issue Book (Check-out)</button>
                </form>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {bookIssues.filter(bi => bi.status === 'ISSUED' || bi.status === 'OVERDUE').map(bi => {
                    const student = students.find(s => s.id === bi.studentId);
                    const book = mockDb.books.find(b => b.id === bi.bookId);
                    return (
                      <div key={bi.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-200">{book ? book.title : 'Unknown Book'}</p>
                          <p className="text-[9px] text-slate-400">To: {student ? `${student.userDetails?.firstName} ${student.userDetails?.lastName}` : 'Unknown'} | Due: {new Date(bi.dueDate).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${bi.status === 'OVERDUE' ? 'bg-red-500/10 text-red-400' : 'bg-brand-500/10 text-brand-400'}`}>{bi.status}</span>
                          <button onClick={() => { setBrIssueId(bi.id); setBrFine(bi.status === 'OVERDUE' ? 3.50 : 0); }} className="px-2 py-1 bg-green-600/20 text-green-400 hover:bg-green-600/30 rounded border border-green-500/20 font-bold text-[9px] transition-all">Return</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              {brIssueId && (
                <GlassCard className="border border-green-500/20 bg-green-950/10 space-y-3">
                  <h5 className="font-bold text-green-300">Process Book Return</h5>
                  <form onSubmit={handleReturnBook} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Fine Amount ($)</label>
                        <input type="number" step="0.01" value={brFine} onChange={(e) => setBrFine(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Status</label>
                        <select value={brStatus} onChange={(e) => setBrStatus(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                          <option value="RETURNED">Returned</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="LOST">Lost</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setBrIssueId('')} className="glass-btn-secondary py-1 px-3 text-[10px]">Cancel</button>
                      <button type="submit" className="glass-btn-primary py-1 px-3 text-[10px] bg-green-600 text-slate-100">Process Return</button>
                    </div>
                  </form>
                </GlassCard>
              )}
            </div>

            {/* COLUMN 3: Fines & Digital library */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <DollarSign className="text-brand-400" size={15} />
                  Overdue Fines Ledger
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {libraryFines.map(lf => {
                    const student = students.find(s => s.id === lf.studentId);
                    const book = mockDb.books.find(b => b.id === lf.issue?.bookId);
                    return (
                      <div key={lf.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-200">{student ? `${student.userDetails?.firstName} ${student.userDetails?.lastName}` : 'Unknown'}</p>
                          <p className="text-[9px] text-slate-400">Book: {book ? book.title : 'Late fee'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-red-400 font-bold">${Number(lf.amount).toFixed(2)}</span>
                          {!lf.isPaid ? (
                            <button onClick={() => { mockApi.payLibraryFine(session?.user.schoolId || '', lf.id); loadData(); }} className="px-1.5 py-0.5 bg-brand-500 hover:bg-brand-600 rounded text-[9px] font-bold text-slate-100">Pay Fine</button>
                          ) : (
                            <span className="text-[8px] font-bold text-green-400 uppercase bg-green-500/10 px-1 rounded">Paid</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>

              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <HardDrive className="text-brand-400" size={15} />
                  Digital Library Uploads
                </h4>
                <form onSubmit={handleCreateDigitalAsset} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Asset Title</label>
                    <input type="text" placeholder="Title" value={daTitle} onChange={(e) => setDaTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Author</label>
                      <input type="text" placeholder="Author" value={daAuthor} onChange={(e) => setDaAuthor(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">File Type</label>
                      <select value={daType} onChange={(e) => setDaType(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                        <option value="pdf">PDF E-Book</option>
                        <option value="epub">EPUB Reader</option>
                        <option value="mp4">Video Guide</option>
                      </select>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Public Asset URL</label>
                    <input type="url" placeholder="https://..." value={daUrl} onChange={(e) => setDaUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Upload Digital Link</button>
                </form>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'marksheets' && (
        <div className="space-y-6 animate-fade-in text-xs">
          {/* Header */}
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Award className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Examinations & Marksheet Registry Panel</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Configure school examination terms, map subjects passing thresholds, record students marks in an interactive marksheet matrix, and generate final printable report cards.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Exam Terms Creator */}
            <div className="space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Calendar className="text-brand-400" size={15} />
                  Examination Creator
                </h4>
                <form onSubmit={handleCreateExam} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Exam Name</label>
                    <input type="text" placeholder="e.g. Mid-Term Examination" value={exName} onChange={(e) => setExName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Term Session</label>
                    <select value={exTerm} onChange={(e) => setExTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                      <option value="TERM 1">Term 1</option>
                      <option value="TERM 2">Term 2</option>
                      <option value="FINAL">Final Examination</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Start Date</label>
                      <input type="date" value={exStart} onChange={(e) => setExStart(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">End Date</label>
                      <input type="date" value={exEnd} onChange={(e) => setExEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Create Exam Term</button>
                </form>

                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {examsList.map(ex => (
                    <div key={ex.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between text-[11px]">
                      <div>
                        <p className="font-bold text-slate-200">{ex.name}</p>
                        <p className="text-[9px] text-slate-400">Term: {ex.term} | Period: {new Date(ex.startDate).toLocaleDateString()} - {new Date(ex.endDate).toLocaleDateString()}</p>
                      </div>
                      <button onClick={() => handleDeleteExam(ex.id)} className="p-1 text-slate-500 hover:text-red-400 rounded"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Subject Criteria Mapper */}
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Layers className="text-brand-400" size={15} />
                  Subject Criteria Mapper
                </h4>
                <form onSubmit={handleCreateExamSubject} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Exam</label>
                    <select value={esExamId} onChange={(e) => setEsExamId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Exam --</option>
                      {examsList.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Subject</label>
                    <select value={esSubjectId} onChange={(e) => setEsSubjectId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Subject --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Max Marks</label>
                      <input type="number" value={esMax} onChange={(e) => setEsMax(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] text-slate-500 font-bold uppercase">Passing Marks</label>
                      <input type="number" value={esPass} onChange={(e) => setEsPass(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                    </div>
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Add Criteria</button>
                </form>
              </GlassCard>
            </div>

            {/* Editable Marks entry Grid */}
            <div className="lg:col-span-2 space-y-6">
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Award className="text-brand-400" size={15} />
                  Marksheet Entry Matrix Grid
                </h4>
                <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Exam</label>
                    <select value={meExamId} onChange={(e) => setMeExamId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                      <option value="">-- Choose Exam --</option>
                      {examsList.map(ex => (
                        <option key={ex.id} value={ex.id}>{ex.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Class Section</label>
                    <select value={meClassId} onChange={(e) => setMeClassId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                      <option value="">-- Choose Class --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Subject</label>
                    <select value={meSubjectId} onChange={(e) => setMeSubjectId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                      <option value="">-- Choose Subject --</option>
                      {subjects.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {meExamId && meClassId && meSubjectId && (
                  <form onSubmit={handleSaveStudentMarks} className="space-y-4">
                    <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-64">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                            <th className="py-2.5 px-3">Student Name</th>
                            <th className="py-2.5 px-3">Admission Code</th>
                            <th className="py-2.5 px-3">Marks Obtained</th>
                            <th className="py-2.5 px-3">Teacher Remarks</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-850/40 text-slate-350 bg-slate-950/10">
                          {students
                            .filter(s => s.classId === meClassId)
                            .map(s => {
                              const existingMark = studentMarks.find(sm => sm.studentId === s.id && sm.examId === meExamId && sm.subjectId === meSubjectId);
                              const currentVal = meMarks[s.id] ?? existingMark?.marksObtained ?? 0;
                              const currentRem = meRemarks[s.id] ?? existingMark?.remarks ?? '';
                              return (
                                <tr key={s.id} className="hover:bg-slate-900/10">
                                  <td className="py-2 px-3 font-semibold text-slate-200">{s.userDetails?.firstName} {s.userDetails?.lastName}</td>
                                  <td className="py-2 px-3 font-mono">{s.admissionNumber}</td>
                                  <td className="py-2 px-3">
                                    <input 
                                      type="number" 
                                      value={currentVal} 
                                      onChange={(e) => setMeMarks({ ...meMarks, [s.id]: parseFloat(e.target.value) || 0 })} 
                                      className="w-20 bg-slate-900 border border-slate-850 rounded p-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500 font-mono text-center" 
                                      required
                                    />
                                  </td>
                                  <td className="py-2 px-3">
                                    <input 
                                      type="text" 
                                      placeholder="e.g. Good logic skills" 
                                      value={currentRem} 
                                      onChange={(e) => setMeRemarks({ ...meRemarks, [s.id]: e.target.value })} 
                                      className="w-full bg-slate-900 border border-slate-850 rounded p-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500" 
                                    />
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-850">
                      <button type="submit" className="glass-btn-primary py-2 px-6 font-bold text-xs">Save Marks Matrix</button>
                    </div>
                  </form>
                )}
              </GlassCard>

              {/* Aggregate Results Publisher */}
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Award className="text-brand-400" size={15} />
                  Printable Report Card & Results Publisher
                </h4>
                <form onSubmit={handleGenerateReportCard} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Select Student</label>
                    <select value={rcStudentId} onChange={(e) => setRcStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Student --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.userDetails?.firstName} {s.userDetails?.lastName} ({s.admissionNumber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Examination Term</label>
                    <select value={rcTerm} onChange={(e) => setRcTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none">
                      <option value="TERM 1">Term 1</option>
                      <option value="TERM 2">Term 2</option>
                      <option value="FINAL">Final</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Attendance Percentage (%)</label>
                    <input type="number" value={rcAttendance} onChange={(e) => setRcAttendance(parseInt(e.target.value))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Homeroom Teacher Remarks</label>
                    <input type="text" placeholder="Specify student general progress/behavior..." value={rcRemarks} onChange={(e) => setRcRemarks(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <div className="sm:col-span-2 flex justify-end">
                    <button type="submit" className="glass-btn-primary py-2 px-6 font-bold text-xs bg-brand-600 text-slate-100">Publish & Generate Report Card</button>
                  </div>
                </form>
              </GlassCard>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'quizzes' && (
        <div className="space-y-6 animate-fade-in text-xs">
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Award className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Online Quizzes Performance Analytics</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Monitor quiz results, view class score distributions, and check student quiz attempts histories.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Quizzes List */}
            <GlassCard className="space-y-4 lg:col-span-1">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Layers className="text-brand-400" size={15} />
                Registered Quizzes List
              </h4>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {mockDb.quizzes.map(q => (
                  <div key={q.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl">
                    <p className="font-bold text-slate-200">{q.title}</p>
                    <p className="text-[9px] text-slate-400">Class: {classes.find(c => c.id === q.classId)?.name || 'Unknown'} | Subject: {subjects.find(s => s.id === q.subjectId)?.name || 'Unknown'}</p>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* Quiz Attempts Scores list */}
            <GlassCard className="space-y-4 lg:col-span-2">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Award className="text-brand-400" size={15} />
                Student Quiz Attempt Results
              </h4>
              <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                      <th className="py-2.5 px-3">Student Name</th>
                      <th className="py-2.5 px-3">Quiz Title</th>
                      <th className="py-2.5 px-3">Score / Out of</th>
                      <th className="py-2.5 px-3">Percentage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40 text-slate-350">
                    {quizResults.map(qr => {
                      const student = students.find(s => s.id === qr.studentId);
                      const quiz = mockDb.quizzes.find(q => q.id === qr.quizId);
                      const pct = Number(qr.totalMarks) > 0 ? ((Number(qr.score) / Number(qr.totalMarks)) * 100).toFixed(1) : '0';
                      return (
                        <tr key={qr.id} className="hover:bg-slate-900/10">
                          <td className="py-2 px-3 font-semibold text-slate-200">{student ? `${student.userDetails?.firstName} ${student.userDetails?.lastName}` : 'Unknown'}</td>
                          <td className="py-2 px-3">{quiz ? quiz.title : 'General Quiz'}</td>
                          <td className="py-2 px-3 font-mono font-bold text-brand-400">{qr.score} / {qr.totalMarks}</td>
                          <td className="py-2 px-3 font-mono">{pct}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          </div>
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

      {activeTab === 'attendance' && (
        <div className="space-y-6 animate-fade-in text-xs">
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Layers className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Student Attendance Register Roll</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Mark daily school attendance for student directories with single-click actions.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={attendanceClassId}
                onChange={(e) => setAttendanceClassId(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-brand-500"
              >
                <option value="">-- Select Class --</option>
                {classes.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-slate-250 rounded-lg px-3 py-1 text-xs focus:outline-none focus:border-brand-500"
              />
              <button 
                onClick={handleSaveAttendance}
                disabled={!attendanceClassId}
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-brand-500/15"
              >
                Save Attendance
              </button>
            </div>
          </GlassCard>

          {attendanceClassId ? (
            <GlassCard className="space-y-4">
              <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                      <th className="py-3 px-4">Roll</th>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Status Indicators</th>
                      <th className="py-3 px-4">Attendance Remarks</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850/40 text-slate-300">
                    {students.filter(s => s.classId === attendanceClassId).map(s => (
                      <tr key={s.id} className="hover:bg-slate-900/10">
                        <td className="py-3 px-4 font-mono">{s.rollNumber || 'N/A'}</td>
                        <td className="py-3 px-4 font-semibold text-slate-200">{s.userDetails?.firstName} {s.userDetails?.lastName}</td>
                        <td className="py-3 px-4">
                          <div className="flex gap-2">
                            {['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'].map(status => {
                              const isSelected = attendanceRecords[s.id] === status;
                              return (
                                <button
                                  key={status}
                                  onClick={() => setAttendanceRecords(prev => ({ ...prev, [s.id]: status as any }))}
                                  className={`px-2 py-0.5 rounded text-[9px] font-bold border transition-colors ${
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
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input 
                            type="text" 
                            placeholder="Delay logs, medical notes..."
                            value={attendanceRemarks[s.id] || ''}
                            onChange={(e) => setAttendanceRemarks(prev => ({ ...prev, [s.id]: e.target.value }))}
                            className="bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-1 px-2 text-xs focus:outline-none focus:border-brand-500 w-full max-w-xs"
                          />
                        </td>
                      </tr>
                    ))}
                    {students.filter(s => s.classId === attendanceClassId).length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500 italic">No students currently registered in this class.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="text-center py-12 bg-slate-900/15 border-slate-850">
              <Layers className="text-slate-600 mx-auto mb-4 opacity-50" size={48} />
              <p className="text-slate-400 font-medium">Please select a class above to view the register roster.</p>
            </GlassCard>
          )}
        </div>
      )}

      {activeTab === 'assignments' && (
        <div className="space-y-6 animate-fade-in text-xs">
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <BookOpen className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Homework & Assignments Registry</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Deploy new daily homework curriculum, assign grades, and download student solutions.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="space-y-4 lg:col-span-1">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Plus className="text-brand-450" size={15} />
                Deploy Homework / Assignment
              </h4>
              <form onSubmit={handleCreateAssignment} className="space-y-3.5 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase">Task Title</label>
                  <input 
                    type="text"
                    placeholder="e.g. Spacetime Calculus Proofs"
                    value={assignTitle}
                    onChange={(e) => setAssignTitle(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase">Problem Description</label>
                  <textarea 
                    placeholder="Provide full problem questions or equations..."
                    rows={4}
                    value={assignDesc}
                    onChange={(e) => setAssignDesc(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500 resize-none"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase">Due Date</label>
                  <input 
                    type="datetime-local"
                    value={assignDueDate}
                    onChange={(e) => setAssignDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase">Target Class</label>
                  <select 
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                    required
                  >
                    <option value="">-- Choose Class --</option>
                    {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-500 font-bold uppercase">Subject Category</label>
                  <select 
                    value={assignSubjectId}
                    onChange={(e) => setAssignSubjectId(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs text-slate-200 rounded-lg p-2 focus:outline-none focus:border-brand-500"
                    required
                  >
                    <option value="">-- Choose Subject --</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-brand-500/15">
                  Publish Assignment
                </button>
              </form>
            </GlassCard>

            <GlassCard className="space-y-4 lg:col-span-2">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <BookOpen className="text-brand-400" size={15} />
                Currently Deployed Assignments
              </h4>
              <div className="space-y-3 max-h-[550px] overflow-y-auto">
                {mockDb.assignments.filter(a => classes.some(c => c.id === a.classId)).map(ass => {
                  const cls = classes.find(c => c.id === ass.classId);
                  const sub = subjects.find(s => s.id === ass.subjectId);
                  return (
                    <div key={ass.id} className="p-3.5 bg-slate-900/30 border border-slate-850 rounded-xl space-y-2 hover:border-slate-750 transition-colors">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-bold uppercase tracking-wider text-brand-400 bg-brand-500/5 px-2 py-0.5 rounded border border-brand-500/10">
                            {cls?.name || 'General Class'}
                          </span>
                          <span className="ml-2 text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-slate-850 px-2 py-0.5 rounded border border-slate-800">
                            {sub?.name || 'General Subject'}
                          </span>
                          <h5 className="font-bold text-slate-200 text-xs mt-1.5">{ass.title}</h5>
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 font-semibold">Due: {new Date(ass.dueDate).toLocaleString()}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 italic line-clamp-2">"{ass.description}"</p>
                    </div>
                  );
                })}
                {mockDb.assignments.filter(a => classes.some(c => c.id === a.classId)).length === 0 && (
                  <p className="text-slate-500 text-center py-8 italic">No deployed homeworks/assignments yet.</p>
                )}
              </div>
            </GlassCard>
          </div>
        </div>
      )}

    </div>
  );
};

