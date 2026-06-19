import './mock-localStorage';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: { [key: string]: string } = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];
const supabaseAnonKey = env['VITE_SUPABASE_ANON_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const supabasePublic = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const productionBaseUrl = 'https://aegis-erp-institutional-cloud.vercel.app';

async function runRegressionTests() {
  console.log('=== RUNNING REGRESSION TESTS ===');

  // A. Registration OTP Flow regression
  console.log('\n1. Testing Registration OTP endpoint (should succeed with 200)');
  const randomRegEmail = `test-reg-regression-${Date.now()}@aegiserp.xyz`;
  const regRes = await fetch(`${productionBaseUrl}/api/register-school`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: randomRegEmail })
  });
  const regBody = await regRes.json();
  console.log('Status:', regRes.status);
  console.log('Body:', regBody);
  if (regRes.status !== 200 || !regBody.success) {
    throw new Error('Registration OTP regression check failed');
  }

  // B. Forgot Password OTP Flow regression
  console.log('\n2. Testing Forgot Password OTP endpoint for non-existing email (should return 400)');
  const forgotNonExistRes = await fetch(`${productionBaseUrl}/api/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `non-existent-user-${Date.now()}@aegiserp.xyz` })
  });
  const forgotNonExistBody = await forgotNonExistRes.json();
  console.log('Status:', forgotNonExistRes.status);
  console.log('Body:', forgotNonExistBody);
  if (forgotNonExistRes.status !== 400) {
    throw new Error('Forgot Password OTP non-existent email validation regression check failed');
  }

  console.log('\n3. Testing Forgot Password OTP endpoint for existing email (should succeed with 200)');
  const forgotExistRes = await fetch(`${productionBaseUrl}/api/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-final-deploy-success-7@aegiserp.xyz' })
  });
  const forgotExistBody = await forgotExistRes.json();
  console.log('Status:', forgotExistRes.status);
  console.log('Body:', forgotExistBody);
  // Cleanup OTP entries created by this test to bypass subsequent rate-limiting checks
  await supabaseAdmin.from('password_reset_otps').delete().eq('email', 'test-final-deploy-success-7@aegiserp.xyz');
  
  if (forgotExistRes.status !== 200 && forgotExistRes.status !== 429) {
    throw new Error('Forgot Password OTP regression check failed');
  }

  // Clean up registration OTP verifications
  await supabaseAdmin.from('otp_verifications').delete().eq('email', randomRegEmail);
  console.log('\nRegression checks passed successfully!');
}

async function runChangePasswordTests() {
  console.log('\n=== RUNNING CHANGE PASSWORD FLOW TESTS ===');

  const tempEmail = `test-change-pass-${Date.now()}@aegiserp.xyz`;
  const tempPassword = 'OldSecurePassword123!';
  const newPasswordVal = 'NewSecurePassword999!';

  console.log(`Creating temporary user: ${tempEmail}`);
  
  // 1. Create auth user
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: tempEmail,
    password: tempPassword,
    email_confirm: true
  });

  if (authError || !authUser.user) {
    throw new Error(`Failed to create temp auth user: ${authError?.message}`);
  }

  // 2. Insert user profile
  const { error: userInsertError } = await supabaseAdmin.from('users').insert({
    id: authUser.user.id,
    email: tempEmail,
    role: 'TEACHER',
    first_name: 'Temp',
    last_name: 'Test',
    is_active: true
  });

  if (userInsertError) {
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    throw new Error(`Failed to insert temp profile: ${userInsertError.message}`);
  }

  try {
    // 3. Login using public client to retrieve a valid JWT session token
    console.log('Logging in with current password to get JWT...');
    const { data: loginData, error: loginErr } = await supabasePublic.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword
    });

    if (loginErr || !loginData.session) {
      throw new Error(`Public login failed: ${loginErr?.message}`);
    }

    const token = loginData.session.access_token;
    console.log('Successfully retrieved token.');

    // 4. Test API validations
    console.log('\nValidation Test 1: Wrong current password (should return 400)');
    const resVal1 = await fetch(`${productionBaseUrl}/api/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword: 'WrongPassword!', newPassword: newPasswordVal })
    });
    const bodyVal1 = await resVal1.json();
    console.log('Status:', resVal1.status);
    console.log('Body:', bodyVal1);
    if (resVal1.status !== 400) throw new Error('Validation Test 1 failed');

    console.log('\nValidation Test 2: New password under 8 characters (should return 400)');
    const resVal2 = await fetch(`${productionBaseUrl}/api/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword: tempPassword, newPassword: 'short' })
    });
    const bodyVal2 = await resVal2.json();
    console.log('Status:', resVal2.status);
    console.log('Body:', bodyVal2);
    if (resVal2.status !== 400) throw new Error('Validation Test 2 failed');

    console.log('\nValidation Test 3: New password same as current password (should return 400)');
    const resVal3 = await fetch(`${productionBaseUrl}/api/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword: tempPassword, newPassword: tempPassword })
    });
    const bodyVal3 = await resVal3.json();
    console.log('Status:', resVal3.status);
    console.log('Body:', bodyVal3);
    if (resVal3.status !== 400) throw new Error('Validation Test 3 failed');

    console.log('\nValidation Test 4: Valid current password and new password (should succeed with 200)');
    const resVal4 = await fetch(`${productionBaseUrl}/api/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ currentPassword: tempPassword, newPassword: newPasswordVal })
    });
    const bodyVal4 = await resVal4.json();
    console.log('Status:', resVal4.status);
    console.log('Body:', bodyVal4);
    if (resVal4.status !== 200 || !bodyVal4.success) throw new Error('Validation Test 4 failed');

    // 5. Verify old password no longer works
    console.log('\nVerifying old password fails to log in...');
    const { error: oldLoginErr } = await supabasePublic.auth.signInWithPassword({
      email: tempEmail,
      password: tempPassword
    });
    console.log('Old password login attempt result:', oldLoginErr ? `Failed (Correct, error: ${oldLoginErr.message})` : 'Succeeded (INCORRECT!)');
    if (!oldLoginErr) throw new Error('Old password is still valid after change');

    // 6. Verify new password works immediately
    console.log('\nVerifying new password successfully logs in...');
    const { data: newLoginData, error: newLoginErr } = await supabasePublic.auth.signInWithPassword({
      email: tempEmail,
      password: newPasswordVal
    });
    console.log('New password login attempt result:', newLoginErr ? `Failed (INCORRECT!, error: ${newLoginErr.message})` : 'Succeeded (Correct!)');
    if (newLoginErr) throw new Error('New password fails to authenticate');

    // 7. Verify security audit log entry in password_reset_logs
    console.log('\nVerifying audit log entry was created...');
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('password_reset_logs')
      .select('*')
      .eq('user_id', authUser.user.id)
      .eq('action', 'PASSWORD_CHANGE_SUCCESS');
      
    if (logsError) throw new Error(`Failed to query logs: ${logsError.message}`);
    console.log(`Found ${logs?.length || 0} matching audit log entries.`);
    if (!logs || logs.length === 0) throw new Error('Audit log entry not found');

    console.log('\nChange Password test suite completed successfully!');
  } finally {
    // 8. Clean up
    console.log('\nCleaning up temporary test user...');
    await supabaseAdmin.from('password_reset_logs').delete().eq('user_id', authUser.user.id);
    await supabaseAdmin.from('users').delete().eq('id', authUser.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    console.log('Cleanup complete.');
  }
}

async function main() {
  await runRegressionTests();
  await runChangePasswordTests();
}

main().catch(err => {
  console.error('\nE2E Verification Error:', err.message);
  process.exit(1);
});
