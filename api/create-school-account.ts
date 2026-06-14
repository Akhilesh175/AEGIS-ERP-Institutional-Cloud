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

  const {
    schoolName,
    schoolCode,
    email,
    phone,
    principalName,
    address,
    city,
    state,
    country,
    studentStrength,
    schoolType,
    password
  } = req.body;

  if (!schoolName || !email || !password) {
    return res.status(400).json({ error: 'School name, email and password are required' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const rawSchoolCode = schoolCode ? schoolCode.trim().toUpperCase() : 'SCH-' + Math.random().toString(36).substring(2, 8).toUpperCase();

  try {
    // 1. Validate that OTP is verified
    const { data: verifiedOtp } = await supabaseAdmin
      .from('otp_verifications')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('verified', true)
      .gt('expires_at', new Date(Date.now() - 30 * 60000).toISOString()) // must be verified within last 30 minutes
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!verifiedOtp) {
      return res.status(400).json({ error: 'Email verification is required before account provisioning' });
    }

    // 2. Double check if email is already taken
    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered in the platform' });
    }

    // 3. Create the School record
    const { data: school, error: schoolError } = await supabaseAdmin
      .from('schools')
      .insert({
        name: schoolName,
        address: address || '',
        phone: phone || '',
        subscription_plan: 'TRIAL',
        country: country || 'India',
        currency_code: 'INR',
        currency_symbol: '₹',
        timezone: 'Asia/Kolkata'
      })
      .select()
      .single();

    if (schoolError || !school) {
      console.error('Error creating school:', schoolError?.message);
      return res.status(500).json({ error: 'Failed to provision school registry record' });
    }

    // 4. Create the default academic session
    const { data: sessionData, error: sessionError } = await supabaseAdmin
      .from('academic_sessions')
      .insert({
        school_id: school.id,
        name: '2026-2027',
        start_date: '2026-04-01',
        end_date: '2027-03-31',
        is_current: true
      })
      .select()
      .single();

    if (sessionError) {
      console.error('Error creating default academic session:', sessionError.message);
    }

    // 5. Create user account in Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password: password,
      email_confirm: true,
      user_metadata: {
        firstName: principalName || 'Principal',
        lastName: 'Administrator',
        role: 'ADMIN'
      }
    });

    if (authError || !authUser.user) {
      console.error('Auth User creation failed:', authError?.message);
      // Clean up school if user creation fails
      await supabaseAdmin.from('schools').delete().eq('id', school.id);
      return res.status(500).json({ error: 'Failed to create security auth account: ' + authError?.message });
    }

    // 6. Insert into public.users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.user.id,
        email: normalizedEmail,
        role: 'ADMIN',
        first_name: principalName || 'Principal',
        last_name: 'Administrator',
        phone: phone || '',
        is_active: true,
        school_id: school.id,
        academic_session_id: sessionData?.id || null
      });

    if (userError) {
      console.error('Error inserting user:', userError.message);
      // Clean up Auth user and school
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
      await supabaseAdmin.from('schools').delete().eq('id', school.id);
      return res.status(500).json({ error: 'Failed to provision user profile: ' + userError.message });
    }

    // 7. Insert into public.school_admins table
    const { error: adminError } = await supabaseAdmin
      .from('school_admins')
      .insert({
        user_id: authUser.user.id,
        school_id: school.id,
        role_settings: 'FULL_ADMIN',
        status: 'ACTIVE',
        permissions: { all: true }
      });

    if (adminError) {
      console.error('Error creating school admin record:', adminError.message);
    }

    // 8. Create a default 14-day TRIAL subscription in public.subscriptions
    const expiryDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { error: subError } = await supabaseAdmin
      .from('subscriptions')
      .insert({
        school_id: school.id,
        plan_code: 'basic',
        status: 'TRIAL',
        billing_cycle: 'TRIAL',
        start_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate,
        trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      });

    if (subError) {
      console.error('Error creating default subscription:', subError.message);
    }

    // 9. Send welcome success email using Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    const supportEmail = process.env.SUPPORT_EMAIL || 'noreply@aegiserp.xyz';

    if (resendApiKey) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Welcome to Aegis ERP</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f5f7; margin: 0; padding: 20px; color: #1e293b; }
            .container { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
            .header { background: #070a13; padding: 30px; text-align: center; border-bottom: 3px solid #0ea0eb; }
            .logo { color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: 1px; margin: 0; }
            .logo span { color: #0ea0eb; font-weight: 400; }
            .content { padding: 40px 30px; }
            h2 { margin-top: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
            p { font-size: 14px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
            .cta-btn { display: inline-block; background: #0ea0eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; margin: 20px 0; }
            .meta { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 30px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 class="logo">AEGIS <span>ERP</span></h1>
            </div>
            <div class="content">
              <h2>Registration Completed Successfully!</h2>
              <p>Dear ${principalName || 'Principal'},</p>
              <p>Congratulations! Your school, <strong>${schoolName}</strong>, is now registered on Aegis ERP Institutional Cloud.</p>
              <p>We have activated a <strong>14-day free trial</strong> for your school using the Basic plan. You can start setting up student registries, class timetables, and fee structures immediately.</p>
              
              <div style="text-align: center;">
                <a href="https://aegis-erp-institutional-cloud.vercel.app" class="cta-btn">Access ERP Console</a>
              </div>
              
              <p>To upgrade your plan at any time and unlock features like Teacher Portal, Parent Portal, Hostel Hub, and Analytics, click on the "Subscriptions" module in your Administrator Console.</p>
              
              <div class="meta">
                Thank you for choosing Aegis ERP Institutional Cloud.<br>
                &copy; 2026 Aegis ERP. All rights reserved.
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: `Aegis ERP Welcome <${supportEmail}>`,
          to: [normalizedEmail],
          subject: 'Welcome to Aegis ERP! Account provisioned for ' + schoolName,
          html: emailHtml
        })
      });
    }

    return res.status(200).json({
      success: true,
      message: 'School account provisioned successfully.',
      schoolId: school.id,
      email: normalizedEmail
    });
  } catch (err: any) {
    console.error('Unhandled create-school-account error:', err);
    return res.status(500).json({ error: 'Internal server error occurred' });
  }
}
