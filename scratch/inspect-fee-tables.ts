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
  console.log("=== INSPECTING FEE TABLES ===");
  
  // 1. fee_payments
  const { data: feePayments, error: err1 } = await supabaseAdmin.from('fee_payments').select('*').limit(2);
  console.log("fee_payments sample:", err1 ? err1.message : feePayments);

  // 2. hostel_fees
  const { data: hostelFees, error: err2 } = await supabaseAdmin.from('hostel_fees').select('*').limit(2);
  console.log("hostel_fees sample:", err2 ? err2.message : hostelFees);

  // 3. hostel_payments
  const { data: hostelPayments, error: err3 } = await supabaseAdmin.from('hostel_payments').select('*').limit(2);
  console.log("hostel_payments sample:", err3 ? err3.message : hostelPayments);

  // 4. transport_fee_records
  const { data: transportFeeRecords, error: err4 } = await supabaseAdmin.from('transport_fee_records').select('*').limit(2);
  console.log("transport_fee_records sample:", err4 ? err4.message : transportFeeRecords);
}

run().catch(console.error);
