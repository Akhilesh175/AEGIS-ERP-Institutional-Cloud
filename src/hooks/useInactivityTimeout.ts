/**
 * useInactivityTimeout
 *
 * Enterprise-grade inactivity session management hook for Aegis ERP.
 *
 * Architecture:
 * - All timers are stored in refs — never in state — so they are never
 *   captured inside stale closures and are always safe to clear/restart.
 * - Activity detection covers every meaningful user-interaction surface:
 *   mousemove, mousedown, keydown, touchstart, scroll, visibilitychange,
 *   focus, wheel, pointerdown.
 * - visibilitychange is handled specially: when the tab becomes visible
 *   again we compare wall-clock time to detect if the deadline passed
 *   while the tab was hidden (mobile background, laptop lid close, etc.).
 * - The hook is completely inert when `isActive === false` (no session).
 *   All listeners and timers are torn down on unmount.
 *
 * Security fix (v2):
 *   Once the warning modal is open (setWarningModalOpen(true)), ALL
 *   background activity events (mousemove, keydown, touchstart, click,
 *   wheel, scroll, pointermove, etc.) are IGNORED.  The timer continues
 *   counting down and will expire unless the user explicitly clicks:
 *     • "Stay Logged In" → caller must call setWarningModalOpen(false)
 *                          then the hook resets the inactivity timers.
 *     • "Sign Out Now"   → caller triggers immediate logout.
 *   This prevents any accidental or automatic session extension while
 *   the warning is visible.
 *
 * Timeline (configurable via options):
 *   0 ─────── activity ─────── 4:00 ── warning ── 5:00 ── LOGOUT
 *                              ↑ onWarn fires          ↑ onExpire fires
 */

import { useEffect, useRef, useCallback } from 'react';

export interface InactivityTimeoutOptions {
  /** Total idle milliseconds before forced logout. Default: 300_000 (5 min) */
  timeoutMs?: number;
  /** Milliseconds before logout to show warning modal. Default: 60_000 (1 min) */
  warningMs?: number;
  /** Called when the warning countdown should start. Receives remaining ms. */
  onWarn: (remainingMs: number) => void;
  /** Called when the idle timeout is reset (user became active again). */
  onResume: () => void;
  /** Called when the 5-minute idle deadline is reached. */
  onExpire: () => void;
  /** Whether the hook is active (only when a session exists). */
  isActive: boolean;
}

export interface InactivityTimeoutReturn {
  /**
   * setWarningModalOpen
   *
   * Call with `true` when the warning modal is shown.
   * Call with `false` when the modal is dismissed (Stay Logged In clicked).
   *
   * While true, ALL background activity events are suppressed — the timer
   * keeps counting down and cannot be reset by mouse/keyboard/touch events.
   * Passing false does NOT restart the timer; the caller must explicitly
   * trigger onResume / startTimers by calling resetAfterStay().
   */
  setWarningModalOpen: (open: boolean) => void;
  /**
   * resetAfterStay
   *
   * Call this after the user clicks "Stay Logged In".
   * Closes the warning gate and restarts the full inactivity timer from zero.
   */
  resetAfterStay: () => void;
}

const ACTIVITY_EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'focus',
  'wheel',
  'pointerdown',
];

