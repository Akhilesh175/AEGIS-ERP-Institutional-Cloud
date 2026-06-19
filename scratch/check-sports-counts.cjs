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
  const tables = [
    'sports_categories',
    'sports',
    'sports_coaches',
    'sports_enrollments',
    'sports_teams',
    'sports_team_members',
    'sports_training_sessions',
    'sports_attendance',
    'sports_performance_metrics',
    'sports_tournaments',
    'sports_fixtures',
    'sports_matches',
    'sports_results',
    'sports_rankings',
    'sports_certificates',
    'sports_achievements',
    'sports_medical_records',
    'sports_equipment',
    'sports_equipment_logs',
    'sports_fees',
    'sports_fee_payments',
    'sports_notifications',
    'sports_activity_logs'
  ];

  for (const table of tables) {
    const { count, error } = await supabaseAdmin
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error querying count for ${table}:`, error.message);
    } else {
      console.log(`SELECT COUNT(*) FROM ${table}; -> ${count}`);
    }
  }
}

run().catch(console.error);
