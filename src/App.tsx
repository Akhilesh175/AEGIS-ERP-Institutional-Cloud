import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { SportsManagement } from './components/SportsManagement';
import { AegisMeet } from './components/AegisMeet';
import { Shield, Lock, Mail, Sun, Moon, Sparkles, ChevronRight, Eye, EyeOff, Building2, GraduationCap, Users, BookOpen, Home, Key, UserCheck, Phone, MessageSquare, Instagram, CheckCircle2, ShieldAlert, Database, Network, Layers, FileText, CheckSquare, HelpCircle, Globe, Laptop, ArrowRight, ShieldCheck, Bell } from 'lucide-react';
import { BrandLogo } from './components/common/BrandLogo';
import { GlassCard } from './components/GlassCard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useInactivityTimeout } from './hooks/useInactivityTimeout';
import { InactivityWarningModal } from './components/InactivityWarningModal';
import PremiumLock from './components/PremiumLock';
import { AdminPortalHeader } from './components/AdminPortalHeader';
import { isTabLockedByEntitlements } from './services/subscriptionConfig';
import { useFeatureEntitlements } from './hooks/useFeatureEntitlements';
import { SubscriptionDashboard } from './components/SubscriptionDashboard';
import { useSubscriptionLifecycle } from './hooks/useSubscriptionLifecycle';
import { WARNING_BANNER_CONFIG } from './services/subscriptionService';

const getTabsForRole = (role: string, planName: string): string[] => {
  if (planName === 'expired') {
    if (role === 'ADMIN') {
      return ['dashboard', 'subscriptions', 'support'];
    }
    return ['dashboard', 'support'];
  }

  switch (role) {
    case 'STUDENT':
      return ['dashboard', 'timetable', 'ptm', 'grades', 'materials', 'quizzes', 'library', 'sports', 'transit', 'forums', 'fees', 'hostel', 'support', 'groupdiscussion'];
    case 'PARENT':
      return ['dashboard', 'notifications', 'ptm', 'homework', 'timetable', 'grades', 'fees', 'materials', 'quizzes', 'library', 'sports', 'transit', 'forums', 'hostel', 'support'];
    case 'TEACHER':
    case 'DRIVER':
      return ['dashboard', 'timetable', 'ptm', 'classroster', 'attendance', 'grades', 'marksheets', 'assignments', 'quizzes', 'materials', 'forums', 'sports', 'analytics', 'paymentsettings', 'support', 'groupdiscussion'];
    case 'SUPER_ADMIN':
      return [
        'dashboard', 'tenants', 'users', 'communications', 'audits', 'backups', 'logging', 'sports', 'ptm', 'support',
        'saas-billing',
        // Subscription Management sub-tabs
        'sub-dashboard', 'sub-plans', 'sub-pricing', 'sub-coupons',
        'sub-purchases', 'sub-timeline', 'sub-invoices', 'sub-audits', 'sub-reports'
      ];
    case 'ADMIN':
      return [
        'dashboard', 'impersonation', 'dangerzone', 'subscriptions',
        'students', 'teachers', 'parents', 'classes', 'subjects', 'academicsessions', 
        'fees', 'communications', 'analytics', 'rbac', 'backups', 'books', 'transport',
        'marksheets', 'quizzes', 'attendance', 'assignments', 'hostel', 'support', 'groupdiscussion', 'sports', 'ptm'
      ];
    case 'FINANCE_ADMIN':
      return [
        'dashboard', 'students', 'teachers', 'parents', 'classes', 'subjects', 'academicsessions', 
        'fees', 'communications', 'analytics', 'rbac', 'backups', 'books', 'transport',
        'marksheets', 'quizzes', 'attendance', 'assignments', 'hostel', 'support', 'sports', 'ptm'
      ];
    case 'SPORTS_ADMIN':
      return ['dashboard', 'sports', 'paymentsettings', 'ptm', 'support'];
    case 'COACH':
      return ['dashboard', 'sports', 'paymentsettings', 'support'];
    default: { // Sub-admin roles (Librarian, Warden, Academic Admin, Exam Controller, etc.)
      const tabs = [
        'dashboard', 'students', 'teachers', 'parents', 'classes', 'subjects', 'academicsessions', 
        'communications', 'rbac', 'backups', 'books', 'transport', 'marksheets', 'quizzes', 
        'attendance', 'assignments', 'hostel', 'support', 'paymentsettings', 'sports', 'ptm'
      ];
      if (role === 'ACADEMIC_ADMIN') {
        tabs.push('groupdiscussion');
      }
      return tabs;
    }
  }
};

import { MarksheetVerificationPage } from './components/MarksheetVerificationPage';
import { HelpSupportPage } from './components/HelpSupportPage';
import { SaaSAuthFlow } from './components/SaaSAuthFlow';

