import registerSchool from './_lib/registration/register-school';
import verifyRegistrationOtp from './_lib/registration/verify-registration-otp';
import createSchoolAccount from './_lib/registration/create-school-account';

export default async function handler(req: any, res: any) {
  const action = req.query.action || req.body?.action;

  switch (action) {
    case 'register-school':
      return registerSchool(req, res);
    case 'verify-registration-otp':
      return verifyRegistrationOtp(req, res);
    case 'create-school-account':
      return createSchoolAccount(req, res);
    default:
      return res.status(400).json({ error: `Invalid registration action: ${action}` });
  }
}
