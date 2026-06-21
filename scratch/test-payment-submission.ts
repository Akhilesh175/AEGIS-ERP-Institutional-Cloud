import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Mock localStorage
const mockStorage: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (index: number) => Object.keys(mockStorage)[index] || null,
  length: 0
};

// Manual env loader
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

// Import mockApi and supabase after loading env variables
// Handled dynamically inside run() to ensure ESM hoisting does not execute imports before localStorage is mocked.

async function run() {
  const { mockApi } = await import('../src/services/mockApi');
  const { supabaseAdmin } = await import('../src/lib/supabase');

  console.log("=== STARTING INTEGRATION TESTS FOR SPORTS PAYMENT VALIDATIONS ===");

  const schoolId = '129f2529-9a8a-4d72-8641-d6b834a99a02';
  const studentId = '7b55f77a-0558-4355-96c8-6d22a1ad82ef';
  const parentId = '4e324127-ea8d-497c-b6b6-e21633d05637';
  const invoiceId = 'e60fdc3b-0c58-4170-8520-e9ab7fe69bc5'; // Annual Registration Fee

  // Test 1: Validate throwing error when invoiceId is missing
  try {
    console.log("Test 1: Submitting with missing invoice ID...");
    await mockApi.submitSportsFeePayment({
      schoolId,
      studentId,
      parentId,
      sportsFeeId: "" // missing
    });
    console.error("Test 1 FAILED: Expected error not thrown");
  } catch (err: any) {
    console.log("Test 1 PASSED: Successfully caught expected error:", err.message);
  }

  // Test 2: Validate throwing error when studentId is missing
  try {
    console.log("Test 2: Submitting with missing student ID...");
    await mockApi.submitSportsFeePayment({
      schoolId,
      studentId: "", // missing
      parentId,
      sportsFeeId: invoiceId
    });
    console.error("Test 2 FAILED: Expected error not thrown");
  } catch (err: any) {
    console.log("Test 2 PASSED: Successfully caught expected error:", err.message);
  }

  // Test 3: Validate throwing error when parentId is missing
  try {
    console.log("Test 3: Submitting with missing parent ID...");
    await mockApi.submitSportsFeePayment({
      schoolId,
      studentId,
      parentId: "", // missing
      sportsFeeId: invoiceId
    });
    console.error("Test 3 FAILED: Expected error not thrown");
  } catch (err: any) {
    console.log("Test 3 PASSED: Successfully caught expected error:", err.message);
  }

  // Test 4: Validate throwing error when schoolId is missing
  try {
    console.log("Test 4: Submitting with missing school ID...");
    await mockApi.submitSportsFeePayment({
      schoolId: "", // missing
      studentId,
      parentId,
      sportsFeeId: invoiceId
    });
    console.error("Test 4 FAILED: Expected error not thrown");
  } catch (err: any) {
    console.log("Test 4 PASSED: Successfully caught expected error:", err.message);
  }

  // Test 5: Clean up any existing verification payments to avoid conflicts
  console.log("Cleaning up existing payments for test student and fee...");
  await supabaseAdmin
    .from('sports_fee_payments')
    .delete()
    .eq('student_id', studentId)
    .eq('sports_fee_id', invoiceId);

  // Test 6: Submit a valid payment payload
  console.log("Test 6: Submitting valid payment payload...");
  const paymentPayload = {
    schoolId,
    sportsFeeId: invoiceId,
    studentId,
    parentId,
    amountPaid: 500.00,
    paymentMethod: 'UPI',
    transactionId: 'txn_' + crypto.randomUUID().substring(0, 8),
    utrNumber: 'utr_' + crypto.randomUUID().substring(0, 8),
    paymentScreenshotUrl: 'https://imgur.com/verify-screenshot.jpg'
  };

  const result = await mockApi.submitSportsFeePayment(paymentPayload);
  console.log("Successfully submitted sports payment! Supabase returned data:", result);

  if (result && result.id) {
    console.log("Test 6 PASSED: Generated Payment record ID:", result.id);

    // Test 7: Verify row exists in Supabase table
    console.log("Test 7: Verifying row exists in Supabase...");
    const { data: verifiedRow, error: verifyErr } = await supabaseAdmin
      .from('sports_fee_payments')
      .select('*')
      .eq('id', result.id)
      .single();
    
    if (verifyErr || !verifiedRow) {
      console.error("Test 7 FAILED: Verification query failed:", verifyErr?.message);
    } else {
      console.log("Test 7 PASSED: Row verified successfully! Database Status:", verifiedRow.status);
    }

    // Clean up test payment at the end
    console.log("Cleaning up created test payment record...");
    await supabaseAdmin.from('sports_fee_payments').delete().eq('id', result.id);
    console.log("Cleanup complete.");
  } else {
    console.error("Test 6 FAILED: Mock API did not return valid record");
  }

  console.log("=== INTEGRATION TESTS COMPLETED ===");
}

run().catch(err => {
  console.error("Execution failed:", err);
  process.exit(1);
});
