import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(455).json({ error: 'Method not allowed' });
  }

  // 1. Verify Authorization Token
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authentication credentials' });
  }

  const token = authHeader.substring(7);

  try {
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || !user.email) {
      return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    }

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || typeof currentPassword !== 'string') {
      return res.status(400).json({ error: 'Current password is required' });
    }

    if (!newPassword || typeof newPassword !== 'string') {
      return res.status(400).json({ error: 'New password is required' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ error: 'New password cannot be the same as your current password.' });
    }

    const ipAddress = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

    // 2. Validate current password via authentication attempt
    const { error: signInError } = await supabasePublic.auth.signInWithPassword({
      email: user.email,
      password: currentPassword
    });

    if (signInError) {
      return res.status(400).json({ error: 'Invalid current password. Please try again.' });
    }

    // 3. Update Password in Supabase Auth
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError.message);
      return res.status(500).json({ error: 'Failed to update credentials. Please try again.' });
    }

    // 4. Log successful change in password_reset_logs and role_changes
    const { error: logError } = await supabaseAdmin.from('password_reset_logs').insert({
      user_id: user.id,
      email: user.email,
      action: 'PASSWORD_CHANGE_SUCCESS',
      ip_address: ipAddress
    });

    const { data: userProfile } = await supabaseAdmin.from('users').select('school_id').eq('id', user.id).single();
    await supabaseAdmin.from('role_changes').insert({
      event_type: 'PASSWORD_RESET',
      user_id: user.id,
      school_id: userProfile?.school_id || null,
      old_value: 'PASSWORD_CHANGED',
      new_value: 'SUCCESS',
      changed_by: user.id,
      ip_address: ipAddress || '127.0.0.1',
      device_id: 'api'
    });

    if (logError) {
      console.error('Failed to record password change audit log:', logError.message);
    }

    // 5. Send confirmation email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'noreply@aegiserp.xyz';

    if (resendApiKey) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Aegis ERP Password Security Alert</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            .header { background: #070a13; padding: 30px; text-align: center; border-bottom: 3px solid #0ea0eb; }
            .logo-wrap { display: flex; align-items: center; justify-content: center; gap: 14px; }
            
            .content { padding: 40px 30px; }
            h2 { margin-top: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
            p { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
            .meta { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo-wrap">
              <img src="https://aegiserp.xyz/aegis-logo.png" alt="AEGIS ERP Institutional Cloud" width="52" height="52" style="object-fit:contain;display:block;" />
              <div style="text-align:left;">
                <p style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:1px;margin:0;">AEGIS <span style="color:#0ea0eb;font-weight:400;">ERP</span></p>
                <p style="color:#38bdf8;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;font-weight:600;margin:3px 0 0 0;">— Institutional Cloud —</p>
              </div>
            </div>
            </div>
            <div class="content">
              <h2>Password Changed Successfully</h2>
              <p>Hello,</p>
              <p>This email confirms that the password for your Aegis ERP account (<strong>${user.email}</strong>) was recently changed successfully.</p>
              <p>If you authorized this change, you do not need to take any action.</p>
              <p><strong>Warning:</strong> If you did not make this change, please contact your administrator or technical support immediately to secure your account.</p>
              
              <div class="meta">
                This is an automated security notification from Aegis ERP.<br>
                &copy; 2026 Aegis ERP. All rights reserved.
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      try {
        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: `Aegis ERP Security <${supportEmail}>`,
            to: [user.email],
            subject: 'Password Changed Successfully',
            html: emailHtml
          })
        });

        if (!resendResponse.ok) {
          console.error('Resend API call failed for password change notification:', await resendResponse.text());
        }
      } catch (err) {
        console.error('Failed to dispatch password change notification email:', err);
      }
    } else {
      console.warn('RESEND_API_KEY not configured. Skipping confirmation email.');
    }

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err: any) {
    console.error('Unhandled change-password error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
