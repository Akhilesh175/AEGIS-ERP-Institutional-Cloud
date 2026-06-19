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

async function run() {
  console.log("Analyzing mockApi.ts to extract table names...");
  
  const mockApiPath = path.resolve(process.cwd(), 'src/services/mockApi.ts');
  const mockApiContent = fs.readFileSync(mockApiPath, 'utf-8');
  
  // Extract table/bucket names from from('...') or from("...")
  const matches = mockApiContent.match(/\.from\(['"]([^'"]+)['"]\)/g) || [];
  const candidateNames = Array.from(new Set(matches.map(m => {
    const matched = m.match(/\.from\(['"]([^'"]+)['"]\)/);
    return matched ? matched[1] : '';
  }).filter(name => name && name.trim() !== '')));

  console.log(`Extracted ${candidateNames.length} unique candidates:`, candidateNames);

  // Filter out known storage buckets (which typically fail standard table SELECT, or are known buckets)
  const knownBuckets = [
    'avatars', 'school-assets', 'admin-signatures', 'teacher-signatures', 
    'homeworks', 'homework_attachments', 'class-materials', 'assignment-submissions',
    'library-covers', 'communicator-attachments', 'support-attachments'
  ];

  const tables = candidateNames.filter(name => !knownBuckets.includes(name));
  
  console.log(`Analyzing ${tables.length} potential database tables...`);
  
  const report: Array<{
    table: string;
    schoolIdCol: string;
    countSchool1: number;
    countUuid: number;
    totalCount: number;
  }> = [];

  for (const table of tables) {
    try {
      // First, test if it's a valid table and check columns
      const { data, error: sampleError } = await supabaseAdmin.from(table).select('*').limit(1);
      
      if (sampleError) {
        // Table might not exist or might be a storage bucket/view with special permissions
        continue;
      }
      
      // Determine column name
      let schoolIdCol = '';
      const { error: schoolIdErr } = await supabaseAdmin.from(table).select('school_id').limit(1);
      if (!schoolIdErr) {
        schoolIdCol = 'school_id';
      } else {
        const { error: schoolIdCamelErr } = await supabaseAdmin.from(table).select('schoolId').limit(1);
        if (!schoolIdCamelErr) {
          schoolIdCol = 'schoolId';
        }
      }
      
      if (schoolIdCol) {
        // Query count of 'school-1'
        const { count: countSchool1 } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(schoolIdCol, 'school-1');
          
        // Query count of UUID
        const { count: countUuid } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(schoolIdCol, '39b3c4f3-cb58-41c7-be8d-bfd6dee31350');

        const { count: totalCount } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact', head: true });
          
        report.push({
          table,
          schoolIdCol,
          countSchool1: countSchool1 || 0,
          countUuid: countUuid || 0,
          totalCount: totalCount || 0
        });
      }
    } catch (err) {
      // Ignore errors for individual tables
    }
  }
  
  console.log("\n--- DATABASE AUDIT REPORT ---");
  console.table(report);
  
  // Also list files under migrations just to be thorough
  fs.writeFileSync('scratch/database-audit-results.json', JSON.stringify(report, null, 2));
  console.log("\nSaved database audit results to scratch/database-audit-results.json");
}

run().catch(console.error);
