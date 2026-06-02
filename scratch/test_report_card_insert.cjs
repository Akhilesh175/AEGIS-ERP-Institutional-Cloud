const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read .env manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Mock database local state (empty or default seed)
const mockDb = {
  academicSessions: [
    { id: 'session-1', schoolId: 'school-1', name: '2025-2026 Academic Year', startDate: '2025-09-01', endDate: '2026-06-30', isCurrent: true }
  ]
};

const mockApi = {
  async resolveActiveSessionId(schoolId) {
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const activeSession = mockDb.academicSessions.find(s => s.schoolId === schoolId && s.isCurrent && isUUID(s.id));
    if (activeSession) {
      return activeSession.id;
    }
    const { data: sessRow } = await supabaseAdmin
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .eq('is_current', true)
      .maybeSingle();
    if (sessRow && isUUID(sessRow.id)) {
      return sessRow.id;
    }
    const { data: anyRow } = await supabaseAdmin
      .from('academic_sessions')
      .select('id')
      .eq('school_id', schoolId)
      .order('is_current', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (anyRow && isUUID(anyRow.id)) {
      return anyRow.id;
    }
    const { data: newSess, error } = await supabaseAdmin
      .from('academic_sessions')
      .insert({
        school_id: schoolId,
        name: '2025-2026 Academic Year',
        start_date: '2025-09-01',
        end_date: '2026-06-30',
        is_current: true
      })
      .select('id')
      .single();
    if (error || !newSess) {
      throw new Error('Failed to resolve or create a valid Academic Session: ' + (error?.message || 'Unknown error'));
    }
    return newSess.id;
  },

  async createReportCard(
    schoolId, sessionId, studentId, term, 
    attendancePercentage, gradePointAverage, remarks, fileUrl
  ) {
    const isUUID = (str) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    const resolvedSessionId = (sessionId && isUUID(sessionId)) 
      ? sessionId 
      : await this.resolveActiveSessionId(schoolId);

    const { error } = await supabaseAdmin.from('report_cards').insert({
      school_id: schoolId,
      academic_session_id: resolvedSessionId,
      student_id: studentId,
      term: term,
      attendance_percentage: attendancePercentage,
      grade_point_average: gradePointAverage,
      remarks: remarks,
      file_url: fileUrl
    });
    if (error) throw new Error('Failed to publish student report card: ' + error.message);
  }
};

async function run() {
  const schoolId = '65e1b24f-f8ac-4dea-ad32-2e4973e43d3c';
  const studentId = '12143737-58b7-4b48-a9a3-bef1cceb9ead';

  console.log("Running createReportCard with academicSessionId = '' (mimicking frontend null/empty session):");
  try {
    await mockApi.createReportCard(schoolId, '', studentId, 'TERM 1', 90, 8.5, 'Excellent', '');
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err.message);
  }
  
  console.log("\nRunning createReportCard with academicSessionId = 'session-1' (mimicking frontend legacy session):");
  try {
    await mockApi.createReportCard(schoolId, 'session-1', studentId, 'TERM 1', 90, 8.5, 'Excellent', '');
    console.log("Success!");
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run().catch(console.error);
