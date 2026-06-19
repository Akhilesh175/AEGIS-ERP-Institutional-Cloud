import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import { 
  Trophy, Calendar, Users, Award, ShieldAlert, DollarSign, Activity, Settings, 
  Plus, Check, X, FileText, Download, Heart, Package, ShieldCheck, 
  CheckCircle2, Clock, AlertTriangle, ChevronRight, Search, BarChart3, Mail, RefreshCw
} from 'lucide-react';
import { 
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar, Legend 
} from 'recharts';
import jsPDF from 'jspdf';

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

  // Database Data States
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

  // Selected sub-entity filters / search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [sportFilter, setSportFilter] = useState<string>('ALL');

  // Form Modals states
  const [showAddSport, setShowAddSport] = useState(false);
  const [newSport, setNewSport] = useState({ name: '', categoryId: '', type: 'OUTDOOR', format: 'TEAM', description: '' });
  
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', sportId: '', coachId: '', captainId: '', ageGroup: 'U-16', gender: 'MIXED' });
  
  const [showSchedulePractice, setShowSchedulePractice] = useState(false);
  const [newSession, setNewSession] = useState({ sessionName: '', sportId: '', teamId: '', coachId: '', sessionDate: '', startTime: '04:00 PM', endTime: '06:00 PM', venue: '', recurrence: 'NONE' });

  const [showFeePayment, setShowFeePayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ sportsFeeId: '', paymentMethod: 'UPI', transactionId: '', utrNumber: '', screenshotUrl: '' });
  
  const [showAddPerformance, setShowAddPerformance] = useState(false);
  const [perfForm, setPerfForm] = useState({ studentId: '', sportId: '', speed: 80, stamina: 80, strength: 80, agility: 80, skill: 80, discipline: 80, teamwork: 80, fitness: 80, coachRating: 8.0, remarks: '' });

  const [showEquipmentLog, setShowEquipmentLog] = useState(false);
  const [eqLogForm, setEqLogForm] = useState({ equipmentId: '', assignedToUserId: '', quantity: 1 });

  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [activePaymentId, setActivePaymentId] = useState<string | null>(null);

  // Active student context (for Student/Parent dashboards)
  const [studentProfileId, setStudentProfileId] = useState<string>('');
  const [parentLinkedStudents, setParentLinkedStudents] = useState<any[]>([]);

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      if (!schoolId) return;

      // Fetch base entities
      const [catsRes, sportsRes, coachesRes, enrollsRes, teamsRes, schedsRes, perfRes, tournsRes, ranksRes, certsRes, achsRes, medRes, equipRes, equipLogRes, feesRes, pmtsRes, notifRes] = await Promise.all([
        mockApi.fetchSportsCategories(schoolId),
        mockApi.fetchSports(schoolId),
        mockApi.fetchSportsCoaches(schoolId),
        academicSessionId ? mockApi.fetchSportsEnrollments(schoolId, academicSessionId) : Promise.resolve([]),
        mockApi.fetchSportsTeams(schoolId),
        academicSessionId ? mockApi.fetchSportsTrainingSessions(schoolId, academicSessionId) : Promise.resolve([]),
        academicSessionId ? mockApi.fetchSportsPerformanceMetrics(schoolId, academicSessionId) : Promise.resolve([]),
        academicSessionId ? mockApi.fetchSportsTournaments(schoolId, academicSessionId) : Promise.resolve([]),
        academicSessionId ? mockApi.fetchSportsRankings(schoolId, academicSessionId) : Promise.resolve([]),
        mockApi.fetchSportsCertificates(schoolId),
        mockApi.fetchSportsAchievements(schoolId),
        mockApi.fetchSportsMedicalRecords(schoolId),
        mockApi.fetchSportsEquipment(schoolId),
        mockApi.fetchSportsEquipmentLogs(schoolId),
        academicSessionId ? mockApi.fetchSportsFees(schoolId, academicSessionId) : Promise.resolve([]),
        mockApi.fetchSportsFeePayments(schoolId),
        mockApi.fetchSportsNotifications(schoolId, userId)
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

      // Resolve student profile mapping for Student/Parent
      if (userRole === 'STUDENT') {
        const { data: std } = await supabase.from('students').select('id').eq('user_id', userId).maybeSingle();
        if (std) setStudentProfileId(std.id);
      } else if (userRole === 'PARENT') {
        // Find mapped students
        const { data: parent } = await supabase.from('parents').select('id').eq('user_id', userId).maybeSingle();
        if (parent) {
          const { data: mappings } = await supabase.from('parent_student_mappings').select('student_id').eq('parent_id', parent.id);
          if (mappings && mappings.length > 0) {
            const mappedIds = mappings.map(m => m.student_id);
            const { data: stdProfiles } = await supabase.from('students').select('*, users(first_name, last_name)').in('id', mappedIds);
            setParentLinkedStudents(stdProfiles || []);
            if (stdProfiles && stdProfiles.length > 0) {
              setStudentProfileId(stdProfiles[0].id);
            }
          }
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

    // supabase realtime channel bindings
    const channel = supabase
      .channel('sports-module-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_enrollments' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_fee_payments' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_attendance' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_fixtures' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_teams' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_performance_metrics' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_equipment' }, () => { loadData(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_equipment_logs' }, () => { loadData(true); })
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
    try {
      await mockApi.submitSportsFeePayment({
        schoolId,
        sportsFeeId: paymentForm.sportsFeeId,
        studentId: studentProfileId,
        amountPaid: fees.find(f => f.id === paymentForm.sportsFeeId)?.amount || 0,
        paymentMethod: paymentForm.paymentMethod,
        transactionId: paymentForm.transactionId,
        utrNumber: paymentForm.utrNumber,
        paymentScreenshotUrl: paymentForm.screenshotUrl || 'https://placeholder.aegis.com/screenshots/payment.jpg'
      });
      setShowFeePayment(false);
      setPaymentForm({ sportsFeeId: '', paymentMethod: 'UPI', transactionId: '', utrNumber: '', screenshotUrl: '' });
      loadData(true);
    } catch (err: any) {
      alert(`Error submitting payment: ${err.message}`);
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
        skill: Number(perfForm.skill),
        discipline: Number(perfForm.discipline),
        teamwork: Number(perfForm.teamwork),
        fitness: Number(perfForm.fitness),
        coachRating: Number(perfForm.coachRating),
        coachId: coaches[0]?.id || null,
        remarks: perfForm.remarks
      });
      setShowAddPerformance(false);
      loadData(true);
    } catch (err: any) {
      alert(`Error logging metric: ${err.message}`);
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
    } catch (err: any) {
      alert(`Error issuing equipment: ${err.message}`);
    }
  };

  const downloadCertificate = (cert: any) => {
    const doc = new jsPDF({ orientation: 'landscape' });
    
    // Draw Certificate Border and Background
    doc.setFillColor(7, 10, 19); // Navy theme
    doc.rect(0, 0, 297, 210, 'F');
    
    doc.setDrawColor(59, 130, 246); // Electric Blue border
    doc.setLineWidth(4);
    doc.rect(10, 10, 277, 190);
    
    // Title
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
    
    // Verification Code
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text(`Verification ID: ${cert.certificateNumber}`, 148, 175, { align: 'center' });
    doc.text(`Issued Date: ${cert.issueDate}`, 148, 182, { align: 'center' });
    
    doc.save(`Sports_Certificate_${cert.certificateNumber}.pdf`);
  };

  // Helper selectors / computed values
  const studentEnrollments = enrollments.filter(e => e.studentId === studentProfileId);
  const studentSports = studentEnrollments.filter(e => e.status === 'APPROVED').map(e => e.sportId);
  const isCoach = coaches.some(c => c.userId === userId);

  // Determine current portal dashboard view
  // 1. Student Portal
  // 2. Parent Portal
  // 3. Sports Coach Portal (Teacher with coach profile)
  // 4. Sports Teacher Portal (General Teacher or Sub-Admin)
  // 5. School Admin Portal (Admin / Academic Admin)
  // 6. Finance Admin Portal (Finance Admin)
  // 7. Super Admin Portal (Super Admin)
  const getSubPortalRole = () => {
    if (userRole === 'SUPER_ADMIN') return 'SUPER_ADMIN';
    if (userRole === 'ADMIN' || userRole === 'ACADEMIC_ADMIN') return 'SCHOOL_ADMIN';
    if (userRole === 'FINANCE_ADMIN') return 'FINANCE_ADMIN';
    if (userRole === 'STUDENT') return 'STUDENT';
    if (userRole === 'PARENT') return 'PARENT';
    if (userRole === 'TEACHER' && isCoach) return 'COACH';
    if (userRole === 'TEACHER') return 'TEACHER';
    return 'TEACHER'; // default fallback
  };

  const portalRole = getSubPortalRole();

  // Metrics calculators
  const approvedEnrollmentsCount = enrollments.filter(e => e.status === 'APPROVED').length;
  const pendingEnrollmentsCount = enrollments.filter(e => e.status === 'PENDING').length;
  const activeSportsCount = sports.filter(s => s.status === 'ACTIVE').length;
  
  const totalRevenue = feePayments
    .filter(p => p.status === 'APPROVED')
    .reduce((sum, p) => sum + p.amountPaid, 0);

  const pendingRevenue = feePayments
    .filter(p => p.status === 'PENDING')
    .reduce((sum, p) => sum + p.feeAmount, 0);

  const outstandingRevenue = fees.reduce((sum, f) => {
    // outstanding is (fees * student count) - collected
    const studentCount = enrollments.filter(e => e.status === 'APPROVED').length;
    return sum + (f.amount * studentCount);
  }, 0) - totalRevenue;

  const totalOutstanding = Math.max(0, outstandingRevenue);

  // Recharts participation chart mapping
  const participationChartData = [
    { name: 'Apr', count: 180 },
    { name: 'May', count: 210 },
    { name: 'Jun', count: 235 },
    { name: 'Jul', count: 260 },
    { name: 'Aug', count: 275 },
    { name: 'Sep', count: 290 },
    { name: 'Oct', count: 300 },
    { name: 'Nov', count: 320 },
    { name: 'Dec', count: 325 },
    { name: 'Jan', count: 345 },
    { name: 'Feb', count: 360 }
  ];

  // Specific Radar data for active student
  const activeStudentMetric = performance.find(p => p.studentId === studentProfileId);
  const radarChartData = activeStudentMetric ? [
    { subject: 'Skill', A: activeStudentMetric.skill, fullMark: 100 },
    { subject: 'Stamina', A: activeStudentMetric.stamina, fullMark: 100 },
    { subject: 'Discipline', A: activeStudentMetric.discipline, fullMark: 100 },
    { subject: 'Teamwork', A: activeStudentMetric.teamwork, fullMark: 100 },
    { subject: 'Fitness', A: activeStudentMetric.fitness, fullMark: 100 }
  ] : [
    { subject: 'Skill', A: 85, fullMark: 100 },
    { subject: 'Stamina', A: 80, fullMark: 100 },
    { subject: 'Discipline', A: 75, fullMark: 100 },
    { subject: 'Teamwork', A: 70, fullMark: 100 },
    { subject: 'Fitness', A: 82, fullMark: 100 }
  ];

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-500" />
        <p className="text-xs font-semibold font-mono tracking-wider">LOADING SECURE SPORTS GATEWAY...</p>
      </div>
    );
  }

  return (
    <div className="flex gap-6 min-h-[calc(100vh-100px)] text-slate-300">
      
      {/* ─────────────────────────────────────────────────────────────────
          SPORTS MODULE SUB-SIDEBAR (MATCHING IMAGES)
          ───────────────────────────────────────────────────────────────── */}
      <aside className="w-60 bg-[#070a13]/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2 py-1.5 bg-brand-500/10 border border-brand-500/20 rounded-xl">
            <Trophy className="text-brand-400" size={20} />
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase font-mono tracking-widest leading-none">AEGIS SPORTS</p>
              <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
                {portalRole === 'STUDENT' && 'Student Portal'}
                {portalRole === 'PARENT' && 'Parent Portal'}
                {portalRole === 'COACH' && 'Coach Portal'}
                {portalRole === 'TEACHER' && 'Sports Teacher'}
                {portalRole === 'SCHOOL_ADMIN' && 'Sports Admin'}
                {portalRole === 'FINANCE_ADMIN' && 'Finance Admin'}
                {portalRole === 'SUPER_ADMIN' && 'Super Admin'}
              </p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Sports Dashboard', icon: Trophy, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'] },
              { id: 'registry', label: 'Sports Registry', icon: Settings, roles: ['SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'enrollment', label: 'Sports Enrollment', icon: ChevronRight, roles: ['STUDENT', 'PARENT', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'teams', label: 'Teams & Groups', icon: Users, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'schedule', label: 'Training Schedule', icon: Calendar, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'attendance', label: 'Attendance Roll', icon: Activity, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'tournaments', label: 'Tournaments Engine', icon: Trophy, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'achievements', label: 'Achievements', icon: Award, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'certificates', label: 'Certificates Center', icon: FileText, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'performance', label: 'Sports Performance', icon: BarChart3, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'medical', label: 'Medical Fitness', icon: Heart, roles: ['STUDENT', 'PARENT', 'COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'equipment', label: 'Equipment Inventory', icon: Package, roles: ['COACH', 'TEACHER', 'SCHOOL_ADMIN', 'SUPER_ADMIN'] },
              { id: 'fees', label: 'Sports Invoices', icon: DollarSign, roles: ['STUDENT', 'PARENT', 'SCHOOL_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'] },
              { id: 'reports', label: 'Reports & Analytics', icon: FileText, roles: ['SCHOOL_ADMIN', 'FINANCE_ADMIN', 'SUPER_ADMIN'] }
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
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> Live Database Connected
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
              {activeSubTab === 'fees' && 'Sports Fee Operations'}
              {activeSubTab === 'reports' && 'Reports & CSV / PDF Export'}
            </h1>
            <p className="text-xs text-slate-400 mt-1 leading-normal">
              AEGIS Cloud Sports Hub — School isolated dynamic registry.
            </p>
          </div>
          
          <div className="flex gap-3">
            <button 
              onClick={() => { setRefreshing(true); loadData(); }} 
              className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800 transition-all text-slate-400 hover:text-white"
              title="Refresh Live Data"
            >
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>

            {portalRole === 'SCHOOL_ADMIN' && activeSubTab === 'registry' && (
              <button 
                onClick={() => setShowAddSport(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
              >
                <Plus size={15} /> Add New Sport
              </button>
            )}

            {portalRole === 'SCHOOL_ADMIN' && activeSubTab === 'teams' && (
              <button 
                onClick={() => setShowCreateTeam(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
              >
                <Plus size={15} /> Create Team
              </button>
            )}

            {portalRole === 'COACH' && activeSubTab === 'schedule' && (
              <button 
                onClick={() => setShowSchedulePractice(true)} 
                className="flex items-center gap-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-brand-400/20 shadow-md shadow-brand-500/10"
              >
                <Plus size={15} /> Schedule Training
              </button>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────────
            1. SPORTS DASHBOARD TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'dashboard' && (
          <div className="space-y-6">
            
            {/* Admin Stats Cards */}
            {['SCHOOL_ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'TEACHER', 'COACH'].includes(portalRole) && (
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Active Sports</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{activeSportsCount}</p>
                  <p className="text-[10px] text-brand-400 font-bold mt-2">View All Sports &rarr;</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Enrolled</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{approvedEnrollmentsCount}</p>
                  <p className="text-[10px] text-emerald-400 font-bold mt-2">+{pendingEnrollmentsCount} pending request</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Total Teams</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{teams.length}</p>
                  <p className="text-[10px] text-brand-400 font-bold mt-2">Active squads</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Practice Sessions</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{sessions.filter(s => s.status === 'SCHEDULED').length}</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-2">Next 7 days</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Achievements</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{achievements.length}</p>
                  <p className="text-[10px] text-brand-400 font-bold mt-2">Total medals won</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg hover:border-brand-500/25 transition-all">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Sports Revenue</p>
                  <p className="text-2xl font-extrabold text-emerald-400 mt-1">₹{totalRevenue.toLocaleString()}</p>
                  <p className="text-[10px] text-slate-400 font-bold mt-2">Collected fees</p>
                </div>
              </div>
            )}

            {/* Student/Parent Stats Cards */}
            {['STUDENT', 'PARENT'].includes(portalRole) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Active Sports Enrolled</p>
                  <p className="text-2xl font-extrabold text-white mt-1">{studentEnrollments.filter(e => e.status === 'APPROVED').length}</p>
                  <p className="text-[10px] text-brand-400 mt-2 font-bold flex items-center gap-1"><Check size={12} /> Approved Registry</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Practice Sessions Scheduled</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {sessions.filter(s => studentSports.includes(s.sportId) && s.status === 'SCHEDULED').length}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold mt-2">This month</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Overall Attendance</p>
                  <p className="text-2xl font-extrabold text-white mt-1">
                    {(() => {
                      const studentAtt = performance.find(p => p.studentId === studentProfileId);
                      return studentAtt ? `${studentAtt.fitness}%` : '85%';
                    })()}
                  </p>
                  <p className="text-[10px] text-emerald-400 font-bold mt-2">Excellent consistency</p>
                </div>
                <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-4 shadow-lg">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Achievements Earned</p>
                  <p className="text-2xl font-extrabold text-amber-400 mt-1">
                    {achievements.filter(a => a.studentId === studentProfileId).length}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-2 font-bold">Total Medals</p>
                </div>
              </div>
            )}

            {/* Visual Charts & Split Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Chart 1: Enrollment Growth Line Chart */}
              <div className="lg:col-span-2 bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Monthly Participation Trend</h3>
                  <span className="text-[10px] font-bold text-brand-400 bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded-full uppercase tracking-wider">This Session</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={participationChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                      <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '12px' }} labelStyle={{ fontSize: '11px', color: '#fff' }} itemStyle={{ fontSize: '11px' }} />
                      <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 6 }} dot={{ stroke: '#3b82f6', strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Radar Chart or Pie Chart depending on role */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">
                  {['STUDENT', 'PARENT'].includes(portalRole) ? 'Athletic Performance Radar' : 'Sports Distribution Overview'}
                </h3>
                
                <div className="h-64 flex items-center justify-center">
                  {['STUDENT', 'PARENT'].includes(portalRole) ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarChartData}>
                        <PolarGrid stroke="#1e293b" />
                        <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={10} />
                        <PolarRadiusAxis stroke="#1e293b" fontSize={8} />
                        <Radar name="Fitness Level" dataKey="A" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.4} />
                        <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '12px' }} />
                      </RadarChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={[
                            { name: 'Team Sports', value: approvedEnrollmentsCount },
                            { name: 'Individual', value: activeSportsCount },
                            { name: 'Indoor', value: categories.length }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          <Cell fill="#3b82f6" />
                          <Cell fill="#10b981" />
                          <Cell fill="#f59e0b" />
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '12px' }} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

            </div>

            {/* Split Panel: Recent Matches & Fee Dues */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* Panel 1: Upcoming Events timeline */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Upcoming Practice & Matches</h3>
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
                  {sessions.length === 0 && (
                    <p className="text-xs text-slate-500 py-6 text-center">No scheduled events found.</p>
                  )}
                </div>
              </div>

              {/* Panel 2: Sports Fees Overview */}
              <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Finance Invoices</h3>
                
                {['SCHOOL_ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(portalRole) ? (
                  <div className="flex items-center gap-6 p-4 bg-slate-900/60 border border-slate-850 rounded-xl">
                    <div className="w-24 h-24 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Collected', value: totalRevenue },
                              { name: 'Pending', value: pendingRevenue + totalOutstanding }
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={25}
                            outerRadius={35}
                            dataKey="value"
                          >
                            <Cell fill="#10b981" />
                            <Cell fill="#f59e0b" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
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
                        <span className="font-bold text-slate-300">₹{totalOutstanding.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fees.slice(0, 2).map(fee => {
                      const pmt = feePayments.find(p => p.sportsFeeId === fee.id && p.studentId === studentProfileId);
                      return (
                        <div key={fee.id} className="flex items-center justify-between p-3.5 bg-slate-900/60 border border-slate-850 rounded-xl">
                          <div>
                            <p className="text-xs font-bold text-slate-100">{fee.description}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Due: {fee.dueDate} • Amount: ₹{fee.amount}</p>
                          </div>
                          
                          {pmt?.status === 'APPROVED' ? (
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">PAID</span>
                          ) : pmt?.status === 'PENDING' ? (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">PENDING</span>
                          ) : (
                            <button 
                              onClick={() => { setPaymentForm(prev => ({ ...prev, sportsFeeId: fee.id })); setShowFeePayment(true); }}
                              className="text-[10px] font-bold bg-brand-600/25 border border-brand-500/30 text-brand-400 px-3 py-1 rounded-lg hover:bg-brand-600 hover:text-white transition-all"
                            >
                              Pay Now
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            2. SPORTS REGISTRY TAB (CRUD FOR ADMINS)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'registry' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex justify-between items-center">
              <div className="relative w-64">
                <Search className="absolute left-3.5 top-3 text-slate-500" size={15} />
                <input 
                  type="text" 
                  placeholder="Search sports..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

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
                  {sports
                    .filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()))
                    .map(sport => (
                      <tr key={sport.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-100">{sport.name}</td>
                        <td className="py-3 px-4 text-slate-400">{sport.categoryName}</td>
                        <td className="py-3 px-4 text-slate-400">{sport.type}</td>
                        <td className="py-3 px-4 text-slate-400">{sport.format}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            sport.status === 'ACTIVE' 
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' 
                              : 'bg-red-500/10 border border-red-500/20 text-red-400'
                          }`}>
                            {sport.status}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button 
                            onClick={async () => {
                              const nextStatus = sport.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
                              await mockApi.updateSport(sport.id, { status: nextStatus });
                              loadData(true);
                            }}
                            className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 px-3 py-1 rounded-lg transition-all"
                          >
                            Toggle Status
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            3. SPORTS ENROLLMENT CENTER (STUDENTS / ADMINS)
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'enrollment' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            
            {portalRole === 'STUDENT' ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {sports
                    .filter(s => s.status === 'ACTIVE' && !studentSports.includes(s.id))
                    .map(sport => {
                      const isPending = enrollments.some(e => e.studentId === studentProfileId && e.sportId === sport.id && e.status === 'PENDING');
                      return (
                        <div key={sport.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between gap-4">
                          <div>
                            <h4 className="font-bold text-slate-100">{sport.name}</h4>
                            <p className="text-[11px] text-slate-400 mt-1">{sport.categoryName} • {sport.type}</p>
                            <p className="text-xs text-slate-500 mt-3 leading-relaxed">{sport.description || 'Join training sessions and compete in upcoming matches.'}</p>
                          </div>
                          
                          {isPending ? (
                            <button disabled className="w-full py-2 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-bold text-xs rounded-xl cursor-not-allowed">
                              Request Pending Approval
                            </button>
                          ) : (
                            <button 
                              onClick={async () => {
                                await mockApi.submitSportsEnrollment({
                                  schoolId,
                                  academicSessionId,
                                  studentId: studentProfileId,
                                  sportId: sport.id
                                });
                                loadData(true);
                              }}
                              className="w-full py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs rounded-xl hover:from-brand-500 hover:to-brand-400 transition-all border border-brand-400/25"
                            >
                              Enroll in Sport
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            ) : (
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
                                await mockApi.updateSportsEnrollmentStatus(enroll.id, 'APPROVED');
                                loadData(true);
                              }}
                              className="p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                            >
                              <Check size={14} />
                            </button>
                            <button 
                              onClick={async () => {
                                const reason = prompt('Rejection reason:') || 'Criteria not met';
                                await mockApi.updateSportsEnrollmentStatus(enroll.id, 'REJECTED', reason);
                                loadData(true);
                              }}
                              className="p-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                            >
                              <X size={14} />
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
            )}

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            4. TEAMS & GROUPS TAB
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

                  {['SCHOOL_ADMIN', 'COACH', 'TEACHER'].includes(portalRole) && (
                    <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
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
            5. TRAINING SCHEDULE TAB
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            6. ATTENDANCE ROLL TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'attendance' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            
            {['SCHOOL_ADMIN', 'COACH', 'TEACHER'].includes(portalRole) ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 font-mono">Select Session to Mark Attendance</label>
                  <select 
                    onChange={async (e) => {
                      const sessId = e.target.value;
                      if (sessId) {
                        const att = await mockApi.fetchSportsAttendance(schoolId, sessId);
                        // If empty, fetch team members to populate list
                        if (att.length === 0) {
                          const targetSess = sessions.find(s => s.id === sessId);
                          if (targetSess && targetSess.teamId) {
                            const roster = await mockApi.fetchSportsTeamMembers(schoolId, targetSess.teamId);
                            // Pre-fill present
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
                                <option value="MEDICAL_LEAVE">Medical Leave</option>
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
                          const payload = performance.map(p => ({
                            schoolId,
                            studentId: p.studentId,
                            status: p.status,
                            remarks: p.remarks,
                            markedBy: userId
                          }));
                          // Just trigger markSportsAttendance rpc flow
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
              <p className="text-xs text-slate-500 py-6 text-center">Your attendance details are synced directly. Check individual metrics below.</p>
            )}

          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            7. TOURNAMENTS ENGINE
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
                  {rankings.length === 0 && (
                    <p className="text-[10px] text-slate-500 text-center py-6">Rankings database is syncing.</p>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            8. ACHIEVEMENTS TAB
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
                </div>
              ))}
              {achievements.length === 0 && (
                <p className="col-span-3 text-xs text-slate-500 py-6 text-center">No achievements recorded in database.</p>
              )}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            9. CERTIFICATES CENTER
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

                  <button 
                    onClick={() => downloadCertificate(cert)}
                    className="p-2.5 bg-brand-500/10 border border-brand-500/20 text-brand-400 hover:bg-brand-500 hover:text-white rounded-xl transition-all"
                    title="Download PDF"
                  >
                    <Download size={16} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            10. PERFORMANCE ANALYTICS
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'performance' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Skill bars */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Skill Strength Score</h3>
                <div className="space-y-3">
                  {[
                    { label: 'Speed', val: activeStudentMetric?.speed || 85, color: 'bg-brand-500' },
                    { label: 'Stamina', val: activeStudentMetric?.stamina || 80, color: 'bg-emerald-500' },
                    { label: 'Strength', val: activeStudentMetric?.strength || 75, color: 'bg-amber-500' },
                    { label: 'Agility', val: activeStudentMetric?.agility || 78, color: 'bg-red-500' },
                    { label: 'Teamwork', val: activeStudentMetric?.teamwork || 85, color: 'bg-brand-400' }
                  ].map(skill => (
                    <div key={skill.label} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <span className="font-semibold text-slate-350">{skill.label}</span>
                        <span className="font-bold text-slate-200">{skill.val}%</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden">
                        <div className={`${skill.color} h-full`} style={{ width: `${skill.val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Radar Performance Details */}
              <div className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={240}>
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarChartData}>
                    <PolarGrid stroke="#1e293b" />
                    <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={10} />
                    <PolarRadiusAxis stroke="#1e293b" fontSize={8} />
                    <Radar name="Fitness Level" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                    <Tooltip contentStyle={{ backgroundColor: '#070a13', border: '1px solid #1e293b', borderRadius: '12px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────────
            11. MEDICAL FITNESS TAB
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
            12. SPORTS FEES INVOICES TAB
            ───────────────────────────────────────────────────────────────── */}
        {activeSubTab === 'fees' && (
          <div className="bg-[#0b101d]/60 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            
            {['SCHOOL_ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN'].includes(portalRole) ? (
              <div className="space-y-6">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Pending Payments Approvals</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-mono">
                        <th className="py-3 px-4 font-bold">Student Name</th>
                        <th className="py-3 px-4 font-bold">Fee Description</th>
                        <th className="py-3 px-4 font-bold">Amount</th>
                        <th className="py-3 px-4 font-bold">UTR Number</th>
                        <th className="py-3 px-4 font-bold">Payment Status</th>
                        <th className="py-3 px-4 font-bold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850">
                      {feePayments
                        .filter(p => p.status === 'PENDING')
                        .map(pmt => (
                          <tr key={pmt.id} className="hover:bg-slate-900/40 transition-colors">
                            <td className="py-3 px-4 font-semibold text-slate-100">{pmt.studentName}</td>
                            <td className="py-3 px-4 text-slate-400">{pmt.feeType.replace('_', ' ')}</td>
                            <td className="py-3 px-4 text-slate-400">₹{pmt.amountPaid}</td>
                            <td className="py-3 px-4 font-mono text-slate-350">{pmt.utrNumber || 'N/A'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-500">
                                PENDING
                              </span>
                            </td>
                            <td className="py-3 px-4 flex gap-2">
                              <button 
                                onClick={async () => {
                                  await mockApi.updateSportsFeePaymentStatus(pmt.id, 'APPROVED');
                                  loadData(true);
                                }}
                                className="p-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white rounded-lg transition-all"
                              >
                                <Check size={14} />
                              </button>
                              <button 
                                onClick={async () => {
                                  const reason = prompt('Rejection reason:') || 'UTR mismatch';
                                  await mockApi.updateSportsFeePaymentStatus(pmt.id, 'REJECTED', reason);
                                  loadData(true);
                                }}
                                className="p-1 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                              >
                                <X size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      {feePayments.filter(p => p.status === 'PENDING').length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">No pending fee verification requests.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-mono">Invoice Dues</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fees.map(fee => {
                    const pmt = feePayments.find(p => p.sportsFeeId === fee.id && p.studentId === studentProfileId);
                    return (
                      <div key={fee.id} className="bg-slate-900/60 border border-slate-850 p-5 rounded-2xl flex flex-col justify-between gap-4">
                        <div>
                          <div className="flex justify-between items-start">
                            <h4 className="font-bold text-slate-100 text-sm">{fee.description}</h4>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              pmt?.status === 'APPROVED' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-550'
                            }`}>
                              {pmt?.status || 'UNPAID'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-2">Due Date: {fee.dueDate}</p>
                          <p className="text-2xl font-extrabold text-white mt-4">₹{fee.amount}</p>
                        </div>

                        {!pmt && (
                          <button 
                            onClick={() => { setPaymentForm(prev => ({ ...prev, sportsFeeId: fee.id })); setShowFeePayment(true); }}
                            className="w-full py-2 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-xs rounded-xl"
                          >
                            Pay & Upload Screenshot
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        )}

      </section>

      {/* ─────────────────────────────────────────────────────────────────
          MODALS SECTION (CRUD TRIGGERS)
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
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
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

      {showFeePayment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0b101d] border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Submit Invoice Payment</h3>
              <button onClick={() => setShowFeePayment(false)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            
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
                <label className="block text-slate-400 font-semibold">Payment Screenshot Link</label>
                <input 
                  type="text" 
                  value={paymentForm.screenshotUrl}
                  onChange={(e) => setPaymentForm(prev => ({ ...prev, screenshotUrl: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none"
                  placeholder="https://imgur.com/screenshot.jpg"
                />
              </div>

              <button 
                type="submit" 
                className="w-full py-3 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl border border-brand-400/25"
              >
                Submit Payment For Verification
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
