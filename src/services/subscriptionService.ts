/**
 * AEGIS ERP — Subscription Lifecycle Service
 * 
 * Pure TypeScript service for subscription date math, status detection,
 * warning levels, and plan metadata. No React dependencies.
 */

// ─── Plan Definitions ────────────────────────────────────────────────────────

export type BillingCycle = 'MONTHLY' | 'YEARLY';

export type SubscriptionStatus = 'trial' | 'active' | 'grace_period' | 'expired' | 'cancelled';

export type ExpiryWarningLevel = null | 'warning_3' | 'warning_2' | 'warning_1' | 'today' | 'expired';

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
  displayOrder: number;
  colorTheme: string;
  isRecommended: boolean;
  isActive: boolean;
  maxStudents: number;
  maxTeachers: number;
  maxParents: number;
  maxStorageGb: number;
  notificationLimits: number;
  hasPtmAccess: boolean;
  hasTransportAccess: boolean;
  hasLibraryAccess: boolean;
  hasFinanceAccess: boolean;
  hasHostelAccess: boolean;
  hasAnalyticsAccess: boolean;
  hasCoachPortal: boolean;
  hasWardenPortal: boolean;
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
    displayOrder: 0,
    colorTheme: 'slate',
    isRecommended: false,
    isActive: true,
    maxStudents: 100,
    maxTeachers: 10,
    maxParents: 200,
    maxStorageGb: 5,
    notificationLimits: 1000,
    hasPtmAccess: false,
    hasTransportAccess: false,
    hasLibraryAccess: false,
    hasFinanceAccess: false,
    hasHostelAccess: false,
    hasAnalyticsAccess: false,
    hasCoachPortal: false,
    hasWardenPortal: false,
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
    displayOrder: 1,
    colorTheme: 'brand',
    isRecommended: false,
    isActive: true,
    maxStudents: 500,
    maxTeachers: 50,
    maxParents: 1000,
    maxStorageGb: 20,
    notificationLimits: 5000,
    hasPtmAccess: false,
    hasTransportAccess: false,
    hasLibraryAccess: false,
    hasFinanceAccess: true,
    hasHostelAccess: false,
    hasAnalyticsAccess: false,
    hasCoachPortal: false,
    hasWardenPortal: false,
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
    displayOrder: 2,
    colorTheme: 'indigo',
    isRecommended: true,
    isActive: true,
    maxStudents: 1000,
    maxTeachers: 100,
    maxParents: 2000,
    maxStorageGb: 50,
    notificationLimits: 10000,
    hasPtmAccess: true,
    hasTransportAccess: true,
    hasLibraryAccess: true,
    hasFinanceAccess: true,
    hasHostelAccess: true,
    hasAnalyticsAccess: true,
    hasCoachPortal: false,
    hasWardenPortal: false,
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
    displayOrder: 3,
    colorTheme: 'purple',
    isRecommended: false,
    isActive: true,
    maxStudents: 9999999,
    maxTeachers: 999999,
    maxParents: 9999999,
    maxStorageGb: 500,
    notificationLimits: 9999999,
    hasPtmAccess: true,
    hasTransportAccess: true,
    hasLibraryAccess: true,
    hasFinanceAccess: true,
    hasHostelAccess: true,
    hasAnalyticsAccess: true,
    hasCoachPortal: true,
    hasWardenPortal: true,
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
  if (status === 'trial') return null;
  
  if (daysRemaining === 3) return 'warning_3';
  if (daysRemaining === 2) return 'warning_2';
  if (daysRemaining === 1) return 'warning_1';
  if (daysRemaining === 0) return 'today';
  
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
  warning_3: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    icon: '⚠️',
    message: () => 'Your subscription will expire in 3 days. Renew now to avoid losing access to Premium features.',
  },
  warning_2: {
    bg: 'bg-yellow-500/12',
    border: 'border-yellow-500/35',
    text: 'text-yellow-400',
    icon: '⚠️',
    message: () => 'Your subscription expires in 2 days. Please renew your plan.',
  },
  warning_1: {
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
    text: 'text-orange-400',
    icon: '⚠️',
    message: () => 'Your subscription expires tomorrow. Renew now to avoid service interruption.',
  },
  today: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    icon: '🚨',
    message: () => 'Your subscription expires today. Please renew immediately.',
  },
  expired: {
    bg: 'bg-red-650/12',
    border: 'border-red-650/35',
    text: 'text-red-400',
    icon: '🚨',
    message: () => 'Your subscription has expired. Premium features are now locked. Renew your subscription to restore access.',
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

export interface GSTBreakdown {
  subtotal: number;
  gstAmount: number;
  total: number;
}

export function calculateGST(amount: number): GSTBreakdown {
  const subtotal = Number(amount);
  const gstAmount = Math.round(subtotal * 0.18);
  const total = subtotal + gstAmount;
  return { subtotal, gstAmount, total };
}

export interface CouponVerifyResult {
  valid: boolean;
  message?: string;
  discountAmount: number;
  finalPrice: number;
}

export function verifyAndApplyCoupon(
  coupon: {
    code: string;
    discount_percent?: number | null;
    discount_amount?: number | null;
    applicable_plans?: string[] | null;
    applicable_schools?: string[] | null;
    expiry_date?: string | null;
    max_uses?: number | null;
    current_uses?: number | null;
    is_active?: boolean;
    discount_type?: string | null;
    discount_value?: number | null;
    max_discount?: number | null;
    min_purchase?: number | null;
    status?: string | null;
    activation_date?: string | null;
    is_deleted?: boolean | null;
  } | null,
  planCode: string,
  schoolId: string,
  originalPrice: number
): CouponVerifyResult {
  if (!coupon || coupon.is_active === false || coupon.status === 'DISABLED' || coupon.status === 'INACTIVE' || coupon.is_deleted === true) {
    return { valid: false, message: 'Invalid or inactive coupon', discountAmount: 0, finalPrice: originalPrice };
  }

  const todayStr = new Date().toISOString().split('T')[0];

  if (coupon.activation_date && todayStr < coupon.activation_date) {
    return { valid: false, message: 'Coupon is not active yet (scheduled)', discountAmount: 0, finalPrice: originalPrice };
  }

  if (coupon.expiry_date && todayStr > coupon.expiry_date) {
    return { valid: false, message: 'Coupon has expired', discountAmount: 0, finalPrice: originalPrice };
  }

  if (coupon.max_uses !== undefined && coupon.max_uses !== null && coupon.current_uses !== undefined && coupon.current_uses !== null) {
    if (coupon.current_uses >= coupon.max_uses) {
      return { valid: false, message: 'Coupon usage limit reached', discountAmount: 0, finalPrice: originalPrice };
    }
  }

  if (coupon.applicable_plans && coupon.applicable_plans.length > 0) {
    const isPlanApplicable = coupon.applicable_plans.some(p => p.toLowerCase() === planCode.toLowerCase());
    if (!isPlanApplicable) {
      return { valid: false, message: 'Coupon is not applicable to this plan', discountAmount: 0, finalPrice: originalPrice };
    }
  }

  if (coupon.applicable_schools && coupon.applicable_schools.length > 0) {
    const isSchoolApplicable = coupon.applicable_schools.some(s => s === schoolId);
    if (!isSchoolApplicable) {
      return { valid: false, message: 'Coupon is not applicable to this school', discountAmount: 0, finalPrice: originalPrice };
    }
  }

  // Minimum Purchase check
  const minPurchase = coupon.min_purchase !== undefined && coupon.min_purchase !== null ? Number(coupon.min_purchase) : 0;
  if (originalPrice < minPurchase) {
    return { valid: false, message: `Minimum purchase amount of ₹${minPurchase} not met`, discountAmount: 0, finalPrice: originalPrice };
  }

  let discountAmount = 0;
  const discountType = coupon.discount_type || (coupon.discount_percent !== undefined && coupon.discount_percent !== null ? 'PERCENTAGE' : 'FIXED');
  const discountVal = coupon.discount_value !== undefined && coupon.discount_value !== null ? Number(coupon.discount_value) : (discountType === 'PERCENTAGE' ? Number(coupon.discount_percent || 0) : Number(coupon.discount_amount || 0));

  if (discountType === 'PERCENTAGE') {
    discountAmount = Math.round((originalPrice * discountVal) / 100);
    // Cap at max discount if specified
    if (coupon.max_discount !== undefined && coupon.max_discount !== null) {
      discountAmount = Math.min(discountAmount, Number(coupon.max_discount));
    }
  } else {
    discountAmount = discountVal;
  }

  // Cap discount at original price
  discountAmount = Math.min(discountAmount, originalPrice);
  const finalPrice = Math.max(0, originalPrice - discountAmount);

  return {
    valid: true,
    discountAmount,
    finalPrice
  };
}

/**
 * Resolves the valid upgrade path plan codes based on the current plan code.
 */
export function getUpgradePath(currentPlanCode: string | null | undefined): string[] {
  const norm = normalizePlanCode(currentPlanCode);
  if (norm === 'freemium') {
    return ['basic', 'pro', 'enterprise'];
  }
  if (norm === 'basic') {
    return ['pro', 'enterprise'];
  }
  if (norm === 'pro') {
    return ['enterprise'];
  }
  return []; // enterprise cannot upgrade further
}

/**
 * Centrally triggers an upgrade redirection by saving originating module context
 */
export function handleUpgradeClick(fromTab: string) {
  localStorage.setItem('aegis_upgrade_origin', fromTab);
  window.location.hash = 'subscriptions';
}
