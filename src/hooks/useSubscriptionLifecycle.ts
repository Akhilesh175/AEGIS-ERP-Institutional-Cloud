/**
 * AEGIS ERP — useSubscriptionLifecycle
 *
 * SINGLETON DESIGN — must only be called ONCE in the component tree (App.tsx).
 * All other components must read warningLevel/daysRemaining from the Zustand
 * store (useStore) rather than calling this hook a second time.
 *
 * Calling this hook in multiple components simultaneously WILL cause Supabase
 * Realtime channel name collisions and the error:
 *   "cannot add 'postgres_changes' callbacks after subscribe()"
 *
 * Architecture:
 *  - Queries the subscriptions table on mount + schoolId change
 *  - Writes computed warningLevel/daysRemaining/subscriptionStatus to Zustand
 *  - Sets up ONE realtime listener per school for subscriptions + schools tables
 *  - Tears down channels correctly on unmount / schoolId change
 *  - Uses a unique channel suffix (mountId) to survive React StrictMode
 *    double-invocation without channel name conflicts
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

  const lastCheckedPlan     = useRef<string | null>(null);
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasTriggeredExpiry  = useRef<boolean>(false);
  const isFetchingRef       = useRef<boolean>(false); // guard against concurrent fetches

  // ── Unique mount identifier to prevent Supabase channel name collisions ──
  // React StrictMode mounts/unmounts twice in dev; a timestamp suffix means
  // the second mount always gets a fresh name even if the first cleanup
  // hasn't fully propagated through Supabase's internal state machine.
  const mountIdRef = useRef<string>(`${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  const check = useCallback(async () => {
    if (!schoolId) return;
    if (isFetchingRef.current) return; // Prevent concurrent fetches

    // SUPER_ADMIN bypasses subscription checks — always show full access
    if (session?.user?.role === 'SUPER_ADMIN') return;

    isFetchingRef.current = true;

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
        useStore.getState().setSubscriptionLifecycleState({
          subscriptionStatus: 'trial',
          warningLevel: null,
          daysRemaining: 0
        });
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

      // Sync subscription state to Zustand store
      useStore.getState().setSubscriptionLifecycleState({
        subscriptionStatus,
        warningLevel,
        daysRemaining
      });

      const todayStr = new Date().toISOString().split('T')[0];
      const isHardExpiredNotPersisted =
        subscriptionStatus === 'expired' &&
        (sub.status !== 'EXPIRED' || sub.subscription_status !== 'expired');

      const expectedAlertLevel =
        subscriptionStatus === 'expired'
          ? 'EXPIRED'
          : subscriptionStatus === 'grace_period'
            ? 'GRACE_PERIOD'
            : daysRemaining === 0
              ? 'TODAY'
              : daysRemaining === 1
                ? '1_DAY'
                : daysRemaining === 2
                  ? '2_DAYS'
                  : daysRemaining === 3
                    ? '3_DAYS'
                    : 'NONE';

      const needsDbAlertWrite =
        session?.user?.role === 'ADMIN' &&
        expectedAlertLevel !== 'NONE' &&
        expectedAlertLevel !== 'GRACE_PERIOD' &&
        (sub.last_notification_date !== todayStr || sub.notification_sent !== expectedAlertLevel);

      if ((isHardExpiredNotPersisted || needsDbAlertWrite) && !hasTriggeredExpiry.current) {
        hasTriggeredExpiry.current = true;
        fetch('/api/expire-subscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schoolId }),
        })
          .then(async (res) => {
            if (res.ok) {
              // Re-check after server writes the alert — reset guard first
              hasTriggeredExpiry.current = false;
              isFetchingRef.current = false;
              await check();
            }
          })
          .catch((err) => {
            console.error('[useSubscriptionLifecycle] Failed to trigger alert write:', err);
            hasTriggeredExpiry.current = false;
          });
        return; // Exit early; re-check triggered above
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
    } finally {
      isFetchingRef.current = false;
    }
  }, [schoolId, session?.user?.role, syncSubscriptionPlan]);

  // Run on mount + schoolId change
  useEffect(() => {
    check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId]);

  // ── Realtime channels: one pair per school, with a unique mount suffix ──────
  // We do NOT include `check` in the dependency array here intentionally.
  // Adding it would cause the channels to be torn down and re-created every time
  // `check` gets a new reference, which creates a race condition where the old
  // channel has not finished unsubscribing before the new one tries to use the
  // same name. Instead we use a stable ref to always call the latest `check`.
  const checkRef = useRef(check);
  useEffect(() => {
    checkRef.current = check;
  });

  useEffect(() => {
    if (!schoolId) return;

    // Reset flags when school changes
    hasTriggeredExpiry.current = false;
    isFetchingRef.current = false;

    // Generate a fresh unique ID for this effect invocation
    // This prevents stale channel names when React StrictMode tears down and
    // re-mounts the component in development.
    const mountId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    mountIdRef.current = mountId;

    const subChannelName    = `sub-lifecycle-${schoolId}-${mountId}`;
    const schoolChannelName = `school-lifecycle-${schoolId}-${mountId}`;

    // Channel for subscription row changes
    const subChannel = supabase
      .channel(subChannelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `school_id=eq.${schoolId}`,
        },
        () => {
          checkRef.current();
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`[useSubscriptionLifecycle] ${subChannelName} subscription error:`, err);
        }
      });

    // Channel for school profile changes (to update plan)
    const schoolChannel = supabase
      .channel(schoolChannelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'schools',
          filter: `id=eq.${schoolId}`,
        },
        () => {
          checkRef.current();
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.error(`[useSubscriptionLifecycle] ${schoolChannelName} subscription error:`, err);
        }
      });

    return () => {
      // Always remove both channels on cleanup — prevents stale listeners
      supabase.removeChannel(subChannel);
      supabase.removeChannel(schoolChannel);
    };
  }, [schoolId]); // IMPORTANT: only schoolId — NOT check

  // Periodic re-check every 5 minutes
  useEffect(() => {
    if (!schoolId) return;
    intervalRef.current = setInterval(() => checkRef.current(), REFRESH_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [schoolId]); // IMPORTANT: only schoolId — NOT check

  return { ...state, refresh: check };
}
