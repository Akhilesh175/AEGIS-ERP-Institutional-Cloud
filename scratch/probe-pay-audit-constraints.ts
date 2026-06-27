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

async function probe(action: string) {
  const { error } = await supabaseAdmin.from('payment_audit_logs').insert({
    payment_id: 'c151059b-4ea4-42c7-81c2-cbb17bf7c403', // Valid employee payment ID
    school_id: '0a5e1f1a-8a04-4b77-8215-a7ab9a48e342',
    event_type: 'PAYMENT_VERIFIED',
    action: action,
    performed_by: '58adfee0-aacb-4900-9246-a1364ca01750', // Any valid user UUID
    razorpay_order_id: 'order_test',
    razorpay_payment_id: 'pay_test',
    amount: 100,
    performed_at: new Date().toISOString()
  });

  if (error && error.message.includes('violates check constraint')) {
    console.log(`action='${action}': ❌ REJECTED`);
  } else {
    console.log(`action='${action}': ✅ ALLOWED (error details: ${error?.message})`);
    // Delete if inserted
    if (!error) {
      await supabaseAdmin.from('payment_audit_logs').delete().eq('action', action).eq('amount', 100);
    }
  }
}

async function main() {
  const candidates = ['SUBMITTED', 'APPROVED', 'REJECTED', 'CANCELLED', 'PAID', 'PAYMENT_VERIFIED', 'WEBHOOK_PAYMENT_CAPTURED'];
  for (const c of candidates) {
    await probe(c);
  }
}

main().catch(console.error);
