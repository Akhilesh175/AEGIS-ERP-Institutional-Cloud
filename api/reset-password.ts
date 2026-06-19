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

  const { email, otpId, newPassword } = req.body;
  if (!email || typeof email !== 'string' || !otpId || typeof otpId !== 'string' || !newPassword || typeof newPassword !== 'string') {
    return res.status(400).json({ error: 'Email, OTP session ID, and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  try {
    // 1. Fetch user ID for verification
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!user) {
      return res.status(400).json({ error: 'Invalid password reset session.' });
    }

    // 2. Fetch and validate the verified OTP session
    const { data: otpSession, error: selectError } = await supabaseAdmin
      .from('password_reset_otps')
      .select('*')
      .eq('id', otpId)
      .eq('email', normalizedEmail)
      .eq('verified', true)
      .maybeSingle();

    if (selectError) {
      console.error('Error fetching OTP session:', selectError.message);
      return res.status(500).json({ error: 'Security database lookup failed' });
    }

    if (!otpSession) {
      await supabaseAdmin.from('password_reset_logs').insert({
        user_id: user.id,
        email: normalizedEmail,
        action: 'PASSWORD_RESET_UNAUTHORIZED',
        ip_address: ipAddress
      });
      return res.status(400).json({ error: 'Unauthorized. Verification session not found or not completed.' });
    }

    // Enforce 15 minutes window from OTP verification/creation
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60000);
    const otpCreatedTime = new Date(otpSession.created_at);
    if (otpCreatedTime < fifteenMinutesAgo) {
      return res.status(400).json({ error: 'Security session expired. Please request a new OTP.' });
    }

    // 3. Update password in Supabase Auth (hashes automatically)
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(otpSession.user_id, {
      password: newPassword
    });

    if (authError) {
      console.error('Supabase Auth password update failed:', authError.message);
      return res.status(500).json({ error: 'Failed to securely update authorization credentials: ' + authError.message });
    }

    // 4. Log reset success and role_changes
    await supabaseAdmin.from('password_reset_logs').insert({
      user_id: user.id,
      email: normalizedEmail,
      action: 'PASSWORD_RESET_SUCCESS',
      ip_address: ipAddress
    });

    const { data: userProfile } = await supabaseAdmin.from('users').select('school_id').eq('id', user.id).single();
    await supabaseAdmin.from('role_changes').insert({
      event_type: 'PASSWORD_RESET',
      user_id: user.id,
      school_id: userProfile?.school_id || null,
      old_value: 'PASSWORD_RESET_FLOW',
      new_value: 'SUCCESS',
      changed_by: user.id,
      ip_address: ipAddress || '127.0.0.1',
      device_id: 'api'
    });

    // 5. Invalidate the OTP session entirely to prevent replay attacks
    const { error: deleteError } = await supabaseAdmin
      .from('password_reset_otps')
      .delete()
      .eq('id', otpId);

    if (deleteError) {
      console.error('Warning: Failed to delete verification token:', deleteError.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now login with your new password.'
    });
  } catch (err: any) {
    console.error('Unhandled reset-password error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
