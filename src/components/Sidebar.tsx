import React from 'react';
import { useStore } from '../store/useStore';
import { mockDb } from '../services/mockDb';
import { subscriptionPlans } from '../services/subscriptionConfig';
import { 
  LayoutDashboard, Calendar, BookOpen, PenTool, Award, MessageSquare, 
  Users, Layers, BookMarked, DollarSign, Activity, Settings, Eye, UsersRound, ClipboardList
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { session } = useStore();

  if (!session) return null;

  const role = session.user.role;
  const school = session.user.schoolId ? mockDb.schools.find(s => s.id === session.user.schoolId) : null;
  const plan = school ? subscriptionPlans[school.subscriptionPlan] || subscriptionPlans.freemium : subscriptionPlans.freemium;

  const filterTabs = (tabs: any[]) => {
    if (!plan.features.communications) {
      return tabs.filter(t => t.id !== 'forums');
    }
    return tabs;
  };

  // Define tab mappings per role
  const getTabs = () => {
    switch (role) {
      case 'STUDENT':
        return filterTabs([
          { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
          { id: 'timetable', label: 'Schedule', icon: Calendar },
          { id: 'materials', label: 'Materials', icon: BookOpen },
          { id: 'quizzes', label: 'Quizzes', icon: PenTool },
          { id: 'grades', label: 'Report Cards', icon: Award },
          { id: 'forums', label: 'Discussion', icon: MessageSquare }
        ]);
      case 'PARENT':
        return filterTabs([
          { id: 'dashboard', label: 'Child Tracker', icon: Eye },
          { id: 'timetable', label: 'Class Schedule', icon: Calendar },
          { id: 'grades', label: 'Grades Progress', icon: Award },
          { id: 'fees', label: 'Billing Invoices', icon: DollarSign },
          { id: 'forums', label: 'Forums', icon: MessageSquare }
        ]);
      case 'TEACHER':
        return filterTabs([
          { id: 'dashboard', label: 'Classes Taught', icon: LayoutDashboard },
          { id: 'timetable', label: 'Teaching Schedule', icon: Calendar },
          { id: 'classroster', label: 'Class Roster', icon: Users },
          { id: 'attendance', label: 'Attendance Roll', icon: Layers },
          { id: 'grades', label: 'Gradebook Matrix', icon: Award },
          { id: 'marksheets', label: 'Homeroom Marksheets', icon: ClipboardList },
          { id: 'assignments', label: 'Assignment Creator', icon: PenTool },
          { id: 'materials', label: 'Upload Materials', icon: BookOpen },
          { id: 'forums', label: 'Discussions', icon: MessageSquare }
        ]);
      case 'ADMIN':
        return filterTabs([
          { id: 'dashboard', label: 'School Registry', icon: LayoutDashboard },
          { id: 'students', label: 'Student Directory', icon: Users },
          { id: 'teachers', label: 'Teacher Directory', icon: UsersRound },
          { id: 'parents', label: 'Parent Directory', icon: UsersRound },
          { id: 'classes', label: 'Classes & Sections', icon: Layers },
          { id: 'subjects', label: 'Subject Catalog', icon: BookMarked },
          { id: 'fees', label: 'Invoicing Office', icon: DollarSign },
          { id: 'impersonation', label: 'Portal Gateway', icon: Eye }
        ]);
      case 'SUPER_ADMIN':
        return [
          { id: 'dashboard', label: 'SaaS Telemetry', icon: Activity },
          { id: 'tenants', label: 'School Registry', icon: Layers },
          { id: 'users', label: 'Global User Manager', icon: UsersRound },
          { id: 'audits', label: 'Global Audit Logs', icon: Settings }
        ];
      default:
        return [];
    }
  };

  const tabs = getTabs();

  return (
    <aside className="w-64 h-[calc(100vh-62px)] glass dark:glass-dark border-r border-slate-800 bg-[#070a13]/60 hidden md:flex flex-col justify-between p-4 z-30">
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
          </p>
        </div>

        {/* Dynamic Navigation Tabs */}
        <nav className="space-y-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 active:scale-[0.98] ${
                  isActive 
                    ? 'bg-brand-600/10 border border-brand-500/25 text-brand-400 font-semibold' 
                    : 'border border-transparent text-slate-400 hover:text-slate-100 hover:bg-slate-900/45'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-brand-500' : 'text-slate-400'} />
                <span>{tab.label}</span>
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
    </aside>
  );
};
