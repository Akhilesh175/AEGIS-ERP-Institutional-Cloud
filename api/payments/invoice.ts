/**
 * GET /api/payments/invoice
 *
 * Fetch invoice data for a specific payment.
 * Query params:
 *  - paymentId: UUID
 *  OR
 *  - invoiceNumber: string (e.g. AEGIS-INV-12345678)
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

  const { paymentId, invoiceNumber, schoolId } = req.query;

  if (!paymentId && !invoiceNumber) {
    return res.status(400).json({ error: 'paymentId or invoiceNumber is required' });
  }

  try {
    let query = supabaseAdmin
      .from('subscription_invoices')
      .select(`
        id,
        school_id,
        payment_id,
        invoice_number,
        amount,
        discount_amount,
        gst_amount,
        tax_amount,
        total_amount,
        final_paid,
        status,
        billing_email,
        billing_address,
        plan_code,
        billing_cycle,
        created_at,
        metadata,
        schools!school_id (name, email)
      `);

    if (paymentId) {
      query = query.eq('payment_id', paymentId);
    } else {
      query = query.eq('invoice_number', invoiceNumber);
    }

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }

    const { data: invoice, error } = await query.maybeSingle();

    if (error) {
      console.error('[invoice] Query error:', error.message);
      return res.status(500).json({ error: 'Failed to fetch invoice' });
    }

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    return res.status(200).json({ success: true, invoice });

  } catch (err: any) {
    console.error('[invoice] Error:', err?.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
