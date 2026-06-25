import type { FeatureEntitlements } from '../hooks/useFeatureEntitlements';

export interface SubscriptionFeatures {
  communications: boolean; // Forums/Discussions/Chat
  advancedAnalytics: boolean; // SaaS Telemetry
  billing: boolean; // Fee Management
  quizzes: boolean; // Online Exams
  auditLogs: boolean; // Global Audit Logs
}

export interface SubscriptionLimits {
  maxStudents: number;
  maxTeachers: number;
}

export interface SubscriptionConfig {
  features: SubscriptionFeatures;
  limits: SubscriptionLimits;
}

export const subscriptionPlans: Record<string, SubscriptionConfig> = {
  freemium: {
    features: {
      communications: false,
      advancedAnalytics: false,
      billing: false,
      quizzes: false,
      auditLogs: false,
    },
    limits: {
      maxStudents: 50,
      maxTeachers: 5,
    }
  },
  basic: {
    features: {
      communications: true,
      advancedAnalytics: false,
      billing: true,
      quizzes: false,
      auditLogs: false,
    },
    limits: {
      maxStudents: 500,
      maxTeachers: 50,
    }
  },
  pro: {
    features: {
      communications: true,
      advancedAnalytics: true,
      billing: true,
      quizzes: true,
      auditLogs: true,
    },
    limits: {
      maxStudents: 2500,
      maxTeachers: 200,
    }
  },
  enterprise: {
    features: {
      communications: true,
      advancedAnalytics: true,
      billing: true,
      quizzes: true,
      auditLogs: true,
    },
    limits: {
      maxStudents: 9999999, // practically unlimited
      maxTeachers: 999999,
    }
  }
};

// ─── Backward-compat aliases ────────────────────────────────────────────────
// Legacy DB rows may still have 'standard', 'premium', 'STANDARD', 'PREMIUM'.
// These aliases redirect to the canonical plan keys.
subscriptionPlans['standard'] = subscriptionPlans['pro'];
subscriptionPlans['premium']  = subscriptionPlans['enterprise'];
// 'expired' gets freemium-level access
subscriptionPlans['expired']  = subscriptionPlans['freemium'];

// ─── Plan code normalizer ───────────────────────────────────────────────────
const PLAN_ALIAS: Record<string, string> = {
  standard:   'pro',
  premium:    'enterprise',
  STANDARD:   'pro',
  PREMIUM:    'enterprise',
  BASIC:      'basic',
  PRO:        'pro',
  ENTERPRISE: 'enterprise',
  FREEMIUM:   'freemium',
  expired:    'freemium',
  EXPIRED:    'freemium',
};

/**
 * Normalizes any raw plan code to one of: freemium | basic | pro | enterprise.
 * Safe to call with null / undefined.
 */
export function normalizePlanName(raw: string | null | undefined): string {
  if (!raw) return 'freemium';
  const lower = raw.toLowerCase();
  return PLAN_ALIAS[raw] || PLAN_ALIAS[lower.toUpperCase()] || lower;
}

export const isTabLocked = (role: string, tabId: string, planName: string): boolean => {
  const plan = normalizePlanName(planName);
  if (role === 'STUDENT') {
    if (tabId === 'materials') return plan !== 'enterprise';
    if (tabId === 'library') return plan !== 'enterprise';
    if (tabId === 'transit') return plan !== 'enterprise';
    if (tabId === 'hostel') return plan !== 'enterprise';
    if (tabId === 'quizzes') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'forums') return plan === 'freemium';
    if (tabId === 'fees') return plan === 'freemium';
    if (tabId === 'ptm') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'sports') return plan !== 'enterprise';
  }
  if (role === 'PARENT') {
    if (tabId === 'homework') return plan !== 'enterprise';
    if (tabId === 'materials') return plan !== 'enterprise';
    if (tabId === 'library') return plan !== 'enterprise';
    if (tabId === 'transit') return plan !== 'enterprise';
    if (tabId === 'hostel') return plan !== 'enterprise';
    if (tabId === 'quizzes') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'forums') return plan === 'freemium';
    if (tabId === 'fees') return plan === 'freemium';
    if (tabId === 'ptm') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'sports') return plan !== 'enterprise';
  }
  if (role === 'TEACHER') {
    if (tabId === 'classroster') return plan === 'freemium';
    if (tabId === 'attendance') return plan === 'freemium';
    if (tabId === 'marksheets') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'analytics') return plan !== 'enterprise';
    if (tabId === 'assignments') return plan !== 'enterprise';
    if (tabId === 'quizzes') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'materials') return plan !== 'enterprise';
    if (tabId === 'forums') return plan === 'freemium';
    if (tabId === 'ptm') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'sports') return plan !== 'enterprise';
  }
  if (role === 'ADMIN') {
    if (tabId === 'attendance') return plan === 'freemium';
    if (tabId === 'fees') return plan === 'freemium';
    if (tabId === 'hostel') return plan !== 'enterprise';
    if (tabId === 'communications') return plan === 'freemium';
    if (tabId === 'analytics') return plan === 'freemium' || plan === 'basic';
    if (tabId === 'rbac') return plan !== 'enterprise' && plan !== 'pro';
    if (tabId === 'backups') return plan !== 'enterprise';
    // PTM Meetings: requires Pro or Enterprise
    if (tabId === 'ptm') return plan === 'freemium' || plan === 'basic';
    // Sports & Activities: requires Enterprise only
    if (tabId === 'sports') return plan !== 'enterprise';
  }

  // ─── COACH Portal: Enterprise Only ───────────────────────────────────────────
  // The entire Coach Portal workspace is Enterprise-tier.
  // Freemium, Basic, and Pro plans must see PremiumLock on all coach tabs.
  if (role === 'COACH') {
    if (tabId === 'sports') return plan !== 'enterprise';
    if (tabId === 'dashboard') return plan !== 'enterprise';
  }
  // ─── WARDEN Portal: Enterprise Only ──────────────────────────────────────────
  // The entire Warden Portal workspace is Enterprise-tier.
  // Freemium, Basic, and Pro plans must see PremiumLock on all warden tabs.
  if (role === 'WARDEN') {
    return plan !== 'enterprise';
  }
  return false;
};

