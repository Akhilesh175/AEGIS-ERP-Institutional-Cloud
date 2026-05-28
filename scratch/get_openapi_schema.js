import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const apiKey = envVars['VITE_SUPABASE_ANON_KEY'];

async function getOpenApiSchema() {
  const url = `${supabaseUrl}/rest/v1/?apikey=${apiKey}`;
  console.log('Fetching OpenAPI schema from:', url);
  try {
    const res = await fetch(url);
    const schema = await res.json();
    const tables = ['quizzes', 'quiz_questions', 'quiz_attempts'];
    tables.forEach(t => {
      console.log(`\n--- Schema for table "${t}" ---`);
      const def = schema.definitions?.[t];
      if (def) {
        console.log('Properties:');
        Object.entries(def.properties || {}).forEach(([col, colDef]) => {
          console.log(`- ${col}: ${colDef.type} (${colDef.format || 'no format'})`);
        });
      } else {
        console.log(`Table "${t}" definition not found in OpenAPI spec.`);
      }
    });
  } catch (err) {
    console.error('Failed to fetch schema:', err);
  }
}

getOpenApiSchema();
