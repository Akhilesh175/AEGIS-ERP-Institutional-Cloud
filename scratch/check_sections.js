import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env file manually
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseServiceKey = env.VITE_SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  console.log("Querying sections table metadata/rows...");
  const { data, error } = await supabase.from('sections').select('*').limit(5);
  if (error) {
    console.error("Error fetching sections:", error.message);
  } else {
    console.log("Sections rows:", data);
  }

  // Let's also check if there are columns or check students class/section relations
  const { data: students, error: sErr } = await supabase.from('students').select('*').limit(1);
  if (sErr) {
    console.error("Error fetching students:", sErr.message);
  } else {
    console.log("Students sample:", students);
  }
}

main().catch(console.error);
