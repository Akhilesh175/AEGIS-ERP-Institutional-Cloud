import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import { mockDb } from '../services/mockDb';
import { Student, Teacher, Parent, Class, Subject, User, FeeStructure, FeePayment, DriverSalaryPayout, PayrollRecord, SchoolPaymentSettings, SalaryPayment, EmployeeSalaryLedger, FacultyPaymentSettings } from '../types';
import { formatName, formatUserName } from '../utils/nameUtils';
import { GlassCard } from '../components/GlassCard';
import { 
  Building, Users, UsersRound, Layers, BookMarked, DollarSign, 
  Eye, EyeOff, Plus, Link, Calendar, CheckCircle2, ShieldAlert, ArrowRight, Key, Crown, Lock, Trash2, AlertTriangle, CheckCircle, AlertCircle, XCircle, Edit, CreditCard,
  Mail, Send, RefreshCw, Play, FileSpreadsheet, FileText, CheckSquare, Sliders, HardDrive, Download, ChevronRight, BarChart2, Clock, Settings, Shield, Search, Activity,
  Award, BookOpen, Home, UserCheck, UserX, Image, PlusCircle, Megaphone, X, Printer, QrCode, Wifi, WifiOff, Upload, ToggleLeft, ToggleRight, Info, ExternalLink, Banknote, ScanLine, ShieldCheck, Ban
} from 'lucide-react';
import PremiumLock from '../components/PremiumLock';
import { AdminPortalHeader } from '../components/AdminPortalHeader';
import { subscriptionPlans, isTabLocked, isTabLockedByEntitlements } from '../services/subscriptionConfig';
import { useFeatureEntitlements } from '../hooks/useFeatureEntitlements';
import { OfflineSyncManager } from '../components/OfflineSyncManager';
import { downloadMarksheetPdf } from '../components/MarksheetTemplate';
import { downloadReceiptPdf } from '../components/ReceiptTemplate';
import { 
  downloadStudentIdCardPdf, downloadAdmissionFormPdf, 
  downloadTransferCertificatePdf, downloadBonafideCertificatePdf, 
  downloadCertificateOfExcellencePdf,
  downloadCharacterCertificatePdf,
  downloadAdmissionRecordPdf
} from '../components/DocumentTemplates';
import {
  fetchStudentDocData,
  fetchSchoolDocData,
  fetchPrincipalDocData,
  saveGeneratedDocumentRecord,
  uploadStudentPhoto,
  upsertStudentProfile,
  getStudentPhotoUrl,
} from '../services/documentService';

import { ClassDiscussion } from '../components/ClassDiscussion';
import { AdminPTMManagement } from '../components/PTMManagement';

export const AdminPortal: React.FC<{ activeTab: string }> = ({ activeTab: rawActiveTab }) => {
  const activeTab = rawActiveTab.split('/')[0];
  const { session, setSession, syncSubscriptionPlan } = useStore();
  const adminId = session?.user.id;
  const isAcademicOrSchoolAdmin = session?.user.role === 'ADMIN' || session?.user.role === 'ACADEMIC_ADMIN';
  const canManageTransport = session?.user.role === 'SUPER_ADMIN' || session?.user.role === 'ADMIN' || session?.user.role === 'TRANSPORT_MANAGER';
  const cachedSchool = session?.user.schoolId ? mockDb.schools.find(s => s.id === session.user.schoolId) : null;
  const currentPlanName = (session?.schoolSubscriptionPlan || cachedSchool?.subscriptionPlan || 'freemium').toLowerCase();
  const plan = subscriptionPlans[currentPlanName] || subscriptionPlans.freemium;
  // DB-driven entitlements: live, DB-synced, fully tier-inheriting
  const ent = useFeatureEntitlements();

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
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<any[]>([]);

  // Documents Center States
  const [docSelectedStudentId, setDocSelectedStudentId] = useState<string>('');
  const [docGenerating, setDocGenerating] = useState<string>('');

  // State variables for new transport, library, and exams modules
  const [buses, setBuses] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [transportAssignments, setTransportAssignments] = useState<any[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<any[]>([]);
  const [driverAttendanceList, setDriverAttendanceList] = useState<any[]>([]);
  const [bookCategories, setBookCategories] = useState<any[]>([]);
  const [bookIssues, setBookIssues] = useState<any[]>([]);
  const [libraryFines, setLibraryFines] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [examsList, setExamsList] = useState<any[]>([]);
  const [examResults, setExamResults] = useState<any[]>([]);
  const [quizResults, setQuizResults] = useState<any[]>([]);
  const [driversList, setDriversList] = useState<any[]>([]);
  const [pickupPointsList, setPickupPointsList] = useState<any[]>([]);
  const [digitalAssetsList, setDigitalAssetsList] = useState<any[]>([]);
  const [studentMarks, setStudentMarks] = useState<any[]>([]);
  const [examSubjects, setExamSubjects] = useState<any[]>([]);
  const [driverSalaryPayouts, setDriverSalaryPayouts] = useState<DriverSalaryPayout[]>([]);
  const [transportFeeRecords, setTransportFeeRecords] = useState<any[]>([]);
  const [feesSubTab, setFeesSubTab] = useState<'billing' | 'drivers' | 'payroll' | 'payment-settings' | 'verify-payments' | 'salary-payments' | 'salary-queue'>('billing');
  // Payment Settings sub-tab state
  const [schoolPaySettings, setSchoolPaySettings] = useState<SchoolPaymentSettings | null>(null);
  const [paySettingsLoading, setPaySettingsLoading] = useState(false);
  const [paySettingsSaving, setPaySettingsSaving] = useState(false);
  const [paySettingsMsg, setPaySettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [psQrFile, setPsQrFile] = useState<File | null>(null);
  const [psQrPreview, setPsQrPreview] = useState<string | null>(null);
  const [psAccHolder, setPsAccHolder] = useState('');
  const [psBankName, setPsBankName] = useState('');
  const [psAccNumber, setPsAccNumber] = useState('');
  const [psIfsc, setPsIfsc] = useState('');
  const [psBranch, setPsBranch] = useState('');
  const [psSwift, setPsSwift] = useState('');
  const [psUpiId, setPsUpiId] = useState('');
  const [psInstructions, setPsInstructions] = useState('');
  const [psQrEnabled, setPsQrEnabled] = useState(true);
  const [psBankEnabled, setPsBankEnabled] = useState(true);
  const [psShowQrToParents, setPsShowQrToParents] = useState(true);
  const [psShowBankToParents, setPsShowBankToParents] = useState(true);
  const [psUtrUpload, setPsUtrUpload] = useState(true);
  const [psAutoRemind, setPsAutoRemind] = useState(false);
  // Verify Payments sub-tab state
  const [verifySearch, setVerifySearch] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyActionId, setVerifyActionId] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [verifyStatusFilter, setVerifyStatusFilter] = useState<'ALL' | 'PENDING' | 'PAID' | 'REJECTED'>('PENDING');
  const [verifySelectedPayment, setVerifySelectedPayment] = useState<FeePayment | null>(null);
  const [verifyReceiptFullscreen, setVerifyReceiptFullscreen] = useState(false);
  // Salary Payments state
  const [salaryPaymentsList, setSalaryPaymentsList] = useState<SalaryPayment[]>([]);
  const [salaryLedgerList, setSalaryLedgerList] = useState<EmployeeSalaryLedger[]>([]);
  const [salarySelectedEmpId, setSalarySelectedEmpId] = useState('');
  const [salaryMonth, setSalaryMonth] = useState(new Date().toISOString().substring(0, 7));
  const [salaryAmount, setSalaryAmount] = useState('');
  const [salaryUtr, setSalaryUtr] = useState('');
  const [salaryScreenshotUrl, setSalaryScreenshotUrl] = useState('');
  const [salaryScreenshotFile, setSalaryScreenshotFile] = useState<File | null>(null);
  const [isSubmittingSalary, setIsSubmittingSalary] = useState(false);
  const [salaryActionId, setSalaryActionId] = useState<string | null>(null);
  const [showSalaryRejectModal, setShowSalaryRejectModal] = useState(false);
  const [salaryRejectTargetId, setSalaryRejectTargetId] = useState('');
  const [salaryRejectReason, setSalaryRejectReason] = useState('');
  const [salarySearch, setSalarySearch] = useState('');
  const [empPaySettings, setEmpPaySettings] = useState<FacultyPaymentSettings | null>(null);
  const [empPaySettingsLoading, setEmpPaySettingsLoading] = useState(false);
  const [payrollRecords, setPayrollRecords] = useState<PayrollRecord[]>([]);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [payrollMonthFilter, setPayrollMonthFilter] = useState('');
  const [payrollTypeFilter, setPayrollTypeFilter] = useState<'ALL' | 'TEACHER' | 'STAFF'>('ALL');
  const [payrollStatusFilter, setPayrollStatusFilter] = useState<string>('ALL');
  const [showCreatePayrollModal, setShowCreatePayrollModal] = useState(false);
  const [payrollEmpType, setPayrollEmpType] = useState<'TEACHER' | 'STAFF'>('TEACHER');
  const [payrollSelectedEmpId, setPayrollSelectedEmpId] = useState('');
  const [payrollCustomName, setPayrollCustomName] = useState('');
  const [payrollCustomRole, setPayrollCustomRole] = useState('');
  const [payrollCustomPhone, setPayrollCustomPhone] = useState('');
  const [payrollCustomEmpId, setPayrollCustomEmpId] = useState('');
  const [payrollBaseSalary, setPayrollBaseSalary] = useState('');
  const [payrollAllowances, setPayrollAllowances] = useState('0');
  const [payrollDeductions, setPayrollDeductions] = useState('0');
  const [payrollNotes, setPayrollNotes] = useState('');
  const [payrollPayoutMonth, setPayrollPayoutMonth] = useState(new Date().toISOString().substring(0, 7)); // e.g. '2026-06'
  const [isSubmittingPayroll, setIsSubmittingPayroll] = useState(false);
  const [showPayrollDisburseModal, setShowPayrollDisburseModal] = useState(false);
  const [selectedPayrollRecord, setSelectedPayrollRecord] = useState<PayrollRecord | null>(null);
  const [payrollDisburseNotes, setPayrollDisburseNotes] = useState('');
  const [transportSubTab, setTransportSubTab] = useState<'fleet' | 'staff' | 'financials'>(
    session?.user.role === 'FINANCE_ADMIN' ? 'financials' : 'fleet'
  );
  const [disbursingDriverId, setDisbursingDriverId] = useState<string | null>(null);

  // Hostel Module state variables
  const [hostels, setHostels] = useState<any[]>([]);
  const [hostelBlocks, setHostelBlocks] = useState<any[]>([]);
  const [hostelRooms, setHostelRooms] = useState<any[]>([]);
  const [hostelBeds, setHostelBeds] = useState<any[]>([]);
  const [hostelWardens, setHostelWardens] = useState<any[]>([]);
  const [hostelAdmissions, setHostelAdmissions] = useState<any[]>([]);
  const [hostelAttendance, setHostelAttendance] = useState<any[]>([]);
  const [hostelFees, setHostelFees] = useState<any[]>([]);
  const [hostelPayments, setHostelPayments] = useState<any[]>([]);
  const [hostelLeaveRequests, setHostelLeaveRequests] = useState<any[]>([]);
  const [hostelVisitors, setHostelVisitors] = useState<any[]>([]);
  const [hostelComplaints, setHostelComplaints] = useState<any[]>([]);
  const [hostelMessMenus, setHostelMessMenus] = useState<any[]>([]);

  // Hostel Tab Selection derived from rawActiveTab
  const activeTabParts = rawActiveTab.split('/');
  const derivedSubTab = activeTabParts[1] || '';
  const isWarden = session?.user.role === 'WARDEN';
  const defaultSubTab = isWarden ? 'attendance' : 'structures';
  const hostelSubTab = activeTab === 'hostel' ? (derivedSubTab || defaultSubTab) : '';

  const setHostelSubTab = (subTab: string) => {
    window.location.hash = `hostel/${subTab}`;
  };

  useEffect(() => {
    if (activeTab === 'hostel' && !rawActiveTab.includes('/')) {
      const isWarden = session?.user.role === 'WARDEN';
      const defaultSubTab = isWarden ? 'attendance' : 'structures';
      window.location.hash = `hostel/${defaultSubTab}`;
    }
  }, [activeTab, rawActiveTab, session?.user.role]);
  useEffect(() => {
    if (hostelSubTab) {
      loadData();
    }
  }, [hostelSubTab]);
  // Hostel Form Inputs
  const [hName, setHName] = useState('');
  const [hType, setHType] = useState<'BOYS' | 'GIRLS' | 'MIXED'>('MIXED');
  const [hStatus, setHStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  
  const [hbHostelId, setHbHostelId] = useState('');
  const [hbName, setHbName] = useState('');
  
  const [hrBlockId, setHrBlockId] = useState('');
  const [hrFloor, setHrFloor] = useState(1);
  const [hrRoomNumber, setHrRoomNumber] = useState('');
  const [hrCapacity, setHrCapacity] = useState(2);
  
  const [hbedRoomId, setHbedRoomId] = useState('');
  const [hbedName, setHbedName] = useState('');
  
  const [editWardenId, setEditWardenId] = useState<string | null>(null);

  // Warden Creation Form States
  const [wFirstName, setWFirstName] = useState('');
  const [wLastName, setWLastName] = useState('');
  const [wEmail, setWEmail] = useState('');
  const [wPhone, setWPhone] = useState('');
  const [wEmployeeId, setWEmployeeId] = useState('');
  const [wGender, setWGender] = useState('MALE');
  const [wAddress, setWAddress] = useState('');
  const [wUsername, setWUsername] = useState('');
  const [wPassword, setWPassword] = useState('');
  const [wIsActive, setWIsActive] = useState(true);
  const [wAssignedLocations, setWAssignedLocations] = useState<any[]>([]);
  const [wDesignation, setWDesignation] = useState('');
  const [wJoiningDate, setWJoiningDate] = useState(new Date().toISOString().split('T')[0]);

  // Assigned Locations Selector States
  const [wlHostelId, setWlHostelId] = useState('');
  const [wlBlockId, setWlBlockId] = useState('');
  const [wlFloor, setWlFloor] = useState<number | ''>('');
  const [wlSection, setWlSection] = useState('');
  
  const [hadmStudentId, setHadmStudentId] = useState('');
  const [hadmHostelId, setHadmHostelId] = useState('');
  const [hadmRoomId, setHadmRoomId] = useState('');
  const [hadmBedId, setHadmBedId] = useState('');
  const [hadmAdmissionDate, setHadmAdmissionDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [hvisName, setHvisName] = useState('');
  const [hvisRelation, setHvisRelation] = useState('');
  const [hvisStudentId, setHvisStudentId] = useState('');
  const [hvisPurpose, setHvisPurpose] = useState('');
  
  const [hfeeName, setHfeeName] = useState('');
  const [hfeeAmount, setHfeeAmount] = useState(0);
  const [hfeeType, setHfeeType] = useState<'MONTHLY' | 'ANNUAL' | 'ONE_TIME' | 'MESS'>('MONTHLY');
  const [hfeeDesc, setHfeeDesc] = useState('');
  
  const [hpayStudentId, setHpayStudentId] = useState('');
  const [hpayFeeId, setHpayFeeId] = useState('');
  const [hpayAmount, setHpayAmount] = useState(0);
  const [hpayMethod, setHpayMethod] = useState<'CASH' | 'CARD' | 'ONLINE' | 'BANK_TRANSFER'>('CASH');
  const [hpayTxId, setHpayTxId] = useState('');
  
  const [hmessHostelId, setHmessHostelId] = useState('');
  const [hmessDay, setHmessDay] = useState(1);
  const [hmessBreakfast, setHmessBreakfast] = useState('');
  const [hmessLunch, setHmessLunch] = useState('');
  const [hmessDinner, setHmessDinner] = useState('');
  const [hmessSpecial, setHmessSpecial] = useState('');

  // Warden specific attendance logger state
  const [attSelectedRoomId, setAttSelectedRoomId] = useState('');
  const [attSelectedSlot, setAttSelectedSlot] = useState<'MORNING' | 'EVENING'>('MORNING');
  const [attSelectedDate, setAttSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [attStatusMap, setAttStatusMap] = useState<Record<string, 'PRESENT' | 'ABSENT' | 'LEAVE'>>({});


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

  const [commToast, setCommToast] = useState<{
    show: boolean;
    message: string;
    type: 'success' | 'error' | 'info';
  }>({ show: false, message: '', type: 'success' });
  const commToastTimeoutRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (commToastTimeoutRef.current) {
        clearTimeout(commToastTimeoutRef.current);
      }
    };
  }, []);

  const [broadcastRole, setBroadcastRole] = useState('STUDENT');
  const [broadcastCategory, setBroadcastCategory] = useState('Announcement');
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastContent, setBroadcastContent] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);

  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle.trim() || !broadcastContent.trim() || broadcastSending) return;

    setBroadcastSending(true);
    try {
      const targetType = broadcastRole === 'all' ? 'school' : 'role';
      const targetValue = broadcastRole === 'all' ? '' : broadcastRole;

      const res = await fetch('/api/send-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolId: session?.user?.schoolId || 'school-1',
          targetType,
          targetValue,
          title: broadcastTitle,
          content: broadcastContent,
          type: broadcastCategory
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to dispatch broadcast');
      }

      if (commToastTimeoutRef.current) {
        clearTimeout(commToastTimeoutRef.current);
      }
      setCommToast({
        show: true,
        message: `Broadcast successfully sent to ${data.insertedCount || 0} active users!`,
        type: 'success'
      });
      commToastTimeoutRef.current = setTimeout(() => {
        setCommToast(prev => ({ ...prev, show: false }));
        commToastTimeoutRef.current = null;
      }, 5000);

      setBroadcastTitle('');
      setBroadcastContent('');

      const newLog = {
        id: Math.random().toString(),
        type: 'PUSH',
        recipient: broadcastRole === 'all' ? 'Entire School' : `Role: ${broadcastRole}`,
        template: 'BROADCAST ALERT',
        status: 'DELIVERED',
        timestamp: new Date().toISOString(),
        rate: '100%'
      };
      setCommLogs(prev => [newLog, ...prev]);

    } catch (err: any) {
      if (commToastTimeoutRef.current) {
        clearTimeout(commToastTimeoutRef.current);
      }
      setCommToast({
        show: true,
        message: err.message || 'Error sending broadcast.',
        type: 'error'
      });
      commToastTimeoutRef.current = setTimeout(() => {
        setCommToast(prev => ({ ...prev, show: false }));
        commToastTimeoutRef.current = null;
      }, 5000);
    } finally {
      setBroadcastSending(false);
    }
  };

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
  const [analyticsSessionId, setAnalyticsSessionId] = useState(() => localStorage.getItem('aegis_analytics_session_id') || 'all');
  const [analyticsClassId, setAnalyticsClassId] = useState(() => localStorage.getItem('aegis_analytics_class_id') || 'all');
  const [analyticsSubjectId, setAnalyticsSubjectId] = useState(() => localStorage.getItem('aegis_analytics_subject_id') || 'all');
  const [analyticsTeacherId, setAnalyticsTeacherId] = useState(() => localStorage.getItem('aegis_analytics_teacher_id') || 'all');
  const [showInvoicePdf, setShowInvoicePdf] = useState<any | null>(null);
  const [showReportCardPdf, setShowReportCardPdf] = useState<any | null>(null);

  // ── Branding & Signature Upload States ───────────────
  const [logoUploading, setLogoUploading] = useState(false);
  const [sealUploading, setSealUploading] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [adminSignatureUrl, setAdminSignatureUrl] = useState<string>('');


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
  const [bcDesc, setBcDesc] = useState('');

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

  // Subject Edit & Delete States
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editSubName, setEditSubName] = useState('');
  const [editSubCode, setEditSubCode] = useState('');
  const [editSubDesc, setEditSubDesc] = useState('');

  // Class Settings States
  const [selectedSettingsClassId, setSelectedSettingsClassId] = useState<string>('');
  const [showChangeCtModal, setShowChangeCtModal] = useState<boolean>(false);
  const [changeCtClassId, setChangeCtClassId] = useState<string>('');
  const [changeCtTeacherId, setChangeCtTeacherId] = useState<string>('');

  // Books Edit State
  const [editingBook, setEditingBook] = useState<any | null>(null);
  const [editBkTitle, setEditBkTitle] = useState('');
  const [editBkAuthor, setEditBkAuthor] = useState('');
  const [editBkIsbn, setEditBkIsbn] = useState('');
  const [editBkSubject, setEditBkSubject] = useState('');
  const [editBkCopies, setEditBkCopies] = useState(5);

  // Categories Edit State
  const [editingBookCategory, setEditingBookCategory] = useState<any | null>(null);
  const [editBcName, setEditBcName] = useState('');
  const [editBcCode, setEditBcCode] = useState('');
  const [editBcDesc, setEditBcDesc] = useState('');

  // Book Issues Edit State
  const [editingBookIssue, setEditingBookIssue] = useState<any | null>(null);
  const [editBiDueDate, setEditBiDueDate] = useState('');
  const [editBiFineAmount, setEditBiFineAmount] = useState(0);
  const [editBiStatus, setEditBiStatus] = useState('ISSUED');
  const [editBiReturnDate, setEditBiReturnDate] = useState('');

  // Digital Library Edit State
  const [editingDigitalAsset, setEditingDigitalAsset] = useState<any | null>(null);
  const [editDaTitle, setEditDaTitle] = useState('');
  const [editDaAuthor, setEditDaAuthor] = useState('');
  const [editDaType, setEditDaType] = useState('pdf');
  const [editDaUrl, setEditDaUrl] = useState('');

  // Transport Assignments Edit State
  const [editingTransportAssignment, setEditingTransportAssignment] = useState<any | null>(null);
  const [editTaBusId, setEditTaBusId] = useState('');
  const [editTaRouteId, setEditTaRouteId] = useState('');
  const [editTaPickupPointId, setEditTaPickupPointId] = useState('');

  // Exams Edit State
  const [editingExam, setEditingExam] = useState<any | null>(null);
  const [editExName, setEditExName] = useState('');
  const [editExTerm, setEditExTerm] = useState('TERM 1');
  const [editExStart, setEditExStart] = useState('');
  const [editExEnd, setEditExEnd] = useState('');

  // Criteria Edit State
  const [editingExamSubject, setEditingExamSubject] = useState<any | null>(null);
  const [editEsMax, setEditEsMax] = useState(100);
  const [editEsPass, setEditEsPass] = useState(40);

  // Report Cards Edit State
  const [editingReportCard, setEditingReportCard] = useState<any | null>(null);
  const [editRcTerm, setEditRcTerm] = useState('TERM 1');
  const [editRcAttendance, setEditRcAttendance] = useState(90);
  const [editRcGpa, setEditRcGpa] = useState(0);
  const [editRcRemarks, setEditRcRemarks] = useState('');
  const [reportCards, setReportCards] = useState<any[]>([]);

  // Realtime Attendance Dashboard States
  const [attendanceSectionId, setAttendanceSectionId] = useState('');
  const [attendanceSessionId, setAttendanceSessionId] = useState('');
  const [attendanceAnalytics, setAttendanceAnalytics] = useState<any>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [activeAttendanceSubTab, setActiveAttendanceSubTab] = useState<'analytics' | 'register'>('analytics');
  const [selectedAttendanceStudent, setSelectedAttendanceStudent] = useState<any | null>(null);

  // ── RBAC Dynamic Permission states ───────────────────
  const rbacModules = [
    { key: 'academics', label: 'Academics & Classes Setup' },
    { key: 'directory', label: 'Directory Management (Students/Teachers/Parents)' },
    { key: 'grading', label: 'Grading, Exams & Marks Manager' },
    { key: 'billing', label: 'Billing, Invoices & Driver Ledger' },
    { key: 'books', label: 'Library Catalog Management' },
    { key: 'transport', label: 'Transport Vehicles & Routes' },
    { key: 'hostel', label: 'Hostel & Mess Management' },
    { key: 'security', label: 'System Audits & Backup Panels' }
  ];

  const [rbacPermissions, setRbacPermissions] = useState<Record<string, Record<string, boolean>>>({
    ADMIN: { billing: false, directory: true, academics: true, grading: true, security: true, books: true, transport: true, hostel: true },
    FINANCE_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
    ACADEMIC_ADMIN: { billing: false, directory: true, academics: true, grading: true, security: false, books: true, transport: true, hostel: false },
    EXAM_CONTROLLER: { billing: false, directory: false, academics: true, grading: true, security: false, books: false, transport: false, hostel: false },
    LIBRARIAN: { billing: false, directory: false, academics: true, grading: false, security: false, books: true, transport: false, hostel: false },
    TRANSPORT_MANAGER: { billing: true, directory: false, academics: false, grading: false, security: false, books: false, transport: true, hostel: false },
    HOSTEL_ADMIN: { billing: false, directory: false, academics: false, grading: false, security: false, books: false, transport: false, hostel: true },
    CUSTOM_SUB_ADMIN: { billing: true, directory: true, academics: false, grading: false, security: false, books: false, transport: false, hostel: false }
  });
  const [rbacLoading, setRbacLoading] = useState(false);
  const [showAddSubAdmin, setShowAddSubAdmin] = useState(false);
  const [saEmail, setSaEmail] = useState('');
  const [saFirst, setSaFirst] = useState('');
  const [saLast, setSaLast] = useState('');
  const [saPhone, setSaPhone] = useState('');
  const [saRole, setSaRole] = useState<'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'HOSTEL_ADMIN' | 'WARDEN' | 'SPORTS_ADMIN'>('FINANCE_ADMIN');
  const [saPassword, setSaPassword] = useState('password');
  const [saEmployeeId, setSaEmployeeId] = useState('');

  // Editing Sub-Admin States
  const [showEditSubAdmin, setShowEditSubAdmin] = useState<any | null>(null);
  const [editEmail, setEditEmail] = useState('');
  const [editFirst, setEditFirst] = useState('');
  const [editLast, setEditLast] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editRole, setEditRole] = useState<'FINANCE_ADMIN' | 'ACADEMIC_ADMIN' | 'EXAM_CONTROLLER' | 'LIBRARIAN' | 'TRANSPORT_MANAGER' | 'CUSTOM_SUB_ADMIN' | 'HOSTEL_ADMIN' | 'WARDEN' | 'SPORTS_ADMIN'>('FINANCE_ADMIN');
  const [editEmployeeId, setEditEmployeeId] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Extended RBAC sub-admin operator states
  const [operators, setOperators] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [operatorsSearch, setOperatorsSearch] = useState('');
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState('all');
  const [expandedAuditLogId, setExpandedAuditLogId] = useState<string | null>(null);

  const subAdminRoleDetails: Record<string, { name: string; description: string; permissions: string[] }> = {
    FINANCE_ADMIN: {
      name: 'Finance Admin',
      description: 'Responsible for billing, invoices, payment structures, and fee tracking.',
      permissions: ['billing', 'directory', 'transport']
    },
    ACADEMIC_ADMIN: {
      name: 'Academic Admin',
      description: 'Manages classes, sections, timetables, subjects, and study structures.',
      permissions: ['directory', 'academics', 'grading', 'books', 'transport']
    },
    EXAM_CONTROLLER: {
      name: 'Exam Controller',
      description: 'Administers examinations, quiz configurations, marksheets, and grading books.',
      permissions: ['directory', 'academics', 'grading']
    },
    LIBRARIAN: {
      name: 'Librarian',
      description: 'Manages library book inventory, issue/return logs, and late fee tracking.',
      permissions: ['directory', 'academics', 'books']
    },
    TRANSPORT_MANAGER: {
      name: 'Transport Manager',
      description: 'Administers school buses, routes, driver information, and passenger maps.',
      permissions: ['billing', 'directory', 'transport']
    },
    HOSTEL_ADMIN: {
      name: 'Hostel Admin',
      description: 'Responsible for hostels, blocks, floors, rooms, beds, admissions, leave requests, visitor logs, complaints, and mess menus.',
      permissions: ['hostel']
    },
    WARDEN: {
      name: 'Hostel Warden',
      description: 'Responsible for daily hostel operations, attendance logging, and initial leave requests.',
      permissions: ['hostel']
    },
    CUSTOM_SUB_ADMIN: {
      name: 'Custom Operator',
      description: 'Customizable operator role with custom-assigned modular access tags.',
      permissions: ['billing', 'directory']
    },
    SPORTS_ADMIN: {
      name: 'Sports Admin',
      description: 'Responsible for managing sports schedules, teams, matches, coach attendances, and sports-module finances.',
      permissions: ['billing', 'directory']
    }
  };

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
    if (commToastTimeoutRef.current) {
      clearTimeout(commToastTimeoutRef.current);
    }
    setCommToast({
      show: true,
      message: `Test ${newLog.type} Alert dispatched successfully via ${newLog.type === 'SMS' ? 'Twilio Gateway' : 'Resend SMTP Gateway'}!`,
      type: 'success'
    });
    commToastTimeoutRef.current = setTimeout(() => {
      setCommToast(prev => ({ ...prev, show: false }));
      commToastTimeoutRef.current = null;
    }, 5000);
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
    if (currentPlanName !== 'pro' && currentPlanName !== 'enterprise') {
      alert('Security Policy Alert: Registering sub-admin operators requires an active Pro or Enterprise subscription plan. Please upgrade your institution.');
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
      // Reload operator directories and staff registries
      await loadData();
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
      
      // Reload operator directories and staff registries
      await loadData();
      alert('Sub-admin operator details updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error updating sub-admin');
    } finally {
      setRbacLoading(false);
    }
  };

  const getFilteredClassIds = () => {
    if (analyticsSection === 'all') {
      return classes.map(c => c.id);
    }
    if (analyticsSection === '10a') {
      const c10 = classes.find(c => c.name.toLowerCase().includes('10-a') || c.name.toLowerCase().includes('10a') || c.id === 'c-10a');
      return c10 ? [c10.id] : [];
    }
    if (analyticsSection === '11b') {
      const c11 = classes.find(c => c.name.toLowerCase().includes('11-b') || c.name.toLowerCase().includes('11b') || c.id === 'c-11b');
      return c11 ? [c11.id] : [];
    }
    return [];
  };

  const filterByDateRange = (dateStr?: string) => {
    if (!dateStr) return false;
    if (analyticsDateRange === 'session') return true;
    const date = new Date(dateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (analyticsDateRange === '30d') return diffDays <= 30;
    if (analyticsDateRange === '90d') return diffDays <= 90;
    return true;
  };

  const getAttendanceStats = () => {
    const c10 = classes.find(c => c.name.toLowerCase().includes('10-a') || c.name.toLowerCase().includes('10a') || c.id === 'c-10a');
    const c11 = classes.find(c => c.name.toLowerCase().includes('11-b') || c.name.toLowerCase().includes('11b') || c.id === 'c-11b');

    const filteredAttendance = attendanceList.filter(a => filterByDateRange(a.date));
    
    if (filteredAttendance.length === 0) return null;

    const getPercentageForClass = (classId?: string) => {
      const records = classId 
        ? filteredAttendance.filter(a => a.classId === classId)
        : filteredAttendance;
      if (records.length === 0) return 0;
      const present = records.filter(a => a.status !== 'ABSENT').length;
      return (present / records.length) * 100;
    };

    const g10Val = c10 ? getPercentageForClass(c10.id) : 0;
    const g11Val = c11 ? getPercentageForClass(c11.id) : 0;
    const sysVal = getPercentageForClass();

    return {
      g10: g10Val,
      g11: g11Val,
      system: sysVal,
      avg: sysVal
    };
  };

  const getFeeStats = () => {
    const classIds = getFilteredClassIds();
    const filteredStudents = students.filter(s => s.classId && classIds.includes(s.classId));
    const studentIds = filteredStudents.map(s => s.id);

    // 1. Regular School Fees
    const filteredStructures = feeStructures.filter(fs => classIds.includes(fs.classId));
    const structureIds = filteredStructures.map(fs => fs.id);
    const filteredPayments = feePayments.filter(p => structureIds.includes(p.feeStructureId) && filterByDateRange(p.createdAt || p.paymentDate));

    let regularCollected = 0;
    let regularPending = 0;
    
    filteredPayments.forEach(p => {
      if (p.status === 'PAID') {
        regularCollected += p.amountPaid;
      } else {
        const struct = feeStructures.find(fs => fs.id === p.feeStructureId);
        regularPending += struct ? struct.amount : 0;
      }
    });

    // 2. Transport Fees
    const filteredTransport = transportFeeRecords.filter(t => studentIds.includes(t.studentId) && filterByDateRange(t.createdAt));
    let transportCollected = 0;
    let transportPending = 0;
    
    filteredTransport.forEach(t => {
      if (t.status === 'PAID') {
        transportCollected += t.amount;
      } else {
        transportPending += t.amount;
      }
    });

    // 3. Hostel Fees
    const filteredHostelPayments = hostelPayments.filter(p => studentIds.includes(p.studentId) && filterByDateRange(p.createdAt || p.paymentDate));
    let hostelCollected = 0;
    let hostelPending = 0;

    filteredHostelPayments.forEach(p => {
      if (p.status === 'PAID') {
        hostelCollected += p.amountPaid;
      } else {
        const fee = hostelFees.find(f => f.id === p.feeId);
        hostelPending += fee ? (fee.amount - p.amountPaid) : 0;
      }
    });

    const totalCollected = regularCollected + transportCollected + hostelCollected;
    const totalPending = regularPending + transportPending + hostelPending;
    const totalRaised = totalCollected + totalPending;
    const collectionPct = totalRaised > 0 ? (totalCollected / totalRaised) * 100 : 0;

    if (totalRaised === 0) return null;

    return {
      collected: totalCollected,
      pending: totalPending,
      raised: totalRaised,
      percentage: collectionPct
    };
  };

  const getHomeworkStats = () => {
    const classIds = getFilteredClassIds();

    const filteredAssignments = assignments.filter(a => classIds.includes(a.classId) && filterByDateRange(a.createdAt));

    if (filteredAssignments.length === 0) return null;

    const statsMap = new Map<string, { totalPossible: number; completed: number; late: number }>();

    filteredAssignments.forEach(a => {
      const classStudents = students.filter(s => s.classId === a.classId);
      const subject = subjects.find(s => s.id === a.subjectId);
      const subName = subject?.name || 'General';

      if (!statsMap.has(subName)) {
        statsMap.set(subName, { totalPossible: 0, completed: 0, late: 0 });
      }
      const val = statsMap.get(subName)!;
      val.totalPossible += classStudents.length;

      const subs = assignmentSubmissions.filter(s => s.assignmentId === a.id);
      val.completed += subs.length;
      
      subs.forEach(s => {
        const isLate = s.submissionText?.toLowerCase().includes('late') || (s as any).submission_status === 'LATE' || (s.submittedAt && a.dueDate && new Date(s.submittedAt) > new Date(a.dueDate));
        if (isLate) {
          val.late++;
        }
      });
    });

    const subjectStats: { subjectName: string; completedPct: number; pendingPct: number; latePct: number }[] = [];
    statsMap.forEach((val, subName) => {
      if (val.totalPossible > 0) {
        const completedPct = (val.completed / val.totalPossible) * 100;
        const pendingPct = ((val.totalPossible - val.completed) / val.totalPossible) * 100;
        const latePct = (val.late / val.totalPossible) * 100;
        subjectStats.push({
          subjectName: subName,
          completedPct,
          pendingPct,
          latePct
        });
      }
    });

    return subjectStats;
  };

  const getGradeStats = () => {
    const classIds = getFilteredClassIds();
    const filteredStudents = students.filter(s => s.classId && classIds.includes(s.classId));
    const studentIds = filteredStudents.map(s => s.id);

    const filteredMarks = studentMarks.filter(m => studentIds.includes(m.studentId));

    if (filteredMarks.length === 0) return null;

    const statsMap = new Map<string, { sum: number; count: number }>();

    filteredMarks.forEach(m => {
      const subject = subjects.find(s => s.id === m.subjectId);
      const subCode = subject?.code || 'GEN';
      if (!statsMap.has(subCode)) {
        statsMap.set(subCode, { sum: 0, count: 0 });
      }
      const val = statsMap.get(subCode)!;
      val.sum += m.marksObtained;
      val.count++;
    });

    const stats: { subjectCode: string; average: number }[] = [];
    statsMap.forEach((val, subCode) => {
      stats.push({
        subjectCode: subCode,
        average: val.sum / val.count
      });
    });

    return stats;
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
  const [stFatherName, setStFatherName] = useState('');
  const [stMotherName, setStMotherName] = useState('');
  // Photo upload state for student registration
  const [stPhotoFile, setStPhotoFile] = useState<File | null>(null);
  const [stPhotoPreview, setStPhotoPreview] = useState<string | null>(null);
  const [stPhotoDragging, setStPhotoDragging] = useState(false);
  const [stPhotoUploading, setStPhotoUploading] = useState(false);
  const stPhotoInputRef = useRef<HTMLInputElement>(null);

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

  const loadSchoolPaymentSettings = async () => {
    setPaySettingsLoading(true);
    try {
      const s = await mockApi.fetchSchoolPaymentSettings(session?.user.schoolId || '', session?.user.role || '');
      if (s) {
        setSchoolPaySettings(s);
        setPsAccHolder(s.accountHolderName || '');
        setPsBankName(s.bankName || '');
        setPsAccNumber(s.accountNumber || '');
        setPsIfsc(s.ifscCode || '');
        setPsBranch(s.branchName || '');
        setPsSwift(s.swiftCode || '');
        setPsUpiId(s.upiId || '');
        setPsInstructions(s.paymentInstructions || '');
        setPsQrEnabled(s.qrPaymentEnabled);
        setPsBankEnabled(s.bankTransferEnabled);
        setPsShowQrToParents(s.showQrToParents);
        setPsShowBankToParents(s.showBankToParents);
        setPsUtrUpload(s.enableUtrUpload);
        setPsAutoRemind(s.autoRemindUnpaid);
        if (s.qrCodeUrl) setPsQrPreview(s.qrCodeUrl);
      }
    } catch (e) {
      console.warn(e);
    }
    setPaySettingsLoading(false);
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

  const handleUploadLogo = async (file: File) => {
    if (!session?.user.schoolId || !session?.user.id) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }
    try {
      setLogoUploading(true);
      await mockApi.uploadSchoolAsset(session.user.schoolId, 'logo', file, session.user.id);
      await loadData();
      alert('School logo uploaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to upload school logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!session?.user.schoolId || !session?.user.id) return;
    if (!window.confirm('Are you sure you want to remove the school logo?')) return;
    try {
      setLogoUploading(true);
      await mockApi.removeSchoolAsset(session.user.schoolId, 'logo', session.user.id);
      await loadData();
      alert('School logo removed successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to remove school logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleUploadSeal = async (file: File) => {
    if (!session?.user.schoolId || !session?.user.id) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }
    try {
      setSealUploading(true);
      await mockApi.uploadSchoolAsset(session.user.schoolId, 'seal', file, session.user.id);
      await loadData();
      alert('School seal uploaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to upload school seal');
    } finally {
      setSealUploading(false);
    }
  };

  const handleRemoveSeal = async () => {
    if (!session?.user.schoolId || !session?.user.id) return;
    if (!window.confirm('Are you sure you want to remove the school seal?')) return;
    try {
      setSealUploading(true);
      await mockApi.removeSchoolAsset(session.user.schoolId, 'seal', session.user.id);
      await loadData();
      alert('School seal removed successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to remove school seal');
    } finally {
      setSealUploading(false);
    }
  };

  const handleUploadSignature = async (file: File) => {
    if (!session?.user.id) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }
    try {
      setSignatureUploading(true);
      await mockApi.uploadAdminSignature(session.user.id, file, session.user.id);
      await loadData();
      alert('Principal signature uploaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to upload signature');
    } finally {
      setSignatureUploading(false);
    }
  };

  const handleRemoveSignature = async () => {
    if (!session?.user.id) return;
    if (!window.confirm('Are you sure you want to remove your signature?')) return;
    try {
      setSignatureUploading(true);
      await mockApi.removeAdminSignature(session.user.id, session.user.id);
      await loadData();
      alert('Principal signature removed successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to remove signature');
    } finally {
      setSignatureUploading(false);
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
      setStudents(Array.from(new Map((st || []).map((s: any) => [s.id, s])).values()));
      setTeachers(Array.from(new Map((tc || []).map((t: any) => [t.id, t])).values()));
      setParents(Array.from(new Map((pr || []).map((p: any) => [p.id, p])).values()));
      setClasses(Array.from(new Map((cls || []).map((c: any) => [c.id, c])).values()));
      setSubjects(Array.from(new Map((sub || []).map((s: any) => [s.id, s])).values()));
      setFeeStructures(Array.from(new Map((fees || []).map((f: any) => [f.id, f])).values()));
      setFeePayments(Array.from(new Map((pays || []).map((p: any) => [p.id, p])).values()));
      loadAcademicSessions();

      if (session?.user.id) {
        try {
          const { data: adminRow } = await supabase
            .from('school_admins')
            .select('signature_url')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (adminRow?.signature_url) {
            setAdminSignatureUrl(adminRow.signature_url);
          } else {
            setAdminSignatureUrl('');
          }
        } catch (err) {
          console.error('Failed to load admin signature:', err);
        }
      }

      // Load RBAC dynamic permissions, operators, and audit logs from Supabase
      if (session?.user.schoolId) {
        try {
          const [
            perms, ops, logs, inv, rc, dr, pk, da,
            busList, routeList, assignmentList, maintList, drAttList, tfrList,
            categoryList, issueList, fineList, exList, exResList, qResList,
            marksList, examSubList, payoutList, booksList, payrollList,
            hList, hbList, hrList, hbedList, hwList, hadmList, hattList, hfeeList, hpayList, hleaveList, hvisList, hcompList, hmenuList
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
            mockApi.fetchTransportFeeRecords(session.user.schoolId),
            mockApi.fetchBookCategories(session.user.schoolId),
            mockApi.fetchBookIssues(session.user.schoolId),
            mockApi.fetchLibraryFines(session.user.schoolId),
            mockApi.fetchExams(session.user.schoolId),
            mockApi.fetchExamResults(session.user.schoolId),
            mockApi.fetchQuizResults(session.user.schoolId),
            mockApi.fetchAllStudentMarks(session.user.schoolId),
            mockApi.fetchAllExamSubjects(session.user.schoolId),
            mockApi.fetchDriverSalaryPayouts(session.user.schoolId),
            mockApi.fetchBookInventory(session.user.schoolId),
            mockApi.fetchPayrollRecords(session.user.schoolId),
            mockApi.fetchHostels(session.user.schoolId),
            mockApi.fetchHostelBlocks(session.user.schoolId),
            mockApi.fetchHostelRooms(session.user.schoolId),
            mockApi.fetchHostelBeds(session.user.schoolId),
            mockApi.fetchHostelWardens(session.user.schoolId),
            mockApi.fetchHostelAdmissions(session.user.schoolId),
            mockApi.fetchHostelAttendance(session.user.schoolId),
            mockApi.fetchHostelFees(session.user.schoolId),
            mockApi.fetchHostelPayments(session.user.schoolId),
            mockApi.fetchHostelLeaveRequests(session.user.schoolId),
            mockApi.fetchHostelVisitors(session.user.schoolId),
            mockApi.fetchHostelComplaints(session.user.schoolId),
            mockApi.fetchHostelMessMenus(session.user.schoolId)
          ]);

          const uniqueOps = Array.from(new Map((ops || []).map((o: any) => [o.id, o])).values());
          const uniqueLogs = Array.from(new Map((logs || []).map((l: any) => [l.id, l])).values());
          const uniqueInv = Array.from(new Map((inv || []).map((i: any) => [i.id, i])).values());
          const uniqueRc = Array.from(new Map((rc || []).map((r: any) => [r.id, r])).values());
          const uniqueDr = Array.from(new Map((dr || []).map((d: any) => [d.id, d])).values());
          const uniquePk = Array.from(new Map((pk || []).map((p: any) => [p.id, p])).values());
          const uniqueDa = Array.from(new Map((da || []).map((d: any) => [d.id, d])).values());
          
          const uniqueBuses = Array.from(new Map((busList || []).map((b: any) => [b.id, b])).values());
          const uniqueRoutes = Array.from(new Map((routeList || []).map((r: any) => [r.id, r])).values());
          const uniqueAssignments = Array.from(new Map((assignmentList || []).map((a: any) => [a.id, a])).values());
          const uniqueMaint = Array.from(new Map((maintList || []).map((m: any) => [m.id, m])).values());
          const uniqueDrAtt = Array.from(new Map((drAttList || []).map((da: any) => [da.id, da])).values());
          const uniquePayouts = Array.from(new Map((payoutList || []).map((p: any) => [p.id, p])).values());
          const uniquePayroll = Array.from(new Map((payrollList || []).map((p: any) => [p.id, p])).values());
          const uniqueTfr = Array.from(new Map((tfrList || []).map((t: any) => [t.id, t])).values());
          
          const uniqueCategories = Array.from(new Map((categoryList || []).map((c: any) => [c.id, c])).values());
          const uniqueIssues = Array.from(new Map((issueList || []).map((i: any) => [i.id, i])).values());
          const uniqueFines = Array.from(new Map((fineList || []).map((f: any) => [f.id, f])).values());
          
          const uniqueExams = Array.from(new Map((exList || []).map((e: any) => [e.id, e])).values());
          const uniqueExamResults = Array.from(new Map((exResList || []).map((er: any) => [er.id, er])).values());
          const uniqueQuizResults = Array.from(new Map((qResList || []).map((qr: any) => [qr.id, qr])).values());
          const uniqueMarks = Array.from(new Map((marksList || []).map((m: any) => [m.id, m])).values());
          const uniqueExamSubjects = Array.from(new Map((examSubList || []).map((es: any) => [es.id, es])).values());
          const uniqueBooks = Array.from(new Map((booksList || []).map((b: any) => [b.id, b])).values());

          setRbacPermissions(perms);
          setOperators(uniqueOps);
          setAuditLogs(uniqueLogs);
          setInvoicesCount(uniqueInv.length);
          setInvoicesAmount(uniqueInv.reduce((sum, i) => sum + Number(i.amount || 0), 0));
          setReportCardsCount(uniqueRc.length);
          setReportCards(uniqueRc);
          setDriversCount(uniqueDr.length);
          setPickupPointsCount(uniquePk.length);
          setDigitalAssetsCount(uniqueDa.length);
          setDriversList(uniqueDr);
          setPickupPointsList(uniquePk);
          setDigitalAssetsList(uniqueDa);
          setBuses(uniqueBuses);
          setRoutes(uniqueRoutes);
          setTransportAssignments(uniqueAssignments);
          setMaintenanceLogs(uniqueMaint);
          setDriverAttendanceList(uniqueDrAtt);
          setDriverSalaryPayouts(uniquePayouts);
          setPayrollRecords(uniquePayroll);
          setTransportFeeRecords(uniqueTfr);
          setBookCategories(uniqueCategories);
          setBookIssues(uniqueIssues);
          setLibraryFines(uniqueFines);
          setExamsList(uniqueExams);
          setExamResults(uniqueExamResults);
          setQuizResults(uniqueQuizResults);
          setStudentMarks(uniqueMarks);
          setExamSubjects(uniqueExamSubjects);
          setBooks(uniqueBooks);

          // Sync student attendance, homeworks, homework submissions, and quizzes in background/parallel
          await Promise.all([
            mockApi.syncAttendanceData(session.user.schoolId),
            mockApi.syncAssignmentsData(session.user.schoolId),
            mockApi.syncAssignmentSubmissionsData(session.user.schoolId),
            mockApi.syncQuizzesData(session.user.schoolId)
          ]);

          const schoolStudentIds = mockDb.students.filter(s => s.schoolId === session.user.schoolId).map(s => s.id);
          const localAttendance = mockDb.attendance.filter(a => schoolStudentIds.includes(a.studentId));
          const uniqueAttendance = Array.from(new Map(localAttendance.map((a: any) => [a.id, a])).values());
          setAttendanceList(uniqueAttendance);

          const localAssignments = mockDb.assignments.filter(a => a.schoolId === session.user.schoolId);
          const uniqueAssignmentsList = Array.from(new Map(localAssignments.map((a: any) => [a.id, a])).values());
          setAssignments(uniqueAssignmentsList);

          const schoolAssignmentIds = uniqueAssignmentsList.map(a => a.id);
          const localSubmissions = mockDb.assignmentSubmissions.filter(s => schoolAssignmentIds.includes(s.assignmentId));
          const uniqueSubmissions = Array.from(new Map(localSubmissions.map((s: any) => [s.id, s])).values());
          setAssignmentSubmissions(uniqueSubmissions);

          setHostels(hList || []);
          setHostelBlocks(hbList || []);
          setHostelRooms(hrList || []);
          setHostelBeds(hbedList || []);
          setHostelWardens(hwList || []);
          setHostelAdmissions(hadmList || []);
          setHostelAttendance(hattList || []);
          setHostelFees(hfeeList || []);
          setHostelPayments(hpayList || []);
          setHostelLeaveRequests(hleaveList || []);
          setHostelVisitors(hvisList || []);
          setHostelComplaints(hcompList || []);
          setHostelMessMenus(hmenuList || []);
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
    if (activeTab === 'attendance') {
      loadAttendanceAnalytics(attendanceSectionId || undefined, undefined, attendanceSessionId || undefined);
    }
    if (activeTab === 'paymentsettings') {
      loadSchoolPaymentSettings();
    }
    // Auto-poll every 30 seconds so external DB deletions are reflected
    const pollInterval = setInterval(loadData, 30000);
    return () => clearInterval(pollInterval);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'attendance') {
      loadAttendanceAnalytics(attendanceSectionId || undefined, undefined, attendanceSessionId || undefined);
    }
  }, [attendanceSectionId, attendanceSessionId, activeTab]);

  // Analytics filter persistence effects
  useEffect(() => {
    localStorage.setItem('aegis_analytics_session_id', analyticsSessionId);
  }, [analyticsSessionId]);

  useEffect(() => {
    localStorage.setItem('aegis_analytics_class_id', analyticsClassId);
  }, [analyticsClassId]);

  useEffect(() => {
    localStorage.setItem('aegis_analytics_subject_id', analyticsSubjectId);
  }, [analyticsSubjectId]);

  useEffect(() => {
    localStorage.setItem('aegis_analytics_teacher_id', analyticsTeacherId);
  }, [analyticsTeacherId]);

  // Self-healing: Reset invalid filter selection automatically when database elements are deleted
  useEffect(() => {
    if (analyticsClassId !== 'all' && classes.length > 0 && !classes.some(c => c.id === analyticsClassId)) {
      setAnalyticsClassId('all');
    }
    if (analyticsSubjectId !== 'all' && subjects.length > 0 && !subjects.some(s => s.id === analyticsSubjectId)) {
      setAnalyticsSubjectId('all');
    }
    if (analyticsSessionId !== 'all' && academicSessionsList.length > 0 && !academicSessionsList.some((s: any) => s.id === analyticsSessionId)) {
      setAnalyticsSessionId('all');
    }
    if (analyticsTeacherId !== 'all' && teachers.length > 0 && !teachers.some(t => t.id === analyticsTeacherId)) {
      setAnalyticsTeacherId('all');
    }
  }, [classes, subjects, academicSessionsList, teachers, analyticsClassId, analyticsSubjectId, analyticsSessionId, analyticsTeacherId]);


  // Real-time Supabase Postgres changes subscription for administration data
  useEffect(() => {
    if (!adminId) return;

    const handleAdminSync = () => {
      console.log('Realtime administration update detected, refreshing admin portal directories...');
      if (session?.user.schoolId) {
        mockApi.clearHostelCache(session.user.schoolId);
      }
      syncSubscriptionPlan();
      loadData();
      loadAcademicSessions();
      if (activeTab === 'attendance') {
        loadAttendanceAnalytics(attendanceSectionId || undefined, undefined, attendanceSessionId || undefined);
      }
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_salary_payouts' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payroll_records' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salary_payments' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employee_salary_ledger' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_audit_logs' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'exam_results' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_cards' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostels' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_blocks' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_rooms' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_beds' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_wardens' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_admissions' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_attendance' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_leave_requests' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_visitors' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_complaints' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_mess_menu' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_fees' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hostel_payments' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_subscriptions' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assignment_submissions' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homeworks' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'homework_submissions' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'student_marks' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quizzes' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_attempts' }, handleAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'quiz_results' }, handleAdminSync)
      .subscribe();

    // Subscribe to manual broadcast channel for instant, guaranteed real-time updates!
    const broadcastChannel = supabase
      .channel(`school-subscription-updates-${session?.user.schoolId}`)
      .on('broadcast', { event: 'plan_updated' }, () => {
        console.log('Realtime broadcast subscription update detected in AdminPortal! Syncing plan and loading data...');
        handleAdminSync();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [adminId, session, syncSubscriptionPlan, activeTab, attendanceSectionId, attendanceSessionId]);


  // --- Hostel Handlers ---
  const handleCreateHostel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hName) return;
    try {
      await mockApi.createHostel(session.user.schoolId, hName, hType, hStatus);
      setHName('');
      loadData();
      alert('Hostel building created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create hostel');
    }
  };

  const handleDeleteHostel = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this hostel? All associated blocks, rooms, and beds will be removed.')) return;
    try {
      await mockApi.deleteHostel(id);
      loadData();
      alert('Hostel deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete hostel');
    }
  };

  const handleCreateBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hbHostelId || !hbName) return;
    try {
      await mockApi.createHostelBlock(session.user.schoolId, hbHostelId, hbName, 'ACTIVE');
      setHbName('');
      loadData();
      alert('Hostel block created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create block');
    }
  };

  const handleDeleteBlock = async (id: string) => {
    if (!window.confirm('Delete this block and all its rooms/beds?')) return;
    try {
      await mockApi.deleteHostelBlock(id);
      loadData();
      alert('Block deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete block');
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hrBlockId || !hrRoomNumber) return;
    try {
      await mockApi.createHostelRoom(session.user.schoolId, hrBlockId, hrFloor, hrRoomNumber, hrCapacity, 'ACTIVE');
      setHrRoomNumber('');
      loadData();
      alert('Hostel room configured successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to configure room');
    }
  };

  const handleDeleteRoom = async (id: string) => {
    if (!window.confirm('Delete this room and its bed allocations?')) return;
    try {
      await mockApi.deleteHostelRoom(id);
      loadData();
      alert('Room deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete room');
    }
  };

  const handleCreateBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hbedRoomId || !hbedName) return;
    try {
      await mockApi.createHostelBed(session.user.schoolId, hbedRoomId, hbedName);
      setHbedName('');
      loadData();
      alert('Hostel bed created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create bed');
    }
  };

  const handleDeleteBed = async (id: string) => {
    if (!window.confirm('Delete this bed?')) return;
    try {
      await mockApi.deleteHostelBed(id);
      loadData();
      alert('Bed deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete bed');
    }
  };

  const clearWardenForm = () => {
    setEditWardenId(null);
    setWFirstName('');
    setWLastName('');
    setWEmail('');
    setWPhone('');
    setWEmployeeId('');
    setWGender('MALE');
    setWAddress('');
    setWUsername('');
    setWPassword('');
    setWIsActive(true);
    setWAssignedLocations([]);
    setWDesignation('');
    setWJoiningDate(new Date().toISOString().split('T')[0]);
    setWlHostelId('');
    setWlBlockId('');
    setWlFloor('');
    setWlSection('');
  };

  const handleSaveWarden = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId) return;
    try {
      if (editWardenId) {
        await mockApi.updateHostelWarden(editWardenId, {
          firstName: wFirstName,
          lastName: wLastName,
          email: wEmail,
          phone: wPhone,
          employeeId: wEmployeeId,
          username: wUsername,
          gender: wGender,
          address: wAddress,
          isActive: wIsActive,
          assignedLocations: wAssignedLocations,
          designation: wDesignation,
          joiningDate: wJoiningDate
        });
        alert('Warden profile updated successfully!');
      } else {
        if (!wPassword) {
          alert('Password is required when creating a new warden account.');
          return;
        }
        await mockApi.adminCreateSubAdmin(
          session.user.id,
          wEmail,
          wFirstName,
          wLastName,
          wPhone,
          'WARDEN',
          wPassword,
          wEmployeeId || undefined,
          wUsername || undefined,
          wGender,
          wAddress || undefined,
          wAssignedLocations,
          wIsActive,
          wDesignation || undefined,
          wJoiningDate || undefined
        );
        alert('Warden account created successfully!');
      }
      clearWardenForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save warden');
    }
  };

  const handleAddAssignedLocation = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!wlHostelId) {
      alert('Please select a building.');
      return;
    }
    const bld = hostels.find(h => h.id === wlHostelId);
    const blk = hostelBlocks.find(b => b.id === wlBlockId);
    
    const dup = wAssignedLocations.some(
      loc =>
        loc.buildingId === wlHostelId &&
        loc.blockId === (wlBlockId || null) &&
        loc.floor === (wlFloor !== '' ? Number(wlFloor) : null) &&
        loc.section === (wlSection || null)
    );
    if (dup) {
      alert('This location assignment already exists.');
      return;
    }
    
    const newLoc = {
      buildingId: wlHostelId,
      buildingName: bld ? bld.name : 'Unknown Building',
      blockId: wlBlockId || null,
      blockName: blk ? blk.name : null,
      floor: wlFloor !== '' ? Number(wlFloor) : null,
      section: wlSection || null
    };
    
    setWAssignedLocations([...wAssignedLocations, newLoc]);
    setWlHostelId('');
    setWlBlockId('');
    setWlFloor('');
    setWlSection('');
  };

  const handleRemoveAssignedLocation = (index: number) => {
    setWAssignedLocations(wAssignedLocations.filter((_, idx) => idx !== index));
  };

  const handleDeleteWarden = async (id: string) => {
    if (!window.confirm('Delete this warden and their login account permanently?')) return;
    try {
      await mockApi.deleteHostelWarden(id);
      loadData();
      alert('Warden deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to remove warden');
    }
  };

  const handleEditWardenClick = (w: any) => {
    setEditWardenId(w.id);
    const usrObj = mockDb.users.find(u => u.id === w.userId) || w.userDetails || null;
    setWFirstName(usrObj?.firstName || '');
    setWLastName(usrObj?.lastName || '');
    setWEmail(usrObj?.email || '');
    setWPhone(w.phone || usrObj?.phone || '');
    setWEmployeeId(usrObj?.employeeId || '');
    setWGender(w.gender || 'MALE');
    setWAddress(w.address || '');
    setWUsername(w.username || '');
    setWPassword('');
    setWIsActive(usrObj?.isActive !== false);
    setWAssignedLocations(w.assignedLocations || []);
    setWDesignation(w.designation || '');
    setWJoiningDate(w.joiningDate || new Date().toISOString().split('T')[0]);
  };

  const handleAdmitStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hadmStudentId || !hadmHostelId || !hadmRoomId || !hadmBedId) return;
    try {
      await mockApi.admitStudentToHostel(session.user.schoolId, hadmStudentId, hadmHostelId, hadmRoomId, hadmBedId, hadmAdmissionDate);
      setHadmStudentId('');
      setHadmBedId('');
      loadData();
      alert('Student hostel admission recorded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to record admission');
    }
  };

  const handleCheckoutAdmission = async (id: string) => {
    if (!window.confirm('Confirm check-out for this student? This will vacate the assigned bed.')) return;
    try {
      await mockApi.checkoutStudentFromHostel(id, new Date().toISOString().split('T')[0]);
      loadData();
      alert('Student checked out successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to check-out');
    }
  };

  const handleDeleteHostelAdmission = async (id: string) => {
    if (!window.confirm('Delete this admission record completely?')) return;
    try {
      await mockApi.deleteHostelAdmission(id);
      loadData();
      alert('Record deleted.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleSaveHostelAttendance = async () => {
    if (!session?.user.schoolId || !attSelectedRoomId || !attSelectedDate) return;
    try {
      const roomAdms = hostelAdmissions.filter(a => a.roomId === attSelectedRoomId && a.status === 'ACTIVE');
      for (const adm of roomAdms) {
        const status = attStatusMap[adm.studentId] || 'PRESENT';
        await mockApi.recordHostelAttendance(session.user.schoolId, adm.studentId, attSelectedDate, attSelectedSlot, status, session.user.id);
      }
      loadData();
      alert('Hostel attendance logged successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to log attendance');
    }
  };

  const handleApproveLeave = async (id: string, role: 'PARENT' | 'WARDEN' | 'HOSTEL_ADMIN' | 'SCHOOL_ADMIN', status: 'APPROVED' | 'REJECTED' | 'HOLD') => {
    try {
      await mockApi.approveHostelLeaveRequest(id, role, status, session?.user.id || '');
      loadData();
      alert(`Leave request updated: ${role.replace('_', ' ')} status is now ${status}`);
    } catch (err: any) {
      alert(err.message || 'Error processing leave request');
    }
  };

  const handleCreateVisitor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hvisName || !hvisRelation || !hvisStudentId || !hvisPurpose) return;
    try {
      await mockApi.createHostelVisitor(session.user.schoolId, hvisName, hvisRelation, hvisStudentId, hvisPurpose);
      setHvisName('');
      setHvisRelation('');
      setHvisStudentId('');
      setHvisPurpose('');
      loadData();
      alert('Visitor log recorded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create visitor entry');
    }
  };

  const handleCheckoutVisitor = async (id: string) => {
    try {
      await mockApi.checkoutHostelVisitor(id);
      loadData();
      alert('Visitor checked out.');
    } catch (err: any) {
      alert(err.message || 'Failed to checkout visitor');
    }
  };

  const handleUpdateComplaint = async (id: string, status: 'ASSIGNED' | 'RESOLVED' | 'CLOSED', staff?: string, notes?: string) => {
    try {
      await mockApi.updateHostelComplaint(id, status, staff, notes);
      loadData();
      alert(`Complaint status updated to ${status.toLowerCase()}!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update complaint');
    }
  };

  const handleSaveMessMenu = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hmessHostelId || !hmessBreakfast || !hmessLunch || !hmessDinner) return;
    try {
      await mockApi.saveHostelMessMenu(session.user.schoolId, hmessHostelId, hmessDay, hmessBreakfast, hmessLunch, hmessDinner, hmessSpecial);
      loadData();
      alert('Mess menu saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save mess menu');
    }
  };

  const handleCreateHostelFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hfeeName || hfeeAmount <= 0) return;
    try {
      await mockApi.createHostelFee(session.user.schoolId, hfeeName, hfeeAmount, hfeeType, hfeeDesc);
      setHfeeName('');
      setHfeeAmount(0);
      setHfeeDesc('');
      loadData();
      alert('Hostel fee structure created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create fee structure');
    }
  };

  const handleRecordHostelPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId || !hpayStudentId || !hpayFeeId || hpayAmount <= 0) return;
    try {
      await mockApi.recordHostelPayment(session.user.schoolId, hpayStudentId, hpayFeeId, hpayAmount, hpayMethod, hpayTxId);
      setHpayStudentId('');
      setHpayFeeId('');
      setHpayAmount(0);
      setHpayTxId('');
      loadData();
      alert('Hostel payment recorded successfully, synced with financial invoicing.');
    } catch (err: any) {
      alert(err.message || 'Failed to record payment');
    }
  };

  // --- Transport Handlers ---
  const handleCreateBus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTransport) {
      alert('You do not have permission to manage transport registry.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to manage transport registry.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to manage transport routes.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to manage transport routes.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to manage transit stops.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to manage transit stops.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to manage transit drivers.');
      return;
    }
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

  const handleCreatePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user.schoolId) return;

    const currentRole = session.user.role;
    if (currentRole !== 'FINANCE_ADMIN') {
      alert('Only Finance Admin is authorized to perform salary disbursement.');
      return;
    }

    setIsSubmittingPayroll(true);
    try {
      let employeeName = '';
      let employeeIdNumber = '';
      let employeePhone = '';
      let userId: string | null = null;
      let employeeRole = '';

      if (payrollSelectedEmpId === 'custom') {
        employeeName = payrollCustomName.trim();
        employeeRole = payrollCustomRole.trim();
        employeePhone = payrollCustomPhone.trim();
        employeeIdNumber = payrollCustomEmpId.trim();
      } else {
        if (payrollEmpType === 'TEACHER') {
          const t = teachers.find(x => x.id === payrollSelectedEmpId);
          employeeName = t ? formatUserName(t.userDetails) : '';
          employeeIdNumber = t?.employeeId || '';
          employeePhone = t?.userDetails?.phone || '';
          userId = t?.userId || null;
          employeeRole = 'TEACHER';
        } else {
          const o = operators.find(x => x.id === payrollSelectedEmpId);
          employeeName = o ? formatUserName(o) : '';
          employeeIdNumber = o?.employeeId || '';
          employeePhone = o?.phone || '';
          userId = o?.id || null;
          employeeRole = o?.role || 'STAFF';
        }
      }

      if (!employeeName) {
        alert('Please select or specify a valid employee.');
        setIsSubmittingPayroll(false);
        return;
      }

      const base = Number(payrollBaseSalary) || 0;
      const allowances = Number(payrollAllowances) || 0;
      const deductions = Number(payrollDeductions) || 0;

      await mockApi.createPayrollRecord(session.user.id, session.user.schoolId, {
        employeeType: payrollEmpType,
        employeeRole,
        employeeName,
        employeeIdNumber,
        employeePhone,
        userId,
        payoutMonth: payrollPayoutMonth,
        baseSalary: base,
        allowances,
        deductions,
        notes: payrollNotes || null
      });

      setPayrollSelectedEmpId('');
      setPayrollCustomName('');
      setPayrollCustomRole('');
      setPayrollCustomPhone('');
      setPayrollCustomEmpId('');
      setPayrollBaseSalary('');
      setPayrollAllowances('0');
      setPayrollDeductions('0');
      setPayrollNotes('');
      setShowCreatePayrollModal(false);

      loadData();
      alert('Payroll record created successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to create payroll record');
    } finally {
      setIsSubmittingPayroll(false);
    }
  };

  const handleUpdatePayrollStatus = async (
    recordId: string,
    status: 'PENDING' | 'APPROVED' | 'PAID' | 'CANCELLED' | 'REVERSED',
    notes?: string | null,
    txRef?: string | null
  ) => {
    if (!session?.user.schoolId) return;

    const currentRole = session.user.role;
    if (currentRole !== 'FINANCE_ADMIN') {
      alert('Only Finance Admin is authorized to perform salary disbursement.');
      return;
    }

    if (!window.confirm(`Are you sure you want to change status to ${status}?`)) return;

    try {
      await mockApi.updatePayrollStatus(session.user.id, session.user.schoolId, recordId, status, notes, txRef);
      loadData();
      alert(`Payroll record status updated to ${status}!`);
    } catch (err: any) {
      alert(err.message || 'Failed to update payroll status');
    }
  };

  const handleDeletePayroll = async (recordId: string) => {
    if (!session?.user.schoolId) return;

    const currentRole = session.user.role;
    if (currentRole !== 'FINANCE_ADMIN') {
      alert('Only Finance Admin is authorized to perform salary disbursement.');
      return;
    }

    if (!window.confirm('Are you sure you want to delete this payroll record?')) return;

    try {
      await mockApi.deletePayrollRecord(session.user.id, session.user.schoolId, recordId);
      loadData();
      alert('Payroll record deleted successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to delete payroll record');
    }
  };

  const exportPayrollToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Month,Employee Name,Role,Type,Base Salary,Allowances,Deductions,Net Salary,Status,Payment Date,Transaction Ref,Notes\n";

    const filtered = payrollRecords.filter(r => {
      const matchesSearch = r.employeeName.toLowerCase().includes(payrollSearch.toLowerCase()) ||
        (r.employeeIdNumber && r.employeeIdNumber.toLowerCase().includes(payrollSearch.toLowerCase())) ||
        r.employeeRole.toLowerCase().includes(payrollSearch.toLowerCase());
      const matchesType = payrollTypeFilter === 'ALL' || r.employeeType === payrollTypeFilter;
      const matchesStatus = payrollStatusFilter === 'ALL' || r.payoutStatus === payrollStatusFilter;
      const matchesMonth = !payrollMonthFilter || r.payoutMonth === payrollMonthFilter;
      return matchesSearch && matchesType && matchesStatus && matchesMonth;
    });

    filtered.forEach(p => {
      const row = [
        p.payoutMonth,
        p.employeeName,
        p.employeeRole,
        p.employeeType,
        p.baseSalary,
        p.allowances,
        p.deductions,
        p.netSalary,
        p.payoutStatus,
        p.payoutDate || 'N/A',
        p.transactionReference || 'N/A',
        p.notes || ''
      ].map(field => `"${String(field).replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aegis_payroll_report_${payrollMonthFilter || 'all'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const printPayrollPDF = () => {
    if (!session?.user) return;
    const filtered = payrollRecords.filter(r => {
      const matchesSearch = r.employeeName.toLowerCase().includes(payrollSearch.toLowerCase()) ||
        (r.employeeIdNumber && r.employeeIdNumber.toLowerCase().includes(payrollSearch.toLowerCase())) ||
        r.employeeRole.toLowerCase().includes(payrollSearch.toLowerCase());
      const matchesType = payrollTypeFilter === 'ALL' || r.employeeType === payrollTypeFilter;
      const matchesStatus = payrollStatusFilter === 'ALL' || r.payoutStatus === payrollStatusFilter;
      const matchesMonth = !payrollMonthFilter || r.payoutMonth === payrollMonthFilter;
      return matchesSearch && matchesType && matchesStatus && matchesMonth;
    });

    const totalNet = filtered.reduce((acc, r) => acc + r.netSalary, 0);
    const totalBase = filtered.reduce((acc, r) => acc + r.baseSalary, 0);
    const totalAllowances = filtered.reduce((acc, r) => acc + r.allowances, 0);
    const totalDeductions = filtered.reduce((acc, r) => acc + r.deductions, 0);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up blocker prevented opening report window. Please allow popups.');
      return;
    }

    const html = `
      <html>
        <head>
          <title>Institutional Payroll Report - Aegis ERP</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1e293b; margin: 40px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: 800; color: #0f172a; }
            .meta { font-size: 11px; color: #64748b; text-align: right; }
            .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
            .card p { margin: 0; font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; }
            .card h3 { margin: 5px 0 0 0; font-size: 16px; font-weight: 800; color: #0f172a; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            th { background: #f1f5f9; font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; padding: 10px; border-bottom: 2px solid #cbd5e1; text-align: left; }
            td { padding: 10px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; text-transform: uppercase; }
            .badge-paid { background: #dcfce7; color: #15803d; }
            .badge-pending { background: #fef9c3; color: #854d0e; }
            .badge-approved { background: #dbeafe; color: #1d4ed8; }
            .badge-cancelled { background: #fee2e2; color: #b91c1c; }
            .badge-reversed { background: #f3e8ff; color: #6b21a8; }
            .footer { border-top: 1px solid #e2e8f0; pt-20px; font-size: 10px; color: #94a3b8; display: flex; justify-content: space-between; margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="title">Aegis ERP Institutional Payroll</div>
              <div style="font-size: 12px; color: #475569; mt-5px;">School-wide Payroll Ledger & Disbursement Summary</div>
            </div>
            <div class="meta">
              <div>Generated On: ${new Date().toLocaleString()}</div>
              <div>Report Period: ${payrollMonthFilter || 'All Months'}</div>
              <div>School Tenant ID: ${session.user.schoolId}</div>
            </div>
          </div>

          <div class="stats">
            <div class="card">
              <p>Total Base Salary</p>
              <h3>$${totalBase.toFixed(2)}</h3>
            </div>
            <div class="card">
              <p>Total Allowances</p>
              <h3>$${totalAllowances.toFixed(2)}</h3>
            </div>
            <div class="card">
              <p>Total Deductions</p>
              <h3>$${totalDeductions.toFixed(2)}</h3>
            </div>
            <div class="card">
              <p>Total Net Disbursed</p>
              <h3 style="color: #16a34a;">$${totalNet.toFixed(2)}</h3>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Month</th>
                <th>Employee Name</th>
                <th>Role</th>
                <th>Type</th>
                <th>Base</th>
                <th>Allowances</th>
                <th>Deductions</th>
                <th>Net</th>
                <th>Status</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.map(r => `
                <tr>
                  <td>${r.payoutMonth}</td>
                  <td style="font-weight: 600;">${r.employeeName}</td>
                  <td>${r.employeeRole}</td>
                  <td>${r.employeeType}</td>
                  <td>$${r.baseSalary.toFixed(2)}</td>
                  <td>$${r.allowances.toFixed(2)}</td>
                  <td>$${r.deductions.toFixed(2)}</td>
                  <td style="font-weight: 700;">$${r.netSalary.toFixed(2)}</td>
                  <td><span class="badge badge-${r.payoutStatus.toLowerCase()}">${r.payoutStatus}</span></td>
                  <td style="font-family: monospace; font-size: 9px;">${r.transactionReference || '-'}</td>
                </tr>
              `).join('')}
              ${filtered.length === 0 ? `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 20px;">No payroll records matched the criteria.</td></tr>` : ''}
            </tbody>
          </table>

          <div class="footer">
            <div>Aegis ERP Institutional Management Cloud System &copy; 2026</div>
            <div>Authorized Finance signature: ___________________________</div>
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleCreateTransportAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTransport) {
      alert('You do not have permission to assign transit stops.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to delete transit stop assignments.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to log maintenance expenses.');
      return;
    }
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
    if (!canManageTransport) {
      alert('You do not have permission to update driver attendance.');
      return;
    }
    if (!session?.user.schoolId) return;
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await mockApi.markDriverAttendance(session.user.schoolId, driverId, todayStr, status);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to save attendance');
    }
  };

  // --- Library & Exam CRUD Handlers ---
  const handleUpdateBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    try {
      await mockApi.updateBook(editingBook.id, editBkTitle.trim(), editBkAuthor.trim(), editBkIsbn.trim(), editBkSubject.trim(), editBkCopies);
      setEditingBook(null);
      loadData();
      alert('Book catalog updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update book');
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return;
    try {
      await mockApi.deleteBook(id);
      loadData();
      alert('Book deleted successfully.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete book');
    }
  };

  const handleUpdateBookCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookCategory) return;
    try {
      await mockApi.updateBookCategory(editingBookCategory.id, editBcName.trim(), editBcCode.trim(), editBcDesc.trim());
      setEditingBookCategory(null);
      loadData();
      alert('Category updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update category');
    }
  };

  const handleUpdateBookIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBookIssue) return;
    try {
      await mockApi.updateBookIssue(editingBookIssue.id, editBiDueDate, editBiFineAmount, editBiStatus, editBiReturnDate || undefined);
      setEditingBookIssue(null);
      loadData();
      alert('Book issue details updated!');
    } catch (err: any) {
      alert(err.message || 'Failed to update book issue');
    }
  };

  const handleDeleteBookIssue = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this book issue record?')) return;
    try {
      await mockApi.deleteBookIssue(id);
      loadData();
      alert('Book issue record deleted.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete record');
    }
  };

  const handleUpdateDigitalAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDigitalAsset) return;
    try {
      await mockApi.updateDigitalLibraryAsset(editingDigitalAsset.id, editDaTitle.trim(), editDaAuthor.trim(), editDaUrl.trim(), editDaType);
      setEditingDigitalAsset(null);
      loadData();
      alert('Digital asset metadata updated!');
    } catch (err: any) {
      alert(err.message || 'Failed to update asset');
    }
  };

  const handleDeleteDigitalAsset = async (id: string) => {
    if (!window.confirm('Delete this digital asset?')) return;
    try {
      await mockApi.deleteDigitalLibraryAsset(id);
      loadData();
      alert('Digital asset deleted.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete asset');
    }
  };

  const handleUpdateTransportAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageTransport) {
      alert('You do not have permission to update transit stop assignments.');
      return;
    }
    if (!editingTransportAssignment) return;
    try {
      await mockApi.updateTransportAssignment(editingTransportAssignment.id, editTaBusId, editTaRouteId, editTaPickupPointId);
      setEditingTransportAssignment(null);
      loadData();
      alert('Transport assignment updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update transport assignment');
    }
  };

  const handleUpdateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExam) return;
    try {
      await mockApi.updateExam(editingExam.id, editExName.trim(), editExTerm, editExStart, editExEnd);
      setEditingExam(null);
      loadData();
      alert('Exam details updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update exam');
    }
  };

  const handleUpdateExamSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExamSubject) return;
    try {
      await mockApi.updateExamSubject(editingExamSubject.id, editEsMax, editEsPass);
      setEditingExamSubject(null);
      loadData();
      alert('Subject criteria updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update criteria');
    }
  };

  const handleDeleteExamSubject = async (id: string) => {
    if (!window.confirm('Delete subject criteria mapping?')) return;
    try {
      await mockApi.deleteExamSubject(id);
      loadData();
      alert('Subject criteria mapping removed.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete criteria');
    }
  };

  const handleDeleteStudentMark = async (id: string) => {
    if (!window.confirm('Remove student mark record?')) return;
    try {
      await mockApi.deleteStudentMark(id);
      loadData();
      alert('Student mark record removed.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete student mark');
    }
  };

  const handleUpdateReportCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReportCard) return;
    try {
      await mockApi.updateReportCard(editingReportCard.id, editRcTerm, editRcAttendance, editRcGpa, editRcRemarks.trim());
      setEditingReportCard(null);
      loadData();
      alert('Report card updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update report card');
    }
  };

  const handleDeleteReportCard = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this report card?')) return;
    try {
      await mockApi.deleteReportCard(id);
      loadData();
      alert('Report card deleted.');
    } catch (err: any) {
      alert(err.message || 'Failed to delete report card');
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
      await mockApi.createBookCategory(session.user.schoolId, bcName.trim(), bcCode.trim(), bcDesc.trim());
      setBcName('');
      setBcCode('');
      setBcDesc('');
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
      setBrStatus('RETURNED');
      loadData();
      alert('Book returned successfully! Fine records updated automatically.');
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
      const activeSess = academicSessionsList.find(s => s.isCurrent) || academicSessionsList[0];
      const activeSessId = activeSess?.id || session.user.academicSessionId || '';
      await mockApi.createExam(session.user.schoolId, activeSessId, exName.trim(), exTerm, exStart, exEnd);
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
    if (!session?.user.schoolId || !meExamId || !meSubjectId || !meClassId) return;
    try {
      const filteredStudents = students.filter(s => s.classId === meClassId);
      for (const s of filteredStudents) {
        const existingMark = studentMarks.find(sm => sm.studentId === s.id && sm.examId === meExamId && sm.subjectId === meSubjectId);
        const marksObtained = meMarks[s.id] ?? existingMark?.marksObtained ?? 0;
        const remarks = meRemarks[s.id] ?? existingMark?.remarks ?? '';
        
        await mockApi.enterStudentMarks(
          session.user.schoolId,
          meExamId,
          meSubjectId,
          s.id,
          marksObtained,
          remarks
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

  /**
   * Compresses an image File using a canvas before uploading.
   * Resizes to max 1200px on the longest side and re-encodes as JPEG @ 0.85 quality.
   * Falls back to the original file if canvas is unavailable.
   */
  const compressImage = (file: File): Promise<File> =>
    new Promise((resolve) => {
      const img = new window.Image();
      const objectUrl = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height / width) * MAX); width = MAX; }
          else { width = Math.round((width / height) * MAX); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(file); return; }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (!blob) { resolve(file); return; }
            const compressed = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
            resolve(compressed);
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(file); };
      img.src = objectUrl;
    });

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !stEmail.trim()) return;
    if (!stPassword || stPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    try {
      await mockApi.adminCreateStudent(
        adminId, stEmail, stFirst, stLast, stClass, stAdmission, stRoll, stGender, stDob, stPassword, stPhone, stFatherName, stMotherName
      );

      // After student creation, resolve the new student's ID and upload photo if provided
      const schoolId = session?.user.schoolId;
      if (schoolId && stPhotoFile) {
        try {
          setStPhotoUploading(true);
          // Find newly created student by admission number + school_id (tenant-safe)
          const { data: newStudent } = await supabase
            .from('students')
            .select('id')
            .eq('school_id', schoolId)         // Tenant isolation — MANDATORY
            .eq('admission_number', stAdmission)
            .maybeSingle();

          if (newStudent?.id) {
            // uploadStudentPhoto now throws on failure — catch separately so the
            // student creation success is never affected by a photo error.
            await uploadStudentPhoto(stPhotoFile, newStudent.id, schoolId);
            // Photo URL is already persisted inside uploadStudentPhoto atomically
          }
        } catch (photoErr: any) {
          console.warn('[AdminPortal] Photo upload after student creation failed (non-fatal):', photoErr?.message || photoErr);
          // Non-fatal: student was created successfully; show soft warning only.
        } finally {
          setStPhotoUploading(false);
        }
      }

      setShowAddStudent(false);
      setStEmail('');
      setStFirst('');
      setStLast('');
      setStClass('');
      setStAdmission('');
      setStPassword('');
      setShowStPassword(false);
      setStPhone('');
      setStFatherName('');
      setStMotherName('');
      setStPhotoFile(null);
      setStPhotoPreview(null);
      loadData();
      alert('Student registered successfully!');
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

  const handleEditSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminId || !editingSubject || !editSubName.trim()) return;

    try {
      await mockApi.adminEditSubject(adminId, editingSubject.id, editSubName, editSubCode, editSubDesc);
      setEditingSubject(null);
      setEditSubName('');
      setEditSubCode('');
      setEditSubDesc('');
      loadData();
      alert('Syllabus subject updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Error updating subject');
    }
  };

  const handleDeleteSubject = async (subjectId: string) => {
    if (!adminId) return;
    if (!window.confirm('Are you absolutely sure you want to delete this subject? This operation is permanent.')) return;

    try {
      await mockApi.adminDeleteSubject(adminId, subjectId);
      loadData();
      alert('Subject successfully deleted from school syllabus catalog.');
    } catch (err: any) {
      alert(err.message || 'Error deleting subject');
    }
  };

  const loadAttendanceAnalytics = async (classId?: string, sectionId?: string | null, sessionId?: string) => {
    if (!session?.user.schoolId) return;
    setLoadingAttendance(true);
    try {
      const data = await mockApi.fetchStudentAttendanceAnalytics(
        session.user.schoolId,
        classId || undefined,
        sectionId || undefined,
        sessionId || undefined
      );
      setAttendanceAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load student attendance analytics:', err);
    } finally {
      setLoadingAttendance(false);
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
    const currentRole = session?.user.role;
    const hasFinancePrivileges =
      currentRole === 'FINANCE_ADMIN' ||
      (currentRole === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true);

    if (!hasFinancePrivileges) {
      alert('Security Policy: You do not have Finance Admin permissions to perform write actions on fee structures or modify billing details.');
      return;
    }
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
    const currentRole = session?.user.role;
    const hasFinancePrivileges =
      currentRole === 'FINANCE_ADMIN' ||
      (currentRole === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true);

    if (!hasFinancePrivileges) {
      alert('Security Policy: You do not have Finance Admin permissions to perform write actions on fee structures or modify billing details.');
      return;
    }
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
    const currentRole = session?.user.role;
    const hasFinancePrivileges =
      currentRole === 'FINANCE_ADMIN' ||
      (currentRole === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true);

    if (!hasFinancePrivileges) {
      alert('Security Policy: You do not have Finance Admin permissions to perform write actions on fee structures or modify billing details.');
      return;
    }
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
    const currentRole = session?.user.role;
    const hasFinancePrivileges =
      currentRole === 'FINANCE_ADMIN' ||
      (currentRole === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true);

    if (!hasFinancePrivileges) {
      alert('Security Policy: You do not have Finance Admin permissions to perform write actions on fee structures or modify billing details.');
      return;
    }
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

  const handleDisburseDriverSalary = async (driverId: string, amount: number, attendanceRecordId?: string | null) => {
    if (session?.user.role !== 'FINANCE_ADMIN') {
      alert('Unauthorized: Only Finance Administrators can disburse salary payouts.');
      return;
    }
    if (!adminId || !session?.user.schoolId) return;
    const curSym = overview?.currencySymbol || '$';
    if (!window.confirm(`Are you sure you want to disburse a daily salary payout of ${curSym}${amount.toFixed(2)} to this driver?`)) return;

    setDisbursingDriverId(driverId);
    try {
      await mockApi.adminDisburseDriverSalary(
        adminId,
        session.user.schoolId,
        driverId,
        amount,
        attendanceRecordId || null,
        adminId,
        'Daily salary disburse ledger payout'
      );
      loadData();
      alert(`Successfully disbursed daily salary payout of ${curSym}${amount.toFixed(2)}!`);
    } catch (err: any) {
      alert(err.message || 'Error disbursing salary');
    } finally {
      setDisbursingDriverId(null);
    }
  };

  const handleToggleTransportFeePayment = async (id: string, currentStatus: string) => {
    const canToggleFeeStatus = session?.user.role === 'ADMIN' || session?.user.role === 'FINANCE_ADMIN';
    if (!canToggleFeeStatus) {
      alert('You do not have permission to modify fee payment status.');
      return;
    }
    try {
      await mockApi.toggleTransportFeePayment(id, currentStatus);
      loadData();
      alert('Payment status updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update payment status');
    }
  };

  const handleQuickApprovePayment = async (studentId: string, structureId: string, amount: number) => {
    const currentRole = session?.user.role;
    const hasFinancePrivileges =
      currentRole === 'FINANCE_ADMIN' ||
      (currentRole === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true);

    if (!hasFinancePrivileges) {
      alert('Security Policy: You do not have Finance Admin permissions to approve or modify payment records.');
      return;
    }
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
    const currentRole = session?.user.role;
    const hasFinancePrivileges =
      currentRole === 'FINANCE_ADMIN' ||
      (currentRole === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true);

    if (!hasFinancePrivileges) {
      alert('Security Policy: You do not have Finance Admin permissions to modify or reject payment records.');
      return;
    }
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
    formatUserName(s.userDetails).toLowerCase().includes(studentSearch.toLowerCase()) ||
    s.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase())
  );

  const filteredTeachers = teachers.filter(t => 
    formatUserName(t.userDetails).toLowerCase().includes(teacherSearch.toLowerCase())
  );

  const filteredParents = parents.filter(p => 
    formatUserName(p.userDetails).toLowerCase().includes(parentSearch.toLowerCase()) ||
    p.userDetails.email.toLowerCase().includes(parentSearch.toLowerCase()) ||
    (p.occupation && p.occupation.toLowerCase().includes(parentSearch.toLowerCase()))
  );


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
    if (activeTab === 'hostel') {
      if (session?.user.role === 'HOSTEL_ADMIN' || session?.user.role === 'WARDEN') return true;
      return (rolePerms as any)?.hostel || false;
    }
    
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



  const isSubAdmin = ['FINANCE_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'ACADEMIC_ADMIN', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN', 'CUSTOM_SUB_ADMIN'].includes(session?.user.role || '');

  if (isSubAdmin && currentPlanName !== 'enterprise') {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <GlassCard className="border-red-500/20 bg-slate-950/60 shadow-[0_0_50px_rgba(239,68,68,0.15)] p-12 relative overflow-hidden rounded-3xl">
          <div className="absolute top-0 right-0 p-4 bg-red-500/10 border-l border-b border-red-500/20 rounded-bl-2xl text-red-400 font-extrabold uppercase tracking-widest text-[9px] font-mono">
            Enterprise Feature
          </div>
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center mx-auto mb-8 shadow-xl shadow-red-500/20 animate-bounce">
            <Lock className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100 mb-4 tracking-tight">Sub-Admin Access Suspended</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto mb-8 leading-relaxed">
            Your school's current plan is <span className="text-amber-400 font-bold uppercase">{currentPlanName}</span>. 
            Granular sub-admin routing, role restrictions, and dedicated dashboards are exclusive to the <span className="text-brand-400 font-bold uppercase">Enterprise</span> tier.
          </p>
          <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl max-w-sm mx-auto">
            <p className="text-xs text-slate-500 font-medium">Please contact your School Principal / Super Admin to upgrade this institution to Enterprise.</p>
          </div>
        </GlassCard>
      </div>
    );
  }
  const getLogDescription = (log: any) => {
    const action = log.actionType;
    
    const parseIfString = (val: any) => {
      if (typeof val === 'string') {
        try { return JSON.parse(val); } catch { return val; }
      }
      return val;
    };
    
    const old = parseIfString(log.oldData);
    const newD = parseIfString(log.newData);
    const target = log.targetId;

    const getTeacherName = (tId: string) => {
      if (!tId) return 'None';
      const found = teachers.find(t => t.id === tId);
      if (!found) return `Teacher (${tId.substring(0, 8)})`;
      return formatUserName(found.userDetails) || `Teacher (${tId.substring(0, 8)})`;
    };

    const getClassName = (cId: string) => {
      if (!cId) return 'None';
      const found = classes.find(c => c.id === cId);
      return found?.name || `Class (${cId.substring(0, 8)})`;
    };

    const getSubjectName = (sId: string) => {
      if (!sId) return 'None';
      const found = subjects.find(s => s.id === sId);
      return found?.name || `Subject (${sId.substring(0, 8)})`;
    };

    switch (action) {
      case 'CLASS_TEACHER_ASSIGNED': {
        const clsName = getClassName(target);
        const tName = getTeacherName(newD?.teacherId);
        return `${clsName} assigned to ${tName}`;
      }
      case 'CLASS_TEACHER_CHANGED': {
        const clsName = getClassName(target);
        const prevTName = getTeacherName(old?.teacherId);
        const newTName = getTeacherName(newD?.teacherId);
        return `${clsName} changed from ${prevTName} to ${newTName}`;
      }
      case 'CLASS_TEACHER_REMOVED': {
        const clsName = getClassName(target);
        const prevTName = getTeacherName(old?.teacherId);
        return `${clsName} removed class teacher (previously ${prevTName})`;
      }
      case 'TIMETABLE_CREATED': {
        const entry = newD;
        const clsName = getClassName(entry?.classId);
        const subName = getSubjectName(entry?.subjectId);
        const tName = getTeacherName(entry?.teacherId);
        const day = entry?.dayOfWeek !== undefined ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][entry.dayOfWeek - 1] || `Day ${entry.dayOfWeek}` : '';
        return `Period created for ${clsName} (${subName} by ${tName}) on ${day} at ${entry?.startTime || ''} - ${entry?.endTime || ''}`;
      }
      case 'TIMETABLE_UPDATED': {
        const entry = newD;
        const clsName = getClassName(entry?.classId);
        const subName = getSubjectName(entry?.subjectId);
        const tName = getTeacherName(entry?.teacherId);
        const day = entry?.dayOfWeek !== undefined ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][entry.dayOfWeek - 1] || `Day ${entry.dayOfWeek}` : '';
        return `Period updated for ${clsName} (${subName} by ${tName}) on ${day} at ${entry?.startTime || ''} - ${entry?.endTime || ''}`;
      }
      case 'TIMETABLE_DELETED': {
        const entry = old;
        const clsName = getClassName(entry?.classId);
        const subName = getSubjectName(entry?.subjectId);
        return `Period deleted for ${clsName} (${subName})`;
      }
      default: {
        return log.actionType.replace(/_/g, ' ') + (log.targetId ? ` on ${log.targetId.substring(0, 8)}` : '');
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      
      {/* Portal Identity Header */}
      {activeTab !== 'groupdiscussion' && <AdminPortalHeader />}

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
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.currencySymbol || '$'}{overview.feeCollections.paid.toLocaleString()}</h3>
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
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.currencySymbol || '$'}{invoicesAmount.toLocaleString()}</h3>
                  </div>
                </GlassCard>

                <GlassCard className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-brand-500/10 border border-brand-500/25 flex items-center justify-center">
                    <CheckSquare className="text-brand-400" size={20} />
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Pending Collections</span>
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.currencySymbol || '$'}{overview.feeCollections.pending.toLocaleString()}</h3>
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
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.currencySymbol || '$'}{(overview.totalClasses * 3.5).toFixed(2)}</h3>
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
                    <h3 className="text-2xl font-extrabold text-slate-100 mt-1">{overview.currencySymbol || '$'}{overview.feeCollections.paid.toLocaleString()}</h3>
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
                  <p className="text-lg font-bold text-green-400 mt-1">{overview.currencySymbol || '$'}{overview.feeCollections.paid.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase leading-none">Outstanding Dues</span>
                  <p className="text-lg font-bold text-red-400 mt-1">{overview.currencySymbol || '$'}{overview.feeCollections.pending.toLocaleString()}</p>
                </div>
              </div>
            </GlassCard>
          </div>

          {session?.user.role === 'ADMIN' && (
            <GlassCard className="space-y-6">
              <div className="border-b border-slate-850 pb-3">
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <Settings className="text-brand-500" size={18} />
                  Institution Branding & Identity Settings
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload official institution assets and signatures to brand documents such as marksheets, receipts, certificates, and ID cards.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Logo Card */}
                <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Image size={14} className="text-brand-400" />
                      School Logo (Max 5MB)
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Appears on marksheets, certificates, receipts, ID cards, and admission forms.</p>
                  </div>
                  <div className="h-32 bg-slate-950/45 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
                    {(() => {
                      const school = mockDb.schools.find(s => s.id === session?.user.schoolId);
                      const logoUrl = school?.logoUrl;
                      if (logoUrl) {
                        return (
                          <>
                            <img src={logoUrl} alt="School Logo" className="max-h-full max-w-full object-contain p-2" />
                            <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <label className="bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer transition-colors">
                                Replace
                                <input 
                                  type="file" 
                                  accept=".png,.jpg,.jpeg,.svg,.webp" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadLogo(file);
                                  }} 
                                  className="hidden" 
                                />
                              </label>
                              <button type="button" onClick={handleRemoveLogo} className="bg-red-650 hover:bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors">
                                Remove
                              </button>
                            </div>
                          </>
                        );
                      } else {
                        return (
                          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate-900/40 transition-colors">
                            <PlusCircle className="text-slate-550 mb-1" size={18} />
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Upload Logo</span>
                            <input 
                              type="file" 
                              accept=".png,.jpg,.jpeg,.svg,.webp" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadLogo(file);
                              }} 
                              className="hidden" 
                            />
                          </label>
                        );
                      }
                    })()}
                  </div>
                </div>

                {/* Seal Card */}
                <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <Shield size={14} className="text-brand-400" />
                      Official School Seal (Max 5MB)
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Stamped officially on marksheets, certificates, and ID cards.</p>
                  </div>
                  <div className="h-32 bg-slate-950/45 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
                    {(() => {
                      const school = mockDb.schools.find(s => s.id === session?.user.schoolId);
                      const sealUrl = school?.sealUrl;
                      if (sealUrl) {
                        return (
                          <>
                            <img src={sealUrl} alt="School Seal" className="max-h-full max-w-full object-contain p-2" />
                            <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <label className="bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer transition-colors">
                                Replace
                                <input 
                                  type="file" 
                                  accept=".png,.jpg,.jpeg,.svg,.webp" 
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleUploadSeal(file);
                                  }} 
                                  className="hidden" 
                                />
                              </label>
                              <button type="button" onClick={handleRemoveSeal} className="bg-red-650 hover:bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors">
                                Remove
                              </button>
                            </div>
                          </>
                        );
                      } else {
                        return (
                          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate-900/40 transition-colors">
                            <PlusCircle className="text-slate-550 mb-1" size={18} />
                            <span className="text-[10px] text-slate-500 font-bold uppercase">Upload Seal</span>
                            <input 
                              type="file" 
                              accept=".png,.jpg,.jpeg,.svg,.webp" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleUploadSeal(file);
                              }} 
                              className="hidden" 
                            />
                          </label>
                        );
                      }
                    })()}
                  </div>
                </div>

                {/* Principal Signature Card */}
                <div className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl space-y-3 flex flex-col justify-between">
                  <div>
                    <h4 className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                      <FileText size={14} className="text-brand-400" />
                      Principal / Admin Signature (Max 5MB)
                    </h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Autographed dynamically on report cards, fee receipts, and certificates.</p>
                  </div>
                  <div className="h-32 bg-slate-950/45 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
                    {adminSignatureUrl ? (
                      <>
                        <img src={adminSignatureUrl} alt="Admin Signature" className="max-h-full max-w-full object-contain p-2" />
                        <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <label className="bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold px-2 py-1 rounded cursor-pointer transition-colors">
                            Replace
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
                          <button type="button" onClick={handleRemoveSignature} className="bg-red-650 hover:bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded transition-colors">
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate-900/40 transition-colors">
                        <PlusCircle className="text-slate-550 mb-1" size={18} />
                        <span className="text-[10px] text-slate-500 font-bold uppercase">Upload Signature</span>
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
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

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
                    <td className="py-3 px-4 font-semibold">{formatUserName(s.userDetails)}</td>
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
                        onClick={() => handleResetPassword(s.userDetails.id, formatUserName(s.userDetails))}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(s.id, formatUserName(s.userDetails))}
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
              {(session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN' || session?.user.role === 'ACADEMIC_ADMIN') && (
                <button 
                  onClick={() => setShowMapTeacher(true)}
                  className="glass-btn-primary text-xs flex items-center gap-1 shrink-0"
                >
                  <Link size={14} /> Map Faculty
                </button>
              )}
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
                    <td className="py-3 px-4 font-semibold">{formatUserName(t.userDetails)}</td>
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
                        onClick={() => handleResetPassword(t.userDetails.id, formatUserName(t.userDetails))}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteTeacher(t.id, formatUserName(t.userDetails))}
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
                    <td className="py-3 px-4 font-semibold">{formatUserName(p.userDetails)}</td>
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
                        onClick={() => handleResetPassword(p.userDetails.id, formatUserName(p.userDetails))}
                        disabled={!isAcademicOrSchoolAdmin}
                        className="text-slate-400 hover:text-slate-200 font-bold flex items-center gap-1 text-[11px] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        title={!isAcademicOrSchoolAdmin ? 'Academic or School Admin only' : ''}
                      >
                        Reset Password
                      </button>
                      <button 
                        onClick={() => handleDeleteParent(p.id, formatUserName(p.userDetails))}
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
                          {(() => {
                            const ct = teachers.find(t => t.id === c.classTeacherId);
                            return ct ? `Class Teacher: ${formatUserName(ct.userDetails)}` : 'No Class Teacher Assigned';
                          })()}
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
              {isAcademicOrSchoolAdmin ? (
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
              ) : (
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl text-center text-slate-400">
                  <Lock className="mx-auto mb-2 text-slate-500" size={20} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">RESTRICTED SECTION</p>
                  <p className="text-[10px] mt-1">Class setup management is restricted to School & Academic Admins only.</p>
                </div>
              )}
            </GlassCard>

            <GlassCard className="space-y-4 mt-6">
              <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Settings className="text-brand-500" size={16} />
                Class Settings
              </h3>
              {isAcademicOrSchoolAdmin ? (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Class</label>
                    <select
                      value={selectedSettingsClassId}
                      onChange={(e) => setSelectedSettingsClassId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                    >
                      <option value="">-- Choose Class --</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {selectedSettingsClassId && (() => {
                    const cls = classes.find(c => c.id === selectedSettingsClassId);
                    if (!cls) return null;
                    const ctTeacher = cls.classTeacherId ? teachers.find(t => t.id === cls.classTeacherId) : null;
                    
                    const classLogs = auditLogs.filter(log => 
                      log.targetId === selectedSettingsClassId && 
                      ['CLASS_TEACHER_ASSIGNED', 'CLASS_TEACHER_CHANGED', 'CLASS_TEACHER_REMOVED'].includes(log.actionType)
                    );

                    return (
                      <div className="space-y-4 pt-2 border-t border-slate-850/50">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Current Class Teacher</label>
                          {ctTeacher ? (
                            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-2">
                              <div className="flex items-center gap-3">
                                {ctTeacher.userDetails?.avatarUrl ? (
                                  <img src={ctTeacher.userDetails.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-brand-500/10 flex items-center justify-center text-xs font-bold text-brand-400">
                                    {ctTeacher.userDetails?.firstName?.[0] || 'T'}
                                  </div>
                                )}
                                <div>
                                  <div className="font-bold text-slate-200 text-xs">
                                    {formatUserName(ctTeacher.userDetails)}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">ID: {ctTeacher.employeeId}</div>
                                </div>
                                <span className="ml-auto text-[9px] font-bold text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Active
                                </span>
                              </div>

                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={() => {
                                    setChangeCtClassId(selectedSettingsClassId);
                                    setChangeCtTeacherId('');
                                    setShowChangeCtModal(true);
                                  }}
                                  className="flex-1 glass-btn text-[10px] py-1.5 font-bold uppercase animate-pulse"
                                >
                                  Change Class Teacher
                                </button>
                                <button
                                  onClick={async () => {
                                    if (!window.confirm('Are you sure you want to remove the class teacher from this class?')) return;
                                    try {
                                      await mockApi.adminRemoveClassTeacher(adminId!, selectedSettingsClassId);
                                      setClasses(prev => prev.map(c => c.id === selectedSettingsClassId ? { ...c, classTeacherId: undefined } : c));
                                      const logs = await mockApi.fetchAuditLogs(session?.user.schoolId || '');
                                      setAuditLogs(logs);
                                      alert('Class teacher removed successfully.');
                                    } catch (err: any) {
                                      alert(err.message || 'Error removing class teacher.');
                                    }
                                  }}
                                  className="glass-btn text-[10px] py-1.5 px-2.5 font-bold uppercase border-rose-500/20 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
                                >
                                  Remove
                                </button>
                              </div>

                              <div className="p-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded-lg flex gap-2">
                                <AlertTriangle className="text-yellow-400 shrink-0 mt-0.5" size={14} />
                                <div className="text-[10px] text-slate-350 leading-relaxed">
                                  <strong>Validation:</strong> This class already has an assigned Class Teacher. Please remove or change the existing Class Teacher first.
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="p-3 bg-slate-900/20 border border-slate-850/50 border-dashed rounded-xl text-center text-[10px] text-slate-400 py-4">
                                No Class Teacher Assigned
                              </div>
                              <button
                                onClick={() => {
                                  setChangeCtClassId(selectedSettingsClassId);
                                  setChangeCtTeacherId('');
                                  setShowChangeCtModal(true);
                                }}
                                className="w-full glass-btn-primary text-[10px] py-1.5 font-bold uppercase"
                              >
                                Assign Class Teacher
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 pt-2 border-t border-slate-850/50">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">History</label>
                          {classLogs.length > 0 ? (
                            <div className="space-y-3 pl-1.5 border-l border-slate-800">
                              {classLogs.map(log => {
                                const operatorName = log.userId ? (operators.find(o => o.id === log.userId)?.firstName || 'Admin') : 'System';
                                return (
                                  <div key={log.id} className="relative pl-3 space-y-0.5">
                                    <div className="absolute left-[-9.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-brand-500"></div>
                                    <div className="text-[9px] font-bold text-slate-450">
                                      {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString()}
                                    </div>
                                    <div className="text-[10px] text-slate-350 font-semibold leading-relaxed">
                                      {getLogDescription(log)}
                                    </div>
                                    <div className="text-[9px] text-slate-500 uppercase tracking-wider font-mono">
                                      By: {operatorName}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[9px] text-slate-500 italic">No teacher assignment history recorded.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl text-center text-slate-400">
                  <Lock className="mx-auto mb-2 text-slate-500" size={20} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">RESTRICTED SECTION</p>
                  <p className="text-[10px] mt-1">Class teacher settings are restricted to School & Academic Admins.</p>
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {showChangeCtModal && changeCtClassId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <GlassCard className="w-full max-w-sm bg-slate-950 border border-slate-850 p-6 space-y-5 relative">
            <button
              onClick={() => setShowChangeCtModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 text-sm"
            >
              ✕
            </button>
            <div className="space-y-1.5">
              <h3 className="font-bold text-slate-200 text-sm">
                Change Class Teacher — {classes.find(c => c.id === changeCtClassId)?.name}
              </h3>
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                Select replacement teacher
              </p>
            </div>

            {(() => {
              const currentClass = classes.find(c => c.id === changeCtClassId);
              const currentCtId = currentClass?.classTeacherId;
              const currentCt = currentCtId ? teachers.find(t => t.id === currentCtId) : null;

              return (
                <div className="space-y-4">
                  {currentCt && (
                    <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-xl space-y-1">
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block">Current Class Teacher</span>
                      <div className="font-bold text-slate-300 text-xs">
                        {formatUserName(currentCt.userDetails)}
                      </div>
                      <div className="text-[9px] text-slate-500 font-mono">ID: {currentCt.employeeId}</div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select New Class Teacher</label>
                    <select
                      value={changeCtTeacherId}
                      onChange={(e) => setChangeCtTeacherId(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                    >
                      <option value="">Select Teacher</option>
                      {teachers
                        .filter(t => t.id !== currentCtId && t.status !== 'INACTIVE' && !t.deletedAt)
                        .map(t => (
                          <option key={t.id} value={t.id}>
                            {formatUserName(t.userDetails)} ({t.employeeId})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-lg flex gap-2">
                    <AlertCircle className="text-blue-400 shrink-0 mt-0.5" size={14} />
                    <div className="text-[10px] text-slate-350 leading-relaxed">
                      This action will replace the current Class Teacher for this class.
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowChangeCtModal(false)}
                      className="flex-1 glass-btn text-xs py-2 font-bold uppercase"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!changeCtTeacherId) {
                          alert('Please select a teacher.');
                          return;
                        }
                        try {
                          if (currentCtId) {
                            await mockApi.adminChangeClassTeacher(adminId!, changeCtClassId, changeCtTeacherId);
                          } else {
                            await mockApi.adminAssignClassTeacher(adminId!, changeCtClassId, changeCtTeacherId);
                          }
                          setClasses(prev => prev.map(c => c.id === changeCtClassId ? { ...c, classTeacherId: changeCtTeacherId } : c));
                          const logs = await mockApi.fetchAuditLogs(session?.user.schoolId || '');
                          setAuditLogs(logs);
                          setShowChangeCtModal(false);
                          alert('Class teacher updated successfully.');
                        } catch (err: any) {
                          alert(err.message || 'Error updating class teacher.');
                        }
                      }}
                      className="flex-1 glass-btn-primary text-xs py-2 font-bold uppercase"
                    >
                      Confirm Change
                    </button>
                  </div>
                </div>
              );
            })()}
          </GlassCard>
        </div>
      )}

      {activeTab === 'subjects' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <div className="lg:col-span-2">
            <GlassCard className="space-y-4">
              <h3 className="font-bold text-slate-100 pb-3 border-b border-slate-850">Subject Catalog Directory</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {subjects.map(s => (
                  <div key={s.id} className="p-4 bg-slate-900/30 border border-slate-850 rounded-2xl flex flex-col justify-between space-y-2">
                    <div>
                      <span className="text-[9px] font-bold text-brand-400 font-mono uppercase tracking-widest">{s.code}</span>
                      <h4 className="font-bold text-slate-200 text-sm mt-0.5">{s.name}</h4>
                      <p className="text-xs text-slate-450 leading-relaxed line-clamp-3 mt-1">{s.description || 'No description added.'}</p>
                    </div>
                    <div className="flex items-center justify-end gap-3 mt-2 pt-2 border-t border-slate-850/50">
                      <button 
                        onClick={() => {
                          setEditingSubject(s);
                          setEditSubName(s.name);
                          setEditSubCode(s.code);
                          setEditSubDesc(s.description || '');
                        }}
                        className="text-[10px] text-brand-400 hover:text-brand-300 font-bold uppercase transition"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDeleteSubject(s.id)}
                        className="text-[10px] text-rose-400 hover:text-rose-300 font-bold uppercase transition"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </GlassCard>
          </div>

          <div className="lg:col-span-1">
            {editingSubject ? (
              <GlassCard className="space-y-4 border-brand-500/30">
                <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                  <h3 className="font-bold text-brand-400 text-sm">Edit Syllabus Subject</h3>
                  <button 
                    onClick={() => setEditingSubject(null)} 
                    className="text-[10px] text-slate-500 hover:text-slate-350 uppercase font-bold"
                  >
                    Cancel
                  </button>
                </div>
                <form onSubmit={handleEditSubject} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Organic Chemistry" 
                      value={editSubName} 
                      onChange={(e) => setEditSubName(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Code</label>
                    <input 
                      type="text" 
                      placeholder="e.g. CHEM201" 
                      value={editSubCode} 
                      onChange={(e) => setEditSubCode(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" 
                      required 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
                    <textarea 
                      placeholder="Outline course syllabus topics..." 
                      rows={3} 
                      value={editSubDesc} 
                      onChange={(e) => setEditSubDesc(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" 
                    />
                  </div>
                  <button type="submit" className="w-full glass-btn-primary text-xs">
                    Save Subject Changes
                  </button>
                </form>
              </GlassCard>
            ) : (
              <GlassCard className="space-y-4">
                <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Register Syllabus Subject</h3>
                <form onSubmit={handleCreateSubject} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Name</label>
                    <input type="text" placeholder="e.g. Organic Chemistry" value={subName} onChange={(e) => setSubName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Subject Code</label>
                    <input type="text" placeholder="e.g. CHEM201" value={subCode} onChange={(e) => setSubCode(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" required />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Description</label>
                    <textarea placeholder="Outline course syllabus topics..." rows={3} value={subDesc} onChange={(e) => setSubDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500/50" />
                  </div>
                  <button type="submit" className="w-full glass-btn-primary text-xs">
                    Publish Subject
                  </button>
                </form>
              </GlassCard>
            )}
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
              {isAcademicOrSchoolAdmin ? (
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
              ) : (
                <div className="p-4 bg-slate-950/40 border border-slate-850 rounded-xl text-center text-slate-400">
                  <Lock className="mx-auto mb-2 text-slate-500" size={20} />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-red-400">RESTRICTED SECTION</p>
                  <p className="text-[10px] mt-1">Academic session setup is restricted to School & Academic Admins only.</p>
                </div>
              )}
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
                            disabled={!isAcademicOrSchoolAdmin}
                            className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-300 hover:border-amber-500/30 hover:text-amber-400 hover:bg-amber-500/5 disabled:opacity-40 disabled:hover:text-slate-300 disabled:hover:bg-slate-800/50 flex items-center gap-1.5 transition-all"
                            title={!isAcademicOrSchoolAdmin ? "Academic or School Admin only" : "Edit session name and dates"}
                          >
                            <Edit size={12} />
                            Edit
                          </button>
                          {!sess.isCurrent && (
                            <>
                              <button
                                onClick={() => handleSetActiveSession(sess.id)}
                                disabled={!isAcademicOrSchoolAdmin}
                                className="glass-btn-primary text-[11px] font-bold px-3 py-1.5 disabled:opacity-40 flex items-center gap-1.5 transition-all"
                                title={!isAcademicOrSchoolAdmin ? "Academic or School Admin only" : ""}
                              >
                                <CheckCircle2 size={13} />
                                Activate
                              </button>
                              <button
                                onClick={() => handleDeleteAcademicSession(sess)}
                                disabled={!isAcademicOrSchoolAdmin}
                                className="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-slate-400 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5 disabled:opacity-40 disabled:hover:text-slate-400 disabled:hover:bg-slate-800/50 flex items-center gap-1.5 transition-all"
                                title={!isAcademicOrSchoolAdmin ? "Academic or School Admin only" : "Permanently delete this session and all related data"}
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
                    <h4 className="font-semibold text-xs text-slate-200">{formatUserName(u)}</h4>
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
          isLocked={false} 
          requiredTier="Pro" 
          featureName="Billing & Invoicing"
        >
          <div className="space-y-6">
            {/* Sub-tab Navigation */}
            <div className="flex flex-wrap gap-2 p-1 bg-slate-900/60 border border-slate-850 rounded-2xl w-fit">
              <button
                onClick={() => setFeesSubTab('billing')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  feesSubTab === 'billing'
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Student Billing & Invoices
              </button>
              <button
                onClick={() => setFeesSubTab('drivers')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  feesSubTab === 'drivers'
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Driver Payout Ledger
              </button>
              <button
                onClick={() => setFeesSubTab('payroll')}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  feesSubTab === 'payroll'
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/10'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Teacher & Staff Payroll
              </button>
              {(session?.user.role === 'ADMIN' || session?.user.role === 'FINANCE_ADMIN') && (
                <button
                  onClick={async () => {
                    setFeesSubTab('payment-settings');
                    if (!schoolPaySettings) {
                      await loadSchoolPaymentSettings();
                    }
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    feesSubTab === 'payment-settings'
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Payment Settings
                </button>
              )}
              {(session?.user.role === 'ADMIN' || session?.user.role === 'FINANCE_ADMIN') && (
                <button
                  onClick={() => setFeesSubTab('verify-payments')}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all relative ${
                    feesSubTab === 'verify-payments'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Verify Payments
                  {(feePayments || []).filter(p => p.status === 'PENDING' && p.paymentScreenshotUrl).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                      {(feePayments || []).filter(p => p.status === 'PENDING' && p.paymentScreenshotUrl).length}
                    </span>
                  )}
                </button>
              )}
              {(session?.user.role === 'ADMIN' || session?.user.role === 'FINANCE_ADMIN') && (
                <button
                  onClick={async () => {
                    setFeesSubTab('salary-payments');
                    const schoolId = session?.user.schoolId || '';
                    if (salaryPaymentsList.length === 0) {
                      const payments = await mockApi.getSalaryPayments(schoolId);
                      setSalaryPaymentsList(payments);
                      const ledger = await mockApi.getSalaryLedger(schoolId);
                      setSalaryLedgerList(ledger);
                    }
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    feesSubTab === 'salary-payments'
                      ? 'bg-teal-600 text-white shadow-lg shadow-teal-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Salary Payments
                </button>
              )}
              {(session?.user.role === 'ADMIN' || session?.user.role === 'FINANCE_ADMIN') && (
                <button
                  onClick={async () => {
                    setFeesSubTab('salary-queue');
                    const schoolId = session?.user.schoolId || '';
                    const payments = await mockApi.getSalaryPayments(schoolId);
                    setSalaryPaymentsList(payments);
                  }}
                  className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all relative ${
                    feesSubTab === 'salary-queue'
                      ? 'bg-orange-600 text-white shadow-lg shadow-orange-500/10'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Salary Queue
                  {salaryPaymentsList.filter(p => p.status === 'PENDING').length > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                      {salaryPaymentsList.filter(p => p.status === 'PENDING').length}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Financial Overview Metrics Cards */}
            {feesSubTab === 'billing' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <GlassCard className="p-4 flex items-center justify-between border-emerald-500/10 shadow-emerald-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Collected Income</p>
                    <h3 className="text-xl font-extrabold text-emerald-400">
                      {overview?.currencySymbol || '$'}{(feePayments || [])
                        .filter(p => p && p.status === 'PAID')
                        .reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                      {overview?.currencySymbol || '$'}{(
                        (feeStructures || []).reduce((acc, fs) => acc + ((Number(fs?.amount) || 0) * (students || []).filter(s => s && s.classId === fs?.classId).length), 0) -
                        (feePayments || []).filter(p => p && p.status === 'PAID').reduce((acc, p) => acc + (Number(p.amountPaid) || 0), 0)
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
                      {overview?.currencySymbol || '$'}{(feeStructures || [])
                        .reduce((acc, fs) => acc + ((Number(fs?.amount) || 0) * (students || []).filter(s => s && s.classId === fs?.classId).length), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[9px] text-slate-500">Total institutional billing mapped</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-400">
                    <DollarSign size={20} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between border-rose-500/10 shadow-rose-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Disbursed Driver Salaries</p>
                    <h3 className="text-xl font-extrabold text-rose-455">
                      {overview?.currencySymbol || '$'}{driverSalaryPayouts
                        .reduce((acc, p) => acc + (Number(p.payoutAmount) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[9px] text-slate-500">Total salary expenses cleared</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-450">
                    <Clock size={20} />
                  </div>
                </GlassCard>
              </div>
            )}

            {feesSubTab === 'drivers' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <GlassCard className="p-4 flex items-center justify-between border-emerald-500/10 shadow-emerald-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Disbursed Driver Salaries</p>
                    <h3 className="text-xl font-extrabold text-emerald-400">
                      {overview?.currencySymbol || '$'}{driverSalaryPayouts
                        .reduce((acc, p) => acc + (Number(p.payoutAmount) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[9px] text-slate-500">Total salary expenses cleared</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                    <CheckCircle size={20} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between border-amber-500/10 shadow-amber-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Pending Driver Payouts</p>
                    <h3 className="text-xl font-extrabold text-amber-400">
                      {overview?.currencySymbol || '$'}{(() => {
                        let totalPending = 0;
                        driversList.forEach(driver => {
                          const driverPresentRecords = driverAttendanceList.filter(
                            a => a.driverId === driver.id && a.status === 'PRESENT'
                          );
                          const unpaidRecords = driverPresentRecords.filter(
                            rec => !driverSalaryPayouts.some(
                              p => p.attendanceRecordId === rec.id || 
                              (p.driverId === driver.id && rec.date <= p.payoutDate.split('T')[0])
                            )
                          );
                          totalPending += unpaidRecords.length * 45.00;
                        });
                        return totalPending.toLocaleString(undefined, { minimumFractionDigits: 2 });
                      })()}
                    </h3>
                    <span className="text-[9px] text-slate-500">Estimated outstanding daily pay</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                    <AlertTriangle size={20} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between border-brand-500/10 shadow-brand-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Driver Registry</p>
                    <h3 className="text-xl font-extrabold text-brand-400">
                      {driversList.length} Active
                    </h3>
                    <span className="text-[9px] text-slate-500">Total transport operators</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-400">
                    <Users size={20} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between border-rose-500/10 shadow-rose-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Attendance Logs</p>
                    <h3 className="text-xl font-extrabold text-rose-455">
                      {driverAttendanceList.length}
                    </h3>
                    <span className="text-[9px] text-slate-500">Attendance records logged</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-450">
                    <Clock size={20} />
                  </div>
                </GlassCard>
              </div>
            )}

            {feesSubTab === 'payroll' && (
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <GlassCard className="p-4 flex items-center justify-between border-emerald-500/10 shadow-emerald-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Disbursed Payroll</p>
                    <h3 className="text-xl font-extrabold text-emerald-400">
                      {overview?.currencySymbol || '$'}{payrollRecords
                        .filter(p => p.payoutStatus === 'PAID')
                        .reduce((acc, p) => acc + (Number(p.netSalary) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[9px] text-slate-500">Total paid salaries</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
                    <CheckCircle size={20} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between border-amber-500/10 shadow-amber-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Outstanding Approvals</p>
                    <h3 className="text-xl font-extrabold text-amber-400">
                      {overview?.currencySymbol || '$'}{payrollRecords
                        .filter(p => p.payoutStatus === 'APPROVED' || p.payoutStatus === 'PENDING')
                        .reduce((acc, p) => acc + (Number(p.netSalary) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[9px] text-slate-500">Salaries awaiting disburse</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-400">
                    <AlertTriangle size={20} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between border-brand-500/10 shadow-brand-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Active Payrolls</p>
                    <h3 className="text-xl font-extrabold text-brand-400">
                      {payrollRecords.length} Entries
                    </h3>
                    <span className="text-[9px] text-slate-500">All ledger records this session</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center border border-brand-500/20 text-brand-400">
                    <CreditCard size={20} />
                  </div>
                </GlassCard>

                <GlassCard className="p-4 flex items-center justify-between border-rose-500/10 shadow-rose-500/5">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Total Payroll Budget</p>
                    <h3 className="text-xl font-extrabold text-rose-455">
                      {overview?.currencySymbol || '$'}{payrollRecords
                        .filter(p => p.payoutStatus !== 'CANCELLED')
                        .reduce((acc, p) => acc + (Number(p.netSalary) || 0), 0)
                        .toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </h3>
                    <span className="text-[9px] text-slate-500">Net active salary commitments</span>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 text-rose-450">
                    <Clock size={20} />
                  </div>
                </GlassCard>
              </div>
            )}

            {/* Invoices List and Student payments ledger view split */}
            {feesSubTab === 'billing' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Left Column: List of class-wide Invoices */}
              <div className="lg:col-span-1 space-y-4">
                <GlassCard className="p-5 space-y-4">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                    <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      <CreditCard className="text-brand-500" size={16} />
                      Class Billing Fees
                    </h3>
                    {(session?.user.role === 'FINANCE_ADMIN' || (session?.user.role === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true)) && (
                      <button
                        onClick={() => setShowAddFee(true)}
                        className="px-2.5 py-1 text-[10px] font-bold bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors flex items-center gap-1 active:scale-95"
                      >
                        <Plus size={12} />
                        Create Invoice
                      </button>
                    )}
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
                              <span className="text-xs font-extrabold text-slate-100 shrink-0">{overview.currencySymbol || '$'}{(Number(fs.amount) || 0).toFixed(2)}</span>
                            </div>

                            <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 border-t border-slate-850/60 pt-2">
                              <span>Due: {new Date(fs.dueDate).toLocaleDateString()}</span>
                              {(session?.user.role === 'FINANCE_ADMIN' || (session?.user.role === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true)) && (
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
                              )}
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
                              const balanceDue = status === 'PAID' ? 0.00 : ((Number(selectedFeeStructure.amount) || 0) + lateFee);
                              return (
                                <tr key={student.id} className="hover:bg-slate-900/10 text-slate-200">
                                  <td className="py-3 px-4">
                                    <div className="font-semibold text-slate-200">{formatUserName(student.userDetails) || 'Unknown Student'}</div>
                                    <div className="text-[9px] text-slate-500 font-mono">{student.admissionNumber || 'N/A'}</div>
                                  </td>
                                  <td className="py-3 px-4 text-slate-400">{student.rollNumber || '-'}</td>
                                  <td className="py-3 px-4">
                                    {payment && (Number(payment.amountPaid) || 0) > 0 ? (
                                      <div className="font-semibold text-emerald-400">{overview.currencySymbol || '$'}{(Number(payment.amountPaid) || 0).toFixed(2)}</div>
                                    ) : (
                                      <span className="text-slate-500">{overview.currencySymbol || '$'}0.00</span>
                                    )}
                                    {payment?.paymentDate && (
                                      <div className="text-[8px] text-slate-500 font-mono mt-0.5">{new Date(payment.paymentDate).toLocaleDateString()}</div>
                                    )}
                                  </td>
                                  <td className="py-3 px-4 font-mono font-bold text-slate-300">
                                    {overview.currencySymbol || '$'}{(Number(balanceDue) || 0).toFixed(2)}
                                    {lateFee > 0 && (
                                      <div className="text-[8px] text-rose-400 font-semibold mt-0.5">+ {overview.currencySymbol || '$'}15.00 Overdue Fee</div>
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
                                      {(session?.user.role === 'FINANCE_ADMIN' || (session?.user.role === 'ADMIN' && rbacPermissions['ADMIN']?.billing === true)) ? (
                                        status === 'PAID' ? (
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
                                        )
                                      ) : (
                                        <span className="px-2.5 py-1 text-[10px] font-bold text-slate-500 border border-slate-800 rounded-lg bg-slate-900/50 cursor-not-allowed select-none" title="Finance Admin permissions required to process payments">
                                          View Only
                                        </span>
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
          )}

            {/* Driver Attendance & Salary Payout Ledger */}
            {feesSubTab === 'drivers' && (
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
                </div>
                <div className="overflow-x-auto rounded-xl border border-slate-850">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 font-bold">
                        <th className="py-3 px-4">Driver Name</th>
                        <th className="py-3 px-4">License Number</th>
                        <th className="py-3 px-4">Days Present (Total)</th>
                        <th className="py-3 px-4">Unpaid Days</th>
                        <th className="py-3 px-4">Pending Payout</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {driversList.map(driver => {
                        const driverPresentRecords = driverAttendanceList.filter(
                          a => a.driverId === driver.id && a.status === 'PRESENT'
                        );
                        const unpaidRecords = driverPresentRecords.filter(
                          rec => !driverSalaryPayouts.some(
                            p => p.attendanceRecordId === rec.id || 
                            (p.driverId === driver.id && rec.date <= p.payoutDate.split('T')[0])
                          )
                        );
                        const presentCount = driverPresentRecords.length;
                        const unpaidCount = unpaidRecords.length;
                        const dailyRate = 45.00;
                        const pendingPayout = unpaidCount * dailyRate;

                        const isDisbursing = disbursingDriverId === driver.id;
                        const canDisburse = session?.user.role === 'FINANCE_ADMIN';

                        return (
                          <tr key={driver.id} className="hover:bg-slate-900/10 text-slate-200">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-200">{driver.status === 'INACTIVE' ? `Former Driver - ${driver.name}` : driver.name}</div>
                              <div className="text-[9px] text-slate-500 font-mono">
                                {driver.employeeId ? `Emp ID: ${driver.employeeId} | ` : ''}Phone: {driver.phone || 'N/A'}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-400 font-mono">{driver.licenseNumber}</td>
                            <td className="py-3 px-4">
                              <span className="font-semibold text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                                {presentCount} Days
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`font-semibold font-mono px-2 py-0.5 rounded-full border text-[10px] ${
                                unpaidCount > 0 
                                  ? 'text-amber-400 bg-amber-500/5 border-amber-500/10'
                                  : 'text-slate-400 bg-slate-500/5 border-slate-500/10'
                              }`}>
                                {unpaidCount} Days
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-450 font-mono">{overview.currencySymbol || '$'}{dailyRate.toFixed(2)}/day</td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-100">{overview.currencySymbol || '$'}{pendingPayout.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right">
                              {canDisburse ? (
                                <button
                                  onClick={() => handleDisburseDriverSalary(driver.id, pendingPayout, unpaidRecords[0]?.id || null)}
                                  disabled={pendingPayout === 0 || isDisbursing}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
                                    pendingPayout === 0 || isDisbursing
                                      ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 active:scale-95'
                                  }`}
                                >
                                  {isDisbursing ? 'Disbursing...' : 'Disburse Salary'}
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-500 italic">No Perms</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      {driversList.length === 0 && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                            No active drivers registered in the system.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>

              {/* Sleek Payout Disbursement History Ledger */}
              <GlassCard className="p-5 border border-slate-850 bg-slate-900/20 mt-6">
                <div className="flex items-center justify-between border-b border-slate-850 pb-3 mb-4">
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                      <Clock className="text-emerald-450" size={16} />
                      Salary Payout & Disbursement History Ledger
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Real-time ledger audit trail of all disbursed driver salaries</p>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-450 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                    {driverSalaryPayouts.length} Payments Disbursed
                  </span>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-850">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 bg-slate-900/30 text-slate-400 font-bold">
                        <th className="py-3 px-4">Transaction Ref</th>
                        <th className="py-3 px-4">Driver Name</th>
                        <th className="py-3 px-4">Disbursed Amount</th>
                        <th className="py-3 px-4">Payout Date</th>
                        <th className="py-3 px-4">Notes</th>
                        <th className="py-3 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/60">
                      {driverSalaryPayouts.map(payout => {
                        const driver = driversList.find(d => d.id === payout.driverId);
                        const displayName = driver
                          ? (driver.status === 'INACTIVE' ? `Former Driver - ${driver.name}` : driver.name)
                          : (payout.driverName ? `Former Driver - ${payout.driverName}` : 'Unknown Driver');

                        const empId = driver ? (driver.employeeId) : payout.driverEmployeeId;
                        const license = driver ? (driver.licenseNumber) : payout.driverLicenseNumber;
                        const phone = driver ? (driver.phone) : payout.driverPhone;

                        return (
                          <tr key={payout.id} className="hover:bg-slate-900/10 text-slate-200">
                            <td className="py-3 px-4 font-mono font-semibold text-brand-400">{payout.transactionReference || 'TXP-PENDING'}</td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-200">{displayName}</div>
                              {(empId || license || phone) && (
                                <div className="text-[10px] text-slate-500 mt-0.5">
                                  {empId && <span>Emp ID: {empId} </span>}
                                  {license && <span>| Lic: {license} </span>}
                                  {phone && <span>| Phone: {phone}</span>}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-emerald-400">${(Number(payout.payoutAmount) || 0).toFixed(2)}</td>
                            <td className="py-3 px-4 text-slate-400 font-mono">{new Date(payout.payoutDate).toLocaleString()}</td>
                            <td className="py-3 px-4 text-slate-400 max-w-xs truncate">{payout.notes || 'Daily salary disburse'}</td>
                            <td className="py-3 px-4 text-right">
                              <span className="font-semibold text-emerald-400 font-mono bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10 text-[9px]">
                                {payout.payoutStatus}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                      {driverSalaryPayouts.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                            No salary payouts disbursed yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

            {/* Teacher & Staff Payroll Dashboard */}
            {feesSubTab === 'payroll' && (
              <div className="space-y-6">
                <GlassCard className="p-5 space-y-4">
                  {/* Title and control headers */}
                  <div className="border-b border-slate-850 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                        <UsersRound className="text-brand-500" size={16} />
                        Employee Salary & Payroll Ledger
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Manage institutional salaries, structure allowances/deductions, and process disbursements for Teachers and Staff.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={printPayrollPDF}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-xs font-bold text-slate-300 hover:border-slate-650 hover:text-slate-200 transition-colors flex items-center gap-1.5"
                      >
                        <Printer size={13} />
                        Print/PDF Report
                      </button>
                      <button
                        onClick={exportPayrollToCSV}
                        className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/50 text-xs font-bold text-slate-300 hover:border-slate-650 hover:text-slate-200 transition-colors flex items-center gap-1.5"
                      >
                        <Download size={13} />
                        Export CSV
                      </button>
                      <button
                        onClick={() => setShowCreatePayrollModal(true)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-500 text-white transition-colors flex items-center gap-1 active:scale-95 shadow-lg shadow-brand-500/10"
                      >
                        <Plus size={13} />
                        Create Payroll Entry
                      </button>
                    </div>
                  </div>

                  {/* Filter panel */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Search Employee</label>
                      <input
                        type="text"
                        placeholder="Search by name, ID, role..."
                        value={payrollSearch}
                        onChange={(e) => setPayrollSearch(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Employee Type</label>
                      <select
                        value={payrollTypeFilter}
                        onChange={(e) => setPayrollTypeFilter(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-200"
                      >
                        <option value="ALL">All Types</option>
                        <option value="TEACHER">Teachers</option>
                        <option value="STAFF">Administrative Staff</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Status</label>
                      <select
                        value={payrollStatusFilter}
                        onChange={(e) => setPayrollStatusFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-200"
                      >
                        <option value="ALL">All Statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="PAID">Paid</option>
                        <option value="CANCELLED">Cancelled</option>
                        <option value="REVERSED">Reversed</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold text-slate-500 uppercase">Month Filter</label>
                      <input
                        type="month"
                        value={payrollMonthFilter}
                        onChange={(e) => setPayrollMonthFilter(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none focus:border-brand-500 text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Payroll Table */}
                  <div className="overflow-x-auto rounded-xl border border-slate-850">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                          <th className="py-3 px-4">Employee Details</th>
                          <th className="py-3 px-4">Month</th>
                          <th className="py-3 px-4">Base Salary</th>
                          <th className="py-3 px-4">Allowances</th>
                          <th className="py-3 px-4">Deductions</th>
                          <th className="py-3 px-4">Net Salary</th>
                          <th className="py-3 px-4">Ref / Details</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/60 text-slate-200">
                        {payrollRecords
                          .filter(r => {
                            const matchesSearch = r.employeeName.toLowerCase().includes(payrollSearch.toLowerCase()) ||
                              (r.employeeIdNumber && r.employeeIdNumber.toLowerCase().includes(payrollSearch.toLowerCase())) ||
                              r.employeeRole.toLowerCase().includes(payrollSearch.toLowerCase());
                            const matchesType = payrollTypeFilter === 'ALL' || r.employeeType === payrollTypeFilter;
                            const matchesStatus = payrollStatusFilter === 'ALL' || r.payoutStatus === payrollStatusFilter;
                            const matchesMonth = !payrollMonthFilter || r.payoutMonth === payrollMonthFilter;
                            return matchesSearch && matchesType && matchesStatus && matchesMonth;
                          })
                          .map(p => {
                            const isAuthorized = session?.user.role === 'FINANCE_ADMIN';
                            return (
                              <tr key={p.id} className="hover:bg-slate-900/10">
                                <td className="py-3 px-4">
                                  <div className="font-semibold text-slate-100">{p.employeeName}</div>
                                  <div className="text-[10px] text-slate-500 mt-0.5">
                                    <span className="font-bold text-slate-400">{p.employeeRole}</span>
                                    {p.employeeIdNumber && ` | ID: ${p.employeeIdNumber}`}
                                    {p.employeePhone && ` | Phone: ${p.employeePhone}`}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono text-slate-350">{p.payoutMonth}</td>
                                <td className="py-3 px-4 font-mono">${(Number(p.baseSalary) || 0).toFixed(2)}</td>
                                <td className="py-3 px-4 font-mono text-emerald-450">+${(Number(p.allowances) || 0).toFixed(2)}</td>
                                <td className="py-3 px-4 font-mono text-rose-455">-${(Number(p.deductions) || 0).toFixed(2)}</td>
                                <td className="py-3 px-4 font-mono font-bold text-brand-400">${(Number(p.netSalary) || 0).toFixed(2)}</td>
                                <td className="py-3 px-4 text-slate-400 font-mono text-[10px] max-w-xs truncate">
                                  {p.transactionReference ? (
                                    <div>
                                      <span className="font-bold text-emerald-400">{p.transactionReference}</span>
                                      {p.payoutDate && <div className="text-[8px] text-slate-500">{new Date(p.payoutDate).toLocaleDateString()}</div>}
                                    </div>
                                  ) : (
                                    p.notes || '-'
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border font-mono ${
                                    p.payoutStatus === 'PAID'
                                      ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10'
                                      : p.payoutStatus === 'APPROVED'
                                      ? 'bg-blue-500/5 text-blue-400 border-blue-500/10'
                                      : p.payoutStatus === 'PENDING'
                                      ? 'bg-amber-500/5 text-amber-400 border-amber-500/10'
                                      : p.payoutStatus === 'REVERSED'
                                      ? 'bg-purple-500/5 text-purple-400 border-purple-500/10'
                                      : 'bg-rose-500/5 text-rose-450 border-rose-500/10'
                                  }`}>
                                    {p.payoutStatus}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isAuthorized ? (
                                      <>
                                        {p.payoutStatus === 'PENDING' && (
                                          <>
                                            <button
                                              onClick={() => handleUpdatePayrollStatus(p.id, 'APPROVED')}
                                              className="px-2 py-0.5 rounded bg-blue-650 hover:bg-blue-550 text-white text-[10px] font-bold transition-all"
                                            >
                                              Approve
                                            </button>
                                            <button
                                              onClick={() => handleUpdatePayrollStatus(p.id, 'CANCELLED')}
                                              className="px-2 py-0.5 rounded border border-rose-500/20 hover:bg-rose-500/10 text-rose-455 text-[10px] font-bold transition-all"
                                            >
                                              Cancel
                                            </button>
                                          </>
                                        )}
                                        {p.payoutStatus === 'APPROVED' && (
                                          <button
                                            onClick={() => {
                                              setSelectedPayrollRecord(p);
                                              setPayrollDisburseNotes('Monthly salary disburse');
                                              setShowPayrollDisburseModal(true);
                                            }}
                                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold transition-all"
                                          >
                                            Disburse
                                          </button>
                                        )}
                                        {p.payoutStatus === 'PAID' && (
                                          <button
                                            onClick={() => handleUpdatePayrollStatus(p.id, 'REVERSED')}
                                            className="px-2 py-0.5 rounded border border-purple-500/20 hover:bg-purple-500/10 text-purple-450 text-[10px] font-bold transition-all"
                                          >
                                            Reverse
                                          </button>
                                        )}
                                        {p.payoutStatus === 'CANCELLED' && (
                                          <span className="text-[10px] text-slate-500 italic">No actions</span>
                                        )}
                                        {p.payoutStatus === 'REVERSED' && (
                                          <button
                                            onClick={() => handleUpdatePayrollStatus(p.id, 'PENDING')}
                                            className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-white text-[10px] font-bold transition-all"
                                          >
                                            Reset
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleDeletePayroll(p.id)}
                                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors rounded hover:bg-slate-900/40"
                                          title="Delete Payroll Record"
                                        >
                                          <Trash2 size={12} />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[10px] text-slate-500 italic flex items-center gap-1">
                                        <Lock size={10} /> View Only
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        {payrollRecords.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-slate-500 font-mono text-xs">
                              No payroll records found. Click "Create Payroll Entry" to disburse salary.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* ── PAYMENT SETTINGS SUB-TAB ── */}
            {feesSubTab === 'payment-settings' && (
              <div className="space-y-5 animate-fade-in">
                {paySettingsLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : (
                  <>
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                          <Banknote className="text-violet-400" size={18} />
                          School Payment Gateway Settings
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-0.5">Configure how parents can pay fees — QR code, bank transfer, and visibility controls.</p>
                      </div>
                      {paySettingsMsg && (
                        <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                          paySettingsMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        }`}>
                          {paySettingsMsg.text}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Left: QR Code Panel */}
                      <GlassCard className="p-5 space-y-4">
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          <QrCode className="text-violet-400" size={15} />
                          QR Code Payment
                          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            psQrEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                          }`}>{psQrEnabled ? 'Enabled' : 'Disabled'}</span>
                        </h4>

                        {/* QR Upload Area */}
                        <div className="relative">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">QR Code Image</label>
                          <div
                            className="w-full h-40 rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500/50 transition-colors flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 overflow-hidden"
                            onClick={() => document.getElementById('ps-qr-upload')?.click()}
                          >
                            {psQrPreview ? (
                              <img src={psQrPreview} alt="QR Code" className="h-36 w-36 object-contain rounded-lg" />
                            ) : (
                              <div className="text-center space-y-1">
                                <ScanLine className="mx-auto text-slate-600" size={28} />
                                <p className="text-[11px] text-slate-500">Click to upload QR image</p>
                                <p className="text-[10px] text-slate-600">PNG, JPG up to 2MB</p>
                              </div>
                            )}
                          </div>
                          <input
                            id="ps-qr-upload"
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setPsQrFile(file);
                                const reader = new FileReader();
                                reader.onload = (ev) => setPsQrPreview(ev.target?.result as string);
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        </div>

                        {/* UPI ID */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">UPI ID</label>
                          <input
                            type="text"
                            value={psUpiId}
                            onChange={(e) => setPsUpiId(e.target.value)}
                            placeholder="e.g. schoolname@oksbi"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500 transition-colors"
                          />
                        </div>

                        {/* Toggle Controls */}
                        <div className="space-y-2 pt-1">
                          {([
                            { label: 'Enable QR Payments', state: psQrEnabled, set: setPsQrEnabled },
                            { label: 'Show QR Code to Parents', state: psShowQrToParents, set: setPsShowQrToParents },
                          ] as { label: string; state: boolean; set: (v: boolean) => void }[]).map(item => (
                            <div key={item.label} className="flex items-center justify-between">
                              <span className="text-xs text-slate-300">{item.label}</span>
                              <button
                                onClick={() => item.set(!item.state)}
                                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-all ${
                                  item.state ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'
                                }`}
                              >
                                {item.state ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                                {item.state ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </GlassCard>

                      {/* Right: Bank Transfer Panel */}
                      <GlassCard className="p-5 space-y-4">
                        <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                          <Banknote className="text-sky-400" size={15} />
                          Bank Transfer Details
                          <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            psBankEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                          }`}>{psBankEnabled ? 'Enabled' : 'Disabled'}</span>
                        </h4>

                        <div className="grid grid-cols-1 gap-3">
                          {([
                            { label: 'Account Holder Name', val: psAccHolder, set: setPsAccHolder, placeholder: 'School Trust Name' },
                            { label: 'Bank Name', val: psBankName, set: setPsBankName, placeholder: 'e.g. State Bank of India' },
                            { label: 'Account Number', val: psAccNumber, set: setPsAccNumber, placeholder: '•••• •••• ••••' },
                            { label: 'IFSC Code', val: psIfsc, set: setPsIfsc, placeholder: 'e.g. SBIN0001234' },
                            { label: 'Branch Name', val: psBranch, set: setPsBranch, placeholder: 'e.g. Main Branch' },
                            { label: 'SWIFT Code (optional)', val: psSwift, set: setPsSwift, placeholder: 'For international transfers' },
                          ] as { label: string; val: string; set: (v: string) => void; placeholder: string }[]).map(f => (
                            <div key={f.label}>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">{f.label}</label>
                              <input
                                type="text"
                                value={f.val}
                                onChange={(e) => f.set(e.target.value)}
                                placeholder={f.placeholder}
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-sky-500 transition-colors"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Toggle Controls */}
                        <div className="space-y-2 pt-1">
                          {([
                            { label: 'Enable Bank Transfers', state: psBankEnabled, set: setPsBankEnabled },
                            { label: 'Show Bank Details to Parents', state: psShowBankToParents, set: setPsShowBankToParents },
                            { label: 'Require UTR/Screenshot Upload', state: psUtrUpload, set: setPsUtrUpload },
                            { label: 'Auto-Remind Unpaid Students', state: psAutoRemind, set: setPsAutoRemind },
                          ] as { label: string; state: boolean; set: (v: boolean) => void }[]).map(item => (
                            <div key={item.label} className="flex items-center justify-between">
                              <span className="text-xs text-slate-300">{item.label}</span>
                              <button
                                onClick={() => item.set(!item.state)}
                                className={`flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg transition-all ${
                                  item.state ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-500 bg-slate-800'
                                }`}
                              >
                                {item.state ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                                {item.state ? 'ON' : 'OFF'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </GlassCard>
                    </div>

                    {/* Payment Instructions */}
                    <GlassCard className="p-5 space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                        <Info size={12} className="text-slate-500" /> Payment Instructions for Parents
                      </label>
                      <textarea
                        rows={3}
                        value={psInstructions}
                        onChange={(e) => setPsInstructions(e.target.value)}
                        placeholder="e.g. Please make payment to the account above and upload your payment receipt. Include your ward's roll number in the description."
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-violet-500 resize-none transition-colors"
                      />
                    </GlassCard>

                    {/* Save Button */}
                    <div className="flex justify-end">
                      <button
                        disabled={paySettingsSaving}
                        onClick={async () => {
                          setPaySettingsSaving(true);
                          setPaySettingsMsg(null);
                          try {
                            const saved = await mockApi.saveSchoolPaymentSettings(
                              adminId || '',
                              session?.user.schoolId || '',
                              {
                                accountHolderName: psAccHolder,
                                bankName: psBankName,
                                accountNumber: psAccNumber,
                                ifscCode: psIfsc,
                                branchName: psBranch,
                                swiftCode: psSwift,
                                upiId: psUpiId,
                                paymentInstructions: psInstructions,
                                qrPaymentEnabled: psQrEnabled,
                                bankTransferEnabled: psBankEnabled,
                                showQrToParents: psShowQrToParents,
                                showBankToParents: psShowBankToParents,
                                enableUtrUpload: psUtrUpload,
                                autoRemindUnpaid: psAutoRemind,
                              },
                              psQrFile
                            );
                            setSchoolPaySettings(saved);
                            setPsQrFile(null);
                            setPaySettingsMsg({ type: 'success', text: '✓ Payment settings saved successfully' });
                            setTimeout(() => setPaySettingsMsg(null), 4000);
                          } catch (err: any) {
                            setPaySettingsMsg({ type: 'error', text: err?.message || 'Failed to save settings' });
                          }
                          setPaySettingsSaving(false);
                        }}
                        className="glass-btn-primary flex items-center gap-2 text-xs"
                      >
                        {paySettingsSaving ? (
                          <><div className="w-3.5 h-3.5 border border-white/60 border-t-transparent rounded-full animate-spin" /> Saving...</>
                        ) : (
                          <><ShieldCheck size={14} /> Save Payment Settings</>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── VERIFY PAYMENTS SUB-TAB ── */}
            {feesSubTab === 'verify-payments' && (
              <div className="space-y-5 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-100 flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/20 flex items-center justify-center">
                        <ShieldCheck className="text-amber-400" size={15} />
                      </div>
                      Fee Payment Verification Queue
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-1 ml-[38px]">Review parent-submitted payment proofs. Approve or reject with a reason.</p>
                  </div>
                </div>

                {/* Stats row — 4 counters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'PENDING REVIEW', count: (feePayments || []).filter(p => p.status === 'PENDING' && p.paymentScreenshotUrl).length, numColor: 'text-amber-400', borderColor: 'border-t-amber-500', bgHover: 'hover:border-amber-500/40' },
                    { label: 'APPROVED', count: (feePayments || []).filter(p => p.status === 'PAID').length, numColor: 'text-emerald-400', borderColor: 'border-t-emerald-500', bgHover: 'hover:border-emerald-500/40' },
                    { label: 'REJECTED', count: (feePayments || []).filter(p => p.status === 'REJECTED').length, numColor: 'text-rose-400', borderColor: 'border-t-rose-500', bgHover: 'hover:border-rose-500/40' },
                    { label: 'TOTAL PAYMENTS', count: (feePayments || []).filter(p => p.paymentScreenshotUrl).length, numColor: 'text-cyan-400', borderColor: 'border-t-cyan-500', bgHover: 'hover:border-cyan-500/40' },
                  ].map(stat => (
                    <div key={stat.label} className={`bg-[#0d1224] border border-slate-800/80 ${stat.borderColor} border-t-[3px] rounded-xl p-4 text-center transition-all ${stat.bgHover}`}>
                      <p className={`text-[26px] font-extrabold leading-tight ${stat.numColor}`}>{stat.count}</p>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.1em] mt-1.5">{stat.label}</p>
                    </div>
                  ))}
                </div>

                {/* Search + Status Filter + Export */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <div className="relative flex-1 w-full">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                    <input
                      type="text"
                      placeholder="Search by student / parent / admission no / UTR..."
                      value={verifySearch}
                      onChange={e => setVerifySearch(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-xs bg-[#0d1224] border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 transition-all placeholder-slate-600"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={verifyStatusFilter}
                      onChange={e => setVerifyStatusFilter(e.target.value as any)}
                      className="bg-[#0d1224] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500/50 cursor-pointer appearance-none min-w-[130px]"
                      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                    >
                      <option value="PENDING">Status: Pending</option>
                      <option value="ALL">Status: All</option>
                      <option value="PAID">Status: Approved</option>
                      <option value="REJECTED">Status: Rejected</option>
                    </select>
                    <button
                      className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0d1224] border border-slate-800 rounded-xl text-xs text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all"
                      onClick={() => {
                        const csvRows = ['Student,Class,Fee Head,Invoice No,Amount,UTR,Status,Submitted'];
                        (feePayments || []).filter(p => p.paymentScreenshotUrl).forEach(p => {
                          const st = students.find(s => s.id === p.studentId);
                          const stName = st ? formatUserName(st.userDetails) : '';
                          const cls = classes.find(c => c.id === st?.classId);
                          const fs = feeStructures.find(f => f.id === p.feeStructureId);
                          const invHash = p.feeStructureId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                          csvRows.push(`"${stName}","${cls?.name || ''}","${fs?.description || ''}","INV-2026-${String(invHash % 10000).padStart(4, '0')}","${p.amountPaid}","${p.utrNumber || p.transactionId || ''}","${p.status}","${p.createdAt ? new Date(p.createdAt).toLocaleString() : ''}"`);
                        });
                        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url; a.download = 'fee_payments_export.csv'; a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download size={13} />
                      Export
                    </button>
                  </div>
                </div>

                {/* Main content area: Table + Side Panel */}
                <div className="flex gap-4 items-start">
                  {/* Left: Verification Queue Table */}
                  <div className={`flex-1 min-w-0 transition-all duration-300 ${verifySelectedPayment ? 'max-w-[calc(100%-370px)]' : ''}`}>
                    {(() => {
                      const allProofs = (feePayments || [])
                        .filter(p => p.paymentScreenshotUrl)
                        .filter(p => {
                          if (verifyStatusFilter === 'ALL') return true;
                          if (verifyStatusFilter === 'PENDING') return p.status === 'PENDING';
                          if (verifyStatusFilter === 'PAID') return p.status === 'PAID';
                          if (verifyStatusFilter === 'REJECTED') return p.status === 'REJECTED';
                          return true;
                        })
                        .filter(p => {
                          if (!verifySearch) return true;
                          const q = verifySearch.toLowerCase();
                          const student = students.find(s => s.id === p.studentId);
                          const name = student ? formatUserName(student.userDetails).toLowerCase() : '';
                          const utr = (p.utrNumber || p.transactionId || '').toLowerCase();
                          const admNo = (student?.admissionNumber || '').toLowerCase();
                          const mapping = mockDb.parentStudentMappings.find(m => m.studentId === p.studentId);
                          const parent = mapping ? parents.find(pr => pr.id === mapping.parentId) : null;
                          const parentName = parent ? formatUserName(parent.userDetails).toLowerCase() : '';
                          const structure = feeStructures.find(f => f.id === p.feeStructureId);
                          const feeHead = (structure?.description || '').toLowerCase();
                          return name.includes(q) || utr.includes(q) || parentName.includes(q) || admNo.includes(q) || feeHead.includes(q);
                        })
                        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                      // Pagination
                      const pageSize = 5;
                      const totalPages = Math.max(1, Math.ceil(allProofs.length / pageSize));
                      const currentPage = Math.min(totalPages, Math.max(1, 1)); // future: can add state for page
                      const pagedProofs = allProofs.slice((currentPage - 1) * pageSize, currentPage * pageSize);

                      if (allProofs.length === 0) {
                        return (
                          <div className="bg-[#0d1224] border border-slate-800 rounded-xl p-14 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-slate-800/50 mx-auto mb-4 flex items-center justify-center">
                              <ShieldCheck className="text-emerald-400/40" size={32} />
                            </div>
                            <p className="text-slate-300 font-semibold text-sm">No payment records found</p>
                            <p className="text-slate-600 text-xs mt-1.5">
                              {verifyStatusFilter === 'PENDING' ? 'All submitted payments have been reviewed ✓' : 'No matching records for the current filter'}
                            </p>
                          </div>
                        );
                      }

                      return (
                        <div className="bg-[#0d1224] border border-slate-800 rounded-xl overflow-hidden">
                          {/* Table */}
                          <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-slate-800/80">
                                  {['STUDENT / PARENT', 'CLASS', 'FEE HEAD', 'INVOICE NO.', 'AMOUNT', 'UTR NUMBER', 'SUBMITTED ON', 'STATUS', 'ACTION'].map(h => (
                                    <th key={h} className="text-left py-3.5 px-3 text-[9px] font-bold text-slate-500 uppercase tracking-[0.08em] whitespace-nowrap">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {pagedProofs.map((payment, idx) => {
                                  const student = students.find(s => s.id === payment.studentId);
                                  const studentClass = classes.find(c => c.id === student?.classId);
                                  const mapping = mockDb.parentStudentMappings.find(m => m.studentId === payment.studentId);
                                  const parentRecord = mapping ? parents.find(pr => pr.id === mapping.parentId) : null;
                                  const studentName = student ? formatUserName(student.userDetails) || 'Unknown' : 'Unknown';
                                  const parentName = parentRecord ? formatUserName(parentRecord.userDetails) : '';
                                  const initials = studentName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                                  const isSelected = verifySelectedPayment?.id === payment.id;
                                  const structure = feeStructures.find(f => f.id === payment.feeStructureId);
                                  const invHash = payment.feeStructureId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                                  const invoiceNo = `INV-2026-${String(invHash % 10000).padStart(4, '0')}`;

                                  return (
                                    <tr
                                      key={payment.id}
                                      onClick={() => { setVerifySelectedPayment(payment); setRejectReason(''); setVerifyReceiptFullscreen(false); }}
                                      className={`cursor-pointer transition-all duration-150 group border-l-[3px] ${
                                        isSelected
                                          ? 'bg-cyan-500/[0.04] border-l-cyan-400 shadow-[inset_0_0_30px_rgba(34,211,238,0.02)]'
                                          : 'hover:bg-slate-800/30 border-l-transparent'
                                      } ${idx !== pagedProofs.length - 1 ? 'border-b border-b-slate-800/50' : ''}`}
                                    >
                                      {/* Student / Parent */}
                                      <td className="py-3 px-3">
                                        <div className="flex items-center gap-2.5 min-w-[170px]">
                                          <div className="w-[36px] h-[36px] rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600/50 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-shrink-0 overflow-hidden shadow-sm">
                                            {/* Priority: photoUrl (student_profiles) → avatarUrl (users) → initials */}
                                            {((student as any)?.photoUrl || student?.userDetails?.avatarUrl) ? (
                                              <img src={(student as any).photoUrl || student!.userDetails!.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                                            ) : (
                                              initials
                                            )}
                                          </div>
                                          <div className="min-w-0">
                                            <p className="text-slate-100 font-semibold text-[11px] truncate leading-tight">{studentName}</p>
                                            {parentName && <p className="text-slate-500 text-[10px] truncate mt-0.5">Parent: {parentName}</p>}
                                            <p className="text-slate-600 text-[9px] font-mono mt-0.5">Adm No: {student?.admissionNumber || '—'}</p>
                                          </div>
                                        </div>
                                      </td>
                                      {/* Class */}
                                      <td className="py-3 px-3 text-slate-300 font-semibold whitespace-nowrap text-[11px]">{studentClass?.name || '—'}</td>
                                      {/* Fee Head */}
                                      <td className="py-3 px-3 whitespace-nowrap">
                                        <p className="text-slate-200 text-[11px] font-medium truncate max-w-[120px]">{structure?.description || '—'}</p>
                                      </td>
                                      {/* Invoice No. */}
                                      <td className="py-3 px-3 text-cyan-300/70 font-mono text-[10px] whitespace-nowrap">{invoiceNo}</td>
                                      {/* Amount */}
                                      <td className="py-3 px-3 text-slate-100 font-bold whitespace-nowrap text-[11px]">{overview?.currencySymbol || '₹'}{payment.amountPaid.toLocaleString()}</td>
                                      {/* UTR Number */}
                                      <td className="py-3 px-3 text-cyan-300/80 font-mono text-[10px] whitespace-nowrap">{payment.utrNumber || payment.transactionId || '—'}</td>
                                      {/* Submitted On */}
                                      <td className="py-3 px-3 whitespace-nowrap">
                                        <p className="text-slate-300 text-[10.5px]">{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</p>
                                        <p className="text-slate-600 text-[9px] mt-0.5">{payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : ''}</p>
                                      </td>
                                      {/* Status */}
                                      <td className="py-3 px-3">
                                        <span className={`inline-flex items-center text-[9px] font-bold px-2.5 py-1 rounded-full border uppercase whitespace-nowrap tracking-wide ${
                                          payment.status === 'PENDING'
                                            ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                                            : payment.status === 'PAID'
                                              ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                                              : 'bg-rose-500/10 border-rose-500/25 text-rose-400'
                                        }`}>
                                          {payment.status === 'PAID' ? 'APPROVED' : payment.status}
                                        </span>
                                      </td>
                                      {/* Action */}
                                      <td className="py-3 px-3">
                                        <div className="flex items-center gap-1.5">
                                          <button
                                            onClick={e => { e.stopPropagation(); setVerifySelectedPayment(payment); setRejectReason(''); setVerifyReceiptFullscreen(false); }}
                                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-800 text-slate-500 hover:text-cyan-400 transition-all"
                                            title="View Details"
                                          >
                                            <Eye size={14} />
                                          </button>
                                          <ChevronRight size={14} className="text-slate-700 group-hover:text-slate-500 transition-colors" />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          {/* Footer with Pagination */}
                          <div className="px-4 py-3 border-t border-slate-800/80 flex items-center justify-between">
                            <p className="text-[10px] text-slate-600">
                              Showing {Math.min(pagedProofs.length, 1)} to {pagedProofs.length} of {allProofs.length} {verifyStatusFilter === 'PENDING' ? 'pending ' : ''}payments
                            </p>
                            <div className="flex items-center gap-1">
                              <button className="w-7 h-7 rounded-lg border border-slate-800 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:border-slate-700 transition-colors text-[11px]">&lt;</button>
                              {Array.from({ length: Math.min(totalPages, 3) }, (_, i) => (
                                <button key={i} className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-[11px] ${i === 0 ? 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-400' : 'border border-slate-800 text-slate-600 hover:text-slate-300 hover:border-slate-700 transition-colors'}`}>{i + 1}</button>
                              ))}
                              <button className="w-7 h-7 rounded-lg border border-slate-800 flex items-center justify-center text-slate-600 hover:text-slate-300 hover:border-slate-700 transition-colors text-[11px]">&gt;</button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right: Payment Details Side Panel */}
                  {verifySelectedPayment && (() => {
                    const sp = verifySelectedPayment;
                    const student = students.find(s => s.id === sp.studentId);
                    const studentClass = classes.find(c => c.id === student?.classId);
                    const structure = feeStructures.find(fs => fs.id === sp.feeStructureId);
                    const mapping = mockDb.parentStudentMappings.find(m => m.studentId === sp.studentId);
                    const parentRecord = mapping ? parents.find(pr => pr.id === mapping.parentId) : null;
                    const studentName = student ? formatUserName(student.userDetails) || 'Unknown' : 'Unknown';
                    const parentName = parentRecord ? formatUserName(parentRecord.userDetails) : '—';
                    const parentPhone = parentRecord?.userDetails?.phone || student?.userDetails?.phone || '—';
                    const initials = studentName.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
                    const isActing = verifyActionId === sp.id;
                    const invHash = sp.feeStructureId.split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
                    const invoiceNo = `INV-2026-${String(invHash % 10000).padStart(4, '0')}`;

                    return (
                      <div className="w-[350px] flex-shrink-0 bg-[#0a0e1a] border border-slate-800 rounded-xl overflow-hidden animate-fade-in shadow-xl shadow-black/20">
                        {/* Panel Header */}
                        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#0d1224]">
                          <h4 className="font-bold text-slate-100 text-[13px]">Payment Details</h4>
                          <button onClick={() => setVerifySelectedPayment(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors">
                            <X size={15} />
                          </button>
                        </div>

                        <div className="p-5 space-y-5 max-h-[calc(100vh-280px)] overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
                          {/* 1. Student Information */}
                          <div>
                            <h5 className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
                              <div className="w-1 h-3 rounded-full bg-cyan-400" />
                              Student Information
                            </h5>
                            <div className="flex items-start gap-3.5">
                              <div className="w-[48px] h-[48px] rounded-full bg-gradient-to-br from-slate-700 to-slate-800 border-2 border-slate-600/40 flex items-center justify-center text-xs font-bold text-slate-300 flex-shrink-0 overflow-hidden shadow-md">
                                {/* Priority: photoUrl (student_profiles) → avatarUrl (users) → initials */}
                                {((student as any)?.photoUrl || student?.userDetails?.avatarUrl) ? (
                                  <img src={(student as any).photoUrl || student!.userDetails!.avatarUrl} alt="" className="w-full h-full object-cover rounded-full" onError={(e) => { (e.target as HTMLImageElement).style.display='none'; }} />
                                ) : (
                                  initials
                                )}
                              </div>
                              <div className="space-y-1 flex-1 min-w-0">
                                <p className="text-[13px] font-bold text-slate-100 leading-tight">{studentName}</p>
                                <p className="text-[10.5px] text-slate-500">Admission No: <span className="text-slate-400 font-mono">{student?.admissionNumber || '—'}</span></p>
                                <p className="text-[10.5px] text-slate-500">Class: <span className="text-slate-400">{studentClass?.name || '—'}</span></p>
                                <p className="text-[10.5px] text-slate-500">Parent Name: <span className="text-slate-400">{parentName}</span></p>
                                <p className="text-[10.5px] text-slate-500">Contact: <span className="text-slate-400 font-mono">{parentPhone}</span></p>
                              </div>
                            </div>
                          </div>

                          {/* 2. Fee Information */}
                          <div>
                            <h5 className="text-[10px] font-bold text-amber-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
                              <div className="w-1 h-3 rounded-full bg-amber-400" />
                              Fee Information
                            </h5>
                            <div className="space-y-2 text-[11px]">
                              {[
                                { label: 'Fee Head', value: structure?.description || '—' },
                                { label: 'Invoice No', value: invoiceNo, mono: true },
                                { label: 'Amount', value: `${overview?.currencySymbol || '₹'}${sp.amountPaid.toLocaleString()}`, highlight: true },
                                { label: 'Due Date', value: structure?.dueDate ? new Date(structure.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
                              ].map(item => (
                                <div key={item.label} className="flex items-start justify-between gap-3">
                                  <span className="text-slate-500 whitespace-nowrap text-[11px]">{item.label}:</span>
                                  <span className={`text-right ${item.highlight ? 'text-slate-100 font-bold' : 'text-slate-300'} ${item.mono ? 'font-mono text-[10.5px]' : ''}`}>
                                    {item.value}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 3. Payment Information */}
                          <div>
                            <h5 className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
                              <div className="w-1 h-3 rounded-full bg-violet-400" />
                              Payment Information
                            </h5>
                            <div className="space-y-2 text-[11px]">
                              {[
                                { label: 'UTR Number', value: sp.utrNumber || sp.transactionId || '—', mono: true, copy: true },
                                { label: 'Payment Method', value: sp.paymentMethod || 'UPI' },
                                { label: 'Submitted On', value: sp.createdAt ? `${new Date(sp.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}, ${new Date(sp.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : '—' },
                              ].map(item => (
                                <div key={item.label} className="flex items-start justify-between gap-3">
                                  <span className="text-slate-500 whitespace-nowrap text-[11px]">{item.label}:</span>
                                  <span className={`text-right flex items-center gap-1 text-slate-300 ${item.mono ? 'font-mono text-[10.5px]' : ''}`}>
                                    {item.value}
                                    {item.copy && sp.utrNumber && (
                                      <button
                                        onClick={() => { navigator.clipboard.writeText(sp.utrNumber || ''); }}
                                        className="ml-1 text-slate-600 hover:text-cyan-400 transition-colors flex-shrink-0"
                                        title="Copy UTR"
                                      >
                                        <ExternalLink size={10} />
                                      </button>
                                    )}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* 4. Payment Proof */}
                          <div>
                            <h5 className="text-[10px] font-bold text-emerald-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
                              <div className="w-1 h-3 rounded-full bg-emerald-400" />
                              Payment Proof (Screenshot / Receipt)
                            </h5>
                            {sp.paymentScreenshotUrl ? (
                              <div className="space-y-2">
                                <div className="flex gap-3 items-start">
                                  <div
                                    className="relative w-[120px] h-[140px] flex-shrink-0 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-900 cursor-pointer group/proof hover:border-cyan-500/40 transition-all"
                                    onClick={() => setVerifyReceiptFullscreen(true)}
                                  >
                                    <img
                                      src={sp.paymentScreenshotUrl}
                                      alt="Payment Proof"
                                      className="w-full h-full object-cover"
                                      onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const parent = target.parentElement;
                                        if (parent) {
                                          const fallback = document.createElement('div');
                                          fallback.className = 'absolute inset-0 flex items-center justify-center text-slate-600';
                                          fallback.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>';
                                          parent.appendChild(fallback);
                                        }
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/proof:opacity-100 transition-opacity" />
                                  </div>
                                  <div className="flex flex-col gap-2 pt-1">
                                    <button
                                      onClick={() => setVerifyReceiptFullscreen(true)}
                                      className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-cyan-400 transition-colors font-medium"
                                    >
                                      <Eye size={13} />
                                      View Full Size
                                    </button>
                                    <button
                                      onClick={() => {
                                        const link = document.createElement('a');
                                        link.href = sp.paymentScreenshotUrl || '';
                                        link.download = `receipt-${sp.utrNumber || sp.id}.png`;
                                        link.target = '_blank';
                                        link.click();
                                      }}
                                      className="flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-emerald-400 transition-colors font-medium"
                                    >
                                      <Download size={13} />
                                      Download
                                    </button>
                                  </div>
                                </div>
                                <p className="text-[9px] text-slate-600 italic">Click on image to preview full size</p>
                              </div>
                            ) : (
                              <div className="w-full py-8 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 flex flex-col items-center gap-2">
                                <Image className="text-slate-700" size={24} />
                                <p className="text-[10px] text-slate-600">No screenshot uploaded</p>
                              </div>
                            )}
                          </div>

                          {/* 5. Actions */}
                          <div>
                            <h5 className="text-[10px] font-bold text-rose-400 uppercase tracking-[0.1em] mb-3 flex items-center gap-1.5">
                              <div className="w-1 h-3 rounded-full bg-rose-400" />
                              Actions
                            </h5>
                            {sp.status === 'PENDING' ? (
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <button
                                    disabled={isActing}
                                    onClick={async () => {
                                      setVerifyActionId(sp.id);
                                      try {
                                        await mockApi.verifyFeePayment(adminId || '', sp.id, 'PAID');
                                        const updated = await mockApi.adminGetFeePayments();
                                        setFeePayments(updated);
                                        setVerifySelectedPayment(null);
                                      } catch (e: any) {
                                        alert(e?.message || 'Failed to approve payment');
                                      }
                                      setVerifyActionId(null);
                                    }}
                                    className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/20 hover:border-emerald-500/40 transition-all disabled:opacity-50 active:scale-[0.97]"
                                  >
                                    {isActing ? <div className="w-3.5 h-3.5 border-2 border-emerald-400/60 border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={13} />}
                                    Approve Payment
                                  </button>
                                  <button
                                    disabled={isActing}
                                    onClick={async () => {
                                      if (!rejectReason.trim()) {
                                        alert('Please enter a rejection reason before rejecting.');
                                        return;
                                      }
                                      setVerifyActionId(sp.id);
                                      try {
                                        await mockApi.verifyFeePayment(adminId || '', sp.id, 'REJECTED', rejectReason.trim());
                                        const updated = await mockApi.adminGetFeePayments();
                                        setFeePayments(updated);
                                        setVerifySelectedPayment(null);
                                        setRejectReason('');
                                      } catch (e: any) {
                                        alert(e?.message || 'Failed to reject payment');
                                      }
                                      setVerifyActionId(null);
                                    }}
                                    className="flex items-center justify-center gap-1.5 text-[11px] font-bold py-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 hover:border-rose-500/40 transition-all disabled:opacity-50 active:scale-[0.97]"
                                  >
                                    {isActing ? <div className="w-3.5 h-3.5 border-2 border-rose-400/60 border-t-transparent rounded-full animate-spin" /> : <XCircle size={13} />}
                                    Reject Payment
                                  </button>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-500 block mb-1.5">
                                    <span className="font-bold">Rejection Reason</span> <span className="text-slate-600 font-normal">(Required if rejecting)</span>
                                  </label>
                                  <input
                                    type="text"
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                    placeholder="Enter reason for rejection..."
                                    className="w-full bg-[#0d1224] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/20 transition-all placeholder-slate-700"
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="text-center py-4 rounded-xl bg-slate-900/40 border border-slate-800">
                                <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${sp.status === 'PAID' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {sp.status === 'PAID' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                                  {sp.status === 'PAID' ? 'Payment Approved' : 'Payment Rejected'}
                                </div>
                                {sp.rejectionReason && (
                                  <p className="text-[10px] text-rose-400/70 italic mt-1.5 px-4">{sp.rejectionReason}</p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Receipt Fullscreen Lightbox */}
                {verifyReceiptFullscreen && verifySelectedPayment?.paymentScreenshotUrl && (
                  <div
                    className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-6 animate-fade-in"
                    onClick={() => setVerifyReceiptFullscreen(false)}
                  >
                    <div className="relative max-w-3xl max-h-[85vh] w-full" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setVerifyReceiptFullscreen(false)}
                        className="absolute -top-3 -right-3 z-10 w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-lg"
                      >
                        <X size={16} />
                      </button>
                      <img
                        src={verifySelectedPayment.paymentScreenshotUrl}
                        alt="Payment Receipt Full Size"
                        className="w-full h-full object-contain rounded-xl border border-slate-700 shadow-2xl"
                      />
                      <div className="flex items-center justify-center gap-4 mt-3">
                        <p className="text-[11px] text-slate-500">UTR: <span className="font-mono text-slate-400">{verifySelectedPayment.utrNumber || verifySelectedPayment.transactionId || '—'}</span></p>
                        <button
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = verifySelectedPayment.paymentScreenshotUrl || '';
                            link.download = `receipt-${verifySelectedPayment.utrNumber || verifySelectedPayment.id}.png`;
                            link.target = '_blank';
                            link.click();
                          }}
                          className="flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors font-medium"
                        >
                          <Download size={12} />
                          Download Receipt
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}


            {/* ══════════════ SALARY PAYMENTS TAB ══════════════ */}
            {feesSubTab === 'salary-payments' && (
              <div className="space-y-5 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Banknote className="text-teal-400" size={18} />
                      Salary Payment Disbursement
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Submit salary payments with proof for employee disbursements. Approved payments auto-generate ledger entries.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
                  {/* Left — Employee Selector & Bank Info (2 cols) */}
                  <div className="lg:col-span-2 space-y-4">
                    <GlassCard className="p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Users className="text-teal-400" size={14} />
                        Select Employee
                      </h4>
                      <select
                        value={salarySelectedEmpId}
                        onChange={async (e) => {
                          setSalarySelectedEmpId(e.target.value);
                          setEmpPaySettings(null);
                          if (e.target.value) {
                            setEmpPaySettingsLoading(true);
                            try {
                              const s = await mockApi.fetchFacultyPaymentSettings(e.target.value, adminId || '', session?.user.role || 'ADMIN');
                              setEmpPaySettings(s);
                            } catch (err) { console.warn(err); }
                            setEmpPaySettingsLoading(false);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500"
                      >
                        <option value="">— Choose an employee —</option>
                        {teachers.map(t => {
                          const u = mockDb.users.find(u => u.id === t.userId);
                          return (
                            <option key={t.id} value={t.userId || t.id}>
                              {u ? formatUserName(u) : `Teacher ${t.employeeId}`} ({t.employeeId})
                            </option>
                          );
                        })}
                      </select>

                      {/* Employee Bank Details (read-only) */}
                      {salarySelectedEmpId && (
                        <div className="space-y-2 pt-2 border-t border-slate-850">
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Employee Payment Details</p>
                          {empPaySettingsLoading ? (
                            <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>
                          ) : empPaySettings ? (
                            <div className="space-y-1.5 text-[11px]">
                              {empPaySettings.upiId && (
                                <div className="flex justify-between"><span className="text-slate-500">UPI ID</span><span className="text-slate-200 font-mono">{empPaySettings.upiId}</span></div>
                              )}
                              {empPaySettings.bankName && (
                                <div className="flex justify-between"><span className="text-slate-500">Bank</span><span className="text-slate-200">{empPaySettings.bankName}</span></div>
                              )}
                              {empPaySettings.accountNumber && (
                                <div className="flex justify-between"><span className="text-slate-500">Account</span><span className="text-slate-200 font-mono">••••{empPaySettings.accountNumber.slice(-4)}</span></div>
                              )}
                              {empPaySettings.ifscCode && (
                                <div className="flex justify-between"><span className="text-slate-500">IFSC</span><span className="text-slate-200 font-mono">{empPaySettings.ifscCode}</span></div>
                              )}
                              {empPaySettings.branchName && (
                                <div className="flex justify-between"><span className="text-slate-500">Branch</span><span className="text-slate-200">{empPaySettings.branchName}</span></div>
                              )}
                              {empPaySettings.qrCodeUrl && (
                                <div className="pt-1">
                                  <p className="text-slate-500 text-[10px] mb-1">QR Code</p>
                                  <img src={empPaySettings.qrCodeUrl} alt="Employee QR" className="w-20 h-20 rounded-lg border border-slate-700 object-cover" />
                                </div>
                              )}
                              {!empPaySettings.upiId && !empPaySettings.bankName && !empPaySettings.accountNumber && (
                                <p className="text-slate-600 text-[10px] italic">Employee has not configured payment details yet.</p>
                              )}
                            </div>
                          ) : (
                            <p className="text-slate-600 text-[10px] italic">No payment settings found for this employee.</p>
                          )}
                        </div>
                      )}
                    </GlassCard>
                  </div>

                  {/* Right — Payment Form (3 cols) */}
                  <GlassCard className="lg:col-span-3 p-5 space-y-4">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <CreditCard className="text-teal-400" size={14} />
                      Submit Salary Payment Proof
                    </h4>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      if (!salarySelectedEmpId || !salaryAmount || !salaryUtr) return;
                      setIsSubmittingSalary(true);
                      try {
                        let screenshotUrl = salaryScreenshotUrl;
                        if (salaryScreenshotFile) {
                          const filePath = `salary-proofs/${Date.now()}-${salaryScreenshotFile.name}`;
                          const { data: uploadData } = await supabase.storage
                            .from('fee-payment-proofs')
                            .upload(filePath, salaryScreenshotFile, { cacheControl: '3600', upsert: false });
                          if (uploadData?.path) {
                            const { data: urlData } = supabase.storage.from('fee-payment-proofs').getPublicUrl(uploadData.path);
                            screenshotUrl = urlData.publicUrl;
                          }
                        }
                        await mockApi.submitSalaryPayment(
                          adminId || '',
                          session?.user.schoolId || '',
                          {
                            employeeId: salarySelectedEmpId,
                            month: salaryMonth,
                            amount: parseFloat(salaryAmount),
                            utrNumber: salaryUtr,
                            paymentScreenshotUrl: screenshotUrl || 'https://placehold.co/400x300?text=Payment+Proof',
                          }
                        );
                        const updated = await mockApi.getSalaryPayments(session?.user.schoolId || '');
                        setSalaryPaymentsList(updated);
                        setSalaryAmount(''); setSalaryUtr(''); setSalaryScreenshotUrl(''); setSalaryScreenshotFile(null);
                        alert('Salary payment submitted successfully!');
                      } catch (err: any) {
                        alert(err?.message || 'Failed to submit salary payment.');
                      }
                      setIsSubmittingSalary(false);
                    }} className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Month</label>
                          <input type="month" value={salaryMonth} onChange={e => setSalaryMonth(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-500 uppercase">Amount ({overview?.currencySymbol || '₹'})</label>
                          <input type="number" min="1" step="0.01" value={salaryAmount} onChange={e => setSalaryAmount(e.target.value)} placeholder="e.g. 45000"
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500" required />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">UTR / Transaction Reference</label>
                        <input type="text" value={salaryUtr} onChange={e => setSalaryUtr(e.target.value)} placeholder="e.g. UTIB0000123456789"
                          className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-teal-500 font-mono" required />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold text-slate-500 uppercase">Payment Screenshot</label>
                        <div className="flex items-center gap-2">
                          <label className="flex-1 flex items-center gap-2 cursor-pointer px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 hover:border-teal-500 transition-colors">
                            <Upload size={13} />
                            {salaryScreenshotFile ? salaryScreenshotFile.name : 'Choose file...'}
                            <input type="file" accept="image/*" className="hidden" onChange={e => {
                              const f = e.target.files?.[0];
                              if (f) { setSalaryScreenshotFile(f); setSalaryScreenshotUrl(URL.createObjectURL(f)); }
                            }} />
                          </label>
                          {salaryScreenshotUrl && (
                            <img src={salaryScreenshotUrl} alt="Preview" className="w-10 h-10 rounded-lg border border-slate-700 object-cover" />
                          )}
                        </div>
                      </div>
                      <button type="submit" disabled={isSubmittingSalary || !salarySelectedEmpId || !salaryAmount || !salaryUtr}
                        className="w-full py-2 rounded-xl text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.98]">
                        {isSubmittingSalary ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send size={13} />}
                        Submit Salary Payment
                      </button>
                    </form>
                  </GlassCard>
                </div>

                {/* Payroll Ledger */}
                <GlassCard className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FileSpreadsheet className="text-teal-400" size={14} />
                      Payroll Ledger (Auto-Generated)
                    </h4>
                    <button onClick={async () => {
                      const ledger = await mockApi.getSalaryLedger(session?.user.schoolId || '');
                      setSalaryLedgerList(ledger);
                    }} className="text-[10px] text-slate-500 hover:text-teal-400 transition-colors flex items-center gap-1">
                      <RefreshCw size={10} /> Refresh
                    </button>
                  </div>
                  {salaryLedgerList.length === 0 ? (
                    <div className="text-center py-8">
                      <FileSpreadsheet className="mx-auto text-slate-700 mb-2" size={28} />
                      <p className="text-slate-500 text-xs">No ledger entries yet. Approved salary payments will appear here automatically.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-slate-850">
                            {['Employee', 'Month', 'Amount', 'UTR', 'Payment Date'].map(h => (
                              <th key={h} className="text-left py-2 px-2 text-[9px] font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {salaryLedgerList.map(entry => {
                            const empUser = mockDb.users.find(u => u.id === entry.employeeId);
                            return (
                              <tr key={entry.id} className="border-b border-slate-900 hover:bg-slate-900/30">
                                <td className="py-2 px-2 text-slate-200">{empUser ? formatUserName(empUser) : entry.employeeId.substring(0, 8)}</td>
                                <td className="py-2 px-2 text-slate-300">{entry.month}</td>
                                <td className="py-2 px-2 text-emerald-400 font-bold">{overview?.currencySymbol || '₹'}{entry.amount.toLocaleString()}</td>
                                <td className="py-2 px-2 text-slate-400 font-mono text-[10px]">{entry.utrNumber}</td>
                                <td className="py-2 px-2 text-slate-400">{new Date(entry.paymentDate).toLocaleDateString()}</td>
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

            {/* ══════════════ SALARY APPROVAL QUEUE TAB ══════════════ */}
            {feesSubTab === 'salary-queue' && (
              <div className="space-y-4 animate-fade-in">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <ShieldCheck className="text-orange-400" size={18} />
                      Salary Payment Approval Queue
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Review submitted salary payment proofs. Approved payments auto-generate employee salary ledger entries.</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={13} />
                    <input type="text" placeholder="Search by name / UTR..."
                      value={salarySearch} onChange={e => setSalarySearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl text-slate-100 focus:outline-none focus:border-orange-500 w-52 transition-colors" />
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Pending', count: salaryPaymentsList.filter(p => p.status === 'PENDING').length, color: 'orange' },
                    { label: 'Approved', count: salaryPaymentsList.filter(p => p.status === 'APPROVED').length, color: 'emerald' },
                    { label: 'Rejected', count: salaryPaymentsList.filter(p => p.status === 'REJECTED').length, color: 'rose' },
                  ].map(stat => (
                    <GlassCard key={stat.label} className={`p-3 text-center border-${stat.color}-500/10`}>
                      <p className={`text-xl font-extrabold text-${stat.color}-400`}>{stat.count}</p>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{stat.label}</p>
                    </GlassCard>
                  ))}
                </div>

                {/* Pending queue */}
                {(() => {
                  const pending = salaryPaymentsList
                    .filter(p => p.status === 'PENDING')
                    .filter(p => {
                      if (!salarySearch) return true;
                      const empUser = mockDb.users.find(u => u.id === p.employeeId);
                      const name = empUser ? formatUserName(empUser).toLowerCase() : '';
                      return name.includes(salarySearch.toLowerCase()) || p.utrNumber.toLowerCase().includes(salarySearch.toLowerCase());
                    });
                  if (pending.length === 0) {
                    return (
                      <GlassCard className="p-12 text-center">
                        <ShieldCheck className="mx-auto text-emerald-400/40 mb-3" size={40} />
                        <p className="text-slate-400 font-semibold text-sm">No pending salary proofs</p>
                        <p className="text-slate-600 text-xs mt-1">All salary payments have been reviewed</p>
                      </GlassCard>
                    );
                  }
                  return (
                    <div className="space-y-3">
                      {pending.map(payment => {
                        const empUser = mockDb.users.find(u => u.id === payment.employeeId);
                        const teacher = teachers.find(t => t.userId === payment.employeeId);
                        const isActing = salaryActionId === payment.id;
                        return (
                          <GlassCard key={payment.id} className="p-4 border-orange-500/10">
                            <div className="flex flex-col sm:flex-row gap-4">
                              {/* Screenshot */}
                              <div className="flex-shrink-0">
                                <a href={payment.paymentScreenshotUrl} target="_blank" rel="noopener noreferrer">
                                  <div className="w-24 h-24 rounded-xl overflow-hidden border border-slate-700 bg-slate-900 flex items-center justify-center hover:border-orange-500/50 transition-colors">
                                    <img src={payment.paymentScreenshotUrl} alt="Salary Proof" className="w-full h-full object-cover"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    <ExternalLink className="text-slate-600" size={18} />
                                  </div>
                                </a>
                                <p className="text-[9px] text-slate-600 text-center mt-1">View proof</p>
                              </div>
                              {/* Details */}
                              <div className="flex-1 space-y-2 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-bold text-slate-100">{empUser ? formatUserName(empUser) : 'Unknown Employee'}</p>
                                    <p className="text-[11px] text-slate-500">{teacher?.employeeId || '—'} · {empUser?.role || 'TEACHER'}</p>
                                  </div>
                                  <span className="text-[10px] font-bold text-orange-400 bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full whitespace-nowrap">PENDING REVIEW</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Month</p>
                                    <p className="text-slate-200">{payment.month}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Amount</p>
                                    <p className="text-emerald-400 font-bold">{overview?.currencySymbol || '₹'}{payment.amount.toLocaleString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">UTR / Ref</p>
                                    <p className="text-slate-200 font-mono text-[10px]">{payment.utrNumber}</p>
                                  </div>
                                  <div>
                                    <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px]">Submitted</p>
                                    <p className="text-slate-200">{new Date(payment.createdAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                {/* Actions */}
                                <div className="flex gap-2 pt-1">
                                  <button disabled={isActing} onClick={async () => {
                                    setSalaryActionId(payment.id);
                                    try {
                                      await mockApi.approveSalaryPayment(adminId || '', payment.id, 'APPROVED');
                                      const updated = await mockApi.getSalaryPayments(session?.user.schoolId || '');
                                      setSalaryPaymentsList(updated);
                                      const ledger = await mockApi.getSalaryLedger(session?.user.schoolId || '');
                                      setSalaryLedgerList(ledger);
                                    } catch (err: any) { alert(err?.message || 'Failed to approve salary.'); }
                                    setSalaryActionId(null);
                                  }} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                                    {isActing ? <div className="w-3 h-3 border border-emerald-400/60 border-t-transparent rounded-full animate-spin" /> : <CheckCircle size={13} />}
                                    Approve
                                  </button>
                                  <button disabled={isActing} onClick={() => {
                                    setSalaryRejectTargetId(payment.id);
                                    setSalaryRejectReason('');
                                    setShowSalaryRejectModal(true);
                                  }} className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-all disabled:opacity-50">
                                    <Ban size={13} /> Reject
                                  </button>
                                </div>
                              </div>
                            </div>
                          </GlassCard>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Recently processed */}
                {salaryPaymentsList.filter(p => p.status === 'APPROVED' || p.status === 'REJECTED').length > 0 && (
                  <GlassCard className="p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} /> Recently Processed Salaries
                    </h4>
                    <div className="space-y-2">
                      {salaryPaymentsList
                        .filter(p => p.status === 'APPROVED' || p.status === 'REJECTED')
                        .slice(0, 10)
                        .map(p => {
                          const empUser = mockDb.users.find(u => u.id === p.employeeId);
                          return (
                            <div key={p.id} className="flex items-center gap-3 text-xs">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.status === 'APPROVED' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                              <span className="text-slate-300 font-semibold">{empUser ? formatUserName(empUser) : '—'}</span>
                              <span className="text-slate-500">{p.month}</span>
                              <span className="text-slate-500">{overview?.currencySymbol || '₹'}{p.amount.toLocaleString()}</span>
                              <span className={`ml-auto font-bold text-[10px] ${p.status === 'APPROVED' ? 'text-emerald-400' : 'text-rose-400'}`}>{p.status}</span>
                              {p.rejectionReason && <span className="text-rose-400/70 text-[10px] italic truncate max-w-32">{p.rejectionReason}</span>}
                            </div>
                          );
                        })}
                    </div>
                  </GlassCard>
                )}
              </div>
            )}
          </div>
        </PremiumLock>
      )}

      {activeTab === 'paymentsettings' && (
        <div className="space-y-6">
          <div className="space-y-5 animate-fade-in">
            {paySettingsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                      <Banknote className="text-violet-400" size={18} />
                      School Payment Gateway Settings
                    </h3>
                    <p className="text-[11px] text-slate-500 mt-0.5">Configure how parents can pay fees — QR code, bank transfer, and visibility controls.</p>
                  </div>
                  {paySettingsMsg && (
                    <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${
                      paySettingsMsg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {paySettingsMsg.text}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Left: QR Code Panel */}
                  <GlassCard className="p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <QrCode className="text-violet-400" size={15} />
                      QR Code Payment
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        psQrEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                      }`}>{psQrEnabled ? 'Enabled' : 'Disabled'}</span>
                    </h4>

                    {/* QR Upload Area */}
                    <div className="relative">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1.5">QR Code Image</label>
                      <div
                        className="w-full h-40 rounded-xl border-2 border-dashed border-slate-700 hover:border-violet-500/50 transition-colors flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 overflow-hidden"
                        onClick={() => document.getElementById('ps-qr-upload')?.click()}
                      >
                        {psQrPreview ? (
                          <img src={psQrPreview} alt="QR Code" className="h-36 w-36 object-contain rounded-lg" />
                        ) : (
                          <div className="text-center space-y-1">
                            <ScanLine className="mx-auto text-slate-600" size={28} />
                            <p className="text-[11px] text-slate-500">Click to upload QR image</p>
                            <p className="text-[10px] text-slate-600">PNG, JPG up to 2MB</p>
                          </div>
                        )}
                      </div>
                      <input
                        id="ps-qr-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setPsQrFile(file);
                            setPsQrPreview(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-slate-350">Enable UPI QR Payments</label>
                          <p className="text-[10px] text-slate-500">Show UPI QR payment option in Parent Portal.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPsQrEnabled(!psQrEnabled)}
                          className="text-violet-400 hover:text-violet-300"
                        >
                          {psQrEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-slate-350">Show QR details on checkout</label>
                          <p className="text-[10px] text-slate-500">Directly display QR scan instructions during payment checkouts.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPsShowQrToParents(!psShowQrToParents)}
                          className="text-violet-400 hover:text-violet-300"
                        >
                          {psShowQrToParents ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>
                    </div>
                  </GlassCard>

                  {/* Right: Bank Details Panel */}
                  <GlassCard className="p-5 space-y-4">
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Building className="text-violet-400" size={15} />
                      Bank Account Details
                      <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        psBankEnabled ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500'
                      }`}>{psBankEnabled ? 'Enabled' : 'Disabled'}</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Account Holder Name</label>
                        <input
                          type="text"
                          placeholder="School Account Name"
                          value={psAccHolder}
                          onChange={(e) => setPsAccHolder(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-xs rounded-lg p-2 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Bank Name</label>
                        <input
                          type="text"
                          placeholder="e.g. HDFC Bank"
                          value={psBankName}
                          onChange={(e) => setPsBankName(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-xs rounded-lg p-2 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Account Number</label>
                        <input
                          type="text"
                          placeholder="1234567890"
                          value={psAccNumber}
                          onChange={(e) => setPsAccNumber(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-xs rounded-lg p-2 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">IFSC Code</label>
                        <input
                          type="text"
                          placeholder="HDFC0001234"
                          value={psIfsc}
                          onChange={(e) => setPsIfsc(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-xs rounded-lg p-2 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Branch Name</label>
                        <input
                          type="text"
                          placeholder="Branch location"
                          value={psBranch}
                          onChange={(e) => setPsBranch(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-xs rounded-lg p-2 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">SWIFT/BIC Code (Optional)</label>
                        <input
                          type="text"
                          placeholder="HDFCINBB"
                          value={psSwift}
                          onChange={(e) => setPsSwift(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-850 text-xs rounded-lg p-2 focus:outline-none focus:border-violet-500"
                        />
                      </div>
                    </div>

                    <div className="space-y-3 pt-1 border-t border-slate-850/55">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-slate-350">Enable Bank Transfer Payments</label>
                          <p className="text-[10px] text-slate-500">Show manual offline bank transfer details to parents.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPsBankEnabled(!psBankEnabled)}
                          className="text-violet-400 hover:text-violet-300"
                        >
                          {psBankEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-xs font-bold text-slate-350">Show Bank details on billing dashboard</label>
                          <p className="text-[10px] text-slate-500">Show bank name, routing, and number inside Parent Portal.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setPsShowBankToParents(!psShowBankToParents)}
                          className="text-violet-400 hover:text-violet-300"
                        >
                          {psShowBankToParents ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                        </button>
                      </div>
                    </div>
                  </GlassCard>

                  {/* General settings & visibility controls */}
                  <GlassCard className="p-5 space-y-4 lg:col-span-2">
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <ExternalLink className="text-violet-400" size={15} />
                      Online Gateway & Verification Rules
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-slate-350">UPI ID for Direct Transfers</label>
                            <p className="text-[10px] text-slate-500">Specify the school's merchant UPI handle.</p>
                          </div>
                          <input
                            type="text"
                            placeholder="school@upi"
                            value={psUpiId}
                            onChange={(e) => setPsUpiId(e.target.value)}
                            className="bg-slate-950 border border-slate-850 text-xs rounded-lg p-2 w-48 text-right focus:outline-none focus:border-violet-500"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-slate-350">Require UTR/Ref upload for manual verify</label>
                            <p className="text-[10px] text-slate-500">Forces parent to submit reference number or transaction slip screenshot.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPsUtrUpload(!psUtrUpload)}
                            className="text-violet-400 hover:text-violet-300"
                          >
                            {psUtrUpload ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs font-bold text-slate-350">Auto-remind parents of unpaid invoices</label>
                            <p className="text-[10px] text-slate-500">Triggers automated system alert 3 days before invoice due date.</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPsAutoRemind(!psAutoRemind)}
                            className="text-violet-400 hover:text-violet-300"
                          >
                            {psAutoRemind ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-850/60">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Custom Checkout Payment Instructions</label>
                      <textarea
                        rows={2}
                        placeholder="Provide standard checkout details or special bank payment notes here..."
                        value={psInstructions}
                        onChange={(e) => setPsInstructions(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-850 text-xs rounded-lg p-2.5 focus:outline-none focus:border-violet-500"
                      />
                    </div>
                  </GlassCard>
                </div>

                {/* Submit button */}
                <div className="flex justify-end pt-3 border-t border-slate-850/70">
                  <button
                    onClick={async () => {
                      setPaySettingsSaving(true);
                      try {
                        const saved = await mockApi.saveSchoolPaymentSettings(
                          session?.user.schoolId || '',
                          session?.user.role || '',
                          {
                            accountHolderName: psAccHolder,
                            bankName: psBankName,
                            accountNumber: psAccNumber,
                            ifscCode: psIfsc,
                            branchName: psBranch,
                            swiftCode: psSwift,
                            upiId: psUpiId,
                            paymentInstructions: psInstructions,
                            qrPaymentEnabled: psQrEnabled,
                            bankTransferEnabled: psBankEnabled,
                            showQrToParents: psShowQrToParents,
                            showBankToParents: psShowBankToParents,
                            enableUtrUpload: psUtrUpload,
                            autoRemindUnpaid: psAutoRemind,
                          },
                          psQrFile
                        );
                        setSchoolPaySettings(saved);
                        setPsQrFile(null);
                        setPaySettingsMsg({ type: 'success', text: '✓ Payment settings saved successfully' });
                        setTimeout(() => setPaySettingsMsg(null), 4000);
                      } catch (err: any) {
                        setPaySettingsMsg({ type: 'error', text: err?.message || 'Failed to save settings' });
                      }
                      setPaySettingsSaving(false);
                    }}
                    className="glass-btn-primary flex items-center gap-2 text-xs"
                  >
                    {paySettingsSaving ? (
                      <><div className="w-3.5 h-3.5 border border-white/60 border-t-transparent rounded-full animate-spin" /> Saving...</>
                    ) : (
                      <><ShieldCheck size={14} /> Save Payment Settings</>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── REJECT PAYMENT MODAL ── */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-sm space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Ban className="text-rose-400" size={15} />
                Reject Payment Proof
              </h4>
              <button onClick={() => setShowRejectModal(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Please provide a reason for rejecting this payment. The parent will be notified.</p>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Rejection Reason</label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="e.g. UTR number does not match, amount mismatch, blurry screenshot..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-slate-850">
              <button onClick={() => setShowRejectModal(false)} className="glass-btn-secondary text-xs">Cancel</button>
              <button
                disabled={!rejectReason.trim() || verifyActionId !== null}
                onClick={async () => {
                  setVerifyActionId(rejectTargetId);
                  try {
                    await mockApi.verifyFeePayment(adminId || '', rejectTargetId, 'REJECTED', rejectReason.trim());
                    const updated = await mockApi.adminGetFeePayments();
                    setFeePayments(updated);
                    setShowRejectModal(false);
                    setRejectTargetId('');
                    setRejectReason('');
                  } catch (e: any) {
                    alert(e?.message || 'Failed to reject payment');
                  }
                  setVerifyActionId(null);
                }}
                className="glass-btn-danger text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {verifyActionId ? <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin" /> : <Ban size={13} />}
                Confirm Rejection
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* ── REJECT SALARY PAYMENT MODAL ── */}
      {showSalaryRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-sm space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Ban className="text-rose-400" size={15} />
                Reject Salary Payment
              </h4>
              <button onClick={() => setShowSalaryRejectModal(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>
            <div className="space-y-3">
              <p className="text-xs text-slate-400">Provide a reason for rejecting this salary payment proof.</p>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">Rejection Reason</label>
                <textarea rows={3} value={salaryRejectReason} onChange={(e) => setSalaryRejectReason(e.target.value)}
                  placeholder="e.g. UTR mismatch, amount incorrect, blurry screenshot..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-rose-500 resize-none" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1 border-t border-slate-850">
              <button onClick={() => setShowSalaryRejectModal(false)} className="glass-btn-secondary text-xs">Cancel</button>
              <button
                disabled={!salaryRejectReason.trim() || salaryActionId !== null}
                onClick={async () => {
                  setSalaryActionId(salaryRejectTargetId);
                  try {
                    await mockApi.approveSalaryPayment(adminId || '', salaryRejectTargetId, 'REJECTED', salaryRejectReason.trim());
                    const updated = await mockApi.getSalaryPayments(session?.user.schoolId || '');
                    setSalaryPaymentsList(updated);
                    setShowSalaryRejectModal(false);
                    setSalaryRejectTargetId('');
                    setSalaryRejectReason('');
                  } catch (e: any) {
                    alert(e?.message || 'Failed to reject salary payment');
                  }
                  setSalaryActionId(null);
                }}
                className="glass-btn-danger text-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {salaryActionId ? <div className="w-3 h-3 border border-white/60 border-t-transparent rounded-full animate-spin" /> : <Ban size={13} />}
                Confirm Rejection
              </button>
            </div>
          </GlassCard>
        </div>
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
              <h5 className="font-bold text-slate-200 mt-1">{formatUserName(collectingPayment.student.userDetails) || 'Unknown Student'}</h5>
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
                <input type="text" placeholder="DaVinci" value={stLast} onChange={(e) => setStLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
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

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Father's Name <span className="text-rose-400">*</span></label>
                <input type="text" placeholder="e.g. Rajesh Kumar" value={stFatherName} onChange={(e) => setStFatherName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Mother's Name <span className="text-rose-400">*</span></label>
                <input type="text" placeholder="e.g. Sunita Devi" value={stMotherName} onChange={(e) => setStMotherName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>

              {/* ── Student Photo Upload ── */}
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Student Photo <span className="text-slate-500">(Optional – JPG / PNG / WEBP, max 5 MB)</span></label>
                <div
                  className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
                    stPhotoDragging
                      ? 'border-brand-400 bg-brand-500/10 scale-[1.01]'
                      : stPhotoPreview
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-slate-700 hover:border-brand-500/60 bg-slate-900/60 hover:bg-slate-900'
                  }`}
                  style={{ minHeight: '120px' }}
                  onClick={() => !stPhotoPreview && stPhotoInputRef.current?.click()}
                  onDragOver={(ev) => { ev.preventDefault(); setStPhotoDragging(true); }}
                  onDragLeave={() => setStPhotoDragging(false)}
                  onDrop={async (ev) => {
                    ev.preventDefault();
                    setStPhotoDragging(false);
                    const f = ev.dataTransfer.files?.[0];
                    if (!f) return;
                    if (!['image/jpeg','image/png','image/webp'].includes(f.type)) { alert('Only JPG, PNG or WEBP files are allowed.'); return; }
                    if (f.size > 5 * 1024 * 1024) { alert('Photo must be under 5 MB.'); return; }
                    const compressed = await compressImage(f);
                    if (stPhotoPreview) URL.revokeObjectURL(stPhotoPreview);
                    setStPhotoFile(compressed);
                    setStPhotoPreview(URL.createObjectURL(compressed));
                  }}
                >
                  {stPhotoPreview ? (
                    <div className="relative w-full flex items-center justify-center p-3 gap-4">
                      <img
                        src={stPhotoPreview}
                        alt="Student photo preview"
                        className="w-20 h-24 object-cover rounded-lg border-2 border-brand-500/50 shadow-lg"
                      />
                      <div className="flex flex-col gap-2">
                        <p className="text-xs text-emerald-400 font-semibold">✓ Photo selected</p>
                        <p className="text-[10px] text-slate-400 truncate max-w-[140px]">{stPhotoFile?.name}</p>
                        <p className="text-[10px] text-slate-500">{stPhotoFile ? (stPhotoFile.size / 1024).toFixed(1) + ' KB' : ''}</p>
                        <div className="flex gap-2 mt-1">
                          <button
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); stPhotoInputRef.current?.click(); }}
                            className="text-[10px] font-semibold text-brand-400 hover:text-brand-300 transition-colors px-2 py-1 rounded bg-brand-500/10 hover:bg-brand-500/20"
                          >
                            Replace
                          </button>
                          <button
                            type="button"
                            onClick={(ev) => { ev.stopPropagation(); setStPhotoFile(null); if (stPhotoPreview) URL.revokeObjectURL(stPhotoPreview); setStPhotoPreview(null); }}
                            className="text-[10px] font-semibold text-rose-400 hover:text-rose-300 transition-colors px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-6 px-4 text-center select-none">
                      <div className="w-10 h-10 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                        <Image size={18} className="text-slate-500" />
                      </div>
                      <p className="text-xs text-slate-400 font-medium">
                        {stPhotoDragging ? 'Drop photo here' : 'Drag & drop or click to upload'}
                      </p>
                      <p className="text-[10px] text-slate-600">Passport-size photo recommended • 3:4 ratio</p>
                    </div>
                  )}
                  <input
                    ref={stPhotoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="environment"
                    className="hidden"
                    onChange={async (ev) => {
                      const f = ev.target.files?.[0];
                      if (!f) return;
                      if (!['image/jpeg','image/png','image/webp'].includes(f.type)) { alert('Only JPG, PNG or WEBP files are allowed.'); return; }
                      if (f.size > 5 * 1024 * 1024) { alert('Photo must be under 5 MB.'); return; }
                      const compressed = await compressImage(f);
                      if (stPhotoPreview) URL.revokeObjectURL(stPhotoPreview);
                      setStPhotoFile(compressed);
                      setStPhotoPreview(URL.createObjectURL(compressed));
                      ev.target.value = '';
                    }}
                  />
                </div>
                {stPhotoUploading && (
                  <p className="text-[10px] text-brand-400 flex items-center gap-1 animate-pulse">
                    <Upload size={10} /> Uploading photo to cloud storage…
                  </p>
                )}
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
                    <option key={p.id} value={p.id}>{formatUserName(p.userDetails)} ({p.occupation})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Select Student Ward</label>
                <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 w-full" required>
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{formatUserName(s.userDetails)} ({s.className})</option>
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
      {showMapTeacher && (session?.user.role === 'ADMIN' || session?.user.role === 'SUPER_ADMIN' || session?.user.role === 'ACADEMIC_ADMIN') && (
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
                    <option key={t.id} value={t.id}>{formatUserName(t.userDetails)} — {t.employeeId} ({t.specialization})</option>
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
                      <option value={6}>Saturday</option>
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
                    <option key={t.id} value={t.id}>{formatUserName(t.userDetails)} — {t.employeeId} ({t.specialization})</option>
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
                <input type="text" placeholder="Last Name" value={tcLast} onChange={(e) => setTcLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
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

      {/* Create Payroll Entry Modal */}
      {showCreatePayrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto p-5">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Create Payroll Record</h4>
              <button onClick={() => setShowCreatePayrollModal(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreatePayroll} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Employee Type</label>
                  <select
                    value={payrollEmpType}
                    onChange={(e) => {
                      setPayrollEmpType(e.target.value as any);
                      setPayrollSelectedEmpId('');
                    }}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                    required
                  >
                    <option value="TEACHER">Teacher</option>
                    <option value="STAFF">Administrative Staff</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Payout Month</label>
                  <input
                    type="month"
                    value={payrollPayoutMonth}
                    onChange={(e) => setPayrollPayoutMonth(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Select Employee</label>
                <select
                  value={payrollSelectedEmpId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPayrollSelectedEmpId(val);
                    if (val !== 'custom') {
                      if (payrollEmpType === 'TEACHER') {
                        const t = teachers.find(x => x.id === val);
                        setPayrollBaseSalary('3000');
                        setPayrollCustomName('');
                      } else {
                        const o = operators.find(x => x.id === val);
                        setPayrollBaseSalary('2500');
                        setPayrollCustomName('');
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                  required
                >
                  <option value="" disabled>-- Choose Employee --</option>
                  {payrollEmpType === 'TEACHER' ? (
                    teachers.map(t => (
                      <option key={t.id} value={t.id}>
                        {formatUserName(t.userDetails)} (ID: {t.employeeId || 'N/A'})
                      </option>
                    ))
                  ) : (
                    operators.map(o => (
                      <option key={o.id} value={o.id}>
                        {formatUserName(o)} ({o.role} | ID: {o.employeeId || 'N/A'})
                      </option>
                    ))
                  )}
                  <option value="custom">-- Custom Staff (Not in registry) --</option>
                </select>
              </div>

              {payrollSelectedEmpId === 'custom' && (
                <div className="p-3 bg-slate-950/20 border border-slate-850 rounded-xl space-y-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-brand-400">Custom Staff Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Full Name</label>
                      <input
                        type="text"
                        placeholder="John Doe"
                        value={payrollCustomName}
                        onChange={(e) => setPayrollCustomName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Role / Title</label>
                      <input
                        type="text"
                        placeholder="Accountant, Security, Peon, etc."
                        value={payrollCustomRole}
                        onChange={(e) => setPayrollCustomRole(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                        required
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Employee ID</label>
                      <input
                        type="text"
                        placeholder="EMPXXXX"
                        value={payrollCustomEmpId}
                        onChange={(e) => setPayrollCustomEmpId(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] font-bold uppercase text-slate-500">Phone</label>
                      <input
                        type="text"
                        placeholder="+1 555-..."
                        value={payrollCustomPhone}
                        onChange={(e) => setPayrollCustomPhone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Base Salary ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payrollBaseSalary}
                    onChange={(e) => setPayrollBaseSalary(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Allowances ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payrollAllowances}
                    onChange={(e) => setPayrollAllowances(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Deductions ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payrollDeductions}
                    onChange={(e) => setPayrollDeductions(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
                    required
                  />
                </div>
              </div>

              <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">Net Calculated Salary:</span>
                <span className="font-bold font-mono text-brand-400 text-sm">
                  ${( (Number(payrollBaseSalary) || 0) + (Number(payrollAllowances) || 0) - (Number(payrollDeductions) || 0) ).toFixed(2)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Notes / Remarks</label>
                <textarea
                  placeholder="Monthly basic pay with performance adjustments..."
                  value={payrollNotes}
                  onChange={(e) => setPayrollNotes(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200 h-16 resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingPayroll}
                className="w-full py-2 bg-brand-600 hover:bg-brand-500 disabled:bg-brand-600/50 text-white rounded-lg text-xs font-bold transition-all"
              >
                {isSubmittingPayroll ? 'Creating entry...' : 'Create Payroll Record'}
              </button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Disburse Notes Modal */}
      {showPayrollDisburseModal && selectedPayrollRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4 p-5">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Confirm Disbursement</h4>
              <button onClick={() => setShowPayrollDisburseModal(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <div className="space-y-2 text-xs">
              <p className="text-slate-300">
                You are about to disburse salary to <span className="font-bold text-slate-100">{selectedPayrollRecord.employeeName}</span> for month <span className="font-bold text-slate-100">{selectedPayrollRecord.payoutMonth}</span>.
              </p>
              <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl flex justify-between font-mono">
                <span className="text-slate-400">Net Amount Paid:</span>
                <span className="font-bold text-emerald-400">${selectedPayrollRecord.netSalary.toFixed(2)}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono">Disbursement Notes</label>
              <input
                type="text"
                value={payrollDisburseNotes}
                onChange={(e) => setPayrollDisburseNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none text-slate-200"
              />
            </div>

            <button
              onClick={() => {
                handleUpdatePayrollStatus(selectedPayrollRecord.id, 'PAID', payrollDisburseNotes);
                setShowPayrollDisburseModal(false);
              }}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all"
            >
              Disburse Salary
            </button>
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
                <input type="text" placeholder="Last Name" value={prLast} onChange={(e) => setPrLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
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
                        <option key={s.id} value={s.id}>{formatUserName(s.userDetails)} ({s.className})</option>
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
        currentPlanName === 'freemium' ? (
          <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
            <PremiumLock isLocked={!ent.hasCommunications} requiredTier="Basic" featureName="Email & SMS Communication Center">
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

            {/* Right Column Stack */}
            <div className="space-y-6">
              {/* Custom Role-Based Broadcasts */}
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Megaphone className="text-brand-400" size={15} />
                  Custom Role-Based Broadcasts
                </h4>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Dispatch instant push notifications and in-app alerts to all users under a specific role simultaneously.
                </p>

                <form onSubmit={handleBroadcastSubmit} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Broadcast Target Role</label>
                    <select
                      value={broadcastRole}
                      onChange={(e) => setBroadcastRole(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="STUDENT">All Students</option>
                      <option value="TEACHER">All Teachers</option>
                      <option value="PARENT">All Parents</option>
                      <option value="all">Entire Institution (All Active Users)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Notification Category</label>
                    <select
                      value={broadcastCategory}
                      onChange={(e) => setBroadcastCategory(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    >
                      <option value="Announcement">Announcement</option>
                      <option value="Emergency">Emergency Alert</option>
                      <option value="Fee">Fee Reminder</option>
                      <option value="Exam">Exam Notification</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Alert Title</label>
                    <input
                      type="text"
                      placeholder="e.g. System Maintenance Update"
                      value={broadcastTitle}
                      onChange={(e) => setBroadcastTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Alert Message Body</label>
                    <textarea
                      placeholder="Enter message text..."
                      value={broadcastContent}
                      onChange={(e) => setBroadcastContent(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500 min-h-[70px]"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={broadcastSending}
                    className="w-full bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-bold text-xs py-2 rounded-xl transition-all shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] border border-brand-400/20 flex items-center justify-center gap-2"
                  >
                    {broadcastSending ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Broadcasting Alerts...</span>
                      </>
                    ) : (
                      <>
                        <Send size={13} />
                        <span>Dispatch Broadcast</span>
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
        (currentPlanName === 'freemium' || currentPlanName === 'basic') ? (
          <div className="max-w-lg mx-auto py-12 text-center animate-fade-in">
            <PremiumLock isLocked={!ent.hasAnalyticsAccess} requiredTier="Pro" featureName="Advanced Academic & Finance Analytics">
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
            {(() => {
              const attStats = getAttendanceStats();
              return (
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Student Attendance Ratio</span>
                    <span className="text-[10px] text-green-400 font-mono">
                      {attStats ? `Avg: ${attStats.avg.toFixed(1)}%` : 'No data available'}
                    </span>
                  </h4>
                  {!attStats ? (
                    <div className="h-44 flex items-center justify-center text-slate-500 text-xs italic">
                      No data available.
                    </div>
                  ) : (
                    <div className="h-44 flex items-end justify-around gap-2 pt-6 pb-2 border-b border-slate-850">
                      <div className="w-12 flex flex-col items-center gap-2">
                        <div className="w-full bg-slate-900 rounded-lg h-32 relative overflow-hidden">
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-brand-600 to-indigo-500 rounded-lg transition-all duration-300" style={{ height: `${attStats.g10}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">G10-A ({attStats.g10.toFixed(0)}%)</span>
                      </div>
                      <div className="w-12 flex flex-col items-center gap-2">
                        <div className="w-full bg-slate-900 rounded-lg h-32 relative overflow-hidden">
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-brand-600 to-indigo-500 rounded-lg transition-all duration-300" style={{ height: `${attStats.g11}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">G11-B ({attStats.g11.toFixed(0)}%)</span>
                      </div>
                      <div className="w-12 flex flex-col items-center gap-2">
                        <div className="w-full bg-slate-900 rounded-lg h-32 relative overflow-hidden">
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-emerald-600 to-teal-500 rounded-lg transition-all duration-300" style={{ height: `${attStats.system}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-300">SYSTEM ({attStats.system.toFixed(0)}%)</span>
                      </div>
                    </div>
                  )}
                </GlassCard>
              );
            })()}

            {/* Chart 2: Fee Collections */}
            {(() => {
              const feeStats = getFeeStats();
              return (
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Quarterly Fee Collections Ledger</span>
                    <span className="text-[10px] text-brand-400 font-mono">
                      {feeStats ? `${overview?.currencySymbol || '$'}${feeStats.raised.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Raised` : 'No data available'}
                    </span>
                  </h4>
                  {!feeStats ? (
                    <div className="h-44 flex items-center justify-center text-slate-500 text-xs italic">
                      No data available.
                    </div>
                  ) : (
                    <div className="h-44 flex flex-col justify-center gap-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Tuition Quota Cleared</span>
                          <span className="font-bold text-slate-200">{overview?.currencySymbol || '$'}{feeStats.collected.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({feeStats.percentage.toFixed(0)}%)</span>
                        </div>
                        <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-brand-600 to-indigo-500 rounded-full transition-all duration-300" style={{ width: `${feeStats.percentage}%` }} />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-400">
                          <span>Tuition Quota Pending / Late</span>
                          <span className="font-bold text-slate-200">{overview?.currencySymbol || '$'}{feeStats.pending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({(100 - feeStats.percentage).toFixed(0)}%)</span>
                        </div>
                        <div className="h-3 w-full bg-slate-900 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-amber-600 to-orange-500 rounded-full transition-all duration-300" style={{ width: `${100 - feeStats.percentage}%` }} />
                        </div>
                      </div>
                    </div>
                  )}
                </GlassCard>
              );
            })()}

            {/* Chart 3: Homework Completion */}
            {(() => {
              const hwStats = getHomeworkStats();
              return (
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Homework Completion Ratios</span>
                    <span className="text-[10px] text-emerald-400 font-mono">Target: &gt;90%</span>
                  </h4>
                  {!hwStats ? (
                    <div className="h-44 flex items-center justify-center text-slate-500 text-xs italic">
                      No data available.
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 h-44 overflow-y-auto">
                      {hwStats.map((item, idx) => (
                        <div className="flex items-center gap-3 animate-fade-in" key={idx}>
                          <span className="text-[11px] text-slate-400 w-24 truncate">{item.subjectName}</span>
                          <div className="flex-1 h-2 bg-slate-900 rounded-full overflow-hidden">
                            <div className="h-full bg-brand-500 rounded-full transition-all duration-300" style={{ width: `${item.completedPct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-slate-300 w-8 text-right">{item.completedPct.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })()}

            {/* Chart 4: Subject Averages */}
            {(() => {
              const gradeStats = getGradeStats();
              return (
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-xs uppercase tracking-wider flex items-center justify-between">
                    <span>Institutional Grade Averages</span>
                    <span className="text-[10px] text-indigo-400 font-mono">Exam Assessment Marks</span>
                  </h4>
                  {!gradeStats ? (
                    <div className="h-44 flex items-center justify-center text-slate-500 text-xs italic">
                      No data available.
                    </div>
                  ) : (
                    <div className="h-44 flex items-end justify-around gap-4 pt-6 pb-2 border-b border-slate-850 overflow-x-auto">
                      {gradeStats.map((item, idx) => (
                        <div className="w-8 flex flex-col items-center gap-1.5 animate-fade-in" key={idx}>
                          <div className="w-full bg-slate-900 rounded-t h-32 relative overflow-hidden">
                            <div className="absolute bottom-0 left-0 right-0 bg-brand-500/80 transition-all duration-300" style={{ height: `${item.average}%` }} />
                          </div>
                          <span className="text-[9px] font-mono text-slate-500" title={item.subjectCode}>{item.subjectCode} ({item.average.toFixed(0)})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </GlassCard>
              );
            })()}
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
            <PremiumLock isLocked={!ent.hasBackups} requiredTier="enterprise" featureName="SaaS Disaster Recovery & Backup Panel">
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
        currentPlanName === 'freemium' || currentPlanName === 'basic' ? (
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
                  You are currently on the <span className="text-red-400 font-bold uppercase">Freemium</span> tier. Advanced role permissions configuration, dynamic sub-admin directories, and granular authorization matrix tables are restricted to Pro and Enterprise schools.
                </p>
                <div className="inline-block p-4 bg-slate-900/60 border border-slate-800 rounded-xl max-w-lg mx-auto text-left space-y-2 mb-6 w-full">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Pro & Enterprise Upgrade Benefits:</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[10px]">
                    <li>Console Operators & Sub-Admin management (Pro+)</li>
                    <li>Dynamic Sub-Admin Role Matrix (Enterprise)</li>
                    <li>SaaS Disaster Recovery with automated off-site backups (Enterprise)</li>
                    <li>Advanced institutional metrics, analytics, and printable invoicing PDF reports</li>
                  </ul>
                </div>
                <button 
                  disabled
                  className="px-6 py-2.5 bg-gradient-to-r from-brand-600 to-purple-600 hover:from-brand-500 hover:to-purple-500 text-white rounded-lg font-bold w-full max-w-xs transition-all active:scale-[0.98] cursor-not-allowed opacity-80"
                >
                  Request Pro or Enterprise Upgrade
                </button>
              </GlassCard>
            ) : (
              /* Basic Plan Lock Screen */
              <GlassCard className="border-amber-500/20 bg-black/60 shadow-[0_0_50px_rgba(245,158,11,0.1)] p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 bg-amber-500/10 border-l border-b border-amber-500/20 rounded-bl-xl text-amber-400 font-bold uppercase tracking-wider text-[8px] flex items-center gap-1">
                  <Crown size={8} /> Pro+ Only
                </div>
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
                  <Lock className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-slate-100 mb-2">Advanced RBAC Matrix Restricted</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto mb-6">
                  School accounts on the <span className="text-amber-400 font-bold uppercase">Basic</span> plan cannot manage custom sub-admin operator directory listings or configure modular access rules. Upgrade to Pro or Enterprise.
                </p>
                <div className="inline-block p-4 bg-slate-900/60 border border-slate-800 rounded-xl max-w-lg mx-auto text-left space-y-2 mb-6 w-full">
                  <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Pro & Enterprise Feature Set:</p>
                  <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[10px]">
                    <li>Console Operators & Sub-Admin management (Pro+)</li>
                    <li>Complete dynamic granular permissions toggle grid for 7 modules (Enterprise)</li>
                    <li>Enterprise-grade auditing logs and threat detection telemetry (Enterprise)</li>
                  </ul>
                </div>
                <button 
                  disabled
                  className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-lg font-bold w-full max-w-xs transition-all active:scale-[0.98] cursor-not-allowed opacity-80"
                >
                  Upgrade to Pro or Enterprise
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
          <PremiumLock
            isLocked={!ent.hasRbac}
            requiredTier="Pro"
            featureName="Sub-Admin Modules Authorization Matrix"
          >
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
          </PremiumLock>

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
                          <div className="font-bold text-slate-200">{formatUserName(op)}</div>
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
                            {op.role === 'SPORTS_ADMIN' && (
                              <button
                                onClick={async () => {
                                  const targetSchoolId = prompt("Enter Target School UUID to transfer this Sports Admin:");
                                  if (!targetSchoolId) return;
                                  try {
                                    await mockApi.transferSportsAdmin(session!.user.id, op.id, targetSchoolId);
                                    alert("Sports Admin successfully transferred to target school!");
                                    loadData();
                                  } catch (err: any) {
                                    alert(`Error transferring: ${err.message}`);
                                  }
                                }}
                                className="mr-2 px-2 py-1 rounded font-bold text-[9px] transition-all bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20"
                              >
                                Transfer
                              </button>
                            )}
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
          <PremiumLock
            isLocked={!ent.hasRbac}
            requiredTier="Pro"
            featureName="Enterprise System Audit Trail Log Console"
          >
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
                      <th className="py-3 px-4">Description</th>
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
                                <div className="text-slate-250 text-xs font-semibold leading-relaxed">{getLogDescription(log)}</div>
                                <div className="text-[9px] text-slate-500 font-mono mt-0.5" title={log.userAgent}>
                                  {log.ipAddress || '127.0.0.1'} | {log.userAgent || 'Telemetry unavailable'}
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
          </PremiumLock>
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
                  const school = mockDb.schools.find(s => s.id === session?.user.schoolId);
                  downloadReceiptPdf({
                    schoolId: session?.user.schoolId || '',
                    schoolName: school?.name || 'Aegis Academy',
                    schoolAddress: school?.address || 'Silicon Valley, Tech District, USA',
                    schoolPhone: school?.phone || '+1-555-0199',
                    schoolEmail: school?.email || 'billing@aegisacademy.edu',
                    logoUrl: school?.logoUrl || '',
                    sealUrl: school?.sealUrl || '',
                    currencySymbol: overview?.currencySymbol || '$',
                    studentName: 'Leo da Vinci',
                    studentId: 'ST-009',
                    admissionNumber: 'ADM-2026-004',
                    className: 'Grade 10',
                    sectionName: 'A',
                    feeDescription: showInvoicePdf.name,
                    amount: parseFloat(showInvoicePdf.amount.replace(/[^0-9.]/g, '')) || 0,
                    paymentDate: showInvoicePdf.date,
                    paymentMethod: 'ONLINE',
                    transactionId: showInvoicePdf.code
                  });
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
      {showAddSubAdmin && (currentPlanName === 'pro' || currentPlanName === 'enterprise') && (
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
                  <option value="HOSTEL_ADMIN">Hostel Administrator</option>
                  <option value="WARDEN">Hostel Warden</option>
                  <option value="SPORTS_ADMIN">Sports Administrator</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-brand-400 font-mono">ROLE PROFILE: {subAdminRoleDetails[saRole]?.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-brand-500/10 text-[8px] font-bold text-slate-400">Default Access Card</span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-medium">{subAdminRoleDetails[saRole]?.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rbacModules.map(m => {
                      const isAllowed = subAdminRoleDetails[saRole]?.permissions.includes(m.key);
                      return (
                        <span key={m.key} className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${isAllowed ? 'bg-green-500/10 text-green-400 border border-green-500/25' : 'bg-red-500/10 text-red-400 border border-red-500/25'}`}>
                          {m.label.split(' ')[0]}: {isAllowed ? 'Allowed' : 'Blocked'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                <input type="text" placeholder="First Name" value={saFirst} onChange={(e) => setSaFirst(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                <input type="text" placeholder="Last Name" value={saLast} onChange={(e) => setSaLast(e.target.value)} className="w-full bg-slate-900 border border-slate-800 text-xs rounded-lg p-2 focus:outline-none" />
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
                  <option value="HOSTEL_ADMIN">Hostel Administrator</option>
                  <option value="WARDEN">Hostel Warden</option>
                  <option value="CUSTOM_SUB_ADMIN">Custom Operator</option>
                  <option value="SPORTS_ADMIN">Sports Administrator</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-brand-400 font-mono">ROLE PROFILE: {subAdminRoleDetails[editRole]?.name}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-brand-500/10 text-[8px] font-bold text-slate-400">Default Access Card</span>
                  </div>
                  <p className="text-[10px] text-slate-300 font-medium">{subAdminRoleDetails[editRole]?.description}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rbacModules.map(m => {
                      const isAllowed = subAdminRoleDetails[editRole]?.permissions.includes(m.key);
                      return (
                        <span key={m.key} className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase ${isAllowed ? 'bg-green-500/10 text-green-400 border border-green-500/25' : 'bg-red-500/10 text-red-400 border border-red-500/25'}`}>
                          {m.label.split(' ')[0]}: {isAllowed ? 'Allowed' : 'Blocked'}
                        </span>
                      );
                    })}
                  </div>
                </div>
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
        <PremiumLock 
          isLocked={!ent.hasTransportAccess} 
          requiredTier="Enterprise" 
          featureName="Transit & Transport Management"
        >
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
              {!canManageTransport && (
                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded-lg">VIEW-ONLY MODE</span>
              )}
            </GlassCard>

            {/* Sub-Tab Navigation */}
            <div className="flex items-center gap-1 p-1 bg-slate-900/60 border border-slate-850 rounded-xl w-fit">
              {[
                { id: 'fleet' as const, label: 'Fleet & Routes', icon: '🚌' },
                { id: 'staff' as const, label: 'Staff & Passenger Maps', icon: '👥' },
                { id: 'financials' as const, label: 'Transport Financials', icon: '💰' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setTransportSubTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                    transportSubTab === tab.id
                      ? 'bg-brand-600 text-slate-100 shadow-lg shadow-brand-600/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  <span className="mr-1.5">{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>

            {transportSubTab === 'fleet' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* COLUMN 1: Buses Fleet Registry */}
                <div className="space-y-6">
                  <GlassCard className="space-y-4">
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Layers className="text-brand-400" size={15} />
                      Buses Fleet Registry
                    </h4>
                    {canManageTransport ? (
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
                    ) : (
                      <p className="text-[10px] text-slate-400 italic bg-slate-950/10 p-3 border border-slate-850 rounded-xl">Vehicle registrations are view-only.</p>
                    )}

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
                              {canManageTransport && (
                                <button onClick={() => handleDeleteBus(b.id)} className="p-1 rounded hover:bg-red-500/10 text-slate-500 hover:text-red-400"><Trash2 size={12} /></button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlassCard>
                </div>

                {/* COLUMN 2: Maintenance Expense Log */}
                <div className="space-y-6">
                  <GlassCard className="space-y-4">
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Sliders className="text-brand-400" size={15} />
                      Maintenance Expense Log
                    </h4>
                    {canManageTransport ? (
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
                    ) : (
                      <p className="text-[10px] text-slate-400 italic bg-slate-950/10 p-3 border border-slate-850 rounded-xl">Maintenance logs are view-only.</p>
                    )}

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

                {/* COLUMN 3: Transit Routes Planner */}
                <div className="space-y-6">
                  <GlassCard className="space-y-4">
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Layers className="text-brand-400" size={15} />
                      Transit Routes Planner
                    </h4>
                    {canManageTransport ? (
                      <form onSubmit={handleCreateRoute} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">Route Name</label>
                            <input type="text" placeholder="e.g. North Expressway" value={rtName} onChange={(e) => setRtName(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" required />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">Route Code</label>
                            <input type="text" placeholder="e.g. R-101" value={rtCode} onChange={(e) => setRtCode(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" required />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">Start Point</label>
                            <input type="text" placeholder="Start" value={rtStart} onChange={(e) => setRtStart(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">End Point</label>
                            <input type="text" placeholder="Campus" value={rtEnd} onChange={(e) => setRtEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">Fare ($)</label>
                            <input type="number" value={rtFare} onChange={(e) => setRtFare(parseFloat(e.target.value))} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" required />
                          </div>
                        </div>
                        <button type="submit" className="w-full py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-slate-100 transition-colors">Add Route</button>
                      </form>
                    ) : (
                      <p className="text-[10px] text-slate-400 italic bg-slate-950/10 p-3 border border-slate-850 rounded-xl">Route planning is view-only.</p>
                    )}

                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {routes.map(r => (
                        <div key={r.id} className="p-2 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                          <div>
                            <p className="font-bold text-slate-250">{r.name} ({r.routeCode})</p>
                            <p className="text-[8px] text-slate-500">From: {r.startPoint} {'\u2192'} To: {r.endPoint} | Fare: ${Number(r.fare).toFixed(2)}</p>
                          </div>
                          {canManageTransport && (
                            <button onClick={() => handleDeleteRoute(r.id)} className="p-1 text-slate-500 hover:text-red-400 rounded"><Trash2 size={12} /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                </div>
              </div>
            )}

            {transportSubTab === 'staff' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Driver Registry & Daily Attendance */}
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <UsersRound className="text-brand-400" size={15} />
                    Driver Registry & Daily Attendance
                  </h4>
                  {canManageTransport ? (
                    <form onSubmit={handleRegisterDriver} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Register New Driver</p>
                      <div className="space-y-1">
                        <label className="text-[9px] text-slate-500 font-bold uppercase">Name</label>
                        <input type="text" placeholder="Full name" value={drName} onChange={(e) => setDrName(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" required />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase">License Number</label>
                          <input type="text" placeholder="DL-XXXX" value={drLicense} onChange={(e) => setDrLicense(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] text-slate-500 font-bold uppercase">Phone</label>
                          <input type="text" placeholder="+1 555-..." value={drPhone} onChange={(e) => setDrPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-850 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" required />
                        </div>
                      </div>
                      <button type="submit" className="w-full py-1.5 rounded-lg text-xs font-bold bg-brand-600 hover:bg-brand-700 text-slate-100 transition-colors">Register Driver</button>
                    </form>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic bg-slate-950/10 p-3 border border-slate-850 rounded-xl">Driver registrations are view-only.</p>
                  )}

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
                          {canManageTransport ? (
                            <div className="flex items-center gap-1.5">
                              <button onClick={() => handleMarkDriverAttendance(d.id, 'PRESENT')} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${status === 'PRESENT' ? 'bg-green-600 text-slate-100' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>Present</button>
                              <button onClick={() => handleMarkDriverAttendance(d.id, 'ABSENT')} className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${status === 'ABSENT' ? 'bg-red-600 text-slate-100' : 'bg-slate-900 border border-slate-800 text-slate-400'}`}>Absent</button>
                            </div>
                          ) : (
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${status === 'PRESENT' ? 'bg-green-500/10 text-green-400' : status === 'ABSENT' ? 'bg-red-500/10 text-red-400' : 'bg-slate-500/10 text-slate-400'}`}>
                              {status}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>

                {/* Route Pickup Stops Coordinates */}
                <div className="space-y-6">
                  <GlassCard className="space-y-4">
                    <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                      <Layers className="text-brand-400" size={15} />
                      Route Pickup Stops Coordinates
                    </h4>
                    {canManageTransport ? (
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
                    ) : (
                      <p className="text-[10px] text-slate-400 italic bg-slate-950/10 p-3 border border-slate-850 rounded-xl">Transit stops planning is view-only.</p>
                    )}

                    <div className="overflow-x-auto border border-slate-850/50 rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                            <th className="py-2.5 px-3">Stop Name</th>
                            <th className="py-2.5 px-3">Route Code</th>
                            <th className="py-2.5 px-3">Coordinates</th>
                            {canManageTransport && <th className="py-2.5 px-3 text-right">Action</th>}
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
                                {canManageTransport && (
                                  <td className="py-2 px-3 text-right">
                                    <button onClick={() => handleDeletePickupPoint(pp.id)} className="text-slate-550 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                                  </td>
                                )}
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
                    {canManageTransport ? (
                      <form onSubmit={handleCreateTransportAssignment} className="space-y-3 p-3 bg-slate-950/20 border border-slate-850 rounded-xl">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] text-slate-500 font-bold uppercase">Select Student</label>
                            <select value={taStudentId} onChange={(e) => setTaStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                              <option value="">-- Choose Student --</option>
                              {students.map(s => (
                                <option key={s.id} value={s.id}>{formatUserName(s.userDetails)} ({s.admissionNumber})</option>
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
                    ) : (
                      <p className="text-[10px] text-slate-400 italic bg-slate-950/10 p-3 border border-slate-850 rounded-xl">Transit stop assignments are view-only.</p>
                    )}

                    <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-56">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                            <th className="py-2.5 px-3">Student</th>
                            <th className="py-2.5 px-3">Bus Plate</th>
                            <th className="py-2.5 px-3">RouteStop</th>
                            {canManageTransport && <th className="py-2.5 px-3 text-right">Actions</th>}
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
                                  {student ? formatUserName(student.userDetails) : 'Unknown'}
                                </td>
                                <td className="py-2 px-3 font-mono">{bus ? bus.numberPlate : 'N/A'}</td>
                                <td className="py-2 px-3">
                                  <span className="text-brand-400 font-bold">[{route ? route.routeCode : 'N/A'}]</span> {pp ? pp.name : 'N/A'}
                                </td>
                                {canManageTransport && (
                                  <td className="py-2 px-3 text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button type="button" onClick={() => { setEditingTransportAssignment(ta); setEditTaBusId(ta.busId); setEditTaRouteId(ta.routeId); setEditTaPickupPointId(ta.pickupPointId || ''); }} className="text-brand-400 hover:text-brand-300 p-0.5" title="Edit"><Edit size={11} /></button>
                                      <button type="button" onClick={() => handleDeleteTransportAssignment(ta.id)} className="text-slate-550 hover:text-red-400 p-1" title="Delete"><Trash2 size={12} /></button>
                                    </div>
                                  </td>
                                )}
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

            {transportSubTab === 'financials' && (
              <div className="space-y-6">
                {/* Transport Fee Collections */}
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <DollarSign className="text-brand-400" size={15} />
                    Transport Fee Collections Ledger
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                    <div className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl text-center">
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Total Records</p>
                      <p className="text-lg font-bold text-slate-200">{transportFeeRecords.length}</p>
                    </div>
                    <div className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl text-center">
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Total Billed</p>
                      <p className="text-lg font-bold text-brand-400">${transportFeeRecords.reduce((s: number, r: any) => s + Number(r.amount || 0), 0).toFixed(2)}</p>
                    </div>
                    <div className="p-2.5 bg-green-950/30 border border-green-500/20 rounded-xl text-center">
                      <p className="text-[9px] text-green-500 font-bold uppercase">Paid</p>
                      <p className="text-lg font-bold text-green-400">${transportFeeRecords.filter((r: any) => r.status === 'PAID').reduce((s: number, r: any) => s + Number(r.amount || 0), 0).toFixed(2)}</p>
                    </div>
                    <div className="p-2.5 bg-red-950/30 border border-red-500/20 rounded-xl text-center">
                      <p className="text-[9px] text-red-500 font-bold uppercase">Unpaid</p>
                      <p className="text-lg font-bold text-red-400">${transportFeeRecords.filter((r: any) => r.status === 'UNPAID').reduce((s: number, r: any) => s + Number(r.amount || 0), 0).toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-64">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                          <th className="py-2.5 px-3">Student</th>
                          <th className="py-2.5 px-3">Route</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/40 text-slate-350">
                        {transportFeeRecords.map((rec: any) => {
                          const student = students.find(s => s.id === rec.studentId);
                          const route = routes.find(r => r.id === rec.routeId);
                          return (
                            <tr key={rec.id} className="hover:bg-slate-900/10">
                              <td className="py-2 px-3 font-semibold text-slate-200">
                                {student ? formatUserName(student.userDetails) : (rec.studentId?.slice(0, 8) + '…')}
                              </td>
                              <td className="py-2 px-3">{route ? `${route.name} (${route.routeCode})` : 'N/A'}</td>
                              <td className="py-2 px-3 font-mono text-brand-400 font-bold">${Number(rec.amount || 0).toFixed(2)}</td>
                              <td className="py-2 px-3">
                                {(() => {
                                  const canToggleFeeStatus = session?.user.role === 'ADMIN' || session?.user.role === 'FINANCE_ADMIN';
                                  return canToggleFeeStatus ? (
                                    <button
                                      onClick={() => handleToggleTransportFeePayment(rec.id, rec.status || 'UNPAID')}
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold transition-all hover:scale-105 ${
                                        rec.status === 'PAID'
                                          ? 'bg-green-500/10 text-green-400 border border-green-500/30'
                                          : 'bg-red-500/10 text-red-400 border border-red-500/30'
                                      }`}
                                    >
                                      {rec.status || 'UNPAID'} 🔄
                                    </button>
                                  ) : (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                        rec.status === 'PAID' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                      }`}
                                    >
                                      {rec.status || 'UNPAID'}
                                    </span>
                                  );
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                        {transportFeeRecords.length === 0 && (
                          <tr><td colSpan={4} className="py-6 text-center text-slate-500 font-mono">No transport fee records found.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>

                {/* Maintenance Expense Journal */}
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <Sliders className="text-brand-400" size={15} />
                    Maintenance Expense Journal
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
                    <div className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl text-center">
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Total Entries</p>
                      <p className="text-lg font-bold text-slate-200">{maintenanceLogs.length}</p>
                    </div>
                    <div className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl text-center">
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Total Spend</p>
                      <p className="text-lg font-bold text-red-400">${maintenanceLogs.reduce((s: number, ml: any) => s + Number(ml.cost || 0), 0).toFixed(2)}</p>
                    </div>
                    <div className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl text-center">
                      <p className="text-[9px] text-slate-500 font-bold uppercase">Active Fleet</p>
                      <p className="text-lg font-bold text-brand-400">{buses.filter((b: any) => b.status === 'ACTIVE').length}/{buses.length}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                          <th className="py-2.5 px-3">Bus</th>
                          <th className="py-2.5 px-3">Description</th>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3 text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/40 text-slate-350">
                        {maintenanceLogs.map((ml: any) => {
                          const bus = buses.find((b: any) => b.id === ml.busId);
                          return (
                            <tr key={ml.id} className="hover:bg-slate-900/10">
                              <td className="py-2 px-3 font-mono text-slate-200">{bus ? bus.numberPlate : 'Unknown'}</td>
                              <td className="py-2 px-3 font-semibold text-slate-300">{ml.description}</td>
                              <td className="py-2 px-3 text-slate-400">{ml.logDate || ml.createdAt?.split('T')[0] || '-'}</td>
                              <td className="py-2 px-3 text-right font-mono text-red-400 font-bold">${Number(ml.cost || 0).toFixed(2)}</td>
                            </tr>
                          );
                        })}
                        {maintenanceLogs.length === 0 && (
                          <tr><td colSpan={4} className="py-6 text-center text-slate-500 font-mono">No maintenance records.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>

                {/* Driver Attendance & Salary Disbursal Controls */}
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <UsersRound className="text-brand-400" size={15} />
                    Driver Salary Disbursal Controls
                  </h4>
                  <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                          <th className="py-2.5 px-3">Driver Name</th>
                          <th className="py-2.5 px-3">License</th>
                          <th className="py-2.5 px-3">Present Days</th>
                          <th className="py-2.5 px-3">Unpaid Days</th>
                          <th className="py-2.5 px-3">Pending</th>
                          <th className="py-2.5 px-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/40 text-slate-350">
                        {driversList.map(driver => {
                          const driverPresentRecords = driverAttendanceList.filter(
                            a => a.driverId === driver.id && a.status === 'PRESENT'
                          );
                          const unpaidRecords = driverPresentRecords.filter(
                            rec => !driverSalaryPayouts.some(
                              p => p.attendanceRecordId === rec.id || 
                              (p.driverId === driver.id && rec.date <= p.payoutDate.split('T')[0])
                            )
                          );
                          const presentCount = driverPresentRecords.length;
                          const unpaidCount = unpaidRecords.length;
                          const dailyRate = 45.00;
                          const pendingPayout = unpaidCount * dailyRate;
                          const isDisbursing = disbursingDriverId === driver.id;
                          const canDisburse = session?.user.role === 'FINANCE_ADMIN';

                          return (
                            <tr key={driver.id} className="hover:bg-slate-900/10">
                              <td className="py-2 px-3 font-semibold text-slate-200">
                                {driver.name}
                              </td>
                              <td className="py-2 px-3 font-mono text-[10px]">{driver.licenseNumber}</td>
                              <td className="py-2 px-3 font-mono">{presentCount} Days</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${unpaidCount > 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-500/10 text-slate-400'}`}>
                                  {unpaidCount} Days
                                </span>
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-brand-400">${pendingPayout.toFixed(2)}</td>
                              <td className="py-2 px-3 text-right">
                                {canDisburse ? (
                                  <button
                                    onClick={() => handleDisburseDriverSalary(driver.id, pendingPayout, unpaidRecords[0]?.id || null)}
                                    disabled={pendingPayout === 0 || isDisbursing}
                                    className={`px-2 py-0.5 rounded text-[8px] font-bold transition-all ${
                                      pendingPayout === 0 || isDisbursing
                                        ? 'bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/10 active:scale-95'
                                    }`}
                                  >
                                    {isDisbursing ? 'Disbursing...' : 'Disburse'}
                                  </button>
                                ) : (
                                  <span className="text-[8px] text-slate-500 italic">No Perms</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {driversList.length === 0 && (
                          <tr><td colSpan={6} className="py-6 text-center text-slate-500 font-mono">No active drivers registered.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>

                {/* Driver Salary Payout Ledger */}
                <GlassCard className="space-y-4">
                  <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                    <UsersRound className="text-brand-400" size={15} />
                    Driver Salary Payout Ledger
                  </h4>
                  <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-56">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/40">
                          <th className="py-2.5 px-3">Driver</th>
                          <th className="py-2.5 px-3">Month</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850/40 text-slate-350">
                        {driverSalaryPayouts.map((dp: any) => {
                          const driver = driversList.find((d: any) => d.id === dp.driverId);
                          const displayName = driver
                            ? (driver.status === 'INACTIVE' ? `Former Driver - ${driver.name}` : driver.name)
                            : (dp.driverName ? `Former Driver - ${dp.driverName}` : 'Unknown Driver');
                          return (
                            <tr key={dp.id} className="hover:bg-slate-900/10">
                              <td className="py-2 px-3 font-semibold text-slate-200">{displayName}</td>
                              <td className="py-2 px-3 text-slate-400">{dp.month || dp.payoutMonth || '-'}</td>
                              <td className="py-2 px-3 font-mono text-brand-400 font-bold">${Number(dp.amount || 0).toFixed(2)}</td>
                              <td className="py-2 px-3">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${dp.status === 'PAID' ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-400'}`}>{dp.status || 'PENDING'}</span>
                              </td>
                            </tr>
                          );
                        })}
                        {driverSalaryPayouts.length === 0 && (
                          <tr><td colSpan={4} className="py-6 text-center text-slate-500 font-mono">No salary payouts recorded yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </GlassCard>
              </div>
            )}
          </div>
        </PremiumLock>
      )}

      {activeTab === 'hostel' && (
        <PremiumLock 
          isLocked={!ent.hasHostelAccess} 
          requiredTier="Enterprise" 
          featureName="Granular Hostel & Roster Management"
        >
          <div className="space-y-6 animate-fade-in text-xs">
            {/* Header */}
            <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <Home className="text-brand-400" size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-100 text-sm">Hostel & Housing Roster Registry</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Manage building layouts, room capacities, warden mappings, student check-ins, visitor entries, complaint files, and weekly menus.</p>
                </div>
              </div>
            </GlassCard>

            {/* Sub Tabs Selection */}
            {(() => {
              const isWarden = session?.user.role === 'WARDEN';
              const hostelTabs = isWarden 
                ? [
                    { id: 'attendance', label: 'Warden Attendance Roll' },
                    { id: 'admissions', label: 'Admissions & Vacancies' },
                    { id: 'leaves', label: 'Student Leave Requests' },
                    { id: 'visitors', label: 'Visitor Check-in Log' },
                    { id: 'complaints', label: 'Complaint Files' },
                    { id: 'menu', label: 'Weekly Mess Menu' }
                  ]
                : [
                    { id: 'structures', label: 'Hostel Structures' },
                    { id: 'wardens', label: 'Warden Assignment' },
                    { id: 'admissions', label: 'Admissions & Vacancies' },
                    { id: 'attendance', label: 'Daily Attendance' },
                    { id: 'leaves', label: 'Leave Workflows' },
                    { id: 'visitors', label: 'Visitors Log' },
                    { id: 'complaints', label: 'Complaints Office' },
                    { id: 'menu', label: 'Mess Planners' },
                    { id: 'fees', label: 'Fees & Invoicing' }
                  ];

              return (
                <div className="space-y-6">
                  {/* Sub tab nav */}
                  <div className="flex flex-wrap gap-2 border-b border-slate-850 pb-3">
                    {hostelTabs.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setHostelSubTab(t.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                          hostelSubTab === t.id 
                            ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' 
                            : 'bg-slate-900/50 hover:bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-850'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* 1. Hostel Structures Sub-tab */}
                  {hostelSubTab === 'structures' && !isWarden && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Left: Building & Blocks */}
                      <div className="lg:col-span-2 space-y-6">
                        <GlassCard className="space-y-4">
                          <h4 className="font-bold text-slate-200 text-xs">Register Building</h4>
                          <form onSubmit={handleCreateHostel} className="space-y-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Building Name</label>
                              <input type="text" value={hName} onChange={e => setHName(e.target.value)} placeholder="e.g. Einstein Block" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500" required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Gender Housing Type</label>
                                <select value={hType} onChange={e => setHType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500">
                                  <option value="BOYS">BOYS</option>
                                  <option value="GIRLS">GIRLS</option>
                                  <option value="MIXED">MIXED</option>
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                                <select value={hStatus} onChange={e => setHStatus(e.target.value as any)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand-500">
                                  <option value="ACTIVE">ACTIVE</option>
                                  <option value="INACTIVE">INACTIVE</option>
                                </select>
                              </div>
                            </div>
                            <button type="submit" className="glass-btn-primary w-full text-xs">Create Building</button>
                          </form>
                        </GlassCard>

                        <GlassCard className="space-y-4">
                          <h4 className="font-bold text-slate-200 text-xs">Register Block/Wing</h4>
                          <form onSubmit={handleCreateBlock} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Building</label>
                                <select value={hbHostelId} onChange={e => setHbHostelId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none" required>
                                  <option value="">-- Choose --</option>
                                  {hostels.map(h => (
                                    <option key={h.id} value={h.id}>{h.name} ({h.type})</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Block Name</label>
                                <input type="text" value={hbName} onChange={e => setHbName(e.target.value)} placeholder="e.g. North Wing" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none" required />
                              </div>
                            </div>
                            <button type="submit" className="glass-btn-primary w-full text-xs">Create Block</button>
                          </form>
                        </GlassCard>
                      </div>

                      {/* Right: Floors, Rooms & Beds */}
                      <div className="lg:col-span-2 space-y-6">
                        <GlassCard className="space-y-4">
                          <h4 className="font-bold text-slate-200 text-xs">Register Room</h4>
                          <form onSubmit={handleCreateRoom} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Block</label>
                                <select value={hrBlockId} onChange={e => setHrBlockId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none" required>
                                  <option value="">-- Choose --</option>
                                  {hostelBlocks.map(b => {
                                    const h = hostels.find(x => x.id === b.hostelId);
                                    return <option key={b.id} value={b.id}>{h ? `${h.name} - ` : ''}{b.name}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Room Number / ID</label>
                                <input type="text" value={hrRoomNumber} onChange={e => setHrRoomNumber(e.target.value)} placeholder="e.g. 101" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none" required />
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Floor Level</label>
                                <input type="number" value={hrFloor} onChange={e => setHrFloor(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Room Bed Capacity</label>
                                <input type="number" value={hrCapacity} onChange={e => setHrCapacity(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                              </div>
                            </div>
                            <button type="submit" className="glass-btn-primary w-full text-xs">Configure Room</button>
                          </form>
                        </GlassCard>

                        <GlassCard className="space-y-4">
                          <h4 className="font-bold text-slate-200 text-xs">Configure Beds</h4>
                          <form onSubmit={handleCreateBed} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Room</label>
                                <select value={hbedRoomId} onChange={e => setHbedRoomId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none" required>
                                  <option value="">-- Choose Room --</option>
                                  {hostelRooms.map(r => {
                                    const b = hostelBlocks.find(x => x.id === r.blockId);
                                    const h = b ? hostels.find(x => x.id === b.hostelId) : null;
                                    return <option key={r.id} value={r.id}>{h ? `${h.name} - ` : ''}Room {r.roomNumber}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Bed Designation / Name</label>
                                <input type="text" value={hbedName} onChange={e => setHbedName(e.target.value)} placeholder="e.g. Bed A" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none" required />
                              </div>
                            </div>
                            <button type="submit" className="glass-btn-primary w-full text-xs">Add Bed</button>
                          </form>
                        </GlassCard>
                      </div>

                      {/* Display lists */}
                      <div className="lg:col-span-4 space-y-6">
                        <GlassCard className="space-y-3">
                          <h4 className="font-bold text-slate-200 text-xs">Registered Housing Buildings</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left text-slate-400">
                              <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                                <tr>
                                  <th className="p-3">Building Name</th>
                                  <th className="p-3">Gender Type</th>
                                  <th className="p-3">Blocks Counts</th>
                                  <th className="p-3">Status</th>
                                  <th className="p-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hostels.length === 0 ? (
                                  <tr><td colSpan={5} className="p-4 text-center">No buildings configured.</td></tr>
                                ) : hostels.map(h => {
                                  const blkCount = hostelBlocks.filter(b => b.hostelId === h.id).length;
                                  return (
                                    <tr key={h.id} className="border-b border-slate-850 hover:bg-slate-900/30">
                                      <td className="p-3 font-semibold text-slate-200">{h.name}</td>
                                      <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-900 text-brand-400 font-bold border border-slate-800">{h.type}</span></td>
                                      <td className="p-3">{blkCount} Blocks</td>
                                      <td className="p-3"><span className={`px-2 py-0.5 rounded text-[9px] font-bold ${h.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>{h.status}</span></td>
                                      <td className="p-3 text-right">
                                        <button onClick={() => handleDeleteHostel(h.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={12} /></button>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </GlassCard>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <GlassCard className="space-y-3">
                            <h4 className="font-bold text-slate-200 text-xs">Configure Wings/Blocks</h4>
                            <div className="max-h-[300px] overflow-y-auto">
                              <table className="w-full text-[11px] text-left">
                                <thead className="bg-slate-900/60 font-bold">
                                  <tr>
                                    <th className="p-2">Block Name</th>
                                    <th className="p-2">Building</th>
                                    <th className="p-2 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hostelBlocks.map(b => {
                                    const h = hostels.find(x => x.id === b.hostelId);
                                    return (
                                      <tr key={b.id} className="border-b border-slate-850 hover:bg-slate-900/30">
                                        <td className="p-2 text-slate-200 font-semibold">{b.name}</td>
                                        <td className="p-2">{h ? h.name : 'Unknown'}</td>
                                        <td className="p-2 text-right">
                                          <button onClick={() => handleDeleteBlock(b.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={11} /></button>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </GlassCard>

                          <GlassCard className="space-y-3">
                            <h4 className="font-bold text-slate-200 text-xs">Configured Bed Spaces</h4>
                            <div className="max-h-[300px] overflow-y-auto">
                              <table className="w-full text-[11px] text-left">
                                <thead className="bg-slate-900/60 font-bold">
                                  <tr>
                                    <th className="p-2">Bed Designation</th>
                                    <th className="p-2">Room (Building)</th>
                                    <th className="p-2">Current Status</th>
                                    <th className="p-2 text-right">Action</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {hostelBeds.map(bd => {
                                    const rm = hostelRooms.find(x => x.id === bd.roomId);
                                    const bk = rm ? hostelBlocks.find(x => x.id === rm.blockId) : null;
                                    const h = bk ? hostels.find(x => x.id === bk.hostelId) : null;
                                    return (
                                      <tr key={bd.id} className="border-b border-slate-850 hover:bg-slate-900/30">
                                        <td className="p-2 text-slate-200 font-semibold">{bd.bedName}</td>
                                        <td className="p-2">{rm ? `Room ${rm.roomNumber}` : 'Unknown'} ({h ? h.name : ''})</td>
                                        <td className="p-2">
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${bd.status === 'VACANT' ? 'bg-green-500/10 text-green-400' : bd.status === 'OCCUPIED' ? 'bg-brand-500/10 text-brand-400' : 'bg-amber-500/10 text-amber-400'}`}>{bd.status}</span>
                                        </td>
                                        <td className="p-2 text-right">
                                          <button onClick={() => handleDeleteBed(bd.id)} className="text-slate-500 hover:text-red-400 p-1"><Trash2 size={11} /></button>
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
                    </div>
                  )}

                  {/* 2. Wardens Assignment Sub-tab */}
                  {hostelSubTab === 'wardens' && !isWarden && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <GlassCard className="space-y-4 h-fit">
                        <h4 className="font-bold text-slate-200 text-xs">
                          {editWardenId ? 'Edit Warden Profile & Responsibilities' : 'Create & Register New Warden'}
                        </h4>
                        <form onSubmit={handleSaveWarden} className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">First Name</label>
                              <input type="text" value={wFirstName} onChange={e => setWFirstName(e.target.value)} placeholder="John" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Last Name</label>
                              <input type="text" value={wLastName} onChange={e => setWLastName(e.target.value)} placeholder="Doe" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Email Address</label>
                              <input type="email" value={wEmail} onChange={e => setWEmail(e.target.value)} placeholder="warden@school.com" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Phone Number</label>
                              <input type="text" value={wPhone} onChange={e => setWPhone(e.target.value)} placeholder="+1 (555) 019-2834" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Employee ID</label>
                              <input type="text" value={wEmployeeId} onChange={e => setWEmployeeId(e.target.value)} placeholder="EMP-WRD-01" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Gender</label>
                              <select value={wGender} onChange={e => setWGender(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs">
                                <option value="MALE">MALE</option>
                                <option value="FEMALE">FEMALE</option>
                                <option value="OTHER">OTHER</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Username</label>
                              <input type="text" value={wUsername} onChange={e => setWUsername(e.target.value)} placeholder="johndoe_warden" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Account Status</label>
                              <select value={String(wIsActive)} onChange={e => setWIsActive(e.target.value === 'true')} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs">
                                <option value="true">Active</option>
                                <option value="false">Inactive</option>
                              </select>
                            </div>
                          </div>

                          {!editWardenId && (
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Login Password</label>
                              <input type="password" value={wPassword} onChange={e => setWPassword(e.target.value)} placeholder="••••••••" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                          )}

                          <div>
                            <label className="text-[9px] font-bold text-slate-500 uppercase">Residential Address</label>
                            <textarea value={wAddress} onChange={e => setWAddress(e.target.value)} placeholder="Address line..." className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs h-12 resize-none" required></textarea>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Designation</label>
                              <input type="text" value={wDesignation} onChange={e => setWDesignation(e.target.value)} placeholder="Senior Warden" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-500 uppercase">Joining Date</label>
                              <input type="date" value={wJoiningDate} onChange={e => setWJoiningDate(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                          </div>

                          {/* Location Assigner Section */}
                          <div className="border-t border-slate-850 pt-3 mt-2">
                            <span className="text-[10px] font-bold text-slate-400 block mb-2">Assign Housing Locations</span>
                            
                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="text-[8px] font-bold text-slate-550 uppercase">Building</label>
                                <select value={wlHostelId} onChange={e => { setWlHostelId(e.target.value); setWlBlockId(''); }} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-2 py-1.5 text-[10px]">
                                  <option value="">-- Choose --</option>
                                  {hostels.map(h => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-550 uppercase">Block / Wing</label>
                                <select value={wlBlockId} onChange={e => setWlBlockId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-2 py-1.5 text-[10px]" disabled={!wlHostelId}>
                                  <option value="">-- Optional --</option>
                                  {hostelBlocks.filter(b => b.hostelId === wlHostelId).map(b => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mb-2">
                              <div>
                                <label className="text-[8px] font-bold text-slate-550 uppercase">Floor</label>
                                <input type="number" value={wlFloor} onChange={e => setWlFloor(e.target.value !== '' ? Number(e.target.value) : '')} placeholder="e.g. 1" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-2 py-1.5 text-[10px]" />
                              </div>
                              <div>
                                <label className="text-[8px] font-bold text-slate-550 uppercase">Section Name</label>
                                <input type="text" value={wlSection} onChange={e => setWlSection(e.target.value)} placeholder="e.g. Wing A" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-2 py-1.5 text-[10px]" />
                              </div>
                            </div>

                            <button type="button" onClick={handleAddAssignedLocation} className="glass-btn-secondary text-[10px] w-full py-1 text-brand-400 font-bold hover:bg-slate-850">+ Add Assignment Location</button>

                            {/* List of current assignments */}
                            <div className="mt-2 space-y-1.5 max-h-[120px] overflow-y-auto">
                              {wAssignedLocations.length === 0 ? (
                                <p className="text-[9px] text-slate-500 italic">No locations assigned yet.</p>
                              ) : (
                                wAssignedLocations.map((loc, idx) => (
                                  <div key={idx} className="flex justify-between items-center bg-slate-900/60 border border-slate-850 px-2 py-1 rounded-lg text-[9px]">
                                    <span className="text-slate-300">
                                      {loc.buildingName} 
                                      {loc.blockName ? ` • ${loc.blockName}` : ''}
                                      {loc.floor !== null ? ` • Floor ${loc.floor}` : ''}
                                      {loc.section ? ` • Sec ${loc.section}` : ''}
                                    </span>
                                    <button type="button" onClick={() => handleRemoveAssignedLocation(idx)} className="text-red-400 hover:text-red-300 font-bold px-1">✕</button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <button type="submit" className="glass-btn-primary flex-1 text-xs">
                              {editWardenId ? 'Update Warden' : 'Register Warden'}
                            </button>
                            <button 
                              type="button" 
                              onClick={clearWardenForm} 
                              className="bg-slate-800 hover:bg-slate-750 text-slate-300 px-3 py-2 rounded-xl text-xs"
                            >
                              Reset
                            </button>
                          </div>
                        </form>
                      </GlassCard>

                      <div className="lg:col-span-2">
                        <GlassCard className="space-y-3">
                          <h4 className="font-bold text-slate-200 text-xs">Active Wardens & Housing Overseers</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                                <tr>
                                  <th className="p-3">Warden Profile</th>
                                  <th className="p-3">Contact details</th>
                                  <th className="p-3">Assigned Locations</th>
                                  <th className="p-3 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hostelWardens.length === 0 ? (
                                  <tr><td colSpan={4} className="p-4 text-center">No wardens registered.</td></tr>
                                ) : hostelWardens.map(w => {
                                  const usrObj = mockDb.users.find(u => u.id === w.userId) || w.userDetails || null;
                                  const isActive = usrObj?.isActive !== false;
                                  return (
                                    <tr key={w.id} className="border-b border-slate-850 hover:bg-slate-900/30">
                                      <td className="p-3">
                                        <div className="font-semibold text-slate-200">
                                          {usrObj ? formatUserName(usrObj) : 'Warden'}
                                        </div>
                                        {w.designation && (
                                          <div className="text-[10px] text-brand-400 font-medium">{w.designation}</div>
                                        )}
                                        <div className="text-[9px] text-slate-500">Username: @{w.username || usrObj?.email?.split('@')[0]}</div>
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold mt-1 ${isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                          {isActive ? 'Active' : 'Inactive'}
                                        </span>
                                      </td>
                                      <td className="p-3">
                                        <div className="font-mono text-slate-300">{w.phone || usrObj?.phone || 'No Phone'}</div>
                                        <div className="text-[10px] text-slate-400">{usrObj?.email}</div>
                                        <div className="text-[9px] text-slate-500">Emp ID: {usrObj?.employeeId || 'N/A'}</div>
                                        {w.joiningDate && (
                                          <div className="text-[9px] text-slate-500">Joined: {new Date(w.joiningDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</div>
                                        )}
                                      </td>
                                      <td className="p-3">
                                        {(!w.assignedLocations || w.assignedLocations.length === 0) ? (
                                          <span className="text-amber-500 italic">Unassigned / General</span>
                                        ) : (
                                          <div className="space-y-0.5 max-h-[80px] overflow-y-auto">
                                            {w.assignedLocations.map((loc: any, lIdx: number) => (
                                              <div key={lIdx} className="text-[9px] text-slate-300 bg-slate-900/40 px-1.5 py-0.5 rounded border border-slate-850 w-fit">
                                                {loc.buildingName}
                                                {loc.blockName ? ` • ${loc.blockName}` : ''}
                                                {loc.floor !== null ? ` • Flr ${loc.floor}` : ''}
                                                {loc.section ? ` • Sec ${loc.section}` : ''}
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                      <td className="p-3 text-right">
                                        <div className="flex justify-end gap-1.5 items-center">
                                          <button 
                                            onClick={() => handleEditWardenClick(w)} 
                                            className="text-slate-500 hover:text-brand-400 p-1" 
                                            title="Edit Profile"
                                          >
                                            <Edit size={13} />
                                          </button>
                                          <button 
                                            onClick={async () => {
                                              const newStatus = !isActive;
                                              if (window.confirm(`Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} this warden?`)) {
                                                try {
                                                  await mockApi.updateHostelWarden(w.id, { isActive: newStatus });
                                                  loadData();
                                                  alert(`Warden ${newStatus ? 'activated' : 'deactivated'} successfully!`);
                                                } catch (e: any) {
                                                  alert(e.message || 'Failed to toggle status');
                                                }
                                              }
                                            }} 
                                            className={`p-1 ${isActive ? 'text-green-500 hover:text-amber-400' : 'text-slate-550 hover:text-green-400'}`} 
                                            title={isActive ? 'Deactivate Warden' : 'Activate Warden'}
                                          >
                                            {isActive ? <UserCheck size={13} /> : <UserX size={13} />}
                                          </button>
                                          <button onClick={() => handleDeleteWarden(w.id)} className="text-slate-500 hover:text-red-400 p-1" title="Delete Warden"><Trash2 size={13} /></button>
                                        </div>
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

                  {/* 3. Admissions & Vacancies Sub-tab */}
                  {hostelSubTab === 'admissions' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        {/* Admit student Form */}
                        <div className="lg:col-span-2">
                          <GlassCard className="space-y-4">
                            <h4 className="font-bold text-slate-200 text-xs">Record Student Check-in / Admission</h4>
                            <form onSubmit={handleAdmitStudent} className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Select Student</label>
                                  <select value={hadmStudentId} onChange={e => setHadmStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required>
                                    <option value="">-- Choose Student --</option>
                                    {students
                                      .filter(s => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.id))
                                      .map(s => {
                                        const u = mockDb.users.find(x => x.id === s.userId);
                                        return <option key={s.id} value={s.id}>{u ? formatUserName(u) : s.admissionNumber}</option>;
                                      })}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Select Building</label>
                                  <select value={hadmHostelId} onChange={e => { setHadmHostelId(e.target.value); setHadmRoomId(''); setHadmBedId(''); }} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required>
                                    <option value="">-- Choose Building --</option>
                                    {hostels.filter(h => h.status === 'ACTIVE').map(h => (
                                      <option key={h.id} value={h.id}>{h.name} ({h.type})</option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Select Room</label>
                                  <select value={hadmRoomId} onChange={e => { setHadmRoomId(e.target.value); setHadmBedId(''); }} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required>
                                    <option value="">-- Choose Room --</option>
                                    {hostelRooms
                                      .filter(r => {
                                        const b = hostelBlocks.find(x => x.id === r.blockId);
                                        return b && b.hostelId === hadmHostelId && r.status === 'ACTIVE';
                                      })
                                      .map(r => (
                                        <option key={r.id} value={r.id}>Room {r.roomNumber} (Cap: {r.capacity})</option>
                                      ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase">Select Bed (Vacant Only)</label>
                                  <select value={hadmBedId} onChange={e => setHadmBedId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required>
                                    <option value="">-- Choose Bed Space --</option>
                                    {hostelBeds
                                      .filter(bd => {
                                        if (bd.roomId !== hadmRoomId || bd.status === 'MAINTENANCE') return false;
                                        const isOccupied = hostelAdmissions.some(a => a.bedId === bd.id && a.status === 'ACTIVE');
                                        return !isOccupied;
                                      })
                                      .map(bd => (
                                        <option key={bd.id} value={bd.id}>{bd.bedName}</option>
                                      ))}
                                  </select>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Admission / Check-in Date</label>
                                <input type="date" value={hadmAdmissionDate} onChange={e => setHadmAdmissionDate(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                              </div>

                              <button type="submit" className="glass-btn-primary w-full text-xs">Record Check-in & Allocate Bed</button>
                            </form>
                          </GlassCard>
                        </div>

                        {/* Room Occupancy Matrix */}
                        <div className="lg:col-span-2">
                          <GlassCard className="space-y-3 h-full">
                            <h4 className="font-bold text-slate-200 text-xs">Real-Time Occupancy Analytics</h4>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-850">
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Total Beds</p>
                                <p className="text-xl font-bold text-slate-200 mt-1">{hostelBeds.length}</p>
                              </div>
                              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-850">
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Occupied Beds</p>
                                <p className="text-xl font-bold text-brand-400 mt-1">{hostelBeds.filter(b => b.status === 'OCCUPIED').length}</p>
                              </div>
                              <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-850">
                                <p className="text-[9px] font-bold text-slate-500 uppercase">Available Spots</p>
                                <p className="text-xl font-bold text-green-400 mt-1">{hostelBeds.filter(b => b.status === 'VACANT').length}</p>
                              </div>
                            </div>

                            <div className="space-y-2 mt-4 pt-3 border-t border-slate-850 max-h-[150px] overflow-y-auto">
                              <p className="text-[10px] font-bold text-slate-400">Housing Allocation Summary</p>
                              {hostels.map(h => {
                                const hBeds = hostelBeds.filter(bd => {
                                  const r = hostelRooms.find(x => x.id === bd.roomId);
                                  const b = r ? hostelBlocks.find(x => x.id === r.blockId) : null;
                                  return b && b.hostelId === h.id;
                                });
                                const occ = hBeds.filter(b => b.status === 'OCCUPIED').length;
                                const tot = hBeds.length;
                                return (
                                  <div key={h.id} className="flex justify-between items-center text-[10px] py-1">
                                    <span className="text-slate-300 font-semibold">{h.name} ({h.type})</span>
                                    <span className="text-slate-400">{occ} / {tot} occupied ({tot > 0 ? Math.round((occ / tot) * 100) : 0}%)</span>
                                  </div>
                                );
                              })}
                            </div>
                          </GlassCard>
                        </div>
                      </div>

                      {/* Active Admissions History Table */}
                      <GlassCard className="space-y-3">
                        <h4 className="font-bold text-slate-200 text-xs">Active Housing Residents & Bed Assignments</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                              <tr>
                                <th className="p-3">Student Name</th>
                                <th className="p-3">Hostel</th>
                                <th className="p-3">Room / Floor</th>
                                <th className="p-3">Bed Space</th>
                                <th className="p-3">Check-in Date</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hostelAdmissions.length === 0 ? (
                                  <tr><td colSpan={7} className="p-4 text-center">No student admissions recorded.</td></tr>
                              ) : hostelAdmissions.map(adm => {
                                const stObj = mockDb.students.find(s => s.id === adm.studentId);
                                const stUser = stObj ? mockDb.users.find(u => u.id === stObj.userId) : null;
                                const hostObj = hostels.find(h => h.id === adm.hostelId);
                                const rmObj = hostelRooms.find(r => r.id === adm.roomId);
                                const bedObj = hostelBeds.find(b => b.id === adm.bedId);

                                return (
                                  <tr key={adm.id} className="border-b border-slate-850 hover:bg-slate-900/30">
                                    <td className="p-3">
                                      <p className="font-semibold text-slate-200">{stUser ? formatUserName(stUser) : 'Student'}</p>
                                      <p className="text-[9px] text-slate-500 font-mono">{stObj?.admissionNumber}</p>
                                    </td>
                                    <td className="p-3">{hostObj ? hostObj.name : 'Unknown'}</td>
                                    <td className="p-3">Room {rmObj ? rmObj.roomNumber : '?'}{rmObj ? ` (Floor ${rmObj.floor})` : ''}</td>
                                    <td className="p-3"><span className="px-2 py-0.5 rounded bg-slate-900 text-brand-400 font-bold border border-slate-800">{bedObj ? bedObj.bedName : 'Bed'}</span></td>
                                    <td className="p-3 font-mono">{adm.admissionDate || adm.checkInDate}</td>
                                    <td className="p-3">
                                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${adm.status === 'ACTIVE' ? 'bg-green-500/10 text-green-400' : 'bg-slate-500/10 text-slate-400'}`}>
                                        {adm.status}
                                      </span>
                                    </td>
                                    <td className="p-3 text-right">
                                      {adm.status === 'ACTIVE' && (
                                        <button onClick={() => handleCheckoutAdmission(adm.id)} className="glass-btn-secondary text-[9px] text-amber-400 hover:text-amber-300 font-bold py-1 px-2.5">
                                          Check Out
                                        </button>
                                      )}
                                      <button onClick={() => handleDeleteHostelAdmission(adm.id)} className="text-slate-500 hover:text-red-400 p-1.5 ml-2"><Trash2 size={12} /></button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </GlassCard>
                    </div>
                  )}

                  {/* 4. Attendance Logger Sub-tab */}
                  {hostelSubTab === 'attendance' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      {/* Left side: select criteria */}
                      <div className="space-y-6">
                        <GlassCard className="space-y-4">
                          <h4 className="font-bold text-slate-200 text-xs">Record Daily Attendance Roll</h4>
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Select Room to Roll</label>
                              <select value={attSelectedRoomId} onChange={e => { setAttSelectedRoomId(e.target.value); setAttStatusMap({}); }} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs">
                                <option value="">-- Choose Room --</option>
                                {hostelRooms.map(r => {
                                  const b = hostelBlocks.find(x => x.id === r.blockId);
                                  const h = b ? hostels.find(x => x.id === b.hostelId) : null;
                                  return <option key={r.id} value={r.id}>{h ? `${h.name} - ` : ''}Room {r.roomNumber}</option>;
                                })}
                              </select>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Log Date</label>
                                <input type="date" value={attSelectedDate} onChange={e => setAttSelectedDate(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Time Slot</label>
                                <select value={attSelectedSlot} onChange={e => setAttSelectedSlot(e.target.value as any)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs">
                                  <option value="MORNING">MORNING (6-8 AM)</option>
                                  <option value="EVENING">EVENING (8-10 PM)</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        </GlassCard>

                                         {/* List of students in selected room to check */}
                        {attSelectedRoomId && (
                          <GlassCard className="space-y-3">
                            <h4 className="font-bold text-slate-200 text-xs">Mark Statuses</h4>
                            {(() => {
                              const activeResidents = hostelAdmissions.filter(a => a.roomId === attSelectedRoomId && a.status === 'ACTIVE');
                              if (activeResidents.length === 0) return <p className="text-center text-slate-500 text-xs py-4">No active students admitted to this room.</p>;
                              return (
                                <div className="space-y-3">
                                  {activeResidents.map(adm => {
                                    const stObj = mockDb.students.find(s => s.id === adm.studentId) || adm.student || null;
                                    const stUser = stObj ? (mockDb.users.find(u => u.id === stObj.userId) || stObj.userDetails || null) : null;
                                    
                                    const existingAtt = hostelAttendance.find(
                                      att => att.studentId === adm.studentId && att.date === attSelectedDate && att.timeSlot === attSelectedSlot
                                    );
                                    const currentStatus = attStatusMap[adm.studentId] || (existingAtt ? existingAtt.status : 'PRESENT');

                                    return (
                                      <div key={adm.id} className="flex justify-between items-center py-2 border-b border-slate-850 last:border-0">
                                        <div>
                                          <p className="font-semibold text-slate-200">{stUser ? formatUserName(stUser) : 'Resident'}</p>
                                          <p className="text-[9px] text-slate-500">{adm.bed?.bedName || 'Allocated Bed'}</p>
                                        </div>
                                        <div className="flex gap-2">
                                          {['PRESENT', 'ABSENT', 'LEAVE'].map(st => (
                                            <button
                                              key={st}
                                              type="button"
                                              onClick={() => setAttStatusMap(prev => ({ ...prev, [adm.studentId]: st as any }))}
                                              className={`px-2 py-1 rounded text-[9px] font-bold border transition-colors ${
                                                currentStatus === st 
                                                  ? st === 'PRESENT' ? 'bg-green-500/10 text-green-400 border-green-500/30' : st === 'ABSENT' ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                  : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-400'
                                              }`}
                                            >
                                              {st}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <button onClick={handleSaveHostelAttendance} type="button" className="glass-btn-primary w-full text-xs font-bold py-2 mt-2">
                                    Save Attendance Register
                                  </button>
                                </div>
                              );
                            })()}
                          </GlassCard>
                        )}
                      </div>
 
                      {/* Right side: attendance rolls log */}
                      <div className="lg:col-span-2">
                        <GlassCard className="space-y-3">
                          <h4 className="font-bold text-slate-200 text-xs">Logged Daily Attendance History</h4>
                          <div className="overflow-x-auto max-h-[500px]">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                                <tr>
                                  <th className="p-2.5">Date / Slot</th>
                                  <th className="p-2.5">Student Name</th>
                                  <th className="p-2.5">Status</th>
                                  <th className="p-2.5">Recorded By</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hostelAttendance.length === 0 ? (
                                  <tr><td colSpan={4} className="p-4 text-center">No attendance logged yet.</td></tr>
                                ) : hostelAttendance.map(att => {
                                  const stObj = mockDb.students.find(s => s.id === att.studentId) || att.student || null;
                                  const stUser = stObj ? (mockDb.users.find(u => u.id === stObj.userId) || stObj.userDetails || null) : null;
                                  const recorderObj = mockDb.users.find(u => u.id === att.recordedBy) || att.recordedByDetails || null;
                                  return (
                                    <tr key={att.id} className="border-b border-slate-850 hover:bg-slate-900/30 text-[10px]">
                                      <td className="p-2.5 font-mono">
                                        <p>{att.date}</p>
                                        <p className="text-[9px] text-slate-500 font-bold">{att.timeSlot}</p>
                                      </td>
                                      <td className="p-2.5 font-semibold text-slate-200">{stUser ? formatUserName(stUser) : 'Resident'}</td>
                                      <td className="p-2.5">
                                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${att.status === 'PRESENT' ? 'bg-green-500/10 text-green-400' : att.status === 'ABSENT' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                          {att.status}
                                        </span>
                                      </td>
                                      <td className="p-2.5 text-slate-400">{recorderObj ? formatUserName(recorderObj) : 'Warden'}</td>
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

                  {/* 5. Leave Requests Sub-tab */}
                  {hostelSubTab === 'leaves' && (
                    <GlassCard className="space-y-3">
                      <h4 className="font-bold text-slate-200 text-xs">Leave Requests Approval Workflow</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                            <tr>
                              <th className="p-3">Student Name</th>
                              <th className="p-3">Duration (Dates)</th>
                              <th className="p-3">Reason</th>
                              <th className="p-3">Parent</th>
                              <th className="p-3">Warden</th>
                              <th className="p-3">Hostel Admin</th>
                              <th className="p-3">School Admin</th>
                              <th className="p-3">Overall</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hostelLeaveRequests.length === 0 ? (
                              <tr><td colSpan={9} className="p-4 text-center">No leave requests logged.</td></tr>
                            ) : hostelLeaveRequests.map(lv => {
                              const stObj = mockDb.students.find(s => s.id === lv.studentId) || lv.student || null;
                              const stUser = stObj ? (mockDb.users.find(u => u.id === stObj.userId) || stObj.userDetails || null) : null;
                              
                              const userRole = session?.user.role;
                              const isWardenApprovalPhase = lv.parentApproval === 'APPROVED' && lv.wardenApproval === 'PENDING';
                              const isHostelAdminApprovalPhase = lv.wardenApproval === 'APPROVED' && (lv.hostelAdminApproval || 'PENDING') === 'PENDING';
                              const isSchoolAdminApprovalPhase = (lv.hostelAdminApproval || 'PENDING') === 'APPROVED' && lv.adminApproval === 'PENDING';

                              // Actions visibility determination
                              const canWardenAct = isWarden && lv.wardenApproval === 'PENDING';
                              const canHostelAdminAct = userRole === 'HOSTEL_ADMIN' && (lv.hostelAdminApproval || 'PENDING') === 'PENDING';
                              const canSchoolAdminAct = (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || (userRole === 'ACADEMIC_ADMIN' && rbacPermissions[userRole]?.hostel)) && lv.adminApproval === 'PENDING';

                              // Descriptive Routing Status
                              let routingText = 'Awaiting routing...';
                              if (lv.parentApproval === 'PENDING') routingText = 'Awaiting Parent';
                              else if (lv.parentApproval === 'APPROVED' && lv.wardenApproval === 'PENDING') routingText = 'Awaiting Warden';
                              else if (lv.wardenApproval === 'APPROVED' && (lv.hostelAdminApproval || 'PENDING') === 'PENDING') routingText = 'Awaiting Hostel Admin';
                              else if ((lv.hostelAdminApproval || 'PENDING') === 'APPROVED' && lv.adminApproval === 'PENDING') routingText = 'Awaiting School Admin';

                              const getApprovalBadge = (val: string) => {
                                const colorMap: Record<string, string> = {
                                  'APPROVED': 'bg-green-500/10 text-green-400',
                                  'REJECTED': 'bg-red-500/10 text-red-400',
                                  'HOLD': 'bg-amber-500/10 text-amber-400',
                                  'PENDING': 'bg-slate-500/10 text-slate-400'
                                };
                                return (
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${colorMap[val] || 'bg-slate-500/10 text-slate-400'}`}>
                                    {val}
                                  </span>
                                );
                              };

                              return (
                                <tr key={lv.id} className="border-b border-slate-850 hover:bg-slate-900/30">
                                  <td className="p-3 font-semibold text-slate-200">{stUser ? formatUserName(stUser) : 'Student'}</td>
                                  <td className="p-3 font-mono text-[10px]">
                                    <p>{lv.fromDate} to</p>
                                    <p>{lv.toDate}</p>
                                  </td>
                                  <td className="p-3 max-w-[150px] truncate" title={lv.reason}>{lv.reason}</td>
                                  <td className="p-3">{getApprovalBadge(lv.parentApproval)}</td>
                                  <td className="p-3">{getApprovalBadge(lv.wardenApproval)}</td>
                                  <td className="p-3">{getApprovalBadge(lv.hostelAdminApproval || 'PENDING')}</td>
                                  <td className="p-3">{getApprovalBadge(lv.adminApproval)}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                                      lv.status === 'APPROVED' ? 'bg-green-500/20 text-green-400' : 
                                      lv.status === 'REJECTED' ? 'bg-red-500/20 text-red-400' : 
                                      lv.status === 'HOLD' ? 'bg-amber-500/20 text-amber-400' : 
                                      'bg-blue-500/20 text-blue-400'
                                    }`}>
                                      {lv.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    {canWardenAct && (
                                      <div className="flex gap-1 justify-end">
                                        <button onClick={() => handleApproveLeave(lv.id, 'WARDEN', 'APPROVED')} className="bg-green-600 hover:bg-green-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Approve</button>
                                        <button onClick={() => handleApproveLeave(lv.id, 'WARDEN', 'REJECTED')} className="bg-red-600 hover:bg-red-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Reject</button>
                                        <button onClick={() => handleApproveLeave(lv.id, 'WARDEN', 'HOLD')} className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Hold</button>
                                      </div>
                                    )}
                                    {canHostelAdminAct && (
                                      <div className="flex gap-1 justify-end">
                                        <button onClick={() => handleApproveLeave(lv.id, 'HOSTEL_ADMIN', 'APPROVED')} className="bg-green-600 hover:bg-green-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Approve</button>
                                        <button onClick={() => handleApproveLeave(lv.id, 'HOSTEL_ADMIN', 'REJECTED')} className="bg-red-600 hover:bg-red-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Reject</button>
                                        <button onClick={() => handleApproveLeave(lv.id, 'HOSTEL_ADMIN', 'HOLD')} className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Hold</button>
                                      </div>
                                    )}
                                    {canSchoolAdminAct && (
                                      <div className="flex gap-1 justify-end">
                                        <button onClick={() => handleApproveLeave(lv.id, 'SCHOOL_ADMIN', 'APPROVED')} className="bg-green-600 hover:bg-green-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Approve</button>
                                        <button onClick={() => handleApproveLeave(lv.id, 'SCHOOL_ADMIN', 'REJECTED')} className="bg-red-600 hover:bg-red-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Reject</button>
                                        <button onClick={() => handleApproveLeave(lv.id, 'SCHOOL_ADMIN', 'HOLD')} className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[9px] py-1 px-1.5 rounded">Hold</button>
                                      </div>
                                    )}
                                    {lv.status === 'PENDING' && !canWardenAct && !canHostelAdminAct && !canSchoolAdminAct && (
                                      <span className="text-[10px] text-slate-500 italic">{routingText}</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </GlassCard>
                  )}

                  {/* 6. Visitor Logs Sub-tab */}
                  {hostelSubTab === 'visitors' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <GlassCard className="space-y-4 h-fit">
                        <h4 className="font-bold text-slate-200 text-xs">Log Visitor Entry Check-in</h4>
                        <form onSubmit={handleCreateVisitor} className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Visitor Name</label>
                            <input type="text" value={hvisName} onChange={e => setHvisName(e.target.value)} placeholder="e.g. John Doe Sr." className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Relation to Resident</label>
                              <input type="text" value={hvisRelation} onChange={e => setHvisRelation(e.target.value)} placeholder="e.g. Father" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Select Resident Student</label>
                              <select value={hvisStudentId} onChange={e => setHvisStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none" required>
                                <option value="">-- Choose Resident --</option>
                                {hostelAdmissions.filter(a => a.status === 'ACTIVE' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.studentId)).map(a => {
                                  const stObj = mockDb.students.find(s => s.id === a.studentId) || a.student || null;
                                  const stUser = stObj ? (mockDb.users.find(u => u.id === stObj.userId) || stObj.userDetails || null) : null;
                                  return <option key={a.id} value={a.studentId}>{stUser ? formatUserName(stUser) : 'Resident'}</option>;
                                })}
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Purpose of Visit</label>
                            <textarea value={hvisPurpose} onChange={e => setHvisPurpose(e.target.value)} placeholder="e.g. Deliver textbooks, luggage dropping" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs h-16 resize-none" required></textarea>
                          </div>
                          <button type="submit" className="glass-btn-primary w-full text-xs">Record Visitor Entry</button>
                        </form>
                      </GlassCard>

                      <div className="lg:col-span-2">
                        <GlassCard className="space-y-3">
                          <h4 className="font-bold text-slate-200 text-xs">Visitor Check-in Log Ledger</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                                <tr>
                                  <th className="p-3">Visitor Info</th>
                                  <th className="p-3">Resident Student</th>
                                  <th className="p-3">Entry Time</th>
                                  <th className="p-3">Exit Time</th>
                                  <th className="p-3 text-right">Actions</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hostelVisitors.length === 0 ? (
                                  <tr><td colSpan={5} className="p-4 text-center">No visitors recorded.</td></tr>
                                ) : hostelVisitors.map(v => {
                                  const stObj = mockDb.students.find(s => s.id === v.studentId) || v.student || null;
                                  const stUser = stObj ? (mockDb.users.find(u => u.id === stObj.userId) || stObj.userDetails || null) : null;
                                  return (
                                    <tr key={v.id} className="border-b border-slate-850 hover:bg-slate-900/30 text-[10px]">
                                      <td className="p-3">
                                        <p className="font-semibold text-slate-200">{v.visitorName}</p>
                                        <p className="text-[9px] text-slate-500">Relation: {v.relation}</p>
                                      </td>
                                      <td className="p-3">
                                        <p>{stUser ? formatUserName(stUser) : 'Resident'}</p>
                                        <p className="text-[9px] text-slate-500 font-mono">{stObj?.admissionNumber}</p>
                                      </td>
                                      <td className="p-3 font-mono text-[9px]">{new Date(v.entryTime).toLocaleString()}</td>
                                      <td className="p-3 font-mono text-[9px]">{v.exitTime ? new Date(v.exitTime).toLocaleString() : <span className="text-brand-400 font-bold">INSIDE HOSTEL</span>}</td>
                                      <td className="p-3 text-right">
                                        {!v.exitTime && (
                                          <button onClick={() => handleCheckoutVisitor(v.id)} className="glass-btn-secondary text-[9px] text-amber-400 hover:text-amber-300 py-1 px-2 font-bold">
                                            Log Exit
                                          </button>
                                        )}
                                        <button onClick={async () => { if (window.confirm('Delete log entry?')) { await mockApi.deleteHostelVisitor(v.id); loadData(); } }} className="text-slate-550 hover:text-red-400 p-1.5 ml-2"><Trash2 size={12} /></button>
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

                  {/* 7. Complaints Office Sub-tab */}
                  {hostelSubTab === 'complaints' && (
                    <GlassCard className="space-y-3">
                      <h4 className="font-bold text-slate-200 text-xs">Hostel Maintenance & Complaint Tickets</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                            <tr>
                              <th className="p-3">Student Name</th>
                              <th className="p-3">Category</th>
                              <th className="p-3">Description</th>
                              <th className="p-3">Assigned Staff</th>
                              <th className="p-3">Resolution Notes</th>
                              <th className="p-3">Status</th>
                              <th className="p-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hostelComplaints.length === 0 ? (
                              <tr><td colSpan={7} className="p-4 text-center">No complaints submitted.</td></tr>
                            ) : hostelComplaints.map(c => {
                              const stObj = mockDb.students.find(s => s.id === c.studentId) || c.student || null;
                              const stUser = stObj ? (mockDb.users.find(u => u.id === stObj.userId) || stObj.userDetails || null) : null;
                              return (
                                <tr key={c.id} className="border-b border-slate-850 hover:bg-slate-900/30">
                                  <td className="p-3 font-semibold text-slate-200">{stUser ? formatUserName(stUser) : 'Resident'}</td>
                                  <td className="p-3 font-semibold"><span className="px-2 py-0.5 rounded bg-slate-900 text-brand-400 border border-slate-800">{c.category}</span></td>
                                  <td className="p-3 max-w-[200px] truncate" title={c.description}>{c.description}</td>
                                  <td className="p-3 text-slate-300">{c.assignedStaff || <span className="text-slate-500 italic">Unassigned</span>}</td>
                                  <td className="p-3 text-slate-400">{c.resolutionNotes || <span className="text-slate-500 italic">Pending resolution</span>}</td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${c.status === 'RESOLVED' ? 'bg-green-500/10 text-green-400' : c.status === 'ASSIGNED' ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'}`}>
                                      {c.status}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right space-y-1">
                                    {c.status === 'SUBMITTED' && (
                                      <button onClick={() => { const s = prompt('Enter staff name to assign:'); if (s) handleUpdateComplaint(c.id, 'ASSIGNED', s); }} className="glass-btn-secondary text-[9px] py-1 px-2 mr-1">Assign Staff</button>
                                    )}
                                    {c.status !== 'RESOLVED' && c.status !== 'CLOSED' && (
                                      <button onClick={() => { const n = prompt('Enter resolution notes:'); if (n) handleUpdateComplaint(c.id, 'RESOLVED', c.assignedStaff || 'Maintenance Staff', n); }} className="glass-btn-primary bg-green-600 text-white text-[9px] py-1 px-2 font-bold">Mark Resolved</button>
                                    )}
                                    <button onClick={async () => { if (window.confirm('Delete ticket?')) { await mockApi.deleteHostelComplaint(c.id); loadData(); } }} className="text-slate-550 hover:text-red-400 p-1.5 ml-2"><Trash2 size={12} /></button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </GlassCard>
                  )}

                  {/* 8. Mess Menu Planner Sub-tab */}
                  {hostelSubTab === 'menu' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                      <GlassCard className="space-y-4 h-fit">
                        <h4 className="font-bold text-slate-200 text-xs">Configure Mess Planners</h4>
                        <form onSubmit={handleSaveMessMenu} className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Select Hostel Building</label>
                            <select value={hmessHostelId} onChange={e => setHmessHostelId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required>
                              <option value="">-- Choose Hostel --</option>
                              {hostels.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Day of the Week</label>
                            <select value={hmessDay} onChange={e => setHmessDay(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs">
                              {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, idx) => (
                                <option key={idx} value={idx + 1}>{day}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Breakfast Menu</label>
                            <input type="text" value={hmessBreakfast} onChange={e => setHmessBreakfast(e.target.value)} placeholder="e.g. Oatmeal & Eggs, Tea" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Lunch Menu</label>
                            <input type="text" value={hmessLunch} onChange={e => setHmessLunch(e.target.value)} placeholder="e.g. Grilled Chicken Salad, Rice" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Dinner Menu</label>
                            <input type="text" value={hmessDinner} onChange={e => setHmessDinner(e.target.value)} placeholder="e.g. Baked Fish with Broccoli" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-500 uppercase">Special item (Optional)</label>
                            <input type="text" value={hmessSpecial} onChange={e => setHmessSpecial(e.target.value)} placeholder="e.g. Chocolate Ice Cream" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" />
                          </div>
                          <button type="submit" className="glass-btn-primary w-full text-xs">Save Planners Menu</button>
                        </form>
                      </GlassCard>

                      <div className="lg:col-span-2">
                        <GlassCard className="space-y-3">
                          <h4 className="font-bold text-slate-200 text-xs">Weekly Mess Planners Display</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-900/60 uppercase font-bold text-slate-300">
                                <tr>
                                  <th className="p-3">Day</th>
                                  <th className="p-3">Breakfast</th>
                                  <th className="p-3">Lunch</th>
                                  <th className="p-3">Dinner</th>
                                  <th className="p-3">Special Item</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
                                  const items = days.map((day, idx) => {
                                    // filter messMenus
                                    const match = hostelMessMenus.find(m => m.dayOfWeek === idx + 1 && (hmessHostelId ? m.hostelId === hmessHostelId : true));
                                    return { day, match };
                                  });

                                  return items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/30 text-[10.5px]">
                                      <td className="p-3 font-semibold text-slate-200">{item.day}</td>
                                      <td className="p-3">{item.match ? item.match.breakfast : <span className="text-slate-500 italic">Not set</span>}</td>
                                      <td className="p-3">{item.match ? item.match.lunch : <span className="text-slate-500 italic">Not set</span>}</td>
                                      <td className="p-3">{item.match ? item.match.dinner : <span className="text-slate-500 italic">Not set</span>}</td>
                                      <td className="p-3 font-bold text-brand-400">{item.match && item.match.specialMenu ? item.match.specialMenu : '-'}</td>
                                    </tr>
                                  ));
                                })()}
                              </tbody>
                            </table>
                          </div>
                        </GlassCard>
                      </div>
                    </div>
                  )}

                  {/* 9. Fees & Billing Invoices Sub-tab */}
                  {hostelSubTab === 'fees' && !isWarden && (
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                      {/* Configure structure */}
                      <div className="lg:col-span-2 space-y-6">
                        <GlassCard className="space-y-4">
                          <h4 className="font-bold text-slate-200 text-xs">Configure Hostel Fee Structures</h4>
                          <form onSubmit={handleCreateHostelFee} className="space-y-3">
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Fee Name / Designation</label>
                              <input type="text" value={hfeeName} onChange={e => setHfeeName(e.target.value)} placeholder="e.g. Monthly Premium Double Room Fee" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Amount Due</label>
                                <input type="number" value={hfeeAmount} onChange={e => setHfeeAmount(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Fee billing cycle</label>
                                <select value={hfeeType} onChange={e => setHfeeType(e.target.value as any)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs">
                                  <option value="MONTHLY">MONTHLY</option>
                                  <option value="ANNUAL">ANNUAL</option>
                                  <option value="MESS">MESS FEE</option>
                                  <option value="ONE_TIME">ONE-TIME DEPOSIT</option>
                                </select>
                              </div>
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Description</label>
                              <textarea value={hfeeDesc} onChange={e => setHfeeDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs h-12" placeholder="Structure billing limits details..."></textarea>
                            </div>
                            <button type="submit" className="glass-btn-primary w-full text-xs">Create Structure</button>
                          </form>
                        </GlassCard>

                        {/* List structures */}
                        <GlassCard className="space-y-3">
                          <h4 className="font-bold text-slate-200 text-xs">Configured Fee Rates</h4>
                          <div className="max-h-[200px] overflow-y-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-900/60 font-bold">
                                <tr>
                                  <th className="p-2">Fee Name</th>
                                  <th className="p-2">Amount</th>
                                  <th className="p-2">Cycle</th>
                                  <th className="p-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hostelFees.map(f => (
                                  <tr key={f.id} className="border-b border-slate-850 hover:bg-slate-900/30 text-[10px]">
                                    <td className="p-2 text-slate-200 font-semibold">{f.name}</td>
                                    <td className="p-2 font-mono font-bold text-brand-400">{overview?.currencySymbol || '$'}{Number(f.amount).toFixed(2)}</td>
                                    <td className="p-2 text-slate-400">{f.feeType}</td>
                                    <td className="p-2 text-right">
                                      <button onClick={() => { if (window.confirm('Delete structure?')) { mockApi.deleteHostelFee(f.id).then(() => loadData()); } }} className="text-slate-550 hover:text-red-400 p-1"><Trash2 size={11} /></button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </GlassCard>
                      </div>

                      {/* Pay invoice receipts */}
                      <div className="lg:col-span-2 space-y-6">
                        <GlassCard className="space-y-4">
                          <h4 className="font-bold text-slate-200 text-xs">Record Hostel Payment Receipt</h4>
                          <form onSubmit={handleRecordHostelPayment} className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Student</label>
                                <select value={hpayStudentId} onChange={e => setHpayStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required>
                                  <option value="">-- Choose Resident --</option>
                                  {hostelAdmissions.filter(a => a.status === 'ACTIVE' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.studentId)).map(a => {
                                    const stObj = mockDb.students.find(s => s.id === a.studentId);
                                    const stUser = stObj ? mockDb.users.find(u => u.id === stObj.userId) : null;
                                    return <option key={a.id} value={a.studentId}>{stUser ? formatUserName(stUser) : 'Resident'}</option>;
                                  })}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Select Fee Structure</label>
                                <select value={hpayFeeId} onChange={e => { setHpayFeeId(e.target.value); const f = hostelFees.find(x => x.id === e.target.value); if (f) setHpayAmount(f.amount); }} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required>
                                  <option value="">-- Choose Fee --</option>
                                  {hostelFees.map(f => (
                                    <option key={f.id} value={f.id}>{f.name} ({overview?.currencySymbol || '$'}{f.amount})</option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Amount Paid</label>
                                <input type="number" value={hpayAmount} onChange={e => setHpayAmount(Number(e.target.value))} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" required />
                              </div>
                              <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Payment Method</label>
                                <select value={hpayMethod} onChange={e => setHpayMethod(e.target.value as any)} className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs">
                                  <option value="CASH">CASH</option>
                                  <option value="CARD">CARD</option>
                                  <option value="ONLINE">ONLINE PORTAL</option>
                                  <option value="BANK_TRANSFER">BANK TRANSFER</option>
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase">Reference Transaction ID / Memo</label>
                              <input type="text" value={hpayTxId} onChange={e => setHpayTxId(e.target.value)} placeholder="e.g. TXN-123456" className="w-full bg-slate-900 border border-slate-850 text-slate-200 rounded-xl px-3 py-2 text-xs" />
                            </div>

                            <button type="submit" className="glass-btn-primary w-full text-xs">Record Receipt & Sync Ledger</button>
                          </form>
                        </GlassCard>

                        {/* List payments */}
                        <GlassCard className="space-y-3">
                          <h4 className="font-bold text-slate-200 text-xs">Hostel Payment Ledger Receipts</h4>
                          <div className="max-h-[200px] overflow-y-auto">
                            <table className="w-full text-[11px] text-left">
                              <thead className="bg-slate-900/60 font-bold">
                                <tr>
                                  <th className="p-2">Student</th>
                                  <th className="p-2">Structure</th>
                                  <th className="p-2">Paid</th>
                                  <th className="p-2">Method</th>
                                  <th className="p-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody>
                                {hostelPayments.map(p => {
                                  const stObj = mockDb.students.find(s => s.id === p.studentId);
                                  const stUser = stObj ? mockDb.users.find(u => u.id === stObj.userId) : null;
                                  return (
                                    <tr key={p.id} className="border-b border-slate-850 hover:bg-slate-900/30 text-[10px]">
                                      <td className="p-2 font-semibold text-slate-200">{stUser ? formatUserName(stUser) : 'Resident'}</td>
                                      <td className="p-2 text-slate-400">{p.fee ? p.fee.name : 'Hostel Fee'}</td>
                                      <td className="p-2 font-mono font-bold text-green-400">{overview?.currencySymbol || '$'}{Number(p.amountPaid).toFixed(2)}</td>
                                      <td className="p-2 font-mono text-[9px]">{p.paymentMethod}</td>
                                      <td className="p-2 text-right">
                                        <button 
                                          onClick={async () => {
                                            const school = mockDb.schools.find(s => s.id === session?.user.schoolId);
                                            const cls = stObj ? mockDb.classes.find(c => c.id === stObj.classId) : null;
                                            await downloadReceiptPdf({
                                              schoolId: session?.user.schoolId || '',
                                              schoolName: school?.name || 'Aegis Academy',
                                              schoolAddress: school?.address || 'Silicon Valley, Tech District, USA',
                                              schoolPhone: school?.phone || '+1-555-0199',
                                              schoolEmail: school?.email || 'billing@aegisacademy.edu',
                                              logoUrl: school?.logoUrl || '',
                                              sealUrl: school?.sealUrl || '',
                                              currencySymbol: overview?.currencySymbol || '$',
                                              studentName: stUser ? formatUserName(stUser) : 'Resident',
                                              studentId: p.studentId,
                                              admissionNumber: stObj?.admissionNumber || '',
                                              className: cls?.name || 'Hostel Resident',
                                              sectionName: '',
                                              feeDescription: p.fee ? p.fee.name : 'Hostel Fee',
                                              amount: Number(p.amountPaid),
                                              paymentDate: p.paymentDate || new Date().toISOString(),
                                              paymentMethod: p.paymentMethod || 'CASH',
                                              transactionId: p.transactionId
                                            });
                                          }} 
                                          className="text-brand-400 hover:text-brand-300 p-1 mr-1"
                                          title="Download PDF Receipt"
                                        >
                                          <FileText size={11} />
                                        </button>
                                        <button onClick={() => { if (window.confirm('Delete payment record?')) { mockApi.deleteHostelPayment(p.id).then(() => loadData()); } }} className="text-slate-550 hover:text-red-400 p-1"><Trash2 size={11} /></button>
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

                </div>
              );
            })()}
          </div>
        </PremiumLock>
      )}

      {activeTab === 'books' && (
        <PremiumLock
          isLocked={!ent.hasLibraryAccess}
          requiredTier="Basic"
          featureName="School Library & Digital Books"
        >
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

                <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-56">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                        <th className="py-2 px-3">Book Title</th>
                        <th className="py-2 px-3">Author</th>
                        <th className="py-2 px-3">ISBN</th>
                        <th className="py-2 px-3">Category</th>
                        <th className="py-2.5 px-2 text-center">Copies</th>
                        <th className="py-2.5 px-2 text-center">Avail</th>
                        <th className="py-2 px-3">Created</th>
                        <th className="py-2 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-slate-300">
                      {books.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO BOOKS REGISTERED</td>
                        </tr>
                      ) : (
                        books.map(b => (
                          <tr key={b.id} className="hover:bg-slate-900/10 text-[10px]">
                            <td className="py-2 px-3 font-semibold text-slate-200">{b.title}</td>
                            <td className="py-2 px-3">{b.author}</td>
                            <td className="py-2 px-3 font-mono">{b.isbn}</td>
                            <td className="py-2 px-3">
                              <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-brand-500/10 text-brand-400 font-mono">{b.subject}</span>
                            </td>
                            <td className="py-2 px-2 text-center font-mono">{b.totalCopies}</td>
                            <td className="py-2 px-2 text-center font-mono">{b.availableCopies}</td>
                            <td className="py-2 px-3 font-mono text-[9px]">{b.createdAt ? new Date(b.createdAt).toLocaleDateString() : 'N/A'}</td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => { setEditingBook(b); setEditBkTitle(b.title); setEditBkAuthor(b.author); setEditBkIsbn(b.isbn); setEditBkSubject(b.subject); setEditBkCopies(b.totalCopies); }} className="text-brand-400 hover:text-brand-300 p-0.5" title="Edit"><Edit size={11} /></button>
                                <button type="button" onClick={() => handleDeleteBook(b.id)} className="text-red-400 hover:text-red-300 p-0.5" title="Delete"><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Description</label>
                    <input 
                      type="text" 
                      placeholder="Brief description of this category" 
                      value={bcDesc} 
                      onChange={(e) => setBcDesc(e.target.value)} 
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" 
                    />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-emerald-650 hover:bg-emerald-700 rounded-lg font-bold text-slate-100 transition-colors text-xs">Create Category</button>
                </form>

                <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-40">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                        <th className="py-2 px-3">Name</th>
                        <th className="py-2 px-3">Code</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-slate-300">
                      {bookCategories.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO ACTIVE CATEGORIES</td>
                        </tr>
                      ) : (
                        bookCategories.map(bc => (
                          <tr key={bc.id} className="hover:bg-slate-900/10 text-[10px]">
                            <td className="py-2 px-3 font-semibold text-slate-200">{bc.name}</td>
                            <td className="py-2 px-3 font-mono text-brand-400">{bc.code}</td>
                            <td className="py-2 px-3 truncate max-w-[100px]">{bc.description || '—'}</td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => { setEditingBookCategory(bc); setEditBcName(bc.name); setEditBcCode(bc.code); setEditBcDesc(bc.description || ''); }} className="text-brand-400 hover:text-brand-300 p-0.5" title="Edit"><Edit size={11} /></button>
                                <button type="button" onClick={() => handleDeleteBookCategory(bc.id)} className="text-red-400 hover:text-red-300 p-0.5" title="Delete"><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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
                      {books.filter(b => b.availableCopies > 0).map(b => (
                        <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} available)</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Student ID</label>
                    <select value={biStudentId} onChange={(e) => setBiStudentId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required>
                      <option value="">-- Choose Student --</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{formatUserName(s.userDetails)} ({s.admissionNumber})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-500 font-bold uppercase">Due Return Date</label>
                    <input type="date" value={biDueDate} onChange={(e) => setBiDueDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 focus:outline-none" required />
                  </div>
                  <button type="submit" className="w-full py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-bold text-slate-100 transition-colors">Issue Book (Check-out)</button>
                </form>

                <p className="text-[10px] text-slate-500 font-mono text-center pt-2">ACTIVE LOGS REGISTRY SHOWN BELOW</p>
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
                    const book = lf.issue?.book || books.find(b => b.id === lf.issue?.bookId);
                    return (
                      <div key={lf.id} className="p-2.5 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-slate-200">{student ? formatUserName(student.userDetails) : 'Unknown'}</p>
                          <p className="text-[9px] text-slate-400">Book: {book ? book.title : 'Late fee'}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-red-400 font-bold">${Number(lf.amount).toFixed(2)}</span>
                          {!lf.isPaid ? (
                            <div className="flex items-center gap-1">
                              <button onClick={() => { mockApi.payLibraryFine(session?.user.schoolId || '', lf.id); loadData(); }} className="px-1.5 py-0.5 bg-brand-500 hover:bg-brand-600 rounded text-[9px] font-bold text-slate-100">Pay</button>
                              <button onClick={() => { mockApi.waiveLibraryFine(session?.user.schoolId || '', lf.id); loadData(); }} className="px-1.5 py-0.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 rounded text-[9px] font-bold border border-amber-500/20">Waive</button>
                            </div>
                          ) : (
                            <span className={`text-[8px] font-bold uppercase px-1 rounded ${(lf as any).status === 'WAIVED' ? 'text-amber-400 bg-amber-500/10' : 'text-green-400 bg-green-500/10'}`}>{(lf as any).status === 'WAIVED' ? 'Waived' : 'Paid'}</span>
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

                <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-48 mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                        <th className="py-2 px-3">Title</th>
                        <th className="py-2 px-3">Type</th>
                        <th className="py-2 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-slate-350">
                      {digitalAssetsList.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO DIGITAL ASSETS</td>
                        </tr>
                      ) : (
                        digitalAssetsList.map(da => (
                          <tr key={da.id} className="hover:bg-slate-900/10 text-[10px]">
                            <td className="py-2 px-3">
                              <p className="font-semibold text-slate-200 truncate max-w-[120px]">{da.title}</p>
                              <p className="text-[8px] text-slate-400 truncate max-w-[120px]">{da.author}</p>
                            </td>
                            <td className="py-2 px-3">
                              <span className="px-1 py-0.5 rounded text-[8px] font-mono font-bold bg-brand-500/10 text-brand-400 uppercase">{da.fileType}</span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <a href={da.fileUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 p-0.5" title="View/Download"><Eye size={11} /></a>
                                <button type="button" onClick={() => { setEditingDigitalAsset(da); setEditDaTitle(da.title); setEditDaAuthor(da.author || ''); setEditDaType(da.fileType); setEditDaUrl(da.fileUrl); }} className="text-brand-400 hover:text-brand-300 p-0.5" title="Edit"><Edit size={11} /></button>
                                <button type="button" onClick={() => handleDeleteDigitalAsset(da.id)} className="text-red-400 hover:text-red-300 p-0.5" title="Delete"><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          </div>

          {/* Checkout & Issue History Panel */}
          <GlassCard className="space-y-4">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Calendar className="text-brand-400" size={15} />
              Book Issue & Checkout Registry Logs
            </h4>
            <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-80">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                    <th className="py-2.5 px-3">Student Name</th>
                    <th className="py-2.5 px-3">Admission Code</th>
                    <th className="py-2.5 px-3">Book Title</th>
                    <th className="py-2.5 px-3">Issue Date</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3">Return Date</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Fine Detail</th>
                    <th className="py-2.5 px-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850/40 text-slate-350">
                  {bookIssues.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO BOOK ISSUES RECORDED</td>
                    </tr>
                  ) : (
                    bookIssues.map(bi => {
                      const student = students.find(s => s.id === bi.studentId);
                      const book = bi.book || books.find(b => b.id === bi.bookId);
                      const fineRecord = libraryFines.find(f => f.issueId === bi.id);
                      
                      let fineText = 'No Fine';
                      let fineColor = 'text-slate-450';
                      if (fineRecord) {
                        const statusStr = fineRecord.isPaid ? 'Paid' : (fineRecord.status === 'WAIVED' ? 'Waived' : 'Unpaid');
                        fineText = `$${Number(fineRecord.amount).toFixed(2)} (${statusStr})`;
                        fineColor = fineRecord.isPaid ? 'text-green-400' : (fineRecord.status === 'WAIVED' ? 'text-amber-400' : 'text-red-400');
                      } else if (bi.status === 'OVERDUE') {
                        const dueMs = new Date(bi.dueDate).getTime();
                        const nowMs = Date.now();
                        if (nowMs > dueMs) {
                          const days = Math.ceil((nowMs - dueMs) / (24 * 3600 * 1000));
                          fineText = `$${(days * 0.50).toFixed(2)} (Pending)`;
                          fineColor = 'text-red-400';
                        }
                      }

                      return (
                        <tr key={bi.id} className="hover:bg-slate-900/10 text-[10px]">
                          <td className="py-2.5 px-3 font-semibold text-slate-200">
                            {student ? formatUserName(student.userDetails) : 'Unknown'}
                          </td>
                          <td className="py-2.5 px-3 font-mono">{student?.admissionNumber || '—'}</td>
                          <td className="py-2.5 px-3">{book ? book.title : 'Unknown'}</td>
                          <td className="py-2.5 px-3 font-mono">{new Date(bi.issueDate).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 font-mono">{new Date(bi.dueDate).toLocaleDateString()}</td>
                          <td className="py-2.5 px-3 font-mono">{bi.returnDate ? new Date(bi.returnDate).toLocaleDateString() : '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                              bi.status === 'RETURNED' ? 'bg-green-500/10 text-green-400' :
                              bi.status === 'OVERDUE' ? 'bg-red-500/10 text-red-400' :
                              bi.status === 'LOST' ? 'bg-rose-600/20 text-rose-300' :
                              bi.status === 'DAMAGED' ? 'bg-orange-600/20 text-orange-300' :
                              'bg-brand-500/10 text-brand-400'
                            }`}>{bi.status}</span>
                          </td>
                          <td className={`py-2.5 px-3 font-mono font-semibold ${fineColor}`}>
                            {fineText}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {(bi.status === 'ISSUED' || bi.status === 'OVERDUE') && (
                                <button 
                                  type="button"
                                  onClick={() => { 
                                    setBrIssueId(bi.id); 
                                    const dueMs = new Date(bi.dueDate).getTime(); 
                                    const nowMs = Date.now(); 
                                    if (nowMs > dueMs) { 
                                      const days = Math.ceil((nowMs - dueMs) / (24*3600*1000)); 
                                      setBrFine(days * 0.50); 
                                    } else { 
                                      setBrFine(0); 
                                    } 
                                  }} 
                                  className="px-1.5 py-0.5 bg-green-500/20 text-green-400 border border-green-500/20 rounded hover:bg-green-500/30 text-[9px] font-bold"
                                >
                                  Return
                                </button>
                              )}
                              
                              <button 
                                type="button"
                                onClick={() => { 
                                  setEditingBookIssue(bi); 
                                  setEditBiDueDate(bi.dueDate); 
                                  setEditBiFineAmount(bi.fineAmount || 0); 
                                  setEditBiStatus(bi.status); 
                                  setEditBiReturnDate(bi.returnDate || ''); 
                                }} 
                                className="text-brand-400 hover:text-brand-300 p-0.5" 
                                title="Edit Issue Details"
                              >
                                <Edit size={11} />
                              </button>
                              
                              <button 
                                type="button"
                                onClick={() => handleDeleteBookIssue(bi.id)} 
                                className="text-red-400 hover:text-red-300 p-0.5" 
                                title="Delete Checkout Record"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </GlassCard>
          </div>
        </PremiumLock>
      )}

      {activeTab === 'marksheets' && (
        <PremiumLock
          isLocked={!ent.hasQuizzes}
          requiredTier="Pro"
          featureName="Homeroom Marksheets & Exam Grading"
        >
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

                <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-48 mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                        <th className="py-2 px-3">Exam Name</th>
                        <th className="py-2 px-3">Term</th>
                        <th className="py-2 px-3">Schedule</th>
                        <th className="py-2 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-slate-300">
                      {examsList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO EXAMS REGISTERED</td>
                        </tr>
                      ) : (
                        examsList.map(ex => (
                          <tr key={ex.id} className="hover:bg-slate-900/10 text-[10px]">
                            <td className="py-2 px-3 font-semibold text-slate-200">{ex.name}</td>
                            <td className="py-2 px-3 font-mono text-brand-400 text-[9px]">{ex.term}</td>
                            <td className="py-2 px-3 font-mono text-[9px]">
                              {new Date(ex.startDate).toLocaleDateString()} - {new Date(ex.endDate).toLocaleDateString()}
                            </td>
                            <td className="py-2 px-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button type="button" onClick={() => { setEditingExam(ex); setEditExName(ex.name); setEditExTerm(ex.term); setEditExStart(ex.startDate); setEditExEnd(ex.endDate); }} className="text-brand-400 hover:text-brand-300 p-0.5" title="Edit"><Edit size={11} /></button>
                                <button type="button" onClick={() => handleDeleteExam(ex.id)} className="text-red-400 hover:text-red-300 p-0.5" title="Delete"><Trash2 size={11} /></button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
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

                <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-48 mt-4">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                        <th className="py-2 px-3">Exam</th>
                        <th className="py-2 px-3">Subject</th>
                        <th className="py-2 px-3 text-center">Max</th>
                        <th className="py-2 px-3 text-center">Pass</th>
                        <th className="py-2 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-slate-300">
                      {examSubjects.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO CRITERIA DEFINED</td>
                        </tr>
                      ) : (
                        examSubjects.map(es => {
                          const exam = examsList.find(e => e.id === es.examId);
                          const subjectName = es.subject?.name || subjects.find(s => s.id === es.subjectId)?.name || 'Unknown';
                          return (
                            <tr key={es.id} className="hover:bg-slate-900/10 text-[10px]">
                              <td className="py-2 px-3 font-semibold text-slate-200">{exam ? exam.name : 'Unknown'}</td>
                              <td className="py-2 px-3 text-slate-300">{subjectName}</td>
                              <td className="py-2 px-3 text-center font-mono">{es.maxMarks}</td>
                              <td className="py-2 px-3 text-center font-mono text-brand-400">{es.passingMarks}</td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button type="button" onClick={() => { setEditingExamSubject(es); setEditEsMax(es.maxMarks); setEditEsPass(es.passingMarks); }} className="text-brand-400 hover:text-brand-300 p-0.5" title="Edit"><Edit size={11} /></button>
                                  <button type="button" onClick={() => handleDeleteExamSubject(es.id)} className="text-red-400 hover:text-red-300 p-0.5" title="Delete"><Trash2 size={11} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
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
                                  <td className="py-2 px-3 font-semibold text-slate-200">{formatUserName(s.userDetails)}</td>
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

              {/* Recorded Marks Registry Logs */}
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Award className="text-brand-400" size={15} />
                  Student Marks Registry Records
                </h4>
                <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Exam</th>
                        <th className="py-2.5 px-3">Subject</th>
                        <th className="py-2.5 px-3 text-center">Score</th>
                        <th className="py-2.5 px-3">Remarks</th>
                        <th className="py-2.5 px-3 text-center">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-slate-350">
                      {studentMarks.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO STUDENT MARKS RECORDED</td>
                        </tr>
                      ) : (
                        studentMarks.map(sm => {
                          const student = students.find(s => s.id === sm.studentId);
                          const exam = examsList.find(e => e.id === sm.examId);
                          const subject = subjects.find(s => s.id === sm.subjectId);
                          const criteria = examSubjects.find(es => es.examId === sm.examId && es.subjectId === sm.subjectId);
                          return (
                            <tr key={sm.id} className="hover:bg-slate-900/10 text-[10px]">
                              <td className="py-2 px-3 font-semibold text-slate-200">
                                {student ? formatUserName(student.userDetails) : 'Unknown'}
                              </td>
                              <td className="py-2 px-3">{exam ? exam.name : 'Unknown'}</td>
                              <td className="py-2 px-3 text-slate-300">{subject ? subject.name : 'Unknown'}</td>
                              <td className="py-2 px-3 text-center font-mono font-bold">
                                <span className={criteria && sm.marksObtained < criteria.passingMarks ? 'text-red-400' : 'text-green-400'}>
                                  {sm.marksObtained}
                                </span>
                                <span className="text-slate-500 font-normal"> / {criteria ? criteria.maxMarks : 100}</span>
                              </td>
                              <td className="py-2 px-3 italic text-slate-400 max-w-[150px] truncate">{sm.remarks || '—'}</td>
                              <td className="py-2 px-3 text-center">
                                <button type="button" onClick={() => handleDeleteStudentMark(sm.id)} className="text-red-400 hover:text-red-300 p-1" title="Delete Mark Record">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
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
                        <option key={s.id} value={s.id}>{formatUserName(s.userDetails)} ({s.admissionNumber})</option>
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

              {/* Published Report Cards History Table */}
              <GlassCard className="space-y-4">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Award className="text-brand-400" size={15} />
                  Published Report Cards History Ledger
                </h4>
                <div className="overflow-x-auto border border-slate-850/50 rounded-xl max-h-64">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-850 text-slate-400 text-[9px] font-bold uppercase tracking-wider bg-slate-900/40">
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Term</th>
                        <th className="py-2.5 px-3 text-center">Attendance %</th>
                        <th className="py-2.5 px-3 text-center">GPA Score</th>
                        <th className="py-2.5 px-3">Remarks</th>
                        <th className="py-2.5 px-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850/40 text-slate-350">
                      {reportCards.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-slate-500 font-mono text-[9px]">NO REPORT CARDS PUBLISHED</td>
                        </tr>
                      ) : (
                        reportCards.map(rc => {
                          const student = students.find(s => s.id === rc.studentId);
                          return (
                            <tr key={rc.id} className="hover:bg-slate-900/10 text-[10px]">
                              <td className="py-2 px-3 font-semibold text-slate-200">
                                {student ? formatUserName(student.userDetails) : 'Unknown'}
                              </td>
                              <td className="py-2 px-3 font-mono text-[9px] text-brand-400">{rc.term}</td>
                              <td className="py-2 px-3 text-center font-mono">{rc.attendancePercentage}%</td>
                              <td className="py-2 px-3 text-center font-mono font-bold text-emerald-400">{rc.gradePointAverage.toFixed(2)}</td>
                              <td className="py-2 px-3 text-slate-350 italic max-w-[150px] truncate">{rc.remarks || '—'}</td>
                              <td className="py-2 px-3 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <button 
                                    type="button" 
                                    onClick={async () => {
                                      try {
                                        const marksheetData = await mockApi.getStudentMarksheetData(rc.studentId, rc.term);
                                        await downloadMarksheetPdf(student ? formatUserName(student.userDetails) : 'Student', rc.term, marksheetData);
                                      } catch (err: any) {
                                        console.error(err);
                                        alert('Failed to generate marksheet: ' + err.message);
                                      }
                                    }} 
                                    className="text-emerald-400 hover:text-emerald-300 p-0.5" 
                                    title="Download Marksheet (PDF)"
                                  >
                                    <Download size={11} />
                                  </button>
                                  <button type="button" onClick={() => { setEditingReportCard(rc); setEditRcTerm(rc.term); setEditRcAttendance(rc.attendancePercentage); setEditRcGpa(rc.gradePointAverage); setEditRcRemarks(rc.remarks || ''); }} className="text-brand-400 hover:text-brand-300 p-0.5" title="Edit"><Edit size={11} /></button>
                                  <button type="button" onClick={() => handleDeleteReportCard(rc.id)} className="text-red-400 hover:text-red-300 p-0.5" title="Delete"><Trash2 size={11} /></button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          </div>
          </div>
        </PremiumLock>
      )}

      {activeTab === 'quizzes' && (
        <PremiumLock
          isLocked={!ent.hasQuizzes}
          requiredTier="Pro"
          featureName="Quiz Analytics & Scoreboards"
        >
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
                          <td className="py-2 px-3 font-semibold text-slate-200">{student ? formatUserName(student.userDetails) : 'Unknown'}</td>
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
        </PremiumLock>
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

      {activeTab === 'groupdiscussion' && (
        <ClassDiscussion
          currentUserId={session?.user.id || ''}
          currentUserRole={session?.user.role || 'ADMIN'}
          schoolId={session?.user.schoolId || ''}
          academicSessionId={session?.user.academicSessionId || ''}
        />
      )}

      {activeTab === 'attendance' && (
        <div className="space-y-6 animate-fade-in text-xs">
          {/* Attendance Analytics Metrics Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="flex items-center justify-between p-5 border-l-4 border-l-emerald-500 bg-slate-900/10">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Overall Attendance Rate</span>
                <div className="text-2xl font-bold text-slate-100 flex items-baseline gap-1.5 mt-1">
                  {attendanceAnalytics.overall_percentage !== undefined ? `${attendanceAnalytics.overall_percentage.toFixed(1)}%` : '—'}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Aggregated school attendance records</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                <CheckCircle className="text-emerald-450" size={22} />
              </div>
            </GlassCard>

            <GlassCard className="flex items-center justify-between p-5 border-l-4 border-l-rose-500 bg-slate-900/10">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Absentee Records</span>
                <div className="text-2xl font-bold text-slate-100 flex items-baseline gap-1.5 mt-1">
                  {attendanceAnalytics.absences_count !== undefined ? attendanceAnalytics.absences_count : 0}
                  <span className="text-[10px] font-normal text-slate-400">students</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Total unexcused / absent logs</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center border border-rose-500/20 shadow-lg shadow-rose-500/5">
                <AlertCircle className="text-rose-405" size={22} />
              </div>
            </GlassCard>

            <GlassCard className="flex items-center justify-between p-5 border-l-4 border-l-amber-500 bg-slate-900/10">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Chronically Tardy</span>
                <div className="text-2xl font-bold text-slate-100 flex items-baseline gap-1.5 mt-1">
                  {attendanceAnalytics.tardy_count !== undefined ? attendanceAnalytics.tardy_count : 0}
                  <span className="text-[10px] font-normal text-slate-400">students</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Repeated late arrivals logged</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 shadow-lg shadow-amber-500/5">
                <Clock className="text-amber-400" size={22} />
              </div>
            </GlassCard>
          </div>

          {/* Chronically Absent Students Alert Banner */}
          {attendanceAnalytics.chronic_absent && attendanceAnalytics.chronic_absent.length > 0 && (
            <GlassCard className="border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
              <div className="flex items-center gap-2 text-rose-450">
                <AlertTriangle size={15} />
                <span className="font-bold uppercase tracking-wider text-[10px] font-mono">Chronically Absent Students Alert Warning</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {attendanceAnalytics.chronic_absent.map((std: any, idx: number) => (
                  <span key={idx} className="px-2.5 py-1 rounded-lg bg-rose-950/45 border border-rose-500/25 text-rose-300 text-[10px] font-semibold font-mono flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                    {std.student_name} ({std.missed_count} absences)
                  </span>
                ))}
              </div>
            </GlassCard>
          )}

          {/* Analytics Filters Drilldown Dashboard Row */}
          <GlassCard className="bg-slate-900/15 border-slate-850 p-4 space-y-3.5">
            <h4 className="font-bold text-slate-200 text-xs flex items-center gap-2">
              <Sliders className="text-brand-450" size={14} />
              Analytical Drilldown Filters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter Academic Session</label>
                <select
                  value={attendanceSessionId}
                  onChange={(e) => setAttendanceSessionId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- All Academic Sessions --</option>
                  {academicSessionsList.map(sess => (
                    <option key={sess.id} value={sess.id}>{sess.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Filter Section / Class</label>
                <select
                  value={attendanceSectionId}
                  onChange={(e) => setAttendanceSectionId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 text-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- All Sections / Classes --</option>
                  {classes.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col justify-end">
                <button
                  onClick={() => {
                    setAttendanceSectionId('');
                    setAttendanceSessionId('');
                  }}
                  className="w-full px-3 py-2 bg-slate-800 hover:bg-slate-750 text-slate-350 hover:text-slate-200 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 border border-slate-750"
                >
                  <RefreshCw size={12} />
                  Reset Analytics Filters
                </button>
              </div>
            </div>
          </GlassCard>

          {/* Roster Attendance Register */}
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
                className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white rounded-lg text-[11px] font-bold transition-all active:scale-95 shadow-lg shadow-brand-500/15 flex items-center gap-1.5"
              >
                <CheckSquare size={13} />
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
                        <td className="py-3 px-4 font-semibold text-slate-200">{formatUserName(s.userDetails)}</td>
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

      {/* ── Edit Book Modal Overlay ── */}
      {editingBook && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <BookOpen size={16} className="text-brand-400" />
                Edit Book Catalog Details
              </h3>
              <button type="button" onClick={() => setEditingBook(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateBook} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Book Title</label>
                <input type="text" value={editBkTitle} onChange={(e) => setEditBkTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Author</label>
                  <input type="text" value={editBkAuthor} onChange={(e) => setEditBkAuthor(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">ISBN Code</label>
                  <input type="text" value={editBkIsbn} onChange={(e) => setEditBkIsbn(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Total Copies</label>
                  <input type="number" value={editBkCopies} onChange={(e) => setEditBkCopies(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Subject/Category</label>
                  <select value={editBkSubject} onChange={(e) => setEditBkSubject(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required>
                    <option value="">-- Choose Category --</option>
                    {bookCategories.map(bc => (
                      <option key={bc.id} value={bc.name}>{bc.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-bold text-slate-100 transition-colors mt-2">Save Catalog Changes</button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── Edit Book Category Modal Overlay ── */}
      {editingBookCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Layers size={16} className="text-brand-400" />
                Edit Book Category
              </h3>
              <button type="button" onClick={() => setEditingBookCategory(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateBookCategory} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Category Name</label>
                  <input type="text" value={editBcName} onChange={(e) => setEditBcName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Category Code</label>
                  <input type="text" value={editBcCode} onChange={(e) => setEditBcCode(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Description</label>
                <input type="text" value={editBcDesc} onChange={(e) => setEditBcDesc(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
              </div>
              <button type="submit" className="w-full py-2 bg-emerald-650 hover:bg-emerald-600 rounded-lg font-bold text-slate-100 transition-colors mt-2">Update Category</button>
            </form>
          </GlassCard>
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="space-y-6 animate-fade-in text-xs font-sans">
          <GlassCard className="border border-brand-500/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <FileText className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Administrative Documents Center</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Generate and download official school branded documents, ID cards, certificates, and admission sheets for registered students.</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="space-y-6">
            <div className="border-b border-slate-850 pb-3">
              <h4 className="font-bold text-slate-200 text-sm">Select Student to Generate Documents</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">Select a student from the master directory below to provision their official records.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full sm:w-80 space-y-1">
                <label className="text-[9px] text-slate-500 font-bold uppercase">Student Directory</label>
                <select
                  value={docSelectedStudentId}
                  onChange={(e) => setDocSelectedStudentId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Choose Student --</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.userDetails ? formatUserName(s.userDetails) : 'Resident'} — {s.admissionNumber} ({s.className})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {docSelectedStudentId ? (
              (() => {
                const st = students.find(s => s.id === docSelectedStudentId);
                if (!st) return null;
                const school = mockDb.schools.find(sc => sc.id === session?.user.schoolId) || {
                  id: session?.user.schoolId || '',
                  name: 'Aegis Academy',
                  address: 'Silicon Valley, Tech District, USA',
                  phone: '+1-555-0199',
                  email: 'admin@aegisacademy.edu',
                  sessionName: '2025-2026',
                  logoUrl: '',
                  sealUrl: ''
                };
                
                const handleDownload = async (type: string) => {
                  try {
                    setDocGenerating(type);

                    // ── Fetch ALL enriched student data from DB (no hardcoded values) ──
                    const enrichedSt = await fetchStudentDocData(st.id, session?.user.schoolId || '');
                    const enrichedSchool = await fetchSchoolDocData(session?.user.schoolId || '');
                    const principal = await fetchPrincipalDocData(session?.user.schoolId || '');

                    if (!enrichedSt) {
                      alert('Error: Could not load student data. Please try again.');
                      return;
                    }

                    const docSt = {
                      id: enrichedSt.studentId,
                      fullName: enrichedSt.fullName,
                      firstName: enrichedSt.firstName,
                      lastName: enrichedSt.lastName,
                      admissionNumber: enrichedSt.admissionNumber,
                      rollNumber: enrichedSt.rollNumber,
                      className: enrichedSt.className || st.className,
                      sectionName: enrichedSt.sectionName,
                      dateOfBirth: enrichedSt.dateOfBirth,
                      gender: enrichedSt.gender,
                      photoUrl: enrichedSt.photoUrl,     // System 1 — official academic photo only
                      avatarUrl: '',                      // intentionally empty — never use personal photo in documents
                      bloodGroup: enrichedSt.bloodGroup,
                      aadhaarNumber: enrichedSt.aadhaarNumber,
                      nationality: enrichedSt.nationality,
                      religion: enrichedSt.religion,
                      category: enrichedSt.category,
                      house: enrichedSt.house,
                      phone: enrichedSt.phone,
                      email: enrichedSt.email,
                      addressLine1: enrichedSt.addressLine1,
                      addressLine2: enrichedSt.addressLine2,
                      city: enrichedSt.city,
                      state: enrichedSt.state,
                      pincode: enrichedSt.pincode,
                      country: enrichedSt.country,
                      fatherName: enrichedSt.fatherName,
                      fatherPhone: enrichedSt.fatherPhone,
                      fatherEmail: enrichedSt.fatherEmail,
                      fatherOccupation: enrichedSt.fatherOccupation,
                      motherName: enrichedSt.motherName,
                      motherPhone: enrichedSt.motherPhone,
                      motherEmail: enrichedSt.motherEmail,
                      motherOccupation: enrichedSt.motherOccupation,
                      admissionDate: enrichedSt.admissionDate,
                      academicSession: enrichedSt.academicSession,
                      previousSchool: enrichedSt.previousSchool,
                      previousClass: enrichedSt.previousClass,
                      previousBoard: enrichedSt.previousBoard,
                      previousPercentage: enrichedSt.previousPercentage,
                    };

                    const docSchool = enrichedSchool ? {
                      id: enrichedSchool.id,
                      name: enrichedSchool.name,
                      address: enrichedSchool.address,
                      phone: enrichedSchool.phone,
                      email: enrichedSchool.email,
                      logoUrl: enrichedSchool.logoUrl,
                      sealUrl: enrichedSchool.sealUrl,
                      sessionName: enrichedSchool.sessionName,
                    } : {
                      id: session?.user.schoolId || '',
                      name: 'Aegis Academy',
                      address: '', phone: '', email: '',
                      logoUrl: '', sealUrl: '', sessionName: '2025-2026',
                    };

                    const pSig = principal.signatureUrl;
                    const pName = principal.name;

                    if (type === 'idcard') {
                      await downloadStudentIdCardPdf(docSchool, docSt, pSig, pName);
                    } else if (type === 'admission') {
                      await downloadAdmissionFormPdf(docSchool, docSt, undefined, pSig, pName);
                    } else if (type === 'admission_record') {
                      await downloadAdmissionRecordPdf(docSchool, docSt, pSig, pName);
                    } else if (type === 'bonafide') {
                      await downloadBonafideCertificatePdf(docSchool, docSt, pSig, pName);
                    } else if (type === 'excellence') {
                      await downloadCertificateOfExcellencePdf(docSchool, docSt, pSig, pName);
                    } else if (type === 'character') {
                      // Save DB record FIRST to get verification number
                      const docRes = await saveGeneratedDocumentRecord({
                        schoolId: session?.user.schoolId || '',
                        studentId: st.id,
                        documentType: 'character_certificate',
                        generatedByUserId: session?.user.id || '',
                        generatedByRole: session?.user.role || 'ADMIN',
                      });
                      await downloadCharacterCertificatePdf(docSchool, docSt, pSig, pName, docRes?.verificationNumber);
                    } else if (type === 'transfer') {
                      // Save DB record for Transfer Certificate (gated visibility)
                      const docRes = await saveGeneratedDocumentRecord({
                        schoolId: session?.user.schoolId || '',
                        studentId: st.id,
                        documentType: 'transfer_certificate',
                        generatedByUserId: session?.user.id || '',
                        generatedByRole: session?.user.role || 'ADMIN',
                      });
                      await downloadTransferCertificatePdf(docSchool, docSt, pSig, pName, docRes?.verificationNumber);
                    }
                  } catch (err) {
                    console.error('Failed to generate document:', err);
                    alert('Error building document PDF.');
                  } finally {
                    setDocGenerating('');
                  }
                };


                return (
                  <div className="pt-4 border-t border-slate-850 space-y-4 animate-fade-in">
                    <h5 className="font-semibold text-slate-200 text-xs">Available Branded Assets & Documents for {st.userDetails ? formatUserName(st.userDetails) : 'Resident'}</h5>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* ID Card Button */}
                      <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <h6 className="font-bold text-slate-200 text-xs">Student ID Card (CR80)</h6>
                          <p className="text-[10px] text-slate-450 mt-1">High-fidelity portrait wallet ID card. Incorporates student photo, QR verification, logo, seal, and administrative signature.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('idcard')}
                          disabled={!!docGenerating}
                          className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                        >
                          {docGenerating === 'idcard' ? 'Generating...' : 'Download ID Card (PDF)'}
                        </button>
                      </div>

                      {/* Admission Form Button */}
                      <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <h6 className="font-bold text-slate-200 text-xs">Admission Form Record</h6>
                          <p className="text-[10px] text-slate-450 mt-1">Pre-filled admission registry report sheet. Displays all verified profile fields, parent contact metrics, logo, and seal.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('admission')}
                          disabled={!!docGenerating}
                          className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                        >
                          {docGenerating === 'admission' ? 'Generating...' : 'Download Admission Form (PDF)'}
                        </button>
                      </div>

                      {/* Transfer Certificate Button */}
                      <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <h6 className="font-bold text-slate-200 text-xs">Transfer / Leaving Certificate</h6>
                          <p className="text-[10px] text-slate-450 mt-1">Official certificate of leaving character status. Displays CBSE rules structure, double border accents, and signature.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('transfer')}
                          disabled={!!docGenerating}
                          className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                        >
                          {docGenerating === 'transfer' ? 'Generating...' : 'Download Leaving Cert (PDF)'}
                        </button>
                      </div>

                      {/* Bonafide Certificate Button */}
                      <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <h6 className="font-bold text-slate-200 text-xs">Bonafide Student Certificate</h6>
                          <p className="text-[10px] text-slate-450 mt-1">Officially signed letter verifying student's active registration status within the academic institution.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('bonafide')}
                          disabled={!!docGenerating}
                          className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                        >
                          {docGenerating === 'bonafide' ? 'Generating...' : 'Download Bonafide Cert (PDF)'}
                        </button>
                      </div>

                      {/* Certificate of Excellence Button */}
                      <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <h6 className="font-bold text-slate-200 text-xs">Certificate of Excellence</h6>
                          <p className="text-[10px] text-slate-450 mt-1">Premium landscape citation designed with gold accents. Recognizes scholastic distinction, values, and work ethic.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('excellence')}
                          disabled={!!docGenerating}
                          className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                        >
                          {docGenerating === 'excellence' ? 'Generating...' : 'Download Certificate (PDF)'}
                        </button>
                      </div>

                      {/* Admission Record Button */}
                      <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <h6 className="font-bold text-slate-200 text-xs">Admission Record</h6>
                          <p className="text-[10px] text-slate-450 mt-1">Comprehensive tabular admission record. Includes all personal, academic, parent, address, and previous school details fetched live from database.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('admission_record')}
                          disabled={!!docGenerating}
                          className="w-full glass-btn-primary py-2 text-xs flex items-center justify-center gap-1.5"
                        >
                          {docGenerating === 'admission_record' ? 'Generating...' : 'Download Admission Record (PDF)'}
                        </button>
                      </div>

                      {/* Character Certificate Button — Admin Only, saves to DB */}
                      <div className="p-4 bg-amber-950/30 border border-amber-800/40 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <h6 className="font-bold text-amber-300 text-xs">Character Certificate</h6>
                            <span className="text-[8px] bg-amber-900/60 text-amber-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Admin Only</span>
                          </div>
                          <p className="text-[10px] text-slate-450">Generates official character certificate. Once generated, it becomes automatically visible to the student and parent portal. Saves an audit record.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('character')}
                          disabled={!!docGenerating}
                          className="w-full py-2 text-xs flex items-center justify-center gap-1.5 bg-amber-700/80 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors"
                        >
                          {docGenerating === 'character' ? 'Generating & Saving...' : 'Generate Character Certificate (PDF)'}
                        </button>
                      </div>

                      {/* Transfer Certificate Button — Admin Only, saves to DB */}
                      <div className="p-4 bg-rose-950/30 border border-rose-800/40 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <h6 className="font-bold text-rose-300 text-xs">Transfer Certificate</h6>
                            <span className="text-[8px] bg-rose-900/60 text-rose-400 px-1.5 py-0.5 rounded-full font-bold uppercase">Admin Only</span>
                          </div>
                          <p className="text-[10px] text-slate-450">Generates official school leaving / transfer certificate. Once generated, it becomes visible to student and parent portals. Saves an audit record.</p>
                        </div>
                        <button
                          onClick={() => handleDownload('transfer')}
                          disabled={!!docGenerating}
                          className="w-full py-2 text-xs flex items-center justify-center gap-1.5 bg-rose-700/80 hover:bg-rose-600 text-white rounded-xl font-semibold transition-colors"
                        >
                          {docGenerating === 'transfer' ? 'Generating & Saving...' : 'Generate Transfer Certificate (PDF)'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="p-6 bg-slate-900/10 border border-dashed border-slate-850 rounded-2xl text-center text-slate-500">
                Please select a student directory catalog entry to proceed.
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {activeTab === 'ptm' && (
        <PremiumLock
          isLocked={isTabLockedByEntitlements('ADMIN', 'ptm', ent)}
          requiredTier="Pro"
          featureName="PTM Meetings & Management"
        >
          <AdminPTMManagement />
        </PremiumLock>
      )}

      {/* ── Edit Book Issue Modal Overlay ── */}
      {editingBookIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Calendar size={16} className="text-brand-400" />
                Edit Book Issue Record
              </h3>
              <button type="button" onClick={() => setEditingBookIssue(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateBookIssue} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Due Return Date</label>
                  <input type="date" value={editBiDueDate} onChange={(e) => setEditBiDueDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Fine Amount ($)</label>
                  <input type="number" step="0.01" value={editBiFineAmount} onChange={(e) => setEditBiFineAmount(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Checkout Status</label>
                  <select value={editBiStatus} onChange={(e) => setEditBiStatus(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required>
                    <option value="ISSUED">Issued</option>
                    <option value="RETURNED">Returned</option>
                    <option value="OVERDUE">Overdue</option>
                    <option value="DAMAGED">Damaged</option>
                    <option value="LOST">Lost</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Return Date (Optional)</label>
                  <input type="date" value={editBiReturnDate} onChange={(e) => setEditBiReturnDate(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
              </div>
              <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-bold text-slate-100 transition-colors mt-2">Update Issue Record</button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── Edit Digital Asset Modal Overlay ── */}
      {editingDigitalAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <HardDrive size={16} className="text-brand-400" />
                Edit Digital Library Link
              </h3>
              <button type="button" onClick={() => setEditingDigitalAsset(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateDigitalAsset} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Asset Title</label>
                <input type="text" value={editDaTitle} onChange={(e) => setEditDaTitle(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Author</label>
                  <input type="text" value={editDaAuthor} onChange={(e) => setEditDaAuthor(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">File Type</label>
                  <select value={editDaType} onChange={(e) => setEditDaType(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none">
                    <option value="pdf">PDF E-Book</option>
                    <option value="epub">EPUB Reader</option>
                    <option value="mp4">Video Guide</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Public URL</label>
                <input type="url" value={editDaUrl} onChange={(e) => setEditDaUrl(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
              </div>
              <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-bold text-slate-100 transition-colors mt-2">Update Asset Link</button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── Edit Transport Assignment Modal Overlay ── */}
      {editingTransportAssignment && canManageTransport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Layers size={16} className="text-brand-400" />
                Edit Transport Assignment Stop
              </h3>
              <button type="button" onClick={() => setEditingTransportAssignment(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateTransportAssignment} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Student</label>
                <input type="text" value={(() => { const st = students.find(s => s.id === editingTransportAssignment.studentId); return st ? formatUserName(st.userDetails) : 'Unknown student'; })()} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2 text-slate-500 focus:outline-none cursor-not-allowed font-semibold" disabled />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Select Bus Fleet</label>
                <select value={editTaBusId} onChange={(e) => setEditTaBusId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required>
                  <option value="">-- Choose Bus --</option>
                  {buses.map(b => (
                    <option key={b.id} value={b.id}>{b.numberPlate}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Select Route</label>
                  <select value={editTaRouteId} onChange={(e) => setEditTaRouteId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required>
                    <option value="">-- Choose Route --</option>
                    {routes.map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.routeCode})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Select Stop Point</label>
                  <select value={editTaPickupPointId} onChange={(e) => setEditTaPickupPointId(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required>
                    <option value="">-- Choose Stop --</option>
                    {pickupPointsList.filter(pp => pp.routeId === editTaRouteId).map(pp => (
                      <option key={pp.id} value={pp.id}>{pp.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-bold text-slate-100 transition-colors mt-2">Save Assignment</button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── Edit Exam Modal Overlay ── */}
      {editingExam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Calendar size={16} className="text-brand-400" />
                Edit Examination Term
              </h3>
              <button type="button" onClick={() => setEditingExam(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateExam} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Exam Name</label>
                <input type="text" value={editExName} onChange={(e) => setEditExName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Term Session</label>
                <select value={editExTerm} onChange={(e) => setEditExTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none">
                  <option value="TERM 1">Term 1</option>
                  <option value="TERM 2">Term 2</option>
                  <option value="FINAL">Final Examination</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Start Date</label>
                  <input type="date" value={editExStart} onChange={(e) => setEditExStart(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">End Date</label>
                  <input type="date" value={editExEnd} onChange={(e) => setEditExEnd(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>
              <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-bold text-slate-100 transition-colors mt-2">Save Exam Details</button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── Edit Exam Subject Criteria Modal Overlay ── */}
      {editingExamSubject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Layers size={16} className="text-brand-400" />
                Edit Criteria Thresholds
              </h3>
              <button type="button" onClick={() => setEditingExamSubject(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateExamSubject} className="space-y-3">
              <div className="grid grid-cols-2 gap-3 font-semibold text-slate-400">
                <div>
                  <p className="text-[8px] uppercase">Exam</p>
                  <p className="text-slate-200 truncate mt-0.5">{examsList.find(e => e.id === editingExamSubject.examId)?.name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-[8px] uppercase">Subject</p>
                  <p className="text-slate-200 truncate mt-0.5">{editingExamSubject.subject?.name || subjects.find(s => s.id === editingExamSubject.subjectId)?.name || 'Unknown'}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Max Marks</label>
                  <input type="number" value={editEsMax} onChange={(e) => setEditEsMax(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Passing Marks</label>
                  <input type="number" value={editEsPass} onChange={(e) => setEditEsPass(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>
              <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-bold text-slate-100 transition-colors mt-2">Save Thresholds</button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── Edit Report Card Modal Overlay ── */}
      {editingReportCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fade-in text-xs">
          <GlassCard className="w-full max-w-md border border-brand-500/30 p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <Award size={16} className="text-brand-400" />
                Edit Report Card Details
              </h3>
              <button type="button" onClick={() => setEditingReportCard(null)} className="text-[10px] font-bold text-slate-500 hover:text-slate-350 uppercase">Cancel</button>
            </div>
            <form onSubmit={handleUpdateReportCard} className="space-y-3">
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Student</label>
                <input type="text" value={(() => { const st = students.find(s => s.id === editingReportCard.studentId); return st ? formatUserName(st.userDetails) : 'Unknown student'; })()} className="w-full bg-slate-950 border border-slate-900 rounded-lg p-2 text-slate-500 focus:outline-none cursor-not-allowed font-semibold" disabled />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Term</label>
                  <select value={editRcTerm} onChange={(e) => setEditRcTerm(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required>
                    <option value="TERM 1">Term 1</option>
                    <option value="TERM 2">Term 2</option>
                    <option value="FINAL">Final</option>
                  </select>
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">Attendance %</label>
                  <input type="number" value={editRcAttendance} onChange={(e) => setEditRcAttendance(parseInt(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
                <div className="space-y-1 col-span-1">
                  <label className="text-[9px] text-slate-400 font-bold uppercase">GPA Score</label>
                  <input type="number" step="0.01" value={editRcGpa} onChange={(e) => setEditRcGpa(parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] text-slate-400 font-bold uppercase">Teacher Remarks</label>
                <input type="text" value={editRcRemarks} onChange={(e) => setEditRcRemarks(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200 focus:outline-none" required />
              </div>
              <button type="submit" className="w-full py-2 bg-brand-600 hover:bg-brand-500 rounded-lg font-bold text-slate-100 transition-colors mt-2">Save Report Card Changes</button>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── Communication Center Toast Notification ── */}
      {commToast.show && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl p-4 backdrop-blur-md animate-fade-in flex items-start gap-3 border-l-4 border-l-brand-500">
          <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20 text-brand-400">
            {commToast.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <h5 className="font-bold text-xs text-slate-150">
              {commToast.type === 'success' ? 'Gateway Dispatch Success' : 'Gateway Dispatch Failure'}
            </h5>
            <p className="text-[10px] text-slate-400 mt-1 leading-normal break-words">{commToast.message}</p>
          </div>
          <button 
            type="button" 
            onClick={() => {
              if (commToastTimeoutRef.current) {
                clearTimeout(commToastTimeoutRef.current);
                commToastTimeoutRef.current = null;
              }
              setCommToast(prev => ({ ...prev, show: false }));
            }} 
            className="text-slate-500 hover:text-slate-300 p-0.5 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      )}

    </div>
  );
};

