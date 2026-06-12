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
    // 1. Verify if school email is already registered
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Email address is already registered in the ERP platform' });
    }

    // 2. Generate secure 6-digit OTP code
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60000).toISOString(); // 10 minutes expiry

    // 3. Store OTP verification record
    const { error: insertError } = await supabaseAdmin
      .from('otp_verifications')
      .insert({
        email: normalizedEmail,
        otp_code: otpCode,
        purpose: 'SCHOOL_REGISTRATION',
        expires_at: expiresAt,
        attempt_count: 0,
        verified: false
      });

    if (insertError) {
      console.error('Error saving OTP verification:', insertError.message);
      return res.status(500).json({ error: 'Failed to initiate verification session' });
    }

    // 4. Send email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'onboarding@resend.dev';

    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not configured');
      return res.status(500).json({ error: 'Email delivery service is currently offline' });
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Aegis ERP Email Verification</title>
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
          .meta { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 class="logo">AEGIS <span>ERP</span></h1>
          </div>
          <div class="content">
            <h2>School Self-Registration Verification</h2>
            <p>Thank you for choosing Aegis ERP Institutional Cloud. Please verify your school administrator email address using the following 6-digit OTP code:</p>
            
            <div class="otp-card">
              <h3 class="otp-code">${otpCode}</h3>
            </div>
            
            <p><strong>Security Notice:</strong> This code is valid for exactly <strong>10 minutes</strong>. Do not share this code with anyone. Aegis support team will never request this code from you.</p>
            <p>If you did not initiate this registration, you can safely ignore this email.</p>
            
            <div class="meta">
              This is an automated verification notification from Aegis ERP.<br>
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
        subject: 'Verify Your School Email: ' + otpCode,
        html: emailHtml
      })
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('Resend API call failed:', errText);
      return res.status(500).json({ error: 'Failed to deliver OTP verification email' });
    }

    return res.status(200).json({ success: true, message: 'Verification OTP sent successfully.' });
  } catch (err: any) {
    console.error('Unhandled register-school error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
