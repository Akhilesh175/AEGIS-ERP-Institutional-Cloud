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
  const isEnterpriseGated = requiredTier.toUpperCase() === 'ENTERPRISE';

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-3xl overflow-hidden animate-fade-in">
      {/* Blurred out content */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20 blur-xl select-none">
        {children}
      </div>

      {/* Lock Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-6 bg-slate-950/40 backdrop-blur-[4px]">
        {isEnterpriseGated ? (
          <GlassCard className="max-w-xl w-full p-8 text-center border-brand-500/35 bg-slate-950/80 shadow-[0_0_80px_rgba(59,130,246,0.2)] relative overflow-hidden">
            {/* Enterprise Upgrade Banner */}
            <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 py-1.5 px-4 flex items-center justify-center gap-1.5 text-[10px] font-bold text-white uppercase tracking-widest">
              <Sparkles size={11} className="animate-spin-slow" />
              Enterprise Tier Feature Upgrade Required
              <Sparkles size={11} className="animate-spin-slow" />
            </div>

            <div className="w-18 h-18 rounded-2xl bg-gradient-to-tr from-brand-600 via-brand-500 to-indigo-500 flex items-center justify-center mx-auto mt-4 mb-6 shadow-2xl shadow-brand-500/25 border border-white/10 relative">
              <Lock className="w-8 h-8 text-white animate-pulse" />
              <div className="absolute -bottom-1.5 -right-1.5 bg-brand-500 text-white rounded-full p-1 border border-slate-950">
                <ShieldCheck size={12} />
              </div>
            </div>
            
            {/* Locked Feature UI Label */}
            <h3 className="text-2xl font-extrabold text-slate-100 tracking-tight mb-2">
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
            
            <p className="text-slate-350 mb-6 text-xs leading-relaxed">
              Unlock unlimited multi-currency financial ledger syncs, digital library materials, real-time classroom chats, parent forums, and active transport tracking registries.
            </p>

            {/* Upgrade CTA */}
            <button 
              disabled
              className="px-6 py-3.5 bg-gradient-to-r from-brand-600 to-brand-500 text-white font-bold rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-brand-500/20 border border-brand-500/30 w-full transition-all opacity-90 hover:opacity-100 flex items-center justify-center gap-2 cursor-not-allowed"
            >
              <span>Contact Institutional Administrator to Request Enterprise Upgrade</span>
              <ArrowRight size={14} />
            </button>
          </GlassCard>
        ) : (
          <GlassCard className="max-w-md w-full p-8 text-center border-amber-500/30 bg-black/60 shadow-[0_0_50px_rgba(245,158,11,0.15)]">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-amber-500/20">
              <Lock className="w-8 h-8 text-white" />
            </div>
            
            <h3 className="text-2xl font-bold text-white mb-3">Feature Locked</h3>
            
            <p className="text-slate-300 mb-6 text-sm leading-relaxed">
              The <strong className="text-white">{featureName}</strong> module is not available on your current plan. 
              Please upgrade your institution's subscription to the <span className="inline-block px-2 py-1 rounded bg-amber-500/20 text-amber-400 font-semibold text-xs ml-1 uppercase">{requiredTier}</span> tier or higher to unlock this feature.
            </p>

            <button 
              disabled
              className="px-6 py-3 bg-slate-800 text-slate-400 rounded-lg font-medium cursor-not-allowed border border-slate-700 w-full transition-all"
            >
              Contact Super Admin to Upgrade
            </button>
          </GlassCard>
        )}
      </div>
    </div>
  );
};

export default PremiumLock;
