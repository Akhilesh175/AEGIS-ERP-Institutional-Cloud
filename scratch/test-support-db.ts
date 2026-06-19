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

async function run() {
  const { data: users } = await supabaseAdmin
    .from('users')
    .select('id, email, role, school_id')
    .limit(1);

  if (users && users.length > 0) {
    const testUser = users[0];
    const customTicketNum = 'TKT-' + Math.floor(100000 + Math.random() * 900000);
    console.log(`Testing insert with custom ticket number ${customTicketNum}...`);
    
    const { data: ticket, error: ticketError } = await supabaseAdmin
      .from('support_tickets')
      .insert({
        school_id: testUser.school_id,
        user_id: testUser.id,
        user_role: testUser.role,
        category: 'General',
        priority: 'MEDIUM',
        subject: 'Test Custom Ticket',
        description: 'Testing if pre-supplied ticket number bypasses sequence permission error.',
        status: 'OPEN',
        ticket_number: customTicketNum
      })
      .select()
      .single();

    if (ticketError) {
      console.error("Insert failed:", ticketError.message);
    } else {
      console.log("Insert succeeded!", ticket);
    }
  }
}

run().catch(console.error);
