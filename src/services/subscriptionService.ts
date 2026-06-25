/**
 * AEGIS ERP — Subscription Lifecycle Service
 * 
 * Pure TypeScript service for subscription date math, status detection,
 * warning levels, and plan metadata. No React dependencies.
 */

// ─── Plan Definitions ────────────────────────────────────────────────────────

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type SubscriptionStatus = 'trial' | 'active' | 'grace_period' | 'expired' | 'cancelled';

export type ExpiryWarningLevel = null | 'info' | 'warning' | 'critical' | 'urgent' | 'grace' | 'expired';

export interface PlanDefinition {
  code: string;
  name: string;
  priceMonthly: number;
  priceYearly: number;
  savingsYearly: number; // savings vs 12x monthly
  description: string;
  features: string[];
  tier: number; // 0=freemium, 1=basic, 2=pro, 3=enterprise
  popular?: boolean;
  bestValue?: boolean;
}

export const PLAN_DEFINITIONS: PlanDefinition[] = [
  {
    code: 'freemium',
    name: 'Freemium',
    priceMonthly: 0,
    priceYearly: 0,
    savingsYearly: 0,
    description: 'For schools getting started',
    tier: 0,
    features: [
      'Student Management',
      'Teacher Management',
      'Parent Management',
      'Basic Attendance',
      'Basic Reports',
      'Limited Notifications (100/month)',
      'Up to 100 Students',
    ],
  },
  {
    code: 'basic',
    name: 'Basic',
    priceMonthly: 999,
    priceYearly: 9999,
    savingsYearly: 999 * 12 - 9999, // ₹1,989
    description: 'For small & growing schools',
    tier: 1,
    features: [
      'Everything in Freemium +',
      'Fee Management',
      'Timetable Management',
      'Homework Management',
      'Exam Management',
      'Document Center',
      'Bulk Notifications',
      'Up to 500 Students',
    ],
  },
  {
    code: 'pro',
    name: 'Pro',
    priceMonthly: 2499,
    priceYearly: 24999,
    savingsYearly: 2499 * 12 - 24999, // ₹4,989
    description: 'For advanced schools',
    tier: 2,
    popular: true,
    features: [
      'Everything in Basic +',
      'PTM (Parent Teacher Meeting)',
      'Advanced Reports & Analytics',
      'Transport Management',
      'Communication Hub',
      'Multi-Admin Support',
      'Custom Report Builder',
      'Priority Email Support',
      'Up to 1,000 Students',
    ],
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    priceMonthly: 4999,
    priceYearly: 49999,
    savingsYearly: 4999 * 12 - 49999, // ₹9,989
    description: 'For large & multi-campus institutions',
    tier: 3,
    bestValue: true,
    features: [
      'Everything in Pro +',
      'Sports & Activities Management',
      'Coach Portal (Enterprise Only)',
      'Warden Portal (Enterprise Only)',
      'Hostel Management',
      'Advanced Finance & Accounting',
      'Audit Logs & Data Security',
      'Custom Roles & Permissions',
      'Priority Phone Support',
      'Dedicated Onboarding',
      'Unlimited Students',
    ],
  },
];

export const PLAN_MAP = Object.fromEntries(PLAN_DEFINITIONS.map(p => [p.code, p]));

// Backward-compat aliases for legacy plan codes in DB
export const PLAN_CODE_NORMALIZE: Record<string, string> = {
  standard: 'pro',
  premium: 'enterprise',
  STANDARD: 'pro',
  PREMIUM: 'enterprise',
  BASIC: 'basic',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
  FREEMIUM: 'freemium',
};

export function normalizePlanCode(raw: string | null | undefined): string {
  if (!raw) return 'freemium';
  const lower = raw.toLowerCase();
  return PLAN_CODE_NORMALIZE[raw] || PLAN_CODE_NORMALIZE[lower.toUpperCase()] || lower;
}

// ─── Date Math ───────────────────────────────────────────────────────────────

export interface SubscriptionDates {
  startDate: Date;
  endDate: Date;
  graceEndDate: Date;
  startDateStr: string;  // YYYY-MM-DD
  endDateStr: string;    // YYYY-MM-DD
  graceEndDateStr: string; // YYYY-MM-DD
}

/**
 * Computes exact subscription dates using calendar arithmetic.
 * Monthly: +1 calendar month (e.g. Jan 31 → Feb 28/29)
 * Yearly:  +1 calendar year  (e.g. Feb 29 → next Feb 28/29)
 * Grace:   +3 calendar days after endDate
 */
