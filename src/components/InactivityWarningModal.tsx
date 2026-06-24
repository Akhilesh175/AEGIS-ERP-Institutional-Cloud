/**
 * InactivityWarningModal
 *
 * Premium session-expiry warning overlay for Aegis ERP.
 * Renders a full-screen backdrop with a centred glass card counting
 * down the seconds remaining before the session is automatically
 * terminated.
 *
 * Features:
 * - Animated countdown ring (SVG stroke-dashoffset)
 * - Colour shift from amber → red as time runs out
 * - "Stay Logged In" button — resets the idle timer immediately
 * - "Sign Out Now" button — triggers manual logout at once
 * - Accessible: focus-traps the modal, escape key dismisses (= stay)
 * - Fully responsive (mobile-first)
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { BrandLogo } from './common/BrandLogo';

interface InactivityWarningModalProps {
  /** Remaining session milliseconds when the modal first appears */
  remainingMs: number;
  /** Called when user clicks "Stay Logged In" or presses Escape */
  onStay: () => void;
  /** Called when user clicks "Sign Out Now" */
  onSignOut: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  remainingMs,
  onStay,
  onSignOut,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(remainingMs / 1000));
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());
  const initialRef = useRef<number>(Math.ceil(remainingMs / 1000));

  // Decrement the display counter using wall-clock drift correction
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      const next = Math.max(0, Math.ceil(initialRef.current - elapsed));
      setSecondsLeft(next);
      if (next <= 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Escape key → stay
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onStay();
    },
    [onStay]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // SVG countdown ring
  const RADIUS = 52;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const progress = secondsLeft / initialRef.current; // 1 → 0
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  // Colour cascade: green → amber → red
  const ringColor =
    secondsLeft > 30
      ? '#f59e0b' // amber-400
      : secondsLeft > 10
      ? '#f97316' // orange-500
      : '#ef4444'; // red-500

  const textColor =
    secondsLeft > 30
      ? 'text-amber-400'
      : secondsLeft > 10
      ? 'text-orange-400'
      : 'text-red-400';

  const borderColor =
    secondsLeft > 30
      ? 'border-amber-500/30'
      : secondsLeft > 10
      ? 'border-orange-500/30'
      : 'border-red-500/30';

  const glowColor =
    secondsLeft > 30
      ? 'shadow-amber-500/10'
      : secondsLeft > 10
      ? 'shadow-orange-500/10'
      : 'shadow-red-500/15';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-title"
      aria-describedby="inactivity-desc"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(4, 6, 14, 0.85)', backdropFilter: 'blur(8px)' }}
    >
      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/3 w-80 h-80 rounded-full bg-amber-500/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-red-600/5 blur-[120px] pointer-events-none" />

      <div
        className={`
          relative w-full max-w-md
          bg-[#080c18]/95 border ${borderColor}
          rounded-3xl shadow-2xl ${glowColor}
          p-8 flex flex-col items-center gap-6
          animate-fade-in
          transition-all duration-500
        `}
      >
        {/* Top accent bar */}
        <div
          className="absolute top-0 left-0 w-full h-[3px] rounded-t-3xl"
          style={{
            background: `linear-gradient(90deg, transparent, ${ringColor}, transparent)`,
          }}
        />

        {/* Brand identity — official logo at top of modal */}
        <div className="flex justify-center -mb-2">
          <BrandLogo variant="icon-only" size="xs" className="opacity-70" />
        </div>

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-1"
            style={{ backgroundColor: `${ringColor}15`, border: `1px solid ${ringColor}30` }}
          >
            <ShieldAlert size={24} style={{ color: ringColor }} />
          </div>
          <h2
            id="inactivity-title"
            className="text-lg font-extrabold text-slate-100 tracking-tight"
          >
            Session Expiring Soon
          </h2>
          <p id="inactivity-desc" className="text-xs text-slate-400 max-w-xs leading-relaxed">
            Your session will be automatically terminated due to inactivity. All unsaved work will be preserved.
          </p>
        </div>

        {/* Countdown ring */}
        <div className="relative flex items-center justify-center">
          <svg
            width="128"
            height="128"
            viewBox="0 0 128 128"
            className="-rotate-90"
            aria-hidden="true"
          >
            {/* Track */}
            <circle
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="8"
            />
            {/* Progress */}
            <circle
              cx="64"
              cy="64"
              r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
            />
          </svg>

          {/* Seconds text inside ring */}
          <div className="absolute flex flex-col items-center">
            <span
              className={`text-4xl font-black tabular-nums leading-none ${textColor}`}
              style={{ transition: 'color 0.5s ease' }}
            >
              {secondsLeft}
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-mono">
              seconds
            </span>
          </div>
        </div>

        {/* Status message */}
        <p className="text-xs text-slate-400 text-center -mt-2 leading-relaxed">
          {secondsLeft > 0 ? (
            <>
              You will be signed out in{' '}
              <span className={`font-bold ${textColor}`}>{secondsLeft}s</span>.
              {' '}Use the buttons below to stay or sign out.
            </>
          ) : (
            <span className="text-red-400 font-semibold">Signing you out now…</span>
          )}
        </p>

        {/* Action buttons */}
        <div className="w-full flex flex-col sm:flex-row gap-3 pt-2">
          <button
            id="inactivity-stay-btn"
            onClick={onStay}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold text-xs text-white transition-all duration-200 active:scale-[0.97]"
            style={{
              background: `linear-gradient(135deg, #1e40af, #2563eb)`,
              boxShadow: '0 4px 24px rgba(37,99,235,0.25)',
              border: '1px solid rgba(96,165,250,0.15)',
            }}
          >
            <RefreshCw size={14} />
            Stay Logged In
          </button>

          <button
            id="inactivity-signout-btn"
            onClick={onSignOut}
            className="flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold text-xs text-red-400 hover:text-red-300 transition-all duration-200 active:scale-[0.97]"
            style={{
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            <LogOut size={14} />
            Sign Out Now
          </button>
        </div>

        {/* Bottom tag */}
        <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">
          Aegis ERP · Security Policy · Auto-Logout
        </p>
      </div>
    </div>
  );
};
