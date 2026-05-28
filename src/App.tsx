import React, { useState, useEffect } from 'react';
import { useStore } from './store/useStore';
import { mockApi } from './services/mockApi';
import { supabase } from './lib/supabase';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { StudentPortal } from './portals/StudentPortal';
import { ParentPortal } from './portals/ParentPortal';
import { TeacherPortal } from './portals/TeacherPortal';
import { AdminPortal } from './portals/AdminPortal';
import { SuperAdminPortal } from './portals/SuperAdminPortal';
import { Shield, Lock, Mail, Sun, Moon, Sparkles, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { GlassCard } from './components/GlassCard';

export const App: React.FC = () => {
  const { session, theme, toggleTheme, setSession, initializeStore } = useStore();
  
  // Auth Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password'); // mock default
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab State
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    initializeStore();
  }, []);

  // Sync default tab when session changes
  useEffect(() => {
    setActiveTab('dashboard');
  }, [session]);

  // Session validation guard: if the user account was deleted from the database,
  // log them out instantly to prevent broken state and unauthenticated RLS empty screens.
  useEffect(() => {
    const validateSession = async () => {
      const SUPER_ADMIN_EMAIL = 'jy7018080@gmail.com';
      if (session?.user?.id && session.user.email !== SUPER_ADMIN_EMAIL) {
        const { data: userExists, error } = await supabase
          .from('users')
          .select('id')
          .eq('id', session.user.id)
          .maybeSingle();

        // If user is completely deleted from the public.users database table,
        // we must clear the session.
        if (!userExists || error) {
          console.warn('Session user does not exist in database. Clearing stale session...');
          setSession(null);
          localStorage.removeItem('aegis_session');
        }
      }
    };
    validateSession();
  }, [session, setSession]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    try {
      setLoading(true);
      setError(null);
      const sess = await mockApi.login(email, password);
      setSession(sess);
      setLoading(false);
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
      setLoading(false);
    }
  };

  const handlePreFill = (roleEmail: string) => {
    setEmail(roleEmail);
    setPassword('password');
  };

  if (!session) {
    return (
      <div className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
        {/* Background Gradients Orbs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-brand-600/10 blur-[120px]" />

        {/* Brand Header */}
        <div className="text-center mb-8 space-y-2 animate-fade-in relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-2xl shadow-brand-500/35 mx-auto border border-white/10">
            <Shield className="text-white" size={30} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-100 font-sans mt-3">
            AEGIS <span className="text-brand-500 text-glow-brand font-medium">ERP</span>
          </h1>
          <p className="text-xs text-slate-400 font-semibold tracking-widest font-mono uppercase">Institutional Security Center</p>
        </div>

        {/* Login Panel Container */}
        <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
          
          {/* Form Card */}
          <GlassCard className="flex flex-col justify-between p-8 border-white/5 shadow-brand-500/5">
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-100 font-sans">Secure Authorization</h2>
                <p className="text-xs text-slate-400 mt-1">Authenticate into your multi-tenant portal console.</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="font-semibold">{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Mail size={12} /> Email Account
                  </label>
                  <input 
                    type="email"
                    placeholder="name@aegis.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Lock size={12} /> Encryption Key
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-xl pl-4 pr-10 py-2.5 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all duration-200"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      title={showPassword ? "Hide Password" : "Show Password"}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white font-semibold text-xs py-3 rounded-xl transition-all shadow-lg hover:shadow-brand-500/20 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] mt-2 flex items-center justify-center gap-1.5"
                >
                  {loading ? 'Authenticating...' : (
                    <>
                      <span>Secure Login</span>
                      <ChevronRight size={14} />
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Footer switcher */}
            <div className="flex items-center justify-between border-t border-slate-850 pt-4 mt-6">
              <span className="text-[10px] text-slate-500 font-mono">TLS 1.3 SECURE SHELL</span>
              <button 
                onClick={toggleTheme}
                className="p-1.5 text-slate-400 hover:text-slate-200 transition-colors"
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </button>
            </div>
          </GlassCard>

          {/* Credentials Guide Card */}
          <GlassCard className="flex flex-col justify-between p-8 border-white/5">
            <div className="space-y-4">
              <div className="flex items-center gap-1.5 text-brand-400">
                <Sparkles size={16} />
                <h3 className="font-bold text-slate-200 text-sm leading-none">Console Operator Guide</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Evaluating the five role-based portals is simplified. Click any role below to pre-fill active seed credentials:
              </p>

              <div className="space-y-2">
                {[
                  { label: 'Super Admin', email: 'superadmin@aegis.com', desc: 'Manage all institutions, system audits, & SaaS stats.' },
                  { label: 'School Admin', email: 'admin@aegis.com', desc: 'Full registry maps, timetables, CRUDs, & gateway login.' },
                  { label: 'Faculty Teacher', email: 'teacher1@aegis.com', desc: 'Taught courses, grade rolls, mark attendance registers.' },
                  { label: 'Parent Guardian', email: 'parent1@aegis.com', desc: 'Secure read-only child monitor (Leo & Albert accounts).' },
                  { label: 'Active Student', email: 'student1@aegis.com', desc: 'Take online quizzes, download materials, stream lectures.' }
                ].map((roleItem, idx) => (
                  <div 
                    key={idx}
                    onClick={() => handlePreFill(roleItem.email)}
                    className="p-2.5 bg-slate-900/30 border border-slate-850 hover:border-brand-500/20 rounded-xl cursor-pointer hover:bg-slate-900/50 transition-all flex justify-between items-center group active:scale-[0.99]"
                  >
                    <div>
                      <h4 className="font-bold text-xs text-slate-200 group-hover:text-brand-400 transition-colors">{roleItem.label}</h4>
                      <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5 leading-normal">{roleItem.desc}</p>
                    </div>
                    <span className="text-[9px] text-slate-500 font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">Pre-fill</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[9px] text-slate-500 text-center leading-normal mt-4">
              All credentials are secure and loaded from institutional localStorage sandbox seeds.
            </p>
          </GlassCard>

        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a13] flex flex-col transition-colors duration-300">
      {/* Navbar Header */}
      <Navbar />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Sidebar Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Dashboard Content */}
        <main className="flex-1 overflow-y-auto px-6 py-6 md:px-8">
          
          {/* Active Portal Mount */}
          {session.user.role === 'STUDENT' && <StudentPortal activeTab={activeTab} />}
          {session.user.role === 'PARENT' && <ParentPortal activeTab={activeTab} />}
          {session.user.role === 'TEACHER' && <TeacherPortal activeTab={activeTab} setActiveTab={setActiveTab} />}
          {session.user.role === 'ADMIN' && <AdminPortal activeTab={activeTab} />}
          {session.user.role === 'SUPER_ADMIN' && <SuperAdminPortal activeTab={activeTab} />}

        </main>
      </div>
    </div>
  );
};