// ─── DB-Driven Tab Lock (replaces hardcoded isTabLocked) ─────────────────────
//
// This function accepts the typed FeatureEntitlements object from
// useFeatureEntitlements() and returns `true` when the tab should show a
// PremiumLock overlay.
//
// Old callers that still pass planName strings continue to work via isTabLocked().
// New callers (Sidebar, AdminPortal) should migrate to isTabLockedByEntitlements().

/**
 * DB-driven tab lock check.
 *
 * Returns `true` (locked/gated) when the school's current subscription does NOT
 * include the entitlement required for the given role + tabId combination.
 *
 * Feature flags come from `FeatureEntitlements` (computed by `useFeatureEntitlements()`
 * with full tier inheritance — Enterprise ⊇ Pro ⊇ Basic ⊇ Freemium).
 *
 * Adding a new plan tier to the DB automatically propagates through here —
 * no code changes needed.
 */
export function isTabLockedByEntitlements(
  role: string,
  tabId: string,
  ent: FeatureEntitlements
): boolean {
  // ── STUDENT ──────────────────────────────────────────────────────────────
  if (role === 'STUDENT') {
    if (tabId === 'materials') return !ent.hasLibraryAccess;
    if (tabId === 'library')   return !ent.hasLibraryAccess;
    if (tabId === 'transit')   return !ent.hasTransportAccess;
    if (tabId === 'hostel')    return !ent.hasHostelAccess;
    if (tabId === 'quizzes')   return !ent.hasQuizzes;
    if (tabId === 'forums')    return !ent.hasCommunications;
    if (tabId === 'fees')      return !ent.hasBilling;
    if (tabId === 'ptm')       return !ent.hasPtmAccess;
    if (tabId === 'sports')    return !ent.hasSports;
  }

  // ── PARENT ───────────────────────────────────────────────────────────────
  if (role === 'PARENT') {
    if (tabId === 'homework')  return !ent.hasLibraryAccess;
    if (tabId === 'materials') return !ent.hasLibraryAccess;
    if (tabId === 'library')   return !ent.hasLibraryAccess;
    if (tabId === 'transit')   return !ent.hasTransportAccess;
    if (tabId === 'hostel')    return !ent.hasHostelAccess;
    if (tabId === 'quizzes')   return !ent.hasQuizzes;
    if (tabId === 'forums')    return !ent.hasCommunications;
    if (tabId === 'fees')      return !ent.hasBilling;
    if (tabId === 'ptm')       return !ent.hasPtmAccess;
    if (tabId === 'sports')    return !ent.hasSports;
  }

  // ── TEACHER ──────────────────────────────────────────────────────────────
  if (role === 'TEACHER') {
    if (tabId === 'classroster') return !ent.hasBilling;
    if (tabId === 'attendance')  return !ent.hasBilling;
    if (tabId === 'marksheets')  return !ent.hasQuizzes;
    if (tabId === 'analytics')   return !ent.hasAnalyticsAccess;
    if (tabId === 'assignments') return !ent.hasLibraryAccess;
    if (tabId === 'quizzes')     return !ent.hasQuizzes;
    if (tabId === 'materials')   return !ent.hasLibraryAccess;
    if (tabId === 'forums')      return !ent.hasCommunications;
    if (tabId === 'ptm')         return !ent.hasPtmAccess;
    if (tabId === 'sports')      return !ent.hasSports;
  }

  // ── ADMIN ─────────────────────────────────────────────────────────────────
  if (role === 'ADMIN') {
    if (tabId === 'attendance')     return !ent.hasBilling;
    if (tabId === 'fees')           return !ent.hasBilling;
    if (tabId === 'hostel')         return !ent.hasHostelAccess;
    if (tabId === 'communications') return !ent.hasCommunications;
    if (tabId === 'analytics')      return !ent.hasAnalyticsAccess;
    if (tabId === 'rbac')           return !ent.hasRbac;
    if (tabId === 'backups')        return !ent.hasBackups;
    if (tabId === 'ptm')            return !ent.hasPtmAccess;
    if (tabId === 'sports')         return !ent.hasSports;
  }

  // ── COACH: Enterprise Only ────────────────────────────────────────────────
  if (role === 'COACH') {
    if (tabId === 'sports')    return !ent.hasCoachPortal;
    if (tabId === 'dashboard') return !ent.hasCoachPortal;
  }

  // ── WARDEN: Enterprise Only ───────────────────────────────────────────────
  if (role === 'WARDEN') {
    return !ent.hasWardenPortal;
  }

  return false;
}
