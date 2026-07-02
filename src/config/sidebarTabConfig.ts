/**
 * sidebarTabConfig.ts
 *
 * ─── SINGLE SOURCE OF TRUTH ─────────────────────────────────────────────────
 * Every tab ID that can appear in the sidebar for a given role is declared
 * here. Both:
 *   • Sidebar.tsx  – can reference this for the complete set of valid IDs.
 *   • App.tsx      – uses getAllowedTabsForRole() so the navigation guard
 *                    never rejects a tab that is visible in the sidebar.
 *
 * HOW TO ADD A NEW TAB
 * 1. Add the tab id to the correct role(s) in ROLE_TAB_IDS below.
 * 2. Add the rendered component block in the corresponding portal file.
 * 3. Add the sidebar item to Sidebar.tsx getTabs().
 * The router guard updates automatically — no other file needs to change.
 * ────────────────────────────────────────────────────────────────────────────
 */

// ---------------------------------------------------------------------------
// Static tab IDs per role
// ---------------------------------------------------------------------------

/**
 * All tab IDs that a role's sidebar can ever show.
 *
 * For sub-admins the sidebar is dynamic (subset based on runtime RBAC
 * permissions). We list the FULL SUPERSET here so the router guard never
 * blocks any legitimately visible tab.
 */
export const ROLE_TAB_IDS: Readonly<Record<string, readonly string[]>> = {
  STUDENT: [
    'dashboard', 'timetable', 'ptm', 'grades',
    'documents',        // Documents Center
    'groupdiscussion', 'materials', 'quizzes', 'library',
    'sports', 'transit', 'hostel', 'forums', 'fees', 'support',
  ],

  PARENT: [
    'dashboard', 'notifications', 'ptm', 'homework', 'timetable', 'grades',
    'documents',        // Documents Center
    'fees', 'materials', 'quizzes', 'library',
    'sports', 'transit', 'hostel', 'forums', 'support',
  ],

  TEACHER: [
    'dashboard', 'timetable', 'ptm', 'groupdiscussion',
    'classroster', 'attendance', 'grades', 'marksheets', 'analytics',
    'assignments', 'quizzes', 'materials', 'forums', 'paymentsettings', 'support',
  ],

  // DRIVER shares the Teacher portal
  DRIVER: [
    'dashboard', 'timetable', 'ptm', 'groupdiscussion',
    'classroster', 'attendance', 'grades', 'marksheets', 'analytics',
    'assignments', 'quizzes', 'materials', 'forums', 'paymentsettings', 'support',
  ],

  COACH: [
    'dashboard', 'sports', 'paymentsettings', 'support',
  ],

  ADMIN: [
    'dashboard', 'students', 'teachers', 'parents', 'classes', 'subjects',
    'academicsessions', 'ptm',
    'documents',        // Documents Center
    'groupdiscussion', 'attendance', 'fees', 'hostel', 'sports',
    'communications', 'analytics', 'rbac', 'backups', 'books', 'transport',
    'marksheets', 'quizzes', 'assignments', 'impersonation',
    'subscriptions', 'dangerzone', 'support',
  ],

  SUPER_ADMIN: [
    'dashboard', 'tenants', 'users', 'saas-billing', 'communications',
    'audits', 'backups', 'logging', 'sports', 'ptm', 'support',
    // Subscription Management sub-tabs (invoices intentionally excluded)
    'sub-dashboard', 'sub-plans', 'sub-pricing', 'sub-coupons',
    'sub-purchases', 'sub-timeline', 'sub-audits', 'sub-reports',
  ],

  // ── Sub-admin superset ────────────────────────────────────────────────────
  // The sidebar shows a permission-filtered subset at runtime.
  // The router guard must allow the full superset to avoid blocking any tab.
  FINANCE_ADMIN: [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'sports', 'paymentsettings', 'support',
  ],

  ACADEMIC_ADMIN: [
    'dashboard', 'groupdiscussion', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions', 'attendance', 'assignments',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'sports', 'paymentsettings', 'support',
  ],

  EXAM_CONTROLLER: [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions', 'attendance',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'paymentsettings', 'support',
  ],

  LIBRARIAN: [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'paymentsettings', 'support',
  ],

  TRANSPORT_MANAGER: [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'paymentsettings', 'support',
  ],

  HOSTEL_ADMIN: [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'paymentsettings', 'support',
  ],

  WARDEN: [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'paymentsettings', 'support',
  ],

  SPORTS_ADMIN: [
    'dashboard', 'sports', 'paymentsettings', 'ptm', 'support',
  ],

  CUSTOM_SUB_ADMIN: [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions',
    'marksheets', 'quizzes', 'books', 'transport', 'hostel', 'backups',
    'paymentsettings', 'support',
  ],
};

// ---------------------------------------------------------------------------
// Router-guard helper (imported by App.tsx)
// ---------------------------------------------------------------------------

/**
 * Returns the full set of tab IDs allowed for the given role and plan.
 *
 * The router guard uses this: if `activeTab` is NOT in the returned set it
 * is reset to `'dashboard'`.  We return the superset so entitlement-locked
 * tabs (visible in the sidebar but behind a paywall) remain navigable — the
 * sidebar and portal components handle the actual access-control rendering.
 */
export const getAllowedTabsForRole = (role: string, planName: string): string[] => {
  const plan = (planName || 'freemium').toLowerCase();

  // Expired plan — very limited access regardless of role
  if (plan === 'expired') {
    return role === 'ADMIN'
      ? ['dashboard', 'subscriptions', 'support']
      : ['dashboard', 'support'];
  }

  const tabs = ROLE_TAB_IDS[role];
  if (tabs) return [...tabs];

  // Unknown / future role — permissive fallback (sidebar controls visibility)
  return [
    'dashboard', 'fees', 'analytics',
    'students', 'teachers', 'parents',
    'classes', 'subjects', 'academicsessions',
    'marksheets', 'quizzes', 'attendance', 'assignments',
    'books', 'transport', 'hostel', 'backups',
    'communications', 'rbac', 'sports', 'ptm',
    'paymentsettings', 'support',
  ];
};