const RoleSelectorOverlay: React.FC<{
  session: any;
  setSession: (session: any) => void;
  theme: string;
  toggleTheme: () => void;
}> = ({ session, setSession, theme, toggleTheme }) => {
  const { switchActiveRole } = useStore();
  const [selectedRole, setSelectedRole] = useState(session.user.role || session.user.roles?.[0] || 'TEACHER');
  const [loading, setLoading] = useState(false);
  const [schoolName, setSchoolName] = useState('Aegis Academy');

  useEffect(() => {
    if (session.user.schoolId) {
      import('./services/mockDb').then(({ mockDb }) => {
        const sch = mockDb.schools.find(s => s.id === session.user.schoolId);
        if (sch) setSchoolName(sch.name);
      });
    }
  }, [session.user.schoolId]);

  const handleContinue = async () => {
    try {
      setLoading(true);
      await switchActiveRole(selectedRole);
      const updatedUser = {
        ...session.user,
        role: selectedRole,
        activeRoleSelected: true
      };
      const updatedSession = { ...session, user: updatedUser };
      setSession(updatedSession);
      localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
    } catch (err) {
      console.error(err);
      alert('Failed to select role. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getRoleLabel = (r: string) => {
    if (r === 'ADMIN') return 'School Admin';
    if (r === 'CLASS_TEACHER') return 'Class Teacher';
    if (r === 'SPORTS_ADMIN') return 'Sports Admin';
    return r.charAt(0) + r.slice(1).toLowerCase().replace('_', ' ');
  };

  const getRolePermissions = (r: string) => {
    switch (r) {
      case 'SUPER_ADMIN': return 'Global Auditing, SaaS Tenants, Platform Management';
      case 'ADMIN': return 'Full School Registry, Directories, RBAC, Backups';
      case 'TEACHER': return 'Class Roster, Attendance Roll, Gradebook, Homework';
      case 'CLASS_TEACHER': return 'Homeroom Assignment, Report Cards, Parent Comms';
      case 'COACH': return 'Biometric Check-in, Athletes, Team Training';
      case 'SPORTS_ADMIN': return 'Manage Coaches & Teams, Training, Equipment Expenses';
      case 'FINANCE_ADMIN': return 'Payroll, Salary Processing, Invoices, Budget Allocations';
      case 'ACADEMIC_ADMIN': return 'Classes, Subjects, Timetable Scheduling, Roster';
      default: return 'Modular Portal View Permissions';
    }
  };

  const lastLoginFormatted = session.user.lastLoginAt 
    ? new Date(session.user.lastLoginAt).toLocaleString() 
    : new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-[#070a13] flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans text-slate-200">
      <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full bg-brand-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] rounded-full bg-brand-600/10 blur-[130px] pointer-events-none" />

      <GlassCard className="max-w-xl w-full p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-80" />
        
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-xl font-extrabold text-white tracking-wide">Select Portal Context</h2>
            <p className="text-xs text-slate-400 mt-1">Choose the active role to load your workspace dashboard.</p>
          </div>

          <div className="space-y-3">
            {session.user.roles?.map((roleItem: string) => {
              const isSelected = selectedRole === roleItem;
              return (
                <div
                  key={roleItem}
                  onClick={() => setSelectedRole(roleItem)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all duration-200 flex items-center justify-between gap-4 ${
                    isSelected 
                      ? 'bg-brand-600/10 border-brand-500/50 shadow-md shadow-brand-500/5' 
                      : 'bg-slate-900/40 border-slate-850 hover:bg-[#0a0e1a] hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 font-sans">
                    <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                      isSelected ? 'border-brand-400' : 'border-slate-650'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-brand-400" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-xs text-slate-200">{getRoleLabel(roleItem)}</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">{getRolePermissions(roleItem)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pt-4 border-t border-slate-850/60 text-[10px] text-slate-400 space-y-1.5 font-mono">
            <div className="flex justify-between">
              <span>School:</span>
              <span className="text-slate-200 font-semibold">{schoolName}</span>
            </div>
            <div className="flex justify-between">
              <span>Security Access:</span>
              <span className="text-brand-400">{getRolePermissions(selectedRole).split(',')[0]}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Login:</span>
              <span className="text-slate-350">{lastLoginFormatted}</span>
            </div>
          </div>

          <button
            onClick={handleContinue}
            disabled={loading}
            className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] flex items-center justify-center gap-2 border border-brand-400/20"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Initializing Workspace Context...
              </span>
            ) : (
              <>
                <span>Continue to Dashboard</span>
                <ChevronRight size={14} />
              </>
            )}
          </button>
        </div>
      </GlassCard>
    </div>
  );
};

export const App: React.FC = () => {
  const { session, theme, toggleTheme, setSession, initializeStore, isInitialized } = useStore();

  // ─── Inactivity Session Timeout ──────────────────────────────────────────────
  // showInactivityWarning: controls the countdown modal
  // inactivityRemaining: ms passed to the modal so it can render the right count
  const [showInactivityWarning, setShowInactivityWarning] = useState(false);
  const [inactivityRemaining, setInactivityRemaining] = useState(60_000);
  // isLoggingOutRef prevents double-invocation on rapid expiry calls
  const isLoggingOutRef = useRef(false);
  // Ref bridge so callbacks defined before the hook call can still invoke
  // setWarningModalOpen / resetAfterStay without TypeScript TDZ errors.
  const inactivityApiRef = useRef<{ setWarningModalOpen: (v: boolean) => void; resetAfterStay: () => void } | null>(null);

  /**
   * performSessionExpiry
   * Full production logout sequence:
   *   1. Guard against re-entry
   *   2. Close warning modal
   *   3. Call mockApi.logout() → clears LS/SS, Supabase signOut
   *   4. Clear Zustand session
   *   5. Hard reload so all in-memory React state is wiped
   *
   * NOTE: We call mockApi.logout() here rather than duplicating its
   *       localStorage loop, so the session-cleanup logic stays in one place.
   */
  const performSessionExpiry = useCallback(async (reason: 'inactivity' | 'manual' = 'inactivity') => {
    if (isLoggingOutRef.current) return;
    isLoggingOutRef.current = true;
    setShowInactivityWarning(false);

    // Store the expiry reason so the login page can show a banner
    try {
      sessionStorage.setItem('aegis_session_expired', reason === 'inactivity' ? 'inactivity' : 'manual');
    } catch (_) {}

    try {
      await mockApi.logout();
    } catch (err) {
      console.error('[Inactivity] logout error:', err);
    }

    setSession(null);
    // Hard reload clears all in-memory state (WebRTC, subscriptions, etc.)
    window.location.href = window.location.origin + window.location.pathname;
  }, [setSession]);

  const handleInactivityWarn = useCallback((remainingMs: number) => {
    setInactivityRemaining(remainingMs);
    setShowInactivityWarning(true);
    // Engage the security gate — all background activity is now suppressed
    // until the user makes an explicit choice (Stay / Sign Out).
    inactivityApiRef.current?.setWarningModalOpen(true);
  }, []);

  const handleInactivityResume = useCallback(() => {
    setShowInactivityWarning(false);
    inactivityApiRef.current?.setWarningModalOpen(false);
  }, []);

  const handleInactivityExpire = useCallback(() => {
    performSessionExpiry('inactivity');
  }, [performSessionExpiry]);

  const inactivityApi = useInactivityTimeout({
    timeoutMs: 5 * 60 * 1000,   // 5 minutes total idle
    warningMs: 60 * 1000,       // warn 60 s before expiry (at 4-min mark)
    isActive: !!session,         // only track when a session is live
    onWarn: handleInactivityWarn,
    onResume: handleInactivityResume,
    onExpire: handleInactivityExpire,
  });
  // Synchronously update the ref so callbacks can always access the latest API
  inactivityApiRef.current = inactivityApi;
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Subscription lifecycle: runs on session load, re-checks every 5 min ──
  const subscriptionLifecycle = useSubscriptionLifecycle();

  // ── DB-driven feature entitlements (replaces hardcoded plan string checks) ──
  const ent = useFeatureEntitlements();

  // Auth Form states
  const [email, setEmail] = useState('');
  const [showPushPrompt, setShowPushPrompt] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      const checkPermissionAndRegister = async () => {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          if (Notification.permission === 'granted') {
            try {
              const { requestNotificationPermission } = await import('./lib/firebase');
              await requestNotificationPermission(session.user.id, session.user.role);
            } catch (err) {
              console.error('Failed to auto register FCM token:', err);
            }
          } else if (Notification.permission === 'default') {
            const hasPrompted = localStorage.getItem(`aegis_push_prompted_${session.user.id}`);
            if (!hasPrompted) {
              setTimeout(() => {
                setShowPushPrompt(true);
              }, 4000);
            }
          }
        }
      };
      checkPermissionAndRegister();
    }
  }, [session]);

  const handleEnablePush = async () => {
    setShowPushPrompt(false);
    if (session) {
      localStorage.setItem(`aegis_push_prompted_${session.user.id}`, 'true');
      try {
        const { requestNotificationPermission } = await import('./lib/firebase');
        const token = await requestNotificationPermission(session.user.id, session.user.role);
        if (token) {
          alert('Push notifications enabled successfully!');
        } else {
          alert('Failed to configure Push notifications. Please verify browser notification settings.');
        }
      } catch (err) {
        console.error('Failed to enable push notifications:', err);
      }
    }
  };

  const handleLaterPush = () => {
    setShowPushPrompt(false);
    if (session) {
      localStorage.setItem(`aegis_push_prompted_${session.user.id}`, 'true');
    }
  };
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password / OTP Flow States
  const [currentHash, setCurrentHash] = useState(() => window.location.hash);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);

  const [otpCode, setOtpCode] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  // Reads the inactivity-expiry flag written by performSessionExpiry()
  // Cleared immediately after reading so it never shows twice.
  const [sessionExpiredReason, setSessionExpiredReason] = useState<'inactivity' | 'manual' | null>(() => {
    try {
      const v = sessionStorage.getItem('aegis_session_expired') as 'inactivity' | 'manual' | null;
      if (v) sessionStorage.removeItem('aegis_session_expired');
      return v;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const handleHash = () => {
      setCurrentHash(window.location.hash);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const getParamsFromHash = (hashStr: string) => {
    const parts = hashStr.split('?');
    if (parts.length < 2) return {};
    return Object.fromEntries(new URLSearchParams(parts[1]).entries());
  };

  // Tab State
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.substring(1);
    return hash || 'dashboard';
  });

  const prevUserIdRef = React.useRef<string | undefined>(undefined);

  const updateActiveTab = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Sync active tab to hash on change (safeguard)
  useEffect(() => {
    if (activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Synchronize browser history (back/forward) with the active tab state
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.substring(1);
      if (hash) {
        // Validate route for the current user's role
        if (session) {
          const allowed = getTabsForRole(session.user.role, session.schoolSubscriptionPlan || 'freemium');
          const baseTab = hash.split('/')[0];
          if (allowed.includes(baseTab)) {
            setActiveTab(hash);
            return;
          }
        } else {
          setActiveTab('dashboard');
          return;
        }
      }
      setActiveTab('dashboard');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [session]);

  // Listen for programmatic tab navigation events (e.g. from warning banners)
  useEffect(() => {
    const handleSetTab = (e: Event) => {
      const tab = (e as CustomEvent<string>).detail;
      if (tab) updateActiveTab(tab);
    };
    window.addEventListener('aegis:set-tab', handleSetTab);
    return () => window.removeEventListener('aegis:set-tab', handleSetTab);
  }, []);

  useEffect(() => {
    initializeStore();
  }, []);

  // Sync default tab ONLY when session user ID actually changes (log in/out)
  useEffect(() => {
    const currentUserId = session?.user?.id;
    if (currentUserId !== prevUserIdRef.current) {
      prevUserIdRef.current = currentUserId;
      setActiveTab('dashboard');
      window.location.hash = 'dashboard';
    }
  }, [session]);

  // Validate current activeTab against the session role
  useEffect(() => {
    if (!session) return;
    const role = session.user.role;
    const allowed = getTabsForRole(role, session.schoolSubscriptionPlan || 'freemium');
    const baseTab = activeTab.split('/')[0];
    if (activeTab !== 'dashboard' && !allowed.includes(baseTab)) {
      setActiveTab('dashboard');
      window.location.hash = 'dashboard';
    }
  }, [activeTab, session]);

  // Session validation guard: if the user account was deleted or deactivated,
  // log them out instantly to protect database records and enforce access gates.
  useEffect(() => {
    const validateSession = async () => {
      const SUPER_ADMIN_EMAIL = 'jy7018080@gmail.com';
      if (session?.user?.id && session.user.email !== SUPER_ADMIN_EMAIL) {
        const { data: userDb, error } = await supabase
          .from('users')
          .select('id, is_active')
          .eq('id', session.user.id)
          .maybeSingle();

        // If user is deleted or explicitly deactivated in Supabase, clear the session
        if (!userDb || error || userDb.is_active === false) {
          console.warn('Session user does not exist or is deactivated. Clearing stale session...');
          setSession(null);
          localStorage.removeItem('aegis_session');
          if (userDb && userDb.is_active === false) {
            alert('Your account has been deactivated. You have been automatically logged out.');
          }
        }
      }
    };
    validateSession();
  }, [session, setSession]);

  // Real-time status sync: listen for administrative deactivation or role events to instantly update the user session.
  useEffect(() => {
    if (!session?.user?.id) return;
    
    const channel = supabase
      .channel(`user-status-sync-${session.user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${session.user.id}`
        },
        (payload) => {
          const updatedUser = payload.new as any;
          if (updatedUser) {
            if (updatedUser.is_active === false) {
              console.log('Realtime administrative deactivation triggered! Enforcing instant session destruction.');
              setSession(null);
              localStorage.removeItem('aegis_session');
              alert('Your account has been deactivated by the administrator. You have been logged out.');
            } else if (updatedUser.role !== session.user.role) {
              console.log('Realtime administrative role update detected! Syncing session user role...', updatedUser.role);
              const updatedSession = {
                ...session,
                user: {
                  ...session.user,
                  role: updatedUser.role,
                  roleId: updatedUser.role_id || undefined
                }
              };
              setSession(updatedSession);
              localStorage.setItem('aegis_session', JSON.stringify(updatedSession));
              alert(`Your administrative role has been updated to [${updatedUser.role}]. The portal layout is refreshing.`);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;

    try {
      setForgotLoading(true);
      setForgotError(null);
      setForgotSuccess(null);

      const res = await fetch('/api/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to request verification code');
      }

      setForgotSuccess(data.message || 'Verification code sent successfully.');
      setForgotLoading(false);
      
      // Redirect to OTP verification screen after 1.5 seconds
      setTimeout(() => {
        window.location.hash = `verify-otp?email=${encodeURIComponent(forgotEmail)}`;
      }, 1500);
    } catch (err: any) {
      setForgotError(err.message || 'Error occurred while requesting OTP');
      setForgotLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent, emailParam: string) => {
    e.preventDefault();
    if (!otpCode.trim() || !emailParam) return;

    try {
      setOtpLoading(true);
      setOtpError(null);
      setOtpSuccess(null);

      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam, otpCode })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setOtpSuccess(data.message || 'OTP verified successfully.');
      setOtpLoading(false);

      // Redirect to reset password screen after 1.5 seconds
      setTimeout(() => {
        window.location.hash = `reset-password?email=${encodeURIComponent(emailParam)}&otpId=${data.otpId}`;
      }, 1500);
    } catch (err: any) {
      setOtpError(err.message || 'OTP verification failed');
      setOtpLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent, emailParam: string, otpIdParam: string) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword || !emailParam || !otpIdParam) return;

    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }

    try {
      setResetLoading(true);
      setResetError(null);
      setResetSuccess(null);

      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailParam, otpId: otpIdParam, newPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      setResetSuccess(data.message || 'Password reset successfully.');
      setResetLoading(false);

      // Redirect to login screen after 2 seconds
      setTimeout(() => {
        window.location.hash = '';
        // Reset state values
        setForgotEmail('');
        setOtpCode('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotSuccess(null);
        setOtpSuccess(null);
        setResetSuccess(null);
      }, 2000);
    } catch (err: any) {
      setResetError(err.message || 'Failed to update credentials');
      setResetLoading(false);
    }
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center text-slate-200">
        <div className="flex flex-col items-center space-y-4 animate-fade-in">
          <div className="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold tracking-widest text-slate-400 uppercase animate-pulse">Initializing Aegis ERP...</span>
        </div>
      </div>
    );
  }

  if (activeTab.startsWith('verify/marksheet/')) {
    const code = activeTab.replace('verify/marksheet/', '');
    return <MarksheetVerificationPage code={code} onBack={() => { window.location.hash = 'dashboard'; setActiveTab('dashboard'); }} />;
  }

  // Intercept meet page URLs: /meet/{meeting_id}
  if (window.location.pathname.startsWith('/meet/')) {
    const meetingId = window.location.pathname.substring(6);
    return (
      <AegisMeet 
        meetingId={meetingId} 
        onLeave={() => {
          window.location.href = '/';
        }} 
      />
    );
  }

  if (!session) {
    const hash = currentHash.substring(1);
    const isRegisterFlow = hash.startsWith('register') || hash.startsWith('verify-registration') || hash.startsWith('plans');
    if (isRegisterFlow) {
      return (
        <SaaSAuthFlow 
          onBackToLogin={() => { window.location.hash = ''; setCurrentHash(''); }} 
          theme={theme} 
          toggleTheme={toggleTheme} 
        />
      );
    }
    return (
      <div className="min-h-screen bg-[#070a13] flex flex-col justify-between p-4 md:p-8 relative overflow-hidden font-sans text-slate-200 selection:bg-brand-500/30 selection:text-brand-200">
        {/* Cyber Security Tech Background Graphics */}
        <div className="absolute top-[-20%] left-[-15%] w-[60%] h-[60%] rounded-full bg-brand-500/10 blur-[130px] pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-15%] w-[60%] h-[60%] rounded-full bg-brand-600/10 blur-[130px] pointer-events-none" />
        
        {/* Tech grid & concentric circular radar vectors */}
        <svg className="absolute inset-0 w-full h-full opacity-20 pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="cyber-grid" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="rgba(56, 176, 248, 0.07)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#cyber-grid)" />
          
          {/* Circular vector lines */}
          <circle cx="15%" cy="35%" r="180" fill="none" stroke="rgba(56, 176, 248, 0.08)" strokeWidth="1.5" strokeDasharray="6 6" />
          <circle cx="15%" cy="35%" r="120" fill="none" stroke="rgba(56, 176, 248, 0.04)" strokeWidth="1" />
          
          <circle cx="85%" cy="65%" r="300" fill="none" stroke="rgba(56, 176, 248, 0.05)" strokeWidth="2" />
          <circle cx="85%" cy="65%" r="220" fill="none" stroke="rgba(56, 176, 248, 0.07)" strokeWidth="1.5" strokeDasharray="12 8" />
          <circle cx="85%" cy="65%" r="150" fill="none" stroke="rgba(56, 176, 248, 0.03)" strokeWidth="1" />
          
          {/* Subtle diagonal grid line accents */}
          <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(56, 176, 248, 0.02)" strokeWidth="1" />
          <line x1="100%" y1="0" x2="0" y2="100%" stroke="rgba(56, 176, 248, 0.02)" strokeWidth="1" />
        </svg>

        {/* Top Header Branding — Official AEGIS ERP Logo */}
        <div className="w-full flex justify-between items-center max-w-6xl mx-auto mb-6 relative z-10 shrink-0">
          <div className="animate-fade-in">
            <BrandLogo variant="horizontal" size="md" showTagline={true} />
          </div>
          
          {/* Theme Switcher Toggle */}
          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 hover:border-brand-500/30 text-slate-400 hover:text-slate-200 transition-all duration-200 backdrop-blur-sm shadow-md"
            title="Toggle System Theme"
            type="button"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Central Work Grid */}
        <div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10 my-auto py-4">
          
          {/* Left Panel - Secure Authorization Form */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {(() => {
              const hash = currentHash.substring(1);
              const isForgot = hash === 'forgot';
              const isOtp = hash.startsWith('verify-otp');
              const isReset = hash.startsWith('reset-password');

              if (isForgot) {
                return (
                  <GlassCard className="flex flex-col p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-80" />
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-brand-500/10 text-brand-400">
                            <Lock size={15} />
                          </div>
                          <h2 className="text-lg font-bold text-slate-100 font-sans tracking-wide">Reset Password</h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Enter your registered email to request a secure 6-digit verification code.</p>
                      </div>

                      {forgotError && (
                        <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5">
                          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                          <div className="font-medium">{forgotError}</div>
                        </div>
                      )}

                      {forgotSuccess && (
                        <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-start gap-2.5">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                          <div className="font-medium">{forgotSuccess}</div>
                        </div>
                      )}

                      <form onSubmit={handleRequestOtp} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                            <Mail size={12} className="text-brand-400" /> Registered Email Address
                          </label>
                          <input 
                            type="email"
                            placeholder="name@institution.edu"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:shadow-[0_0_15px_rgba(14,160,235,0.15)] transition-all duration-200"
                            required
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={forgotLoading}
                          className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] mt-3 flex items-center justify-center gap-2 border border-brand-400/20"
                        >
                          {forgotLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Generating Verification Session...
                            </span>
                          ) : (
                            <>
                              <span>Request Verification Code</span>
                              <ArrowRight size={14} />
                            </>
                          )}
                        </button>
                      </form>

                      <div className="text-center pt-2">
                        <a 
                          href="#" 
                          className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                        >
                          Back to Secure Login
                        </a>
                      </div>
                    </div>
                  </GlassCard>
                );
              }

              if (isOtp) {
                const params = getParamsFromHash(currentHash);
                const emailParam = params.email || '';

                const triggerResend = async (e: any) => {
                  e.preventDefault();
                  try {
                    setOtpLoading(true);
                    setOtpError(null);
                    setOtpSuccess(null);
                    const res = await fetch('/api/request-otp', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ email: emailParam })
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || 'Failed to resend code');
                    setOtpSuccess('A new verification code has been delivered.');
                    setOtpLoading(false);
                  } catch (err: any) {
                    setOtpError(err.message || 'Resend request failed');
                    setOtpLoading(false);
                  }
                };

                return (
                  <GlassCard className="flex flex-col p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-80" />
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-brand-500/10 text-brand-400">
                            <CheckSquare size={15} />
                          </div>
                          <h2 className="text-lg font-bold text-slate-100 font-sans tracking-wide">Enter Verification Code</h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          A 6-digit OTP code has been delivered to <span className="text-brand-300 font-semibold">{emailParam}</span>.
                        </p>
                      </div>

                      {otpError && (
                        <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5">
                          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                          <div className="font-medium">{otpError}</div>
                        </div>
                      )}

                      {otpSuccess && (
                        <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-start gap-2.5">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                          <div className="font-medium">{otpSuccess}</div>
                        </div>
                      )}

                      <form onSubmit={(e) => handleVerifyOtp(e, emailParam)} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                            <Key size={12} className="text-brand-400" /> 6-Digit Verification Code
                          </label>
                          <input 
                            type="text"
                            placeholder="••••••"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                            className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-3 text-xs tracking-[8px] text-center font-bold font-mono focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:shadow-[0_0_15px_rgba(14,160,235,0.15)] transition-all duration-200"
                            required
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={otpLoading}
                          className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] mt-3 flex items-center justify-center gap-2 border border-brand-400/20"
                        >
                          {otpLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Verifying Signature...
                            </span>
                          ) : (
                            <>
                              <span>Verify Code</span>
                              <ArrowRight size={14} />
                            </>
                          )}
                        </button>
                      </form>

                      <div className="flex items-center justify-between text-xs pt-2">
                        <a 
                          href="#forgot" 
                          className="text-slate-400 hover:text-slate-200 font-semibold transition-colors"
                        >
                          Change Email
                        </a>
                        <a 
                          href="#"
                          onClick={triggerResend}
                          className="text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                        >
                          Resend Code
                        </a>
                      </div>
                    </div>
                  </GlassCard>
                );
              }

              if (isReset) {
                const params = getParamsFromHash(currentHash);
                const emailParam = params.email || '';
                const otpIdParam = params.otpId || '';

                return (
                  <GlassCard className="flex flex-col p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-80" />
                    
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-brand-500/10 text-brand-400">
                            <Lock size={15} />
                          </div>
                          <h2 className="text-lg font-bold text-slate-100 font-sans tracking-wide">Establish Credentials</h2>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">Set a secure new password for <span className="text-brand-300 font-semibold">{emailParam}</span>.</p>
                      </div>

                      {resetError && (
                        <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5">
                          <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                          <div className="font-medium">{resetError}</div>
                        </div>
                      )}

                      {resetSuccess && (
                        <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-start gap-2.5">
                          <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                          <div className="font-medium">{resetSuccess}</div>
                        </div>
                      )}

                      <form onSubmit={(e) => handleResetPassword(e, emailParam, otpIdParam)} className="space-y-4">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                            <Lock size={12} className="text-brand-400" /> New Password
                          </label>
                          <input 
                            type="password"
                            placeholder="••••••••••••"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:shadow-[0_0_15px_rgba(14,160,235,0.15)] transition-all duration-200"
                            required
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                            <Lock size={12} className="text-brand-400" /> Confirm New Password
                          </label>
                          <input 
                            type="password"
                            placeholder="••••••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:shadow-[0_0_15px_rgba(14,160,235,0.15)] transition-all duration-200"
                            required
                          />
                        </div>

                        <button 
                          type="submit"
                          disabled={resetLoading}
                          className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] mt-3 flex items-center justify-center gap-2 border border-brand-400/20"
                        >
                          {resetLoading ? (
                            <span className="flex items-center gap-2">
                              <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                              Updating Security Signatures...
                            </span>
                          ) : (
                            <>
                              <span>Save New Password</span>
                              <ArrowRight size={14} />
                            </>
                          )}
                        </button>
                      </form>

                      <div className="text-center pt-2">
                        <a 
                          href="#" 
                          className="text-xs text-brand-400 hover:text-brand-300 font-semibold transition-colors"
                        >
                          Cancel and Return
                        </a>
                      </div>
                    </div>
                  </GlassCard>
                );
              }

              // Default: Login Form Screen
              return (
                <GlassCard className="flex flex-col p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-80" />
                  
                  <div className="space-y-6">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="p-1 rounded bg-brand-500/10 text-brand-400">
                          <Lock size={15} />
                        </div>
                        <h2 className="text-lg font-bold text-slate-100 font-sans tracking-wide">Secure Authorization</h2>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">Authenticate credentials to access your multi-tenant portal.</p>
                    </div>

                    {/* Session auto-expiry banner — shows once after inactivity logout */}
                    {sessionExpiredReason === 'inactivity' && (
                      <div className="p-3.5 bg-amber-500/8 border border-amber-500/25 text-amber-300 text-xs rounded-xl flex items-start gap-2.5 animate-fade-in">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5 text-amber-400" />
                        <div>
                          <p className="font-bold text-amber-300 mb-0.5">Session Expired — Inactivity Timeout</p>
                          <p className="text-amber-400/80 leading-relaxed">
                            Your session was automatically terminated after 5 minutes of inactivity.
                            Please sign in again to continue.
                          </p>
                        </div>
                        <button
                          onClick={() => setSessionExpiredReason(null)}
                          className="ml-auto shrink-0 text-amber-500/60 hover:text-amber-300 transition-colors p-0.5"
                          aria-label="Dismiss"
                        >
                          ✕
                        </button>
                      </div>
                    )}

                    {error && (
                      <div className="p-3.5 bg-red-500/5 border border-red-500/20 text-red-400 text-xs rounded-xl flex items-start gap-2.5">
                        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
                        <div className="font-medium">{error}</div>
                      </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                          <Mail size={12} className="text-brand-400" /> Email Address
                        </label>
                        <input 
                          type="email"
                          placeholder="name@institution.edu"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:shadow-[0_0_15px_rgba(14,160,235,0.15)] transition-all duration-200"
                          required
                        />
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 font-mono">
                            <Key size={12} className="text-brand-400" /> Password / Encryption Key
                          </label>
                        </div>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-[#0a0e1a] border border-slate-805 text-slate-100 rounded-xl pl-4 pr-10 py-3 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 focus:shadow-[0_0_15px_rgba(14,160,235,0.15)] transition-all duration-200"
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                            title={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-1.5 text-xs">
                        <label className="flex items-center gap-2 text-slate-400 cursor-pointer group">
                          <input 
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="rounded bg-[#0a0e1a] border-slate-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 focus:ring-0 focus:outline-none w-4 h-4 cursor-pointer"
                          />
                          <span className="text-xs group-hover:text-slate-300 transition-colors font-medium">Remember this device</span>
                        </label>
                        
                        <a 
                          href="#forgot" 
                          className="text-xs text-brand-400 hover:text-brand-300 font-semibold hover:underline transition-colors"
                        >
                          Forgot Password?
                        </a>
                      </div>

                      <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-brand-600 via-brand-500 to-brand-600 hover:from-brand-500 hover:to-brand-400 text-white font-bold text-xs py-3 rounded-xl transition-all shadow-lg shadow-brand-500/10 hover:shadow-brand-500/25 disabled:opacity-40 disabled:pointer-events-none active:scale-[0.98] mt-3 flex items-center justify-center gap-2 border border-brand-400/20"
                      >
                        {loading ? (
                          <span className="flex items-center gap-2">
                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            Verifying Signatures...
                          </span>
                        ) : (
                          <>
                            <span>Secure Login</span>
                            <ArrowRight size={14} className="text-white group-hover:translate-x-0.5 transition-transform" />
                          </>
                        )}
                      </button>
                    </form>
                    <div className="text-center mt-4 pt-3 border-t border-slate-900">
                      <p className="text-xs text-slate-400">
                        Admin of a new school?{' '}
                        <a 
                          href="#register" 
                          className="text-brand-400 hover:text-brand-350 font-bold hover:underline transition-colors"
                        >
                          Register Your School
                        </a>
                      </p>
                    </div>
                  </div>
                </GlassCard>
              );
            })()}

            {/* Support Information Card */}
            <div className="p-6 bg-[#0b101d]/65 border border-slate-850 rounded-2xl flex flex-col gap-4 backdrop-blur-sm shadow-xl">
              <div className="flex items-center gap-2">
                <HelpCircle size={15} className="text-brand-400" />
                <h3 className="font-bold text-[10px] text-slate-350 uppercase tracking-widest font-mono">Need Help? Contact Support</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-2.5 text-xs">
                {/* Email Support */}
                <a href="mailto:aegis.erp.institutional.cloud@gmail.com" className="p-3 bg-slate-900/40 border border-slate-805 hover:border-brand-500/20 hover:bg-[#0a0e1a] rounded-xl transition-all flex items-start gap-3 group">
                  <Mail size={15} className="text-brand-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-[9px] uppercase text-slate-500 font-mono leading-none">Email Support</p>
                    <p className="text-[11px] text-slate-300 mt-1 truncate group-hover:text-brand-300 transition-colors">aegis.erp.institutional.cloud@gmail.com</p>
                  </div>
                </a>

                {/* WhatsApp Support */}
                <a href="https://wa.me/919336357874" target="_blank" rel="noreferrer" className="p-3 bg-slate-900/40 border border-slate-805 hover:border-green-500/20 hover:bg-[#0a0e1a] rounded-xl transition-all flex items-start gap-3 group">
                  <MessageSquare size={15} className="text-green-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-[9px] uppercase text-slate-500 font-mono leading-none">WhatsApp Support</p>
                    <p className="text-[11px] text-slate-300 mt-1 truncate group-hover:text-green-300 transition-colors">+91 93363 57874</p>
                  </div>
                </a>

                {/* Phone Support */}
                <div className="p-3 bg-slate-900/40 border border-slate-805 rounded-xl flex items-start gap-3">
                  <Phone size={15} className="text-brand-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 w-full">
                    <p className="font-bold text-[9px] uppercase text-slate-500 font-mono leading-none">Phone Support</p>
                    <div className="flex flex-col gap-1 mt-1 text-[11px] text-slate-300 font-mono">
                      <span>+91 93363 57874</span>
                      <span>+91 93054 26744</span>
                    </div>
                  </div>
                </div>

                {/* Instagram */}
                <a href="https://instagram.com/aegis.erp.institutional.cloud" target="_blank" rel="noreferrer" className="p-3 bg-slate-900/40 border border-slate-805 hover:border-pink-500/20 hover:bg-[#0a0e1a] rounded-xl transition-all flex items-start gap-3 group">
                  <Instagram size={15} className="text-pink-400 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="font-bold text-[9px] uppercase text-slate-500 font-mono leading-none">Instagram</p>
                    <p className="text-[11px] text-slate-300 mt-1 truncate group-hover:text-pink-300 transition-colors">@aegis.erp.institutional.cloud</p>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* Right Panel - Portal Access Guide */}
          <GlassCard className="lg:col-span-7 flex flex-col p-8 bg-[#0b101d]/75 border-slate-850 hover:border-slate-800/80 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-500 via-brand-300 to-brand-500 opacity-80" />
            
            <div className="space-y-6 flex-1 flex flex-col">
              <div>
                <div className="flex items-center gap-2">
                  <div className="p-1 rounded bg-brand-500/10 text-brand-400">
                    <Globe size={15} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-100 font-sans tracking-wide">Portal Access Guide</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">Review operational control scopes and authorized features per portal role.</p>
              </div>

              {/* Grid of Role Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 flex-1">
                {[
                  { label: 'Super Admin', icon: ShieldCheck, desc: 'System auditing, global metrics, and SaaS tenant management.' },
                  { label: 'School Admin', icon: Building2, desc: 'Timetables, class registries, staff directories, and gateway configuration.' },
                  { label: 'Sub Admin', icon: UserCheck, desc: 'Access assigned department portals (Library, Finance, transport routes, and custom RBAC modules).' },
                  { label: 'Teacher', icon: GraduationCap, desc: 'Class rosters, assignment grading, examinations, and attendance trackers.' },
                  { label: 'Parent', icon: Users, desc: 'Student performance tracking, fee invoices, transit maps, and leave consent.' },
                  { label: 'Student', icon: BookOpen, desc: 'Access course resources, take online quizzes, borrow books, and view check-ins.' },
                  { label: 'Hostel Admin', icon: Home, desc: 'Admissions registry, building structure setup, and billing control.' },
                  { label: 'Hostel Warden', icon: Key, desc: 'Leave workflow validation, dorm attendance logs, and visitor management.' }
                ].map((roleItem, idx) => {
                  const IconComp = roleItem.icon;
                  return (
                    <div 
                      key={idx}
                      className="p-4 bg-slate-900/40 border border-slate-850 rounded-xl flex items-center justify-between gap-3 group/card transition-all duration-300 hover:bg-[#0a0e1a] hover:border-brand-500/25 relative overflow-hidden"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-brand-400 group-hover/card:text-brand-300 transition-colors shrink-0">
                          <IconComp size={16} />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-slate-200 group-hover/card:text-brand-400 transition-colors leading-none">{roleItem.label}</h4>
                          <p className="text-[10px] text-slate-400 leading-normal mt-1.5 line-clamp-2">{roleItem.desc}</p>
                        </div>
                      </div>
                      <ChevronRight size={14} className="text-slate-600 group-hover/card:text-brand-400 group-hover/card:translate-x-0.5 transition-all shrink-0" />
                    </div>
                  );
                })}
              </div>
            </div>
          </GlassCard>

        </div>

        {/* Security Features Badges Section */}
        <div className="w-full max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 mb-6 relative z-10 shrink-0">
          {[
            { label: 'TLS 1.3 Encryption', icon: Lock, color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/10' },
            { label: 'Role-Based Access Control', icon: Shield, color: 'text-brand-400 bg-brand-500/5 border-brand-500/10' },
            { label: 'Multi-Tenant Architecture', icon: Network, color: 'text-pink-400 bg-pink-500/5 border-pink-500/10' },
            { label: 'Audit Logging Enabled', icon: FileText, color: 'text-amber-400 bg-amber-500/5 border-amber-500/10' },
            { label: 'Secure Session Management', icon: CheckSquare, color: 'text-cyan-400 bg-cyan-500/5 border-cyan-500/10' }
          ].map((badge, idx) => {
            const BadgeIcon = badge.icon;
            return (
              <div 
                key={idx}
                className={`py-2 px-3 border rounded-xl flex items-center justify-center gap-2 backdrop-blur-sm transition-all duration-300 hover:scale-[1.02] ${badge.color}`}
              >
                <BadgeIcon size={14} className="shrink-0" />
                <span className="text-[10px] font-bold uppercase tracking-wider font-mono">{badge.label}</span>
              </div>
            );
          })}
        </div>

        {/* System Footer */}
        <div className="w-full max-w-6xl mx-auto border-t border-slate-900 pt-5 mt-2 flex flex-col md:flex-row justify-between items-center gap-4 text-[10px] text-slate-500 font-mono relative z-10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400">Aegis ERP Institutional Cloud</span>
            <span className="text-slate-700">|</span>
            <span>Version 1.5.0</span>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-850 px-3 py-1 rounded-full backdrop-blur-sm">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-slate-400 font-semibold">All Services Operational</span>
          </div>

          <div className="flex items-center gap-1.5 text-slate-400">
            <Lock size={11} className="text-brand-400" />
            <span>Secure Connection Protected by TLS 1.3</span>
          </div>
        </div>

      </div>
    );
  }

  if (session && !session.user.activeRoleSelected) {
    return (
      <RoleSelectorOverlay 
        session={session} 
        setSession={setSession} 
        theme={theme} 
        toggleTheme={toggleTheme} 
      />
    );
  }

  console.log(`[App Routing] Active tab/route: ${activeTab}, Role: ${session?.user?.role}`);

  return (
    <div className="h-screen bg-[#070a13] flex flex-col overflow-hidden transition-colors duration-300">
      {/* Navbar Header */}
      <Navbar />

      {/* ── Global Subscription Warning Banner ─────────────────────── */}
      {session && subscriptionLifecycle.warningLevel && subscriptionLifecycle.warningLevel !== 'expired' && (() => {
        const wl = subscriptionLifecycle.warningLevel!;
        const cfg = WARNING_BANNER_CONFIG[wl];
        return (
          <div className={`flex items-center justify-between gap-3 px-6 py-2.5 border-b ${cfg.bg} ${cfg.border} shrink-0`}>
            <div className="flex items-center gap-2">
              <span className="text-sm leading-none">{cfg.icon}</span>
              <p className={`text-xs font-medium ${cfg.text}`}>
                {cfg.message(subscriptionLifecycle.daysRemaining)}
              </p>
            </div>
            {session.user.role === 'ADMIN' && (
              <button
                onClick={() => {
                  // Navigate to subscriptions tab
                  const evt = new CustomEvent('aegis:set-tab', { detail: 'subscriptions' });
                  window.dispatchEvent(evt);
                }}
                className="shrink-0 text-[10px] font-bold text-white bg-red-500 hover:bg-red-400 px-3 py-1.5 rounded-lg transition-all"
              >
                Renew Now
              </button>
            )}
          </div>
        );
      })()}

      {/* Main Workspace Frame */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        
        {/* Sidebar Navigation */}
        <Sidebar activeTab={activeTab} setActiveTab={updateActiveTab} />

        {/* Dashboard Content — independently scrollable */}
        <main className="flex-1 min-w-0 overflow-y-auto px-6 py-6 md:px-8">
          
          <ErrorBoundary>
            {/* Active Portal Mount */}
            {activeTab === 'support' && <HelpSupportPage />}
            {activeTab === 'subscriptions' && session.user.role === 'ADMIN' && (
              <div className="max-w-5xl mx-auto py-4">
                <SubscriptionDashboard theme={theme} toggleTheme={toggleTheme} />
              </div>
            )}
            {activeTab !== 'support' && activeTab !== 'subscriptions' && (
              <>
                {session.schoolSubscriptionPlan === 'expired' ? (
                  session.user.role === 'ADMIN' ? (
                    <div className="space-y-6 max-w-4xl mx-auto py-8">
                      <div className="p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-3xl flex items-start gap-4">
                        <ShieldAlert className="shrink-0 mt-1" size={24} />
                        <div>
                          <h3 className="text-lg font-bold text-slate-100 font-sans">Institution Subscription Expired</h3>
                          <p className="text-xs text-slate-400 mt-1">
                            Your Aegis ERP subscription has expired. Please select a payment plan below and complete payment to restore access to all administrative modules instantly.
                          </p>
                        </div>
                      </div>
                      <SaaSAuthFlow 
                        onBackToLogin={() => {}} 
                        theme={theme} 
                        toggleTheme={toggleTheme} 
                        initialStep="plans"
                        initialSchoolId={session.user.schoolId || 'school-1'}
                        adminEmail={session.user.email}
                        adminPhone={session.user.phone || ''}
                      />
                    </div>
                  ) : (
                    <GlassCard className="max-w-xl mx-auto p-12 text-center space-y-6 bg-[#0b101d]/80 border border-red-500/20 shadow-2xl mt-12">
                      <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto text-red-400 border border-red-500/20 shadow-lg shadow-red-500/5">
                        <Lock size={36} className="animate-pulse-subtle" />
                      </div>
                      <div className="space-y-2">
                        <h2 className="text-2xl font-extrabold text-white">Access Temporarily Suspended</h2>
                        <p className="text-xs text-slate-400 leading-relaxed px-4">
                          The Aegis ERP subscription for your school has expired. Administrative access, classroom rosters, student portals, and module tracking are currently gated.
                        </p>
                        <p className="text-xs text-brand-400 font-bold font-mono uppercase tracking-widest mt-4">
                          Please contact your School Administrator to renew subscription.
                        </p>
                      </div>
                      <div className="pt-6 border-t border-slate-900 flex justify-center gap-4 text-xs">
                        <a href="#support" className="text-slate-400 hover:text-slate-200 font-semibold flex items-center gap-1.5 transition-colors">
                          <HelpCircle size={15} /> Contact Technical Support
                        </a>
                      </div>
                    </GlassCard>
                  )
                ) : (
                  <>
                    {activeTab === 'sports' ? (
                      <div className="space-y-6">
                        {(session.user.role === 'ADMIN' || ['FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN', 'CUSTOM_SUB_ADMIN', 'DRIVER'].includes(session.user.role)) && (
                          <AdminPortalHeader />
                        )}
                        <PremiumLock
                          isLocked={isTabLockedByEntitlements(session?.user?.role || '', 'sports', ent)}
                          requiredTier="Enterprise"
                          featureName="Sports & Activities"
                        >
                          <SportsManagement />
                        </PremiumLock>
                      </div>
                    ) : (
                      <>
                        {session.user.role === 'STUDENT' && <StudentPortal activeTab={activeTab} />}
                        {session.user.role === 'PARENT' && <ParentPortal activeTab={activeTab} />}
                        {session.user.role === 'TEACHER' && <TeacherPortal activeTab={activeTab} setActiveTab={updateActiveTab} />}
                        {/* Sub-admins: route paymentsettings to TeacherPortal (salary/banking), everything else to AdminPortal */}
                        {/* WARDEN: Entire portal is Enterprise-only; non-Enterprise sees PremiumLock */}
                        {['FINANCE_ADMIN', 'ACADEMIC_ADMIN', 'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'HOSTEL_ADMIN', 'WARDEN', 'SPORTS_ADMIN', 'CUSTOM_SUB_ADMIN', 'DRIVER'].includes(session.user.role) && (
                          activeTab === 'paymentsettings'
                            ? <TeacherPortal activeTab={activeTab} setActiveTab={updateActiveTab} />
                            : session.user.role === 'WARDEN' && isTabLockedByEntitlements('WARDEN', activeTab, ent)
                              ? <PremiumLock
                                  isLocked={true}
                                  requiredTier="Enterprise"
                                  featureName="Warden Portal"
                                >
                                  <AdminPortal activeTab={activeTab} />
                                </PremiumLock>
                              : <AdminPortal activeTab={activeTab} />
                        )}
                        {/* Coach Portal: Enterprise-only — sports is the primary workspace; paymentsettings routes to TeacherPortal */}
                        {session.user.role === 'COACH' && (
                          activeTab === 'paymentsettings'
                            ? <TeacherPortal activeTab={activeTab} setActiveTab={updateActiveTab} />
                            : <PremiumLock
                                isLocked={isTabLockedByEntitlements('COACH', activeTab, ent)}
                                requiredTier="Enterprise"
                                featureName="Coach Portal"
                              >
                                <SportsManagement />
                              </PremiumLock>
                        )}
                        {session.user.role === 'ADMIN' && <AdminPortal activeTab={activeTab} />}
                        {session.user.role === 'SUPER_ADMIN' && <SuperAdminPortal activeTab={activeTab} />}
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </ErrorBoundary>

        </main>
      </div>
      
      {/* Push Notification Opt-in Prompt */}
      {showPushPrompt && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#0b101d]/95 border border-brand-500/30 rounded-2xl shadow-2xl p-5 backdrop-blur-md animate-slide-up">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 to-indigo-500 rounded-t-2xl" />
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
              <Bell size={20} className="animate-pulse" />
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <h4 className="font-bold text-xs text-slate-100 uppercase tracking-wider font-mono">Enable Push Alerts</h4>
              <p className="text-[11px] text-slate-400 leading-normal">
                Aegis ERP uses Google Cloud Messaging to dispatch Grade Releases, Timetable shifts, and Fee deadlines instantly to your device.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleEnablePush}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold text-[10px] rounded-lg border border-brand-400/20 transition-all hover:from-brand-500 hover:to-brand-400 shadow-md shadow-brand-500/15"
                >
                  Enable Alerts
                </button>
                <button
                  onClick={handleLaterPush}
                  className="px-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-400 font-semibold text-[10px] rounded-lg hover:text-slate-200 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Inactivity Session Timeout Warning Modal ───────────────────────────── */}
      {showInactivityWarning && (
        <InactivityWarningModal
          remainingMs={inactivityRemaining}
          onStay={() => {
            // resetAfterStay atomically:
            //  1. Releases the security gate (warningModalOpen → false)
            //  2. Calls onResume → hides the modal
            //  3. Restarts the full 5-minute inactivity timer from zero
            inactivityApiRef.current?.resetAfterStay();
          }}
          onSignOut={() => performSessionExpiry('manual')}
        />
      )}
    </div>
  );
};
