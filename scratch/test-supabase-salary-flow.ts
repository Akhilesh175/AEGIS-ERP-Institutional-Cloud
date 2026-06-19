import './load-env';
import './mock-localStorage';
import { mockApi } from '../src/services/mockApi';
import { supabase, supabaseAdmin } from '../src/lib/supabase';

async function run() {
  console.log("=== Testing Database-Backed Salary Payment & Ledger System (Authenticated RLS) ===");

  // Find a school
  const { data: schools, error: schoolError } = await supabaseAdmin.from('schools').select('*').limit(1);
  if (schoolError || !schools || schools.length === 0) {
    console.error("No schools in database. Cannot run tests.", schoolError);
    process.exit(1);
  }
  const testSchoolId = schools[0].id;
  console.log("Using School ID:", testSchoolId);

  // Create an admin user to satisfy the RLS policy (school_id = get_auth_user_school_id() and role in ('ADMIN', 'FINANCE_ADMIN'))
  const testEmail = "test-sal-admin-" + Math.random().toString(36).substring(2, 7) + "@aegis.com";
  const testPassword = "Password123!";

  console.log("Creating auth user in Supabase Auth:", testEmail);
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { school_id: testSchoolId, role: 'ADMIN' }
  });
  if (authError || !authData.user) {
    console.error("Failed to create auth user:", authError);
    process.exit(1);
  }
  
  console.log("Inserting user profile into public.users table...");
  const { error: insertUserError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authData.user.id,
      email: testEmail,
      role: 'ADMIN',
      first_name: 'Test',
      last_name: 'Admin',
      is_active: true,
      school_id: testSchoolId
    });
  if (insertUserError) {
    console.error("Failed to insert user profile:", insertUserError);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    process.exit(1);
  }

  // Create an employee user who is receiving the salary
  const empEmail = "test-sal-emp-" + Math.random().toString(36).substring(2, 7) + "@aegis.com";
  console.log("Creating employee user in Supabase Auth:", empEmail);
  const { data: empAuthData, error: empAuthError } = await supabaseAdmin.auth.admin.createUser({
    email: empEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { school_id: testSchoolId, role: 'TEACHER' }
  });
  if (empAuthError || !empAuthData.user) {
    console.error("Failed to create employee auth user:", empAuthError);
    // Cleanup admin
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    process.exit(1);
  }

  console.log("Inserting employee profile into public.users table...");
  const { error: insertEmpError } = await supabaseAdmin
    .from('users')
    .insert({
      id: empAuthData.user.id,
      email: empEmail,
      role: 'TEACHER',
      first_name: 'Test',
      last_name: 'Teacher',
      is_active: true,
      school_id: testSchoolId
    });
  if (insertEmpError) {
    console.error("Failed to insert employee profile:", insertEmpError);
    await supabaseAdmin.auth.admin.deleteUser(empAuthData.user.id);
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    process.exit(1);
  }

  console.log("Signing in to public supabase client as Admin...");
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: testEmail,
    password: testPassword
  });
  if (signInError) {
    console.error("Failed to sign in:", signInError);
    // Cleanup
    await supabaseAdmin.from('users').delete().eq('id', empAuthData.user.id);
    await supabaseAdmin.auth.admin.deleteUser(empAuthData.user.id);
    await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    process.exit(1);
  }
  console.log("Sign in successful!");

  const testEmployeeId = empAuthData.user.id;
  const testAdminId = authData.user.id;

  const testUtr = "UTR-TEST-" + Math.random().toString(36).substring(2, 11).toUpperCase();
  console.log("Generated UTR for test:", testUtr);

  try {
    // 1. Submit a salary payment proof
    console.log("\n1. Submitting Salary Payment Proof...");
    const submitted = await mockApi.submitSalaryPayment(testAdminId, testSchoolId, {
      employeeId: testEmployeeId,
      month: "June 2026",
      amount: 50000,
      utrNumber: testUtr,
      paymentScreenshotUrl: "https://example.com/screenshot.png"
    });
    console.log("Submitted payment:", submitted);

    if (submitted.status !== 'PENDING') {
      throw new Error("Expected status PENDING");
    }

    // 2. Fetch all salary payments for school
    console.log("\n2. Querying all Salary Payments...");
    const payments = await mockApi.getSalaryPayments(testSchoolId);
    const found = payments.find(p => p.id === submitted.id);
    if (!found) {
      throw new Error("Could not find submitted payment in getSalaryPayments list");
    }
    console.log("Successfully retrieved submitted payment from database list.");

    // 3. Test UTR uniqueness check (attempting duplicate submit)
    console.log("\n3. Testing UTR uniqueness validation...");
    try {
      await mockApi.submitSalaryPayment(testAdminId, testSchoolId, {
        employeeId: testEmployeeId,
        month: "June 2026",
        amount: 50000,
        utrNumber: testUtr,
        paymentScreenshotUrl: "https://example.com/screenshot.png"
      });
      throw new Error("FAIL: Allowed duplicate UTR payment submittal");
    } catch (err: any) {
      if (err.message.includes(`already used for a salary payment`)) {
        console.log("PASS: Successfully blocked duplicate UTR submittal:", err.message);
      } else {
        throw err;
      }
    }

    // 4. Approve the payment and verify ledger insertion
    console.log("\n4. Approving Salary Payment...");
    const approved = await mockApi.approveSalaryPayment(testAdminId, submitted.id, 'APPROVED');
    console.log("Approved payment:", approved);

    if (approved.status !== 'APPROVED') {
      throw new Error("Expected status APPROVED");
    }

    // Check ledger entry
    console.log("\n5. Querying Employee Salary Ledger...");
    const ledger = await mockApi.getSalaryLedger(testSchoolId, testEmployeeId);
    const ledgerEntry = ledger.find(l => l.salaryPaymentId === submitted.id);
    if (!ledgerEntry) {
      throw new Error("No ledger entry was created for approved payment");
    }
    console.log("Found ledger entry:", ledgerEntry);
    if (ledgerEntry.amount !== 50000 || ledgerEntry.utrNumber !== testUtr) {
      throw new Error("Ledger entry amount/UTR mismatch");
    }
    console.log("PASS: Ledger entry details match approved payment.");

    // 6. Test reject flow
    const testUtrReject = "UTR-TEST-REJ-" + Math.random().toString(36).substring(2, 11).toUpperCase();
    console.log("\n6. Submitting a second Salary Payment for Rejection flow...");
    const submitted2 = await mockApi.submitSalaryPayment(testAdminId, testSchoolId, {
      employeeId: testEmployeeId,
      month: "June 2026",
      amount: 45000,
      utrNumber: testUtrReject,
      paymentScreenshotUrl: "https://example.com/screenshot.png"
    });
    
    console.log("Rejecting second Salary Payment...");
    const rejected = await mockApi.approveSalaryPayment(testAdminId, submitted2.id, 'REJECTED', 'Incorrect receipt details');
    console.log("Rejected payment status:", rejected.status);
    console.log("Rejection reason:", rejected.rejectionReason);

    if (rejected.status !== 'REJECTED' || rejected.rejectionReason !== 'Incorrect receipt details') {
      throw new Error("Rejection state mismatch");
    }

    // Verify that rejected payments do not create ledger entries
    const ledger2 = await mockApi.getSalaryLedger(testSchoolId, testEmployeeId);
    const ledgerEntry2 = ledger2.find(l => l.salaryPaymentId === submitted2.id);
    if (ledgerEntry2) {
      throw new Error("FAIL: Ledger entry was created for a REJECTED payment!");
    }
    console.log("PASS: Rejected payment did not insert a ledger entry.");

    // Check audit log for the rejected action on Supabase
    console.log("\n7. Checking Payment Audit Logs...");
    const { data: logs, error: logsError } = await supabase
      .from('payment_audit_logs')
      .select('*')
      .eq('payment_id', submitted2.id)
      .order('performed_at', { ascending: false });
    if (logsError) {
      throw logsError;
    }
    console.log(`Found ${logs?.length || 0} audit logs for rejected payment.`);
    logs?.forEach(log => {
      console.log(`  Action: ${log.action} | Performed By: ${log.performed_by} | Details:`, log.details);
    });

    if (!logs || logs.length < 2) {
      throw new Error("Expected at least SUBMITTED and REJECTED audit logs");
    }
    console.log("PASS: All payment audit logs were verified on Supabase.");

    console.log("\n=== ALL DATABASE-BACKED PAYROLL PERSISTENCE TESTS PASSED! ===");
  } finally {
    // Cleanup all created records & profiles to leave the test DB clean
    console.log("\nCleaning up test data...");
    
    // Sign out first
    await supabase.auth.signOut();

    // Delete audit logs
    const paymentsList = await supabaseAdmin.from('salary_payments').select('id').eq('school_id', testSchoolId);
    if (paymentsList.data && paymentsList.data.length > 0) {
      const ids = paymentsList.data.map(p => p.id);
      await supabaseAdmin.from('payment_audit_logs').delete().in('payment_id', ids);
    }
    
    // Delete payments (this cascades to ledger due to ON DELETE CASCADE)
    await supabaseAdmin.from('salary_payments').delete().eq('school_id', testSchoolId);
    
    // Delete user profiles
    await supabaseAdmin.from('users').delete().eq('id', testEmployeeId);
    await supabaseAdmin.from('users').delete().eq('id', testAdminId);

    // Delete auth users
    await supabaseAdmin.auth.admin.deleteUser(testEmployeeId);
    await supabaseAdmin.auth.admin.deleteUser(testAdminId);
    console.log("Cleanup complete!");
  }
}

run().catch(err => {
  console.error("E2E database test failed:", err);
  process.exit(1);
});
