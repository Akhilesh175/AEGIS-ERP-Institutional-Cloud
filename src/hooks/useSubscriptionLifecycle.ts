/**
 * AEGIS ERP — useSubscriptionLifecycle
 *
 * React hook that calls /api/check-subscription-status on mount
 * (and on schoolId change), syncs Zustand store if plan has changed,
 * and returns warning level / days remaining for the expiry banner.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store/useStore';
import {
  SubscriptionStatus,
  ExpiryWarningLevel,
  getDaysRemaining,
  getExpiryWarningLevel,
  normalizePlanCode,
} from '../services/subscriptionService';

export interface SubscriptionLifecycleState {
  plan:               string;
  subscriptionStatus: SubscriptionStatus;
  warningLevel:       ExpiryWarningLevel;
  daysRemaining:      number;
  endDate:            string | null;
  graceEndDate:       string | null;
  startDate:          string | null;
  billingCycle:       string | null;
  amountPaid:         number | null;
  isLoading:          boolean;
  refresh:            () => void;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Re-check every 5 minutes

export function useSubscriptionLifecycle(): SubscriptionLifecycleState {
  const { session, syncSubscriptionPlan, setSession } = useStore();
  const schoolId = session?.user?.schoolId;

  const [state, setState] = useState<Omit<SubscriptionLifecycleState, 'refresh'>>({
    plan:               normalizePlanCode(session?.schoolSubscriptionPlan),
    subscriptionStatus: 'trial',
    warningLevel:       null,
    daysRemaining:      0,
    endDate:            null,
    graceEndDate:       null,
    startDate:          null,
    billingCycle:       null,
    amountPaid:         null,
    isLoading:          false,
  });

  const lastCheckedPlan = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (!schoolId) return;

    // SUPER_ADMIN bypasses subscription checks — always show full access
    if (session?.user?.role === 'SUPER_ADMIN') return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      const res = await fetch('/api/check-subscription-status', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ schoolId }),
      });

      if (!res.ok) {
        // Non-fatal — keep current state
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const data = await res.json();

      const plan               = normalizePlanCode(data.plan);
      const subscriptionStatus = (data.subscriptionStatus || 'trial') as SubscriptionStatus;
      const daysRemaining      = data.daysRemaining ?? getDaysRemaining(data.endDate);
      const warningLevel       = getExpiryWarningLevel(daysRemaining, subscriptionStatus);

      setState({
        plan,
        subscriptionStatus,
        warningLevel,
        daysRemaining,
        endDate:      data.endDate      || null,
        graceEndDate: data.graceEndDate || null,
        startDate:    data.startDate    || null,
        billingCycle: data.billingCycle || null,
        amountPaid:   data.amount       ?? null,
        isLoading:    false,
      });

      // Sync Zustand store and localStorage if plan changed on server
      if (plan !== lastCheckedPlan.current) {
        lastCheckedPlan.current = plan;

        const currentStorePlan = normalizePlanCode(useStore.getState().session?.schoolSubscriptionPlan);
        if (plan !== currentStorePlan) {
          await syncSubscriptionPlan();
        }
      }
    } catch (e) {
      // Network error — fallback to Zustand store value
      const fallbackPlan = normalizePlanCode(useStore.getState().session?.schoolSubscriptionPlan);
      setState(prev => ({
        ...prev,
        plan:     fallbackPlan,
        isLoading: false,
      }));
    }
  }, [schoolId, session?.user?.role, syncSubscriptionPlan]);

  // Run on mount + schoolId change
  useEffect(() => {
    check();
  }, [check]);

  // Periodic re-check every 5 minutes
  useEffect(() => {
    if (!schoolId) return;
    intervalRef.current = setInterval(check, REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [schoolId, check]);

  return { ...state, refresh: check };
}
