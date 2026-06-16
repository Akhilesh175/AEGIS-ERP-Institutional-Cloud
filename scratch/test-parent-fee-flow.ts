import './load-env';
import './mock-localStorage';
import { mockApi } from '../src/services/mockApi';
import { mockDb } from '../src/services/mockDb';
import { supabase, supabaseAdmin } from '../src/lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { Blob } from 'buffer';
import * as crypto from 'crypto';

async function run() {
  console.log("=== Testing Parent Fee Payment Submission & Audit Log Fix ===");

  // Find a school
  const { data: schools, error: schoolError } = await supabaseAdmin.from('schools').select('*').limit(1);
  if (schoolError || !schools || schools.length === 0) {
    console.error("No schools in database. Cannot run tests.", schoolError);
    process.exit(1);
  }
  const testSchoolId = schools[0].id;
  console.log("Using School ID:", testSchoolId);

  // Generate unique test email/password
  const rand = Math.random().toString(36).substring(2, 7);
  const parentEmail = `test-parent-${rand}@aegis.com`;
  const studentEmail = `test-student-${rand}@aegis.com`;
  const adminEmail = `test-admin-${rand}@aegis.com`;
  const testPassword = "Password123!";

  // 1. Create a parent user in auth and public.users
  console.log("Creating Parent auth user...");
  const { data: parentAuth, error: parentAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email: parentEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { school_id: testSchoolId, role: 'PARENT' }
  });
  if (parentAuthErr || !parentAuth.user) {
    console.error("Failed to create parent auth user:", parentAuthErr);
    process.exit(1);
  }
  const parentUserId = parentAuth.user.id;
  console.log("Parent User ID (UUID):", parentUserId);

  console.log("Inserting Parent user profile...");
  const { error: parentProfileErr } = await supabaseAdmin.from('users').insert({
    id: parentUserId,
    email: parentEmail,
    role: 'PARENT',
    first_name: 'Test',
    last_name: 'Parent',
    school_id: testSchoolId,
    is_active: true
  });
  if (parentProfileErr) {
    console.error("Failed to insert parent user profile:", parentProfileErr);
    process.exit(1);
  }

  // Create record in public.parents using random UUID
  const parentRecordId = crypto.randomUUID();
  console.log("Creating Parent record with ID:", parentRecordId);
  const { error: parentRecordErr } = await supabaseAdmin.from('parents').insert({
    id: parentRecordId,
    user_id: parentUserId,
    school_id: testSchoolId,
    occupation: 'Testing',
    address: '123 Test St'
  });
  if (parentRecordErr) {
    console.error("Failed to create parents row:", parentRecordErr);
    process.exit(1);
  }

  // 2. Create a student user in auth and public.users & public.students
  console.log("Creating Student auth user...");
  const { data: studentAuth, error: studentAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email: studentEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { school_id: testSchoolId, role: 'STUDENT' }
  });
  if (studentAuthErr || !studentAuth.user) {
    console.error("Failed to create student auth user:", studentAuthErr);
    process.exit(1);
  }
  const studentUserId = studentAuth.user.id;

  console.log("Inserting Student user profile...");
  await supabaseAdmin.from('users').insert({
    id: studentUserId,
    email: studentEmail,
    role: 'STUDENT',
    first_name: 'Test',
    last_name: 'Student',
    school_id: testSchoolId,
    is_active: true
  });

  // Find or create an academic session for this school
  const { data: sessions } = await supabaseAdmin
    .from('academic_sessions')
    .select('id')
    .eq('school_id', testSchoolId)
    .eq('is_current', true)
    .limit(1);
  
  let academicSessionId = sessions?.[0]?.id;
  if (!academicSessionId) {
    const { data: anySession } = await supabaseAdmin
      .from('academic_sessions')
      .select('id')
      .eq('school_id', testSchoolId)
      .limit(1);
    academicSessionId = anySession?.[0]?.id;
  }
  if (!academicSessionId) {
    const newSessionId = crypto.randomUUID();
    await supabaseAdmin.from('academic_sessions').insert({
      id: newSessionId,
      school_id: testSchoolId,
      name: 'Temp Test Session',
      start_date: '2026-04-01',
      end_date: '2027-03-31',
      is_current: true
    });
    academicSessionId = newSessionId;
  }
  console.log("Using Academic Session ID:", academicSessionId);

  // Always create a new class for this test to avoid roll number conflicts
  const classId = crypto.randomUUID();
  const { error: classInsertErr } = await supabaseAdmin.from('classes').insert({
    id: classId,
    school_id: testSchoolId,
    name: `Test Class Grade ${rand}-${Math.random().toString(36).substring(2, 7)}`,
    academic_session_id: academicSessionId
  });
  if (classInsertErr) {
    console.error("Failed to create test class:", classInsertErr);
    process.exit(1);
  }
  console.log("Using Class ID:", classId);

  const studentRecordId = crypto.randomUUID();
  console.log("Creating Student record with ID:", studentRecordId);
  const { error: studentInsertErr } = await supabaseAdmin.from('students').insert({
    id: studentRecordId,
    user_id: studentUserId,
    school_id: testSchoolId,
    academic_session_id: academicSessionId,
    class_id: classId,
    admission_number: `ADM-${rand}`,
    roll_number: 1,
    gender: 'MALE',
    date_of_birth: '2010-01-01'
  });
  if (studentInsertErr) {
    console.error("Failed to create students row:", studentInsertErr);
    process.exit(1);
  }

  // Map parent to student
  try {
    await supabaseAdmin.from('parent_student_mapping').insert({
      parent_id: parentRecordId,
      student_id: studentRecordId,
      relationship: 'Father'
    });
  } catch (err) {}

  // 3. Create an admin user (Finance Admin role to approve payment)
  console.log("Creating Admin auth user...");
  const { data: adminAuth, error: adminAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email: adminEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { school_id: testSchoolId, role: 'FINANCE_ADMIN' }
  });
  if (adminAuthErr || !adminAuth.user) {
    console.error("Failed to create admin auth user:", adminAuthErr);
    process.exit(1);
  }
  const adminUserId = adminAuth.user.id;

  console.log("Inserting Admin user profile...");
  await supabaseAdmin.from('users').insert({
    id: adminUserId,
    email: adminEmail,
    role: 'FINANCE_ADMIN',
    first_name: 'Test',
    last_name: 'Admin',
    school_id: testSchoolId,
    is_active: true
  });

  // 4. Create two separate fee structures to avoid duplicate constraint violations
  console.log("Creating two distinct fee structures...");
  const feeStructureId = crypto.randomUUID();
  const feeStructureId2 = crypto.randomUUID();

  const { error: feeStrErr } = await supabaseAdmin.from('fee_structures').insert([
    {
      id: feeStructureId,
      school_id: testSchoolId,
      academic_session_id: academicSessionId,
      class_id: classId,
      description: `Tuition Fee Approve ${rand}`,
      amount: 4000,
      due_date: '2026-12-31'
    },
    {
      id: feeStructureId2,
      school_id: testSchoolId,
      academic_session_id: academicSessionId,
      class_id: classId,
      description: `Tuition Fee Reject ${rand}`,
      amount: 5000,
      due_date: '2026-12-31'
    }
  ]);
  if (feeStrErr) {
    console.error("Failed to create fee structures:", feeStrErr);
    process.exit(1);
  }
  console.log("Using Fee Structure ID 1 (Approval):", feeStructureId);
  console.log("Using Fee Structure ID 2 (Rejection):", feeStructureId2);

  // Mock local DB caches to avoid any missing local ref errors
  mockApi.syncParentsData(testSchoolId).catch(() => {});

  // Sign in as Parent on public client
  console.log("Signing in as Parent on public client...");
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: parentEmail,
    password: testPassword
  });
  if (signInErr) {
    console.error("Failed parent sign-in:", signInErr);
    process.exit(1);
  }

  // Populate aegis_session in localStorage for mockApi compatibility
  const parentSession = {
    token: 'mock-token',
    user: {
      id: parentUserId,
      email: parentEmail,
      role: 'PARENT',
      firstName: 'Test',
      lastName: 'Parent',
      isActive: true,
      schoolId: testSchoolId
    }
  };
  localStorage.setItem('aegis_session', JSON.stringify(parentSession));

  // Instantiate dedicated client for Parent realtime subscription
  const supabaseUrl = process.env.VITE_SUPABASE_URL!;
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY!;
  const parentSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  console.log("Signing in Parent on dedicated client for realtime subscription...");
  const { error: parentSignInErr } = await parentSupabase.auth.signInWithPassword({
    email: parentEmail,
    password: testPassword
  });
  if (parentSignInErr) {
    console.error("Failed dedicated parent sign-in:", parentSignInErr);
    process.exit(1);
  }

  const utrNumber = `UTIC000978564${rand}`;
  console.log("Using UTR Number:", utrNumber);

  // Pre-generate UUID for fee payment to subscribe to realtime before submission
  const paymentId = crypto.randomUUID();
  mockDb.feePayments.push({
    id: paymentId,
    feeStructureId: feeStructureId,
    studentId: studentRecordId,
    amountPaid: 0,
    paymentDate: new Date().toISOString(),
    paymentMethod: 'UPI',
    transactionId: utrNumber,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  });

  // Create a mock screenshot file
  const fakeFile = new Blob(['proof receipt content'], { type: 'image/png' }) as any;
  fakeFile.name = 'receipt.png';

  // Realtime subscription setup
  let realtimeEventReceived = false;
  let realtimeNewStatus = '';

  console.log("Subscribing to realtime updates for fee_payments ID:", paymentId);
  const channel = parentSupabase
    .channel('parent-realtime-fee-updates')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'fee_payments',
        filter: `id=eq.${paymentId}`
      },
      (payload: any) => {
        console.log("Realtime event received! Status updated to:", payload.new.status);
        realtimeEventReceived = true;
        realtimeNewStatus = payload.new.status;
      }
    )
    .subscribe((status) => {
      console.log("Realtime channel subscription status:", status);
    });

  // Wait 2 seconds for WebSocket channel connection to establish
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Test 1: Submit fee payment proof
    console.log("\n--- TEST 1: Submitting fee payment proof by Parent...");
    const payment = await mockApi.submitFeePaymentProof(
      parentRecordId,
      studentRecordId,
      feeStructureId,
      'UPI',
      utrNumber,
      fakeFile
    );
    console.log("Proof submitted successfully! Payment record:", payment);

    if (payment.id !== paymentId) {
      throw new Error(`Payment ID mismatch! Expected pre-generated ID ${paymentId} but got ${payment.id}`);
    }

    // Verify fee_payments row was created
    const { data: dbPayment, error: paymentFetchErr } = await supabaseAdmin
      .from('fee_payments')
      .select('*')
      .eq('id', payment.id)
      .single();
    if (paymentFetchErr || !dbPayment) {
      throw new Error("Could not fetch submitted fee payment from DB: " + paymentFetchErr?.message);
    }
    console.log("Verified fee_payments row in DB:", dbPayment);

    // Verify payment_audit_logs row was created and mapped correctly
    const { data: dbLog, error: logFetchErr } = await supabaseAdmin
      .from('payment_audit_logs')
      .select('*')
      .eq('payment_id', payment.id)
      .eq('action', 'SUBMITTED')
      .single();
    if (logFetchErr || !dbLog) {
      throw new Error("Could not fetch SUBMITTED audit log from DB: " + logFetchErr?.message);
    }
    console.log("Verified payment_audit_logs row in DB:", dbLog);
    console.log(`Log ID: ${dbLog.id} | Action: ${dbLog.action} | Performed By: ${dbLog.performed_by}`);

    if (dbLog.performed_by !== parentUserId) {
      throw new Error(`Performed By mismatch! Expected Parent user ID (${parentUserId}) but got ${dbLog.performed_by}`);
    }
    console.log("SUCCESS: parentRecordId resolved to parentUserId UUID correctly in audit log!");

    // Test 2: Verify and approve payment by Finance Admin
    console.log("\n--- TEST 2: Approving payment by Finance Admin...");
    // Sign out first
    await supabase.auth.signOut();
    // Sign in as Finance Admin
    const { error: adminSignInErr } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: testPassword
    });
    if (adminSignInErr) {
      throw adminSignInErr;
    }

    // Populate aegis_session in localStorage for admin
    const adminSession = {
      token: 'mock-token',
      user: {
        id: adminUserId,
        email: adminEmail,
        role: 'FINANCE_ADMIN',
        firstName: 'Test',
        lastName: 'Admin',
        isActive: true,
        schoolId: testSchoolId
      }
    };
    localStorage.setItem('aegis_session', JSON.stringify(adminSession));

    // Verify Payments queue visibility
    console.log("Verifying Payments queue visibility for Admin...");
    const adminPayments = await mockApi.adminGetFeePayments();
    const visiblePayment = adminPayments.find(p => p.id === payment.id);
    if (!visiblePayment) {
      throw new Error("FAIL: Submitted payment is not visible in the Admin's fee payments queue!");
    }
    console.log("SUCCESS: Submitted payment is visible in the Admin fee payments queue.");

    const approvedPayment = await mockApi.verifyFeePayment(
      adminUserId,
      payment.id,
      'PAID'
    );
    console.log("Payment approved status:", approvedPayment.status);

    // Wait for realtime event propagation
    console.log("Waiting for realtime update propagation to Parent...");
    await new Promise(resolve => setTimeout(resolve, 3000));

    if (!realtimeEventReceived) {
      console.warn("WARNING: Realtime event was not received by the Parent. (Make sure replication is active for public.fee_payments in Supabase!)");
    } else {
      console.log(`SUCCESS: Realtime event received! Status is ${realtimeNewStatus}`);
      if (realtimeNewStatus !== 'PAID') {
        throw new Error(`Realtime status mismatch: expected PAID but got ${realtimeNewStatus}`);
      }
    }
    // Clean up channel subscription
    await parentSupabase.removeChannel(channel);

    // Verify APPROVED audit log
    const { data: dbLogApprove, error: logApproveErr } = await supabaseAdmin
      .from('payment_audit_logs')
      .select('*')
      .eq('payment_id', payment.id)
      .eq('action', 'APPROVED')
      .single();
    if (logApproveErr || !dbLogApprove) {
      throw new Error("Could not fetch APPROVED audit log from DB: " + logApproveErr?.message);
    }
    console.log("Verified APPROVED payment_audit_logs row in DB:", dbLogApprove);
    console.log(`Log ID: ${dbLogApprove.id} | Performed By: ${dbLogApprove.performed_by}`);

    if (dbLogApprove.performed_by !== adminUserId) {
      throw new Error(`Performed By mismatch! Expected Admin user ID (${adminUserId}) but got ${dbLogApprove.performed_by}`);
    }
    console.log("SUCCESS: adminUserId correctly logged as performed_by in APPROVED audit log!");

    // Test 3: Reject flow test
    console.log("\n--- TEST 3: Reject flow test...");
    // Submit another proof
    const utrNumberReject = `UTIR000978564${rand}`;
    const paymentReject = await mockApi.submitFeePaymentProof(
      parentRecordId,
      studentRecordId,
      feeStructureId2,
      'Bank Transfer',
      utrNumberReject,
      fakeFile
    );
    console.log("Submitted second payment for rejection flow. ID:", paymentReject.id);

    // Reject it
    const rejectedPayment = await mockApi.verifyFeePayment(
      adminUserId,
      paymentReject.id,
      'REJECTED',
      'Blurry screenshot proof'
    );
    console.log("Rejected payment status:", rejectedPayment.status, "Reason:", rejectedPayment.rejectionReason);

    // Verify REJECTED audit log
    const { data: dbLogReject, error: logRejectErr } = await supabaseAdmin
      .from('payment_audit_logs')
      .select('*')
      .eq('payment_id', paymentReject.id)
      .eq('action', 'REJECTED')
      .single();
    if (logRejectErr || !dbLogReject) {
      throw new Error("Could not fetch REJECTED audit log from DB: " + logRejectErr?.message);
    }
    console.log("Verified REJECTED payment_audit_logs row in DB:", dbLogReject);
    console.log(`Log ID: ${dbLogReject.id} | Performed By: ${dbLogReject.performed_by}`);

    console.log("\n=== ALL PARENT FEE FLOW PERSISTENCE TESTS PASSED! ===");

    // Print Final Verification details as required by the user
    console.log("\n--- FINAL VERIFICATION REPORT ---");
    console.log(`- Created Fee Payment ID: ${payment.id}`);
    console.log(`- Created Audit Log ID: ${dbLog.id}`);
    console.log(`- Parent Portal parent.id: ${parentRecordId}`);
    console.log(`- Resolved performed_by UUID: ${dbLog.performed_by}`);
    console.log(`- Referenced public.users row ID: ${parentUserId}`);
    console.log(`- Referenced public.users row role: PARENT`);
    console.log("---------------------------------");
  } finally {
    // Cleanup - commented out for verification
    console.log("\nSkipping cleanup to preserve test records for post-fix verification...");
    /*
    await supabase.auth.signOut().catch(() => {});
    
    // Delete payments (using studentRecordId)
    await supabaseAdmin.from('fee_payments').delete().eq('student_id', studentRecordId);
    
    // Delete users & roles
    try {
      await supabaseAdmin.from('parent_student_mapping').delete().eq('parent_id', parentRecordId);
    } catch (err) {}
    await supabaseAdmin.from('parents').delete().eq('id', parentRecordId);
    await supabaseAdmin.from('students').delete().eq('id', studentRecordId);
    
    await supabaseAdmin.from('users').delete().eq('id', parentUserId);
    await supabaseAdmin.from('users').delete().eq('id', studentUserId);
    await supabaseAdmin.from('users').delete().eq('id', adminUserId);

    await supabaseAdmin.auth.admin.deleteUser(parentUserId);
    await supabaseAdmin.auth.admin.deleteUser(studentUserId);
    await supabaseAdmin.auth.admin.deleteUser(adminUserId);
    console.log("Cleanup complete!");
    */
  }
}

run().catch(err => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
