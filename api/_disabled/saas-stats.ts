import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  try {
    // 1. Fetch total, active and expired counts from schools & subscriptions
    const { data: schoolsList } = await supabaseAdmin
      .from('schools')
      .select('id, name, created_at, subscription_plan');

    const totalSchools = schoolsList?.length || 0;

    const { data: subscriptionsList } = await supabaseAdmin
      .from('subscriptions')
      .select('school_id, status, plan_code, expiry_date');

    const activeSchools = subscriptionsList?.filter(s => s.status === 'ACTIVE' || s.status === 'TRIAL').length || 0;
    const expiredSchools = subscriptionsList?.filter(s => s.status === 'EXPIRED').length || 0;

    // 2. Fetch payments for revenue metrics
    const { data: paymentsList } = await supabaseAdmin
      .from('payments')
      .select('amount, status, created_at')
      .eq('status', 'SUCCESS');

    const totalRevenue = paymentsList?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // Calculate current month revenue
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfMonthIso = startOfMonth.toISOString();
    
    const monthlyRevenue = paymentsList
      ?.filter(p => p.created_at >= startOfMonthIso)
      .reduce((sum, p) => sum + Number(p.amount), 0) || 0;

    // 3. Plan Distribution calculation
    const planCounts: Record<string, number> = {
      basic: 0,
      standard: 0,
      premium: 0,
      enterprise: 0
    };
    
    subscriptionsList?.forEach(sub => {
      const code = sub.plan_code.toLowerCase();
      if (planCounts[code] !== undefined) {
        planCounts[code]++;
      }
    });

    const planDistribution = Object.keys(planCounts).map(planKey => ({
      name: planKey.charAt(0).toUpperCase() + planKey.slice(1),
      count: planCounts[planKey],
      percentage: totalSchools > 0 ? Math.round((planCounts[planKey] / totalSchools) * 100) : 0
    }));

    // 4. Expiry alerts (expiring in next 7 days)
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysFromNowStr = sevenDaysFromNow.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];

    const expiryAlerts = subscriptionsList
      ?.filter(s => s.expiry_date >= todayStr && s.expiry_date <= sevenDaysFromNowStr)
      .map(s => {
        const school = schoolsList?.find(sc => sc.id === s.school_id);
        return {
          schoolName: school?.name || 'Unknown School',
          planCode: s.plan_code,
          expiryDate: s.expiry_date
        };
      }) || [];

    // 5. Recent payments
    const { data: dbRecentPayments } = await supabaseAdmin
      .from('payments')
      .select('id, amount, created_at, status, school_id')
      .eq('status', 'SUCCESS')
      .order('created_at', { ascending: false })
      .limit(10);

    const recentPayments = dbRecentPayments?.map(p => {
      const school = schoolsList?.find(sc => sc.id === p.school_id);
      return {
        id: p.id,
        schoolName: school?.name || 'Unknown School',
        amount: p.amount,
        paymentDate: p.created_at
      };
    }) || [];

    // 6. Recent registrations
    const recentRegistrations = schoolsList
      ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 10)
      .map(s => ({
        id: s.id,
        schoolName: s.name,
        plan: s.subscription_plan || 'TRIAL',
        registeredAt: s.created_at
      })) || [];

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
        recentRegistrations
      }
    });
  } catch (err: any) {
    console.error('Unhandled saas-stats error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
