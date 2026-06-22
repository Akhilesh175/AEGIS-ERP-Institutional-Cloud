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
  console.log("Checking sports_fee_invoices...");
  const { data: data1, error: error1 } = await supabaseAdmin.from('sports_fee_invoices').select('*').limit(1);
  if (error1) {
    console.error("sports_fee_invoices error:", error1.message);
  } else {
    console.log("sports_fee_invoices exists! Rows:", data1);
  }

  console.log("Checking sports_fee_payments...");
  const { data: data2, error: error2 } = await supabaseAdmin.from('sports_fee_payments').select('*').limit(1);
  if (error2) {
    console.error("sports_fee_payments error:", error2.message);
  } else {
    console.log("sports_fee_payments exists! Rows:", data2);
  }

  console.log("Checking school_payment_settings...");
  const { data: data3, error: error3 } = await supabaseAdmin.from('school_payment_settings').select('*').limit(1);
  if (error3) {
    console.error("school_payment_settings error:", error3.message);
  } else {
    console.log("school_payment_settings exists! Rows:", data3);
  }
}

run().catch(console.error);