export function useInactivityTimeout({
  timeoutMs = 300_000,
  warningMs = 60_000,
  onWarn,
  onResume,
  onExpire,
  isActive,
}: InactivityTimeoutOptions): InactivityTimeoutReturn {
  // Store the absolute wall-clock deadline so we can validate after tab restore
  const deadlineRef = useRef<number>(0);
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningActiveRef = useRef<boolean>(false);

  /**
   * warningModalOpenRef
   *
   * This is the security gate.  When true, ALL handleActivity calls are
   * short-circuited before they can call onResume or startTimers.
   * It is set externally via the returned setWarningModalOpen() function.
   */
  const warningModalOpenRef = useRef<boolean>(false);

  // Stable refs for callbacks so we never capture stale closures
  const onWarnRef = useRef(onWarn);
  const onResumeRef = useRef(onResume);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onWarnRef.current = onWarn; }, [onWarn]);
  useEffect(() => { onResumeRef.current = onResume; }, [onResume]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current !== null) {
      clearTimeout(warnTimerRef.current);
      warnTimerRef.current = null;
    }
    if (expireTimerRef.current !== null) {
      clearTimeout(expireTimerRef.current);
      expireTimerRef.current = null;
    }
  }, []);

  const startTimers = useCallback(() => {
    clearTimers();
    const now = Date.now();
    deadlineRef.current = now + timeoutMs;
    warningActiveRef.current = false;

    // Warning fires at (timeoutMs - warningMs) idle time
    const warnDelay = timeoutMs - warningMs;
    warnTimerRef.current = setTimeout(() => {
      warningActiveRef.current = true;
      onWarnRef.current(warningMs);
    }, warnDelay);

    // Expire fires at timeoutMs idle time
    expireTimerRef.current = setTimeout(() => {
      onExpireRef.current();
    }, timeoutMs);
  }, [timeoutMs, warningMs, clearTimers]);

  const handleActivity = useCallback(() => {
    if (!isActive) return;

    // ─── SECURITY GATE ───────────────────────────────────────────────────────
    // If the warning modal is open, ALL background activity events must be
    // completely ignored.  No timer reset.  No session extension.
    // Only an explicit "Stay Logged In" button click (which calls resetAfterStay)
    // is allowed to interact with the session.
    if (warningModalOpenRef.current) {
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // Normal activity path: the warning is not shown.
    // If the internal warn flag was set somehow while the modal was not open
    // (shouldn't happen, but guard for correctness) reset it.
    if (warningActiveRef.current) {
      warningActiveRef.current = false;
      onResumeRef.current();
    }
    startTimers();
  }, [isActive, startTimers]);

  // Handle tab visibility — when the tab becomes visible after being hidden,
  // check if the deadline already passed (e.g. phone locked for 6 minutes).
  const handleVisibilityChange = useCallback(() => {
    if (!isActive) return;
    if (document.visibilityState === 'visible') {
      const now = Date.now();
      if (now >= deadlineRef.current) {
        // Deadline passed while tab was hidden → force immediate expiry
        clearTimers();
        onExpireRef.current();
      } else {
        // Remaining time is still valid — reschedule timers precisely
        clearTimers();
        const remaining = deadlineRef.current - now;
        warningActiveRef.current = false;

        if (remaining <= warningMs) {
          // We are already inside the warning window
          warningActiveRef.current = true;
          onWarnRef.current(remaining);
          expireTimerRef.current = setTimeout(() => {
            onExpireRef.current();
          }, remaining);
        } else {
          const warnDelay = remaining - warningMs;
          warnTimerRef.current = setTimeout(() => {
            warningActiveRef.current = true;
            onWarnRef.current(warningMs);
          }, warnDelay);
          expireTimerRef.current = setTimeout(() => {
            onExpireRef.current();
          }, remaining);
        }
      }
    }
  }, [isActive, warningMs, clearTimers]);

  useEffect(() => {
    if (!isActive) {
      clearTimers();
      return;
    }

    // Kick off the initial timers
    startTimers();

    // Attach activity listeners (passive for performance)
    const listenerOptions: AddEventListenerOptions = { passive: true, capture: true };
    ACTIVITY_EVENTS.forEach((event) => {
      window.addEventListener(event, handleActivity, listenerOptions);
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimers();
      ACTIVITY_EVENTS.forEach((event) => {
        window.removeEventListener(event, handleActivity, listenerOptions);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  // ─── Public API returned to the caller ────────────────────────────────────

  /**
   * setWarningModalOpen
   * Opens or closes the security gate.
   * Call with true when the modal appears, false when it's dismissed.
   * NOTE: Passing false does NOT restart timers — call resetAfterStay for that.
   */
  const setWarningModalOpen = useCallback((open: boolean) => {
    warningModalOpenRef.current = open;
  }, []);

  /**
   * resetAfterStay
   * Called exclusively when the user clicks "Stay Logged In".
   * 1. Closes the security gate (allows activity events again).
   * 2. Calls onResume so the caller can hide the modal.
   * 3. Restarts the full inactivity timer from zero.
   */
  const resetAfterStay = useCallback(() => {
    warningModalOpenRef.current = false;
    warningActiveRef.current = false;
    onResumeRef.current();
    startTimers();
  }, [startTimers]);

  return { setWarningModalOpen, resetAfterStay };
}
