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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const testEmail = 'test-rate-limit-check@aegiserp.xyz';
const validUserEmail = 'test-final-deploy-success-7@aegiserp.xyz';
const validUserId = '464e95e6-2c5b-40d4-849e-2d92ae017078';

async function testRegistrationHourlyLimit() {
  console.log('\n--- Testing Registration OTP Hourly Limit (5 requests/hour) ---');
  // Clean up
  await supabaseAdmin.from('otp_verifications').delete().eq('email', testEmail);

  // Insert 5 requests, 30 minutes ago
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const insertData = Array.from({ length: 5 }).map((_, idx) => ({
    email: testEmail,
    otp_code: `12345${idx}`,
    purpose: 'SCHOOL_REGISTRATION',
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    attempt_count: 0,
    verified: false,
    created_at: thirtyMinsAgo
  }));

  const { error: insErr } = await supabaseAdmin.from('otp_verifications').insert(insertData);
  if (insErr) {
    console.error('Failed to insert mock OTP verifications:', insErr.message);
    return;
  }
  console.log('Inserted 5 mock OTP verifications for hourly limit test.');

  // Call API
  const response = await fetch('https://aegis-erp-institutional-cloud.vercel.app/api/register-school', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });

  const body = await response.json();
  console.log(`Response Status: ${response.status}`);
  console.log('Response Body:', body);

  // Clean up
  await supabaseAdmin.from('otp_verifications').delete().eq('email', testEmail);
}

async function testRegistrationDailyLimit() {
  console.log('\n--- Testing Registration OTP Daily Limit (10 requests/24h) ---');
  // Clean up
  await supabaseAdmin.from('otp_verifications').delete().eq('email', testEmail);

  // Insert 10 requests, 12 hours ago
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const insertData = Array.from({ length: 10 }).map((_, idx) => ({
    email: testEmail,
    otp_code: `12345${idx}`,
    purpose: 'SCHOOL_REGISTRATION',
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    attempt_count: 0,
    verified: false,
    created_at: twelveHoursAgo
  }));

  const { error: insErr } = await supabaseAdmin.from('otp_verifications').insert(insertData);
  if (insErr) {
    console.error('Failed to insert mock OTP verifications:', insErr.message);
    return;
  }
  console.log('Inserted 10 mock OTP verifications for daily limit test.');

  // Call API
  const response = await fetch('https://aegis-erp-institutional-cloud.vercel.app/api/register-school', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail })
  });

  const body = await response.json();
  console.log(`Response Status: ${response.status}`);
  console.log('Response Body:', body);

  // Clean up
  await supabaseAdmin.from('otp_verifications').delete().eq('email', testEmail);
}

async function testResetHourlyLimit() {
  console.log('\n--- Testing Password Reset OTP Hourly Limit (5 requests/hour) ---');
  // Clean up
  await supabaseAdmin.from('password_reset_otps').delete().eq('email', validUserEmail);

  // Insert 5 requests, 30 minutes ago
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const insertData = Array.from({ length: 5 }).map((_, idx) => ({
    user_id: validUserId,
    email: validUserEmail,
    otp_code: `23456${idx}`,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    attempt_count: 0,
    verified: false,
    created_at: thirtyMinsAgo
  }));

  const { error: insErr } = await supabaseAdmin.from('password_reset_otps').insert(insertData);
  if (insErr) {
    console.error('Failed to insert mock reset OTPs:', insErr.message);
    return;
  }
  console.log('Inserted 5 mock reset OTPs for hourly limit test.');

  // Call API
  const response = await fetch('https://aegis-erp-institutional-cloud.vercel.app/api/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: validUserEmail })
  });

  const body = await response.json();
  console.log(`Response Status: ${response.status}`);
  console.log('Response Body:', body);

  // Clean up
  await supabaseAdmin.from('password_reset_otps').delete().eq('email', validUserEmail);
}

async function testResetDailyLimit() {
  console.log('\n--- Testing Password Reset OTP Daily Limit (10 requests/24h) ---');
  // Clean up
  await supabaseAdmin.from('password_reset_otps').delete().eq('email', validUserEmail);

  // Insert 10 requests, 12 hours ago
  const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
  const insertData = Array.from({ length: 10 }).map((_, idx) => ({
    user_id: validUserId,
    email: validUserEmail,
    otp_code: `23456${idx}`,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    attempt_count: 0,
    verified: false,
    created_at: twelveHoursAgo
  }));

  const { error: insErr } = await supabaseAdmin.from('password_reset_otps').insert(insertData);
  if (insErr) {
    console.error('Failed to insert mock reset OTPs:', insErr.message);
    return;
  }
  console.log('Inserted 10 mock reset OTPs for daily limit test.');

  // Call API
  const response = await fetch('https://aegis-erp-institutional-cloud.vercel.app/api/request-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: validUserEmail })
  });

  const body = await response.json();
  console.log(`Response Status: ${response.status}`);
  console.log('Response Body:', body);

  // Clean up
  await supabaseAdmin.from('password_reset_otps').delete().eq('email', validUserEmail);
}

async function main() {
  await testRegistrationHourlyLimit();
  await testRegistrationDailyLimit();
  await testResetHourlyLimit();
  await testResetDailyLimit();
}

main().catch(console.error);
