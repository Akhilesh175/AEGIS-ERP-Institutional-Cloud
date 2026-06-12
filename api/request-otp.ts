import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  const { email } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    // 1. Prevent email enumeration: look up the user first
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, first_name, last_name')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error('Error looking up user:', userError.message);
      return res.status(500).json({ error: 'Database error occurred' });
    }

    // Standard obfuscated success message to prevent email enumeration
    const obfuscatedResponse = {
      success: true,
      message: 'If the email is registered, you will receive an OTP code shortly.'
    };

    if (!user) {
      // Return success but do nothing else (obfuscated response)
      return res.status(200).json(obfuscatedResponse);
    }

    // 2. Rate Limiting: Check if an OTP was requested for this email in the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentOtps } = await supabaseAdmin
      .from('password_reset_otps')
      .select('created_at')
      .eq('email', normalizedEmail)
      .gt('created_at', oneMinuteAgo);

    if (recentOtps && recentOtps.length > 0) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait 60 seconds between OTP requests.' });
    }

    // 3. Generate a secure random 6-digit OTP code
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 minutes from now

    // 4. Save the OTP to the database
    const { error: insertError } = await supabaseAdmin
      .from('password_reset_otps')
      .insert({
        user_id: user.id,
        email: normalizedEmail,
        otp_code: otpCode,
        expires_at: expiresAt,
        attempt_count: 0,
        verified: false
      });

    if (insertError) {
      console.error('Error saving OTP to DB:', insertError.message);
      return res.status(500).json({ error: 'Failed to initialize security session' });
    }

    // 5. Send OTP using Resend API
    const resendApiKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'onboarding@resend.dev';

    if (!resendApiKey) {
      console.error('RESEND_API_KEY environment variable is not configured');
      return res.status(500).json({ error: 'Email delivery service is currently unavailable' });
    }

    const recipientName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Valued User';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Aegis ERP Security Verification</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { background: #070a13; padding: 30px; text-align: center; border-bottom: 3px solid #0ea0eb; }
          .logo { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px; margin: 0; }
          .logo span { color: #0ea0eb; font-weight: 400; }
          .content { padding: 40px 30px; }
          h2 { margin-top: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
          p { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
          .otp-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; text-align: center; margin: 30px 0; }
          .otp-code { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0ea0eb; margin: 0; font-family: monospace; }
          .meta { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-t: 1px solid #f1f5f9; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">AEGIS <span>ERP</span></h1>
          </div>
          <div class="content">
            <h2>Security Verification Code</h2>
            <p>Dear ${recipientName},</p>
            <p>A request was made to reset the password for your Aegis ERP Institutional Cloud account. Please use the following single-use verification code (OTP) to complete authorization:</p>
            
            <div class="otp-card">
              <h3 class="otp-code">${otpCode}</h3>
            </div>
            
            <p><strong>Security Notice:</strong> This code is valid for exactly <strong>10 minutes</strong>. For your protection, do not share this code with anyone. Aegis support staff will never ask for your verification code.</p>
            <p>If you did not request this code, you can safely ignore this email. Your password will remain unchanged.</p>
            
            <div class="meta">
              This is an automated security notification from Aegis ERP Institutional Cloud.<br>
              &copy; 2026 Aegis ERP. All rights reserved.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: `Aegis ERP Security <${supportEmail}>`,
        to: [normalizedEmail],
        subject: 'Aegis Verification Code: ' + otpCode,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const resendErrText = await resendResponse.text();
      console.error('Resend API call failed:', resendErrText);
      return res.status(500).json({ error: 'Failed to deliver security verification email' });
    }

    return res.status(200).json(obfuscatedResponse);
  } catch (err: any) {
    console.error('Unhandled request-otp error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
