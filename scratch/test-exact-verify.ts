import * as fs from 'fs';
import * as path from 'path';

// Load env variables BEFORE importing handler
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

import { createClient } from '@supabase/supabase-js';
const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '', {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function test() {
  const paymentId = '0b0177af-8d86-45f8-837d-622f68772455';
  
  // 1. Reset payment to PENDING
  console.log("Resetting payment status to PENDING...");
  await supabaseAdmin.from('payments').update({ status: 'PENDING' }).eq('id', paymentId);
  
  // 2. Reset the subscription to PENDING
  console.log("Resetting subscription status to PENDING...");
  const { data: pay } = await supabaseAdmin.from('payments').select('subscription_id').eq('id', paymentId).single();
  if (pay?.subscription_id) {
    await supabaseAdmin.from('subscriptions').update({ status: 'PENDING', subscription_status: 'trial' }).eq('id', pay.subscription_id);
  }

  // Import handler dynamically
  const handler = (await import('../api/_lib/payments/verify-payment.ts')).default;
  const mockReq = {
    method: 'POST',
    body: {
      paymentId: paymentId,
      razorpayOrderId: 'order_test_123',
      razorpayPaymentId: 'pay_test_123',
      razorpaySignature: 'sig_test_123',
      isFree: true
    },
    headers: {
      'x-forwarded-for': '127.0.0.1'
    }
  };

  const mockRes = {
    status(code: number) {
      console.log('HTTP STATUS:', code);
      return this;
    },
    json(body: any) {
      console.log('RESPONSE BODY:', JSON.stringify(body, null, 2));
      return this;
    },
    end() {
      console.log('END REQUEST');
      return this;
    }
  };

  try {
    await handler(mockReq, mockRes);
  } catch (err: any) {
    console.error('CRASH OUTSIDE HANDLER:', err);
  }
}

test().catch(console.error);
