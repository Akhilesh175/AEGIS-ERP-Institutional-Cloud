import createPayment from './_lib/payments/create-payment.js';
import verifyPayment from './_lib/payments/verify-payment.js';
import history from './_lib/payments/history.js';
import invoice from './_lib/payments/invoice.js';
import refund from './_lib/payments/refund.js';
import webhook from './_lib/payments/webhook.js';


export default async function handler(req: any, res: any) {
  try {
    const action = req.query.action || req.body?.action;

    switch (action) {
      case 'create-payment':
        return await createPayment(req, res);
      case 'verify-payment':
        return await verifyPayment(req, res);
      case 'history':
        return await history(req, res);
      case 'invoice':
        return await invoice(req, res);
      case 'refund':
        return await refund(req, res);
      case 'webhook':
        return await webhook(req, res);
      default:
        return res.status(400).json({ success: false, error: `Invalid payments action: ${action}` });
    }
  } catch (err: any) {
    console.error('[payments-router] Unhandled exception:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err?.message || 'An unexpected error occurred on the server',
      code: 'UNHANDLED_EXCEPTION'
    });
  }
}
