import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Parse .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Mock localStorage so mockDb can load in Node.js
(global as any).localStorage = {
  getItem: () => null,
  setItem: () => {}
};

const idMap = new Map<string, string>();

function getUuid(oldId: string) {
  if (!oldId) return null;
  if (idMap.has(oldId)) return idMap.get(oldId);
  const hash = crypto.createHash('md5').update(oldId).digest('hex');
  const uuid = `${hash.slice(0,8)}-${hash.slice(8,12)}-4${hash.slice(13,16)}-a${hash.slice(17,20)}-${hash.slice(20,32)}`;
  idMap.set(oldId, uuid);
  return uuid;
}

function toSnakeCase(str: string) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function isUuid(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

function convertKeysAndIds(obj: any, defaults: any = {}): any {
  if (Array.isArray(obj)) {
    return obj.map(item => convertKeysAndIds(item, defaults));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = Object.keys(obj).reduce((acc, key) => {
      let val = obj[key];
      const isIdField = key === 'id' || key.endsWith('Id') || key.endsWith('_id') || key === 'userId' || key === 'studentId';
      if (isIdField && typeof val === 'string' && !isUuid(val)) {
        val = getUuid(val);
      }
      acc[toSnakeCase(key)] = val;
      return acc;
    }, {} as any);
    
    // Inject defaults like school_id if missing
    for (const k in defaults) {
      if (!(k in newObj) && newObj[k] === undefined) {
        newObj[k] = defaults[k];
      }
    }
    return newObj;
  }
  return obj;
}

async function seedTable(tableName: string, dataArray: any[], defaults: any = {}) {
  if (!dataArray || dataArray.length === 0) {
    console.log(`No seed data found for ${tableName}, skipping.`);
    return;
  }
  
  console.log(`\n--- Seeding ${tableName} (${dataArray.length} records) ---`);
  
  const convertedData = dataArray.map(item => convertKeysAndIds(item, defaults));
  
  // Upsert to handle existing records
  const { error } = await supabaseAdmin.from(tableName).upsert(convertedData, { onConflict: 'id' });
  if (error) {
    console.error(`Error inserting into ${tableName}:`, error.message, error.details);
  } else {
    console.log(`Successfully seeded ${tableName}!`);
  }
}

async function main() {
  const { mockDb } = await import('../src/services/mockDb');
  
  let schoolId, sessionId, studentId, userId;
  
  // Map hardcoded mock references to real DB records where possible
  const { data: schools } = await supabaseAdmin.from('schools').select('id').limit(1);
  if (schools && schools.length > 0) {
    schoolId = schools[0].id;
    idMap.set('school-1', schoolId);
  }
  
  const { data: students } = await supabaseAdmin.from('students').select('id, user_id').limit(1);
  if (students && students.length > 0) {
    studentId = students[0].id;
    userId = students[0].user_id;
    idMap.set('st-1', studentId);
    idMap.set('student-1', studentId);
    idMap.set('u-student1', userId);
  }
  
  const { data: drivers } = await supabaseAdmin.from('drivers').select('id').limit(1);
  if (drivers && drivers.length > 0) idMap.set('dr-1', drivers[0].id);

  const { data: sessions } = await supabaseAdmin.from('academic_sessions').select('id').limit(1);
  if (sessions && sessions.length > 0) {
    sessionId = sessions[0].id;
    idMap.set('session-1', sessionId);
  }

  const { data: subjects } = await supabaseAdmin.from('subjects').select('id').limit(2);
  let subjectId, subjectId2;
  if (subjects && subjects.length > 0) {
    subjectId = subjects[0].id;
    if (subjects.length > 1) subjectId2 = subjects[1].id;
    else subjectId2 = subjectId;
  }
  
  const { data: busesDb } = await supabaseAdmin.from('buses').select('id').limit(1);
  let busId = busesDb && busesDb.length > 0 ? busesDb[0].id : null;
  
  const { data: booksDb } = await supabaseAdmin.from('books').select('id').limit(1);
  let dbBookId = booksDb && booksDb.length > 0 ? booksDb[0].id : null;

  const defaults = { school_id: schoolId };
  const schoolOnly = { school_id: schoolId };
  const schoolAndSession = { school_id: schoolId, academic_session_id: sessionId };

  await seedTable('drivers', mockDb.drivers.slice(0, 1), schoolAndSession);
  
  const buses = mockDb.buses.slice(0, 1).map(b => {
    const { numberPlate, ...rest } = b as any;
    return { ...rest, plate_number: numberPlate, driver_name: 'John Doe', driver_phone: '1234567890' };
  });
  await seedTable('buses', buses, schoolOnly);
  
  if (!busId) busId = buses.length > 0 ? getUuid(buses[0].id) : null;
  
  await seedTable('routes', mockDb.routes.slice(0, 1), schoolOnly);
  await seedTable('pickup_points', mockDb.pickupPoints.slice(0, 1), schoolAndSession);
  
  const transportAssignments = mockDb.transportAssignments.slice(0, 1).map(ta => ({
    ...ta,
    studentId: userId,
    busId: busId || getUuid(ta.busId)
  }));
  await seedTable('transport_assignments', transportAssignments, schoolOnly);
  
  const transportFees = (mockDb.transportFeeRecords || []).slice(0, 1).map(tf => ({
    ...tf,
    studentId: studentId
  }));
  await seedTable('transport_fee_records', transportFees, schoolOnly);
  
  const vehicleLogs = ((mockDb as any).vehicleLogs || []).slice(0, 1).map((vl: any) => ({
    ...vl,
    busId: busId || getUuid(vl.busId)
  }));
  await seedTable('vehicle_logs', vehicleLogs, schoolOnly);
  
  const maintLogs = ((mockDb as any).maintenanceLogs || []).slice(0, 1).map((ml: any) => ({
    ...ml,
    busId: busId || getUuid(ml.busId)
  }));
  await seedTable('maintenance_logs', maintLogs, schoolOnly);
  
  await seedTable('driver_attendance', ((mockDb as any).driverAttendance || []).slice(0, 1), schoolOnly);
  await seedTable('book_categories', mockDb.bookCategories.slice(0, 1), schoolOnly);
  
  // books
  const books = mockDb.books.slice(0, 1).map(b => {
    return {
      id: b.id,
      title: b.title,
      author: b.author,
      isbn: b.isbn || '0000000',
    };
  });
  await seedTable('books', books, schoolOnly);
  
  if (!dbBookId) dbBookId = books.length > 0 ? getUuid(books[0].id) : null;
  
  const inventory = mockDb.books.slice(0, 1).map(b => {
    return { ...b, barcode: `BC-${Math.floor(Math.random()*10000)}` };
  });
  await seedTable('book_inventory', inventory, schoolAndSession);
  
  const bookIssues = mockDb.bookIssues.slice(0, 1).map(bi => {
    return { ...bi, userId: userId, studentId: studentId, bookId: dbBookId || getUuid(bi.bookId) };
  });
  await seedTable('book_issues', bookIssues, schoolOnly);
  await seedTable('book_returns', mockDb.bookReturns.slice(0, 1), schoolOnly);
  
  const seededIssueId = bookIssues.length > 0 ? getUuid(bookIssues[0].id) : null;
  const libraryFines = mockDb.libraryFines.slice(0, 1).map(lf => {
    const { isPaid, ...rest } = lf as any;
    return { ...rest, userId: userId, studentId: studentId, issueId: seededIssueId };
  });
  await seedTable('library_fines', libraryFines, schoolOnly);
  
  await seedTable('digital_library_assets', mockDb.digitalLibraryAssets.slice(0, 1), schoolAndSession);
  
  const exams = mockDb.exams.slice(0, 1);
  await seedTable('exams', exams, schoolAndSession);
  const seededExamId = exams.length > 0 ? getUuid(exams[0].id) : null;
  
  const examSubjects = mockDb.examSubjects.slice(0, 1).map((es, idx) => ({
    ...es,
    subjectId: idx === 0 ? subjectId : subjectId2
  }));
  await seedTable('exam_subjects', examSubjects, schoolOnly);
  
  const examMarks = mockDb.examMarks.slice(0, 1).map(em => {
    return {
       id: em.id,
       schoolId: schoolId,
       studentId: studentId,
       examId: seededExamId,
       subjectId: subjectId,
       marksObtained: em.marksObtained,
       remarks: em.remarks
    };
  });
  await seedTable('student_marks', examMarks, schoolOnly);
  
  const examResults = mockDb.examResults.slice(0, 1).map(er => ({
    ...er,
    studentId: studentId
  }));
  await seedTable('exam_results', examResults, schoolOnly);
}

main().catch(console.error);

