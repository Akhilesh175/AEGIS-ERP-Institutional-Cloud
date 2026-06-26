/**
 * POST /api/payments/webhook
 *
 * Razorpay Webhook Handler for AEGIS ERP Institutional Cloud.
 *
 * Handles all Razorpay webhook events with:
 *  - HMAC-SHA256 signature verification (using RAZORPAY_WEBHOOK_SECRET)
 *  - Event deduplication (event_id uniqueness in webhook_logs)
 *  - Idempotent processing (safe to replay)
 *  - Full payload storage in webhook_logs table
 *
 * Supported Events:
 *  - payment.authorized
 *  - payment.captured
 *  - payment.failed
 *  - payment.dispute.created
 *  - refund.processed
 *  - refund.failed
 *  - subscription.charged
 *  - subscription.paused
 *  - subscription.cancelled
 *  - subscription.completed
 *
 * Setup in Razorpay Dashboard:
 *   URL: https://www.aegiserp.xyz/api/payments/webhook
 *   Secret: value of RAZORPAY_WEBHOOK_SECRET env var
 */
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || '',
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export const config = { api: { bodyParser: false } };

async function getRawBody(req: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET not set');
    return res.status(500).json({ error: 'Webhook not configured' });
  }

  const ipAddress = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').toString().split(',')[0].trim();

  // Read raw body for signature verification
  let rawBody: Buffer;
  try {
    rawBody = await getRawBody(req);
  } catch (e) {
    return res.status(400).json({ error: 'Failed to read request body' });
  }

  // ── Signature verification ──────────────────────────────────────────
  const receivedSignature = req.headers['x-razorpay-signature'] as string;
  if (!receivedSignature) {
    return res.status(400).json({ error: 'Missing webhook signature' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  let signatureValid = false;
  try {
    signatureValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(receivedSignature)
    );
  } catch {
    signatureValid = false;
  }

  // Parse payload
  let payload: any;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const eventType  = payload.event  || 'unknown';
  const eventId    = payload.payload?.payment?.entity?.id
                   || payload.payload?.order?.entity?.id
                   || payload.payload?.refund?.entity?.id
                   || payload.id
                   || `evt_${Date.now()}`;

  const entityId   = payload.payload?.payment?.entity?.id
                   || payload.payload?.refund?.entity?.id
                   || payload.payload?.order?.entity?.id;

  // ── Deduplication check ─────────────────────────────────────────────
  if (signatureValid) {
    const { data: existing } = await supabaseAdmin
      .from('webhook_logs')
      .select('id, processing_status')
      .eq('event_id', eventId)
      .eq('processing_status', 'processed')
      .maybeSingle();

    if (existing) {
      console.log(`[webhook] Duplicate event ${eventId} — ignoring`);
      return res.status(200).json({ received: true, duplicate: true });
    }
  }

  // ── Store webhook in DB ─────────────────────────────────────────────
  const { data: logEntry } = await supabaseAdmin
    .from('webhook_logs')
    .insert({
      event_id:          signatureValid ? eventId : null,
      event_type:        eventType,
      entity_id:         entityId,
      payload:           payload,
      signature_valid:   signatureValid,
      processing_status: signatureValid ? 'received' : 'failed',
      processing_error:  signatureValid ? null : 'Invalid signature',
      ip_address:        ipAddress,
    })
    .select('id')
    .single();

  if (!signatureValid) {
    console.warn('[webhook] Invalid signature from', ipAddress);
    // Still return 200 to prevent Razorpay retries on bad events
    return res.status(200).json({ received: true });
  }

  // ── Process event ───────────────────────────────────────────────────
  const logId = logEntry?.id;
  try {
    await processWebhookEvent(eventType, payload);

    if (logId) {
      await supabaseAdmin.from('webhook_logs').update({
        processing_status: 'processed',
        processed_at:      new Date().toISOString(),
      }).eq('id', logId);
    }
  } catch (processErr: any) {
    console.error('[webhook] Processing error:', processErr?.message);
    if (logId) {
      await supabaseAdmin.from('webhook_logs').update({
        processing_status: 'failed',
        processing_error:  processErr?.message || 'Unknown error',
      }).eq('id', logId);
    }
    // Still return 200 so Razorpay doesn't keep retrying
    return res.status(200).json({ received: true });
  }

  return res.status(200).json({ received: true });
}

// ─── Event processor ──────────────────────────────────────────────────────────

async function processWebhookEvent(eventType: string, payload: any) {
  const now = new Date().toISOString();

  switch (eventType) {

    case 'payment.authorized': {
      const payment = payload.payload?.payment?.entity;
      if (!payment) break;
      console.log(`[webhook] payment.authorized: ${payment.id}`);

      await supabaseAdmin.from('payment_transactions').update({
        status:             'AUTHORIZED',
        gateway_payment_id: payment.id,
        updated_at:         now,
      }).eq('gateway_order_id', payment.order_id);

      await supabaseAdmin.from('payment_orders').update({
        status:     'attempted',
        updated_at: now,
      }).eq('razorpay_order_id', payment.order_id);
      break;
    }

    case 'payment.captured': {
      const payment = payload.payload?.payment?.entity;
      if (!payment) break;
      console.log(`[webhook] payment.captured: ${payment.id}`);

      // Find our internal payment record
      const { data: txn } = await supabaseAdmin
        .from('payment_transactions')
        .select('payment_id')
        .eq('gateway_order_id', payment.order_id)
        .maybeSingle();

      if (txn?.payment_id) {
        await supabaseAdmin.from('payments').update({
          razorpay_payment_id: payment.id,
          status:              'SUCCESS',
          updated_at:          now,
        }).eq('id', txn.payment_id).neq('status', 'SUCCESS');

        await supabaseAdmin.from('payment_audit_logs').insert({
          payment_id:          txn.payment_id,
          event_type:          'PAYMENT_CAPTURED',
          action:              'WEBHOOK_PAYMENT_CAPTURED',
          razorpay_payment_id: payment.id,
          razorpay_order_id:   payment.order_id,
          amount:              payment.amount / 100,
          performed_at:        now,
        });
      }

      await supabaseAdmin.from('payment_orders').update({
        status:     'paid',
        updated_at: now,
      }).eq('razorpay_order_id', payment.order_id);
      break;
    }

    case 'payment.failed': {
      const payment = payload.payload?.payment?.entity;
      if (!payment) break;
      console.warn(`[webhook] payment.failed: ${payment.id}`);

      // Find our internal record
      const { data: txn } = await supabaseAdmin
        .from('payment_transactions')
        .select('payment_id, raw_response')
        .eq('gateway_order_id', payment.order_id)
        .maybeSingle();

      const schoolId = txn
        ? (await supabaseAdmin.from('payments').select('school_id').eq('id', txn.payment_id).maybeSingle())?.data?.school_id
        : null;

      await supabaseAdmin.from('payment_failures').insert({
        school_id:           schoolId,
        payment_id:          txn?.payment_id || null,
        razorpay_payment_id: payment.id,
        razorpay_order_id:   payment.order_id,
        error_code:          payment.error_code,
        error_description:   payment.error_description,
        error_reason:        payment.error_reason,
        error_source:        payment.error_source,
        error_step:          payment.error_step,
        amount:              payment.amount / 100,
        error_metadata:      payment,
      });

      if (txn?.payment_id) {
        await supabaseAdmin.from('payments').update({
          status:         'FAILED',
          failure_reason: payment.error_description,
          updated_at:     now,
        }).eq('id', txn.payment_id).neq('status', 'SUCCESS');
      }

      await supabaseAdmin.from('payment_orders').update({
        status:     'failed',
        updated_at: now,
      }).eq('razorpay_order_id', payment.order_id);
      break;
    }

    case 'payment.dispute.created': {
      const dispute = payload.payload?.dispute?.entity;
      console.warn(`[webhook] payment.dispute.created: ${dispute?.id}`);
      // Log it — disputes need manual review
      await supabaseAdmin.from('audit_logs').insert({
        action_type: 'PAYMENT_DISPUTE_CREATED',
        module_name: 'BILLING',
        new_data:    { disputeId: dispute?.id, paymentId: dispute?.payment_id, amount: dispute?.amount },
      });
      break;
    }

    case 'refund.processed': {
      const refund = payload.payload?.refund?.entity;
      if (!refund) break;
      console.log(`[webhook] refund.processed: ${refund.id}`);

      await supabaseAdmin.from('refunds').update({
        status:            'processed',
        processed_at:      now,
        razorpay_refund_id: refund.id,
        raw_response:      refund,
        updated_at:        now,
      }).eq('razorpay_payment_id', refund.payment_id);

      await supabaseAdmin.from('payments').update({
        is_refunded:    true,
        refunded_amount: refund.amount / 100,
        updated_at:     now,
      }).eq('razorpay_payment_id', refund.payment_id);
      break;
    }

    case 'refund.failed': {
      const refund = payload.payload?.refund?.entity;
      if (!refund) break;
      console.error(`[webhook] refund.failed: ${refund.id}`);

      await supabaseAdmin.from('refunds').update({
        status:      'failed',
        raw_response: refund,
        updated_at:  now,
      }).eq('razorpay_payment_id', refund.payment_id);
      break;
    }

    case 'subscription.charged': {
      const sub = payload.payload?.subscription?.entity;
      console.log(`[webhook] subscription.charged: ${sub?.id}`);
      break;
    }

    case 'subscription.paused':
    case 'subscription.cancelled':
    case 'subscription.completed': {
      const sub = payload.payload?.subscription?.entity;
      console.log(`[webhook] ${eventType}: ${sub?.id}`);
      break;
    }

    default: {
      console.log(`[webhook] Unhandled event: ${eventType}`);
    }
  }
}
