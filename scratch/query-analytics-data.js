import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, ...parts] = line.split('=');
    envVars[key.trim()] = parts.join('=').trim();
  }
});

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

async function run() {
  const schoolId = '39b3c4f3-cb58-41c7-be8d-bfd6dee31350';
  console.log(`=== QUERYING DATABASE FOR SCHOOL ${schoolId} ===`);

  const { data: fees } = await supabaseAdmin.from('fee_structures').select('*').eq('school_id', schoolId);
  console.log('Fee structures count:', fees?.length);
  if (fees) console.log('Fee structures:', fees);

  const { data: payments } = await supabaseAdmin.from('fee_payments').select('*');
  console.log('Fee payments count:', payments?.length);
  if (payments) console.log('Fee payments:', payments);

  const { data: transport } = await supabaseAdmin.from('transport_fee_records').select('*').eq('school_id', schoolId);
  console.log('Transport fee records count:', transport?.length);
  if (transport) console.log('Transport fee records:', transport);

  const { data: hostelFees } = await supabaseAdmin.from('hostel_fees').select('*').eq('school_id', schoolId);
  console.log('Hostel fees count:', hostelFees?.length);
  if (hostelFees) console.log('Hostel fees:', hostelFees);

  const { data: hostelPayments } = await supabaseAdmin.from('hostel_payments').select('*').eq('school_id', schoolId);
  console.log('Hostel payments count:', hostelPayments?.length);
  if (hostelPayments) console.log('Hostel payments:', hostelPayments);

  const { data: homeworks } = await supabaseAdmin.from('homeworks').select('*').eq('school_id', schoolId);
  console.log('Homeworks count:', homeworks?.length);
  if (homeworks) console.log('Homeworks:', homeworks);

  const { data: hwSubs } = await supabaseAdmin.from('homework_submissions').select('*').eq('school_id', schoolId);
  console.log('Homework submissions count:', hwSubs?.length);
  if (hwSubs) console.log('Homework submissions:', hwSubs);
}

run();
