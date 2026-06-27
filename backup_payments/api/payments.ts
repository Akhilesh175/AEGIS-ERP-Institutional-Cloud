import createPayment from './_lib/payments/create-payment';
import verifyPayment from './_lib/payments/verify-payment';
import history from './_lib/payments/history';
import invoice from './_lib/payments/invoice';
import refund from './_lib/payments/refund';
import webhook from './_lib/payments/webhook';

export default async function handler(req: any, res: any) {
  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'create-payment':
      return createPayment(req, res);
    case 'verify-payment':
      return verifyPayment(req, res);
    case 'history':
      return history(req, res);
    case 'invoice':
      return invoice(req, res);
    case 'refund':
      return refund(req, res);
    case 'webhook':
      return webhook(req, res);
    default:
      return res.status(400).json({ error: `Invalid payments action: ${action}` });
  }
}
