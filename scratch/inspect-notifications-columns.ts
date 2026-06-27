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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  const { data, error } = await supabaseAdmin.rpc('get_table_columns', { table_name: 'notifications' });
  if (error) {
    console.error("RPC failed, falling back to SQL query via query builder on a dummy check");
    // Let's try to update read_at to null on a non-existent ID to see if it complains about the column
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', '00000000-0000-0000-0000-000000000000');
    console.log("Update with read_at error:", updateError);
  } else {
    console.log("Columns:", data);
  }
}

run().catch(console.error);
