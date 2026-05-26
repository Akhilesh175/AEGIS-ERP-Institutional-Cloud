import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { mockApi } from '../services/mockApi';
import { AuditLog, School, User } from '../types';
import { mockDb } from '../services/mockDb';
import { GlassCard } from '../components/GlassCard';
import { 
  Activity, Building, Settings, ShieldAlert, Cpu, 
  Layers, Key, PlusCircle, Search, RefreshCw 
} from 'lucide-react';

export const SuperAdminPortal: React.FC<{ activeTab: string }> = ({ activeTab }) => {
  const { session } = useStore();
  const superAdminId = session?.user.id;

  // States
  const [stats, setStats] = useState<any | null>(null);
  const [auditLogs, setAuditLogs] = useState<(AuditLog & { userName: string; userEmail: string })[]>([]);
  const [searchAuditQuery, setSearchAuditQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Forms
  const [showAddSchool, setShowAddSchool] = useState(false);
  const [schName, setSchName] = useState('');
  const [schAddr, setSchAddr] = useState('');
  const [schPhone, setSchPhone] = useState('');
  const [schPlan, setSchPlan] = useState('enterprise');

  // Admin Creation Forms
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [admEmail, setAdmEmail] = useState('');
  const [admFirst, setAdmFirst] = useState('');
  const [admLast, setAdmLast] = useState('');
  const [admPhone, setAdmPhone] = useState('');
  const [admSchoolId, setAdmSchoolId] = useState('');

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
    if (stats?.schoolsList?.length > 0 && !admSchoolId) {
      setAdmSchoolId(stats.schoolsList[0].id);
    }
  }, [stats, showAddAdmin]);

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

  useEffect(() => {
    if (activeTab === 'audits' && superAdminId) {
      mockApi.superAdminGetAuditLogs(superAdminId, searchAuditQuery).then(logs => {
        setAuditLogs(logs);
      });
    }
  }, [searchAuditQuery, activeTab]);

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!superAdminId || !schName.trim()) return;

    try {
      await mockApi.superAdminCreateSchool(superAdminId, schName, schAddr, schPhone, schPlan);
      setShowAddSchool(false);
      setSchName('');
      setSchAddr('');
      setSchPhone('');
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

    try {
      setLoading(true);
      await mockApi.superAdminCreateAdmin(
        superAdminId,
        admEmail,
        admFirst,
        admLast,
        admSchoolId,
        admPhone
      );
      setShowAddAdmin(false);
      setAdmEmail('');
      setAdmFirst('');
      setAdmLast('');
      setAdmPhone('');
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

              <div className="p-3 bg-brand-500/5 border border-brand-500/10 rounded-xl">
                <p className="text-[10px] text-brand-400 font-mono leading-relaxed">
                  🔒 The password for this administrative session defaults to <span className="font-bold underline">password</span>. Users can authenticate immediately after registration.
                </p>
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
