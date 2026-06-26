import requestOtp from './_lib/auth/request-otp.js';
import verifyOtp from './_lib/auth/verify-otp.js';
import resetPassword from './_lib/auth/reset-password.js';
import changePassword from './_lib/auth/change-password.js';


export default async function handler(req: any, res: any) {
  try {
    const action = req.query.action || req.body?.action;

    switch (action) {
      case 'request-otp':
        return await requestOtp(req, res);
      case 'verify-otp':
        return await verifyOtp(req, res);
      case 'reset-password':
        return await resetPassword(req, res);
      case 'change-password':
        return await changePassword(req, res);
      default:
        return res.status(400).json({ success: false, error: `Invalid auth action: ${action}` });
    }
  } catch (err: any) {
    console.error('[auth-router] Unhandled exception:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: err?.message || 'An unexpected error occurred on the server',
      code: 'UNHANDLED_EXCEPTION'
    });
  }
}
