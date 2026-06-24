import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import { 
  Trophy, Calendar, Users, Award, ShieldAlert, DollarSign, Activity, Settings, 
  Plus, Check, X, FileText, Download, Heart, Package, ShieldCheck, 
  CheckCircle2, Clock, AlertTriangle, ChevronRight, Search, BarChart3, Mail, RefreshCw, Key, Trash, Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, Legend, BarChart, Bar, AreaChart, Area
} from 'recharts';
import jsPDF from 'jspdf';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class FinanceErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: any): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("FinanceErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[#0b101d]/60 border border-red-500/30 rounded-2xl p-6 shadow-xl text-center space-y-3">
          <AlertTriangle className="text-red-500 mx-auto" size={32} />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Finance Data Rendering Error</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            The sports finance module failed to render correctly. This may be due to a rendering mismatch or invalid records. Please try reloading the portal or contact your administrator.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export const SportsManagement: React.FC = () => {
  const { session } = useStore();
  const schoolId = session?.user?.schoolId || '';
  const academicSessionId = session?.user?.academicSessionId || '';
  const userRole = session?.user?.role || '';
  const userId = session?.user?.id || '';

  // Active sub-tab state
  const [activeSubTab, setActiveSubTab] = useState<string>('dashboard');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Core Database Entities
  const [categories, setCategories] = useState<any[]>([]);
  const [sports, setSports] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [performance, setPerformance] = useState<any[]>([]);
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [rankings, setRankings] = useState<any[]>([]);
  const [certificates, setCertificates] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [medicalRecords, setMedicalRecords] = useState<any[]>([]);
  const [equipment, setEquipment] = useState<any[]>([]);
  const [equipmentLogs, setEquipmentLogs] = useState<any[]>([]);
  const [fees, setFees] = useState<any[]>([]);
  const [feePayments, setFeePayments] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  // RBAC and Attendance Entities
  const [sportsAdmins, setSportsAdmins] = useState<any[]>([]);
  const [salaryRecords, setSalaryRecords] = useState<any[]>([]);
  const [budgets, setBudgets] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expenseHistory, setExpenseHistory] = useState<any[]>([]);
  const [fines, setFines] = useState<any[]>([]);
  const [finePayments, setFinePayments] = useState<any[]>([]);
  const [budgetHistory, setBudgetHistory] = useState<any[]>([]);
  const [schoolPaymentSettings, setSchoolPaymentSettings] = useState<any>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [showCreateEnrollment, setShowCreateEnrollment] = useState<boolean>(false);
  const [enrollmentStudentId, setEnrollmentStudentId] = useState<string>('');
  const [enrollmentSportId, setEnrollmentSportId] = useState<string>('');
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [coachAttendance, setCoachAttendance] = useState<any[]>([]);
  const [coachLeaves, setCoachLeaves] = useState<any[]>([]);
  const [coachWorkLogs, setCoachWorkLogs] = useState<any[]>([]);
  const [attendanceCorrections, setAttendanceCorrections] = useState<any[]>([]);
  const [schools, setSchools] = useState<any[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<any[]>([]);
  const [athleteAttendanceHistory, setAthleteAttendanceHistory] = useState<any[]>([]);
  const [attendanceEdits, setAttendanceEdits] = useState<Record<string, { status: string; checkIn: string; checkOut: string; remarks: string; editReason?: string }>>({});
  const [showCheckInSimulator, setShowCheckInSimulator] = useState(false);
  const [simulatedCheckIn, setSimulatedCheckIn] = useState({ coachId: '', sessionName: 'Cricket Training', durationMinutes: 120, deviceId: 'DEV-IPHONE-726', ipAddress: '192.168.1.5', latitude: 12.9716, longitude: 77.5946, attendanceSource: 'MOBILE_GPS' });
  const [showTransferAdmin, setShowTransferAdmin] = useState<string | null>(null);
  const [transferTargetSchool, setTransferTargetSchool] = useState<string>('');

  // Searching & Filtering
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Form Modals states
  const [showAddSport, setShowAddSport] = useState(false);
  const [newSport, setNewSport] = useState({ name: '', categoryId: '', type: 'OUTDOOR', format: 'TEAM', description: '' });
  
  const [showAddSportsAdmin, setShowAddSportsAdmin] = useState(false);
  const [newSportsAdmin, setNewSportsAdmin] = useState({ email: '', firstName: '', lastName: '', phone: '', employeeId: '', password: '' });
  
  const [showAddCoach, setShowAddCoach] = useState(false);
  const [newCoach, setNewCoach] = useState({ email: '', name: '', phone: '', employeeId: '', specialization: '', experienceYears: 0, certification: '', salary: 15000, password: '' });
  
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', sportId: '', coachId: '', captainId: '', ageGroup: 'U-16', gender: 'MIXED' });
  
  const [showSchedulePractice, setShowSchedulePractice] = useState(false);
  const [newSession, setNewSession] = useState({ sessionName: '', sportId: '', teamId: '', coachId: '', sessionDate: '', startTime: '04:00 PM', endTime: '06:00 PM', venue: '', recurrence: 'NONE' });

  const [showFeePayment, setShowFeePayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ sportsFeeId: '', paymentMethod: 'UPI', transactionId: '', utrNumber: '', screenshotUrl: '', remarks: '' });
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [newInvoice, setNewInvoice] = useState({ studentId: '', sportId: '', invoiceTitle: '', invoiceDescription: '', invoiceCategory: 'Coaching Fee', amount: 0, dueDate: '', lateFee: 0, remarks: '' });
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [showStudentDropdown, setShowStudentDropdown] = useState(false);
  const [fineStudentSearch, setFineStudentSearch] = useState('');
  const [showFineStudentDropdown, setShowFineStudentDropdown] = useState(false);
  const [showCreateSalaryRequest, setShowCreateSalaryRequest] = useState(false);
  const [newSalaryRequest, setNewSalaryRequest] = useState({ employeeId: '', employeeType: 'COACH' as 'COACH' | 'ADMIN', salaryMonth: '', grossSalary: 0, bonus: 0, deductions: 0 });
  const [submittingSalaryRequest, setSubmittingSalaryRequest] = useState(false);
  
  const [showAddPerformance, setShowAddPerformance] = useState(false);
  const [perfForm, setPerfForm] = useState({ studentId: '', sportId: '', speed: 80, stamina: 80, strength: 80, agility: 80, teamwork: 80, fitness: 80, coachRating: 8.0, remarks: '' });

  const [showEquipmentLog, setShowEquipmentLog] = useState(false);
  const [eqLogForm, setEqLogForm] = useState({ equipmentId: '', assignedToUserId: '', quantity: 1 });

  const [showRequestExpense, setShowRequestExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: 'EQUIPMENT_PURCHASE', title: '', amountRequested: 1000, description: '', vendor: '', invoiceNumber: '', referenceId: '' });

  const [showIssueFine, setShowIssueFine] = useState(false);
  const [fineForm, setFineForm] = useState({ studentId: '', amount: 500, reason: '', dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0] });

  const [showApplyLeave, setShowApplyLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], leaveType: 'CASUAL', reason: '' });

  const [showRequestCorrection, setShowRequestCorrection] = useState(false);
  const [correctionForm, setCorrectionForm] = useState({ attendanceId: '', requestedStatus: 'PRESENT', requestedCheckIn: '09:00', requestedCheckOut: '17:00', reason: '' });

  const [showPayFine, setShowPayFine] = useState(false);
  const [activeFineId, setActiveFineId] = useState<string | null>(null);
  const [finePaymentForm, setFinePaymentForm] = useState({ utrNumber: '', screenshotUrl: '' });
  const [showRejectPaymentModal, setShowRejectPaymentModal] = useState(false);
  const [rejectPaymentId, setRejectPaymentId] = useState<string | null>(null);
  const [rejectionReasonText, setRejectionReasonText] = useState('');
  const [selectedStudentReport, setSelectedStudentReport] = useState<string>('');
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, number>>({});

  const [showCreateFeePayment, setShowCreateFeePayment] = useState(false);
  const [newFeePayment, setNewFeePayment] = useState({ studentId: '', invoiceId: '', amount: '', utrNumber: '', screenshotUrl: '', status: 'PENDING_VERIFICATION' });
  const [feePaymentStudentSearch, setFeePaymentStudentSearch] = useState('');
  const [showFeePaymentStudentDropdown, setShowFeePaymentStudentDropdown] = useState(false);
  const [submittingFeePayment, setSubmittingFeePayment] = useState(false);

  const [showCreateFinePayment, setShowCreateFinePayment] = useState(false);
  const [newFinePayment, setNewFinePayment] = useState({ studentId: '', reason: '', amount: '', utrNumber: '', screenshotUrl: '', status: 'PENDING' });
  const [finePaymentStudentSearch, setFinePaymentStudentSearch] = useState('');
  const [showFinePaymentStudentDropdown, setShowFinePaymentStudentDropdown] = useState(false);
  const [submittingFinePayment, setSubmittingFinePayment] = useState(false);

  const [showEditInvoice, setShowEditInvoice] = useState(false);
  const [editInvoiceForm, setEditInvoiceForm] = useState({ id: '', sportId: '', invoiceTitle: '', invoiceDescription: '', invoiceCategory: 'Coaching Fee', amount: '', dueDate: '', remarks: '' });
  const [updatingInvoice, setUpdatingInvoice] = useState(false);

  const [showViewInvoice, setShowViewInvoice] = useState(false);
  const [selectedViewInvoice, setSelectedViewInvoice] = useState<any>(null);

  // Active student context (for Student/Parent dashboards)
  const [studentProfileId, setStudentProfileId] = useState<string>('');
  const [parentLinkedStudents, setParentLinkedStudents] = useState<any[]>([]);
  const [parentProfileId, setParentProfileId] = useState<string>('');

  // Safety wrapper to suppress RLS access restrictions on load
  const safeFetch = async (apiCall: () => Promise<any>, fallback: any = []) => {
    try {
      return await apiCall();
    } catch (err) {
      console.warn('API call failed or unauthorized for role:', err);
      return fallback;
    }
  };

  const loadData = async (silent = false, overrideStudentId?: string) => {
    if (!silent) setLoading(true);
    try {
      if (!schoolId) return;

      const [
        catsRes, sportsRes, coachesRes, enrollsRes, teamsRes, schedsRes, perfRes, tournsRes, ranksRes, certsRes, achsRes, medRes, equipRes, equipLogRes, feesRes, pmtsRes, notifRes,
        adminsRes, salaryRes, budgetsRes, expensesRes, finesRes, logsRes, coachAttRes, leavesRes, workLogsRes, correctionsRes, schoolsRes, historyRes,
        finePmtsRes, budgetHistoryRes, paymentSettingsRes, expenseHistoryRes
      ] = await Promise.all([
        safeFetch(() => mockApi.fetchSportsCategories(schoolId)),
        safeFetch(() => mockApi.fetchSports(schoolId)),
        safeFetch(() => mockApi.fetchSportsCoaches(schoolId)),
        safeFetch(() => academicSessionId ? mockApi.fetchSportsEnrollments(schoolId, academicSessionId) : Promise.resolve([])),
        safeFetch(() => mockApi.fetchSportsTeams(schoolId)),
        safeFetch(() => academicSessionId ? mockApi.fetchSportsTrainingSessions(schoolId, academicSessionId) : Promise.resolve([])),
        safeFetch(() => academicSessionId ? mockApi.fetchSportsPerformanceMetrics(schoolId, academicSessionId) : Promise.resolve([])),
        safeFetch(() => academicSessionId ? mockApi.fetchSportsTournaments(schoolId, academicSessionId) : Promise.resolve([])),
        safeFetch(() => academicSessionId ? mockApi.fetchSportsRankings(schoolId, academicSessionId) : Promise.resolve([])),
        safeFetch(() => mockApi.fetchSportsCertificates(schoolId)),
        safeFetch(() => mockApi.fetchSportsAchievements(schoolId)),
        safeFetch(() => mockApi.fetchSportsMedicalRecords(schoolId)),
        safeFetch(() => mockApi.fetchSportsEquipment(schoolId)),
        safeFetch(() => mockApi.fetchSportsEquipmentLogs(schoolId)),
        safeFetch(() => academicSessionId ? mockApi.fetchSportsFees(schoolId, academicSessionId) : Promise.resolve([])),
        safeFetch(() => mockApi.fetchSportsFeePayments(schoolId)),
        safeFetch(() => mockApi.fetchSportsNotifications(schoolId, userId)),
        
        safeFetch(() => mockApi.fetchSportsAdmins(schoolId)),
        safeFetch(() => mockApi.fetchSalaryRequests(schoolId)),
        safeFetch(() => academicSessionId ? mockApi.fetchBudgets(schoolId, academicSessionId) : Promise.resolve([])),
        safeFetch(() => mockApi.fetchExpenses(schoolId, academicSessionId)),
        safeFetch(() => mockApi.fetchFines(schoolId, academicSessionId)),
        safeFetch(() => mockApi.fetchSportsActivityLogs(schoolId)),
        safeFetch(() => mockApi.fetchCoachAttendance(schoolId)),
        safeFetch(() => mockApi.fetchCoachLeaves(schoolId)),
        safeFetch(() => mockApi.fetchCoachWorkLogs(schoolId)),
        safeFetch(() => mockApi.fetchCoachAttendanceCorrections(schoolId)),
        safeFetch(() => mockApi.fetchSchools(), []),
        safeFetch(() => mockApi.fetchCoachAttendanceHistory(schoolId), []),
        safeFetch(() => mockApi.fetchFinePayments(schoolId), []),
        safeFetch(() => mockApi.fetchBudgetHistory(schoolId), []),
        safeFetch(() => mockApi.fetchSchoolPaymentSettings(schoolId, userRole), null),
        safeFetch(() => mockApi.fetchExpenseHistory(schoolId), [])
      ]);

      setCategories(catsRes);
      setSports(sportsRes);
      setCoaches(coachesRes);
      setEnrollments(enrollsRes);
      setTeams(teamsRes);
      setSessions(schedsRes);
      setPerformance(perfRes);
      setTournaments(tournsRes);
      setRankings(ranksRes);
      setCertificates(certsRes);
      setAchievements(achsRes);
      setMedicalRecords(medRes);
      setEquipment(equipRes);
      setEquipmentLogs(equipLogRes);
      setFees(feesRes);
      setFeePayments(pmtsRes);
      setNotifications(notifRes);

      setSportsAdmins(adminsRes);
      setSalaryRecords(salaryRes);
      setBudgets(budgetsRes);
      setExpenses(expensesRes);
      setExpenseHistory(expenseHistoryRes);
      setFines(finesRes);
      setFinePayments(finePmtsRes);
      setBudgetHistory(budgetHistoryRes);
      setSchoolPaymentSettings(paymentSettingsRes);
      setActivityLogs(logsRes);
      setCoachAttendance(coachAttRes);
      setCoachLeaves(leavesRes);
      setCoachWorkLogs(workLogsRes);
      setAttendanceCorrections(correctionsRes);
      setSchools(schoolsRes);
      setAttendanceHistory(historyRes);

      // Resolve student profile mapping for Student/Parent
      let activeStudentId = '';
      if (userRole === 'STUDENT') {
        const { data: std } = await supabase.from('students').select('id').eq('user_id', userId).maybeSingle();
        if (std) {
          setStudentProfileId(std.id);
          activeStudentId = std.id;
          const { data: mapping } = await supabase.from('parent_student_mapping').select('parent_id').eq('student_id', std.id).maybeSingle();
          if (mapping) {
            setParentProfileId(mapping.parent_id);
          }
        }
      } else if (userRole === 'PARENT') {
        const { data: parent } = await supabase.from('parents').select('id').eq('user_id', userId).maybeSingle();
        if (parent) {
          setParentProfileId(parent.id);
          const { data: mappings } = await supabase.from('parent_student_mapping').select('student_id').eq('parent_id', parent.id);
          if (mappings && mappings.length > 0) {
            const mappedIds = mappings.map(m => m.student_id);
            const { data: stdProfiles } = await supabase.from('students').select('*, users(first_name, last_name)').in('id', mappedIds);
            setParentLinkedStudents(stdProfiles || []);
            if (stdProfiles && stdProfiles.length > 0) {
              const initialStudentId = studentProfileId || stdProfiles[0].id;
              setStudentProfileId(initialStudentId);
              activeStudentId = initialStudentId;
            }
          }
        }
      }

      // Fetch athlete attendance for Student/Parent
      const currentStudentId = overrideStudentId || activeStudentId || studentProfileId;
      if (['STUDENT', 'PARENT'].includes(userRole) && currentStudentId) {
        const attHistory = await mockApi.fetchStudentAttendance(schoolId, currentStudentId);
        setAthleteAttendanceHistory(attHistory);
      }

      // Load all students for the school if Admin, Sports Admin, or Finance Admin
      if (['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'FINANCE_ADMIN', 'COACH'].includes(userRole)) {
        const { data: stds, error: stdsErr } = await supabase
          .from('students')
          .select('id, admission_number, users(first_name, last_name), classes(name), sections(name)')
          .eq('school_id', schoolId);
        if (!stdsErr && stds) {
          setAllStudents(stds.map(s => {
            const userObj: any = Array.isArray(s.users) ? s.users[0] : s.users;
            const classObj: any = Array.isArray(s.classes) ? s.classes[0] : s.classes;
            const sectionObj: any = Array.isArray(s.sections) ? s.sections[0] : s.sections;
            const className = classObj ? `${classObj.name || ''}${sectionObj ? ' ' + (sectionObj.name || '') : ''}`.trim() : 'N/A';
            return {
              id: s.id,
              name: userObj ? `${userObj.first_name || ''} ${userObj.last_name || ''}`.trim() : 'Unknown Student',
              admissionNumber: s.admission_number || 'N/A',
              className: className
            };
          }));
        }
      }
    } catch (e) {
      console.error('Failed to load Sports module records:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Supabase Realtime Channels binding for instantly refreshing all dashboard KPIs & charts
    const channel = supabase
      .channel('sports-module-realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_enrollments' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_fee_payments' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_attendance' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_fixtures' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_teams' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_performance_metrics' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_equipment' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_equipment_logs' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_admins' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_coaches' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_finance_transactions' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_fee_invoices' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_salary_requests' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_budget_allocations' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_budget_history' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_expense_requests' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_fines' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_fine_payments' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_coach_attendance' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_coach_leaves' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_coach_work_logs' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_coach_attendance_corrections' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_expense_history' }, () => { loadData(true); })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [schoolId, academicSessionId, userId]);

  // Operations handlers
  const handleAddSport = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.addSport({
        schoolId,
        categoryId: newSport.categoryId,
        name: newSport.name,
        type: newSport.type as any,
        format: newSport.format as any,
        description: newSport.description,
        status: 'ACTIVE'
      });
      setShowAddSport(false);
      setNewSport({ name: '', categoryId: '', type: 'OUTDOOR', format: 'TEAM', description: '' });
      loadData(true);
    } catch (err: any) {
      alert(`Error creating sport: ${err.message}`);
    }
  };

  const handleAddSportsAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.createSportsAdmin(
        userId,
        newSportsAdmin.email,
        newSportsAdmin.firstName,
        newSportsAdmin.lastName,
        newSportsAdmin.phone,
        newSportsAdmin.employeeId,
        newSportsAdmin.password
      );
      setShowAddSportsAdmin(false);
      setNewSportsAdmin({ email: '', firstName: '', lastName: '', phone: '', employeeId: '', password: '' });
      loadData(true);
      alert('Sports Admin successfully created!');
    } catch (err: any) {
      alert(`Error creating Sports Admin: ${err.message}`);
    }
  };

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.addSportsCoach(userId, {
        name: newCoach.name,
        email: newCoach.email,
        phone: newCoach.phone,
        employeeId: newCoach.employeeId,
        specialization: newCoach.specialization,
        experienceYears: newCoach.experienceYears,
        certification: newCoach.certification,
        salary: newCoach.salary,
        password: newCoach.password
      });
      setShowAddCoach(false);
      setNewCoach({ email: '', name: '', phone: '', employeeId: '', specialization: '', experienceYears: 0, certification: '', salary: 15000, password: '' });
      loadData(true);
      alert('Coach successfully created and registered!');
    } catch (err: any) {
      alert(`Error creating coach: ${err.message}`);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.createSportsTeam({
        schoolId,
        sportId: newTeam.sportId,
        name: newTeam.name,
        coachId: newTeam.coachId || null,
        captainId: newTeam.captainId || null,
        ageGroup: newTeam.ageGroup,
        gender: newTeam.gender
      });
      setShowCreateTeam(false);
      setNewTeam({ name: '', sportId: '', coachId: '', captainId: '', ageGroup: 'U-16', gender: 'MIXED' });
      loadData(true);
    } catch (err: any) {
      alert(`Error creating team: ${err.message}`);
    }
  };

  const handleSchedulePractice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.createSportsTrainingSession({
        schoolId,
        academicSessionId,
        sportId: newSession.sportId,
        teamId: newSession.teamId || null,
        coachId: newSession.coachId || null,
        sessionName: newSession.sessionName,
        sessionDate: newSession.sessionDate,
        startTime: newSession.startTime,
        endTime: newSession.endTime,
        venue: newSession.venue,
        recurrence: newSession.recurrence
      });
      setShowSchedulePractice(false);
      setNewSession({ sessionName: '', sportId: '', teamId: '', coachId: '', sessionDate: '', startTime: '04:00 PM', endTime: '06:00 PM', venue: '', recurrence: 'NONE' });
      loadData(true);
    } catch (err: any) {
      alert(`Error scheduling training: ${err.message}`);
    }
  };

  const handleFeePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.screenshotUrl) {
      alert("Payment screenshot proof is required.");
      return;
    }
    if (!paymentForm.utrNumber) {
      alert("UTR Number is required.");
      return;
    }
    try {
      await mockApi.submitSportsFeePayment({
        schoolId,
        sportsFeeId: paymentForm.sportsFeeId,
        studentId: studentProfileId,
        parentId: parentProfileId || userId,
        amountPaid: fees.find(f => f.id === paymentForm.sportsFeeId)?.amount || 0,
        paymentMethod: paymentForm.paymentMethod,
        transactionId: paymentForm.transactionId,
        utrNumber: paymentForm.utrNumber,
        paymentScreenshotUrl: paymentForm.screenshotUrl,
        remarks: paymentForm.remarks || ''
      });
      setShowFeePayment(false);
      setPaymentForm({ sportsFeeId: '', paymentMethod: 'UPI', transactionId: '', utrNumber: '', screenshotUrl: '', remarks: '' });
      loadData(true);
      alert('Payment submitted for verification successfully!');
    } catch (err: any) {
      alert(`Error submitting payment: ${err.message}`);
    }
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>, isFine = false) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const publicUrl = await mockApi.uploadSportsPaymentProof(schoolId, file);
      if (isFine) {
        setFinePaymentForm(prev => ({ ...prev, screenshotUrl: publicUrl }));
      } else {
        setPaymentForm(prev => ({ ...prev, screenshotUrl: publicUrl }));
      }
      alert('Proof of payment uploaded successfully!');
    } catch (err: any) {
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateSportsInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInvoice.studentId) {
      alert('Please select a student.');
      return;
    }
    if (!newInvoice.invoiceTitle) {
      alert('Please enter an invoice title.');
      return;
    }
    if (newInvoice.amount <= 0) {
      alert('Amount must be greater than 0.');
      return;
    }
    if (!newInvoice.dueDate) {
      alert('Please select a due date.');
      return;
    }

    setSubmittingInvoice(true);
    try {
      await mockApi.createSportsInvoice({
        schoolId,
        studentId: newInvoice.studentId,
        sportId: newInvoice.sportId || null,
        invoiceTitle: newInvoice.invoiceTitle,
        invoiceDescription: newInvoice.invoiceDescription,
        invoiceCategory: newInvoice.invoiceCategory,
        amount: newInvoice.amount,
        dueDate: newInvoice.dueDate,
        lateFee: newInvoice.lateFee,
        remarks: newInvoice.remarks,
        createdBy: userId
      });
      setShowAddInvoice(false);
      setNewInvoice({ studentId: '', sportId: '', invoiceTitle: '', invoiceDescription: '', invoiceCategory: 'Coaching Fee', amount: 0, dueDate: '', lateFee: 0, remarks: '' });
      loadData(true);
      alert('Sports invoice created successfully!');
    } catch (err: any) {
      alert(`Error creating sports invoice: ${err.message}`);
    } finally {
      setSubmittingInvoice(false);
    }
  };

  const handleCreateSalaryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSalaryRequest.employeeId) {
      alert('Please select an employee.');
      return;
    }
    if (!newSalaryRequest.salaryMonth) {
      alert('Please enter a salary month.');
      return;
    }
    if (newSalaryRequest.grossSalary <= 0) {
      alert('Gross salary must be greater than 0.');
      return;
    }

    setSubmittingSalaryRequest(true);
    try {
      await mockApi.createSalaryRequest(userId, {
        employeeId: newSalaryRequest.employeeId,
        employeeType: newSalaryRequest.employeeType,
        salaryMonth: newSalaryRequest.salaryMonth,
        grossSalary: newSalaryRequest.grossSalary,
        bonus: newSalaryRequest.bonus,
        deductions: newSalaryRequest.deductions
      });
      setShowCreateSalaryRequest(false);
      setNewSalaryRequest({ employeeId: '', employeeType: 'COACH', salaryMonth: '', grossSalary: 0, bonus: 0, deductions: 0 });
      loadData(true);
      alert('Salary request submitted successfully!');
    } catch (err: any) {
      alert(`Error creating payroll request: ${err.message}`);
    } finally {
      setSubmittingSalaryRequest(false);
    }
  };

  const handleAddPerformance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.recordSportsPerformanceMetric({
        schoolId,
        academicSessionId,
        studentId: perfForm.studentId,
        sportId: perfForm.sportId,
        speed: Number(perfForm.speed),
        stamina: Number(perfForm.stamina),
        strength: Number(perfForm.strength),
        agility: Number(perfForm.agility),
        skill: Number(perfForm.agility), // mapped directly
        discipline: 85,
        teamwork: Number(perfForm.teamwork),
        fitness: Number(perfForm.fitness),
        coachRating: Number(perfForm.coachRating),
        coachId: coaches.find(c => c.userId === userId)?.id || null,
        remarks: perfForm.remarks
      });
      setShowAddPerformance(false);
      loadData(true);
      alert('Athletic Performance metrics recorded!');
    } catch (err: any) {
      alert(`Error logging metrics: ${err.message}`);
    }
  };

  const handleEquipmentLog = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.logSportsEquipmentIssue({
        schoolId,
        equipmentId: eqLogForm.equipmentId,
        assignedToUserId: eqLogForm.assignedToUserId,
        quantity: Number(eqLogForm.quantity)
      });
      setShowEquipmentLog(false);
      loadData(true);
      alert('Equipment logged out successfully!');
    } catch (err: any) {
      alert(`Error issuing equipment: ${err.message}`);
    }
  };

  const handleRequestExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.requestExpense(userId, {
        academicSessionId,
        category: expenseForm.category,
        title: expenseForm.title,
        amountRequested: Number(expenseForm.amountRequested),
        description: expenseForm.description,
        vendor: expenseForm.vendor,
        invoiceNumber: expenseForm.invoiceNumber,
        referenceId: expenseForm.referenceId || null
      });
      setShowRequestExpense(false);
      setExpenseForm({ category: 'EQUIPMENT_PURCHASE', title: '', amountRequested: 1000, description: '', vendor: '', invoiceNumber: '', referenceId: '' });
      loadData(true);
      alert('Procurement request submitted successfully!');
    } catch (err: any) {
      alert(`Error requesting expense: ${err.message}`);
    }
  };

  const handleIssueFine = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.issueFine(userId, {
        academicSessionId,
        studentId: fineForm.studentId,
        amount: Number(fineForm.amount),
        reason: fineForm.reason,
        dueDate: fineForm.dueDate
      });
      setShowIssueFine(false);
      setFineForm({ studentId: '', amount: 500, reason: '', dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0] });
      loadData(true);
      alert('Discipline fine issued!');
    } catch (err: any) {
      alert(`Error issuing fine: ${err.message}`);
    }
  };

  const handlePayFine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFineId) return;
    try {
      await mockApi.submitFinePayment(activeFineId, {
        utrNumber: finePaymentForm.utrNumber,
        screenshotUrl: finePaymentForm.screenshotUrl
      });
      setShowPayFine(false);
      setActiveFineId(null);
      setFinePaymentForm({ utrNumber: '', screenshotUrl: '' });
      loadData(true);
      alert('Fine payment submitted for review!');
    } catch (err: any) {
      alert(`Error submitting fine payment: ${err.message}`);
    }
  };

  const handleCreateFeePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeePayment.studentId) return alert('Please select a student.');
    if (!newFeePayment.invoiceId) return alert('Please select an invoice.');
    if (!newFeePayment.amount) return alert('Please enter the paid amount.');
    if (!newFeePayment.utrNumber) return alert('UTR number is required.');

    setSubmittingFeePayment(true);
    try {
      await mockApi.adminCreateSportsFeePayment(userId, {
        studentId: newFeePayment.studentId,
        invoiceId: newFeePayment.invoiceId,
        amount: Number(newFeePayment.amount),
        utrNumber: newFeePayment.utrNumber,
        screenshotUrl: newFeePayment.screenshotUrl,
        status: newFeePayment.status
      });
      setShowCreateFeePayment(false);
      setNewFeePayment({ studentId: '', invoiceId: '', amount: '', utrNumber: '', screenshotUrl: '', status: 'PENDING_VERIFICATION' });
      setFeePaymentStudentSearch('');
      loadData(true);
      alert('Fee payment record successfully created!');
    } catch (err: any) {
      alert(`Error creating fee payment: ${err.message}`);
    } finally {
      setSubmittingFeePayment(false);
    }
  };

  const handleCreateFinePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFinePayment.studentId) return alert('Please select a student.');
    if (!newFinePayment.reason) return alert('Please specify fine reason.');
    if (!newFinePayment.amount) return alert('Please enter amount.');
    if (!newFinePayment.utrNumber) return alert('UTR Reference is required.');

    setSubmittingFinePayment(true);
    try {
      await mockApi.adminCreateSportsFinePayment(userId, {
        studentId: newFinePayment.studentId,
        reason: newFinePayment.reason,
        amount: Number(newFinePayment.amount),
        utrNumber: newFinePayment.utrNumber,
        screenshotUrl: newFinePayment.screenshotUrl,
        status: newFinePayment.status
      });
      setShowCreateFinePayment(false);
      setNewFinePayment({ studentId: '', reason: '', amount: '', utrNumber: '', screenshotUrl: '', status: 'PENDING' });
      setFinePaymentStudentSearch('');
      loadData(true);
      alert('Fine payment record successfully created!');
    } catch (err: any) {
      alert(`Error creating fine payment: ${err.message}`);
    } finally {
      setSubmittingFinePayment(false);
    }
  };

  const handleEditInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editInvoiceForm.invoiceTitle) return alert('Title is required.');
    if (!editInvoiceForm.amount) return alert('Amount is required.');
    if (!editInvoiceForm.dueDate) return alert('Due Date is required.');

    setUpdatingInvoice(true);
    try {
      await mockApi.updateSportsInvoice(userId, editInvoiceForm.id, {
        invoiceTitle: editInvoiceForm.invoiceTitle,
        invoiceDescription: editInvoiceForm.invoiceDescription,
        invoiceCategory: editInvoiceForm.invoiceCategory,
        amount: Number(editInvoiceForm.amount),
        dueDate: editInvoiceForm.dueDate,
        sportId: editInvoiceForm.sportId || null,
        remarks: editInvoiceForm.remarks
      });
      setShowEditInvoice(false);
      loadData(true);
      alert('Invoice updated successfully!');
    } catch (err: any) {
      alert(`Error updating invoice: ${err.message}`);
    } finally {
      setUpdatingInvoice(false);
    }
  };

  const handleApplyLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.applyCoachLeave(userId, leaveForm);
      setShowApplyLeave(false);
      setLeaveForm({ startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], leaveType: 'CASUAL', reason: '' });
      loadData(true);
      alert('Leave application submitted!');
    } catch (err: any) {
      alert(`Error applying for leave: ${err.message}`);
    }
  };

  const handleRequestCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await mockApi.submitAttendanceCorrection(userId, correctionForm);
      setShowRequestCorrection(false);
      setCorrectionForm({ attendanceId: '', requestedStatus: 'PRESENT', requestedCheckIn: '09:00', requestedCheckOut: '17:00', reason: '' });
      loadData(true);
      alert('Attendance correction requested!');
    } catch (err: any) {
      alert(`Error requesting correction: ${err.message}`);
    }
  };

  const downloadCertificate = (cert: any) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFillColor(7, 10, 19);
    doc.rect(0, 0, 297, 210, 'F');
    doc.setDrawColor(59, 130, 246);
    doc.setLineWidth(4);
    doc.rect(10, 10, 277, 190);
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(28);
    doc.text('AEGIS ERP SPORTS ECOSYSTEM', 148, 45, { align: 'center' });
    
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(20);
    doc.text('CERTIFICATE OF ACCOMPLISHMENT', 148, 65, { align: 'center' });
    
    doc.setTextColor(226, 232, 240);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(14);
    doc.text('This is proudly awarded to', 148, 90, { align: 'center' });
    
    doc.setTextColor(255, 255, 255);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(24);
    doc.text(cert.studentName.toUpperCase(), 148, 110, { align: 'center' });
    
    doc.setTextColor(226, 232, 240);
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(14);
    doc.text(`for outstanding performance and excellence in ${cert.sportName}`, 148, 125, { align: 'center' });
    doc.text(`under the category of ${cert.category.replace('_', ' ')}`, 148, 135, { align: 'center' });
    
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Verification ID: ${cert.certificateNumber}`, 148, 175, { align: 'center' });
    doc.text(`Issued Date: ${cert.issueDate}`, 148, 182, { align: 'center' });
    doc.save(`Sports_Certificate_${cert.certificateNumber}.pdf`);
  };

  // Helper selectors / computed values
  const studentEnrollments = enrollments.filter(e => e.studentId === studentProfileId);
  const studentSports = studentEnrollments.filter(e => e.status === 'APPROVED').map(e => e.sportId);
  const currentCoach = coaches.find(c => c.userId === userId);
  const isCoach = !!currentCoach;

  // Determine current portal dashboard view
  const getSubPortalRole = () => {
    if (userRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (userRole === 'ADMIN') return 'SCHOOL_ADMIN';
    if (userRole === 'SPORTS_ADMIN') return 'SPORTS_ADMIN';
    if (userRole === 'FINANCE_ADMIN') return 'FINANCE_ADMIN';
    if (userRole === 'STUDENT') return 'STUDENT';
    if (userRole === 'PARENT') return 'PARENT';
    if (userRole === 'COACH') return 'COACH';
    if (userRole === 'TEACHER' && isCoach) return 'COACH';
    if (userRole === 'TEACHER') return 'TEACHER';
    return 'TEACHER';
  };

  const portalRole = getSubPortalRole();

  // Metrics calculators
  const approvedEnrollmentsCount = enrollments.filter(e => e.status === 'APPROVED').length;
  const pendingEnrollmentsCount = enrollments.filter(e => e.status === 'PENDING').length;
  const activeSportsCount = sports.filter(s => s.status === 'ACTIVE').length;
  
  const totalRevenue = feePayments
    .filter(p => p.status === 'APPROVED')
    .reduce((sum, p) => sum + p.amountPaid, 0) +
    fines.filter(f => f.status === 'PAID').reduce((sum, f) => sum + f.amount, 0);

  const pendingRevenue = feePayments
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.amountPaid, 0);

  const outstandingRevenue = fees.reduce((sum, f) => {
    const studentCount = enrollments.filter(e => e.status === 'APPROVED' && e.sportId === f.sportId).length;
    return sum + (f.amount * studentCount);
  }, 0) - totalRevenue;

  const totalOutstanding = Math.max(0, outstandingRevenue);

  // Sports Finance Dashboard computed metrics
  const totalInvoicesAmount = fees.reduce((sum, f) => sum + f.amount, 0);
  const unpaidInvoicesCount = fees.filter(f => f.status === 'UNPAID').length;
  const paymentsQueueCount = feePayments.filter(p => p.status === 'PENDING_VERIFICATION').length;
  const totalCollectionsAmount = feePayments.filter(p => p.status === 'APPROVED').reduce((sum, p) => sum + p.amountPaid, 0) + finePayments.filter(f => f.status === 'APPROVED').reduce((sum, f) => sum + f.amount, 0);
  const pendingExpensesCount = expenses.filter(e => e.status === 'PENDING').length;
  const pendingPayrollCount = salaryRecords.filter(s => s.status === 'PENDING').length;
  const pendingFinesCount = finePayments.filter(f => f.status === 'PENDING').length;
  const totalAllocatedBudget = budgets.reduce((sum, b) => sum + b.allocatedAmount, 0);
  const totalExpensesSpent = expenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + e.amountRequested, 0);
  const payrollThisMonth = salaryRecords.filter(s => s.salaryMonth === selectedMonth && s.status === 'PAID').reduce((sum, s) => sum + s.netSalary, 0);
  const fineCollectionsAmount = finePayments.filter(f => f.status === 'APPROVED').reduce((sum, f) => sum + f.amount, 0);

  // Coach attendance dashboard stats
  const coachesCount = coaches.length;
  const todayAtt = coachAttendance.filter(a => a.attendanceDate === attendanceDate);
  const presentToday = todayAtt.filter(a => ['PRESENT', 'TRAINING_DUTY', 'TOURNAMENT_DUTY'].includes(a.status)).length;
  const absentToday = todayAtt.filter(a => a.status === 'ABSENT').length;
  const onLeaveToday = todayAtt.filter(a => ['LEAVE', 'MEDICAL_LEAVE'].includes(a.status)).length;
  const lateToday = todayAtt.filter(a => a.status === 'LATE').length;
  const halfDayToday = todayAtt.filter(a => a.status === 'HALF_DAY').length;
  const monthAtt = coachAttendance.filter(a => a.attendanceDate.startsWith(selectedMonth));
  const monthPresent = monthAtt.filter(a => ['PRESENT', 'TRAINING_DUTY', 'TOURNAMENT_DUTY', 'LATE', 'HALF_DAY'].includes(a.status)).length;
  const coachAttendancePct = monthAtt.length > 0 ? Math.round((monthPresent / monthAtt.length) * 100) : 100;

  // Real Database-driven chart builders
  const getEnrollmentGrowthData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const counts: Record<string, number> = {};
    months.forEach(m => { counts[m] = 0; });
    enrollments.filter(e => e.status === 'APPROVED').forEach(e => {
      if (e.enrollDate) {
        const m = months[new Date(e.enrollDate).getMonth()];
        counts[m]++;
      }
    });
    let cumulative = 0;
    return months.map(m => {
      cumulative += counts[m];
      return { name: m, count: cumulative };
    });
  };

  const getSportsDistributionData = () => {
    const counts: Record<string, number> = { 'Team Sports': 0, 'Individual': 0, 'Indoor': 0, 'Outdoor': 0 };
    sports.forEach(s => {
      if (s.format === 'TEAM') counts['Team Sports']++;
      else counts['Individual']++;
      if (s.type === 'INDOOR') counts['Indoor']++;
      else counts['Outdoor']++;
    });
    return Object.keys(counts).map(k => ({ name: k, value: counts[k] }));
  };

  const getAttendanceTrendData = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const rates = months.map(m => {
      const filtered = coachAttendance.filter(a => {
        const date = new Date(a.attendanceDate);
        return months[date.getMonth()] === m;
      });
      if (filtered.length === 0) return { name: m, rate: 85 }; // fallback logic to prevent empty area
      const present = filtered.filter(a => ['PRESENT', 'TRAINING_DUTY', 'TOURNAMENT_DUTY', 'LATE'].includes(a.status)).length;
      return { name: m, rate: Math.round((present / filtered.length) * 100) };
    });
    return rates;
  };

  const getBudgetVSExpenseData = () => {
    return budgets.map(b => {
      const expensesForCat = expenses
        .filter(e => e.status === 'APPROVED' && e.category === (b.category === 'EQUIPMENT' ? 'EQUIPMENT_PURCHASE' : b.category === 'TOURNAMENT' ? 'TOURNAMENT_EXPENSE' : 'OTHER'))
        .reduce((sum, e) => sum + (e.amountApproved || 0), 0);
      return {
        name: b.category,
        Budget: b.allocatedAmount,
        Spent: expensesForCat
      };
    });
  };

  // Specific Radar data for active student or average performance
  const getRadarChartData = () => {
    if (studentProfileId) {
      const metric = performance.find(p => p.studentId === studentProfileId);
      if (metric) {
        return [
          { subject: 'Speed', A: metric.speed, fullMark: 100 },
          { subject: 'Stamina', A: metric.stamina, fullMark: 100 },
          { subject: 'Strength', A: metric.strength, fullMark: 100 },
          { subject: 'Agility', A: metric.agility, fullMark: 100 },
          { subject: 'Teamwork', A: metric.teamwork, fullMark: 100 }
        ];
      }
    }
    // Calculate average scores across the school for admin radar chart
    if (performance.length > 0) {
      const avg = (field: string) => Math.round(performance.reduce((sum, p) => sum + (p[field] || 80), 0) / performance.length);
      return [
        { subject: 'Speed', A: avg('speed'), fullMark: 100 },
        { subject: 'Stamina', A: avg('stamina'), fullMark: 100 },
        { subject: 'Strength', A: avg('strength'), fullMark: 100 },
        { subject: 'Agility', A: avg('agility'), fullMark: 100 },
        { subject: 'Teamwork', A: avg('teamwork'), fullMark: 100 }
      ];
    }
    return [
      { subject: 'Speed', A: 80, fullMark: 100 },
      { subject: 'Stamina', A: 80, fullMark: 100 },
      { subject: 'Strength', A: 80, fullMark: 100 },
      { subject: 'Agility', A: 80, fullMark: 100 },
      { subject: 'Teamwork', A: 80, fullMark: 100 }
    ];
  };

  // Chart render safety validation booleans
  const enrollmentGrowthData = getEnrollmentGrowthData();
  const hasEnrollmentGrowthData = enrollmentGrowthData && enrollmentGrowthData.some(d => d.count > 0);

  const sportsDistributionData = getSportsDistributionData();
  const hasSportsDistributionData = sportsDistributionData && sportsDistributionData.some(d => d.value > 0);

  const budgetVSExpenseData = getBudgetVSExpenseData();
  const hasBudgetVSExpenseData = budgetVSExpenseData && budgetVSExpenseData.some(d => d.Budget > 0 || d.Spent > 0);

  const attendanceTrendData = getAttendanceTrendData();
  const hasAttendanceTrendData = coachAttendance && coachAttendance.length > 0;

  const radarChartData = getRadarChartData();
  const hasRadarChartData = performance && performance.length > 0;

  const hasRevenueData = totalRevenue > 0 || pendingRevenue > 0 || totalOutstanding > 0;

  // Live reporting files builder / exporter
  const generateReportString = (type: string, format: 'CSV' | 'EXCEL'): string => {
    let headers: string[] = [];
    let rows: string[][] = [];

    switch (type) {
      case 'enrollment':
        headers = ['Student Name', 'Sport', 'Enroll Date', 'Status'];
        rows = enrollments.map(e => [e.studentName || '', e.sportName || '', e.enrollDate || '', e.status || '']);
        break;
      case 'attendance':
        headers = ['Coach Name', 'Date', 'Status', 'Check In', 'Check Out', 'Working Hours', 'Remarks'];
        rows = coachAttendance.map(a => [a.coachName || '', a.attendanceDate || '', a.status || '', a.checkIn || '', a.checkOut || '', String(a.workingHours || 0), a.remarks || '']);
        break;
      case 'leaves':
        headers = ['Coach Name', 'Start Date', 'End Date', 'Leave Type', 'Status', 'Reason'];
        rows = coachLeaves.map(l => [l.coachName || '', l.startDate || '', l.endDate || '', l.leaveType || '', l.status || '', l.reason || '']);
        break;
      case 'payroll':
        headers = ['Employee Name', 'Role', 'Month', 'Base Amount', 'Bonus', 'Deductions', 'Status', 'Transaction ID'];
        rows = salaryRecords.map(s => [s.employeeName || '', s.employeeType || '', s.salaryMonth || '', String(s.grossSalary), String(s.bonus), String(s.deductions), s.status, s.transactionId || '']);
        break;
      case 'equipment':
        headers = ['Category', 'Title', 'Amount Requested', 'Amount Approved', 'Status', 'Vendor', 'Invoice Number', 'Payment Status'];
        rows = expenses.map(e => [e.category, e.title, String(e.amountRequested), String(e.amountApproved || 0), e.status, e.vendor || '', e.invoiceNumber || '', e.paymentStatus]);
        break;
      case 'revenue':
        headers = ['Type', 'Category', 'Amount', 'Date', 'Status', 'Remarks'];
        rows = feePayments.map(p => ['REVENUE', p.feeType || 'FEE_PAYMENT', String(p.amountPaid), p.paymentDate, p.status, p.utrNumber || '']);
        break;
    }
    if (format === 'CSV') {
      const csvContent = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
      return csvContent;
    } else {
      // Basic Excel XML Spreadsheet structure or Tab separated
      const tsvContent = [headers.join('\t'), ...rows.map(r => r.map(v => String(v ?? '')).join('\t'))].join('\n');
      return tsvContent;
    }
  };

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportReport = (type: string, format: 'CSV' | 'EXCEL' | 'PDF') => {
    const filename = `Sports_Report_${type}_${new Date().toISOString().split('T')[0]}`;
    
    if (format === 'PDF') {
      const doc = new jsPDF();
      doc.setFillColor(15, 23, 42); // slate-900 background banner
      doc.rect(0, 0, 210, 30, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(16);
      doc.text(`AEGIS ERP — ${type.toUpperCase()} ENTERPRISE REPORT`, 15, 20);
      
      doc.setTextColor(51, 65, 85);
      doc.setFontSize(9);
      doc.text(`Generated on: ${new Date().toLocaleString()} | Tenant School isolated logs.`, 15, 40);
      
      let y = 50;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      
      let reportString = generateReportString(type, 'CSV');
      let lines = reportString.split('\n');
      let headers = lines[0].split(',');
      
      // Draw Table Headers
      let x = 15;
      headers.forEach(h => {
        doc.text(h.replace(/"/g, ''), x, y);
        x += 30;
      });
      y += 8;
      
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i]) continue;
        x = 15;
        let cols = lines[i].split(',');
        cols.forEach(c => {
          doc.text(c.replace(/"/g, ''), x, y);
          x += 30;
        });
        y += 6;
        if (y > 280) {
          doc.addPage();
          y = 20;
        }
      }
      
      doc.save(`${filename}.pdf`);
    } else if (format === 'CSV') {
      const csv = generateReportString(type, 'CSV');
      triggerDownload(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
    } else {
      const xls = generateReportString(type, 'EXCEL');
      triggerDownload(xls, `${filename}.xls`, 'application/vnd.ms-excel;charset=utf-8;');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="text-xs font-semibold font-mono tracking-wider animate-pulse">LOADING SECURE SPORTS GATEWAY...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-100px)] text-slate-300">
      
      {/* ─────────────────────────────────────────────────────────────────
          SPORTS MODULE SUB-SIDEBAR (MATCHING IMAGES)
          ───────────────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-[#070a13]/85 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2.5 py-2 bg-brand-500/10 border border-brand-500/20 rounded-xl">
            <Trophy className="text-brand-400" size={20} />
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-widest leading-none">AEGIS SPORTS</p>
              <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
                {portalRole === 'STUDENT' && 'Student Portal'}
                {portalRole === 'PARENT' && 'Parent Portal'}
                {portalRole === 'COACH' && 'Coach Portal'}
                {portalRole === 'TEACHER' && 'Sports Teacher'}
                {portalRole === 'SCHOOL_ADMIN' && 'Admin Console'}
                {portalRole === 'SPORTS_ADMIN' && 'Sports Admin'}
                {portalRole === 'FINANCE_ADMIN' && 'Finance Portal'}
                {portalRole === 'SUPER_ADMIN' && 'Super Admin'}
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Sports Dashboard', icon: Trophy, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'registry', label: 'Sports Registry', icon: Settings, roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'coaches', label: 'Coach Directory', icon: Users, roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'coach-attendance', label: 'Coach Attendance', icon: Clock, roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN', 'COACH', 'FINANCE_ADMIN'] },
              { id: 'enrollment', label: 'Sports Enrollment', icon: ChevronRight, roles: ['STUDENT', 'PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'teams', label: 'Teams & Groups', icon: Users, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'schedule', label: 'Training Schedule', icon: Calendar, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'attendance', label: 'Athlete Attendance', icon: Activity, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'tournaments', label: 'Tournaments Engine', icon: Trophy, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'achievements', label: 'Achievements', icon: Award, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'certificates', label: 'Certificates Center', icon: FileText, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'performance', label: 'Athlete Performance', icon: BarChart3, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'medical', label: 'Medical Fitness', icon: Heart, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'equipment', label: 'Equipment Inventory', icon: Package, roles: ['COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'finance', label: 'Finance Control', icon: DollarSign, roles: ['FINANCE_ADMIN', 'SUPER_ADMIN', 'SCHOOL_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'fees', label: 'Sports Invoices', icon: DollarSign, roles: ['STUDENT', 'PARENT', 'SPORTS_ADMIN', 'FINANCE_ADMIN', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'reports', label: 'Reports & Analytics', icon: FileText, roles: ['SCHOOL_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] },
              { id: 'audit-logs', label: 'Audit Logs', icon: ShieldCheck, roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN', 'SPORTS_ADMIN'] }
            ].map(tab => {
              if (!tab.roles.includes(portalRole)) return null;
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold tracking-wide transition-all active:scale-[0.98] ${
                    isActive 
                      ? 'bg-brand-600/10 border border-brand-500/20 text-brand-400 font-bold shadow-lg shadow-brand-500/5' 
                      : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/40'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-brand-500' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-3 bg-slate-950/40 border border-slate-800 rounded-xl text-center">
          <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase leading-none">Status</p>
          <p className="text-[10px] font-mono text-emerald-400 mt-1 flex items-center justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> Live Database Sync
          </p>
        </div>
      </aside>

      {/* ─────────────────────────────────────────────────────────────────
          CONTENT VIEWPORT
          ───────────────────────────────────────────────────────────────── */}
      <section className="flex-1 space-y-6">
        
        {/* Top Header Banner */}
        <div className="flex items-center justify-between bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div>
            <h1 className="text-xl font-extrabold text-white leading-tight font-sans tracking-wide">
              {activeSubTab === 'dashboard' && 'Sports & Activities Overview'}
              {activeSubTab === 'registry' && 'Sports Registry & Setup'}
              {activeSubTab === 'coaches' && 'Coach Directory'}
              {activeSubTab === 'coach-attendance' && 'Coach Attendance & Corrections'}
              {activeSubTab === 'enrollment' && 'Sports Enrollment Center'}
              {activeSubTab === 'teams' && 'Teams & Roster Groups'}
              {activeSubTab === 'schedule' && 'Training & Practice Schedules'}
              {activeSubTab === 'attendance' && 'Sports Attendance Tracker'}
              {activeSubTab === 'tournaments' && 'Tournament Bracket & Results'}
              {activeSubTab === 'achievements' && 'Medals & Accomplishments'}
              {activeSubTab === 'certificates' && 'Verification Certificate Center'}
              {activeSubTab === 'performance' && 'Individual Athletic Analytics'}
              {activeSubTab === 'medical' && 'Medical Fitness Profile'}
              {activeSubTab === 'equipment' && 'Inventory Checkout & Logs'}
              {activeSubTab === 'finance' && 'Sports Finance Control'}
              {activeSubTab === 'fees' && 'Sports Fee Operations'}
              {activeSubTab === 'reports' && 'Reports & CSV / PDF Export'}
              {activeSubTab === 'audit-logs' && 'Central Audit Trail'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              AEGIS Cloud Sports Hub — School isolated dynamic registry.
            </p>
          </div>
          
          <div className="flex gap-3">
            {portalRole === 'PARENT' && parentLinkedStudents.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-400 font-mono">Linked Student:</label>
                <select
                  value={studentProfileId}
                  onChange={(e) => {
                    const newId = e.target.value;
                    setStudentProfileId(newId);
                    loadData(true, newId);
                  }}
                  style={{ backgroundColor: '#0b101d', color: '#ffffff', borderColor: '#1e293b' }}
                  className="px-3 py-2 border rounded-xl text-xs text-white focus:outline-none focus:border-brand-500 [&>option]:bg-[#0b101d] [&>option]:text-white"
                >
                  {parentLinkedStudents.map(std => (
                    <option key={std.id} value={std.id} style={{ backgroundColor: '#0b101d', color: '#ffffff' }}>
                      {std.users ? `${std.users.first_name} ${std.users.last_name}` : 'Unknown student'}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button 
              onClick={() => { setRefreshing(true); loadData(); }} 
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-slate-400 hover:text-white"
              title="Refresh Live Data"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {['SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && activeSubTab === 'registry' && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowAddSportsAdmin(true)} 
                  className="flex items-center gap-2 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl transition-all"
                >
                  <Plus size={15} /> Create Sports Admin
                </button>
                <button 
                  onClick={() => setShowAddSport(true)} 
                  className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
                >
                  <Plus size={15} /> Add New Sport
                </button>
              </div>
            )}

            {['SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && activeSubTab === 'coaches' && (
              <button 
                onClick={() => setShowAddCoach(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
              >
                <Plus size={15} /> Register Coach
              </button>
            )}

            {['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && activeSubTab === 'registry' && portalRole === 'SPORTS_ADMIN' && (
              <button 
                onClick={() => setShowAddSport(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
              >
                <Plus size={15} /> Add New Sport
              </button>
            )}

            {['SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && activeSubTab === 'teams' && (
              <button 
                onClick={() => setShowCreateTeam(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
              >
                <Plus size={15} /> Create Team
              </button>
            )}

            {['COACH', 'SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && activeSubTab === 'schedule' && (
              <button 
                onClick={() => setShowSchedulePractice(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
              >
                <Plus size={15} /> Schedule Training
              </button>
            )}

            {['COACH'].includes(portalRole) && activeSubTab === 'coach-attendance' && (
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowApplyLeave(true)} 
                  className="flex items-center gap-2 bg-slate-900 border border-slate-800 text-slate-300 font-bold text-xs px-4 py-2.5 rounded-xl"
                >
                  Apply Leave
                </button>
                <button 
                  onClick={() => setShowRequestCorrection(true)} 
                  className="flex items-center gap-2 bg-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md"
                >
                  Request Correction
                </button>
              </div>
            )}

            {['SPORTS_ADMIN'].includes(portalRole) && activeSubTab === 'equipment' && (
              <button 
                onClick={() => setShowRequestExpense(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20"
              >
                <Plus size={15} /> Request Purchase
              </button>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            1. SPORTS DASHBOARD TAB (REAL LIVE DATA)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Active Sports</p>
                <p className="text-2xl font-extrabold text-white mt-1">{activeSportsCount}</p>
                <p className="text-[10px] text-brand-400 font-bold mt-2">Dynamic registry</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Active Athletes</p>
                <p className="text-2xl font-extrabold text-white mt-1">{approvedEnrollmentsCount}</p>
                <p className="text-[10px] text-emerald-400 font-bold mt-2">+{pendingEnrollmentsCount} pending request</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Active Coaches</p>
                <p className="text-2xl font-extrabold text-white mt-1">{coachesCount}</p>
                <p className="text-[10px] text-brand-400 font-bold mt-2">{coaches.filter(c => c.status === 'ACTIVE').length} active profiles</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Practice Sessions</p>
                <p className="text-2xl font-extrabold text-white mt-1">{sessions.filter(s => s.status === 'SCHEDULED').length}</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-2">Scheduled logs</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Achievements</p>
                <p className="text-2xl font-extrabold text-white mt-1">{achievements.length}</p>
                <p className="text-[10px] text-brand-400 font-bold mt-2">Total medals recorded</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Sports Revenue</p>
                <p className="text-2xl font-extrabold text-emerald-400 mt-1">₹{totalRevenue.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400 font-bold mt-2">Fees + Paid Fines</p>
              </div>
            </div>

            {/* Visual Charts & Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chart 1: Enrollment Growth Line Chart */}
              <div className="lg:col-span-2 bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Active Student Enrollment Growth</h3>
                  <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">Live SQL records</span>
                </div>
                <div className="h-64">
                  {hasEnrollmentGrowthData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={enrollmentGrowthData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '12px' }} labelStyle={{ fontSize: '11px', color: '#fff' }} itemStyle={{ fontSize: '11px' }} />
                        <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} dot={{ stroke: '#3b82f6', strokeWidth: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                      <BarChart3 size={24} className="text-slate-600 animate-pulse" />
                      <span>No Student Enrollments Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 2: Sports Distribution Pie Chart */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Sports Distribution</h3>
                <div className="h-64 flex items-center justify-center">
                  {hasSportsDistributionData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sportsDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#10b981" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '9px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                      <BarChart3 size={24} className="text-slate-600 animate-pulse" />
                      <span>No Sports Distribution Records Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 3: Budget vs Spent Bar Chart */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Category Budget vs Real Expense</h3>
                <div className="h-64">
                  {hasBudgetVSExpenseData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={budgetVSExpenseData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                        <YAxis stroke="#94a3b8" fontSize={9} />
                        <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b' }} />
                        <Legend wrapperStyle={{ fontSize: '9px' }} />
                        <Bar dataKey="Budget" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="Spent" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                      <BarChart3 size={24} className="text-slate-600 animate-pulse" />
                      <span>No Financial Records Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 4: Attendance Rate Progression Area Chart */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Monthly Coach Attendance Rate</h3>
                <div className="h-64">
                  {hasAttendanceTrendData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={attendanceTrendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} />
                        <YAxis stroke="#94a3b8" fontSize={9} domain={[0, 100]} />
                        <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b' }} />
                        <Area type="monotone" dataKey="rate" stroke="#10b981" fill="#10b981" fillOpacity={0.15} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                      <BarChart3 size={24} className="text-slate-600 animate-pulse" />
                      <span>No Coach Attendance Records Available</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart 5: Performance Radar Chart */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Athletic Ability Profile</h3>
                <div className="h-64 flex items-center justify-center">
                  {hasRadarChartData ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarChartData}>
                        <PolarGrid stroke="#1e293b" />
                        <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={10} />
                        <PolarRadiusAxis stroke="#1e293b" fontSize={8} />
                        <Radar name="Student Fitness" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                        <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2">
                      <BarChart3 size={24} className="text-slate-600 animate-pulse" />
                      <span>No Athletic Ability Profile Available</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Split Panel: Recent Activity & Invoices */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Upcoming Trainings */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Upcoming Practice Schedules</h3>
                <div className="space-y-3">
                  {sessions.slice(0, 3).map(sess => (
                    <div key={sess.id} className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-850 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex flex-col items-center justify-center text-brand-400">
                          <Calendar size={18} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-100">{sess.sessionName}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">{sess.sportName} • {sess.venue}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">
                        {sess.startTime}
                      </span>
                    </div>
                  ))}
                  {sessions.length === 0 && <p className="text-xs text-slate-500 py-6 text-center">No scheduled events found.</p>}
                </div>
              </div>

              {/* Finance Collections */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Sports Invoices & Dues</h3>
                <div className="flex items-center gap-6 p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                  <div className="w-24 h-24 flex items-center justify-center">
                    {hasRevenueData ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Collected', value: totalRevenue },
                              { name: 'Pending Approval', value: pendingRevenue },
                              { name: 'Outstanding', value: totalOutstanding }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={35}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#f59e0b" />
                            <Cell fill="#ef4444" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-slate-600 text-[10px] text-center font-bold font-mono">
                        NO DATA
                      </div>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Total Collected:</span>
                      <span className="font-bold text-emerald-400">₹{totalRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Pending Approvals:</span>
                      <span className="font-bold text-amber-500">₹{pendingRevenue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Outstanding Dues:</span>
                      <span className="font-bold text-red-400">₹{totalOutstanding.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            2. SPORTS REGISTRY (CRUD FOR ADMIN & SPORTS ADMIN)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'registry' && (
          <div className="space-y-6">
            
            {/* Sports Admins Section (School Admin ONLY) */}
            {portalRole === 'SCHOOL_ADMIN' && (
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Registered Sports Admins</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Name</th>
                        <th className="py-3 px-4 font-bold">Employee ID</th>
                        <th className="py-3 px-4 font-bold">Email</th>
                        <th className="py-3 px-4 font-bold">Mobile</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {sportsAdmins.map(admin => (
                        <tr key={admin.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-semibold text-slate-100">{admin.fullName}</td>
                          <td className="py-3 px-4 font-mono text-brand-400">{admin.employeeId || 'N/A'}</td>
                          <td className="py-3 px-4 text-slate-400">{admin.email}</td>
                          <td className="py-3 px-4 text-slate-400">{admin.mobile || 'N/A'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              admin.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>{admin.status}</span>
                          </td>
                          <td className="py-3 px-4 flex gap-2">
                            <button 
                              onClick={async () => {
                                const active = admin.status === 'ACTIVE';
                                await mockApi.deactivateSportsAdmin(userId, admin.id, !active);
                                loadData(true);
                              }}
                              className="text-[10px] font-bold bg-slate-850 px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
                            >
                              Toggle
                            </button>
                            <button 
                              onClick={async () => {
                                const pass = prompt('Enter secure new password:');
                                if (pass) {
                                  await mockApi.resetSportsAdminPassword(userId, admin.id, pass);
                                  alert('Password reset completed!');
                                }
                              }}
                              className="text-[10px] font-bold bg-brand-500/10 text-brand-400 px-2 py-1 rounded border border-brand-500/25 hover:bg-brand-500 hover:text-white"
                            >
                              Reset Pass
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sports registry */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Registered Sports & Formats</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Sport Name</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Type</th>
                      <th className="py-3 px-4 font-bold">Format</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {sports.map(sport => (
                      <tr key={sport.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{sport.name}</td>
                        <td className="py-3 px-4 text-slate-400">{sport.categoryName}</td>
                        <td className="py-3 px-4 text-slate-400">{sport.type}</td>
                        <td className="py-3 px-4 text-slate-400">{sport.format}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sport.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>{sport.status}</span>
                        </td>
                        <td className="py-3 px-4">
                          <button 
                            onClick={async () => {
                              const active = sport.status === 'ACTIVE';
                              await mockApi.updateSport(sport.id, { status: active ? 'INACTIVE' : 'ACTIVE' });
                              loadData(true);
                            }}
                            className="text-[10px] font-bold bg-slate-850 px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
                          >
                            Toggle
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            3. COACH DIRECTORY (CRUD FOR ADMIN & SPORTS ADMIN)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'coaches' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Coach Profile Directory</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {coaches.map(coach => (
                <div key={coach.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-100 text-sm">{coach.coachName}</h4>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        coach.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>{coach.status}</span>
                    </div>
                    <p className="text-[11px] text-brand-400 mt-1">Specialization: {coach.specialization}</p>
                    <p className="text-xs text-slate-400 mt-3 leading-relaxed">Experience: {coach.experienceYears} Years</p>
                    <p className="text-xs text-slate-400 leading-relaxed">Certification: {coach.certification || 'None'}</p>
                    <p className="text-xs font-bold text-slate-200 mt-2">Base Salary: ₹{coach.salary.toLocaleString()}</p>
                  </div>
                  
                  <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
                    <button 
                      onClick={async () => {
                        const next = coach.status === 'ACTIVE';
                        await mockApi.deactivateSportsCoach(userId, coach.id, !next);
                        loadData(true);
                      }}
                      className="text-[10px] font-bold bg-slate-800 px-3 py-1.5 rounded border border-slate-700 text-slate-300"
                    >
                      Toggle Active
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          if (confirm("Are you sure you want to delete this coach?")) {
                            await mockApi.deleteSportsCoach(coach.id);
                            loadData(true);
                          }
                        } catch (err: any) {
                          alert(err.message || "Cannot delete this record because related records exist.");
                        }
                      }}
                      className="text-[10px] font-bold bg-red-600/10 text-red-400 px-3 py-1.5 rounded border border-red-500/25 hover:bg-red-500 hover:text-white"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            4. COACH ATTENDANCE MANAGEMENT (NEW COMPLEX FEATURE)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'coach-attendance' && (
          <div className="space-y-6">
            
            {/* Coach stats row */}
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Coaches</p>
                <p className="text-xl font-extrabold text-white mt-1">{coachesCount}</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Present Today</p>
                <p className="text-xl font-extrabold text-emerald-400 mt-1">{presentToday}</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Absent Today</p>
                <p className="text-xl font-extrabold text-red-400 mt-1">{absentToday}</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">On Leave</p>
                <p className="text-xl font-extrabold text-amber-500 mt-1">{onLeaveToday}</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Late Arrivals</p>
                <p className="text-xl font-extrabold text-slate-350 mt-1">{lateToday}</p>
              </div>
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Monthly Rate</p>
                <p className="text-xl font-extrabold text-brand-400 mt-1">{coachAttendancePct}%</p>
              </div>
            </div>

            {/* View selectors */}
            <div className="flex gap-4 items-center bg-[#0b101d]/60 border border-slate-800 p-4 rounded-xl">
              <div className="flex gap-2">
                <label className="text-xs font-semibold self-center">Filter Date:</label>
                <input 
                  type="date" 
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl"
                />
              </div>
              
              <div className="flex gap-2">
                <label className="text-xs font-semibold self-center">Filter Month:</label>
                <input 
                  type="month" 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-xl"
                />
              </div>
            </div>

            {/* Attendance Roster Grid (Sports Admin / School Admin ONLY) */}
            {['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Mark Coach Daily Attendance ({attendanceDate})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Coach Name</th>
                        <th className="py-3 px-4 font-bold">Attendance Status</th>
                        <th className="py-3 px-4 font-bold">Check In Time</th>
                        <th className="py-3 px-4 font-bold">Check Out Time</th>
                        <th className="py-3 px-4 font-bold">Working Hours</th>
                        <th className="py-3 px-4 font-bold">Remarks</th>
                        <th className="py-3 px-4 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {coaches.map(coach => {
                        const existingAtt = coachAttendance.find(a => a.coachId === coach.id && a.attendanceDate === attendanceDate);
                        
                        // Component-level edits dictionary access (prevents useState in loops)
                        const edits = attendanceEdits[coach.id] || {};
                        const status = edits.status !== undefined ? edits.status : (existingAtt?.status || 'PRESENT');
                        const checkIn = edits.checkIn !== undefined ? edits.checkIn : (existingAtt?.checkIn || '09:00');
                        const checkOut = edits.checkOut !== undefined ? edits.checkOut : (existingAtt?.checkOut || '17:00');
                        const remarks = edits.remarks !== undefined ? edits.remarks : (existingAtt?.remarks || '');
                        const editReason = edits.editReason || '';

                        let workingHours = 0;
                        if (checkIn && checkOut) {
                          const [inH, inM] = checkIn.split(':').map(Number);
                          const [outH, outM] = checkOut.split(':').map(Number);
                          workingHours = (outH + outM / 60) - (inH + inM / 60);
                          if (workingHours < 0) workingHours += 24;
                        }

                        const updateField = (field: string, val: string) => {
                          setAttendanceEdits(prev => ({
                            ...prev,
                            [coach.id]: {
                              ...prev[coach.id] || {
                                status: existingAtt?.status || 'PRESENT',
                                checkIn: existingAtt?.checkIn || '09:00',
                                checkOut: existingAtt?.checkOut || '17:00',
                                remarks: existingAtt?.remarks || '',
                                editReason: ''
                              },
                              [field]: val
                            }
                          }));
                        };

                        return (
                          <tr key={coach.id} className="hover:bg-slate-900/40">
                            <td className="py-3 px-4 font-semibold text-slate-100">
                              <div>{coach.coachName}</div>
                              {existingAtt && existingAtt.attendanceSource && (
                                <div className="text-[10px] text-slate-400 mt-1 space-y-0.5 font-mono">
                                  <span className="inline-block bg-slate-800/80 px-1 py-0.5 rounded text-[9px] font-bold text-brand-350">{existingAtt.attendanceSource}</span>
                                  {existingAtt.deviceId && <span className="block text-slate-500">Device: {existingAtt.deviceId}</span>}
                                  {existingAtt.ipAddress && <span className="block text-slate-500">IP: {existingAtt.ipAddress}</span>}
                                  {existingAtt.latitude !== null && existingAtt.longitude !== null && (
                                    <span className="block text-slate-500">GPS: {existingAtt.latitude?.toFixed(4)}, {existingAtt.longitude?.toFixed(4)}</span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <select 
                                value={status}
                                onChange={(e) => updateField('status', e.target.value)}
                                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                              >
                                <option value="PRESENT">Present</option>
                                <option value="ABSENT">Absent</option>
                                <option value="LATE">Late</option>
                                <option value="HALF_DAY">Half Day</option>
                                <option value="LEAVE">Leave</option>
                                <option value="TRAINING_DUTY">Training Duty</option>
                                <option value="TOURNAMENT_DUTY">Tournament Duty</option>
                                <option value="MEDICAL_LEAVE">Medical Leave</option>
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <input 
                                type="time"
                                value={checkIn}
                                onChange={(e) => updateField('checkIn', e.target.value)}
                                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                              />
                            </td>
                            <td className="py-3 px-4">
                              <input 
                                type="time"
                                value={checkOut}
                                onChange={(e) => updateField('checkOut', e.target.value)}
                                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                              />
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-slate-200">
                              {workingHours.toFixed(2)} Hrs
                            </td>
                            <td className="py-3 px-4">
                              <input 
                                type="text"
                                value={remarks}
                                onChange={(e) => updateField('remarks', e.target.value)}
                                placeholder="Add notes..."
                                className="px-2 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs w-full font-sans"
                              />
                              {existingAtt && (
                                <input 
                                  type="text"
                                  value={editReason}
                                  onChange={(e) => updateField('editReason', e.target.value)}
                                  placeholder="Reason for edit"
                                  className="mt-1 px-2 py-1 bg-amber-950/20 border border-amber-900/60 rounded text-[9px] text-amber-200 block w-full placeholder-amber-700 font-mono"
                                />
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex gap-2">
                                <button 
                                  onClick={async () => {
                                    if (existingAtt && !editReason.trim()) {
                                      alert('Please provide a reason for editing this existing attendance log.');
                                      return;
                                    }
                                    try {
                                      await mockApi.markCoachAttendance(userId, {
                                        coachId: coach.id,
                                        attendanceDate,
                                        status,
                                        checkIn,
                                        checkOut,
                                        workingHours,
                                        remarks,
                                        editReason: existingAtt ? editReason.trim() : undefined
                                      });
                                      alert('Daily Attendance logged!');
                                      // Clear editReason
                                      updateField('editReason', '');
                                      loadData(true);
                                    } catch (err: any) {
                                      alert(`Error: ${err.message}`);
                                    }
                                  }}
                                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold rounded-lg transition-all"
                                >
                                  Save Log
                                </button>
                                {existingAtt && (
                                  <button
                                    onClick={async () => {
                                      const reason = prompt("Enter reason for soft deleting this attendance record:");
                                      if (!reason) return;
                                      try {
                                        await mockApi.softDeleteCoachAttendance(userId, existingAtt.id, reason);
                                        alert("Attendance record soft deleted successfully!");
                                        loadData(true);
                                      } catch (err: any) {
                                        alert(`Error: ${err.message}`);
                                      }
                                    }}
                                    className="p-1.5 bg-red-950/60 border border-red-900 text-red-400 hover:text-red-300 rounded-lg transition-all"
                                    title="Soft Delete Record"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Corrections & Leave Approval Queues (Sports Admin ONLY) */}
            {['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Corrections Queue */}
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Correction Approval Queue</h3>
                  <div className="space-y-3">
                    {attendanceCorrections.filter(c => c.status === 'PENDING').map(corr => (
                      <div key={corr.id} className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-slate-100 text-xs">{corr.coachName}</h4>
                          <span className="text-[9px] font-mono text-brand-400">Date: {corr.attendanceDate}</span>
                        </div>
                        <p className="text-xs text-slate-400">Requested: {corr.requestedStatus} ({corr.requestedCheckIn} - {corr.requestedCheckOut})</p>
                        <p className="text-[11px] text-slate-500 italic">"Reason: {corr.reason}"</p>
                        
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                          <button 
                            onClick={async () => {
                              await mockApi.approveAttendanceCorrection(userId, corr.id, 'APPROVED');
                              loadData(true);
                            }}
                            className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg hover:bg-emerald-500 hover:text-white"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={async () => {
                              await mockApi.approveAttendanceCorrection(userId, corr.id, 'REJECTED');
                              loadData(true);
                            }}
                            className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold rounded-lg hover:bg-red-500 hover:text-white"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                    {attendanceCorrections.filter(c => c.status === 'PENDING').length === 0 && (
                      <p className="text-xs text-slate-500 py-6 text-center">No correction requests pending.</p>
                    )}
                  </div>
                </div>

                {/* Leaves Queue */}
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Coach Leave Approvals</h3>
                  <div className="space-y-3">
                    {coachLeaves.filter(l => l.status === 'PENDING').map(leave => (
                      <div key={leave.id} className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="font-bold text-slate-100 text-xs">{leave.coachName}</h4>
                          <span className="text-[9px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">{leave.leaveType}</span>
                        </div>
                        <p className="text-xs text-slate-400">Duration: {leave.startDate} to {leave.endDate}</p>
                        <p className="text-[11px] text-slate-500 italic">"Reason: {leave.reason}"</p>
                        
                        <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                          <button 
                            onClick={async () => {
                              await mockApi.approveCoachLeave(userId, leave.id, 'APPROVED');
                              loadData(true);
                            }}
                            className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-lg hover:bg-emerald-500 hover:text-white"
                          >
                            Approve
                          </button>
                          <button 
                            onClick={async () => {
                              await mockApi.approveCoachLeave(userId, leave.id, 'REJECTED');
                              loadData(true);
                            }}
                            className="px-3 py-1 bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold rounded-lg hover:bg-red-500 hover:text-white"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                    {coachLeaves.filter(l => l.status === 'PENDING').length === 0 && (
                      <p className="text-xs text-slate-500 py-6 text-center">No leave requests pending.</p>
                    )}
                  </div>
                </div>

                {/* Biometric / Device Attendance Check-In Simulator */}
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 lg:col-span-2">
                  <div className="flex justify-between items-center">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                      <Clock className="w-4 h-4 text-brand-450" />
                      Coach Multiple-Session Biometric/Device Simulator
                    </h3>
                    <button 
                      onClick={() => setShowCheckInSimulator(!showCheckInSimulator)}
                      className="text-[10px] bg-slate-900 border border-slate-800 text-slate-350 hover:text-white px-2.5 py-1 rounded-lg transition-all"
                    >
                      {showCheckInSimulator ? 'Hide Simulator' : 'Show Simulator'}
                    </button>
                  </div>
                  
                  {showCheckInSimulator && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-slate-900/50 border border-slate-850 rounded-xl">
                      <div className="space-y-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">1. Select Coach & Session</label>
                        <select 
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                          onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, coachId: e.target.value }))}
                          value={simulatedCheckIn.coachId || ''}
                        >
                          <option value="">-- Choose Coach --</option>
                          {coaches.map(c => (
                            <option key={c.id} value={c.id}>{c.coachName}</option>
                          ))}
                        </select>
                        
                        <input 
                          type="text"
                          placeholder="Session Name (e.g. Cricket Training)"
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                          value={simulatedCheckIn.sessionName}
                          onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, sessionName: e.target.value }))}
                        />
                        
                        <div className="space-y-1">
                          <span className="text-[9px] text-slate-500 font-mono">Simulated Work Date</span>
                          <input 
                            type="date"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-400 opacity-60"
                            value={attendanceDate}
                            disabled
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">2. Biometric/Source Method</label>
                        <select 
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                          value={simulatedCheckIn.attendanceSource}
                          onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, attendanceSource: e.target.value as any }))}
                        >
                          <option value="BIOMETRIC">Fingerprint Biometric Scanner</option>
                          <option value="FACE_RECOGNITION">Face Recognition Terminal</option>
                          <option value="QR_CODE">QR Code Standee Scan</option>
                          <option value="MOBILE_GPS">Mobile GPS Geo-Fenced Check-In</option>
                          <option value="MANUAL">Manual Administrator Log</option>
                        </select>

                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="text"
                            placeholder="Device ID (e.g. BIO-T4)"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-200 font-mono"
                            value={simulatedCheckIn.deviceId}
                            onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, deviceId: e.target.value }))}
                          />
                          <input 
                            type="text"
                            placeholder="IP Address (e.g. 192.168.1.100)"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-200 font-mono"
                            value={simulatedCheckIn.ipAddress}
                            onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, ipAddress: e.target.value }))}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <input 
                            type="number"
                            step="any"
                            placeholder="Latitude"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-200 font-mono"
                            value={simulatedCheckIn.latitude}
                            onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, latitude: Number(e.target.value) }))}
                          />
                          <input 
                            type="number"
                            step="any"
                            placeholder="Longitude"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-[10px] text-slate-200 font-mono"
                            value={simulatedCheckIn.longitude}
                            onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, longitude: Number(e.target.value) }))}
                          />
                        </div>
                      </div>

                      <div className="space-y-3 flex flex-col justify-between">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">3. Duration & Trigger</label>
                          <input 
                            type="number"
                            placeholder="Duration (Minutes)"
                            className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono mt-2"
                            value={simulatedCheckIn.durationMinutes}
                            onChange={(e) => setSimulatedCheckIn(prev => ({ ...prev, durationMinutes: Number(e.target.value) }))}
                          />
                        </div>

                        <button
                          onClick={async () => {
                            if (!simulatedCheckIn.coachId) {
                              alert("Please select a coach to simulate check-in!");
                              return;
                            }
                            try {
                              const targetCoach = coaches.find(c => c.id === simulatedCheckIn.coachId);
                              if (!targetCoach) return;

                              const loginTime = new Date(`${attendanceDate}T09:00:00Z`).toISOString();
                              const logoutTime = new Date(new Date(loginTime).getTime() + simulatedCheckIn.durationMinutes * 60000).toISOString();

                              await mockApi.logCoachWorkSession(targetCoach.userId, {
                                logDate: attendanceDate,
                                sessionName: simulatedCheckIn.sessionName,
                                loginTime,
                                logoutTime,
                                durationMinutes: simulatedCheckIn.durationMinutes,
                                sessionType: 'PRACTICE',
                                deviceId: simulatedCheckIn.deviceId,
                                ipAddress: simulatedCheckIn.ipAddress,
                                latitude: simulatedCheckIn.latitude,
                                longitude: simulatedCheckIn.longitude,
                                attendanceSource: simulatedCheckIn.attendanceSource
                              });

                              alert(`Successfully simulated biometric check-in for session: "${simulatedCheckIn.sessionName}"! Total daily working hours updated.`);
                              loadData(true);
                            } catch (err: any) {
                              alert(`Error simulating check-in: ${err.message}`);
                            }
                          }}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all font-mono"
                        >
                          Trigger Biometric Device Scan
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Attendance History Audit Log Trail */}
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 lg:col-span-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-500" />
                    Coach Attendance Audit History Trail Log
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-2.5 px-4 font-bold">Edited At</th>
                          <th className="py-2.5 px-4 font-bold">Editor Name</th>
                          <th className="py-2.5 px-4 font-bold">Old Value</th>
                          <th className="py-2.5 px-4 font-bold">New Value</th>
                          <th className="py-2.5 px-4 font-bold">Change Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850 text-slate-350">
                        {attendanceHistory.map(hist => {
                          let parsedOld = hist.oldValue;
                          let parsedNew = hist.newValue;
                          try {
                            const o = JSON.parse(hist.oldValue);
                            parsedOld = `Status: ${o.status}, hours: ${o.working_hours} (${o.check_in || 'N/A'} - ${o.check_out || 'N/A'})`;
                          } catch {}
                          try {
                            if (hist.newValue !== 'SOFT_DELETED') {
                              const n = JSON.parse(hist.newValue);
                              parsedNew = `Status: ${n.status}, hours: ${n.working_hours} (${n.check_in || 'N/A'} - ${n.check_out || 'N/A'})`;
                            }
                          } catch {}

                          return (
                            <tr key={hist.id} className="hover:bg-slate-900/30">
                              <td className="py-2.5 px-4 font-mono text-[10px] text-slate-500">
                                {new Date(hist.editedAt).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-4 font-semibold text-slate-200">{hist.editorName || 'System'}</td>
                              <td className="py-2.5 px-4 font-mono text-[10px] text-red-300 max-w-xs truncate" title={parsedOld}>{parsedOld}</td>
                              <td className="py-2.5 px-4 font-mono text-[10px] text-emerald-300 max-w-xs truncate" title={parsedNew}>{parsedNew}</td>
                              <td className="py-2.5 px-4 italic text-slate-400">{hist.editReason || 'N/A'}</td>
                            </tr>
                          );
                        })}
                        {attendanceHistory.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500 italic">No attendance audit edits recorded yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            )}

            {/* Coach View (View own details, request correction) */}
            {portalRole === 'COACH' && currentCoach && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Own calendar matrix logs */}
                <div className="lg:col-span-2 bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">My Daily Attendance Ledger</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-3 px-4 font-bold">Date</th>
                          <th className="py-3 px-4 font-bold">Status</th>
                          <th className="py-3 px-4 font-bold">Check In</th>
                          <th className="py-3 px-4 font-bold">Check Out</th>
                          <th className="py-3 px-4 font-bold">Working Hours</th>
                          <th className="py-3 px-4 font-bold">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {coachAttendance
                          .filter(a => a.coachId === currentCoach.id)
                          .map(log => (
                            <tr key={log.id} className="hover:bg-slate-900/40">
                              <td className="py-3 px-4 font-mono font-semibold text-slate-100">{log.attendanceDate}</td>
                              <td className="py-3 px-4">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  ['PRESENT', 'TRAINING_DUTY', 'TOURNAMENT_DUTY'].includes(log.status) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                }`}>{log.status}</span>
                              </td>
                              <td className="py-3 px-4 font-mono text-slate-350">{log.checkIn || 'N/A'}</td>
                              <td className="py-3 px-4 font-mono text-slate-350">{log.checkOut || 'N/A'}</td>
                              <td className="py-3 px-4 font-bold text-slate-200">{log.workingHours.toFixed(2)} Hrs</td>
                              <td className="py-3 px-4 text-slate-500">{log.remarks || 'None'}</td>
                            </tr>
                          ))}
                        {coachAttendance.filter(a => a.coachId === currentCoach.id).length === 0 && (
                          <tr>
                            <td colSpan={6} className="py-6 text-center text-slate-500">No attendance history logs found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Leaves & Work session actions */}
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">My Action Center</h3>
                  <div className="space-y-4 pt-3">
                    
                    <button 
                      onClick={() => setShowApplyLeave(true)}
                      className="w-full py-3 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-bold rounded-xl"
                    >
                      Request Leave/Duty Off
                    </button>

                    <button 
                      onClick={() => setShowRequestCorrection(true)}
                      className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs font-bold rounded-xl"
                    >
                      Request Log Correction
                    </button>
                    
                    <div className="border-t border-slate-850 pt-4 space-y-2.5">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">My Leave Statuses</h4>
                      {coachLeaves.filter(l => l.coachId === currentCoach.id).map(leave => (
                        <div key={leave.id} className="p-3 bg-slate-950/40 rounded-xl flex justify-between items-center text-xs">
                          <div>
                            <p className="font-semibold text-slate-200">{leave.leaveType}</p>
                            <p className="text-[9px] text-slate-500 mt-0.5">{leave.startDate} to {leave.endDate}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            leave.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : leave.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-500'
                          }`}>{leave.status}</span>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>

              </div>
            )}
            {/* Finance Admin / School Admin Payroll view */}
            {['FINANCE_ADMIN', 'SUPER_ADMIN', 'SCHOOL_ADMIN'].includes(portalRole) && (
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Coach Attendance Audit Log (For Payroll Verification)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Coach Name</th>
                        <th className="py-3 px-4 font-bold">Date</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold">Working Hours</th>
                        <th className="py-3 px-4 font-bold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {coachAttendance.map(log => (
                        <tr key={log.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-semibold text-slate-100">{log.coachName}</td>
                          <td className="py-3 px-4 font-mono text-slate-350">{log.attendanceDate}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ['PRESENT', 'TRAINING_DUTY', 'TOURNAMENT_DUTY'].includes(log.status) ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>{log.status}</span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-200">{log.workingHours.toFixed(2)} Hrs</td>
                          <td className="py-3 px-4 text-slate-500">{log.remarks || 'None'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            5. SPORTS ENROLLMENT CENTER (STUDENTS / ADMINS)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'enrollment' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            
            {['STUDENT', 'PARENT'].includes(portalRole) ? (
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">My Sports Enrollments</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Sport Name</th>
                        <th className="py-3 px-4 font-bold">Category</th>
                        <th className="py-3 px-4 font-bold">Type</th>
                        <th className="py-3 px-4 font-bold">Enrollment Date</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {studentEnrollments.map(enroll => (
                        <tr key={enroll.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-semibold text-slate-100">{enroll.sportName}</td>
                          <td className="py-3 px-4 text-slate-400">{enroll.categoryName || 'General'}</td>
                          <td className="py-3 px-4 text-slate-400">{enroll.sportType || 'Team'}</td>
                          <td className="py-3 px-4 text-slate-500">{enroll.enrollDate}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              enroll.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                              enroll.status === 'PENDING' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-red-500/10 text-red-450'
                            }`}>{enroll.status}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-450 italic">{enroll.rejectionReason || 'No remarks'}</td>
                        </tr>
                      ))}
                      {studentEnrollments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">Not enrolled in any sports.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center pb-4 border-b border-slate-800">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Pending Enrollment Requests</h3>
                  {['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                    <button 
                      onClick={() => {
                        setEnrollmentStudentId('');
                        setEnrollmentSportId('');
                        setShowCreateEnrollment(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs rounded-xl hover:from-brand-500 hover:to-brand-400 transition-all border border-brand-400/25"
                    >
                      Create Enrollment
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Student Name</th>
                        <th className="py-3 px-4 font-bold">Requested Sport</th>
                        <th className="py-3 px-4 font-bold">Request Date</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {enrollments
                        .filter(e => e.status === 'PENDING')
                        .map(enroll => (
                          <tr key={enroll.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-100">{enroll.studentName}</td>
                            <td className="py-3 px-4 text-slate-400">{enroll.sportName}</td>
                            <td className="py-3 px-4 text-slate-500">{enroll.enrollDate}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                PENDING
                              </span>
                            </td>
                            <td className="py-3 px-4 flex gap-2">
                              <button 
                                onClick={async () => {
                                  await mockApi.updateSportsEnrollmentStatus(userId, enroll.id, 'APPROVED');
                                  loadData(true);
                                }}
                                className="p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={async () => {
                                  const reason = prompt('Rejection reason:') || 'Criteria not met';
                                  await mockApi.updateSportsEnrollmentStatus(userId, enroll.id, 'REJECTED', reason);
                                  loadData(true);
                                }}
                                className="p-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                              >
                                <X size={14} />
                              </button>
                              <button 
                                onClick={async () => {
                                  try {
                                    if (confirm("Are you sure you want to delete this enrollment request?")) {
                                      await mockApi.deleteSportsEnrollment(userId, enroll.id);
                                      loadData(true);
                                    }
                                  } catch (err: any) {
                                    alert(err.message || "Cannot delete this record because related records exist.");
                                  }
                                }}
                                className="p-1 bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600 hover:text-white rounded-lg transition-all"
                                title="Delete Request"
                              >
                                <Trash size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {enrollments.filter(e => e.status === 'PENDING').length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-slate-500">No pending enrollment requests.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Approved Student Roster Table */}
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 mt-6">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Approved Student Roster (Athletes)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-3 px-4 font-bold">Student Name</th>
                          <th className="py-3 px-4 font-bold">Registered Sport</th>
                          <th className="py-3 px-4 font-bold">Enroll Date</th>
                          <th className="py-3 px-4 font-bold">Status</th>
                          <th className="py-3 px-4 font-bold">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {enrollments
                          .filter(e => e.status === 'APPROVED')
                          .map(enroll => (
                            <tr key={enroll.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="py-3 px-4 font-semibold text-slate-100">{enroll.studentName}</td>
                              <td className="py-3 px-4 text-slate-400">{enroll.sportName}</td>
                              <td className="py-3 px-4 text-slate-500">{enroll.enrollDate}</td>
                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                                  APPROVED
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <button 
                                  onClick={async () => {
                                    try {
                                      if (confirm("Are you sure you want to delete this student enrollment?")) {
                                        await mockApi.deleteSportsEnrollment(userId, enroll.id);
                                        loadData(true);
                                      }
                                    } catch (err: any) {
                                      alert(err.message || "Cannot delete this record because related records exist.");
                                    }
                                  }}
                                  className="p-1 bg-red-650 text-white rounded hover:bg-red-500 transition-all flex items-center gap-1 text-[10px] font-bold px-2 py-1"
                                >
                                  <Trash size={12} />
                                  Delete Athlete
                                </button>
                              </td>
                            </tr>
                          ))}
                        {enrollments.filter(e => e.status === 'APPROVED').length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-500">No active student roster found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Create Enrollment Modal Dialog */}
            {showCreateEnrollment && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md">
                <div className="w-full max-w-md bg-[#0b101d] border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-up">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Create Student Enrollment</h3>
                    <button 
                      onClick={() => setShowCreateEnrollment(false)}
                      className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-all"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  
                  <div className="space-y-4 text-xs">
                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">1. Select Athlete</label>
                      <select 
                        value={enrollmentStudentId}
                        onChange={(e) => setEnrollmentStudentId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="">-- Choose student --</option>
                        {allStudents.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase font-mono">2. Select Sport</label>
                      <select 
                        value={enrollmentSportId}
                        onChange={(e) => setEnrollmentSportId(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="">-- Choose sport --</option>
                        {sports.filter(s => s.status === 'ACTIVE').map(s => (
                          <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                    <button 
                      onClick={() => setShowCreateEnrollment(false)}
                      className="px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white text-xs font-semibold"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={async () => {
                        if (!enrollmentStudentId || !enrollmentSportId) {
                          alert("Please choose both student and sport.");
                          return;
                        }
                        try {
                          await mockApi.submitSportsEnrollment(userId, {
                            schoolId,
                            academicSessionId,
                            studentId: enrollmentStudentId,
                            sportId: enrollmentSportId
                          });
                          setShowCreateEnrollment(false);
                          loadData(true);
                        } catch (err: any) {
                          alert(err.message || "Failed to create enrollment.");
                        }
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs rounded-xl hover:from-brand-500 hover:to-brand-400 transition-all border border-brand-400/25"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            6. TEAMS & GROUPS TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'teams' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {teams.map(team => (
                <div key={team.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-100 text-sm">{team.name}</h4>
                      <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2.5 py-0.5 rounded-full uppercase">
                        {team.sportName}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 pt-3 text-[11px] text-slate-400">
                      <div>
                        <span className="text-slate-500">Coach:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">{team.coachName}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Captain:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">{team.captainName}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Age Limit:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">{team.ageGroup}</p>
                      </div>
                      <div>
                        <span className="text-slate-500">Roster Strength:</span>
                        <p className="font-semibold text-slate-200 mt-0.5">{team.memberCount} members</p>
                      </div>
                    </div>
                  </div>

                  {['SCHOOL_ADMIN', 'COACH', 'SPORTS_ADMIN'].includes(portalRole) && (
                    <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
                      {['SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && (
                        <button 
                          onClick={async () => {
                            try {
                              if (confirm("Are you sure you want to delete this team?")) {
                                await mockApi.deleteSportsTeam(team.id);
                                loadData(true);
                              }
                            } catch (err: any) {
                              alert(err.message || "Cannot delete this record because related records exist.");
                            }
                          }}
                          className="text-[10px] font-bold bg-red-600/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/25 hover:bg-red-500 hover:text-white transition-all"
                        >
                          Delete Team
                        </button>
                      )}
                      <button 
                        onClick={async () => {
                          const stdId = prompt('Enter Student ID to enroll:');
                          if (stdId) {
                            await mockApi.addSportsTeamMember(team.id, stdId, schoolId);
                            loadData(true);
                          }
                        }}
                        className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1.5 rounded-lg transition-all"
                      >
                        Add Athlete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            7. TRAINING SCHEDULE TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'schedule' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-3 px-4 font-bold">Session Name</th>
                    <th className="py-3 px-4 font-bold">Sport</th>
                    <th className="py-3 px-4 font-bold">Date</th>
                    <th className="py-3 px-4 font-bold">Time</th>
                    <th className="py-3 px-4 font-bold">Venue</th>
                    <th className="py-3 px-4 font-bold">Status</th>
                    {['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'COACH'].includes(portalRole) && <th className="py-3 px-4 font-bold text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {sessions.map(sess => (
                    <tr key={sess.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-100">{sess.sessionName}</td>
                      <td className="py-3 px-4 text-slate-400">{sess.sportName}</td>
                      <td className="py-3 px-4 text-slate-400">{sess.sessionDate}</td>
                      <td className="py-3 px-4 text-slate-400">{sess.startTime} - {sess.endTime}</td>
                      <td className="py-3 px-4 text-slate-500">{sess.venue}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sess.status === 'SCHEDULED' 
                            ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' 
                            : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        }`}>
                          {sess.status}
                        </span>
                      </td>
                      {['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'COACH'].includes(portalRole) && (
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={async () => {
                              try {
                                if (confirm("Are you sure you want to delete this session?")) {
                                  await mockApi.deleteSportsTrainingSession(sess.id);
                                  loadData(true);
                                }
                              } catch (err: any) {
                                alert(err.message || "Cannot delete this record because related records exist.");
                              }
                            }}
                            className="text-[10px] font-bold bg-red-600/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/25 hover:bg-red-500 hover:text-white transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            8. ATHLETE ATTENDANCE TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'attendance' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            
            {['SCHOOL_ADMIN', 'COACH', 'SPORTS_ADMIN'].includes(portalRole) ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">Select Session to Mark Athlete Attendance</label>
                  <select 
                    onChange={async (e) => {
                      const sessId = e.target.value;
                      if (sessId) {
                        const att = await mockApi.fetchSportsAttendance(schoolId, sessId);
                        if (att.length === 0) {
                          const targetSess = sessions.find(s => s.id === sessId);
                          if (targetSess && targetSess.teamId) {
                            const roster = await mockApi.fetchSportsTeamMembers(schoolId, targetSess.teamId);
                            const preAtt = roster.map(r => ({
                              studentId: r.studentId,
                              studentName: r.studentName,
                              status: 'PRESENT',
                              remarks: ''
                            }));
                            setPerformance(preAtt);
                          }
                        } else {
                          setPerformance(att);
                        }
                      }
                    }}
                    className="w-64 px-4 py-2.5 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:outline-none"
                  >
                    <option value="">-- Choose practice session --</option>
                    {sessions.map(s => (
                      <option key={s.id} value={s.id}>{s.sessionName} ({s.sessionDate})</option>
                    ))}
                  </select>
                </div>

                {performance.length > 0 && (
                  <div className="overflow-x-auto border-t border-slate-800 pt-4">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-3 px-4 font-bold">Student Name</th>
                          <th className="py-3 px-4 font-bold">Status</th>
                          <th className="py-3 px-4 font-bold">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {performance.map((student, idx) => (
                          <tr key={student.studentId || idx}>
                            <td className="py-3 px-4 font-semibold text-slate-100">{student.studentName}</td>
                            <td className="py-3 px-4">
                              <select 
                                value={student.status}
                                onChange={(e) => {
                                  const updated = [...performance];
                                  updated[idx].status = e.target.value;
                                  setPerformance(updated);
                                }}
                                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs"
                              >
                                <option value="PRESENT">Present</option>
                                <option value="ABSENT">Absent</option>
                                <option value="LATE">Late</option>
                                <option value="EXCUSED">Excused</option>
                              </select>
                            </td>
                            <td className="py-3 px-4">
                              <input 
                                type="text"
                                value={student.remarks || ''}
                                onChange={(e) => {
                                  const updated = [...performance];
                                  updated[idx].remarks = e.target.value;
                                  setPerformance(updated);
                                }}
                                placeholder="Add notes..."
                                className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs w-64"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    <div className="flex justify-end pt-4">
                      <button
                        onClick={async () => {
                          alert("Attendance records updated successfully!");
                          loadData(true);
                        }}
                        className="bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-5 py-2 rounded-xl"
                      >
                        Submit Attendance
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Athlete Practice Attendance Logs</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Session Name</th>
                        <th className="py-3 px-4 font-bold">Date</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-slate-300">
                      {athleteAttendanceHistory.map(log => (
                        <tr key={log.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-semibold text-slate-100">{log.sessionName}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono">{log.date}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              log.status === 'PRESENT' ? 'bg-emerald-500/10 text-emerald-400' :
                              log.status === 'LATE' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-red-500/10 text-red-400'
                            }`}>{log.status}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-400 italic">{log.remarks || 'No remarks'}</td>
                        </tr>
                      ))}
                      {athleteAttendanceHistory.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-500">No attendance logs recorded.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            9. TOURNAMENTS ENGINE
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'tournaments' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Bracket List */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Tournament Fixtures & Brackets</h3>
                {tournaments.map(t => (
                  <div key={t.id} className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <h4 className="font-bold text-slate-100 text-xs">{t.name}</h4>
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">{t.status}</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs p-2.5 bg-slate-950/40 rounded-lg">
                        <span className="font-semibold text-slate-200">Our Team</span>
                        <span className="font-bold text-brand-400">VS</span>
                        <span className="font-semibold text-slate-200">District Competitors</span>
                      </div>
                      <p className="text-[10px] text-slate-500 text-center">Venue: {t.venue} • Timeline: {t.startDate} to {t.endDate}</p>
                    </div>
                    {['SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && (
                      <div className="flex justify-end pt-2 border-t border-slate-800/40">
                        <button
                          onClick={async () => {
                            try {
                              if (confirm("Are you sure you want to delete this tournament?")) {
                                await mockApi.deleteSportsTournament(t.id);
                                loadData(true);
                              }
                            } catch (err: any) {
                              alert(err.message || "Cannot delete this record because related records exist.");
                            }
                          }}
                          className="text-[10px] font-bold bg-red-600/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/25 hover:bg-red-500 hover:text-white transition-all"
                        >
                          Delete Tournament
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Points Table Side view */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Standings Points Table</h3>
                <div className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-3">
                  {rankings.map((rank, idx) => (
                    <div key={rank.id} className="flex items-center justify-between text-xs p-2 bg-slate-950/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-brand-500">#{idx + 1}</span>
                        <span className="font-semibold text-slate-200">{rank.teamName}</span>
                      </div>
                      <span className="font-bold text-emerald-400">{rank.points} PTS</span>
                    </div>
                  ))}
                  {rankings.length === 0 && <p className="text-[10px] text-slate-500 text-center py-6">Rankings database is syncing.</p>}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            10. ACHIEVEMENTS TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'achievements' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {achievements.map(ach => (
                <div key={ach.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-100 text-xs">{ach.title}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                        ach.type === 'GOLD' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500' : 'bg-slate-500/10 border border-slate-500/20 text-slate-400'
                      }`}>
                        {ach.type}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">{ach.description}</p>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-slate-500 border-t border-slate-800 pt-3">
                    <span>Level: {ach.level}</span>
                    <span>Date: {ach.dateAwarded}</span>
                  </div>
                  {['SCHOOL_ADMIN', 'SPORTS_ADMIN', 'COACH'].includes(portalRole) && (
                    <div className="flex justify-end pt-2 border-t border-slate-800/40">
                      <button
                        onClick={async () => {
                          try {
                            if (confirm("Are you sure you want to delete this achievement?")) {
                              await mockApi.deleteSportsAchievement(ach.id);
                              loadData(true);
                            }
                          } catch (err: any) {
                            alert(err.message || "Cannot delete this record because related records exist.");
                          }
                        }}
                        className="text-[10px] font-bold bg-red-600/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/25 hover:bg-red-500 hover:text-white transition-all"
                      >
                        Delete Achievement
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {achievements.length === 0 && <p className="col-span-3 text-xs text-slate-500 py-6 text-center">No achievements recorded in database.</p>}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            11. CERTIFICATES CENTER
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'certificates' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {certificates.map(cert => (
                <div key={cert.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">Certificate of Achievement</h4>
                    <p className="text-[10px] text-slate-500 mt-0.5">Recipient: {cert.studentName}</p>
                    <p className="text-[10px] text-brand-400 mt-2 font-mono">{cert.certificateNumber}</p>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => downloadCertificate(cert)}
                      className="p-2.5 bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500 hover:text-white rounded-xl transition-all"
                      title="Download PDF"
                    >
                      <Download size={16} />
                    </button>
                    {['SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && (
                      <button 
                        onClick={async () => {
                          try {
                            if (confirm("Are you sure you want to delete this certificate?")) {
                              await mockApi.deleteSportsCertificate(cert.id);
                              loadData(true);
                            }
                          } catch (err: any) {
                            alert(err.message || "Cannot delete this record because related records exist.");
                          }
                        }}
                        className="p-2.5 bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        title="Delete Certificate"
                      >
                        <Trash size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            12. PERFORMANCE ANALYTICS
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'performance' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Mark Athlete Performance Form (Coaches View ONLY) */}
              {portalRole === 'COACH' && (
                <div className="bg-[#0b101d] border border-slate-800 p-5 rounded-xl space-y-4">
                  <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">Log Athlete Metrics</h4>
                  <form onSubmit={handleAddPerformance} className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400">Student ID</label>
                      <input 
                        type="text" 
                        value={perfForm.studentId}
                        onChange={(e) => setPerfForm(prev => ({ ...prev, studentId: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white" 
                        placeholder="UUID format student ID"
                        required
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-slate-400">Sport ID</label>
                      <select 
                        value={perfForm.sportId}
                        onChange={(e) => setPerfForm(prev => ({ ...prev, sportId: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white"
                        required
                      >
                        <option value="">-- Choose Sport --</option>
                        {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-slate-400">Speed (0-100)</label>
                        <input type="number" value={perfForm.speed} onChange={(e) => setPerfForm(prev => ({ ...prev, speed: Number(e.target.value) }))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5" />
                      </div>
                      <div>
                        <label className="text-slate-400">Stamina</label>
                        <input type="number" value={perfForm.stamina} onChange={(e) => setPerfForm(prev => ({ ...prev, stamina: Number(e.target.value) }))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5" />
                      </div>
                      <div>
                        <label className="text-slate-400">Strength</label>
                        <input type="number" value={perfForm.strength} onChange={(e) => setPerfForm(prev => ({ ...prev, strength: Number(e.target.value) }))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-slate-400">Agility</label>
                        <input type="number" value={perfForm.agility} onChange={(e) => setPerfForm(prev => ({ ...prev, agility: Number(e.target.value) }))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5" />
                      </div>
                      <div>
                        <label className="text-slate-400">Teamwork</label>
                        <input type="number" value={perfForm.teamwork} onChange={(e) => setPerfForm(prev => ({ ...prev, teamwork: Number(e.target.value) }))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-1.5" />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-400">Remarks</label>
                      <input type="text" value={perfForm.remarks} onChange={(e) => setPerfForm(prev => ({ ...prev, remarks: e.target.value }))} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2" placeholder="Form feedback notes" />
                    </div>
                    <button type="submit" className="w-full py-2 bg-brand-600 text-white font-bold rounded-lg mt-2">Log Score</button>
                  </form>
                </div>
              )}

              {/* Radar Performance Details */}
              <div className="flex flex-col items-center justify-center bg-slate-900/40 p-4 rounded-xl border border-slate-850">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono mb-2">School Athletic Ratios</p>
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={getRadarChartData()}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={10} />
                    <PolarRadiusAxis stroke="#1e293b" fontSize={8} />
                    <Radar name="Fitness Level" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            13. MEDICAL FITNESS TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'medical' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {medicalRecords.map(med => (
                <div key={med.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h4 className="font-bold text-slate-100 text-sm">{med.studentName}</h4>
                    <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full">Blood: {med.bloodGroup}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-[11px] text-slate-400">
                    <div>
                      <span className="text-slate-500">Conditions:</span>
                      <p className="font-semibold text-slate-200 mt-0.5">{med.medicalConditions}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Recovery Status:</span>
                      <p className="font-semibold text-emerald-400 mt-0.5">{med.recoveryStatus}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Fitness Expires:</span>
                      <p className="font-semibold text-slate-200 mt-0.5">{med.fitnessExpiryDate}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Emergency Contact:</span>
                      <p className="font-semibold text-slate-200 mt-0.5">{med.emergencyContact}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            14. EQUIPMENT PROCUREMENT
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'equipment' && (
          <div className="space-y-6">
            
            {/* Procurement workflow requests logs */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Procurement Purchase Requests</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Item Title</th>
                      <th className="py-3 px-4 font-bold">Vendor</th>
                      <th className="py-3 px-4 font-bold">Amount Requested</th>
                      <th className="py-3 px-4 font-bold">Amount Approved</th>
                      <th className="py-3 px-4 font-bold">Approval Status</th>
                      <th className="py-3 px-4 font-bold">Invoice / Ref ID</th>
                      <th className="py-3 px-4 font-bold">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {expenses.filter(e => e.category === 'EQUIPMENT_PURCHASE').map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 text-slate-400">{exp.category.replace('_', ' ')}</td>
                        <td className="py-3 px-4 font-semibold text-slate-100">{exp.title}</td>
                        <td className="py-3 px-4 text-slate-400">{exp.vendor || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-400">₹{exp.amountRequested.toLocaleString()}</td>
                        <td className="py-3 px-4 text-slate-200">₹{(exp.amountApproved || 0).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : exp.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-500'
                          }`}>{exp.status}</span>
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500">{exp.invoiceNumber || 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.paymentStatus === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>{exp.paymentStatus}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Inventory listing */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Stock Inventory</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Item Name</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Total Stock</th>
                      <th className="py-3 px-4 font-bold">Available Stock</th>
                      <th className="py-3 px-4 font-bold">Stock Condition</th>
                      {['SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && <th className="py-3 px-4 font-bold text-right">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {equipment.map(item => (
                      <tr key={item.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{item.name}</td>
                        <td className="py-3 px-4 text-slate-400">{item.category}</td>
                        <td className="py-3 px-4 text-slate-400">{item.totalQuantity} Units</td>
                        <td className="py-3 px-4 font-bold text-brand-400">{item.availableQuantity} Units</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300">{item.condition}</span>
                        </td>
                        {['SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && (
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={async () => {
                                try {
                                  if (confirm("Are you sure you want to delete this equipment item?")) {
                                    await mockApi.deleteSportsEquipment(item.id);
                                    loadData(true);
                                  }
                                } catch (err: any) {
                                  alert(err.message || "Cannot delete this record because related records exist.");
                                }
                              }}
                              className="text-[10px] font-bold bg-red-600/10 text-red-400 px-3 py-1.5 rounded-lg border border-red-500/25 hover:bg-red-500 hover:text-white transition-all"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            15. FINANCE MODULE SUB-VIEWS (EXCLUSIVE TO FINANCE ADMIN)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'finance' && ['FINANCE_ADMIN', 'SUPER_ADMIN', 'SCHOOL_ADMIN', 'SPORTS_ADMIN'].includes(portalRole) && (
          <FinanceErrorBoundary>
            <div className="space-y-6">

              {/* Sports Admin Dashboard (KPI Grid) */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Sports Finance Dashboard</h2>
                  <span className="text-[10px] text-slate-500 font-mono">Academic Session Sync</span>
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  {/* Total Invoices */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Invoices</p>
                      <p className="text-lg font-extrabold text-white mt-1">₹{totalInvoicesAmount.toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] text-brand-400 font-bold mt-2">{unpaidInvoicesCount} Unpaid</p>
                  </div>

                  {/* Payments Queue */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Payments Queue</p>
                      <p className="text-lg font-extrabold text-amber-500 mt-1">{paymentsQueueCount}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-2">To Verify</p>
                  </div>

                  {/* Total Collections */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Collections</p>
                      <p className="text-lg font-extrabold text-emerald-450 mt-1">₹{totalCollectionsAmount.toLocaleString()}</p>
                    </div>
                    <p className="text-[10px] text-emerald-450 font-bold mt-2">Collected</p>
                  </div>

                  {/* Expense Requests */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Expense Requests</p>
                      <p className="text-lg font-extrabold text-red-455 mt-1">{pendingExpensesCount}</p>
                    </div>
                    <p className="text-[10px] text-red-400 font-semibold mt-2">Pending</p>
                  </div>

                  {/* Payroll Requests */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Payroll Requests</p>
                      <p className="text-lg font-extrabold text-purple-400 mt-1">{pendingPayrollCount}</p>
                    </div>
                    <p className="text-[10px] text-purple-400 font-semibold mt-2">Pending</p>
                  </div>

                  {/* Fine Payments */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-colors">
                    <div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Fine Payments</p>
                      <p className="text-lg font-extrabold text-yellow-500 mt-1">{pendingFinesCount}</p>
                    </div>
                    <p className="text-[10px] text-yellow-500 font-semibold mt-2">Pending</p>
                  </div>
                </div>
              </div>

              {/* Finance Overview */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Finance Overview</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Budget Allocated */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Budget Allocated</p>
                    <p className="text-xl font-extrabold text-white mt-1">₹{totalAllocatedBudget.toLocaleString()}</p>
                    <p className="text-[10px] text-brand-400 mt-1 font-semibold">Allocations total</p>
                  </div>

                  {/* Total Expenses */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Expenses</p>
                    <p className="text-xl font-extrabold text-white mt-1">₹{totalExpensesSpent.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Approved procurement</p>
                  </div>

                  {/* Payroll This Month */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Payroll This Month</p>
                    <p className="text-xl font-extrabold text-white mt-1">₹{payrollThisMonth.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-450 mt-1 font-mono font-semibold">{selectedMonth}</p>
                  </div>

                  {/* Fine Collections */}
                  <div className="bg-slate-900/60 border border-slate-850 rounded-xl p-4">
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-wider font-mono">Fine Collections</p>
                    <p className="text-xl font-extrabold text-emerald-400 mt-1">₹{fineCollectionsAmount.toLocaleString()}</p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">Total approved fines</p>
                  </div>
                </div>
              </div>

              {/* Quick Actions (Write Roles ONLY - Sports Admin & Finance Admin. School Admin is view-only) */}
              {portalRole !== 'SCHOOL_ADMIN' && (
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Quick Actions</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Create Sports Invoice */}
                    <button 
                      onClick={() => {
                        setNewInvoice({
                          studentId: '',
                          sportId: '',
                          invoiceTitle: '',
                          invoiceDescription: '',
                          invoiceCategory: 'Coaching Fee',
                          amount: 0,
                          dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
                          lateFee: 0,
                          remarks: ''
                        });
                        setStudentSearch('');
                        setShowAddInvoice(true);
                      }}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-blue-600/10 text-blue-400 border border-blue-500/25 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Plus size={16} /> Create Sports Invoice
                    </button>

                    {/* Create Expense Request */}
                    <button 
                      onClick={() => {
                        setExpenseForm({
                          category: 'EQUIPMENT_PURCHASE',
                          title: '',
                          amountRequested: 1000,
                          description: '',
                          vendor: '',
                          invoiceNumber: '',
                          referenceId: ''
                        });
                        setShowRequestExpense(true);
                      }}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600/10 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Plus size={16} /> Create Expense Request
                    </button>

                    {/* Create Payroll Request */}
                    <button 
                      onClick={() => {
                        setNewSalaryRequest({
                          employeeId: '',
                          employeeType: 'COACH',
                          salaryMonth: new Date().toISOString().substring(0, 7),
                          grossSalary: 0,
                          bonus: 0,
                          deductions: 0
                        });
                        setShowCreateSalaryRequest(true);
                      }}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-purple-600/10 text-purple-400 border border-purple-500/25 hover:bg-purple-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Plus size={16} /> Create Payroll Request
                    </button>

                    {/* Create Fine */}
                    <button 
                      onClick={() => {
                        setFineForm({
                          studentId: '',
                          amount: 500,
                          reason: '',
                          dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0]
                        });
                        setFineStudentSearch('');
                        setShowIssueFine(true);
                      }}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-amber-600/10 text-amber-400 border border-amber-500/25 hover:bg-amber-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Plus size={16} /> Create Fine
                    </button>

                    {/* Create Fee Payment Record */}
                    <button 
                      onClick={() => {
                        setNewFeePayment({
                          studentId: '',
                          invoiceId: '',
                          amount: '',
                          utrNumber: '',
                          screenshotUrl: '',
                          status: 'PENDING_VERIFICATION'
                        });
                        setFeePaymentStudentSearch('');
                        setShowCreateFeePayment(true);
                      }}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-cyan-600/10 text-cyan-400 border border-cyan-500/25 hover:bg-cyan-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Plus size={16} /> Record Fee Payment
                    </button>

                    {/* Create Fine Payment Record */}
                    <button 
                      onClick={() => {
                        setNewFinePayment({
                          studentId: '',
                          reason: '',
                          amount: '',
                          utrNumber: '',
                          screenshotUrl: '',
                          status: 'PENDING'
                        });
                        setFinePaymentStudentSearch('');
                        setShowCreateFinePayment(true);
                      }}
                      className="flex items-center justify-center gap-2 py-3 px-4 bg-rose-600/10 text-rose-400 border border-rose-500/25 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-[0.98]"
                    >
                      <Plus size={16} /> Record Fine Payment
                    </button>
                  </div>
                </div>
              )}
            
             {/* Budget allocation controller */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Budget Allocation Controller</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {['EQUIPMENT', 'TOURNAMENT', 'SALARY', 'TRAVEL', 'OTHER'].map(cat => {
                  const existingB = budgets.find(b => b.category === cat);
                  const amount = budgetAmounts[cat] ?? existingB?.allocatedAmount ?? 10000;
                  
                  return (
                    <div key={cat} className="p-4 bg-slate-900/60 border border-slate-850 rounded-xl space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase font-mono">{cat}</p>
                      <input 
                        type="number"
                        value={amount}
                        disabled={portalRole !== 'FINANCE_ADMIN'}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBudgetAmounts(prev => ({ ...prev, [cat]: val }));
                        }}
                        className={`w-full px-2 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white ${portalRole !== 'FINANCE_ADMIN' ? 'opacity-60 cursor-not-allowed' : ''}`}
                      />
                      <p className="text-[10px] text-slate-500">Spent: ₹{(existingB?.spentAmount || 0).toLocaleString()}</p>
                      {portalRole === 'FINANCE_ADMIN' && (
                        <div className="space-y-1.5">
                          <button 
                            onClick={async () => {
                              await mockApi.allocateBudget(userId, {
                                academicSessionId,
                                allocatedAmount: amount,
                                category: cat
                              });
                              alert(`Budget updated for ${cat}`);
                              loadData(true);
                            }}
                            className="w-full py-1 bg-brand-600 hover:bg-brand-500 text-white text-[10px] font-bold rounded-lg transition-all"
                          >
                            Set Budget
                          </button>
                          {existingB && (
                            <button 
                              onClick={async () => {
                                try {
                                  if (confirm(`Are you sure you want to delete the budget for ${cat}?`)) {
                                    await mockApi.deleteSportsBudget(existingB.id);
                                    loadData(true);
                                  }
                                } catch (err: any) {
                                  alert(err.message || "Cannot delete this record because related records exist.");
                                }
                              }}
                              className="w-full py-1 bg-red-600/10 text-red-400 hover:bg-red-500 hover:text-white text-[10px] font-bold rounded-lg border border-red-500/25 transition-all"
                            >
                              Delete Budget
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}              </div>
            </div>

            {/* Budget allocation history */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Budget History (Last 20 changes)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Old Amount</th>
                      <th className="py-3 px-4 font-bold">New Amount</th>
                      <th className="py-3 px-4 font-bold">Updated By</th>
                      <th className="py-3 px-4 font-bold">Date & Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {budgetHistory.slice(0, 20).map(hist => (
                      <tr key={hist.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{hist.category}</td>
                        <td className="py-3 px-4 text-slate-400">₹{hist.oldAmount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-emerald-400 font-semibold">₹{hist.newAmount.toLocaleString()}</td>
                        <td className="py-3 px-4 text-slate-400">{hist.updatedByName}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{new Date(hist.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                    {budgetHistory.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500">No budget allocation history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Create Sports Invoice Control Banner */}
            <div className="flex justify-between items-center bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Invoice Control Center</h3>
                <p className="text-xs text-slate-400 mt-1">Generate fee invoices, track students due states, and handle payment verifications.</p>
              </div>
              {['FINANCE_ADMIN', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                <button
                  onClick={() => {
                    setNewInvoice({
                      studentId: '',
                      sportId: '',
                      invoiceTitle: '',
                      invoiceDescription: '',
                      invoiceCategory: 'Coaching Fee',
                      amount: 0,
                      dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
                      lateFee: 0,
                      remarks: ''
                    });
                    setShowAddInvoice(true);
                  }}
                  className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10 hover:brightness-110 active:scale-95 transition-all"
                >
                  <Plus size={15} /> Create Sports Invoice
                </button>
              )}
            </div>

            {/* Invoice History Grid */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Invoice History</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Invoice Number</th>
                      <th className="py-3 px-4 font-bold">Student</th>
                      <th className="py-3 px-4 font-bold">Title</th>
                      <th className="py-3 px-4 font-bold">Category</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Created Date</th>
                      <th className="py-3 px-4 font-bold">Created By</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {fees.map(inv => (
                      <tr key={inv.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-mono text-brand-400">{inv.invoiceNumber}</td>
                        <td className="py-3 px-4 font-semibold text-slate-100">{inv.studentName}</td>
                        <td className="py-3 px-4 text-slate-300">{inv.invoiceTitle}</td>
                        <td className="py-3 px-4 text-slate-400">{inv.invoiceCategory}</td>
                        <td className="py-3 px-4 text-slate-200">₹{inv.amount.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                            inv.status === 'PENDING_VERIFICATION' ? 'bg-amber-500/10 text-amber-500' :
                            inv.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                            'bg-slate-800 text-slate-400'
                          }`}>{inv.status}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{new Date(inv.createdAt).toLocaleDateString()}</td>
                        <td className="py-3 px-4 text-slate-400">{inv.createdByName}</td>
                        <td className="py-3 px-4 flex gap-1 items-center">
                          {/* View Details - Visible to all roles including School Admin */}
                          <button
                            onClick={() => {
                              setSelectedViewInvoice(inv);
                              setShowViewInvoice(true);
                            }}
                            className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 hover:bg-slate-700 hover:text-white transition-all font-mono"
                          >
                            View
                          </button>

                          {/* Mutating actions: only for FINANCE_ADMIN, SPORTS_ADMIN, SUPER_ADMIN */}
                          {['FINANCE_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                            <>
                              <button
                                onClick={() => {
                                  setEditInvoiceForm({
                                    id: inv.id,
                                    sportId: inv.sportId || '',
                                    invoiceTitle: inv.invoiceTitle,
                                    invoiceDescription: inv.invoiceDescription || '',
                                    invoiceCategory: inv.invoiceCategory,
                                    amount: String(inv.amount),
                                    dueDate: inv.dueDate,
                                    remarks: inv.remarks || ''
                                  });
                                  setShowEditInvoice(true);
                                }}
                                className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/25 hover:bg-blue-600 hover:text-white transition-all font-mono"
                              >
                                Edit
                              </button>

                              <button
                                onClick={async () => {
                                  try {
                                    await mockApi.sendSportsInvoiceNotification(userId, inv.id);
                                    alert('Notification dispatched successfully!');
                                  } catch (err: any) {
                                    alert(`Failed to send notification: ${err.message}`);
                                  }
                                }}
                                className="text-[10px] font-bold bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/25 hover:bg-purple-600 hover:text-white transition-all font-mono"
                                title="Send reminder to student/parent"
                              >
                                Notify
                              </button>

                              <button
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this invoice?')) {
                                    await mockApi.deleteSportsInvoice(userId, inv.id);
                                    loadData(true);
                                  }
                                }}
                                className="text-[10px] font-bold bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/25 hover:bg-red-650 hover:text-white transition-all font-mono"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {fees.length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-500">No invoice records found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invoices verifications */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Sports Fee Payments Queue</h3>
                {['FINANCE_ADMIN', 'SCHOOL_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                  <button
                    onClick={() => {
                      setNewInvoice({
                        studentId: '',
                        sportId: '',
                        invoiceTitle: '',
                        invoiceDescription: '',
                        invoiceCategory: 'Coaching Fee',
                        amount: 0,
                        dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
                        lateFee: 0,
                        remarks: ''
                      });
                      setStudentSearch('');
                      setShowAddInvoice(true);
                    }}
                    className="flex items-center gap-1.5 bg-brand-600/10 text-brand-400 hover:bg-brand-600 hover:text-white border border-brand-500/25 font-bold text-[10px] px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                  >
                    <Plus size={12} /> Create Invoice
                  </button>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Student Name</th>
                      <th className="py-3 px-4 font-bold">Invoice</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold">UTR</th>
                      <th className="py-3 px-4 font-bold">Screenshot</th>
                      <th className="py-3 px-4 font-bold">Submitted Time</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {feePayments.filter(p => p.status === 'PENDING_VERIFICATION').map(pmt => (
                      <tr key={pmt.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{pmt.studentName}</td>
                        <td className="py-3 px-4 text-slate-400">{pmt.invoiceTitle}</td>
                        <td className="py-3 px-4 text-slate-400">₹{pmt.amountPaid.toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono text-slate-350">{pmt.utrNumber}</td>
                        <td className="py-3 px-4">
                          {pmt.paymentScreenshotUrl ? (
                            <a href={pmt.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-brand-400 font-bold hover:underline">View Screenshot</a>
                          ) : 'No file'}
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{new Date(pmt.submittedAt || pmt.paymentDate).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500">PENDING_VERIFICATION</span>
                        </td>
                        <td className="py-3 px-4 flex gap-2">
                          {['FINANCE_ADMIN', 'SCHOOL_ADMIN'].includes(portalRole) ? (
                            <>
                              <button 
                                onClick={async () => {
                                  const remarks = prompt('Approval remarks (optional):') || 'Approved';
                                  await mockApi.updateSportsFeePaymentStatus(userId, pmt.id, 'APPROVED', remarks);
                                  loadData(true);
                                }}
                                className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500 hover:text-white transition-all"
                                title="Approve Payment"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={async () => {
                                  const reason = prompt('Rejection reason:') || 'UTR mismatch';
                                  await mockApi.updateSportsFeePaymentStatus(userId, pmt.id, 'REJECTED', reason);
                                  loadData(true);
                                }}
                                className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500 hover:text-white transition-all"
                                title="Reject Payment"
                              >
                                <X size={14} />
                              </button>
                              <button 
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this payment record?')) {
                                    await mockApi.deleteSportsFeePayment(userId, pmt.id);
                                    loadData(true);
                                  }
                                }}
                                className="p-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500 hover:text-white transition-all"
                                title="Delete Payment"
                              >
                                <Trash2 size={14} />
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">No Actions Available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {feePayments.filter(p => p.status === 'PENDING_VERIFICATION').length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-500">No pending fee payments queue.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sports Fee Payments History */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Sports Fee Payments History (Last 20 transactions)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Student Name</th>
                      <th className="py-3 px-4 font-bold">Fee Description</th>
                      <th className="py-3 px-4 font-bold">Amount Paid</th>
                      <th className="py-3 px-4 font-bold">UTR / Ref</th>
                      <th className="py-3 px-4 font-bold">Submitted By</th>
                      <th className="py-3 px-4 font-bold">Approved By</th>
                      <th className="py-3 px-4 font-bold">Date</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {feePayments.filter(p => p.status !== 'PENDING_VERIFICATION').slice(0, 20).map(pmt => (
                      <tr key={pmt.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{pmt.studentName}</td>
                        <td className="py-3 px-4 text-slate-400">{pmt.invoiceTitle}</td>
                        <td className="py-3 px-4 text-slate-400">₹{pmt.amountPaid.toLocaleString()}</td>
                        <td className="py-3 px-4 font-mono text-slate-350">{pmt.utrNumber || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-400">{pmt.submittedByName || 'Parent/Student'}</td>
                        <td className="py-3 px-4 text-slate-400">{pmt.approvedByName || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{new Date(pmt.submittedAt || pmt.paymentDate).toLocaleDateString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            pmt.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>{pmt.status}</span>
                        </td>
                        <td className="py-3 px-4">
                          {['FINANCE_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                            <button 
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this payment record?')) {
                                  await mockApi.deleteSportsFeePayment(userId, pmt.id);
                                  loadData(true);
                                }
                              }}
                              className="text-red-400 hover:text-red-600 transition-all"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {feePayments.filter(p => p.status !== 'PENDING_VERIFICATION').length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-500">No payment transaction history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses Procurement approvals */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Equipment Expense & Purchase Requests</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Requested By</th>
                      <th className="py-3 px-4 font-bold">Item Detail</th>
                      <th className="py-3 px-4 font-bold">Vendor</th>
                      <th className="py-3 px-4 font-bold">Invoice ID</th>
                      <th className="py-3 px-4 font-bold">Amount Requested</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Payment Status</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {expenses.filter(exp => exp.status === 'PENDING').map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 text-slate-100 font-semibold">{exp.requestedByName}</td>
                        <td className="py-3 px-4 text-slate-400">{exp.title}</td>
                        <td className="py-3 px-4 text-slate-400">{exp.vendor || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-500">{exp.invoiceNumber || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-400">₹{exp.amountRequested.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : exp.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-500'
                          }`}>{exp.status}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.paymentStatus === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>{exp.paymentStatus}</span>
                        </td>
                        <td className="py-3 px-4">
                          {portalRole === 'FINANCE_ADMIN' ? (
                            <>
                              {exp.status === 'PENDING' && (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={async () => {
                                      await mockApi.approveExpense(userId, exp.id, { status: 'APPROVED', amountApproved: exp.amountRequested });
                                      loadData(true);
                                    }}
                                    className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[9px]"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      await mockApi.approveExpense(userId, exp.id, { status: 'REJECTED' });
                                      loadData(true);
                                    }}
                                    className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-[9px]"
                                  >
                                    Reject
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      try {
                                        if (confirm("Are you sure you want to delete this expense request?")) {
                                          await mockApi.deleteSportsExpense(exp.id);
                                          loadData(true);
                                        }
                                      } catch (err: any) {
                                        alert(err.message || "Cannot delete this record because related records exist.");
                                      }
                                    }}
                                    className="px-2 py-1 bg-red-650 text-white rounded text-[9px] hover:bg-red-500 transition-all font-semibold"
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                              {exp.status === 'APPROVED' && exp.paymentStatus === 'PENDING' && (
                                <button 
                                  onClick={async () => {
                                    await mockApi.releaseExpensePayment(userId, exp.id);
                                    loadData(true);
                                  }}
                                  className="px-2.5 py-1 bg-brand-600 text-white rounded text-[9px] font-bold"
                                >
                                  Release Payout
                                </button>
                              )}
                              {exp.status !== 'PENDING' && exp.paymentStatus !== 'PENDING' && (
                                <span className="text-[10px] text-slate-500 font-mono">No Actions Available</span>
                              )}
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">No Actions Available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {expenses.filter(exp => exp.status === 'PENDING').length === 0 && (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-500">No pending expense requests queue.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Equipment Expense Requests History */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Expense Requests History (Last 20 requests)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Requested By</th>
                      <th className="py-3 px-4 font-bold">Item Detail</th>
                      <th className="py-3 px-4 font-bold">Vendor</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {expenseHistory.slice(0, 20).map(exp => (
                      <tr key={exp.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 text-slate-100 font-semibold">{exp.requestedByName}</td>
                        <td className="py-3 px-4 text-slate-400">{exp.title}</td>
                        <td className="py-3 px-4 text-slate-400">{exp.vendor || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-400">₹{exp.amountRequested.toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                          }`}>{exp.status}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.paymentStatus === 'RELEASED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800 text-slate-400'
                          }`}>{exp.paymentStatus}</span>
                        </td>
                      </tr>
                    ))}
                    {expenseHistory.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">No expense history records.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sports payroll processing */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Dedicated Sports Payroll</h3>
                <div className="flex gap-2">
                  <input 
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-850 rounded-xl"
                  />
                  {portalRole === 'FINANCE_ADMIN' && (
                    <button 
                      onClick={async () => {
                        await mockApi.generateMonthlyPayroll(userId, academicSessionId, selectedMonth);
                        alert(`Monthly Payroll generated for month: ${selectedMonth}`);
                        loadData(true);
                      }}
                      className="px-4 py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white text-xs font-bold rounded-xl"
                    >
                      Generate Month Payroll
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Employee</th>
                      <th className="py-3 px-4 font-bold">Role</th>
                      <th className="py-3 px-4 font-bold">Month</th>
                      <th className="py-3 px-4 font-bold">Gross Salary</th>
                      <th className="py-3 px-4 font-bold">Attendance Bonus</th>
                      <th className="py-3 px-4 font-bold">Deductions</th>
                      <th className="py-3 px-4 font-bold">Net Salary</th>
                      <th className="py-3 px-4 font-bold">Payout Status</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {salaryRecords.filter(s => s.salaryMonth === selectedMonth).map(sal => {
                      return (
                        <tr key={sal.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-semibold text-slate-100">{sal.employeeName}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">{sal.employeeType}</td>
                          <td className="py-3 px-4 text-slate-450">{sal.salaryMonth}</td>
                          <td className="py-3 px-4 text-slate-400">₹{sal.grossSalary.toLocaleString()}</td>
                          <td className="py-3 px-4 text-emerald-400 font-semibold font-mono">+₹{sal.bonus.toLocaleString()}</td>
                          <td className="py-3 px-4 text-red-400 font-semibold font-mono">-₹{sal.deductions.toLocaleString()}</td>
                          <td className="py-3 px-4 text-slate-100 font-bold">₹{sal.netSalary.toLocaleString()}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sal.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 
                              sal.status === 'APPROVED' ? 'bg-brand-500/10 text-brand-400' : 
                              sal.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' : 
                              'bg-amber-500/10 text-amber-500'
                            }`}>{sal.status}</span>
                          </td>
                          <td className="py-3 px-4">
                            {portalRole === 'FINANCE_ADMIN' ? (
                              <>
                                {sal.status === 'PENDING' && (
                                  <div className="flex gap-1">
                                    <button 
                                      onClick={async () => {
                                        await mockApi.approveSalaryRecord(userId, sal.id);
                                        loadData(true);
                                      }}
                                      className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[9px] font-bold rounded hover:bg-emerald-500 hover:text-white transition-all"
                                    >
                                      Approve
                                    </button>
                                    <button 
                                      onClick={async () => {
                                        await mockApi.rejectSalaryRecord(userId, sal.id);
                                        loadData(true);
                                      }}
                                      className="px-2.5 py-1 bg-red-500/10 text-red-400 border border-red-500/25 text-[9px] font-bold rounded hover:bg-red-500 hover:text-white transition-all"
                                    >
                                      Reject
                                    </button>
                                  </div>
                                )}
                                {sal.status === 'APPROVED' && (
                                  <button 
                                    onClick={async () => {
                                      const txn = prompt('Enter Bank Transaction ID / Ref:') || '';
                                      await mockApi.paySalaryRecord(userId, sal.id, { transactionId: txn });
                                      loadData(true);
                                    }}
                                    className="px-2.5 py-1 bg-emerald-500 text-white text-[9px] font-bold rounded hover:brightness-110 active:scale-95 transition-all"
                                  >
                                    Release Cash
                                  </button>
                                )}
                                {(sal.status === 'PAID' || sal.status === 'REJECTED') && (
                                  <span className="text-[10px] text-slate-500 font-mono">No Actions</span>
                                )}
                              </>
                            ) : (
                              <span className="text-[10px] text-slate-500 font-mono">No Actions</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {salaryRecords.filter(s => s.salaryMonth === selectedMonth).length === 0 && (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-500">No payroll records computed for selected month.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sports Payroll History */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Salary Payout History (Last 20 records)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Employee</th>
                      <th className="py-3 px-4 font-bold">Role</th>
                      <th className="py-3 px-4 font-bold">Month</th>
                      <th className="py-3 px-4 font-bold">Net Salary Paid</th>
                      <th className="py-3 px-4 font-bold">Transaction ID</th>
                      <th className="py-3 px-4 font-bold">Payment Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {salaryRecords.filter(s => s.status === 'PAID').slice(0, 20).map(sal => {
                      return (
                        <tr key={sal.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 font-semibold text-slate-100">{sal.employeeName}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono text-[10px]">{sal.employeeType}</td>
                          <td className="py-3 px-4 text-slate-450">{sal.salaryMonth}</td>
                          <td className="py-3 px-4 text-emerald-450 font-bold font-mono">₹{sal.netSalary.toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono text-slate-350">{sal.transactionId}</td>
                          <td className="py-3 px-4 text-slate-500 font-mono">{sal.paymentDate ? new Date(sal.paymentDate).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      );
                    })}
                    {salaryRecords.filter(s => s.status === 'PAID').length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">No payroll payment history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Fines verifications */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Fine Payment Queue</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Student Name</th>
                      <th className="py-3 px-4 font-bold">Reason</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold">UTR Reference</th>
                      <th className="py-3 px-4 font-bold">Screenshot</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {finePayments.filter(f => f.status === 'PENDING').map(fine => (
                      <tr key={fine.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{fine.studentName}</td>
                        <td className="py-3 px-4 text-slate-400">{fine.reason}</td>
                        <td className="py-3 px-4 text-slate-400">₹{fine.amount}</td>
                        <td className="py-3 px-4 font-mono text-slate-350">{fine.utrNumber}</td>
                        <td className="py-3 px-4">
                          {fine.paymentScreenshotUrl ? (
                            <a href={fine.paymentScreenshotUrl} target="_blank" rel="noreferrer" className="text-brand-400 font-bold hover:underline">View Screenshot</a>
                          ) : 'No file'}
                        </td>
                        <td className="py-3 px-4 flex gap-1.5">
                          {['FINANCE_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) ? (
                            <>
                              {fine.status === 'PENDING' && ['FINANCE_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                                <>
                                  <button 
                                    onClick={async () => {
                                      await mockApi.approveFinePayment(userId, fine.id, 'APPROVED');
                                      loadData(true);
                                    }}
                                    className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[9px] font-bold hover:bg-emerald-500 hover:text-white transition-all"
                                  >
                                    Approve
                                  </button>
                                  <button 
                                    onClick={async () => {
                                      await mockApi.approveFinePayment(userId, fine.id, 'REJECTED');
                                      loadData(true);
                                    }}
                                    className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-[9px] font-bold hover:bg-red-500 hover:text-white transition-all"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button 
                                onClick={async () => {
                                  if (confirm('Are you sure you want to delete this fine payment record?')) {
                                    await mockApi.deleteSportsFinePayment(userId, fine.id);
                                    loadData(true);
                                  }
                                }}
                                className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-[9px] font-bold hover:bg-red-500 hover:text-white transition-all"
                              >
                                Delete
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono">No Actions Available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {finePayments.filter(f => f.status === 'PENDING').length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-500">No fine verification records.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Sports Fines Payments History */}
            <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Fine Payments History (Last 20 records)</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                      <th className="py-3 px-4 font-bold">Student Name</th>
                      <th className="py-3 px-4 font-bold">Reason</th>
                      <th className="py-3 px-4 font-bold">Amount</th>
                      <th className="py-3 px-4 font-bold">UTR Reference</th>
                      <th className="py-3 px-4 font-bold">Submitted Date</th>
                      <th className="py-3 px-4 font-bold">Status</th>
                      <th className="py-3 px-4 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850">
                    {finePayments.filter(f => f.status !== 'PENDING').slice(0, 20).map(fine => (
                      <tr key={fine.id} className="hover:bg-slate-900/40">
                        <td className="py-3 px-4 font-semibold text-slate-100">{fine.studentName}</td>
                        <td className="py-3 px-4 text-slate-400">{fine.reason}</td>
                        <td className="py-3 px-4 text-slate-400">₹{fine.amount}</td>
                        <td className="py-3 px-4 font-mono text-slate-350">{fine.utrNumber || 'N/A'}</td>
                        <td className="py-3 px-4 text-slate-500 font-mono">{fine.submittedAt ? new Date(fine.submittedAt).toLocaleDateString() : 'N/A'}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            fine.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' : fine.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-505'
                          }`}>{fine.status}</span>
                        </td>
                        <td className="py-3 px-4">
                          {['FINANCE_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                            <button 
                              onClick={async () => {
                                if (confirm('Are you sure you want to delete this fine payment record?')) {
                                  await mockApi.deleteSportsFinePayment(userId, fine.id);
                                  loadData(true);
                                }
                              }}
                              className="text-red-400 hover:text-red-650 transition-all"
                              title="Delete Record"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {finePayments.filter(f => f.status !== 'PENDING').length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500">No fine payment history.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            </div>
          </FinanceErrorBoundary>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            16. SPORTS FEES (STUDENT ACCESS INVOICES & FINES)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'fees' && (
          ['STUDENT', 'PARENT'].includes(portalRole) ? (
            <div className="space-y-6">
              
              {/* Regular Sports Invoices */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Invoice Dues</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fees.filter(fee => fee.studentId === studentProfileId).map(fee => {
                    const latestPayment = feePayments
                      .filter(p => p.invoiceId === fee.id)
                      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
                    return (
                      <div key={fee.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-slate-100 text-sm">{fee.invoiceTitle}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              fee.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                              fee.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' :
                              fee.status === 'PENDING_VERIFICATION' ? 'bg-amber-500/10 text-amber-500' :
                              fee.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                              'bg-slate-800 text-slate-400'
                            }`}>{fee.status === 'PAID' ? 'Payment Approved' : fee.status}</span>
                          </div>
                          {fee.invoiceDescription && <p className="text-xs text-slate-400 mt-1">{fee.invoiceDescription}</p>}
                          <p className="text-xs text-slate-400 mt-2">Due Date: {fee.dueDate}</p>
                          <p className="text-2xl font-extrabold text-white mt-4">₹{fee.amount}</p>
                        </div>

                        {fee.status === 'UNPAID' && (
                          <button 
                            onClick={() => { setPaymentForm(prev => ({ ...prev, sportsFeeId: fee.id })); setShowFeePayment(true); }}
                            className="w-full py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs rounded-xl hover:brightness-110 active:scale-98 transition-all"
                          >
                            Pay & Upload Screenshot
                          </button>
                        )}

                        {fee.status === 'PENDING_VERIFICATION' && (
                          <button 
                            disabled
                            className="w-full py-2 bg-slate-850 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed border border-slate-800"
                          >
                            Payment Pending Verification
                          </button>
                        )}

                        {(fee.status === 'APPROVED' || fee.status === 'PAID') && (
                          <button 
                            disabled
                            className="w-full py-2 bg-emerald-950/20 text-emerald-400 font-bold text-xs rounded-xl cursor-not-allowed border border-emerald-900/30"
                          >
                            Payment Approved
                          </button>
                        )}

                        {fee.status === 'REJECTED' && (
                          <div className="space-y-3">
                            <div className="p-3 bg-red-550/10 border border-red-500/20 rounded-xl text-xs space-y-1">
                              <div className="flex items-center gap-1.5 text-red-400 font-bold">
                                <AlertTriangle size={14} />
                                <span>Payment Rejected</span>
                              </div>
                              {latestPayment?.rejectionReason && (
                                <p className="text-slate-350">
                                  <span className="font-semibold text-slate-400">Reason:</span> {latestPayment.rejectionReason}
                                </p>
                              )}
                            </div>
                            <button 
                              onClick={() => { setPaymentForm(prev => ({ ...prev, sportsFeeId: fee.id })); setShowFeePayment(true); }}
                              className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-500 text-white font-bold text-xs rounded-xl hover:brightness-110 active:scale-98 transition-all"
                            >
                              Resubmit Payment Proof
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {fees.filter(fee => fee.studentId === studentProfileId).length === 0 && (
                    <div className="col-span-2 py-6 text-center text-slate-500">No sports invoices issued for this student.</div>
                  )}
                </div>
              </div>

              {/* Payment Submission History */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Payment History</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Amount</th>
                        <th className="py-3 px-4 font-bold">UTR</th>
                        <th className="py-3 px-4 font-bold">Status</th>
                        <th className="py-3 px-4 font-bold">Submission Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {feePayments.filter(p => p.studentId === studentProfileId).map(pmt => (
                        <tr key={pmt.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-4 text-slate-200 font-semibold">₹{pmt.amountPaid.toLocaleString()}</td>
                          <td className="py-3 px-4 font-mono text-slate-350">{pmt.utrNumber}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              pmt.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                              pmt.status === 'PENDING_VERIFICATION' ? 'bg-amber-500/10 text-amber-500' :
                              'bg-red-500/10 text-red-400'
                            }`}>{pmt.status}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 font-mono">{new Date(pmt.submittedAt || pmt.paymentDate).toLocaleDateString()}</td>
                        </tr>
                      ))}
                      {feePayments.filter(p => p.studentId === studentProfileId).length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-slate-500">No payment transaction records found.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Discipline Fines */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Disciplinary Fines</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fines.filter(f => f.studentId === studentProfileId).map(fine => (
                    <div key={fine.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between gap-4">
                      <div>
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-slate-100 text-sm">{fine.reason}</h4>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            fine.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'
                          }`}>{fine.status}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-2">Due Date: {fine.dueDate}</p>
                        <p className="text-2xl font-extrabold text-white mt-4">₹{fine.amount}</p>
                      </div>

                      {fine.status === 'UNPAID' && !fine.utrNumber && (
                        <button 
                          onClick={() => { setActiveFineId(fine.id); setShowPayFine(true); }}
                          className="w-full py-2 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold text-xs rounded-xl"
                        >
                          Submit Fine Payment
                        </button>
                      )}
                      {fine.status === 'UNPAID' && fine.utrNumber && (
                        <button disabled className="w-full py-2 bg-slate-850 text-slate-400 font-bold text-xs rounded-xl cursor-not-allowed">
                          Payment Pending Verification
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

            </div>
          ) : (
            <FinanceErrorBoundary>
              <div className="space-y-6">
                
                {/* Create Sports Invoice Control Banner */}
                <div className="flex justify-between items-center bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Invoice Control Center</h3>
                    <p className="text-xs text-slate-400 mt-1">Generate fee invoices, track students due states, and handle payment verifications.</p>
                  </div>
                  {['FINANCE_ADMIN', 'SPORTS_ADMIN', 'SCHOOL_ADMIN'].includes(portalRole) && (
                    <button
                      onClick={() => {
                        setNewInvoice({
                          studentId: '',
                          sportId: '',
                          invoiceTitle: '',
                          invoiceDescription: '',
                          invoiceCategory: 'Coaching Fee',
                          amount: 0,
                          dueDate: new Date(Date.now() + 86400000 * 7).toISOString().split('T')[0],
                          lateFee: 0,
                          remarks: ''
                        });
                        setStudentSearch('');
                        setShowAddInvoice(true);
                      }}
                      className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10 hover:brightness-110 active:scale-95 transition-all"
                    >
                      <Plus size={15} /> Create Sports Invoice
                    </button>
                  )}
                </div>

                {/* Invoice History Grid */}
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Invoice History</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                          <th className="py-3 px-4 font-bold">Invoice Number</th>
                          <th className="py-3 px-4 font-bold">Student</th>
                          <th className="py-3 px-4 font-bold">Title</th>
                          <th className="py-3 px-4 font-bold">Category</th>
                          <th className="py-3 px-4 font-bold">Amount</th>
                          <th className="py-3 px-4 font-bold">Status</th>
                          <th className="py-3 px-4 font-bold">Created Date</th>
                          <th className="py-3 px-4 font-bold">Created By</th>
                          <th className="py-3 px-4 font-bold">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {fees.map(inv => (
                          <tr key={inv.id} className="hover:bg-slate-900/40">
                            <td className="py-3 px-4 font-mono text-brand-400">{inv.invoiceNumber}</td>
                            <td className="py-3 px-4 font-semibold text-slate-100">{inv.studentName}</td>
                            <td className="py-3 px-4 text-slate-300">{inv.invoiceTitle}</td>
                            <td className="py-3 px-4 text-slate-400">{inv.invoiceCategory}</td>
                            <td className="py-3 px-4 text-slate-200">₹{inv.amount.toLocaleString()}</td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                inv.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                                inv.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-400' :
                                inv.status === 'PENDING_VERIFICATION' ? 'bg-amber-500/10 text-amber-500' :
                                inv.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                                'bg-slate-800 text-slate-400'
                              }`}>{inv.status}</span>
                            </td>
                            <td className="py-3 px-4 text-slate-500 font-mono">{new Date(inv.createdAt).toLocaleDateString()}</td>
                            <td className="py-3 px-4 text-slate-400">{inv.createdByName}</td>
                            <td className="py-3 px-4 flex gap-1 items-center">
                              <button
                                onClick={() => {
                                  setSelectedViewInvoice(inv);
                                  setShowViewInvoice(true);
                                }}
                                className="text-[10px] font-bold bg-slate-800 text-slate-300 px-2 py-1 rounded border border-slate-700 hover:bg-slate-700 hover:text-white transition-all font-mono"
                              >
                                View
                              </button>

                              {['FINANCE_ADMIN', 'SPORTS_ADMIN', 'SUPER_ADMIN'].includes(portalRole) && (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditInvoiceForm({
                                        id: inv.id,
                                        sportId: inv.sportId || '',
                                        invoiceTitle: inv.invoiceTitle,
                                        invoiceDescription: inv.invoiceDescription || '',
                                        invoiceCategory: inv.invoiceCategory,
                                        amount: String(inv.amount),
                                        dueDate: inv.dueDate,
                                        remarks: inv.remarks || ''
                                      });
                                      setShowEditInvoice(true);
                                    }}
                                    className="text-[10px] font-bold bg-blue-500/10 text-blue-400 px-2 py-1 rounded border border-blue-500/25 hover:bg-blue-600 hover:text-white transition-all font-mono"
                                  >
                                    Edit
                                  </button>

                                  <button
                                    onClick={async () => {
                                      try {
                                        await mockApi.sendSportsInvoiceNotification(userId, inv.id);
                                        alert('Notification dispatched successfully!');
                                      } catch (err: any) {
                                        alert(`Failed to send notification: ${err.message}`);
                                      }
                                    }}
                                    className="text-[10px] font-bold bg-purple-500/10 text-purple-400 px-2 py-1 rounded border border-purple-500/25 hover:bg-purple-600 hover:text-white transition-all font-mono"
                                    title="Send reminder to student/parent"
                                  >
                                    Notify
                                  </button>

                                  <button
                                    onClick={async () => {
                                      if (confirm('Are you sure you want to delete this invoice?')) {
                                        await mockApi.deleteSportsInvoice(userId, inv.id);
                                        loadData(true);
                                      }
                                    }}
                                    className="text-[10px] font-bold bg-red-500/10 text-red-400 px-2 py-1 rounded border border-red-500/25 hover:bg-red-650 hover:text-white transition-all font-mono"
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                        {fees.length === 0 && (
                          <tr>
                            <td colSpan={9} className="py-6 text-center text-slate-500">No invoice records found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </FinanceErrorBoundary>
          )
        )}

        {/* ─────────────────────────────────────────────────────────────────
            17. REPORTS & ANALYTICS EXPORTS TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'reports' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Live Enterprise Reports Exporter</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { id: 'enrollment', label: 'Sports Participation Report', desc: 'Active student registry per sports and format categories.' },
                { id: 'attendance', label: 'Daily Coach Attendance Report', desc: 'Hour checkout sessions and daily roster checks.' },
                { id: 'leaves', label: 'Coach Leaves Report', desc: 'Log book requests for leave or duty allocations.' },
                ...(portalRole !== 'SPORTS_ADMIN' ? [
                  { id: 'payroll', label: 'Salary Impact & Payroll Report', desc: 'Base salary calculations incorporating deductions/bonus.' },
                  { id: 'revenue', label: 'Financial Revenue ledger', desc: 'Central sports registry income transaction audits.' }
                ] : []),
                { id: 'equipment', label: 'Equipment Expenses Report', desc: 'Checkout inventory and procurement purchase orders.' }
              ].map(rep => (
                <div key={rep.id} className="p-5 bg-slate-900/60 border border-slate-850 rounded-2xl flex flex-col justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-slate-100 text-xs">{rep.label}</h4>
                    <p className="text-[11px] text-slate-400 mt-1">{rep.desc}</p>
                  </div>
                  
                  <div className="flex gap-1.5 pt-3 border-t border-slate-800">
                    <button 
                      onClick={() => exportReport(rep.id, 'PDF')}
                      className="flex-1 py-1.5 bg-red-600/10 text-red-400 border border-red-500/20 rounded-lg text-[10px] font-bold"
                    >
                      PDF
                    </button>
                    <button 
                      onClick={() => exportReport(rep.id, 'CSV')}
                      className="flex-1 py-1.5 bg-brand-600/10 text-brand-400 border border-brand-500/20 rounded-lg text-[10px] font-bold"
                    >
                      CSV
                    </button>
                    <button 
                      onClick={() => exportReport(rep.id, 'EXCEL')}
                      className="flex-1 py-1.5 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold"
                    >
                      Excel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            18. AUDIT LOGS TRAIL
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'audit-logs' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider font-mono">Central Audit Logs Trail</h3>
            <div className="overflow-y-auto max-h-96">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                    <th className="py-2.5 px-4 font-bold">User</th>
                    <th className="py-2.5 px-4 font-bold">Role</th>
                    <th className="py-2.5 px-4 font-bold">Action Type</th>
                    <th className="py-2.5 px-4 font-bold">Affected Record</th>
                    <th className="py-2.5 px-4 font-bold">IP Address</th>
                    <th className="py-2.5 px-4 font-bold">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {activityLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-900/40">
                      <td className="py-2 px-4 text-slate-100">{log.userName}</td>
                      <td className="py-2 px-4 font-mono text-[10px] text-slate-500">{log.userRole}</td>
                      <td className="py-2 px-4 font-semibold text-brand-400">{log.actionType}</td>
                      <td className="py-2 px-4 text-slate-400">{log.affectedRecord}</td>
                      <td className="py-2 px-4 text-slate-500 font-mono">{log.ipAddress}</td>
                      <td className="py-2 px-4 text-slate-500 font-mono">{new Date(log.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </section>

      {/* ─────────────────────────────────────────────────────────────────
          MODALS & OVERLAYS
          ───────────────────────────────────────────────────────────────── */}
      {showAddSport && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Register New Sport</h3>
              <button onClick={() => setShowAddSport(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleAddSport} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Sport Name</label>
                <input 
                  type="text" 
                  value={newSport.name}
                  onChange={(e) => setNewSport(prev => ({ ...prev, name: e.target.value }))}
                  required 
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  placeholder="e.g. Volleyball"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Type</label>
                  <select 
                    value={newSport.type}
                    onChange={(e) => setNewSport(prev => ({ ...prev, type: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="OUTDOOR">Outdoor</option>
                    <option value="INDOOR">Indoor</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Format</label>
                  <select 
                    value={newSport.format}
                    onChange={(e) => setNewSport(prev => ({ ...prev, format: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="TEAM">Team Sport</option>
                    <option value="INDIVIDUAL">Individual Sport</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Category</label>
                <select 
                  value={newSport.categoryId}
                  onChange={(e) => setNewSport(prev => ({ ...prev, categoryId: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                >
                  <option value="">-- Choose Category --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Description</label>
                <textarea 
                  value={newSport.description}
                  onChange={(e) => setNewSport(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  rows={3}
                  placeholder="Sport rules and criteria details..."
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl border border-brand-400/25"
              >
                Register Sport
              </button>
            </form>
          </div>
        </div>
      )}

      {showAddSportsAdmin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Register Sports Admin</h3>
              <button onClick={() => setShowAddSportsAdmin(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleAddSportsAdmin} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">First Name</label>
                  <input type="text" value={newSportsAdmin.firstName} onChange={(e) => setNewSportsAdmin(prev => ({ ...prev, firstName: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Last Name</label>
                  <input type="text" value={newSportsAdmin.lastName} onChange={(e) => setNewSportsAdmin(prev => ({ ...prev, lastName: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Email Address</label>
                <input type="email" value={newSportsAdmin.email} onChange={(e) => setNewSportsAdmin(prev => ({ ...prev, email: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Mobile</label>
                  <input type="text" value={newSportsAdmin.phone} onChange={(e) => setNewSportsAdmin(prev => ({ ...prev, phone: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Employee ID</label>
                  <input type="text" value={newSportsAdmin.employeeId} onChange={(e) => setNewSportsAdmin(prev => ({ ...prev, employeeId: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Login Password</label>
                <input type="password" value={newSportsAdmin.password} onChange={(e) => setNewSportsAdmin(prev => ({ ...prev, password: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl">Register Admin</button>
            </form>
          </div>
        </div>
      )}

      {showAddCoach && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Register Sports Coach</h3>
              <button onClick={() => setShowAddCoach(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleAddCoach} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Coach Full Name</label>
                  <input type="text" value={newCoach.name} onChange={(e) => setNewCoach(prev => ({ ...prev, name: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Email Address</label>
                  <input type="email" value={newCoach.email} onChange={(e) => setNewCoach(prev => ({ ...prev, email: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Mobile</label>
                  <input type="text" value={newCoach.phone} onChange={(e) => setNewCoach(prev => ({ ...prev, phone: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Employee ID</label>
                  <input type="text" value={newCoach.employeeId} onChange={(e) => setNewCoach(prev => ({ ...prev, employeeId: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Specialization</label>
                  <input type="text" value={newCoach.specialization} onChange={(e) => setNewCoach(prev => ({ ...prev, specialization: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="e.g. Football" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Salary Package</label>
                  <input type="number" value={newCoach.salary} onChange={(e) => setNewCoach(prev => ({ ...prev, salary: Number(e.target.value) }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Experience Years</label>
                  <input type="number" value={newCoach.experienceYears} onChange={(e) => setNewCoach(prev => ({ ...prev, experienceYears: Number(e.target.value) }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Certification</label>
                  <input type="text" value={newCoach.certification} onChange={(e) => setNewCoach(prev => ({ ...prev, certification: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="e.g. AFC Licence" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Login Password</label>
                <input type="password" value={newCoach.password} onChange={(e) => setNewCoach(prev => ({ ...prev, password: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl">Register Coach</button>
            </form>
          </div>
        </div>
      )}

      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Create Team Roster</h3>
              <button onClick={() => setShowCreateTeam(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleCreateTeam} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Team Name</label>
                <input type="text" value={newTeam.name} onChange={(e) => setNewTeam(prev => ({ ...prev, name: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="e.g. Varsity Football A" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Associated Sport</label>
                  <select value={newTeam.sportId} onChange={(e) => setNewTeam(prev => ({ ...prev, sportId: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="">-- Choose Sport --</option>
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Assigned Coach</label>
                  <select value={newTeam.coachId} onChange={(e) => setNewTeam(prev => ({ ...prev, coachId: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="">-- Choose Coach --</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.coachName}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Age Group</label>
                  <select value={newTeam.ageGroup} onChange={(e) => setNewTeam(prev => ({ ...prev, ageGroup: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="U-14">Under 14</option>
                    <option value="U-16">Under 16</option>
                    <option value="U-19">Under 19</option>
                    <option value="OPEN">Open Category</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Gender Format</label>
                  <select value={newTeam.gender} onChange={(e) => setNewTeam(prev => ({ ...prev, gender: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="MALE">Boys Only</option>
                    <option value="FEMALE">Girls Only</option>
                    <option value="MIXED">Co-Ed Mixed</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl">Establish Team</button>
            </form>
          </div>
        </div>
      )}

      {showApplyLeave && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Apply Leave / Duty off</h3>
              <button onClick={() => setShowApplyLeave(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleApplyLeave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Start Date</label>
                  <input type="date" value={leaveForm.startDate} onChange={(e) => setLeaveForm(prev => ({ ...prev, startDate: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">End Date</label>
                  <input type="date" value={leaveForm.endDate} onChange={(e) => setLeaveForm(prev => ({ ...prev, endDate: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Leave Type</label>
                <select value={leaveForm.leaveType} onChange={(e) => setLeaveForm(prev => ({ ...prev, leaveType: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                  <option value="CASUAL">Casual Leave</option>
                  <option value="SICK">Sick Leave</option>
                  <option value="MEDICAL">Medical Leave</option>
                  <option value="DUTY_LEAVE">Duty Leave (Training/Tournaments)</option>
                  <option value="OTHER">Other Reason</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Reason Description</label>
                <textarea value={leaveForm.reason} onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))} required rows={3} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="Describe the reason for leave..." />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl">Submit Leave Application</button>
            </form>
          </div>
        </div>
      )}

      {showRequestCorrection && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Request Attendance Correction</h3>
              <button onClick={() => setShowRequestCorrection(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleRequestCorrection} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Select Date Log to Correct</label>
                <select 
                  value={correctionForm.attendanceId} 
                  onChange={(e) => setCorrectionForm(prev => ({ ...prev, attendanceId: e.target.value }))}
                  required 
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl"
                >
                  <option value="">-- Choose Date Log --</option>
                  {coachAttendance.filter(a => a.coachId === currentCoach?.id).map(a => (
                    <option key={a.id} value={a.id}>{a.attendanceDate} ({a.status})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Corrected Status</label>
                <select value={correctionForm.requestedStatus} onChange={(e) => setCorrectionForm(prev => ({ ...prev, requestedStatus: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                  <option value="PRESENT">Present</option>
                  <option value="LATE">Late Arrival</option>
                  <option value="HALF_DAY">Half Day</option>
                  <option value="TRAINING_DUTY">Training Duty</option>
                  <option value="TOURNAMENT_DUTY">Tournament Duty</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Check In</label>
                  <input type="time" value={correctionForm.requestedCheckIn} onChange={(e) => setCorrectionForm(prev => ({ ...prev, requestedCheckIn: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Check Out</label>
                  <input type="time" value={correctionForm.requestedCheckOut} onChange={(e) => setCorrectionForm(prev => ({ ...prev, requestedCheckOut: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Correction Reason</label>
                <textarea value={correctionForm.reason} onChange={(e) => setCorrectionForm(prev => ({ ...prev, reason: e.target.value }))} required rows={2} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="Reason for change..." />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl">Submit Correction Request</button>
            </form>
          </div>
        </div>
      )}

      {showSchedulePractice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Schedule Training Session</h3>
              <button onClick={() => setShowSchedulePractice(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleSchedulePractice} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Session Name</label>
                <input type="text" value={newSession.sessionName} onChange={(e) => setNewSession(prev => ({ ...prev, sessionName: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="e.g. Morning Conditioning" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Sport</label>
                  <select value={newSession.sportId} onChange={(e) => setNewSession(prev => ({ ...prev, sportId: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="">-- Choose Sport --</option>
                    {sports.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Team Roster</label>
                  <select value={newSession.teamId} onChange={(e) => setNewSession(prev => ({ ...prev, teamId: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="">-- Single Group --</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-slate-400">Date</label>
                  <input type="date" value={newSession.sessionDate} onChange={(e) => setNewSession(prev => ({ ...prev, sessionDate: e.target.value }))} required className="w-full px-2 py-2 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div>
                  <label className="text-slate-400">Start Time</label>
                  <input type="text" value={newSession.startTime} onChange={(e) => setNewSession(prev => ({ ...prev, startTime: e.target.value }))} required className="w-full px-2 py-2 bg-slate-900 border border-slate-800 rounded-xl" placeholder="04:00 PM" />
                </div>
                <div>
                  <label className="text-slate-400">End Time</label>
                  <input type="text" value={newSession.endTime} onChange={(e) => setNewSession(prev => ({ ...prev, endTime: e.target.value }))} required className="w-full px-2 py-2 bg-slate-900 border border-slate-800 rounded-xl" placeholder="06:00 PM" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Venue</label>
                  <input type="text" value={newSession.venue} onChange={(e) => setNewSession(prev => ({ ...prev, venue: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="e.g. Field 1" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Assigned Coach</label>
                  <select value={newSession.coachId} onChange={(e) => setNewSession(prev => ({ ...prev, coachId: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="">-- Choose Coach --</option>
                    {coaches.map(c => <option key={c.id} value={c.id}>{c.coachName}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl">Schedule Session</button>
            </form>
          </div>
        </div>
      )}

      {showFeePayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Submit Invoice Payment</h3>
              <button onClick={() => setShowFeePayment(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            {schoolPaymentSettings ? (
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
                <p className="text-[10px] font-bold text-slate-350 uppercase font-mono tracking-wider">School Payment Account Details</p>
                
                {schoolPaymentSettings.qrPaymentEnabled && schoolPaymentSettings.qrCodeUrl && (
                  <div className="flex flex-col items-center justify-center border-b border-slate-800 pb-2 mb-2">
                    <img 
                      src={schoolPaymentSettings.qrCodeUrl} 
                      alt="Payment QR" 
                      className="w-24 h-24 object-contain rounded-lg border border-slate-850 bg-white p-1" 
                    />
                    <p className="text-[10px] font-mono text-slate-400 mt-1.5">UPI ID: {schoolPaymentSettings.upiId || 'N/A'}</p>
                  </div>
                )}

                {schoolPaymentSettings.bankTransferEnabled && (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-slate-400">
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">Account Holder</span>
                      <span className="text-slate-200 font-semibold">{schoolPaymentSettings.accountHolderName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">Bank Name</span>
                      <span className="text-slate-200 font-semibold">{schoolPaymentSettings.bankName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">Account Number</span>
                      <span className="text-slate-200 font-mono font-semibold">{schoolPaymentSettings.accountNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">IFSC Code</span>
                      <span className="text-slate-200 font-mono font-semibold">{schoolPaymentSettings.ifscCode || 'N/A'}</span>
                    </div>
                  </div>
                )}

                {schoolPaymentSettings.paymentInstructions && (
                  <p className="text-[9px] text-slate-400 italic border-t border-slate-800 pt-1.5 mt-1.5">
                    Instructions: {schoolPaymentSettings.paymentInstructions}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-500 text-[10px]">
                Loading school payment credentials...
              </div>
            )}

            <form onSubmit={handleFeePayment} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Payment Method</label>
                <select 
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                >
                  <option value="UPI">UPI</option>
                  <option value="NET_BANKING">Net Banking</option>
                  <option value="CASH">Cash Deposit</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">UTR / Reference Number</label>
                <input 
                  type="text" 
                  value={paymentForm.utrNumber}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, utrNumber: e.target.value }))}
                  required 
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  placeholder="Enter UTR Reference ID"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Upload Payment Receipt Screenshot</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleScreenshotUpload(e, false)}
                  required={!paymentForm.screenshotUrl}
                  className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600/20 file:text-brand-400 hover:file:bg-brand-600/30 bg-slate-900 border border-slate-800 rounded-xl px-2 py-2"
                />
                {uploading && <p className="text-[10px] text-amber-500 animate-pulse mt-1">Uploading file to Supabase storage...</p>}
                {paymentForm.screenshotUrl && (
                  <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Proof uploaded successfully.
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Remarks (Optional)</label>
                <textarea 
                  value={paymentForm.remarks}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, remarks: e.target.value }))}
                  placeholder="Any extra comments regarding this payment..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={uploading || !paymentForm.screenshotUrl}
                className={`w-full py-3 text-white font-bold rounded-xl border border-brand-400/25 ${uploading || !paymentForm.screenshotUrl ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-none' : 'bg-gradient-to-r from-brand-600 to-brand-500'}`}
              >
                Submit Payment For Verification
              </button>
            </form>
          </div>
        </div>
      )}

      {showPayFine && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Pay Disciplinary Fine</h3>
              <button onClick={() => { setShowPayFine(false); setActiveFineId(null); }} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            {schoolPaymentSettings ? (
              <div className="p-3 bg-slate-900/60 border border-slate-800/80 rounded-xl space-y-2">
                <p className="text-[10px] font-bold text-slate-350 uppercase font-mono tracking-wider">School Payment Account Details</p>
                
                {schoolPaymentSettings.qrPaymentEnabled && schoolPaymentSettings.qrCodeUrl && (
                  <div className="flex flex-col items-center justify-center border-b border-slate-800 pb-2 mb-2">
                    <img 
                      src={schoolPaymentSettings.qrCodeUrl} 
                      alt="Payment QR" 
                      className="w-24 h-24 object-contain rounded-lg border border-slate-850 bg-white p-1" 
                    />
                    <p className="text-[10px] font-mono text-slate-400 mt-1.5">UPI ID: {schoolPaymentSettings.upiId || 'N/A'}</p>
                  </div>
                )}

                {schoolPaymentSettings.bankTransferEnabled && (
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] text-slate-400">
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">Account Holder</span>
                      <span className="text-slate-200 font-semibold">{schoolPaymentSettings.accountHolderName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">Bank Name</span>
                      <span className="text-slate-200 font-semibold">{schoolPaymentSettings.bankName || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">Account Number</span>
                      <span className="text-slate-200 font-mono font-semibold">{schoolPaymentSettings.accountNumber || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-semibold text-slate-500 uppercase block font-mono">IFSC Code</span>
                      <span className="text-slate-200 font-mono font-semibold">{schoolPaymentSettings.ifscCode || 'N/A'}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-center text-slate-500 text-[10px]">
                Loading school payment credentials...
              </div>
            )}

            <form onSubmit={handlePayFine} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400 block font-semibold">UTR / Reference Number</label>
                <input type="text" value={finePaymentForm.utrNumber} onChange={(e) => setFinePaymentForm(prev => ({ ...prev, utrNumber: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none" placeholder="UTR Reference ID" />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Upload Payment Receipt Screenshot</label>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => handleScreenshotUpload(e, true)}
                  required={!finePaymentForm.screenshotUrl}
                  className="w-full text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-brand-600/20 file:text-brand-400 hover:file:bg-brand-600/30 bg-slate-900 border border-slate-800 rounded-xl px-2 py-2"
                />
                {uploading && <p className="text-[10px] text-amber-500 animate-pulse mt-1">Uploading file to Supabase storage...</p>}
                {finePaymentForm.screenshotUrl && (
                  <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Proof uploaded successfully.
                  </p>
                )}
              </div>
              <button 
                type="submit" 
                disabled={uploading || !finePaymentForm.screenshotUrl}
                className={`w-full py-3 text-white font-bold rounded-xl ${uploading || !finePaymentForm.screenshotUrl ? 'bg-slate-800 text-slate-500 cursor-not-allowed border-none' : 'bg-red-650 hover:bg-red-500'}`}
              >
              Submit Fine Payment
            </button>
          </form>
        </div>
      </div>
    )}

    {showAddInvoice && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Create Sports Invoice</h3>
            <button onClick={() => setShowAddInvoice(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
          </div>
          
          <form onSubmit={handleCreateSportsInvoice} className="space-y-4 text-xs">
            <div className="space-y-1 relative">
              <label className="block text-slate-400 font-semibold">Select Student</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search student by name, admission no, or class..."
                  value={studentSearch}
                  onChange={(e) => {
                    setStudentSearch(e.target.value);
                    setShowStudentDropdown(true);
                  }}
                  onFocus={() => setShowStudentDropdown(true)}
                  onBlur={() => setTimeout(() => setShowStudentDropdown(false), 250)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none text-xs"
                />
                {studentSearch && (
                  <button
                    type="button"
                    onClick={() => {
                      setNewInvoice(prev => ({ ...prev, studentId: '' }));
                      setStudentSearch('');
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                  >
                    Clear
                  </button>
                )}
              </div>
              {showStudentDropdown && (
                <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-900">
                  {allStudents.filter(s => 
                    s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                    s.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase()) ||
                    (s.className || '').toLowerCase().includes(studentSearch.toLowerCase())
                  ).length > 0 ? (
                    allStudents.filter(s => 
                      s.name.toLowerCase().includes(studentSearch.toLowerCase()) || 
                      s.admissionNumber.toLowerCase().includes(studentSearch.toLowerCase()) ||
                      (s.className || '').toLowerCase().includes(studentSearch.toLowerCase())
                    ).map(s => (
                      <div
                        key={s.id}
                        onMouseDown={() => {
                          setNewInvoice(prev => ({ ...prev, studentId: s.id }));
                          setStudentSearch(`${s.name} (${s.admissionNumber}) - Class ${s.className || 'N/A'}`);
                          setShowStudentDropdown(false);
                        }}
                        className="px-4 py-2 hover:bg-brand-600/20 cursor-pointer text-left text-xs transition-colors"
                      >
                        <div className="font-semibold text-slate-100">{s.name}</div>
                        <div className="text-[10px] text-slate-400">ADM: {s.admissionNumber} | Class: {s.className || 'N/A'}</div>
                      </div>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-center text-slate-500 text-xs">No matching students found</div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">Select Sport</label>
              <select
                value={newInvoice.sportId}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, sportId: e.target.value }))}
                required
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
              >
                <option value="">Select Sport</option>
                {sports.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">Invoice Title</label>
              <input 
                type="text"
                value={newInvoice.invoiceTitle}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, invoiceTitle: e.target.value }))}
                required
                placeholder="e.g. Registration Fee Q1"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">Description</label>
              <textarea 
                value={newInvoice.invoiceDescription}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, invoiceDescription: e.target.value }))}
                placeholder="Details about this invoice..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Category</label>
                <select
                  value={newInvoice.invoiceCategory}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, invoiceCategory: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                >
                  <option value="Registration Fee">Registration Fee</option>
                  <option value="Coaching Fee">Coaching Fee</option>
                  <option value="Tournament Fee">Tournament Fee</option>
                  <option value="Equipment Fee">Equipment Fee</option>
                  <option value="Fine">Fine</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Amount (₹)</label>
                <input 
                  type="number"
                  value={newInvoice.amount || ''}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, amount: Number(e.target.value) }))}
                  required
                  placeholder="0"
                  min="1"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Due Date</label>
                <input 
                  type="date"
                  value={newInvoice.dueDate}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, dueDate: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Late Fee (₹)</label>
                <input 
                  type="number"
                  value={newInvoice.lateFee || ''}
                  onChange={(e) => setNewInvoice(prev => ({ ...prev, lateFee: Number(e.target.value) }))}
                  placeholder="0"
                  min="0"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-slate-400 font-semibold">Remarks</label>
              <input 
                type="text"
                value={newInvoice.remarks}
                onChange={(e) => setNewInvoice(prev => ({ ...prev, remarks: e.target.value }))}
                placeholder="Additional terms or notes"
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
              />
            </div>

            <button 
              type="submit" 
              disabled={submittingInvoice}
              className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl border border-brand-400/25 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-none transition-all"
            >
              {submittingInvoice ? 'Generating Invoice...' : 'Generate Invoice'}
            </button>
          </form>
        </div>
      </div>
    )}

    {showIssueFine && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Issue Disciplinary Fine</h3>
              <button onClick={() => setShowIssueFine(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleIssueFine} className="space-y-4 text-xs">
              <div className="space-y-1 relative">
                <label className="block text-slate-400 font-semibold">Select Student</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search student by name, admission no, or class..."
                    value={fineStudentSearch}
                    onChange={(e) => {
                      setFineStudentSearch(e.target.value);
                      setShowFineStudentDropdown(true);
                    }}
                    onFocus={() => setShowFineStudentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowFineStudentDropdown(false), 250)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none text-xs"
                  />
                  {fineStudentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setFineForm(prev => ({ ...prev, studentId: '' }));
                        setFineStudentSearch('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {showFineStudentDropdown && (
                  <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl divide-y divide-slate-900">
                    {allStudents.filter(s => 
                      s.name.toLowerCase().includes(fineStudentSearch.toLowerCase()) || 
                      s.admissionNumber.toLowerCase().includes(fineStudentSearch.toLowerCase()) ||
                      (s.className || '').toLowerCase().includes(fineStudentSearch.toLowerCase())
                    ).length > 0 ? (
                      allStudents.filter(s => 
                        s.name.toLowerCase().includes(fineStudentSearch.toLowerCase()) || 
                        s.admissionNumber.toLowerCase().includes(fineStudentSearch.toLowerCase()) ||
                        (s.className || '').toLowerCase().includes(fineStudentSearch.toLowerCase())
                      ).map(s => (
                        <div
                          key={s.id}
                          onMouseDown={() => {
                            setFineForm(prev => ({ ...prev, studentId: s.id }));
                            setFineStudentSearch(`${s.name} (${s.admissionNumber}) - Class ${s.className || 'N/A'}`);
                            setShowFineStudentDropdown(false);
                          }}
                          className="px-4 py-2 hover:bg-brand-600/20 cursor-pointer text-left text-xs transition-colors"
                        >
                          <div className="font-semibold text-slate-100">{s.name}</div>
                          <div className="text-[10px] text-slate-400">ADM: {s.admissionNumber} | Class: {s.className || 'N/A'}</div>
                        </div>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-slate-500 text-xs">No matching students found</div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Fine Amount</label>
                  <input type="number" value={fineForm.amount} onChange={(e) => setFineForm(prev => ({ ...prev, amount: Number(e.target.value) }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Due Date</label>
                  <input type="date" value={fineForm.dueDate} onChange={(e) => setFineForm(prev => ({ ...prev, dueDate: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Reason</label>
                <textarea value={fineForm.reason} onChange={(e) => setFineForm(prev => ({ ...prev, reason: e.target.value }))} required rows={2} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="Description of infraction..." />
              </div>
              <button type="submit" className="w-full py-3 bg-red-650 text-white font-bold rounded-xl">Issue Fine</button>
            </form>
          </div>
        </div>
      )}

      {showRequestExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Request Procurement Purchase</h3>
              <button onClick={() => setShowRequestExpense(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleRequestExpense} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Procurement Title</label>
                <input type="text" value={expenseForm.title} onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="e.g. Volleyball Nets & Balls Pack" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Category</label>
                  <select value={expenseForm.category} onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl">
                    <option value="EQUIPMENT_PURCHASE">Equipment Purchase</option>
                    <option value="TOURNAMENT_EXPENSE">Tournament Expense</option>
                    <option value="OTHER">Other Expense</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Amount Requested</label>
                  <input type="number" value={expenseForm.amountRequested} onChange={(e) => setExpenseForm(prev => ({ ...prev, amountRequested: Number(e.target.value) }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Vendor Detail</label>
                  <input type="text" value={expenseForm.vendor} onChange={(e) => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="e.g. Decathlon Sports" />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Invoice Number</label>
                  <input type="text" value={expenseForm.invoiceNumber} onChange={(e) => setExpenseForm(prev => ({ ...prev, invoiceNumber: e.target.value }))} required className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="Invoice reference" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400">Description</label>
                <textarea value={expenseForm.description} onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))} rows={2} className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl" placeholder="Items quantities, specifications..." />
              </div>
              <button type="submit" className="w-full py-3 bg-brand-600 text-white font-bold rounded-xl">Submit Request</button>
            </form>
          </div>
        </div>
      )}

      {showCreateSalaryRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Create Payroll Request</h3>
              <button onClick={() => setShowCreateSalaryRequest(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
            <form onSubmit={handleCreateSalaryRequest} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-400">Select Employee</label>
                <select 
                  value={newSalaryRequest.employeeId} 
                  onChange={(e) => {
                    const empId = e.target.value;
                    const emp = [
                      ...coaches.map(c => ({ id: c.userId, type: 'COACH' as const, salary: c.salary })),
                      ...sportsAdmins.map(a => ({ id: a.userId, type: 'ADMIN' as const, salary: 25000 }))
                    ].find(x => x.id === empId);

                    setNewSalaryRequest(prev => ({ 
                      ...prev, 
                      employeeId: empId,
                      employeeType: emp ? emp.type : 'COACH',
                      grossSalary: emp ? emp.salary : 0
                    }));
                  }} 
                  required 
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none"
                >
                  <option value="">-- Choose Coach / Admin --</option>
                  <optgroup label="Coaches">
                    {coaches.map(c => (
                      <option key={c.id} value={c.userId}>{c.coachName} (Coach - ₹{c.salary})</option>
                    ))}
                  </optgroup>
                  <optgroup label="Sports Admins">
                    {sportsAdmins.map(a => (
                      <option key={a.id} value={a.userId}>{a.fullName} (Admin)</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Salary Month</label>
                  <input 
                    type="month" 
                    value={newSalaryRequest.salaryMonth} 
                    onChange={(e) => setNewSalaryRequest(prev => ({ ...prev, salaryMonth: e.target.value }))} 
                    required 
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Gross Salary (₹)</label>
                  <input 
                    type="number" 
                    value={newSalaryRequest.grossSalary || ''} 
                    onChange={(e) => setNewSalaryRequest(prev => ({ ...prev, grossSalary: Number(e.target.value) }))} 
                    required 
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-slate-400">Bonus / Allowances (₹)</label>
                  <input 
                    type="number" 
                    value={newSalaryRequest.bonus || ''} 
                    onChange={(e) => setNewSalaryRequest(prev => ({ ...prev, bonus: Number(e.target.value) }))} 
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400">Deductions (₹)</label>
                  <input 
                    type="number" 
                    value={newSalaryRequest.deductions || ''} 
                    onChange={(e) => setNewSalaryRequest(prev => ({ ...prev, deductions: Number(e.target.value) }))} 
                    placeholder="0"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl focus:outline-none" 
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submittingSalaryRequest}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl disabled:bg-slate-800 disabled:text-slate-500 transition-all"
              >
                {submittingSalaryRequest ? 'Submitting Payroll Request...' : 'Submit Payroll Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL: RECORD FEE PAYMENT
          ───────────────────────────────────────────────────────────────── */}
      {showCreateFeePayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Record Fee Payment</h3>
              <button onClick={() => setShowCreateFeePayment(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateFeePayment} className="space-y-4 text-xs">
              <div className="space-y-1 relative">
                <label className="block text-slate-400 font-semibold">Select Student</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search student by name, admission no, or class..."
                    value={feePaymentStudentSearch}
                    onChange={(e) => {
                      setFeePaymentStudentSearch(e.target.value);
                      setShowFeePaymentStudentDropdown(true);
                    }}
                    onFocus={() => setShowFeePaymentStudentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowFeePaymentStudentDropdown(false), 250)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none text-xs"
                  />
                  {feePaymentStudentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewFeePayment(prev => ({ ...prev, studentId: '', invoiceId: '' }));
                        setFeePaymentStudentSearch('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                    >
                      Clear
                    </button>
                  )}
                  {showFeePaymentStudentDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 divide-y divide-slate-900">
                      {allStudents
                        .filter((s: any) => {
                          const q = feePaymentStudentSearch.toLowerCase();
                          return (
                            s.name.toLowerCase().includes(q) || 
                            s.admissionNumber.toLowerCase().includes(q) ||
                            (s.className || '').toLowerCase().includes(q)
                          );
                        })
                        .map((student: any) => (
                          <div
                            key={student.id}
                            onMouseDown={() => {
                              setNewFeePayment(prev => ({ ...prev, studentId: student.id, invoiceId: '' }));
                              setFeePaymentStudentSearch(`${student.name} (${student.admissionNumber}) - Class ${student.className || 'N/A'}`);
                              setShowFeePaymentStudentDropdown(false);
                            }}
                            className="px-4 py-2.5 hover:bg-slate-900 cursor-pointer text-left transition-all"
                          >
                            <p className="font-bold text-slate-200">{student.name}</p>
                            <p className="text-[10px] text-slate-500">ADM: {student.admissionNumber} | Class: {student.className || 'N/A'}</p>
                          </div>
                        ))}
                      {allStudents.filter((s: any) => {
                        const q = feePaymentStudentSearch.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(q) || 
                          s.admissionNumber.toLowerCase().includes(q) ||
                          (s.className || '').toLowerCase().includes(q)
                        );
                      }).length === 0 && (
                        <div className="px-4 py-3 text-slate-500 text-center">No students found.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Select Sports Invoice</label>
                <select
                  value={newFeePayment.invoiceId}
                  onChange={(e) => {
                    const targetInv = fees.find(f => f.id === e.target.value);
                    setNewFeePayment(prev => ({ 
                      ...prev, 
                      invoiceId: e.target.value,
                      amount: targetInv ? String(targetInv.amount) : ''
                    }));
                  }}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                >
                  <option value="">-- Choose Invoice --</option>
                  {fees
                    .filter(f => f.studentId === newFeePayment.studentId)
                    .map(inv => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceTitle} - ₹{inv.amount} ({inv.status})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Paid Amount (₹)</label>
                  <input 
                    type="number"
                    value={newFeePayment.amount}
                    onChange={(e) => setNewFeePayment(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    placeholder="Enter amount"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">UTR Reference Number</label>
                  <input 
                    type="text"
                    value={newFeePayment.utrNumber}
                    onChange={(e) => setNewFeePayment(prev => ({ ...prev, utrNumber: e.target.value }))}
                    required
                    placeholder="UTR-123456"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Screenshot / Receipt URL</label>
                  <input 
                    type="text"
                    value={newFeePayment.screenshotUrl}
                    onChange={(e) => setNewFeePayment(prev => ({ ...prev, screenshotUrl: e.target.value }))}
                    placeholder="https://imgur.com/image.png"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Verification Status</label>
                  <select
                    value={newFeePayment.status}
                    onChange={(e) => setNewFeePayment(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="PENDING_VERIFICATION">Pending Verification</option>
                    <option value="APPROVED">Approved (Mark Paid)</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submittingFeePayment}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl border border-brand-400/25 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-none transition-all"
              >
                {submittingFeePayment ? 'Recording Payment...' : 'Record Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL: RECORD FINE PAYMENT
          ───────────────────────────────────────────────────────────────── */}
      {showCreateFinePayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Record Fine Payment</h3>
              <button onClick={() => setShowCreateFinePayment(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <form onSubmit={handleCreateFinePayment} className="space-y-4 text-xs">
              <div className="space-y-1 relative">
                <label className="block text-slate-400 font-semibold">Select Student</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search student by name, admission no, or class..."
                    value={finePaymentStudentSearch}
                    onChange={(e) => {
                      setFinePaymentStudentSearch(e.target.value);
                      setShowFinePaymentStudentDropdown(true);
                    }}
                    onFocus={() => setShowFinePaymentStudentDropdown(true)}
                    onBlur={() => setTimeout(() => setShowFinePaymentStudentDropdown(false), 250)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none text-xs"
                  />
                  {finePaymentStudentSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewFinePayment(prev => ({ ...prev, studentId: '' }));
                        setFinePaymentStudentSearch('');
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs"
                    >
                      Clear
                    </button>
                  )}
                  {showFinePaymentStudentDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 divide-y divide-slate-900">
                      {allStudents
                        .filter((s: any) => {
                          const q = finePaymentStudentSearch.toLowerCase();
                          return (
                            s.name.toLowerCase().includes(q) || 
                            s.admissionNumber.toLowerCase().includes(q) ||
                            (s.className || '').toLowerCase().includes(q)
                          );
                        })
                        .map((student: any) => (
                          <div
                            key={student.id}
                            onMouseDown={() => {
                              setNewFinePayment(prev => ({ ...prev, studentId: student.id }));
                              setFinePaymentStudentSearch(`${student.name} (${student.admissionNumber}) - Class ${student.className || 'N/A'}`);
                              setShowFinePaymentStudentDropdown(false);
                            }}
                            className="px-4 py-2.5 hover:bg-slate-900 cursor-pointer text-left transition-all"
                          >
                            <p className="font-bold text-slate-200">{student.name}</p>
                            <p className="text-[10px] text-slate-500">ADM: {student.admissionNumber} | Class: {student.className || 'N/A'}</p>
                          </div>
                        ))}
                      {allStudents.filter((s: any) => {
                        const q = finePaymentStudentSearch.toLowerCase();
                        return (
                          s.name.toLowerCase().includes(q) || 
                          s.admissionNumber.toLowerCase().includes(q) ||
                          (s.className || '').toLowerCase().includes(q)
                        );
                      }).length === 0 && (
                        <div className="px-4 py-3 text-slate-500 text-center">No students found.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Fine Reason / Charge Details</label>
                <input 
                  type="text"
                  value={newFinePayment.reason}
                  onChange={(e) => setNewFinePayment(prev => ({ ...prev, reason: e.target.value }))}
                  required
                  placeholder="e.g. Damage to gym equipment"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Fine Amount (₹)</label>
                  <input 
                    type="number"
                    value={newFinePayment.amount}
                    onChange={(e) => setNewFinePayment(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    placeholder="Enter amount"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">UTR Reference ID</label>
                  <input 
                    type="text"
                    value={newFinePayment.utrNumber}
                    onChange={(e) => setNewFinePayment(prev => ({ ...prev, utrNumber: e.target.value }))}
                    required
                    placeholder="UTR-99999"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Proof Image URL</label>
                  <input 
                    type="text"
                    value={newFinePayment.screenshotUrl}
                    onChange={(e) => setNewFinePayment(prev => ({ ...prev, screenshotUrl: e.target.value }))}
                    placeholder="https://imgur.com/image.png"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Status</label>
                  <select
                    value={newFinePayment.status}
                    onChange={(e) => setNewFinePayment(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="PENDING">Pending Approval</option>
                    <option value="APPROVED">Approved (Settled)</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submittingFinePayment}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl border border-brand-400/25 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-none transition-all"
              >
                {submittingFinePayment ? 'Recording Fine Payout...' : 'Record Fine Payout'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL: EDIT INVOICE
          ───────────────────────────────────────────────────────────────── */}
      {showEditInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Modify Sports Invoice</h3>
              <button onClick={() => setShowEditInvoice(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <form onSubmit={handleEditInvoice} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Select Sport</label>
                <select
                  value={editInvoiceForm.sportId}
                  onChange={(e) => setEditInvoiceForm(prev => ({ ...prev, sportId: e.target.value }))}
                  required
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                >
                  <option value="">Select Sport</option>
                  {sports.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Invoice Title</label>
                <input 
                  type="text"
                  value={editInvoiceForm.invoiceTitle}
                  onChange={(e) => setEditInvoiceForm(prev => ({ ...prev, invoiceTitle: e.target.value }))}
                  required
                  placeholder="e.g. Q3 Elite Tennis Coaching"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-slate-400 font-semibold">Description</label>
                <textarea 
                  value={editInvoiceForm.invoiceDescription}
                  onChange={(e) => setEditInvoiceForm(prev => ({ ...prev, invoiceDescription: e.target.value }))}
                  placeholder="Brief details about sports item or program dues..."
                  rows={2}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Category</label>
                  <select
                    value={editInvoiceForm.invoiceCategory}
                    onChange={(e) => setEditInvoiceForm(prev => ({ ...prev, invoiceCategory: e.target.value }))}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  >
                    <option value="Registration Fee">Registration Fee</option>
                    <option value="Coaching Fee">Coaching Fee</option>
                    <option value="Tournament Fee">Tournament Fee</option>
                    <option value="Equipment Fee">Equipment Fee</option>
                    <option value="Fine">Fine</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Amount (₹)</label>
                  <input 
                    type="number"
                    value={editInvoiceForm.amount}
                    onChange={(e) => setEditInvoiceForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    placeholder="0"
                    min="1"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Due Date</label>
                  <input 
                    type="date"
                    value={editInvoiceForm.dueDate}
                    onChange={(e) => setEditInvoiceForm(prev => ({ ...prev, dueDate: e.target.value }))}
                    required
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-slate-400 font-semibold">Remarks</label>
                  <input 
                    type="text"
                    value={editInvoiceForm.remarks}
                    onChange={(e) => setEditInvoiceForm(prev => ({ ...prev, remarks: e.target.value }))}
                    placeholder="e.g. Approved by VC"
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                disabled={updatingInvoice}
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl border border-brand-400/25 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-none transition-all"
              >
                {updatingInvoice ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────
          MODAL: VIEW INVOICE DETAILS
          ───────────────────────────────────────────────────────────────── */}
      {showViewInvoice && selectedViewInvoice && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Invoice Details</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{selectedViewInvoice.invoiceNumber}</p>
              </div>
              <button onClick={() => { setShowViewInvoice(false); setSelectedViewInvoice(null); }} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1.5">
                <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Assigned Student</p>
                <p className="text-slate-200 font-semibold">{selectedViewInvoice.studentName}</p>
                <p className="text-[10px] text-slate-500">Class: {selectedViewInvoice.className || 'N/A'}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Title</p>
                  <p className="text-slate-200 font-medium">{selectedViewInvoice.invoiceTitle}</p>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Category</p>
                  <p className="text-slate-350">{selectedViewInvoice.invoiceCategory}</p>
                </div>
              </div>

              {selectedViewInvoice.invoiceDescription && (
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Description</p>
                  <p className="text-slate-400 leading-relaxed">{selectedViewInvoice.invoiceDescription}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Total Amount</p>
                  <p className="text-lg font-extrabold text-white">₹{selectedViewInvoice.amount.toLocaleString()}</p>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Due Date</p>
                  <p className="text-slate-300 font-mono font-medium">{selectedViewInvoice.dueDate}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Status</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedViewInvoice.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400' :
                    selectedViewInvoice.status === 'PENDING_VERIFICATION' ? 'bg-amber-500/10 text-amber-500' :
                    selectedViewInvoice.status === 'REJECTED' ? 'bg-red-500/10 text-red-400' :
                    'bg-slate-800 text-slate-400'
                  }`}>{selectedViewInvoice.status}</span>
                </div>
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Created By</p>
                  <p className="text-slate-300">{selectedViewInvoice.createdByName} on {new Date(selectedViewInvoice.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {selectedViewInvoice.remarks && (
                <div className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400 font-mono">Remarks</p>
                  <p className="text-slate-400 italic">"{selectedViewInvoice.remarks}"</p>
                </div>
              )}

              <button 
                onClick={() => { setShowViewInvoice(false); setSelectedViewInvoice(null); }}
                className="w-full py-2.5 bg-slate-800 text-slate-200 font-bold rounded-xl border border-slate-700 hover:bg-slate-700 transition-all text-center"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
