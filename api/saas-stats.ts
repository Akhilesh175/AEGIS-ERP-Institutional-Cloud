/**
 * GET /api/saas-stats
 *
 * Super Admin SaaS platform statistics endpoint.
 * Returns real-time metrics: revenue, active schools, plan distribution,
 * expiry alerts, recent payments, and recent registrations.
 *
 * SOURCE OF TRUTH: subscriptions table (not schools.subscription_plan)
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Normalize legacy plan codes
function normalizePlan(raw: string): string {
  const lower = (raw || 'freemium').toLowerCase();
  if (lower === 'standard') return 'pro';
  if (lower === 'premium')  return 'enterprise';
  return lower;
}

export default async function handler(req: any, res: any) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', 'https://www.aegiserp.xyz');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  try {
    const todayStr          = new Date().toISOString().split('T')[0];
    const sevenDaysFromNow  = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr      = sevenDaysFromNow.toISOString().split('T')[0];

    // ── 1. Fetch schools (for names / count) ──────────────────────────────
    const { data: schoolsList, error: schoolsErr } = await supabaseAdmin
      .from('schools')
      .select('id, name, created_at, subscription_plan');

    if (schoolsErr) throw schoolsErr;
    const totalSchools = schoolsList?.length || 0;

    // ── 2. Fetch subscriptions (source of truth for plans) ────────────────
    // Fetch the latest non-PENDING subscription per school
    const { data: subsList, error: subsErr } = await supabaseAdmin
      .from('subscriptions')
      .select('school_id, plan_code, status, subscription_status, expiry_date, amount_paid, created_at')
      .not('status', 'eq', 'PENDING')
      .order('created_at', { ascending: false });

    if (subsErr) throw subsErr;

    // Build a map: schoolId → latest non-PENDING subscription
    const latestSubBySchool = new Map<string, any>();
    for (const sub of (subsList || [])) {
      if (!latestSubBySchool.has(sub.school_id)) {
        latestSubBySchool.set(sub.school_id, sub);
      }
    }

    // ── 3. Compute active / expired counts from subscriptions ─────────────
    let activeSchools  = 0;
    let expiredSchools = 0;

    for (const [, sub] of latestSubBySchool.entries()) {
      const isExpired = sub.status === 'EXPIRED' ||
        (sub.expiry_date && todayStr > sub.expiry_date);
      if (isExpired) {
        expiredSchools++;
      } else if (sub.status === 'ACTIVE' || sub.status === 'TRIAL') {
        activeSchools++;
      }
    }

    // ── 4. Plan distribution ──────────────────────────────────────────────
    const planCounts: Record<string, number> = {
      freemium: 0, basic: 0, pro: 0, enterprise: 0
    };

    // Count from the latest subscription per school
    for (const [, sub] of latestSubBySchool.entries()) {
      const code = normalizePlan(sub.plan_code || 'freemium');
      if (code in planCounts) {
        planCounts[code]++;
      } else {
        planCounts['freemium']++;
      }
    }
    // Schools with no subscription row at all → freemium
    const schoolsWithSub = new Set(latestSubBySchool.keys());
    for (const school of (schoolsList || [])) {
      if (!schoolsWithSub.has(school.id)) {
        planCounts['freemium']++;
      }
    }

    const planDistribution = Object.entries(planCounts).map(([key, count]) => ({
      name:       key.charAt(0).toUpperCase() + key.slice(1),
      count,
      percentage: totalSchools > 0 ? Math.round((count / totalSchools) * 100) : 0,
    }));

    // ── 5. Payments revenue ───────────────────────────────────────────────
    const { data: paymentsList } = await supabaseAdmin
      .from('payments')
      .select('amount, status, created_at')
      .eq('status', 'SUCCESS');

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthIso = startOfMonth.toISOString();

    const totalRevenue   = (paymentsList || []).reduce((sum, p) => sum + Number(p.amount), 0);
    const monthlyRevenue = (paymentsList || [])
      .filter(p => p.created_at >= startOfMonthIso)
      .reduce((sum, p) => sum + Number(p.amount), 0);

    // ── 6. Expiry alerts (next 7 days) ────────────────────────────────────
    const expiryAlerts = Array.from(latestSubBySchool.entries())
      .filter(([, sub]) =>
        sub.expiry_date &&
        sub.expiry_date >= todayStr &&
        sub.expiry_date <= sevenDaysStr &&
        sub.status === 'ACTIVE'
      )
      .map(([schoolId, sub]) => {
        const school = (schoolsList || []).find(s => s.id === schoolId);
        const expiryDate = new Date(sub.expiry_date);
        const today      = new Date(todayStr);
        const daysLeft   = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return {
          schoolId,
          schoolName: school?.name || 'Unknown School',
          planName:   normalizePlan(sub.plan_code || 'freemium'),
          expiryDate: sub.expiry_date,
          daysLeft,
        };
      })
      .sort((a, b) => a.daysLeft - b.daysLeft);

    // ── 7. Recent payments ────────────────────────────────────────────────
    const { data: dbRecentPayments } = await supabaseAdmin
      .from('payments')
      .select('id, amount, created_at, status, school_id, plan_code')
      .eq('status', 'SUCCESS')
      .order('created_at', { ascending: false })
      .limit(10);

    const recentPayments = (dbRecentPayments || []).map(p => {
      const school = (schoolsList || []).find(s => s.id === p.school_id);
      return {
        id:         p.id,
        schoolName: school?.name || 'Unknown School',
        planName:   normalizePlan(p.plan_code || 'freemium'),
        amount:     Number(p.amount),
        status:     p.status,
        createdAt:  p.created_at,
      };
    });

    // ── 8. Recent registrations ───────────────────────────────────────────
    const recentRegistrations = (schoolsList || [])
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(s => {
        const sub       = latestSubBySchool.get(s.id);
        const planCode  = sub ? normalizePlan(sub.plan_code) : normalizePlan(s.subscription_plan || 'freemium');
        return {
          id:              s.id,
          name:            s.name,
          email:           '',
          studentStrength: 0,
          plan:            planCode,
          createdAt:       s.created_at,
        };
      });

    return res.status(200).json({
      success: true,
      stats: {
        totalSchools,
        activeSchools,
        expiredSchools,
        totalRevenue,
        monthlyRevenue,
        planDistribution,
        expiryAlerts,
        recentPayments,
        recentRegistrations,
      },
    });

  } catch (err: any) {
    console.error('[saas-stats] Unhandled error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
