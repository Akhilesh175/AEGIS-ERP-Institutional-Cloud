import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { supabase } from '../lib/supabase';
import { AuditLog, School, User } from '../types';
import { mockDb } from '../services/mockDb';
import { GlassCard } from '../components/GlassCard';
import { OfflineSyncManager } from '../components/OfflineSyncManager';
import { 
  Activity, Building, Settings, ShieldAlert, Cpu, 
  Layers, Key, PlusCircle, Search, RefreshCw, Eye, EyeOff,
  Database, Terminal, HardDrive, Play, CheckCircle2, Clock, Sliders, Shield, AlertTriangle, CheckCircle, XCircle, Trash2, CheckSquare, Mail, Send
} from 'lucide-react';

export const SuperAdminPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session } = useStore();
  const superAdminId = session?.user.id;

  // States
  const [stats, setStats] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<(AuditLog & { userName: string; userEmail: string })[]>([]);
  const [searchAuditQuery, setSearchAuditQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // ── SaaS backups states ──
  const [backupPolicy, setBackupPolicy] = useState<'hourly' | 'daily' | 'weekly'>('daily');
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupLogs, setBackupLogs] = useState<any[]>([
    { id: '1', filename: 'aegis_global_dump_20260529_0000.enc', type: 'FULL_SNAPSHOT', size: '4.8 GB', status: 'SUCCESS', hash: 'sha256-k8m9n0...', timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: '2', filename: 'aegis_global_dump_20260528_0000.enc', type: 'FULL_SNAPSHOT', size: '4.7 GB', status: 'SUCCESS', hash: 'sha256-j2k3l4...', timestamp: new Date(Date.now() - 90000000).toISOString() }
  ]);
  const [restoreToken, setRestoreToken] = useState('');
  const [restoreProgress, setRestoreProgress] = useState(-1);
  const [restoreLogs, setRestoreLogs] = useState<string[]>([]);

  // ── Logging & crash auditing console states ──
  const [loggingConsoleOpen, setLoggingConsoleOpen] = useState(true);
  const [crashLogs, setCrashLogs] = useState<any[]>([
    { id: 'c1', type: 'NETWORK', code: 'TIMEOUT', msg: 'Network timeout in syncNotificationsData fetch', occurrences: 12, severity: 'HIGH', resolved: false },
    { id: 'c2', type: 'SECURITY', code: 'RLS_VIOLATION', msg: 'Database RLS policy select failure on public.parent_student_mappings', occurrences: 3, severity: 'CRITICAL', resolved: false },
    { id: 'c3', type: 'RENDER', code: 'HYDRATION_MISMATCH', msg: 'Hydration mismatch during SSR pre-render pass', occurrences: 1, severity: 'LOW', resolved: true },
    { id: 'c4', type: 'WEBSOCKET', code: 'CONNECTION_DROP', msg: 'Supabase Realtime WebSocket handshake dropped unexpectedly', occurrences: 8, severity: 'MEDIUM', resolved: false }
  ]);

  // Forms
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [schName, setSchName] = useState('');
  const [schAddr, setSchAddr] = useState('');
  const [schPhone, setSchPhone] = useState('');
  const [schPlan, setSchPlan] = useState('enterprise');
  const [schCountry, setSchCountry] = useState('USA');
  const [schCurrencyCode, setSchCurrencyCode] = useState('USD');
  const [schCurrencySymbol, setSchCurrencySymbol] = useState('$');
  const [schTimezone, setSchTimezone] = useState('America/New_York');

  const countryPresets = [
    { name: 'United States', code: 'USA', currency: 'USD', symbol: '$', timezone: 'America/New_York' },
    { name: 'United Kingdom', code: 'GBR', currency: 'GBP', symbol: '£', timezone: 'Europe/London' },
    { name: 'India', code: 'IND', currency: 'INR', symbol: '₹', timezone: 'Asia/Kolkata' },
    { name: 'Nigeria', code: 'NGA', currency: 'NGN', symbol: '₦', timezone: 'Africa/Lagos' },
    { name: 'South Africa', code: 'ZAF', currency: 'ZAR', symbol: 'R', timezone: 'Africa/Johannesburg' },
    { name: 'United Arab Emirates', code: 'ARE', currency: 'AED', symbol: 'د.إ', timezone: 'Asia/Dubai' },
    { name: 'Kenya', code: 'KEN', currency: 'KES', symbol: 'KSh', timezone: 'Africa/Nairobi' },
    { name: 'Canada', code: 'CAN', currency: 'CAD', symbol: 'C$', timezone: 'America/Toronto' },
    { name: 'Australia', code: 'AUS', currency: 'AUD', symbol: 'A$', timezone: 'Australia/Sydney' },
    { name: 'Europe', code: 'EUR', currency: 'EUR', symbol: '€', timezone: 'Europe/Paris' },
  ];

  // Admin Creation Forms
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [admEmail, setAdmEmail] = useState('');
  const [admFirst, setAdmFirst] = useState('');
  const [admLast, setAdmLast] = useState('');
  const [admPhone, setAdmPhone] = useState('');
  const [admSchoolId, setAdmSchoolId] = useState('');
  const [admPassword, setAdmPassword] = useState('');
  const [showAdmPassword, setShowAdmPassword] = useState(false);

  // Password Reset Modal states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState('');
  const [resetUserName, setResetUserName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // Edit Subscription states
  const [showEditSubscriptionModal, setShowEditSubscriptionModal] = useState(false);
  const [editSubscriptionSchoolId, setEditSubscriptionSchoolId] = useState('');
  const [editSubscriptionSchoolName, setEditSubscriptionSchoolName] = useState('');
  const [editSubscriptionPlan, setEditSubscriptionPlan] = useState('');

  // Sync school selection
  useEffect(() => {
    if (stats?.schoolsList?.length > 0) {
      const isValid = stats.schoolsList.some((s: School) => s.id === admSchoolId);
      if (!isValid) {
        setAdmSchoolId(stats.schoolsList[0].id);
      }
    } else {
      setAdmSchoolId('');
    }
  }, [stats, showAddAdmin, admSchoolId]);

  const handleResetPassword = (userId: string, name: string) => {
    setResetUserId(userId);
    setResetUserName(name);
    setNewPassword('password');
    setShowResetModal(true);
  };

  const loadData = async () => {
    if (!superAdminId) return;
    try {
      setLoading(true);
      const data = await mockApi.superAdminGetStats(superAdminId);
      setStats(data);

      const logs = await mockApi.superAdminGetAuditLogs(superAdminId, searchAuditQuery);
      setAuditLogs(logs);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      alert("Error loading stats: " + (err.message || String(err)));
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      // Auto refresh telemetry stats only
      if (activeTab === 'dashboard' && superAdminId) {
        mockApi.superAdminGetStats(superAdminId).then(data => {
          setStats(data);
        });
      }
    }, 4000); // Telemetry refresh every 4s
    return () => clearInterval(interval);
  }, [superAdminId, activeTab]);

  // Real-time Supabase Postgres changes subscription for platform directories
  useEffect(() => {
    if (!superAdminId) return;

    const handleSuperAdminSync = () => {
      console.log('Realtime telemetry or tenant update detected, refreshing super admin dashboard...');
      loadData();
    };

    const channel = supabase
      .channel('superadmin-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, handleSuperAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, handleSuperAdminSync)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'audit_logs' }, handleSuperAdminSync)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [superAdminId]);

  useEffect(() => {
    if (activeTab === 'audits' && superAdminId) {
      mockApi.superAdminGetAuditLogs(superAdminId, searchAuditQuery).then(logs => {
        setAuditLogs(logs);
      });
    }
  }, [searchAuditQuery, activeTab]);

  const handleGlobalBackup = async () => {
    if (backupLoading) return;
    setBackupLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));

    const snapId = Math.random().toString(36).substr(2, 5);
    const newLog = {
      id: Math.random().toString(),
      filename: `aegis_global_dump_20260529_${snapId}.enc`,
      type: 'MANUAL_SNAPSHOT',
      size: '4.9 GB',
      status: 'SUCCESS',
      hash: 'sha256-' + Math.random().toString(36).substr(2, 10) + '...',
      timestamp: new Date().toISOString()
    };

    setBackupLogs(prev => [newLog, ...prev]);
    setBackupLoading(false);
    alert('SaaS Global Core Database & Storage snapshot completed successfully!');
  };

  const handleGlobalRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restoreToken) {
      alert('Please enter a valid global master recovery token.');
      return;
    }
    setRestoreProgress(0);
    setRestoreLogs([]);

    const steps = [
      { progress: 15, log: 'Authenticating global SaaS master credentials...' },
      { progress: 30, log: 'Acquiring global replica instance lease lock...' },
      { progress: 50, log: 'Restoring multi-tenant public schema tables...' },
      { progress: 70, log: 'Re-syncing multi-tenant object storage cache chains...' },
      { progress: 85, log: 'Verifying row isolation security constraints across all tenants...' },
      { progress: 100, log: 'Global rollback complete! All child cluster nodes updated.' }
    ];

    for (const step of steps) {
      await new Promise(resolve => setTimeout(resolve, 500));
      setRestoreProgress(step.progress);
      setRestoreLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${step.log}`]);
    }

    alert('SaaS Platform Rollback completed successfully! Tenants synchronized.');
    setRestoreProgress(-1);
    setRestoreToken('');
  };

  const handleResolveCrash = (id: string) => {
    setCrashLogs(prev => prev.map(c => c.id === id ? { ...c, resolved: true } : c));
    alert('Crash alert status updated to RESOLVED.');
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superAdminId || !schName.trim()) return;

    try {
      await mockApi.superAdminCreateSchool(
        superAdminId, 
        schName, 
        schAddr, 
        schPhone, 
        schPlan,
        schCountry,
        schCurrencyCode,
        schCurrencySymbol,
        schTimezone
      );
      setShowAddSchool(false);
      setSchName('');
      setSchAddr('');
      setSchPhone('');
      setSchCountry('USA');
      setSchCurrencyCode('USD');
      setSchCurrencySymbol('$');
      setSchTimezone('America/New_York');
      loadData();
      alert('Institutional school node deployed to Aegis SaaS Cluster!');
    } catch (err: any) {
      alert(err.message || 'Error creating school');
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superAdminId || !admEmail.trim() || !admSchoolId) {
      alert('Please fill out all required fields, including selecting an institutional school node.');
      return;
    }
    if (!admPassword || admPassword.length < 6) {
      alert('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      await mockApi.superAdminCreateAdmin(
        superAdminId,
        admEmail,
        admFirst,
        admLast,
        admSchoolId,
        admPhone,
        admPassword
      );
      setShowAddAdmin(false);
      setAdmEmail('');
      setAdmFirst('');
      setAdmLast('');
      setAdmPhone('');
      setAdmPassword('');
      setShowAdmPassword(false);
      loadData();
      setLoading(false);
      alert('School Administrative key and security context successfully deployed!');
    } catch (err: any) {
      setLoading(false);
      alert(err.message || 'Error creating school administrator');
    }
  };

  const handlePerformReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superAdminId || !resetUserId || !newPassword.trim()) return;

    try {
      setLoading(true);
      await mockApi.superAdminResetPassword(superAdminId, resetUserId, newPassword);
      setShowResetModal(false);
      setResetUserId('');
      setResetUserName('');
      setNewPassword('');
      loadData();
      setLoading(false);
      alert('Credentials updated successfully!');
    } catch (err: any) {
      setLoading(false);
      alert(err.message || 'Error resetting password');
    }
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!superAdminId) return;
    if (!window.confirm(`Are you sure you want to permanently delete the institution "${schoolName}" and all associated data?`)) return;
    try {
      setLoading(true);
      await mockApi.superAdminDeleteSchool(superAdminId, schoolId);
      loadData();
      setLoading(false);
      alert('Institution successfully deleted from cluster.');
    } catch (err: any) {
      setLoading(false);
      alert(err.message || 'Error deleting school');
    }
  };

  const handleDeleteAdmin = async (adminId: string, adminName: string) => {
    if (!superAdminId) return;
    if (!window.confirm(`Are you sure you want to delete the school admin account for ${adminName}?`)) return;
    try {
      setLoading(true);
      await mockApi.superAdminDeleteAdmin(superAdminId, adminId);
      loadData();
      setLoading(false);
      alert('Admin account successfully deleted.');
    } catch (err: any) {
      setLoading(false);
      alert(err.message || 'Error deleting admin');
    }
  };

  const handleOpenEditSubscription = (schoolId: string, schoolName: string, currentPlan: string) => {
    setEditSubscriptionSchoolId(schoolId);
    setEditSubscriptionSchoolName(schoolName);
    setEditSubscriptionPlan(currentPlan);
    setShowEditSubscriptionModal(true);
  };

  const handleEditSubscriptionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superAdminId || !editSubscriptionSchoolId || !editSubscriptionPlan) return;
    try {
      setLoading(true);
      await mockApi.superAdminUpdateSchoolSubscription(superAdminId, editSubscriptionSchoolId, editSubscriptionPlan);
      setShowEditSubscriptionModal(false);
      loadData();
      setLoading(false);
      alert('Subscription plan successfully updated.');
    } catch (err: any) {
      setLoading(false);
      alert(err.message || 'Error updating subscription');
    }
  };

  if (!stats) {
    return <div className="py-12 text-center text-slate-400 text-sm">Synchronizing telemetry parameters...</div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in">
      
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          
          {/* SaaS Telemetry Monitors grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <GlassCard className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">CPU Core Load</span>
                <Cpu className="text-brand-500" size={16} />
              </div>
              <h3 className="text-3xl font-extrabold text-brand-400 font-mono">
                {stats.systemTelemetry.cpuLoad.toFixed(1)}%
              </h3>
              {/* Telemetry graphic progress bar */}
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-500 h-full transition-all duration-1000" 
                  style={{ width: `${stats.systemTelemetry.cpuLoad}%` }}
                />
              </div>
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">Cluster Memory</span>
                <Activity className="text-brand-500" size={16} />
              </div>
              <h3 className="text-3xl font-extrabold text-brand-400 font-mono">
                {stats.systemTelemetry.memoryUsage.toFixed(1)}%
              </h3>
              <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                <div 
                  className="bg-brand-500 h-full transition-all duration-1000" 
                  style={{ width: `${stats.systemTelemetry.memoryUsage}%` }}
                />
              </div>
            </GlassCard>

            <GlassCard className="space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">API Gateway Requests</span>
                <h3 className="text-xs text-slate-400">Request Ledger</h3>
              </div>
              <h3 className="text-2xl font-extrabold text-slate-200 font-mono">
                {stats.systemTelemetry.apiRequestsCount.toLocaleString()} <span className="text-xs font-normal text-slate-500">rpm</span>
              </h3>
              <p className="text-[10px] text-slate-500">Database latency: {stats.systemTelemetry.dbLatencyMs.toFixed(2)}ms</p>
            </GlassCard>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* SaaS Schools Directory */}
            <GlassCard className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-850">
                <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                  <Building className="text-brand-500" size={16} />
                  Active Registered Institutions ({stats.schoolsList.length})
                </h3>
                <button 
                  onClick={() => setShowAddSchool(true)}
                  className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                >
                  <PlusCircle size={13} /> Add School
                </button>
              </div>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {stats.schoolsList.map((s: School) => (
                  <div key={s.id} className="p-3 bg-slate-900/30 border border-slate-850 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-200 text-xs">{s.name}</h4>
                      <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">{s.subscriptionPlan} subscription</p>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 font-mono">ID: {s.id.substr(0,8)}</span>
                  </div>
                ))}
              </div>
            </GlassCard>

            {/* SaaS Platform Overview */}
            <GlassCard className="space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-slate-200 text-sm pb-2 border-b border-slate-850">Cluster Operations Control</h3>
                <p className="text-xs text-slate-400 leading-relaxed mt-2">
                  This console context has unrestricted access to the entire institution network structure. Telemetry tracking coordinates database latency records, cluster requests routing, and billing SaaS income logs.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-850 mt-4">
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Tenants</span>
                  <p className="text-lg font-bold text-slate-200 mt-1">{stats.totalSchools}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">Active sessions</span>
                  <p className="text-lg font-bold text-slate-200 mt-1">{stats.activeSessions}</p>
                </div>
                <div>
                  <span className="text-[9px] text-slate-500 font-bold uppercase block leading-none">SaaS Income</span>
                  <p className="text-lg font-bold text-green-400 mt-1">${stats.totalSubscriptionsIncome.toFixed(2)}</p>
                </div>
              </div>
            </GlassCard>
          </div>

          <OfflineSyncManager />
        </div>
      )}

      {activeTab === 'tenants' && (
        <div className="space-y-6 animate-fade-in">
          <GlassCard className="space-y-6">
            <div className="border-b border-slate-850 pb-3">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Layers className="text-brand-500" size={18} />
                SaaS Multi-Tenant Configuration Panel
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Active configuration controls for multi-school parameters, licensing, and domain bindings.
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 font-bold">
                    <th className="py-3 px-4">School ID</th>
                    <th className="py-3 px-4">Institution Name</th>
                    <th className="py-3 px-4">Subscription plan</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {stats.schoolsList.map((s: School) => (
                    <tr key={s.id} className="hover:bg-slate-900/10 text-slate-200">
                      <td className="py-3 px-4 font-mono">{s.id}</td>
                      <td className="py-3 px-4 font-semibold">{s.name}</td>
                      <td className="py-3 px-4 text-brand-400 font-bold uppercase tracking-wider">{s.subscriptionPlan}</td>
                      <td className="py-3 px-4 text-green-400 font-bold">ACTIVE CLUSTER</td>
                      <td className="py-3 px-4 flex items-center gap-2">
                        <button 
                          onClick={() => handleOpenEditSubscription(s.id, s.name, s.subscriptionPlan)}
                          className="text-brand-400 hover:text-brand-300 font-semibold text-[10px] border border-brand-500/20 hover:border-brand-500/40 bg-brand-500/5 hover:bg-brand-500/10 px-2 py-1 rounded transition-all uppercase tracking-wider"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => handleDeleteSchool(s.id, s.name)}
                          className="text-red-400 hover:text-red-300 font-semibold text-[10px] border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded transition-all uppercase tracking-wider"
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

          {/* School Administrators Section */}
          <GlassCard className="space-y-6">
            <div className="border-b border-slate-850 pb-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="font-bold text-slate-100 flex items-center gap-2">
                  <Key className="text-brand-500" size={18} />
                  School Administrators Registry
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Enrolled School Admins authorized to govern departments, register faculty, and manage accounts.
                </p>
              </div>
              <button 
                onClick={() => {
                  if (stats.schoolsList.length === 0) {
                    alert('Please deploy at least one school before creating administrative key contexts.');
                    return;
                  }
                  setShowAddAdmin(true);
                }}
                className="bg-brand-600 hover:bg-brand-500 text-white font-semibold text-xs px-2.5 py-1.5 rounded-xl transition-colors flex items-center gap-1 shrink-0 self-start sm:self-center"
              >
                <PlusCircle size={13} /> Register School Admin
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 font-bold">
                    <th className="py-3 px-4">Admin Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4">Phone contact</th>
                    <th className="py-3 px-4">Governed Institution</th>
                    <th className="py-3 px-4">Status Mapping</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {stats?.adminsList?.map((usr: User) => {
                      const getSchoolName = (schoolId: string) => {
                        const school = stats?.schoolsList?.find((s: any) => s.id === schoolId);
                        return school ? school.name : 'Unknown Institution';
                      };

                      return (
                        <tr key={usr.id} className="hover:bg-slate-900/10 text-slate-200">
                          <td className="py-3 px-4 font-semibold">{usr.firstName} {usr.lastName}</td>
                          <td className="py-3 px-4 font-mono text-slate-300">{usr.email}</td>
                          <td className="py-3 px-4 text-slate-400 font-mono">{usr.phone || 'N/A'}</td>
                          <td className="py-3 px-4 text-brand-400 font-bold uppercase tracking-wider">{getSchoolName(usr.schoolId!)}</td>
                          <td className="py-3 px-4">
                            <span className="bg-green-500/10 border border-green-500/20 text-green-400 font-bold px-2 py-0.5 rounded text-[10px] uppercase font-mono tracking-wider">
                              SECURE SESSION
                            </span>
                          </td>
                          <td className="py-3 px-4 flex items-center gap-2">
                            <button 
                              onClick={() => handleResetPassword(usr.id, `${usr.firstName} ${usr.lastName}`)}
                              className="text-brand-400 hover:text-brand-300 font-semibold text-[10px] border border-brand-500/20 hover:border-brand-500/40 bg-brand-500/5 hover:bg-brand-500/10 px-2 py-1 rounded transition-all uppercase tracking-wider"
                            >
                              Reset Pass
                            </button>
                            <button 
                              onClick={() => handleDeleteAdmin(usr.id, `${usr.firstName} ${usr.lastName}`)}
                              className="text-red-400 hover:text-red-300 font-semibold text-[10px] border border-red-500/20 hover:border-red-500/40 bg-red-500/5 hover:bg-red-500/10 px-2 py-1 rounded transition-all uppercase tracking-wider"
                            >
                              Delete
                            </button>
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

      {activeTab === 'users' && (
        <GlassCard className="space-y-6 animate-fade-in">
          <div className="border-b border-slate-850 pb-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <Layers className="text-brand-500" size={18} />
                Global User Accounts Registry
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Full list of institutional users, roles, and password management controls.
              </p>
            </div>
            
            <div className="w-full sm:w-72">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-slate-500" size={14} />
                <input 
                  type="text" 
                  placeholder="Search user email or name..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none w-full"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold">
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Email Address</th>
                  <th className="py-3 px-4">Platform Role</th>
                  <th className="py-3 px-4">Mapped School</th>
                  <th className="py-3 px-4">Active Key</th>
                  <th className="py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850 text-slate-200">
                {mockDb.users
                  .filter(u => {
                    if (!userSearchQuery) return true;
                    const q = userSearchQuery.toLowerCase();
                    return (
                      u.email.toLowerCase().includes(q) ||
                      (u.firstName + ' ' + u.lastName).toLowerCase().includes(q)
                    );
                  })
                  .map((usr: User) => {
                    const getSchoolName = (u: User) => {
                      if (u.role === 'SUPER_ADMIN') return 'SaaS Global Master Scope';
                      
                      let sId = u.schoolId;
                      if (!sId) {
                        if (u.role === 'STUDENT') {
                          sId = mockDb.students.find(s => s.userId === u.id)?.schoolId;
                        } else if (u.role === 'TEACHER') {
                          sId = mockDb.teachers.find(t => t.userId === u.id)?.schoolId;
                        } else if (u.role === 'PARENT') {
                          sId = mockDb.parents.find(p => p.userId === u.id)?.schoolId;
                        }
                      }
                      
                      const schId = sId || 'school-1';
                      const sch = stats?.schoolsList?.find((s: any) => s.id === schId) || mockDb.schools.find(s => s.id === schId);
                      return sch ? sch.name : 'Aegis Academy of Excellence';
                    };

                    return (
                      <tr key={usr.id} className="hover:bg-slate-900/10">
                        <td className="py-3 px-4 font-semibold">{usr.firstName} {usr.lastName}</td>
                        <td className="py-3 px-4 font-mono text-slate-350">{usr.email}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded font-mono text-[9px] font-bold uppercase ${
                            usr.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-400 border border-red-500/10' :
                            usr.role === 'ADMIN' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/10' :
                            usr.role === 'TEACHER' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/10' :
                            usr.role === 'PARENT' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/10' :
                            'bg-green-500/10 text-green-400 border border-green-500/10'
                          }`}>
                            {usr.role}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400 font-semibold">{getSchoolName(usr)}</td>
                        <td className="py-3 px-4 font-mono text-brand-400">{usr.password || 'password'}</td>
                        <td className="py-3 px-4">
                          <button 
                            onClick={() => handleResetPassword(usr.id, usr.firstName + ' ' + usr.lastName)}
                            className="bg-brand-600/10 hover:bg-brand-600/25 border border-brand-500/20 hover:border-brand-500/40 text-brand-400 font-bold px-2 py-1 rounded-lg text-[10px] transition-all"
                          >
                            Reset Password
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {activeTab === 'audits' && (
        <GlassCard className="space-y-6">
          <div className="border-b border-slate-850 pb-3 flex flex-col sm:flex-row items-center justify-between gap-4">
            <h3 className="font-bold text-slate-100 flex items-center gap-2">
              <Building className="text-brand-500" size={18} />
              Global Platform Security & Activity Audit Trail
            </h3>
            
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-2 text-slate-500" size={14} />
                <input 
                  type="text" 
                  placeholder="Search actions or payloads..."
                  value={searchAuditQuery}
                  onChange={(e) => setSearchAuditQuery(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs focus:outline-none w-full"
                />
              </div>
              <button 
                onClick={loadData}
                className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-slate-100 p-1.5 rounded-xl transition-all shrink-0"
                title="Force Refresh Logs"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-850 text-slate-400 font-bold">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action Event</th>
                  <th className="py-3 px-4">Operator User</th>
                  <th className="py-3 px-4">Network IP</th>
                  <th className="py-3 px-4">Transaction Payload Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {auditLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-900/10 text-slate-200">
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {new Date(l.createdAt).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 font-bold text-brand-400 font-mono tracking-wide">{l.action}</td>
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-semibold">{l.userName}</p>
                        <p className="text-[10px] text-slate-500">{l.userEmail}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400">{l.ipAddress || '127.0.0.1'}</td>
                    <td className="py-3 px-4 text-slate-400 italic max-w-sm truncate">
                      {JSON.stringify(l.details || {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {/* Deploy Institutional Tenant Drawer overlay */}
      {showAddSchool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm">Deploy Institutional Tenant</h4>
              <button onClick={() => setShowAddSchool(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreateSchool} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Institution School Name</label>
                <input type="text" placeholder="e.g. Stanford High Academy" value={schName} onChange={(e) => setSchName(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none" required />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campus Physical Address</label>
                <input type="text" placeholder="e.g. 100 University Circle, Palo Alto" value={schAddr} onChange={(e) => setSchAddr(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campus Phone</label>
                  <input type="text" placeholder="+1 (555) 928" value={schPhone} onChange={(e) => setSchPhone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">License Subscription Plan</label>
                  <select value={schPlan} onChange={(e) => setSchPlan(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none">
                    <option value="basic">Basic Cloud</option>
                    <option value="pro">Pro Multi-Tenant</option>
                    <option value="enterprise">Enterprise Dedicated Cluster</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Country Location Preset</label>
                <select
                  value={schCountry}
                  onChange={(e) => {
                    const countryCode = e.target.value;
                    setSchCountry(countryCode);
                    const preset = countryPresets.find(p => p.code === countryCode);
                    if (preset) {
                      setSchCurrencyCode(preset.currency);
                      setSchCurrencySymbol(preset.symbol);
                      setSchTimezone(preset.timezone);
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none"
                >
                  {countryPresets.map(p => (
                    <option key={p.code} value={p.code}>{p.name} ({p.currency})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Currency Code</label>
                  <input type="text" value={schCurrencyCode} onChange={(e) => setSchCurrencyCode(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none font-mono" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Symbol</label>
                  <input type="text" value={schCurrencySymbol} onChange={(e) => setSchCurrencySymbol(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none font-mono" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Timezone</label>
                  <input type="text" value={schTimezone} onChange={(e) => setSchTimezone(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none font-mono" required />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAddSchool(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Deploy Cluster</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Register School Admin Drawer overlay */}
      {showAddAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-md space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Key className="text-brand-500" size={16} />
                Register School Administrator
              </h4>
              <button onClick={() => setShowAddAdmin(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">First Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Richard" 
                    value={admFirst} 
                    onChange={(e) => setAdmFirst(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" 
                    required 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Hendricks" 
                    value={admLast} 
                    onChange={(e) => setAdmLast(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">School Admin Email Address</label>
                <input 
                  type="email" 
                  placeholder="admin@school.com" 
                  value={admEmail} 
                  onChange={(e) => setAdmEmail(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phone Contact</label>
                  <input 
                    type="text" 
                    placeholder="+1 (555) 0000" 
                    value={admPhone} 
                    onChange={(e) => setAdmPhone(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Governed Institution</label>
                  <select 
                    value={admSchoolId} 
                    onChange={(e) => setAdmSchoolId(e.target.value)} 
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    required
                  >
                    {stats.schoolsList.map((sch: School) => (
                      <option key={sch.id} value={sch.id}>{sch.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Admin Password</label>
                <div className="relative">
                  <input 
                    type={showAdmPassword ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={admPassword}
                    onChange={(e) => setAdmPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 pr-9 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAdmPassword(p => !p)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showAdmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowAddAdmin(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" disabled={loading} className="glass-btn-primary text-xs">
                  {loading ? 'Registering...' : 'Deploy Security Key'}
                </button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* Global Password Reset Modal Overlay */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-sm space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Key className="text-brand-500" size={15} />
                Global Reset Credentials
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
                  placeholder="Enter new global password" 
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)} 
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500" 
                  required 
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowResetModal(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Apply Globally</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}

      {/* ── 1. SAAS GLOBAL DISASTER RECOVERY & BACKUPS ── */}
      {activeTab === 'backups' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-brand-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <HardDrive className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Global SaaS Disaster Recovery & Backups</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Manage backups and rollbacks across the entire multi-tenant ERP platform instance.</p>
              </div>
            </div>
          </GlassCard>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Action Card */}
            <GlassCard className="lg:col-span-2 space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Settings className="text-brand-400" size={15} />
                Platform Archival Settings
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Automated Backup Polices</label>
                  <select 
                    value={backupPolicy} 
                    onChange={(e) => setBackupPolicy(e.target.value as any)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                  >
                    <option value="hourly">Hourly Core Incremental Dump</option>
                    <option value="daily">Daily Total Dump (Highly Secure)</option>
                    <option value="weekly">Weekly Full Platform Snapshot</option>
                  </select>
                </div>

                <div className="space-y-1 justify-end flex flex-col">
                  <button 
                    onClick={handleGlobalBackup} 
                    disabled={backupLoading}
                    className="glass-btn-primary py-2.5 font-bold text-xs flex items-center justify-center gap-2"
                  >
                    {backupLoading ? (
                      <>
                        <RefreshCw size={13} className="animate-spin" />
                        <span>Creating SaaS Platform Backup...</span>
                      </>
                    ) : (
                      <>
                        <HardDrive size={13} />
                        <span>Trigger Full State Snapshot</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-900/40 border border-slate-850 rounded-xl">
                <h5 className="text-[11px] font-bold text-slate-350">Platform Restoration Policy</h5>
                <p className="text-[10px] text-slate-400 leading-relaxed mt-1">
                  SaaS level restorations overwrite core schema tables across all schools. Row levels are fully isolated inside the dump block, but executing restorations requires absolute confirmation and master encryption keys.
                </p>
              </div>
            </GlassCard>

            {/* Rollback Gateway */}
            <GlassCard className="space-y-4">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <Shield className="text-red-400" size={15} />
                Global Restorations Gateway
              </h4>

              <form onSubmit={handleGlobalRestore} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Global Master Recovery token</label>
                  <input 
                    type="text" 
                    placeholder="Enter sha256 master token" 
                    value={restoreToken}
                    onChange={(e) => setRestoreToken(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-red-500 font-mono"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={restoreProgress >= 0}
                  className="w-full px-4 py-2.5 rounded-xl bg-red-650 hover:bg-red-550 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <RefreshCw size={13} className={restoreProgress >= 0 ? 'animate-spin' : ''} />
                  <span>{restoreProgress >= 0 ? 'Executing Global Restore...' : 'Restore Core Platform state'}</span>
                </button>
              </form>

              {restoreProgress >= 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 font-mono">
                    <span>GLOBAL RESTORE IN PROGRESS</span>
                    <span>{restoreProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-950 rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${restoreProgress}%` }} />
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Console logging output stream */}
          {restoreLogs.length > 0 && (
            <GlassCard className="space-y-2">
              <h4 className="font-bold text-slate-200 text-xs font-mono">GLOBAL RECOVERY CONSOLE STREAM</h4>
              <div className="bg-black/90 border border-slate-900 rounded-xl p-3 max-h-48 overflow-y-auto space-y-1.5">
                {restoreLogs.map((logStr, i) => (
                  <p key={i} className="text-[10px] font-mono text-slate-450 leading-relaxed">{logStr}</p>
                ))}
              </div>
            </GlassCard>
          )}

          {/* SaaS global registry list */}
          <GlassCard className="space-y-3">
            <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              <Clock className="text-brand-400" size={15} />
              SaaS Level Recovery Registry Logs
            </h4>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-850 text-slate-400 text-[10px] font-bold uppercase tracking-wider bg-slate-900/20">
                    <th className="py-2.5 px-3">Log ID</th>
                    <th className="py-2.5 px-3">Encrypted Filename</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Size</th>
                    <th className="py-2.5 px-3">State Status</th>
                    <th className="py-2.5 px-3">Key hash</th>
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
                      <td className="py-2.5 px-3 text-slate-350 font-mono">{log.size}</td>
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
      )}

      {/* ── 2. CENTRALIZED LOGGING & ERROR AUDITING CONSOLE ── */}
      {activeTab === 'logging' && (
        <div className="space-y-6 animate-fade-in">
          {/* Header */}
          <GlassCard className="border border-brand-500/10">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/10 border border-brand-500/20">
                <Terminal className="text-brand-400" size={20} />
              </div>
              <div>
                <h3 className="font-bold text-slate-100 text-sm">Centralized Logging & Error Auditing Console</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">Real-time Sentry & LogRocket simulated instrumentation tracking errors, WebSocket statuses, and database events.</p>
              </div>
            </div>
          </GlassCard>

          {/* Stats metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-red-950/15 border border-red-500/25 rounded-2xl">
              <span className="text-[9px] font-bold tracking-widest uppercase text-red-400">CRITICAL THREATS</span>
              <p className="text-2xl font-black text-red-200 mt-1 font-mono">{crashLogs.filter(c => c.severity === 'CRITICAL' && !c.resolved).length}</p>
            </div>
            <div className="p-4 bg-orange-950/15 border border-orange-500/25 rounded-2xl">
              <span className="text-[9px] font-bold tracking-widest uppercase text-orange-400">HIGH SEVERITY</span>
              <p className="text-2xl font-black text-orange-200 mt-1 font-mono">{crashLogs.filter(c => c.severity === 'HIGH' && !c.resolved).length}</p>
            </div>
            <div className="p-4 bg-amber-950/15 border border-amber-500/25 rounded-2xl">
              <span className="text-[9px] font-bold tracking-widest uppercase text-amber-400">MEDIUM RISKS</span>
              <p className="text-2xl font-black text-amber-200 mt-1 font-mono">{crashLogs.filter(c => c.severity === 'MEDIUM' && !c.resolved).length}</p>
            </div>
            <div className="p-4 bg-slate-900/40 border border-slate-850 rounded-2xl">
              <span className="text-[9px] font-bold tracking-widest uppercase text-slate-400">RESOLVED CACHES</span>
              <p className="text-2xl font-black text-slate-350 mt-1 font-mono">{crashLogs.filter(c => c.resolved).length}</p>
            </div>
          </div>

          {/* Crash logs registry list */}
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-850 pb-2.5">
              <h4 className="font-bold text-slate-200 text-sm flex items-center gap-2">
                <AlertTriangle className="text-red-400" size={15} />
                Sentry Active Crash instrumentation registry
              </h4>
              <button 
                onClick={() => {
                  alert('Session logs flushed and Sentry queue cleared successfully!');
                }}
                className="px-2.5 py-1 rounded bg-slate-905 border border-slate-850 text-slate-400 hover:text-slate-105 hover:bg-slate-900 text-[10px] font-bold transition-all"
              >
                Flush active logs
              </button>
            </div>

            <div className="space-y-3.5">
              {crashLogs.map((c) => (
                <div key={c.id} className={`p-4 border rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all ${
                  c.resolved 
                    ? 'bg-slate-900/10 border-slate-850 text-slate-500' 
                    : c.severity === 'CRITICAL' 
                      ? 'bg-red-950/10 border-red-500/20 text-slate-300' 
                      : c.severity === 'HIGH' 
                        ? 'bg-orange-950/10 border-orange-500/20 text-slate-300' 
                        : 'bg-amber-950/5 border-amber-500/10 text-slate-300'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-black ${
                      c.resolved 
                        ? 'bg-slate-900 text-slate-650' 
                        : c.severity === 'CRITICAL' ? 'bg-red-500/15 text-red-400' : 'bg-orange-500/15 text-orange-400'
                    }`}>
                      {c.type}
                    </span>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-bold font-mono text-xs ${c.resolved ? 'text-slate-600 line-through' : 'text-slate-200'}`}>{c.code}</span>
                        <span className="text-[9px] text-slate-500 font-mono">({c.occurrences} occurrences)</span>
                      </div>
                      <p className={`text-[11px] mt-1 ${c.resolved ? 'text-slate-600' : 'text-slate-400'}`}>{c.msg}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {c.resolved ? (
                      <span className="text-[10px] text-green-400 font-bold uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 size={12} /> Resolved
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleResolveCrash(c.id)}
                        className="px-3 py-1 bg-brand-600/10 border border-brand-500/20 hover:border-brand-500/50 hover:bg-brand-650/15 text-brand-400 hover:text-brand-305 text-[10px] font-bold rounded-xl transition-all"
                      >
                        Resolve issue
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {/* Edit Subscription Modal Overlay */}
      {showEditSubscriptionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
          <GlassCard className="w-full max-w-sm space-y-4">
            <div className="border-b border-slate-850 pb-2 flex items-center justify-between">
              <h4 className="font-bold text-slate-100 text-sm flex items-center gap-1.5">
                <Layers className="text-brand-500" size={15} />
                Edit Subscription Plan
              </h4>
              <button onClick={() => setShowEditSubscriptionModal(false)} className="text-xs text-slate-400 hover:text-slate-200">Close</button>
            </div>

            <form onSubmit={handleEditSubscriptionSubmit} className="space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Institution Name</span>
                <p className="text-xs font-semibold text-slate-200">{editSubscriptionSchoolName}</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Select Subscription Plan</label>
                <select 
                  value={editSubscriptionPlan}
                  onChange={(e) => setEditSubscriptionPlan(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 focus:outline-none focus:border-brand-500"
                >
                  <option value="freemium">Freemium - Evaluation Plan</option>
                  <option value="basic">Basic - Growing Cluster</option>
                  <option value="pro">Pro - Advanced Integration</option>
                  <option value="enterprise">Enterprise - Dedicated Capacity</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-850">
                <button type="button" onClick={() => setShowEditSubscriptionModal(false)} className="glass-btn-secondary text-xs">Cancel</button>
                <button type="submit" className="glass-btn-primary text-xs">Update Plan</button>
              </div>
            </form>
          </GlassCard>
        </div>
      )}
    </div>

  );
};
