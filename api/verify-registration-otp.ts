import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  const { email, otpCode } = req.body;
  if (!email || typeof email !== 'string' || !otpCode || typeof otpCode !== 'string') {
    return res.status(400).json({ error: 'Email and OTP verification code are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const cleanedOtp = otpCode.trim();

  try {
    // 1. Fetch the most recent active OTP for this email
    const { data: activeOtp, error: selectError } = await supabaseAdmin
      .from('otp_verifications')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('Error fetching OTP session:', selectError.message);
      return res.status(500).json({ error: 'Security database lookup failed' });
    }

    if (!activeOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // 2. Enforce attempt limit (max 5)
    if (activeOtp.attempt_count >= 5) {
      return res.status(400).json({ error: 'Too many verification attempts. Please request a new OTP.' });
    }

    const isMatch = activeOtp.otp_code === cleanedOtp;
    const newAttemptCount = activeOtp.attempt_count + 1;

    if (isMatch) {
      // Mark as verified
      const { error: updateError } = await supabaseAdmin
        .from('otp_verifications')
        .update({
          verified: true,
          attempt_count: newAttemptCount
        })
        .eq('id', activeOtp.id);

      if (updateError) {
        console.error('Error updating OTP status:', updateError.message);
        return res.status(500).json({ error: 'Failed to verify verification session' });
      }

      return res.status(200).json({ success: true, message: 'Email verified successfully.' });
    } else {
      // Increment attempt count
      const { error: updateError } = await supabaseAdmin
        .from('otp_verifications')
        .update({
          attempt_count: newAttemptCount
        })
        .eq('id', activeOtp.id);

      if (updateError) {
        console.error('Error incrementing attempts:', updateError.message);
      }

      const remaining = 5 - newAttemptCount;
      if (remaining <= 0) {
        return res.status(400).json({ error: 'Too many verification attempts. Please request a new OTP.' });
      } else {
        return res.status(400).json({ error: `Invalid verification code. ${remaining} attempts remaining.` });
      }
    }
  } catch (err: any) {
    console.error('Unhandled verify-registration-otp error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
