const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
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
  const studentId = '0a0c1519-61af-46dc-8c25-18e7e8dc0141'; // Manan Yadav
  console.log("Checking payments for student:", studentId);
  
  const { data: pmts, error } = await supabaseAdmin
    .from('sports_fee_payments')
    .select('*')
    .eq('student_id', studentId);
  
  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Payments list:", pmts);
  }
}

run().catch(console.error);
