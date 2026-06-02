import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Read .env file manually
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    const key = parts[0].trim();
    const value = parts.slice(1).join('=').trim();
    env[key] = value;
  }
});

const supabase = createClient(
  env.VITE_SUPABASE_URL,
  env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  const tables = [
    'transport_buses',
    'transport_routes',
    'pickup_stops',
    'transport_assignments',
    'driver_attendance',
    'drivers',
    'exams',
    'exam_results',
    'marksheets',
    'admit_cards',
    'report_cards',
    'quiz_results'
  ];

  console.log("Checking presence of alternative table names...");

  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.log(`Table '${table}': does NOT exist or error (${error.message})`);
    } else {
      console.log(`Table '${table}': EXISTS!`);
      if (data.length > 0) {
        console.log(`  Columns:`, Object.keys(data[0]));
      } else {
        // Since table is empty, let's try inserting an empty object to see the columns in the error, or do a dummy insert
        const { error: insErr } = await supabase.from(table).insert({});
        if (insErr) {
          console.log(`  Dummy insert error (reveals columns):`, insErr.message);
        }
      }
    }
  }
}

run();
