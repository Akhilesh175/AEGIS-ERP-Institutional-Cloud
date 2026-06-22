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
  const { data: history, error } = await supabase
    .from('sports_budget_history')
    .select('*, updater:users!updated_by(first_name, last_name)');
  
  console.log("Error:", error);
  console.log("Joined budget history:", history);
}

main().catch(console.error);
