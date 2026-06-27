/**
 * Inspect exact CHECK constraint definition via Supabase REST API
 */
const SUPABASE_URL = 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc2RjcHFreG94cGJpbmF6bWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4NDkzNiwiZXhwIjoyMDk1MzYwOTM2fQ.i3JVukYtqoEQVxIwzgMyicC_jwRgSsFkQ99BqRWPTrc';

const HEADERS = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function probe(status: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      school_id: '00000000-0000-0000-0000-000000000001',
      plan_code: 'basic', billing_cycle: 'MONTHLY',
      status: 'PENDING', subscription_status: status,
      expiry_date: '2026-06-26',
    })
  });
  const body = await r.text();
  const code = r.status;
  // 409 = FK violation (means the status value itself passed CHECK)
  // 400 + 23514 = CHECK constraint violation
  if (code === 409) {
    console.log(`subscription_status='${status}': ✅ ALLOWED (FK error only — school doesn't exist)`);
  } else if (body.includes('23514')) {
    console.log(`subscription_status='${status}': ❌ REJECTED by CHECK constraint`);
  } else if (code >= 200 && code < 300) {
    console.log(`subscription_status='${status}': ✅ ALLOWED (inserted — cleaned up)`);
    // cleanup
    const data = JSON.parse(body);
    const id = Array.isArray(data) ? data[0]?.id : data?.id;
    if (id) {
      await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${id}`, { method: 'DELETE', headers: HEADERS });
    }
  } else {
    console.log(`subscription_status='${status}': status=${code} body=${body.substring(0, 120)}`);
  }
}

async function main() {
  console.log('=== Probing subscription_status CHECK constraint allowed values ===\n');
  // Test all likely values
  const candidates = ['pending', 'trial', 'active', 'expired', 'cancelled', 'failed',
                      'PENDING', 'TRIAL', 'ACTIVE', 'EXPIRED', 'CANCELLED', 'FAILED',
                      'grace_period', 'paused', 'inactive'];
  for (const v of candidates) {
    await probe(v);
  }

  console.log('\n=== Probing status column CHECK constraint ===\n');
  // Also probe the `status` column
  const statusCandidates = ['PENDING', 'ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED', 'FAILED', 'INACTIVE',
                             'pending', 'active', 'trial', 'expired', 'cancelled', 'failed', 'inactive'];
  for (const v of statusCandidates) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        school_id: '00000000-0000-0000-0000-000000000001',
        plan_code: 'basic', billing_cycle: 'MONTHLY',
        status: v, subscription_status: 'trial',
        expiry_date: '2026-06-26',
      })
    });
    const body = await r.text();
    if (r.status === 409) {
      console.log(`status='${v}': ✅ ALLOWED`);
    } else if (body.includes('23514')) {
      console.log(`status='${v}': ❌ REJECTED by CHECK constraint`);
    } else if (r.status >= 200 && r.status < 300) {
      console.log(`status='${v}': ✅ ALLOWED (inserted)`);
      const data = JSON.parse(body);
      const id = Array.isArray(data) ? data[0]?.id : data?.id;
      if (id) await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${id}`, { method: 'DELETE', headers: HEADERS });
    } else {
      console.log(`status='${v}': ${r.status} ${body.substring(0, 100)}`);
    }
  }

  // Also check billing_cycle
  console.log('\n=== Probing billing_cycle allowed values ===\n');
  for (const v of ['MONTHLY', 'YEARLY', 'TRIAL', 'monthly', 'yearly', 'ANNUAL', 'annual']) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions`, {
      method: 'POST',
      headers: { ...HEADERS, 'Prefer': 'return=representation' },
      body: JSON.stringify({
        school_id: '00000000-0000-0000-0000-000000000001',
        plan_code: 'basic', billing_cycle: v,
        status: 'PENDING', subscription_status: 'trial',
        expiry_date: '2026-06-26',
      })
    });
    const body = await r.text();
    if (r.status === 409) {
      console.log(`billing_cycle='${v}': ✅ ALLOWED`);
    } else if (body.includes('23514') || body.includes('invalid input value')) {
      console.log(`billing_cycle='${v}': ❌ REJECTED`);
    } else if (r.status >= 200 && r.status < 300) {
      console.log(`billing_cycle='${v}': ✅ ALLOWED (inserted)`);
      const data = JSON.parse(body);
      const id = Array.isArray(data) ? data[0]?.id : data?.id;
      if (id) await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?id=eq.${id}`, { method: 'DELETE', headers: HEADERS });
    } else {
      console.log(`billing_cycle='${v}': ${r.status} ${body.substring(0, 100)}`);
    }
  }
}

main().catch(console.error);
