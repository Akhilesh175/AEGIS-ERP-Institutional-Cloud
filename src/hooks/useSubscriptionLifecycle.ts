/**
 * AEGIS ERP — useSubscriptionLifecycle
 *
 * React hook that directly queries the subscriptions table via Supabase
 * (on mount and on schoolId change), syncs Zustand store if plan changed,
 * and returns warning level / days remaining for the expiry banner.
 *
 * Runs entirely client-side — no separate serverless function needed.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import {
  SubscriptionStatus,
  ExpiryWarningLevel,
  getDaysRemaining,
  getExpiryWarningLevel,
  normalizePlanCode,
  checkSubscriptionStatus,
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

const NORMALIZE: Record<string, string> = { standard: 'pro', premium: 'enterprise' };

const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // Re-check every 5 minutes

export function useSubscriptionLifecycle(): SubscriptionLifecycleState {
  const { session, syncSubscriptionPlan } = useStore();
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
  const hasTriggeredExpiry = useRef<boolean>(false);

  const check = useCallback(async () => {
    if (!schoolId) return;

    // SUPER_ADMIN bypasses subscription checks — always show full access
    if (session?.user?.role === 'SUPER_ADMIN') return;

    try {
      setState(prev => ({ ...prev, isLoading: true }));

      // Query the subscriptions table directly from the client
      const { data: sub, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !sub) {
        // No subscription row — freemium trial
        setState(prev => ({
          ...prev,
          plan: 'freemium',
          subscriptionStatus: 'trial',
          warningLevel: null,
          daysRemaining: 0,
          isLoading: false,
        }));
        useStore.getState().setSubscriptionStatus('trial');
        return;
      }

      // Compute real-time status using client-side date math
      const subscriptionStatus = checkSubscriptionStatus(sub);

      // Normalize plan code
      const rawPlan = (sub.plan_code || 'freemium').toLowerCase();
      const plan = subscriptionStatus === 'expired'
        ? 'freemium'
        : (NORMALIZE[rawPlan] || rawPlan);

      const endDate      = (sub.expiry_date    as string | null) || null;
      const graceEndDate = (sub.grace_end_date as string | null) || null;
      const startDate    = (sub.start_date     as string | null) || null;
      const billingCycle = (sub.billing_cycle  as string | null) || null;
      const amountPaid   = (sub.amount_paid    as number | null) ?? null;

      const daysRemaining = getDaysRemaining(endDate);
      const warningLevel  = getExpiryWarningLevel(daysRemaining, subscriptionStatus);

      setState({
        plan,
        subscriptionStatus,
        warningLevel,
        daysRemaining,
        endDate,
        graceEndDate,
        startDate,
        billingCycle,
        amountPaid,
        isLoading: false,
      });

      // Sync subscription status to Zustand store
      useStore.getState().setSubscriptionStatus(subscriptionStatus);

      // If client math detects expired subscription but DB still says ACTIVE (or not EXPIRED),
      // call the /api/expire-subscriptions function to atomically update DB.
      if (
        subscriptionStatus === 'expired' &&
        sub &&
        (sub.status !== 'EXPIRED' || sub.subscription_status !== 'expired') &&
        !hasTriggeredExpiry.current
      ) {
        hasTriggeredExpiry.current = true;
        fetch('/api/expire-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId }),
        })
          .then(async (res) => {
            if (res.ok) {
              // Immediately recheck to pull updated state and trigger store sync
              await check();
            }
          })
          .catch((err) => {
            console.error('Failed to trigger subscription expiry write:', err);
            hasTriggeredExpiry.current = false; // allow retry on next attempt
          });
      }

      // Sync Zustand store if plan has changed
      if (plan !== lastCheckedPlan.current) {
        lastCheckedPlan.current = plan;
        const currentStorePlan = normalizePlanCode(useStore.getState().session?.schoolSubscriptionPlan);
        if (plan !== currentStorePlan) {
          await syncSubscriptionPlan();
        }
      }
    } catch (e) {
      // Network/unexpected error — fallback to Zustand store value
      const fallbackPlan = normalizePlanCode(useStore.getState().session?.schoolSubscriptionPlan);
      setState(prev => ({
        ...prev,
        plan:      fallbackPlan,
        isLoading: false,
      }));
    }
  }, [schoolId, session?.user?.role, syncSubscriptionPlan]);

  // Run on mount + schoolId change
  useEffect(() => {
    check();
  }, [check]);

  // Setup Realtime channels for subscription and school updates
  useEffect(() => {
    if (!schoolId) return;

    // Reset the expiry write trigger flag when school changes
    hasTriggeredExpiry.current = false;

    // Channel for subscription changes
    const subChannel = supabase
      .channel(`school-subscriptions-lifecycle-${schoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'subscriptions',
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          check();
        }
      )
      .subscribe();

    // Channel for school profile changes (to update plan)
    const schoolChannel = supabase
      .channel(`school-details-lifecycle-${schoolId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schools',
          filter: `id=eq.${schoolId}`,
        },
        () => {
          check();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subChannel);
      supabase.removeChannel(schoolChannel);
    };
  }, [schoolId, check]);

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
