import requestOtp from './_lib/auth/request-otp';
import verifyOtp from './_lib/auth/verify-otp';
import resetPassword from './_lib/auth/reset-password';
import changePassword from './_lib/auth/change-password';

export default async function handler(req: any, res: any) {
  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'request-otp':
      return requestOtp(req, res);
    case 'verify-otp':
      return verifyOtp(req, res);
    case 'reset-password':
      return resetPassword(req, res);
    case 'change-password':
      return changePassword(req, res);
    default:
      return res.status(400).json({ error: `Invalid auth action: ${action}` });
  }
}
