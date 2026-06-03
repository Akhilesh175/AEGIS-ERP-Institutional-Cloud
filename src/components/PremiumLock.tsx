import React from 'react';
import { Lock, Sparkles, ShieldAlert, ArrowRight, ShieldCheck } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useStore } from '../store/useStore';

interface PremiumLockProps {
  isLocked: boolean;
  requiredTier: string;
  featureName: string;
  children: React.ReactNode;
}

const PremiumLock: React.FC<PremiumLockProps> = ({ isLocked, requiredTier, featureName, children }) => {
  const { session } = useStore();
  const isSuperAdmin = session?.user?.role === 'SUPER_ADMIN';

  if (!isLocked || isSuperAdmin) {
    return <>{children}</>;
  }

  const currentPlan = (session?.schoolSubscriptionPlan || 'freemium').toUpperCase();
  const currentPlanName = (session?.schoolSubscriptionPlan || 'freemium').toLowerCase();
  const isEnterpriseGated = requiredTier.toUpperCase() === 'ENTERPRISE';

  return (
    <div className="relative w-full min-h-[400px] rounded-3xl animate-fade-in flex flex-col items-center justify-center p-3 sm:p-6 bg-slate-950/10">
      {/* Blurred out content background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-5 blur-2xl select-none rounded-3xl">
        {children}
      </div>

      {/* Lock Card Container */}
      <div className="relative z-10 w-full flex flex-col items-center justify-center py-4">
        {isEnterpriseGated ? (
          <GlassCard className="w-full max-w-lg p-5 sm:p-8 text-center border-brand-500/35 bg-slate-950/90 shadow-[0_0_80px_rgba(59,130,246,0.2)] relative rounded-3xl">
            {/* Enterprise Upgrade Banner */}
            <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 py-2 px-4 flex items-center justify-center gap-1.5 text-[9px] sm:text-[10px] font-bold text-white uppercase tracking-widest text-center">
              <Sparkles size={11} className="animate-spin-slow shrink-0" />
              <span className="truncate">Enterprise Tier Feature Upgrade Required</span>
              <Sparkles size={11} className="animate-spin-slow shrink-0" />
            </div>

            <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-500 flex items-center justify-center mx-auto mt-6 mb-6 shadow-2xl shadow-brand-500/25 border border-white/10 relative">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-pulse" />
              <div className="absolute -bottom-1.5 -right-1.5 bg-brand-500 text-white rounded-full p-1 border border-slate-950">
                <ShieldCheck size={12} />
              </div>
            </div>
            
            {/* Locked Feature UI Label */}
            <h3 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight mb-2">
              {featureName} Gated Lock
            </h3>

            {/* Subscription Warning Message */}
            <div className="my-4 p-3 bg-red-500/5 border border-red-500/25 rounded-xl text-left flex items-start gap-2.5">
              <ShieldAlert className="text-red-400 shrink-0 mt-0.5" size={15} />
              <div>
                <p className="text-[10px] font-bold text-red-400 uppercase tracking-wide">Subscription Security Warning</p>
                <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                  Access to this premium module is suspended. The school's active subscription tier is currently registered as <span className="text-red-400 font-bold font-mono">{currentPlan}</span>. 
                  Enabling <strong className="text-slate-200">{featureName}</strong> requires an active transition to the Enterprise Tier.
                </p>
              </div>
            </div>
            
            <p className="text-slate-350 mb-6 text-[11px] sm:text-xs leading-relaxed">
              Unlock unlimited multi-currency financial ledger syncs, digital library materials, real-time classroom chats, parent forums, and active transport tracking registries.
            </p>

            {/* Upgrade CTA */}
            <button 
              disabled
              className="px-4 sm:px-6 py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-brand-500/20 border border-brand-500/30 w-full transition-all opacity-90 hover:opacity-100 flex flex-col sm:flex-row items-center justify-center gap-2 cursor-not-allowed h-auto whitespace-normal break-words"
            >
              <span className="text-center sm:text-left leading-normal whitespace-normal break-words flex-1">Contact Institutional Administrator to Request Enterprise Upgrade</span>
              <ArrowRight size={14} className="shrink-0 mt-1 sm:mt-0" />
            </button>
          </GlassCard>
        ) : (
          <GlassCard className="w-full max-w-md p-5 sm:p-8 text-center border-amber-500/30 bg-black/80 shadow-[0_0_50px_rgba(245,158,11,0.15)] rounded-3xl">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
              <Lock className="w-6 h-6 sm:w-8 sm:h-8 text-white animate-pulse" />
            </div>
            
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">Feature Locked</h3>
            
            <p className="text-slate-350 mb-6 text-xs sm:text-sm leading-relaxed">
              The <strong className="text-white">{featureName}</strong> module is not available on your current plan. 
              {currentPlanName === 'freemium' ? (
                <span>Please upgrade your institution's subscription to the <strong className="text-amber-400">Pro or Enterprise</strong> tier to unlock this feature.</span>
              ) : (
                <span>A <strong className="text-amber-400">Pro or Enterprise</strong> subscription is required to access this feature.</span>
              )}
            </p>

            <button 
              disabled
              className="px-4 py-4 bg-slate-800 text-amber-400 rounded-lg font-bold border border-slate-700 w-full transition-all h-auto whitespace-normal break-words text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <span className="text-center leading-normal">
                {currentPlanName === 'freemium' ? 'Upgrade to Pro or Enterprise' : 'Pro or Enterprise Required'}
              </span>
            </button>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default PremiumLock;
