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
  const schoolId = '129f2529-9a8a-4d72-8641-d6b834a99a02';
  const studentId = '7b55f77a-0558-4355-96c8-6d22a1ad82ef';

  const { data: fees, error: feesErr } = await supabaseAdmin
    .from('sports_fees')
    .select('*')
    .eq('school_id', schoolId);

  const { data: pmts, error: pmtsErr } = await supabaseAdmin
    .from('sports_fee_payments')
    .select('*')
    .eq('student_id', studentId);

  if (feesErr || pmtsErr) {
    console.error("Error:", feesErr || pmtsErr);
    return;
  }

  console.log("Fees for school:", fees);
  console.log("Payments for student:", pmts);

  const paidFeeIds = pmts.map(p => p.sports_fee_id);
  const unpaidFees = fees.filter(f => !paidFeeIds.includes(f.id));
  console.log("Unpaid fees for student:", unpaidFees);
}

run().catch(console.error);
