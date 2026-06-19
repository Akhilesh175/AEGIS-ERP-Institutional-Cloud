import './mock-localStorage';
import { mockApi } from '../src/services/mockApi.ts';

async function run() {
  const schoolId = '39b3c4f3-cb58-41c7-be8d-bfd6dee31350';
  const data = await mockApi.fetchStudentAttendanceAnalytics(schoolId);
  console.log('Returned data type:', typeof data, 'isArray:', Array.isArray(data));
  console.log('Returned data array length:', data.length);
  console.log('Properties on returned data:');
  console.log('  overall_percentage:', (data as any).overall_percentage);
  console.log('  absences_count:', (data as any).absences_count);
  console.log('  tardy_count:', (data as any).tardy_count);
  console.log('  chronic_absent:', (data as any).chronic_absent);
}

run().catch(console.error);
