/**
 * AEGIS ERP — useFeatureEntitlements
 *
 * A DB-driven React hook that resolves the current school's feature entitlements
 * by reading live plan definitions from the Zustand store (already synced with
 * `subscription_plans` via Supabase realtime).
 *
 * Key design rules:
 *  1. ZERO hardcoded flags — all boolean entitlements come from DB plan rows.
 *  2. TIER INHERITANCE — plans inherit all entitlements of lower tiers:
 *       Enterprise ⊇ Pro ⊇ Basic ⊇ Freemium
 *     This guarantees no previously available feature is ever lost on upgrade.
 *  3. Reactive — re-computes whenever the store's `plans` array or session
 *     plan changes (both triggered by Supabase realtime channels).
 *  4. Zero React errors — safe defaults for all fields when plan is not found.
 */

import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { normalizePlanCode, PlanDefinition } from '../services/subscriptionService';

// ─── Typed Entitlements Object ───────────────────────────────────────────────

export interface FeatureEntitlements {
  // ── Boolean Feature Flags (accumulated via tier inheritance) ──
  hasPtmAccess: boolean;
  hasTransportAccess: boolean;
  hasLibraryAccess: boolean;
  hasFinanceAccess: boolean;
  hasHostelAccess: boolean;
  hasAnalyticsAccess: boolean;
  hasCoachPortal: boolean;
  hasWardenPortal: boolean;
  hasCommunications: boolean; // Basic+
  hasQuizzes: boolean;        // Pro+
  hasAuditLogs: boolean;      // Pro+
  hasBilling: boolean;        // Basic+
  hasBackups: boolean;        // Enterprise only
  hasRbac: boolean;           // Pro+ (Dynamic Permissions Grid)
  hasSports: boolean;         // Enterprise only

  // ── Quota Limits ──
  maxStudents: number;
  maxTeachers: number;
  maxParents: number;
  maxStorageGb: number;
  notificationLimits: number;

  // ── Plan Meta ──
  currentPlanCode: string;
  tier: number; // 0=freemium, 1=basic, 2=pro, 3=enterprise
}

// ─── Default (Freemium) fallback ─────────────────────────────────────────────

const FREEMIUM_ENTITLEMENTS: FeatureEntitlements = {
  hasPtmAccess: false,
  hasTransportAccess: false,
  hasLibraryAccess: false,
  hasFinanceAccess: false,
  hasHostelAccess: false,
  hasAnalyticsAccess: false,
  hasCoachPortal: false,
  hasWardenPortal: false,
  hasCommunications: false,
  hasQuizzes: false,
  hasAuditLogs: false,
  hasBilling: false,
  hasBackups: false,
  hasRbac: false,
  hasSports: false,
  maxStudents: 100,
  maxTeachers: 10,
  maxParents: 200,
  maxStorageGb: 5,
  notificationLimits: 1000,
  currentPlanCode: 'freemium',
  tier: 0,
};

// ─── Tier order for inheritance ───────────────────────────────────────────────

const TIER_ORDER = ['freemium', 'basic', 'pro', 'enterprise'] as const;

/**
 * Resolves the effective tier index for a given plan code.
 * Falls back to 0 (freemium) for unknown codes.
 */
function resolveTier(planDef: PlanDefinition | undefined): number {
  if (!planDef) return 0;
  // Prefer the `tier` field from DB, but guard against stale/missing values
  const t = planDef.tier;
  if (typeof t === 'number' && t >= 0 && t <= 3) return t;
  const idx = TIER_ORDER.indexOf(planDef.code as any);
  return idx >= 0 ? idx : 0;
}

/**
 * Merges entitlements from all plans at or below the current tier.
 * This implements the inheritance guarantee: upgrading never loses access.
 */
function accumulateEntitlements(
  plans: PlanDefinition[],
  currentTier: number
): Omit<FeatureEntitlements, 'maxStudents' | 'maxTeachers' | 'maxParents' | 'maxStorageGb' | 'notificationLimits' | 'currentPlanCode' | 'tier'> {
  // Start with all-false flags
  let hasPtmAccess = false;
  let hasTransportAccess = false;
  let hasLibraryAccess = false;
  let hasFinanceAccess = false;
  let hasHostelAccess = false;
  let hasAnalyticsAccess = false;
  let hasCoachPortal = false;
  let hasWardenPortal = false;

  // Accumulate flags from all plans at tiers 0..currentTier
  for (const plan of plans) {
    const planTier = resolveTier(plan);
    if (planTier <= currentTier) {
      if (plan.hasPtmAccess) hasPtmAccess = true;
      if (plan.hasTransportAccess) hasTransportAccess = true;
      if (plan.hasLibraryAccess) hasLibraryAccess = true;
      if (plan.hasFinanceAccess) hasFinanceAccess = true;
      if (plan.hasHostelAccess) hasHostelAccess = true;
      if (plan.hasAnalyticsAccess) hasAnalyticsAccess = true;
      if (plan.hasCoachPortal) hasCoachPortal = true;
      if (plan.hasWardenPortal) hasWardenPortal = true;
    }
  }

  // Derive composite feature flags from tier (for features not individually tracked per plan row)
  // These map directly to the subscriptionConfig.ts gating rules
  const hasBilling = currentTier >= 1;          // Basic+
  const hasCommunications = currentTier >= 1;   // Basic+
  const hasQuizzes = currentTier >= 2;          // Pro+
  const hasAuditLogs = currentTier >= 2;        // Pro+
  const hasRbac = currentTier >= 2;             // Pro+
  const hasBackups = currentTier >= 3;          // Enterprise only
  const hasSports = currentTier >= 3;           // Enterprise only

  return {
    hasPtmAccess,
    hasTransportAccess,
    hasLibraryAccess,
    hasFinanceAccess,
    hasHostelAccess,
    hasAnalyticsAccess,
    hasCoachPortal,
    hasWardenPortal,
    hasCommunications,
    hasQuizzes,
    hasAuditLogs,
    hasBilling,
    hasBackups,
    hasRbac,
    hasSports,
  };
}

