import * as fs from 'fs';
import * as path from 'path';

// Load env variables BEFORE importing anything else
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

async function run() {
  const { supabase } = await import('../src/lib/supabase.ts');
  const schoolId = '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342';
  
  console.log("Querying subscriptions with public anonymous client...");
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('school_id', schoolId)
    .limit(5);

  if (error) {
    console.error("Public query error:", error.message);
  } else {
    console.log("Public query data:", JSON.stringify(data, null, 2));
  }
}

run().catch(console.error);
