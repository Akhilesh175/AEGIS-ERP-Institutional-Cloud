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
    // 1. Fetch user ID for logging and reference
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification session.' });
    }

    // Get IP address from headers
    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    // 2. Fetch the most recent active (unverified) OTP session for this email
    const { data: activeOtp, error: selectError } = await supabaseAdmin
      .from('password_reset_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (selectError) {
      console.error('Error fetching OTP session:', selectError.message);
      return res.status(500).json({ error: 'Internal security system failure' });
    }

    if (!activeOtp) {
      // Log the failed request to prevent brute-forcing
      await supabaseAdmin.from('password_reset_logs').insert({
        user_id: user.id,
        email: normalizedEmail,
        action: 'OTP_VERIFICATION_NOT_FOUND',
        ip_address: ipAddress
      });
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    // 3. Enforce maximum attempt rules (max 5)
    if (activeOtp.attempt_count >= 5) {
      await supabaseAdmin.from('password_reset_logs').insert({
        user_id: user.id,
        email: normalizedEmail,
        action: 'OTP_VERIFICATION_ATTEMPTS_EXCEEDED',
        ip_address: ipAddress
      });
      return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
    }

    // 4. Compare verification codes
    const isMatch = activeOtp.otp_code === cleanedOtp;
    const newAttemptCount = activeOtp.attempt_count + 1;

    if (isMatch) {
      // Success! Update OTP verified state and attempt count
      const { error: updateError } = await supabaseAdmin
        .from('password_reset_otps')
        .update({
          verified: true,
          attempt_count: newAttemptCount
        })
        .eq('id', activeOtp.id);

      if (updateError) {
        console.error('Error updating OTP state:', updateError.message);
        return res.status(500).json({ error: 'Failed to verify OTP' });
      }

      // Log success
      await supabaseAdmin.from('password_reset_logs').insert({
        user_id: user.id,
        email: normalizedEmail,
        action: 'OTP_VERIFICATION_SUCCESS',
        ip_address: ipAddress
      });

      return res.status(200).json({
        success: true,
        otpId: activeOtp.id,
        message: 'OTP verified successfully.'
      });
    } else {
      // Failure: Increment attempt counter
      const { error: updateError } = await supabaseAdmin
        .from('password_reset_otps')
        .update({
          attempt_count: newAttemptCount
        })
        .eq('id', activeOtp.id);

      if (updateError) {
        console.error('Error incrementing attempts:', updateError.message);
      }

      // Log failure
      await supabaseAdmin.from('password_reset_logs').insert({
        user_id: user.id,
        email: normalizedEmail,
        action: 'OTP_VERIFICATION_FAILED',
        ip_address: ipAddress
      });

      const remaining = 5 - newAttemptCount;
      if (remaining <= 0) {
        return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
      } else {
        return res.status(400).json({ error: `Invalid verification code. ${remaining} attempts remaining.` });
      }
    }
  } catch (err: any) {
    console.error('Unhandled verify-otp error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