export function computeSubscriptionDates(
  paymentDate: Date,
  billingCycle: BillingCycle
): SubscriptionDates {
  const start = new Date(paymentDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  if (billingCycle === 'YEARLY') {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }

  const grace = new Date(end);
  grace.setDate(grace.getDate() + 3);

  const toDateStr = (d: Date) => d.toISOString().split('T')[0];

  return {
    startDate: start,
    endDate: end,
    graceEndDate: grace,
    startDateStr: toDateStr(start),
    endDateStr: toDateStr(end),
    graceEndDateStr: toDateStr(grace),
  };
}

// ─── Status Detection ────────────────────────────────────────────────────────

export interface SubscriptionRecord {
  plan_code: string;
  billing_cycle?: string;
  subscription_status?: string;
  status?: string;
  start_date?: string | null;
  expiry_date?: string | null;
  grace_end_date?: string | null;
  amount_paid?: number | null;
  transaction_id?: string | null;
  purchase_date?: string | null;
}

/**
 * Evaluates the real-time subscription status by comparing today's date
 * against end_date and grace_end_date. This is the single source of truth.
 */
export function checkSubscriptionStatus(sub: SubscriptionRecord): SubscriptionStatus {
  const todayStr = new Date().toISOString().split('T')[0];
  const endDate = sub.expiry_date;
  const graceEndDate = sub.grace_end_date;

  if (!endDate) {
    // No expiry date — treat as trial
    return (sub.subscription_status as SubscriptionStatus) || 'trial';
  }

  if (todayStr > (graceEndDate || endDate)) {
    return 'expired';
  }

  if (todayStr > endDate) {
    return 'grace_period';
  }

  return 'active';
}

// ─── Days Remaining ──────────────────────────────────────────────────────────

export function getDaysRemaining(endDateStr: string | null | undefined): number {
  if (!endDateStr) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr + 'T00:00:00');
  const diffMs = end.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function getDaysInGrace(graceEndDateStr: string | null | undefined): number {
  return getDaysRemaining(graceEndDateStr);
}

// ─── Warning Level ───────────────────────────────────────────────────────────

/**
 * Returns the warning level based on days remaining.
 * null = no warning (more than 30 days left)
 */
export function getExpiryWarningLevel(
  daysRemaining: number,
  status: SubscriptionStatus
): ExpiryWarningLevel {
  if (status === 'expired') return 'expired';
  if (status === 'grace_period') return 'grace';
  if (status === 'trial') return null;
  if (daysRemaining <= 3)  return 'urgent';
  if (daysRemaining <= 7)  return 'critical';
  if (daysRemaining <= 15) return 'warning';
  if (daysRemaining <= 30) return 'info';
  return null;
}

// ─── Warning Banner Config ───────────────────────────────────────────────────

export interface WarningBannerConfig {
  bg: string;
  border: string;
  text: string;
  icon: string;
  message: (days: number) => string;
}

export const WARNING_BANNER_CONFIG: Record<NonNullable<ExpiryWarningLevel>, WarningBannerConfig> = {
  info: {
    bg: 'bg-brand-500/8',
    border: 'border-brand-500/25',
    text: 'text-brand-300',
    icon: '🔔',
    message: (d) => `Your subscription expires in ${d} days. Renew now to avoid interruption.`,
  },
  warning: {
    bg: 'bg-amber-500/8',
    border: 'border-amber-500/25',
    text: 'text-amber-300',
    icon: '⚠️',
    message: (d) => `Subscription expires in ${d} days — Renew soon to keep all features active.`,
  },
  critical: {
    bg: 'bg-orange-500/8',
    border: 'border-orange-500/25',
    text: 'text-orange-300',
    icon: '🚨',
    message: (d) => `Critical: Subscription expires in ${d} days! Features will lock after expiry.`,
  },
  urgent: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon: '🔴',
    message: (d) => `URGENT: Subscription expires in ${d} day${d === 1 ? '' : 's'}! Renew immediately.`,
  },
  grace: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-300',
    icon: '⏳',
    message: () => `Your subscription has expired. You have a 3-day grace period — renew now to avoid feature lockout.`,
  },
  expired: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: '🔒',
    message: () => `Subscription expired. Premium features are now locked. Renew to restore full access.`,
  },
};

// ─── Plan Tier Helpers ───────────────────────────────────────────────────────

export function getPlanTier(planCode: string): number {
  const normalized = normalizePlanCode(planCode);
  return PLAN_MAP[normalized]?.tier ?? 0;
}

export function isUpgrade(fromPlan: string, toPlan: string): boolean {
  return getPlanTier(toPlan) > getPlanTier(fromPlan);
}

export function isDowngrade(fromPlan: string, toPlan: string): boolean {
  return getPlanTier(toPlan) < getPlanTier(fromPlan);
}

// ─── Formatting Helpers ──────────────────────────────────────────────────────

export function formatPlanPrice(plan: PlanDefinition, cycle: BillingCycle): string {
  if (plan.priceMonthly === 0) return 'Free';
  const price = cycle === 'YEARLY' ? plan.priceYearly : plan.priceMonthly;
  return `₹${price.toLocaleString('en-IN')}`;
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatCycle(cycle: string | null | undefined): string {
  if (!cycle) return '—';
  return cycle === 'YEARLY' ? 'Yearly' : 'Monthly';
}