// ─── Public Hook ─────────────────────────────────────────────────────────────

/**
 * Returns the live, DB-driven feature entitlements for the current school's
 * subscription plan. Re-renders whenever the plan changes (via Supabase
 * realtime → Zustand store update → session.schoolSubscriptionPlan change).
 *
 * Usage:
 *   const ent = useFeatureEntitlements();
 *   if (!ent.hasAnalyticsAccess) return <PremiumLock ... />;
 */
export function useFeatureEntitlements(): FeatureEntitlements {
  const plans = useStore(s => s.plans);
  const rawPlanCode = useStore(s => s.session?.schoolSubscriptionPlan);

  return useMemo<FeatureEntitlements>(() => {
    const planCode = normalizePlanCode(rawPlanCode);

    // Find the current plan definition in the live DB-synced plans array
    const currentPlanDef = plans.find(p => normalizePlanCode(p.code) === planCode);

    if (!currentPlanDef && plans.length === 0) {
      // Store hasn't loaded yet — return safe freemium defaults
      return { ...FREEMIUM_ENTITLEMENTS, currentPlanCode: planCode };
    }

    const tier = resolveTier(currentPlanDef);

    // Accumulate boolean flags from all tiers ≤ current
    const flags = accumulateEntitlements(plans, tier);

    // Quotas come from the CURRENT plan only (not accumulated — higher tier = bigger quota)
    const maxStudents = currentPlanDef?.maxStudents ?? FREEMIUM_ENTITLEMENTS.maxStudents;
    const maxTeachers = currentPlanDef?.maxTeachers ?? FREEMIUM_ENTITLEMENTS.maxTeachers;
    const maxParents = currentPlanDef?.maxParents ?? FREEMIUM_ENTITLEMENTS.maxParents;
    const maxStorageGb = currentPlanDef?.maxStorageGb ?? FREEMIUM_ENTITLEMENTS.maxStorageGb;
    const notificationLimits = currentPlanDef?.notificationLimits ?? FREEMIUM_ENTITLEMENTS.notificationLimits;

    return {
      ...flags,
      maxStudents,
      maxTeachers,
      maxParents,
      maxStorageGb,
      notificationLimits,
      currentPlanCode: planCode,
      tier,
    };
  }, [plans, rawPlanCode]);
}

/**
 * Standalone version for use outside React components (e.g. non-hook contexts).
 * Reads directly from Zustand state (no React dependency).
 */
export function getFeatureEntitlements(): FeatureEntitlements {
  const { plans, session } = useStore.getState();
  const rawPlanCode = session?.schoolSubscriptionPlan;
  const planCode = normalizePlanCode(rawPlanCode);
  const currentPlanDef = plans.find(p => normalizePlanCode(p.code) === planCode);

  if (!currentPlanDef && plans.length === 0) {
    return { ...FREEMIUM_ENTITLEMENTS, currentPlanCode: planCode };
  }

  const tier = resolveTier(currentPlanDef);
  const flags = accumulateEntitlements(plans, tier);

  return {
    ...flags,
    maxStudents: currentPlanDef?.maxStudents ?? FREEMIUM_ENTITLEMENTS.maxStudents,
    maxTeachers: currentPlanDef?.maxTeachers ?? FREEMIUM_ENTITLEMENTS.maxTeachers,
    maxParents: currentPlanDef?.maxParents ?? FREEMIUM_ENTITLEMENTS.maxParents,
    maxStorageGb: currentPlanDef?.maxStorageGb ?? FREEMIUM_ENTITLEMENTS.maxStorageGb,
    notificationLimits: currentPlanDef?.notificationLimits ?? FREEMIUM_ENTITLEMENTS.notificationLimits,
    currentPlanCode: planCode,
    tier,
  };
}
