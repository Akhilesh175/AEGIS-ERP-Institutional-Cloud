import fs from 'fs';
import path from 'path';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

async function getOpenApiSchema() {
  const url = `${supabaseUrl}/rest/v1/`;
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    const schema = await res.json();
    const tables = ['exams', 'exam_subjects', 'student_marks', 'report_cards'];
    tables.forEach(t => {
      const def = schema.definitions?.[t];
      if (def) {
        console.log(`\n=== Table: "${t}" ===`);
        Object.entries(def.properties || {}).forEach(([col, colDef]) => {
          console.log(`  - ${col}: ${colDef.type} (${colDef.format || 'no format'})`);
        });
      } else {
        console.log(`\n=== Table: "${t}" NOT FOUND ===`);
      }
    });
  } catch (err) {
    console.error('Failed to fetch schema:', err);
  }
}

getOpenApiSchema();
