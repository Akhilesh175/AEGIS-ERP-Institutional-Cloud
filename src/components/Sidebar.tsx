import React from 'react';
import { useStore } from '../store/useStore';
import { mockDb } from '../services/mockDb';
import { subscriptionPlans, isTabLockedByEntitlements } from '../services/subscriptionConfig';
import { useFeatureEntitlements } from '../hooks/useFeatureEntitlements';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, Calendar, BookOpen, PenTool, Award, MessageSquare,
  Users, UsersRound, Layers, BookMarked, DollarSign, Activity, Settings, ShieldAlert,
  Key, Eye, EyeOff, Database, Terminal, HardDrive, CheckCircle2, Clock, AlertTriangle,
  Mail, X, CreditCard, HelpCircle, Bell, ClipboardList, FileText, Home, Trophy,
  ChevronDown, ChevronUp, Tag, Coins, Percent, TrendingUp, Sparkles
} from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { session, isMobileMenuOpen, setMobileMenuOpen, syncSubscriptionPlan, warningLevel, daysRemaining } = useStore();

  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({
    billing: false,
    directory: false,
    academics: false,
    grading: false,
    security: false,
    books: false,
    transport: false,
    hostel: false
  });

  const [isSubscriptionMenuOpen, setSubscriptionMenuOpen] = React.useState(false);

  // Lock body scroll when mobile drawer is open
  React.useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [isMobileMenuOpen]);

  React.useEffect(() => {
    if (activeTab.startsWith('sub-')) {
      setSubscriptionMenuOpen(true);
    }
  }, [activeTab]);

  React.useEffect(() => {
    if (!session || !session.user.schoolId) return;
    
    const loadPermissions = async () => {
      try {
        const { mockApi } = await import('../services/mockApi');
        const matrix = await mockApi.fetchSchoolRolePermissions(session.user.schoolId!);
        const rolePermissions = matrix[session.user.role];
        if (rolePermissions) {
          setPermissions(rolePermissions);
        }
      } catch (e) {
        console.error('Failed to load dynamic permissions in Sidebar:', e);
      }
    };
    
    loadPermissions();
    
    // Subscribe to realtime updates on permissions!
    const channel = supabase
      .channel(`sidebar-permissions-${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'role_permissions' }, loadPermissions)
      .subscribe();

    // Subscribe to realtime updates on school subscription plans!
    const schoolChannel = supabase
      .channel(`sidebar-school-${session.user.schoolId}`)
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'schools', 
        filter: `id=eq.${session.user.schoolId}` 
      }, () => {
        console.log('Realtime school subscription update detected in Sidebar! Syncing plan...');
        syncSubscriptionPlan();
      })
      .subscribe();

    // Subscribe to realtime updates on school_subscriptions table for enterprise gating!
    const subChannel = supabase
      .channel(`sidebar-sub-${session.user.schoolId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'school_subscriptions', 
        filter: `school_id=eq.${session.user.schoolId}` 
      }, () => {
        console.log('Realtime school_subscriptions update detected in Sidebar! Syncing plan...');
        syncSubscriptionPlan();
      })
      .subscribe();

    // Subscribe to manual broadcast channel for instant, guaranteed real-time updates!
    const broadcastChannel = supabase
      .channel(`school-subscription-updates-${session.user.schoolId}`)
      .on('broadcast', { event: 'plan_updated' }, () => {
        console.log('Realtime broadcast school subscription update detected in Sidebar! Syncing plan...');
        syncSubscriptionPlan();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(schoolChannel);
      supabase.removeChannel(subChannel);
      supabase.removeChannel(broadcastChannel);
    };
  }, [session, syncSubscriptionPlan]);

  if (!session) return null;

  const role = session.user.role;
  const planName = (session.schoolSubscriptionPlan || 'freemium').toLowerCase();
  const plan = subscriptionPlans[planName] || subscriptionPlans.freemium;
  // DB-driven entitlements (live, reactive, tier-inheriting)
  const ent = useFeatureEntitlements();

  // Define tab mappings per role
  const getTabs = (): Array<{ id: string; label: string; icon: any; locked?: boolean }> => {
    if (planName === 'expired') {
      if (role === 'ADMIN') {
        return [
          { id: 'dashboard', label: 'Subscription Renewal', icon: ShieldAlert },
          { id: 'support', label: 'Help & Support', icon: HelpCircle }
        ];
      }
      return [
        { id: 'dashboard', label: 'Access Suspended', icon: ShieldAlert },
        { id: 'support', label: 'Help & Support', icon: HelpCircle }
      ];
    }

    switch (role) {
      case 'STUDENT': {
        const lock = (tabId: string) => isTabLockedByEntitlements('STUDENT', tabId, ent);
        return [
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'timetable', label: 'Schedule', icon: Calendar },
          { id: 'ptm', label: 'PTM Meetings', icon: Calendar, locked: lock('ptm') },
          { id: 'grades', label: 'Report Cards', icon: Award },
          { id: 'documents', label: 'Documents Center', icon: FileText },
          { id: 'groupdiscussion', label: 'Group Discussion', icon: MessageSquare },
          { id: 'materials', label: 'Materials', icon: BookOpen, locked: lock('materials') },
          { id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: lock('quizzes') },
          { id: 'library', label: 'Library Books', icon: BookMarked, locked: lock('library') },
          { id: 'sports', label: 'Sports & Activities', icon: Trophy, locked: lock('sports') },
          { id: 'transit', label: 'School Transit', icon: Layers, locked: lock('transit') },
          { id: 'hostel', label: 'Hostel Hub', icon: Home, locked: lock('hostel') },
          { id: 'forums', label: 'Discussion', icon: MessageSquare, locked: lock('forums') },
          { id: 'fees', label: 'Billing Invoices', icon: DollarSign, locked: lock('fees') },
          { id: 'support', label: 'Help & Support', icon: HelpCircle }
        ];
      }
      case 'PARENT': {
        const lock = (tabId: string) => isTabLockedByEntitlements('PARENT', tabId, ent);
        return [
          { id: 'dashboard', label: 'Child Tracker', icon: Eye },
          { id: 'notifications', label: 'Notifications Center', icon: Bell },
          { id: 'ptm', label: 'PTM Meetings', icon: Calendar, locked: lock('ptm') },
          { id: 'homework', label: 'Homework', icon: BookMarked, locked: lock('homework') },
          { id: 'timetable', label: 'Class Schedule', icon: Calendar },
          { id: 'grades', label: 'Grades Progress', icon: Award },
          { id: 'documents', label: 'Documents Center', icon: FileText },
          { id: 'fees', label: 'Billing Invoices', icon: DollarSign, locked: lock('fees') },
          { id: 'materials', label: 'Materials', icon: BookOpen, locked: lock('materials') },
          { id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: lock('quizzes') },
          { id: 'library', label: 'Library Books', icon: BookMarked, locked: lock('library') },
          { id: 'sports', label: 'Sports & Activities', icon: Trophy, locked: lock('sports') },
          { id: 'transit', label: 'School Transit', icon: Layers, locked: lock('transit') },
          { id: 'hostel', label: 'Hostel Hub', icon: Home, locked: lock('hostel') },
          { id: 'forums', label: 'Forums', icon: MessageSquare, locked: lock('forums') },
          { id: 'support', label: 'Help & Support', icon: HelpCircle }
        ];
      }
      case 'TEACHER': {
        const lock = (tabId: string) => isTabLockedByEntitlements('TEACHER', tabId, ent);
        return [
          { id: 'dashboard', label: 'Classes Taught', icon: LayoutDashboard },
          { id: 'timetable', label: 'Teaching Schedule', icon: Calendar },
          { id: 'ptm', label: 'PTM Meetings', icon: Calendar, locked: lock('ptm') },
          { id: 'groupdiscussion', label: 'Group Discussion', icon: MessageSquare },
          { id: 'classroster', label: 'Class Roster', icon: Users, locked: lock('classroster') },
          { id: 'attendance', label: 'Attendance Roll', icon: Layers, locked: lock('attendance') },
          { id: 'grades', label: 'Gradebook Matrix', icon: Award },
          { id: 'marksheets', label: 'Homeroom Marksheets', icon: ClipboardList, locked: lock('marksheets') },
          { id: 'analytics', label: 'Class Analytics', icon: Activity, locked: lock('analytics') },
          { id: 'assignments', label: 'Assignment Creator', icon: PenTool, locked: lock('assignments') },
          { id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: lock('quizzes') },
          { id: 'materials', label: 'Upload Materials', icon: BookOpen, locked: lock('materials') },
          { id: 'forums', label: 'Discussions', icon: MessageSquare, locked: lock('forums') },
          { id: 'paymentsettings', label: 'Payment Settings', icon: DollarSign },
          { id: 'support', label: 'Help & Support', icon: HelpCircle }
        ];
      }
      case 'COACH': {
        const coachLock = (tabId: string) => isTabLockedByEntitlements('COACH', tabId, ent);
        return [
          { id: 'dashboard', label: 'Coach Dashboard', icon: LayoutDashboard, locked: coachLock('dashboard') },
          { id: 'sports', label: 'Sports & Activities', icon: Trophy, locked: coachLock('sports') },
          { id: 'paymentsettings', label: 'Payment Settings', icon: DollarSign },
          { id: 'support', label: 'Help & Support', icon: HelpCircle }
        ];
      }
      case 'ADMIN': {
        const lock = (tabId: string) => isTabLockedByEntitlements('ADMIN', tabId, ent);
        return [
          { id: 'dashboard', label: 'School Registry', icon: LayoutDashboard },
          { id: 'students', label: 'Student Directory', icon: Users },
          { id: 'teachers', label: 'Teacher Directory', icon: UsersRound },
          { id: 'parents', label: 'Parent Directory', icon: UsersRound },
          { id: 'classes', label: 'Classes & Sections', icon: Layers },
          { id: 'subjects', label: 'Subject Catalog', icon: BookMarked },
          { id: 'academicsessions', label: 'Academic Sessions', icon: Calendar },
          { id: 'ptm', label: 'PTM Management', icon: Calendar, locked: lock('ptm') },
          { id: 'documents', label: 'Documents Center', icon: FileText },
          { id: 'groupdiscussion', label: 'Group Discussion', icon: MessageSquare },
          { id: 'attendance', label: 'Student Attendance', icon: Layers, locked: lock('attendance') },
          { id: 'fees', label: 'Invoicing Office', icon: DollarSign, locked: lock('fees') },
          { id: 'hostel', label: 'Hostel Registry', icon: Home, locked: lock('hostel') },
          { id: 'sports', label: 'Sports & Activities', icon: Trophy, locked: lock('sports') },
          { id: 'communications', label: 'Communication Center', icon: Mail, locked: lock('communications') },
          { id: 'analytics', label: 'Institutional Analytics', icon: Activity, locked: lock('analytics') },
          { id: 'rbac', label: 'Dynamic Permissions Grid', icon: Key, locked: lock('rbac') },
          { id: 'backups', label: 'SaaS Disaster Recovery', icon: Database, locked: lock('backups') },
          { id: 'impersonation', label: 'Portal Gateway', icon: Eye },
          { id: 'subscriptions', label: 'Subscription', icon: DollarSign },
          { id: 'dangerzone', label: 'Danger Zone', icon: ShieldAlert },
          { id: 'support', label: 'Help & Support', icon: HelpCircle }
        ];
      }
      case 'FINANCE_ADMIN':
      case 'ACADEMIC_ADMIN':
      case 'EXAM_CONTROLLER':
      case 'LIBRARIAN':
      case 'TRANSPORT_MANAGER':
      case 'HOSTEL_ADMIN':
      case 'WARDEN':
      case 'SPORTS_ADMIN':
      case 'CUSTOM_SUB_ADMIN': {
        const isFreemium = ent.tier === 0;
        const isBasic = ent.tier === 1;
        const isPro = ent.tier === 2;
        const isEnterprise = ent.tier === 3;

        const subAdminTabs: Array<{ id: string; label: string; icon: any; locked?: boolean }> = [
          // WARDEN: dashboard locked for non-Enterprise (entire portal is Enterprise-only)
          { id: 'dashboard', label: 'School Registry', icon: LayoutDashboard, locked: role === 'WARDEN' ? !isEnterprise : undefined }
        ];

        if (role === 'ACADEMIC_ADMIN') {
          subAdminTabs.push({ id: 'groupdiscussion', label: 'Group Discussion', icon: MessageSquare });
        }
        
        // If billing is allowed
        if (permissions.billing) {
          subAdminTabs.push({ id: 'fees', label: 'Invoicing Office', icon: DollarSign, locked: isFreemium });
          subAdminTabs.push({ id: 'analytics', label: 'Fee Analytics', icon: Activity, locked: isFreemium || isBasic });
        }
        
        // If directory is allowed
        if (permissions.directory) {
          subAdminTabs.push({ id: 'students', label: 'Student Directory', icon: Users, locked: isFreemium });
          subAdminTabs.push({ id: 'teachers', label: 'Teacher Directory', icon: UsersRound, locked: isFreemium });
          subAdminTabs.push({ id: 'parents', label: 'Parent Directory', icon: UsersRound, locked: isFreemium });
        }
        
        // If academics is allowed
        if (permissions.academics) {
          subAdminTabs.push({ id: 'classes', label: 'Classes & Sections', icon: Layers, locked: isFreemium });
          subAdminTabs.push({ id: 'subjects', label: 'Subject Catalog', icon: BookMarked, locked: isFreemium });
          subAdminTabs.push({ id: 'academicsessions', label: 'Academic Sessions', icon: Calendar, locked: isFreemium });
          if (role === 'ACADEMIC_ADMIN' || role === 'EXAM_CONTROLLER') {
            subAdminTabs.push({ id: 'attendance', label: 'Student Attendance', icon: Layers, locked: isFreemium });
          }
          if (role === 'ACADEMIC_ADMIN') {
            subAdminTabs.push({ id: 'assignments', label: 'Homework & Assignments', icon: PenTool, locked: isFreemium || isBasic });
          }
        }
        
        // If grading is allowed
        if (permissions.grading) {
          subAdminTabs.push({ id: 'marksheets', label: ' Homeroom Marksheets', icon: ClipboardList, locked: isFreemium || isBasic });
          subAdminTabs.push({ id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: isFreemium || isBasic });
        }
 
        // If books is allowed (Library)
        if (permissions.books) {
          subAdminTabs.push({ id: 'books', label: 'Library Registry', icon: BookOpen, locked: isFreemium });
        }
 
        // If transport is allowed (Transport)
        if (permissions.transport) {
          subAdminTabs.push({ id: 'transport', label: 'Transit Registry', icon: Layers, locked: !isEnterprise });
        }
 
        // Hostel tab for hostel admin, warden, or dynamic permission
        if (role === 'HOSTEL_ADMIN' || role === 'WARDEN' || (permissions as any).hostel) {
          subAdminTabs.push({ id: 'hostel', label: 'Hostel Registry', icon: Home, locked: !isEnterprise });
        }
        
        // If security is allowed (Sub-Admin backups / telemetry access)
        if (permissions.security) {
          subAdminTabs.push({ id: 'backups', label: 'Disaster Recovery', icon: Database, locked: !isEnterprise });
        }

        // All sub-admins can access their own payment settings (salary / banking)
        // Sports & Activities is Enterprise-only for all authorized sub-admin roles
        if (['SPORTS_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN'].includes(role)) {
          subAdminTabs.push({ id: 'sports', label: 'Sports & Activities', icon: Trophy, locked: !isEnterprise });
        }
        subAdminTabs.push({ id: 'paymentsettings', label: 'Payment Settings', icon: DollarSign });
        
        subAdminTabs.push({ id: 'support', label: 'Help & Support', icon: HelpCircle });
        return subAdminTabs;
      }
      case 'SUPER_ADMIN':
        return [
          { id: 'dashboard', label: 'SaaS Telemetry', icon: Activity, locked: !plan.features.advancedAnalytics },
          { id: 'tenants', label: 'School Registry', icon: Layers },
          { id: 'users', label: 'Global User Manager', icon: UsersRound },
          { id: 'saas-billing', label: 'SaaS Billing Gateway', icon: CreditCard },
          { id: 'ai-analytics', label: 'AEGIS AI Control', icon: Sparkles },
          { id: 'communications', label: 'Platform Broadcasts', icon: Mail },
          { id: 'audits', label: 'Global Audit Logs', icon: Settings, locked: !plan.features.auditLogs },
          { id: 'backups', label: 'Disaster Recovery Panel', icon: Database },
          { id: 'logging', label: 'Centralized Logging Console', icon: Terminal },
          { id: 'support', label: 'Help & Support', icon: HelpCircle }
        ];
      default:
        return [];
    }
  };

  const tabs = getTabs();

  // ── Portal Context Badge (fixed header inside sidebar) ──
  const sidebarHeader = (
    <div className="px-3 py-2 bg-slate-900/40 rounded-xl border border-slate-850 shrink-0">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Console Context</p>
      <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
        {role === 'STUDENT' && 'Student Portal'}
        {role === 'PARENT' && 'Parent Guardian Portal'}
        {role === 'TEACHER' && 'Teacher Portal'}
        {role === 'COACH' && 'Coach Portal'}
        {role === 'ADMIN' && 'Head Administrative Portal'}
        {role === 'SUPER_ADMIN' && 'Super Admin Engine'}
        {['FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN', 'CUSTOM_SUB_ADMIN'].includes(role) && 'Sub-Admin Portal'}
      </p>
    </div>
  );

  // ── Navigation items (independently scrollable) ──
  const sidebarNav = (
    <nav className="space-y-1">
      {role === 'SUPER_ADMIN' ? (
        <>
          {/* SaaS Telemetry */}
          <button
            onClick={() => { setActiveTab('dashboard'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'dashboard'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <Activity size={18} className={activeTab === 'dashboard' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">SaaS Telemetry</span>
          </button>

          {/* School Registry */}
          <button
            onClick={() => { setActiveTab('tenants'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'tenants'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <Layers size={18} className={activeTab === 'tenants' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">School Registry</span>
          </button>

          {/* Global User Manager */}
          <button
            onClick={() => { setActiveTab('users'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'users'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <UsersRound size={18} className={activeTab === 'users' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">Global User Manager</span>
          </button>

          {/* Collapsible Subscription Management */}
          <div className="space-y-1">
            <button
              onClick={() => setSubscriptionMenuOpen(!isSubscriptionMenuOpen)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                activeTab.startsWith('sub-')
                  ? 'bg-brand-600/5 text-brand-400 border border-brand-500/15 font-semibold'
                  : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
              }`}
            >
              <CreditCard size={18} className={activeTab.startsWith('sub-') ? 'text-brand-500' : 'text-slate-400'} />
              <span className="flex-1 text-left">Subscription Management</span>
              {isSubscriptionMenuOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {isSubscriptionMenuOpen && (
              <div className="pl-4 space-y-1 border-l border-slate-800 ml-5 py-1">
                {[
                  { id: 'sub-dashboard', label: 'Dashboard', icon: LayoutDashboard },
                  { id: 'sub-plans', label: 'Plan Management', icon: Sparkles },
                  { id: 'sub-pricing', label: 'School Pricing', icon: Coins },
                  { id: 'sub-coupons', label: 'Coupons', icon: Tag },
                  { id: 'sub-purchases', label: 'Purchase History', icon: Clock },
                  { id: 'sub-timeline', label: 'Subscription Timeline', icon: TrendingUp },
                  { id: 'sub-audits', label: 'Audit Logs', icon: ClipboardList },
                  { id: 'sub-reports', label: 'Reports', icon: FileText },
                ].map(subTab => {
                  const SubIcon = subTab.icon;
                  const isSubActive = activeTab === subTab.id;
                  return (
                    <button
                      key={subTab.id}
                      onClick={() => { setActiveTab(subTab.id); setMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-medium transition-all duration-150 active:scale-[0.98] ${
                        isSubActive
                          ? 'bg-brand-600/10 text-brand-400 font-semibold'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
                      }`}
                    >
                      <SubIcon size={14} className={isSubActive ? 'text-brand-500' : 'text-slate-500'} />
                      <span>{subTab.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* SaaS Billing Gateway */}
          <button
            onClick={() => { setActiveTab('saas-billing'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'saas-billing'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <CreditCard size={18} className={activeTab === 'saas-billing' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">SaaS Billing Gateway</span>
          </button>

          {/* Platform Broadcasts */}
          <button
            onClick={() => { setActiveTab('communications'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'communications'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <Mail size={18} className={activeTab === 'communications' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">Platform Broadcasts</span>
          </button>

          {/* Global Audit Logs */}
          <button
            onClick={() => { setActiveTab('audits'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'audits'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <Settings size={18} className={activeTab === 'audits' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">Global Audit Logs</span>
          </button>

          {/* Disaster Recovery Panel */}
          <button
            onClick={() => { setActiveTab('backups'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'backups'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <Database size={18} className={activeTab === 'backups' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">Disaster Recovery Panel</span>
          </button>

          {/* Centralized Logging Console */}
          <button
            onClick={() => { setActiveTab('logging'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'logging'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <Terminal size={18} className={activeTab === 'logging' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">Centralized Logging Console</span>
          </button>

          {/* Help & Support */}
          <button
            onClick={() => { setActiveTab('support'); setMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
              activeTab === 'support'
                ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold'
                : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
            }`}
          >
            <HelpCircle size={18} className={activeTab === 'support' ? 'text-brand-500' : 'text-slate-400'} />
            <span className="flex-1 text-left">Help & Support</span>
          </button>
        </>
      ) : (
        tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isLocked = tab.locked;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setMobileMenuOpen(false); // Auto close mobile menu on tab selection
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                isActive 
                  ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold' 
                  : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
              }`}
            >
              <Icon size={18} className={isActive ? 'text-brand-500' : 'text-slate-400'} />
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.id === 'subscriptions' && warningLevel && (() => {
                let badgeText = '';
                let badgeStyle = '';
                if (warningLevel === 'expired') {
                  badgeText = 'Expired';
                  badgeStyle = 'bg-red-500/10 border-red-500/30 text-red-400';
                } else if (warningLevel === 'today') {
                  badgeText = 'Expires today';
                  badgeStyle = 'bg-red-500/10 border-red-500/30 text-red-400';
                } else if (warningLevel === 'warning_1') {
                  badgeText = 'Expires tomorrow';
                  badgeStyle = 'bg-orange-500/10 border-orange-500/30 text-orange-400';
                } else if (warningLevel === 'warning_2') {
                  badgeText = 'Expires in 2 days';
                  badgeStyle = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
                } else if (warningLevel === 'warning_3') {
                  badgeText = 'Expires in 3 days';
                  badgeStyle = 'bg-purple-500/10 border-purple-500/35 text-purple-400';
                }
                if (!badgeText) return null;
                return (
                  <span className={`px-2 py-0.5 rounded-md border text-[9px] font-bold tracking-wide shrink-0 ${badgeStyle}`}>
                    {badgeText}
                  </span>
                );
              })()}
              {isLocked && (
                <span className="w-5 h-5 flex flex-shrink-0 items-center justify-center bg-amber-500/10 rounded-full border border-amber-500/30">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                </span>
              )}
            </button>
          );
        })
      )}
    </nav>
  );

  // ── Footer version badge (fixed at bottom) ──
  const sidebarFooter = (
    <div className="p-3 bg-slate-950/40 border border-slate-850/60 rounded-xl text-center shrink-0">
      <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Version Control</p>
      <p className="text-[10px] font-mono text-slate-400 mt-0.5">AEGIS-CORE v1.4.2</p>
    </div>
  );


  return (
    <>
      {/* ── Desktop Sidebar ── Fixed position, independently scrollable nav */}
      <aside className="w-64 shrink-0 hidden md:flex flex-col h-full glass dark:glass-dark border-r border-slate-800 bg-[#070a13]/60 z-30">
        {/* Fixed header: portal context badge */}
        <div className="px-4 pt-4 pb-3 shrink-0">
          {sidebarHeader}
        </div>

        {/* Scrollable navigation — only this zone scrolls */}
        <div
          className="flex-1 min-h-0 overflow-y-auto px-4 py-1"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}
        >
          {sidebarNav}
        </div>

        {/* Fixed footer: version badge */}
        <div className="px-4 pb-4 pt-3 shrink-0">
          {sidebarFooter}
        </div>
      </aside>

      {/* ── Mobile Sidebar Overlay Drawer ── */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* Tap backdrop to close */}
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />

          {/* Drawer panel — independently scrollable nav */}
          <div className="w-72 max-w-[85vw] h-full bg-[#070a13] border-l border-slate-800 flex flex-col z-50 animate-slide-right relative">
            {/* Close button */}
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-full transition-all z-10"
              title="Close Menu"
            >
              <X size={18} />
            </button>

            {/* Fixed mobile header: logo + context badge */}
            <div className="px-4 pt-4 pb-3 shrink-0">
              <div className="mb-3 pt-1">
                <BrandLogo variant="horizontal" size="xs" showTagline={true} />
              </div>
              {sidebarHeader}
            </div>

            {/* Scrollable navigation — only this zone scrolls on mobile/tablet */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 py-1"
              style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}
            >
              {sidebarNav}
            </div>

            {/* Fixed mobile footer */}
            <div className="px-4 pb-4 pt-3 shrink-0">
              {sidebarFooter}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
