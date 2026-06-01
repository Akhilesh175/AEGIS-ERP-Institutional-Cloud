import React from 'react';
import { useStore } from '../store/useStore';
import { mockDb } from '../services/mockDb';
import { subscriptionPlans } from '../services/subscriptionConfig';
import { supabase } from '../lib/supabase';
import { 
  LayoutDashboard, Calendar, BookOpen, PenTool, Award, MessageSquare, 
  Users, Layers, BookMarked, DollarSign, Activity, Settings, Eye, UsersRound, ClipboardList, ShieldAlert, X,
  Mail, Database, Key, Terminal
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { session, isMobileMenuOpen, setMobileMenuOpen } = useStore();

  const [permissions, setPermissions] = React.useState<Record<string, boolean>>({
    billing: false,
    directory: false,
    academics: false,
    grading: false,
    security: false,
    books: false,
    transport: false
  });

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
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  if (!session) return null;

  const role = session.user.role;
  const school = session.user.schoolId ? mockDb.schools.find(s => s.id === session.user.schoolId) : null;
  const plan = school ? subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium : subscriptionPlans.freemium;

  // Removed filterTabs since we now show locked items with icons

  // Define tab mappings per role
  const getTabs = () => {
    switch (role) {
      case 'STUDENT':
        return [
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'timetable', label: 'Schedule', icon: Calendar },
          { id: 'materials', label: 'Materials', icon: BookOpen },
          { id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: !plan.features.quizzes },
          { id: 'grades', label: 'Report Cards', icon: Award },
          { id: 'library', label: 'Library Books', icon: BookMarked },
          { id: 'transit', label: 'School Transit', icon: Layers },
          { id: 'forums', label: 'Discussion', icon: MessageSquare, locked: !plan.features.communications }
        ];
      case 'PARENT':
        return [
          { id: 'dashboard', label: 'Child Tracker', icon: Eye },
          { id: 'homework', label: 'Homework', icon: BookMarked },
          { id: 'timetable', label: 'Class Schedule', icon: Calendar },
          { id: 'materials', label: 'Materials', icon: BookOpen },
          { id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: !plan.features.quizzes },
          { id: 'grades', label: 'Grades Progress', icon: Award },
          { id: 'fees', label: 'Billing Invoices', icon: DollarSign, locked: !plan.features.billing },
          { id: 'library', label: 'Library Books', icon: BookMarked },
          { id: 'transit', label: 'School Transit', icon: Layers },
          { id: 'forums', label: 'Forums', icon: MessageSquare, locked: !plan.features.communications }
        ];
      case 'TEACHER':
        return [
          { id: 'dashboard', label: 'Classes Taught', icon: LayoutDashboard },
          { id: 'timetable', label: 'Teaching Schedule', icon: Calendar },
          { id: 'classroster', label: 'Class Roster', icon: Users, locked: !school || school.subscriptionPlan === 'freemium' },
          { id: 'attendance', label: 'Attendance Roll', icon: Layers },
          { id: 'grades', label: 'Gradebook Matrix', icon: Award },
          { id: 'marksheets', label: 'Homeroom Marksheets', icon: ClipboardList, locked: !school || school.subscriptionPlan === 'freemium' || school.subscriptionPlan === 'basic' },
          { id: 'assignments', label: 'Assignment Creator', icon: PenTool },
          { id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: !plan.features.quizzes },
          { id: 'materials', label: 'Upload Materials', icon: BookOpen, locked: !school || school.subscriptionPlan !== 'enterprise' },
          { id: 'forums', label: 'Discussions', icon: MessageSquare, locked: !plan.features.communications },
          { id: 'analytics', label: 'Class Analytics', icon: Activity }
        ];
      case 'ADMIN':
        return [
          { id: 'dashboard', label: 'School Registry', icon: LayoutDashboard },
          { id: 'students', label: 'Student Directory', icon: Users },
          { id: 'teachers', label: 'Teacher Directory', icon: UsersRound },
          { id: 'parents', label: 'Parent Directory', icon: UsersRound },
          { id: 'classes', label: 'Classes & Sections', icon: Layers },
          { id: 'subjects', label: 'Subject Catalog', icon: BookMarked },
          { id: 'academicsessions', label: 'Academic Sessions', icon: Calendar },
          { id: 'fees', label: 'Invoicing Office', icon: DollarSign, locked: !plan.features.billing },
          { id: 'communications', label: 'Communication Center', icon: Mail },
          { id: 'analytics', label: 'Institutional Analytics', icon: Activity },
          { id: 'rbac', label: 'Dynamic Permissions Grid', icon: Key, locked: school?.subscriptionPlan !== 'enterprise' },
          { id: 'backups', label: 'SaaS Disaster Recovery', icon: Database },
          { id: 'impersonation', label: 'Portal Gateway', icon: Eye },
          { id: 'dangerzone', label: 'Danger Zone', icon: ShieldAlert }
        ];
      case 'FINANCE_ADMIN':
      case 'ACADEMIC_ADMIN':
      case 'EXAM_CONTROLLER':
      case 'LIBRARIAN':
      case 'TRANSPORT_MANAGER':
      case 'CUSTOM_SUB_ADMIN': {
        const isEnterprise = school?.subscriptionPlan === 'enterprise';
        const subAdminTabs: Array<{ id: string; label: string; icon: any; locked?: boolean }> = [
          { id: 'dashboard', label: 'School Registry', icon: LayoutDashboard }
        ];
        
        // If billing is allowed
        if (permissions.billing) {
          subAdminTabs.push({ id: 'fees', label: 'Invoicing Office', icon: DollarSign, locked: !plan.features.billing || !isEnterprise });
          subAdminTabs.push({ id: 'analytics', label: 'Fee Analytics', icon: Activity, locked: !isEnterprise });
        }
        
        // If directory is allowed
        if (permissions.directory) {
          subAdminTabs.push({ id: 'students', label: 'Student Directory', icon: Users, locked: !isEnterprise });
          subAdminTabs.push({ id: 'teachers', label: 'Teacher Directory', icon: UsersRound, locked: !isEnterprise });
          subAdminTabs.push({ id: 'parents', label: 'Parent Directory', icon: UsersRound, locked: !isEnterprise });
        }
        
        // If academics is allowed
        if (permissions.academics) {
          subAdminTabs.push({ id: 'classes', label: 'Classes & Sections', icon: Layers, locked: !isEnterprise });
          subAdminTabs.push({ id: 'subjects', label: 'Subject Catalog', icon: BookMarked, locked: !isEnterprise });
          subAdminTabs.push({ id: 'academicsessions', label: 'Academic Sessions', icon: Calendar, locked: !isEnterprise });
          if (role === 'ACADEMIC_ADMIN') {
            subAdminTabs.push({ id: 'attendance', label: 'Student Attendance', icon: Layers, locked: !isEnterprise });
            subAdminTabs.push({ id: 'assignments', label: 'Homework & Assignments', icon: PenTool, locked: !isEnterprise });
          }
        }
        
        // If grading is allowed
        if (permissions.grading) {
          subAdminTabs.push({ id: 'marksheets', label: ' Homeroom Marksheets', icon: ClipboardList, locked: !isEnterprise });
          subAdminTabs.push({ id: 'quizzes', label: 'Quizzes', icon: PenTool, locked: !plan.features.quizzes || !isEnterprise });
        }

        // If books is allowed (Library)
        if (permissions.books) {
          subAdminTabs.push({ id: 'books', label: 'Library Registry', icon: BookOpen, locked: !isEnterprise });
        }

        // If transport is allowed (Transport)
        if (permissions.transport) {
          subAdminTabs.push({ id: 'transport', label: 'Transit Registry', icon: Layers, locked: !isEnterprise });
        }
        
        // If security is allowed (Sub-Admin backups / telemetry access)
        if (permissions.security) {
          subAdminTabs.push({ id: 'backups', label: 'Disaster Recovery', icon: Database, locked: !isEnterprise });
        }
        
        return subAdminTabs;
      }
      case 'SUPER_ADMIN':
        return [
          { id: 'dashboard', label: 'SaaS Telemetry', icon: Activity, locked: !plan.features.advancedAnalytics },
          { id: 'tenants', label: 'School Registry', icon: Layers },
          { id: 'users', label: 'Global User Manager', icon: UsersRound },
          { id: 'audits', label: 'Global Audit Logs', icon: Settings, locked: !plan.features.auditLogs },
          { id: 'backups', label: 'Disaster Recovery Panel', icon: Database },
          { id: 'logging', label: 'Centralized Logging Console', icon: Terminal }
        ];
      default:
        return [];
    }
  };

  const tabs = getTabs();

  const sidebarContent = (
    <>
      <div className="space-y-6">
        {/* Portal Title label */}
        <div className="px-3 py-2 bg-slate-900/40 rounded-xl border border-slate-850">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Console Context</p>
          <p className="text-xs font-semibold text-slate-200 mt-1 truncate">
            {role === 'STUDENT' && 'Student Portal'}
            {role === 'PARENT' && 'Parent Guardian Portal'}
            {role === 'TEACHER' && 'Teacher Portal'}
            {role === 'ADMIN' && 'Head Administrative Portal'}
            {role === 'SUPER_ADMIN' && 'Super Admin Engine'}
            {['FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN'].includes(role) && 'Sub-Admin Portal'}
          </p>
        </div>

        {/* Dynamic Navigation Tabs */}
        <nav className="space-y-1">
          {tabs.map(tab => {
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
                {isLocked && (
                  <span className="w-5 h-5 flex flex-shrink-0 items-center justify-center bg-amber-500/10 rounded-full border border-amber-500/30">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-slate-950/40 border border-slate-850/60 rounded-xl text-center">
        <p className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Version Control</p>
        <p className="text-[10px] font-mono text-slate-400 mt-0.5">AEGIS-CORE v1.4.2</p>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="w-64 h-[calc(100vh-62px)] glass dark:glass-dark border-r border-slate-800 bg-[#070a13]/60 hidden md:flex flex-col justify-between p-4 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Overlay Drawer */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/60 backdrop-blur-sm animate-fade-in">
          {/* Click background to close */}
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
          <div className="w-64 h-full bg-[#070a13] border-r border-slate-800 flex flex-col justify-between p-4 z-50 animate-slide-right relative">
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 rounded-full transition-all"
              title="Close Menu"
            >
              <X size={18} />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
