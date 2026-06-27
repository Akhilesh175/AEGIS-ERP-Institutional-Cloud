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

async function run() {
  const response = await fetch(`${supabaseUrl}/rest/v1/?apikey=${supabaseServiceKey}`);
  const schema = await response.json();
  if (schema && schema.definitions) {
    const targetTables = [
      'payment_orders',
      'payment_transactions',
      'subscription_payments',
      'subscription_plans',
      'payment_audit_logs',
      'payment_failures',
      'refunds',
      'webhook_logs',
      'payments',
      'subscriptions',
      'subscription_invoices',
      'subscription_coupons',
      'subscription_coupon_usages',
      'subscription_audit_logs'
    ];

    for (const t of targetTables) {
      if (schema.definitions[t]) {
        console.log(`Table [${t}] exists. Columns:`, Object.keys(schema.definitions[t].properties));
      } else {
        console.log(`Table [${t}] DOES NOT exist.`);
      }
    }
  } else {
    console.log('Could not load definitions:', schema);
  }
}
run().catch(console.error);
