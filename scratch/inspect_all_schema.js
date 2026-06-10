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
  console.log('Fetching OpenAPI schema from:', url);
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': serviceRoleKey,
        'Authorization': `Bearer ${serviceRoleKey}`
      }
    });
    const schema = await res.json();
    const tablesToInspect = [
      'homeworks', 'assignments', 'homework_attachments', 'assignment_submissions',
      'quizzes', 'quiz_questions', 'quiz_attempts', 'quiz_results',
      'study_materials', 'forum_categories', 'forum_posts', 'forum_comments', 'forum_replies',
      'book_categories', 'books', 'book_inventory', 'book_issues', 'book_returns', 'digital_library', 'digital_library_assets',
      'transport_assignments', 'student_transport_assignments', 'routes', 'buses', 'drivers', 'vehicle_logs', 'transport_fee_records'
    ];
    
    tablesToInspect.forEach(t => {
      const def = schema.definitions?.[t];
      if (def) {
        console.log(`\n=== Table: "${t}" ===`);
        Object.entries(def.properties || {}).forEach(([col, colDef]) => {
          console.log(`  - ${col}: ${colDef.type} (${colDef.format || 'no format'})`);
        });
      } else {
        console.log(`\n=== Table: "${t}" (NOT FOUND in OpenAPI schema) ===`);
      }
    });
  } catch (err) {
    console.error('Failed to fetch schema:', err);
  }
}

getOpenApiSchema();
