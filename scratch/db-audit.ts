/**
 * AEGIS ERP — Full Database Schema Audit
 * Inspects subscriptions table: columns, constraints, check constraints, triggers, indexes
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const SERVICE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc2RjcHFreG94cGJpbmF6bWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4NDkzNiwiZXhwIjoyMDk1MzYwOTM2fQ.i3JVukYtqoEQVxIwzgMyicC_jwRgSsFkQ99BqRWPTrc';

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function query(sql: string, params?: any[]) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params })
  });
  return res.json();
}

async function rawQuery(sql: string) {
  // Use Supabase pg via RPC if available, else direct
  const { data, error } = await sb.rpc('exec_sql', { sql }).maybeSingle();
  return { data, error };
}

async function main() {
  const BASE = `${SUPABASE_URL}/rest/v1/`;
  const HEADERS = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
  };

  // ── 1. Check constraints on subscriptions table ──
  console.log('\n=== CHECK CONSTRAINTS on subscriptions ===');
  const chkRes = await fetch(`${BASE}rpc/exec_sql`, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ sql: `
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'public.subscriptions'::regclass
        AND contype = 'c'
      ORDER BY conname;
    `})
  });
  if (chkRes.ok) {
    const txt = await chkRes.text();
    console.log('CHECK CONSTRAINTS:', txt);
  } else {
    console.log('CHECK CONSTRAINT query status:', chkRes.status);
  }

  // ── 2. Column definitions ──
  console.log('\n=== COLUMNS of subscriptions ===');
  const colRes = await fetch(`${BASE}rpc/exec_sql`, {
    method: 'POST', headers: HEADERS,
    body: JSON.stringify({ sql: `
      SELECT column_name, data_type, column_default, is_nullable,
             character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'subscriptions'
      ORDER BY ordinal_position;
    `})
  });
  if (colRes.ok) {
    console.log('COLUMNS:', await colRes.text());
  } else {
    console.log('COLUMNS query status:', colRes.status);
  }

  // ── 3. Try direct REST API scan of subscriptions table ──
  console.log('\n=== SAMPLE ROWS from subscriptions (limit 3) ===');
  const rowRes = await fetch(`${BASE}subscriptions?limit=3&order=created_at.desc`, {
    headers: HEADERS
  });
  if (rowRes.ok) {
    const rows = await rowRes.json();
    if (Array.isArray(rows) && rows.length > 0) {
      console.log('Column names:', Object.keys(rows[0]));
      console.log('Sample status values:', rows.map((r: any) => ({ status: r.status, subscription_status: r.subscription_status })));
    } else {
      console.log('Rows:', JSON.stringify(rows, null, 2));
    }
  } else {
    console.log('Rows query status:', rowRes.status, await rowRes.text());
  }

  // ── 4. Try to insert a PENDING subscription to see exact error ──
  console.log('\n=== PROBING: insert subscription_status=pending ===');
  const probeRes = await fetch(`${BASE}subscriptions`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      school_id: '00000000-0000-0000-0000-000000000001',
      plan_code: 'basic',
      billing_cycle: 'MONTHLY',
      status: 'PENDING',
      subscription_status: 'pending',
      expiry_date: '2026-06-26',
    })
  });
  const probeBody = await probeRes.text();
  console.log('INSERT pending probe status:', probeRes.status);
  console.log('INSERT pending probe body:', probeBody);

  // ── 5. Try trial ──
  console.log('\n=== PROBING: insert subscription_status=trial ===');
  const probe2Res = await fetch(`${BASE}subscriptions`, {
    method: 'POST',
    headers: { ...HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify({
      school_id: '00000000-0000-0000-0000-000000000001',
      plan_code: 'basic',
      billing_cycle: 'MONTHLY',
      status: 'PENDING',
      subscription_status: 'trial',
      expiry_date: '2026-06-26',
    })
  });
  const probe2Body = await probe2Res.text();
  console.log('INSERT trial probe status:', probe2Res.status);
  console.log('INSERT trial probe body:', probe2Body.substring(0, 300));

  // Clean up probe rows
  if (probe2Res.ok) {
    const probe2Data = JSON.parse(probe2Body);
    const id = Array.isArray(probe2Data) ? probe2Data[0]?.id : probe2Data?.id;
    if (id) {
      await fetch(`${BASE}subscriptions?id=eq.${id}`, {
        method: 'DELETE', headers: HEADERS
      });
      console.log('Cleaned up probe row:', id);
    }
  }
}

main().catch(console.error);
