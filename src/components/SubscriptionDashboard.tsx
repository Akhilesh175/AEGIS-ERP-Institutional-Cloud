/**
 * AEGIS ERP — SubscriptionDashboard
 *
 * Admin-only subscription management dashboard. Shows current plan status,
 * billing details, expiry countdown, warning banners, and renew/upgrade flows.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, RefreshCw, ArrowUpCircle, ArrowDownCircle, ShieldCheck,
  Clock, Calendar, TrendingUp, CheckCircle2, AlertTriangle, XCircle,
  ChevronRight, Sparkles, Shield, Zap, Lock, FileText
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { SaaSAuthFlow } from './SaaSAuthFlow';
import { useStore } from '../store/useStore';
import { useSubscriptionLifecycle } from '../hooks/useSubscriptionLifecycle';
import {
  PLAN_DEFINITIONS,
  normalizePlanCode,
  formatDate,
  formatCycle,
  getDaysRemaining,
  WARNING_BANNER_CONFIG,
  SubscriptionStatus
} from '../services/subscriptionService';

interface SubscriptionDashboardProps {
  theme: 'dark' | 'light';
  toggleTheme: () => void;
}

type DashView = 'dashboard' | 'renew' | 'upgrade' | 'downgrade';

export const SubscriptionDashboard: React.FC<SubscriptionDashboardProps> = ({ theme, toggleTheme }) => {
  const { session } = useStore();
  const lifecycle  = useSubscriptionLifecycle();
  const [view, setView]   = useState<DashView>('dashboard');
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const currentPlanCode = normalizePlanCode(session?.schoolSubscriptionPlan);
  const currentPlan     = PLAN_DEFINITIONS.find(p => p.code === currentPlanCode) || PLAN_DEFINITIONS[0];
  const isExpired       = lifecycle.subscriptionStatus === 'expired';
  const isGrace         = lifecycle.subscriptionStatus === 'grace_period';
  const isActive        = lifecycle.subscriptionStatus === 'active';
  const isTrial         = lifecycle.subscriptionStatus === 'trial';

  // Plan for renew / upgrade flow
  const [targetPlan, setTargetPlan] = useState<string>(currentPlanCode);

  const loadHistory = useCallback(async () => {
    const schoolId = session?.user?.schoolId;
    if (!schoolId) { setLoadingHistory(false); return; }
    try {
      const { supabase } = await import('../lib/supabase');
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

  useEffect(() => { loadHistory(); }, [loadHistory]);

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
          onClick={lifecycle.refresh}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLAN_DEFINITIONS.map(plan => {
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
          )}
        </GlassCard>
      </div>
    </div>
  );
};

export default SubscriptionDashboard;
