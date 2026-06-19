import './mock-localStorage';
import { mockDb } from '../src/services/mockDb';
import { mockApi } from '../src/services/mockApi';

async function runPayrollTests() {
  console.log('=== AEGIS ERP PAYROLL MANAGEMENT & DRIVER DISBURSEMENT TESTS ===');

  const schoolId = 'school-1';
  const financeAdminId = 'u-financeadmin';
  const superAdminId = 'u-superadmin';
  const regularAdminId = 'u-admin1';
  const teacherId = 'u-teacher1';

  // 1. Setup mock users to include a FINANCE_ADMIN and make sure school is configured
  console.log('\nSetting up test users in mock database...');
  
  // Ensure the school exists and is on the enterprise plan so transit checks pass
  let school = mockDb.schools.find(s => s.id === schoolId);
  if (!school) {
    school = {
      id: schoolId,
      name: 'Aegis Academy of Excellence',
      subscriptionPlan: 'enterprise',
      createdAt: new Date().toISOString()
    };
    mockDb.schools.push(school);
  } else {
    school.subscriptionPlan = 'enterprise';
  }

  // Ensure mock users exist
  const existingFinanceAdmin = mockDb.users.find(u => u.id === financeAdminId);
  if (!existingFinanceAdmin) {
    mockDb.users.push({
      id: financeAdminId,
      email: 'finance@aegis.com',
      role: 'FINANCE_ADMIN',
      firstName: 'Finance',
      lastName: 'Admin',
      isActive: true,
      schoolId: schoolId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }

  // Clean existing payroll entries in mockDb for clean testing
  mockDb.payrollRecords = [];
  mockDb.driverSalaryPayouts = [];
  mockDb.saveAll();

  // Test Case 1: Create payroll record - Role restriction validation
  console.log('\nTest Case 1: Role restrictions on createPayrollRecord');

  // A. Teacher tries to create -> should throw
  try {
    console.log('Attempting payroll creation as TEACHER...');
    await mockApi.createPayrollRecord(teacherId, schoolId, {
      employeeType: 'TEACHER',
      employeeRole: 'TEACHER',
      employeeName: 'Hypatia of Alexandria',
      payoutMonth: '2026-06',
      baseSalary: 4500,
      allowances: 300,
      deductions: 150
    });
    throw new Error('FAIL: Allowed TEACHER to create payroll record');
  } catch (err: any) {
    if (err.message.includes('Only Finance Admin is authorized to perform salary disbursement')) {
      console.log('PASS: Correctly blocked TEACHER role');
    } else {
      throw err;
    }
  }

  // B. Regular Admin ( Richard Hendricks ) tries to create -> should throw
  try {
    console.log('Attempting payroll creation as school ADMIN...');
    await mockApi.createPayrollRecord(regularAdminId, schoolId, {
      employeeType: 'TEACHER',
      employeeRole: 'TEACHER',
      employeeName: 'Hypatia of Alexandria',
      payoutMonth: '2026-06',
      baseSalary: 4500,
      allowances: 300,
      deductions: 150
    });
    throw new Error('FAIL: Allowed regular ADMIN to create payroll record');
  } catch (err: any) {
    if (err.message.includes('Only Finance Admin is authorized to perform salary disbursement')) {
      console.log('PASS: Correctly blocked school ADMIN role');
    } else {
      throw err;
    }
  }

  // C. Finance Admin tries to create -> should succeed
  console.log('Attempting payroll creation as FINANCE_ADMIN...');
  const record = await mockApi.createPayrollRecord(financeAdminId, schoolId, {
    employeeType: 'TEACHER',
    employeeRole: 'TEACHER',
    employeeName: 'Hypatia of Alexandria',
    employeeIdNumber: 'EMP002',
    employeePhone: '+1 (555) 777-3333',
    payoutMonth: '2026-06',
    baseSalary: 4500,
    allowances: 500,
    deductions: 200,
    notes: 'Base monthly pay with performance bonus'
  });

  console.log('Created record:', {
    id: record.id,
    employeeName: record.employeeName,
    netSalary: record.netSalary,
    payoutStatus: record.payoutStatus,
    currencySymbol: record.currencySymbol
  });

  if (record.netSalary === 4800 && record.payoutStatus === 'PENDING') {
    console.log('PASS: Successfully created payroll record as FINANCE_ADMIN and verified net salary calculation');
  } else {
    throw new Error(`FAIL: Incorrect payroll values, netSalary: ${record.netSalary}, status: ${record.payoutStatus}`);
  }

  // Test Case 2: Payroll lifecycle state transitions & authorization check
  console.log('\nTest Case 2: Payroll status transitions');

  // A. Approve entry (PENDING -> APPROVED)
  console.log('Approving payroll as FINANCE_ADMIN...');
  let approvedRecord = await mockApi.updatePayrollStatus(financeAdminId, schoolId, record.id, 'APPROVED');
  console.log('Approved Status:', approvedRecord.payoutStatus);
  if (approvedRecord.payoutStatus !== 'APPROVED') {
    throw new Error('FAIL: Status did not transition to APPROVED');
  }

  // B. Disburse entry (APPROVED -> PAID)
  console.log('Disbursing payroll as SUPER_ADMIN...');
  let paidRecord = await mockApi.updatePayrollStatus(superAdminId, schoolId, record.id, 'PAID', 'Disbursement processed via EFT');
  console.log('Paid Status:', paidRecord.payoutStatus);
  console.log('Paid transactionRef:', paidRecord.transactionReference);
  console.log('Paid paidByUserId:', paidRecord.paidByUserId);
  if (paidRecord.payoutStatus !== 'PAID' || !paidRecord.transactionReference || paidRecord.paidByUserId !== superAdminId) {
    throw new Error('FAIL: Status did not transition to PAID or failed to generate txn reference');
  }

  // C. Reverse PAID entry (PAID -> REVERSED)
  console.log('Reversing paid payroll as FINANCE_ADMIN...');
  let reversedRecord = await mockApi.updatePayrollStatus(financeAdminId, schoolId, record.id, 'REVERSED', 'Bank transfer bounced');
  console.log('Reversed Status:', reversedRecord.payoutStatus);
  if (reversedRecord.payoutStatus !== 'REVERSED') {
    throw new Error('FAIL: Status did not transition to REVERSED');
  }

  // D. Reset REVERSED entry back to PENDING (REVERSED -> PENDING)
  console.log('Resetting reversed payroll as FINANCE_ADMIN...');
  let resetRecord = await mockApi.updatePayrollStatus(financeAdminId, schoolId, record.id, 'PENDING');
  console.log('Reset Status:', resetRecord.payoutStatus);
  if (resetRecord.payoutStatus !== 'PENDING') {
    throw new Error('FAIL: Status did not transition back to PENDING');
  }

  // E. Cancel PENDING entry (PENDING -> CANCELLED)
  console.log('Cancelling pending payroll as FINANCE_ADMIN...');
  let cancelledRecord = await mockApi.updatePayrollStatus(financeAdminId, schoolId, record.id, 'CANCELLED');
  console.log('Cancelled Status:', cancelledRecord.payoutStatus);
  if (cancelledRecord.payoutStatus !== 'CANCELLED') {
    throw new Error('FAIL: Status did not transition to CANCELLED');
  }
  console.log('PASS: All status transitions verified successfully.');

  // Test Case 3: Soft deletion of payroll record
  console.log('\nTest Case 3: Soft delete record');
  await mockApi.deletePayrollRecord(financeAdminId, schoolId, record.id);
  const records = await mockApi.fetchPayrollRecords(schoolId);
  const deletedFound = records.some(r => r.id === record.id);
  console.log('Deleted record still in active fetch list?', deletedFound);
  if (deletedFound) {
    throw new Error('FAIL: Record was not soft-deleted');
  }
  console.log('PASS: Soft deletion verified.');

  // Test Case 4: Driver Salary Disbursement & Historical Identity Snapshots
  console.log('\nTest Case 4: Driver salary payout and snapshot capture');
  
  // Setup driver in mockDb
  const driverId = 'drv-test-123';
  const existingDriver = mockDb.drivers.find(d => d.id === driverId);
  if (!existingDriver) {
    mockDb.drivers.push({
      id: driverId,
      schoolId: schoolId,
      name: 'John Doe',
      licenseNumber: 'DL-555-88-999',
      phone: '+1 (555) 123-4555',
      employeeId: 'DRV-007',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    });
    mockDb.saveAll();
  }

  // A. Attempt driver disburse as regular ADMIN -> should fail
  try {
    console.log('Disbursing driver salary as ADMIN...');
    await mockApi.adminDisburseDriverSalary(regularAdminId, schoolId, driverId, 90.00);
    throw new Error('FAIL: Allowed regular ADMIN to disburse driver salary');
  } catch (err: any) {
    if (err.message.includes('Only Finance Admin is authorized to perform salary disbursement')) {
      console.log('PASS: Correctly blocked regular ADMIN from driver disburse');
    } else {
      throw err;
    }
  }

  // B. Attempt driver disburse as FINANCE_ADMIN -> should succeed
  console.log('Disbursing driver salary as FINANCE_ADMIN...');
  const payout = await mockApi.adminDisburseDriverSalary(financeAdminId, schoolId, driverId, 90.00, 'attendance-1', financeAdminId, 'Paid john doe');
  console.log('Disbursed payout details:', {
    id: payout.id,
    payoutAmount: payout.payoutAmount,
    driverName: payout.driverName,
    driverEmployeeId: payout.driverEmployeeId,
    driverLicenseNumber: payout.driverLicenseNumber,
    driverPhone: payout.driverPhone,
    txRef: payout.transactionReference
  });

  if (payout.driverName === 'John Doe' && payout.driverEmployeeId === 'DRV-007' && payout.driverLicenseNumber === 'DL-555-88-999') {
    console.log('PASS: Successfully disbursed salary and validated driver metadata snapshots are populated.');
  } else {
    throw new Error('FAIL: Driver metadata snapshots were not populated correctly.');
  }

  // Test Case 5: Audit logging checks
  console.log('\nTest Case 5: Verification of Audit Log entries');
  const auditLogs = mockDb.auditLogs.filter(l => l.schoolId === schoolId && l.moduleName === 'finance');
  console.log(`Found ${auditLogs.length} finance audit log entries in mock database:`);
  auditLogs.forEach(l => {
    console.log(`  Action: ${l.actionType} | User ID: ${l.userId} | Target ID: ${l.targetId}`);
  });

  if (auditLogs.some(l => l.actionType === 'SALARY_CREATED') && auditLogs.some(l => l.actionType === 'SALARY_DISBURSED')) {
    console.log('PASS: Audit logs were successfully recorded for payroll events.');
  } else {
    throw new Error('FAIL: Expected audit logs for payroll were missing.');
  }

  console.log('\n=== ALL PAYROLL MANAGEMENT E2E TESTS COMPLETED SUCCESSFULLY! ===');
}

runPayrollTests().catch(err => {
  console.error('\nE2E Test Failure:', err);
  process.exit(1);
});
