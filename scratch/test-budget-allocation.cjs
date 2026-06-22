const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

let supabaseUrl, supabaseServiceKey;
try {
  const envContent = fs.readFileSync('.env', 'utf-8');
  for (const line of envContent.split('\n')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key === 'VITE_SUPABASE_URL') supabaseUrl = value.trim();
    if (key === 'VITE_SUPABASE_SERVICE_ROLE_KEY') supabaseServiceKey = value.trim();
  }
} catch (err) {
  console.error(err);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

async function main() {
  // Let's find a user who is a FINANCE_ADMIN to allocate budget
  const { data: users } = await supabase.from('users').select('id, role, school_id').eq('role', 'FINANCE_ADMIN').limit(1);
  if (!users || users.length === 0) {
    console.error("No Finance Admin found");
    return;
  }
  const financeUser = users[0];
  console.log("Finance Admin User:", financeUser);

  // Let's find an academic session
  const { data: sessions } = await supabase.from('academic_sessions').select('id').limit(1);
  if (!sessions || sessions.length === 0) {
    console.error("No academic session found");
    return;
  }
  const sessionId = sessions[0].id;
  console.log("Academic Session ID:", sessionId);

  // Call mockApi simulation logic for allocateBudget
  const category = 'TRAVEL';
  const newAmount = 15000;

  // 1. Get old amount
  const { data: existing } = await supabase
    .from('sports_budget_allocations')
    .select('id, allocated_amount')
    .eq('school_id', financeUser.school_id)
    .eq('academic_session_id', sessionId)
    .eq('category', category)
    .maybeSingle();

  const oldAmount = existing ? Number(existing.allocated_amount) : 0;
  console.log(`Old Amount: ${oldAmount}, New Amount: ${newAmount}`);

  // 2. Upsert
  const { data: upserted, error: upsertErr } = await supabase
    .from('sports_budget_allocations')
    .upsert({
      school_id: financeUser.school_id,
      academic_session_id: sessionId,
      allocated_amount: newAmount,
      category: category
    }, { onConflict: 'school_id,academic_session_id,category' })
    .select()
    .single();

  if (upsertErr) {
    console.error("Upsert error:", upsertErr);
    return;
  }
  console.log("Upserted:", upserted);

  // 3. Log history
  const { data: historyInsert, error: histErr } = await supabase
    .from('sports_budget_history')
    .insert({
      school_id: financeUser.school_id,
      category: category,
      old_amount: oldAmount,
      new_amount: newAmount,
      updated_by: financeUser.id
    })
    .select()
    .single();

  if (histErr) {
    console.error("History insert error:", histErr);
  } else {
    console.log("History Inserted successfully:", historyInsert);
  }

  // Let's query history again
  const { data: historyList } = await supabase.from('sports_budget_history').select('*');
  console.log("Updated Budget History List:", historyList);
}

main().catch(console.error);
