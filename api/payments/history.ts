/**
 * GET /api/payments/history
 *
 * Returns paginated payment history for a school.
 * Query params:
 *  - schoolId: UUID (required)
 *  - page: number (default 1)
 *  - limit: number (default 20, max 100)
 *  - status: filter by payment status
 */
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { schoolId, page = '1', limit = '20', status } = req.query;

  if (!schoolId) {
    return res.status(400).json({ error: 'schoolId is required' });
  }

  const pageNum  = Math.max(1, parseInt(page as string, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
  const offset   = (pageNum - 1) * limitNum;

  try {
    let query = supabaseAdmin
      .from('payments')
      .select(`
        id,
        school_id,
        subscription_id,
        razorpay_order_id,
        razorpay_payment_id,
        amount,
        currency,
        original_amount,
        discount_amount,
        gst_amount,
        coupon_code,
        plan_code,
        billing_cycle,
        payment_method,
        status,
        receipt_number,
        invoice_number,
        is_refunded,
        refunded_amount,
        failure_reason,
        created_at,
        updated_at
      `, { count: 'exact' })
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (status) {
      query = query.eq('status', status.toString().toUpperCase());
    }

    const { data: payments, count, error } = await query;

    if (error) {
      console.error('[payment-history] Query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch payment history' });
    }

    return res.status(200).json({
      success:    true,
      payments:   payments || [],
      pagination: {
        page:        pageNum,
        limit:       limitNum,
        total:       count || 0,
        totalPages:  Math.ceil((count || 0) / limitNum),
        hasMore:     (offset + limitNum) < (count || 0),
      },
    });

  } catch (err: any) {
    console.error('[payment-history] Error:', err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
