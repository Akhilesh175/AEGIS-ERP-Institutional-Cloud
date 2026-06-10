const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.substring(1, value.length - 1);
    }
    env[key] = value.trim();
  }
});

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function main() {
  console.log('--- SCHOOLS ---');
  const { data: schools } = await supabase.from('schools').select('id, name');
  console.log(schools);

  console.log('--- ACADEMIC SESSIONS ---');
  const { data: sessions } = await supabase.from('academic_sessions').select('id, school_id, name, is_current');
  console.log(sessions);

  console.log('--- CLASSES ---');
  const { data: classes } = await supabase.from('classes').select('id, name, school_id').limit(5);
  console.log(classes);

  console.log('--- SUBJECTS ---');
  const { data: subjects } = await supabase.from('subjects').select('id, name, school_id').limit(5);
  console.log(subjects);
}

main().catch(console.error);
