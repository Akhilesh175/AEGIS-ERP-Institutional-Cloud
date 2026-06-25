/**
 * AEGIS ERP — SubscriptionDashboard
 *
 * Admin-only subscription management dashboard. Shows current plan status,
 * billing details, expiry countdown, warning banners, and renew/upgrade flows.
 *
 * IMPORTANT: This component does NOT call useSubscriptionLifecycle() directly.
 * That hook creates Supabase Realtime channels. Calling it here AND in App.tsx
 * simultaneously causes a channel name collision error:
 *   "cannot add 'postgres_changes' callbacks after subscribe()"
 *
 * Instead, this component reads warningLevel / daysRemaining / subscriptionStatus
 * from the Zustand store, which is kept in sync by the singleton hook in App.tsx.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  CreditCard, RefreshCw, ArrowUpCircle, ArrowDownCircle, ShieldCheck,
  Clock, Calendar, TrendingUp, CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, Sparkles, Shield, Zap, Lock, FileText
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { SaaSAuthFlow } from './SaaSAuthFlow';
import { useStore } from '../store/useStore';
import { supabase } from '../lib/supabase';
import {
  PLAN_DEFINITIONS,
  normalizePlanCode,
  formatDate,
  formatCycle,
  getDaysRemaining,
  WARNING_BANNER_CONFIG,
  checkSubscriptionStatus,
  getExpiryWarningLevel,
} from '../services/subscriptionService';
import jsPDF from 'jspdf';

interface SubscriptionDashboardProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

type DashView = 'dashboard' | 'renew' | 'upgrade' | 'downgrade';

export const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ theme, toggleTheme }) => {
  // Read subscription state from Zustand store (populated by the singleton
  // useSubscriptionLifecycle in App.tsx — do NOT call that hook here).
  const {
    session,
    plans: storePlans,
    loadingPlans,
    subscriptionStatus,
    warningLevel,
    daysRemaining,
    setSubscriptionLifecycleState,
  } = useStore();

  // Local supplementary state for dates / billing (fetched directly, no realtime)
  const [endDate,       setEndDate]       = useState<string | null>(null);
  const [graceEndDate,  setGraceEndDate]  = useState<string | null>(null);
  const [startDate,     setStartDate]     = useState<string | null>(null);
  const [billingCycle,  setBillingCycle]  = useState<string | null>(null);
  const [amountPaid,    setAmountPaid]    = useState<number | null>(null);
  const [isRefreshing,  setIsRefreshing]  = useState(false);
  const isFetchingRef = useRef(false);

  // Build a lifecycle-compatible object from store values so that the JSX
  // below does not need to be rewritten (only reads, no channel creation).
  const lifecycle = {
    subscriptionStatus,
    warningLevel,
    daysRemaining,
    endDate,
    graceEndDate,
    startDate,
    billingCycle,
    amountPaid,
    isLoading: isRefreshing,
    refresh: () => { void refreshLocalData(); },
  };

  const [view, setView]   = useState<DashView>('dashboard');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // New States for Invoice log and Progressive quotas check
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [usage, setUsage] = useState({ students: 0, teachers: 0, parents: 0 });
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [schoolName, setSchoolName] = useState('Your Institution');

  const currentPlanCode = normalizePlanCode(session?.schoolSubscriptionPlan);
  // Use store plans if loaded, fall back to static PLAN_DEFINITIONS
  const activePlans = storePlans.length > 0 ? storePlans : PLAN_DEFINITIONS;
  const currentPlan = activePlans.find(p => p.code === currentPlanCode) || activePlans[0];
  const isExpired       = lifecycle.subscriptionStatus === 'expired';
  const isGrace         = lifecycle.subscriptionStatus === 'grace_period';
  const isActive        = lifecycle.subscriptionStatus === 'active';
  const isTrial         = lifecycle.subscriptionStatus === 'trial';

  // Plan for renew / upgrade flow
  const [targetPlan, setTargetPlan] = useState<string>(currentPlanCode);

  // ── Fetch subscription row directly (no realtime channels) ──────────────────
  const refreshLocalData = useCallback(async () => {
    const schoolId = session?.user?.schoolId;
    if (!schoolId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsRefreshing(true);
    try {
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (sub) {
        const status  = checkSubscriptionStatus(sub);
        const days    = getDaysRemaining(sub.expiry_date);
        const warning = getExpiryWarningLevel(days, status);
        setEndDate(sub.expiry_date    || null);
        setGraceEndDate(sub.grace_end_date || null);
        setStartDate(sub.start_date   || null);
        setBillingCycle(sub.billing_cycle || null);
        setAmountPaid(sub.amount_paid  ?? null);
        // Push updated values back to the Zustand store so banners stay in sync
        setSubscriptionLifecycleState({ subscriptionStatus: status, warningLevel: warning, daysRemaining: days });
      }
    } catch (e) {
      console.error('[SubscriptionDashboard] refreshLocalData error:', e);
    } finally {
      isFetchingRef.current = false;
      setIsRefreshing(false);
    }
  }, [session?.user?.schoolId, setSubscriptionLifecycleState]);

  // Fetch subscription details once on mount
  useEffect(() => {
    void refreshLocalData();
  }, [refreshLocalData]);

  // ─── Auto-redirect from PremiumLock upgrade button ──────────────────────────
  useEffect(() => {
    const upgradeOrigin = localStorage.getItem('aegis_upgrade_origin');
    if (upgradeOrigin) {
      localStorage.removeItem('aegis_upgrade_origin');
      // Auto-open upgrade view so user lands directly in plan selection
      setView(currentPlan && currentPlan.tier < 3 ? 'upgrade' : 'renew');
    }
  }, []);

  const loadHistory = useCallback(async () => {
    const schoolId = session?.user?.schoolId;
    if (!schoolId) { setLoadingHistory(false); return; }
    try {
      const { data } = await supabase
        .from('subscription_audit_logs')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(10);
      setHistory(data || []);
    } catch {
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [session?.user?.schoolId]);

  const loadUsageAndInvoices = useCallback(async () => {
    const schoolId = session?.user?.schoolId;
    if (!schoolId) {
      setLoadingUsage(false);
      setLoadingInvoices(false);
      return;
    }
    try {
      setLoadingUsage(true);
      setLoadingInvoices(true);
      
      const [studRes, teachRes, parentRes, invRes, schoolRes] = await Promise.all([
        supabase.from('students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('teachers').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('parents').select('*', { count: 'exact', head: true }).eq('school_id', schoolId),
        supabase.from('subscription_invoices').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }),
        supabase.from('schools').select('name').eq('id', schoolId).maybeSingle()
      ]);
      
      setUsage({
        students: studRes.count || 0,
        teachers: teachRes.count || 0,
        parents: parentRes.count || 0
      });
      setInvoices(invRes.data || []);
      if (schoolRes.data) {
        setSchoolName(schoolRes.data.name);
      }
    } catch (e) {
      console.error('Error loading usage/invoices:', e);
    } finally {
      setLoadingUsage(false);
      setLoadingInvoices(false);
    }
  }, [session?.user?.schoolId]);

  useEffect(() => { 
    loadHistory();
    loadUsageAndInvoices();
  }, [loadHistory, loadUsageAndInvoices]);

  const downloadInvoicePDF = (inv: any) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4'
      });

      const schoolNameStr = schoolName || 'Your Institution';
      const amt = Number(inv.amount || 0);
      const tax = Number(inv.tax_amount || 0);
      const discount = Number(inv.discount_amount || 0);
      const total = Number(inv.total_amount || 0);
      const invoiceNo = inv.invoice_number;
      const issueDate = new Date(inv.created_at).toLocaleDateString('en-IN');
      const planCode = inv.plan_code || 'pro';
      const cycle = inv.billing_cycle || 'MONTHLY';

      // Simple premium PDF Layout
      doc.setFillColor(7, 10, 19); // dark header banner
      doc.rect(0, 0, 595, 120, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(22);
      doc.setFont('Helvetica', 'bold');
      doc.text('AEGIS ERP INSTITUTIONAL CLOUD', 40, 55);
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('Advanced Multi-Tenant SaaS Platform', 40, 75);

      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE', 460, 55);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.text(`#${invoiceNo}`, 460, 75);

      // Section: Billing Info
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(11);
      doc.setFont('Helvetica', 'bold');
      doc.text('BILLED TO:', 40, 170);
      doc.setFont('Helvetica', 'normal');
      doc.text(schoolNameStr, 40, 190);
      doc.text('Institutional Administrator', 40, 205);
      doc.text(inv.billing_email || session?.user?.email || 'billing@aegiserp.xyz', 40, 220);

      // Section: Invoice details
      doc.setFont('Helvetica', 'bold');
      doc.text('INVOICE DETAILS:', 380, 170);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Issue Date: ${issueDate}`, 380, 190);
      doc.text(`Billing Cycle: ${cycle}`, 380, 205);
      doc.text(`Plan Code: ${planCode.toUpperCase()}`, 380, 220);

      // Table Header
      doc.setFillColor(240, 243, 248);
      doc.rect(40, 260, 515, 25, 'F');
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Item Description', 50, 276);
      doc.text('Billing Cycle', 280, 276);
      doc.text('Original Price', 380, 276);
      doc.text('Paid Amount', 480, 276);

      // Table Row
      doc.setFont('Helvetica', 'normal');
      doc.text(`AEGIS ERP Subscription - ${planCode.toUpperCase()} Plan`, 50, 310);
      doc.text(cycle, 280, 310);
      doc.text(`INR ${amt.toLocaleString()}`, 380, 310);
      doc.text(`INR ${total.toLocaleString()}`, 480, 310);

      // Subtotals & Totals
      doc.line(40, 340, 555, 340);

      doc.text('Subtotal:', 380, 370);
      doc.text(`INR ${amt.toLocaleString()}`, 480, 370);

      if (discount > 0) {
        doc.setTextColor(220, 50, 50);
        doc.text('Discount Applied:', 380, 390);
        doc.text(`- INR ${discount.toLocaleString()}`, 480, 390);
        doc.setTextColor(30, 30, 30);
      }

      doc.text('GST (18%):', 380, 410);
      doc.text(`INR ${tax.toLocaleString()}`, 480, 410);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Total Paid:', 380, 440);
      doc.text(`INR ${total.toLocaleString()}`, 480, 440);

      // Footer
      doc.setFillColor(245, 247, 250);
      doc.rect(40, 490, 515, 50, 'F');
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('Note: This is a system-generated invoice for your cloud subscription renewal. All payments are verified securely.', 50, 510);
      doc.text('For queries, write to billing@aegiserp.xyz. Thank you for choosing AEGIS ERP Institutional Cloud.', 50, 525);

      doc.save(`Invoice-${invoiceNo}.pdf`);
    } catch (e) {
      console.error(e);
      alert('Failed to generate PDF invoice.');
    }
  };

  // ─── Status badge ───────────────────────────────────────────────────────────
  const StatusBadge: React.FC = () => {
    if (isExpired)  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 text-[10px] font-bold uppercase tracking-wider"><XCircle size={10}/> Expired</span>;
    if (isGrace)    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 text-[10px] font-bold uppercase tracking-wider"><Clock size={10}/> Grace Period</span>;
    if (isActive)   return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10px] font-bold uppercase tracking-wider"><CheckCircle2 size={10}/> Active</span>;
    return           <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-400 text-[10px] font-bold uppercase tracking-wider"><Sparkles size={10}/> Trial</span>;
  };

  // ─── Expiry warning banner ──────────────────────────────────────────────────
  const WarningBanner: React.FC = () => {
    const wl = lifecycle.warningLevel;
    if (!wl) return null;
    const cfg = WARNING_BANNER_CONFIG[wl];
    return (
      <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border ${cfg.bg} ${cfg.border} mb-4`}>
        <div className="flex items-center gap-2">
          <span className="text-base leading-none">{cfg.icon}</span>
          <p className={`text-xs font-medium ${cfg.text}`}>{cfg.message(lifecycle.daysRemaining)}</p>
        </div>
        {wl !== 'expired' && (
          <button
            onClick={() => setView('renew')}
            className="shrink-0 text-[10px] font-bold text-white bg-red-500 hover:bg-red-400 px-3 py-1.5 rounded-lg transition-all"
          >
            Renew Now
          </button>
        )}
      </div>
    );
  };

  // ─── Days remaining ring ────────────────────────────────────────────────────
  const DaysRing: React.FC = () => {
    const days  = lifecycle.daysRemaining;
    const total = lifecycle.billingCycle === 'YEARLY' ? 365 : 30;
    const pct   = Math.min(1, days / total);
    const r = 34;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - pct);
    const color = isExpired ? '#ef4444' : isGrace ? '#f97316' : days <= 7 ? '#ef4444' : days <= 15 ? '#f97316' : '#10b981';

    return (
      <div className="relative w-24 h-24 flex items-center justify-center mx-auto">
        <svg className="absolute inset-0 -rotate-90" width="96" height="96" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6"/>
          <circle
            cx="48" cy="48" r={r} fill="none"
            stroke={color} strokeWidth="6"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
        </svg>
        <div className="text-center z-10">
          <div className="text-2xl font-extrabold text-white leading-none">{isExpired ? '—' : days}</div>
          <div className="text-[9px] text-slate-400 font-medium mt-0.5">days left</div>
        </div>
      </div>
    );
  };

  // ─── If in renew/upgrade/downgrade mode, show SaaSAuthFlow plan selector ───
  if (view === 'renew' || view === 'upgrade' || view === 'downgrade') {
    return (
      <div className="animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100">
              {view === 'renew' ? '🔄 Renew Subscription' : view === 'upgrade' ? '⬆️ Upgrade Plan' : '⬇️ Change Plan'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {view === 'renew' ? `Renewing your ${currentPlan.name} plan` : 'Select a new plan below'}
            </p>
          </div>
          <button
            onClick={() => setView('dashboard')}
            className="text-xs text-slate-400 hover:text-slate-200 border border-slate-800 hover:border-slate-700 px-3 py-1.5 rounded-lg transition-all"
          >
            ← Back to Dashboard
          </button>
        </div>
        <SaaSAuthFlow
          onBackToLogin={() => setView('dashboard')}
          theme={theme}
          toggleTheme={toggleTheme}
          initialStep="plans"
          initialSchoolId={session?.user?.schoolId}
          adminEmail={session?.user?.email}
        />
      </div>
    );
  }

  // ─── Main Dashboard View ────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <CreditCard size={18} className="text-brand-400" />
            Subscription Management
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage your school's subscription plan and billing</p>
        </div>
        <button
          onClick={() => {
              void refreshLocalData();
              void loadUsageAndInvoices();
              void loadHistory();
          }}
          className="p-2 rounded-xl border border-slate-800 hover:border-brand-500/30 text-slate-400 hover:text-brand-400 transition-all"
          title="Refresh subscription status"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Warning Banner */}
      <WarningBanner />

      {/* Current Plan Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plan + Status Card */}
        <GlassCard className="md:col-span-2 p-5 bg-[#0b101d]/75 border-slate-850 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 opacity-70" />
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest font-mono mb-1">Current Plan</p>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-extrabold text-white">{currentPlan.name}</h3>
                <StatusBadge />
              </div>
            </div>
            <div className="p-2 rounded-xl bg-brand-500/10 text-brand-400">
              {currentPlan.tier === 3 ? <Sparkles size={20}/> : currentPlan.tier === 2 ? <Zap size={20}/> : currentPlan.tier === 1 ? <Shield size={20}/> : <ShieldCheck size={20}/>}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-850">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Billing Cycle</p>
              <p className="text-slate-200 font-semibold">{formatCycle(lifecycle.billingCycle) || 'Trial'}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-850">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Start Date</p>
              <p className="text-slate-200 font-semibold">{formatDate(lifecycle.startDate) || '—'}</p>
            </div>
            <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-850">
              <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Expiry Date</p>
              <p className={`font-semibold ${isExpired ? 'text-red-400' : isGrace ? 'text-orange-400' : 'text-slate-200'}`}>
                {formatDate(lifecycle.endDate) || '—'}
              </p>
            </div>
            {lifecycle.graceEndDate && (
              <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                <p className="text-orange-500 text-[10px] uppercase tracking-wider mb-1">Grace End</p>
                <p className="text-orange-400 font-semibold">{formatDate(lifecycle.graceEndDate)}</p>
              </div>
            )}
            {lifecycle.amountPaid !== null && (
              <div className="p-3 rounded-xl bg-slate-900/50 border border-slate-850">
                <p className="text-slate-500 text-[10px] uppercase tracking-wider mb-1">Last Payment</p>
                <p className="text-emerald-400 font-semibold font-mono">
                  {lifecycle.amountPaid === 0 ? 'Free' : `₹${lifecycle.amountPaid.toLocaleString('en-IN')}`}
                </p>
              </div>
            )}
          </div>

          {/* Feature Access List */}
          <div className="mt-4 pt-4 border-t border-slate-900">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mb-2">Features Included</p>
            <div className="flex flex-wrap gap-1.5">
              {currentPlan.features.slice(0, 6).map((f, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-brand-500/8 text-brand-400 border border-brand-500/15">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Days Remaining + Actions */}
        <GlassCard className="p-5 bg-[#0b101d]/75 border-slate-850 flex flex-col items-center gap-4">
          <p className="text-[10px] font-bold text-slate-450 uppercase tracking-widest font-mono self-start">Days Remaining</p>
          <DaysRing />
          {isExpired && (
            <p className="text-[10px] text-red-400 text-center">Subscription expired. Renew to restore access.</p>
          )}
          {isGrace && lifecycle.graceEndDate && (
            <p className="text-[10px] text-orange-400 text-center">
              Grace period ends {formatDate(lifecycle.graceEndDate)}
            </p>
          )}

          {/* Action Buttons */}
          <div className="w-full space-y-2 mt-auto">
            <button
              onClick={() => setView('renew')}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold transition-all shadow-md"
            >
              <RefreshCw size={12}/>
              {isExpired || isGrace ? 'Renew Now' : 'Renew Plan'}
            </button>
            {currentPlan.tier < 3 && (
              <button
                onClick={() => setView('upgrade')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-brand-500/30 text-slate-300 text-xs font-bold transition-all"
              >
                <ArrowUpCircle size={12}/>
                Upgrade Plan
              </button>
            )}
            {currentPlan.tier > 0 && !isExpired && (
              <button
                onClick={() => setView('downgrade')}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-transparent border border-slate-850 hover:border-slate-700 text-slate-500 hover:text-slate-400 text-xs transition-all"
              >
                <ArrowDownCircle size={11}/>
                Change Plan
              </button>
            )}
          </div>
        </GlassCard>
      </div>

      {/* All Plans Comparison */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <TrendingUp size={12} className="text-brand-400" /> Available Plans
        </h3>
        {loadingPlans ? (
          <div className="flex items-center justify-center py-6">
            <span className="w-5 h-5 rounded-full border-2 border-brand-500/30 border-t-brand-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {activePlans.map(plan => {
              const isCurrent = plan.code === currentPlanCode;
              return (
                <div
                  key={plan.code}
                  className={`p-4 rounded-2xl border transition-all ${
                    isCurrent
                      ? 'bg-brand-500/8 border-brand-500/30 shadow-brand-500/5'
                      : 'bg-slate-900/30 border-slate-850 hover:border-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-200">{plan.name}</span>
                    {isCurrent && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-bold">Current</span>}
                  </div>
                  <p className="text-[10px] text-slate-500 mb-2">{plan.description}</p>
                  <p className="text-base font-extrabold text-white">
                    {plan.priceMonthly === 0 ? 'Free' : `₹${plan.priceMonthly.toLocaleString('en-IN')}`}
                    {plan.priceMonthly > 0 && <span className="text-[10px] text-slate-500 font-normal">/mo</span>}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Plan Resource Quotas & Usage Progress */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <ShieldCheck size={12} className="text-brand-400" /> Platform Resource Allocation & Usage
        </h3>
        <GlassCard className="p-5 bg-[#0b101d]/75 border-slate-850 space-y-4">
          {loadingUsage ? (
            <div className="flex justify-center items-center py-4">
              <span className="w-5 h-5 rounded-full border-2 border-brand-500/30 border-t-brand-400 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Students count */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Students strength</span>
                  <span className="text-slate-200">
                    {usage.students} <span className="text-slate-500">/ {currentPlan.maxStudents >= 999999 ? 'Unlimited' : currentPlan.maxStudents}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-850">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (usage.students / (currentPlan.maxStudents || 100)) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Teachers count */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Faculty strength</span>
                  <span className="text-slate-200">
                    {usage.teachers} <span className="text-slate-500">/ {currentPlan.maxTeachers >= 999999 ? 'Unlimited' : currentPlan.maxTeachers}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-850">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (usage.teachers / (currentPlan.maxTeachers || 10)) * 100)}%` }}
                  />
                </div>
              </div>

              {/* Parents count */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-400">Parent accounts</span>
                  <span className="text-slate-200">
                    {usage.parents} <span className="text-slate-500">/ {currentPlan.maxParents >= 999999 ? 'Unlimited' : currentPlan.maxParents}</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-900 overflow-hidden border border-slate-850">
                  <div
                    className="h-full bg-brand-500 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (usage.parents / (currentPlan.maxParents || 200)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Invoices List */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <FileText size={12} className="text-brand-400" /> Invoices & Billing History
        </h3>
        <GlassCard className="p-0 overflow-hidden bg-[#0b101d]/75 border-slate-850">
          {loadingInvoices ? (
            <div className="flex items-center justify-center py-10">
              <span className="w-5 h-5 rounded-full border-2 border-brand-500/30 border-t-brand-400 animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">No invoices generated yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-900">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice No</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cycle</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Discount</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tax (GST)</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Paid</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="text-center px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Invoice</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-900/50 hover:bg-slate-900/30 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-350">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-[10px] uppercase">{inv.plan_code || 'pro'}</td>
                      <td className="px-4 py-3 text-slate-400">{formatCycle(inv.billing_cycle) || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono">₹{Number(inv.amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-rose-450 font-mono">
                        {inv.discount_amount > 0 ? `-₹${Number(inv.discount_amount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono">₹{Number(inv.tax_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-emerald-400 font-semibold font-mono">₹{Number(inv.total_amount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(inv.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => downloadInvoicePDF(inv)}
                          className="text-brand-400 hover:text-brand-300 p-1 bg-brand-500/5 rounded hover:bg-brand-500/10 transition-colors"
                          title="Download PDF"
                        >
                          <FileText size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>

      {/* Audit / Transaction History */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
          <FileText size={12} className="text-brand-400" /> Subscription History
        </h3>
        <GlassCard className="p-0 overflow-hidden bg-[#0b101d]/75 border-slate-850">
          {loadingHistory ? (
            <div className="flex items-center justify-center py-10">
              <span className="w-5 h-5 rounded-full border-2 border-brand-500/30 border-t-brand-400 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">No subscription history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-900">
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Action</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Plan</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Cycle</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="text-left px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h, i) => (
                    <tr key={h.id || i} className="border-b border-slate-900/50 hover:bg-slate-900/30 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                          h.action === 'PAYMENT_SUCCESS' || h.action === 'PURCHASED' || h.action === 'RENEWED' ? 'bg-emerald-500/10 text-emerald-400' :
                          h.action === 'UPGRADED'   ? 'bg-brand-500/10 text-brand-400' :
                          h.action === 'EXPIRED'    ? 'bg-red-500/10 text-red-400' :
                          h.action === 'GRACE_PERIOD'? 'bg-orange-500/10 text-orange-400' :
                          'bg-slate-800 text-slate-400'
                        }`}>
                          {h.action?.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300 font-mono text-[10px] uppercase">{h.plan || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{formatCycle(h.billing_cycle) || '—'}</td>
                      <td className="px-4 py-3 text-slate-300 font-mono">
                        {h.amount ? `₹${Number(h.amount).toLocaleString('en-IN')}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {h.created_at ? new Date(h.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default SubscriptionDashboard;
