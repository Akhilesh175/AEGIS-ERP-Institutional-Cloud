import React from 'react';
import { Lock } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface PremiumLockProps {
  isLocked: boolean;
  requiredTier: string;
  featureName: string;
  children: React.ReactNode;
}

const PremiumLock: React.FC<PremiumLockProps> = ({ isLocked, requiredTier, featureName, children }) => {
  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div className="relative w-full h-full min-h-[300px]">
      {/* Blurred out content */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40 blur-md select-none">
        {children}
      </div>

      {/* Lock Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4">
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
      </div>
    </div>
  );
};

export default PremiumLock;
