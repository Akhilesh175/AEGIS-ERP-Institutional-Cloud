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

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function run() {
  console.log("=== PTM MEETINGS ===");
  const { data: meetings, error: mErr } = await supabaseAdmin
    .from('ptm_meetings')
    .select('*');
  if (mErr) console.error("Meetings error:", mErr);
  else console.log("Meetings count:", meetings.length, "\nMeetings sample:", JSON.stringify(meetings, null, 2));

  console.log("=== PTM MESSAGES ===");
  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('ptm_messages')
    .select('*');
  if (msgErr) console.error("Messages error:", msgErr);
  else console.log("Messages count:", messages.length, "\nMessages sample:", JSON.stringify(messages, null, 2));

  console.log("=== PTM CHAT ATTACHMENTS ===");
  const { data: attachments, error: attErr } = await supabaseAdmin
    .from('ptm_chat_attachments')
    .select('*');
  if (attErr) console.error("Attachments error:", attErr);
  else console.log("Attachments count:", attachments.length, "\nAttachments sample:", JSON.stringify(attachments, null, 2));
}

run().catch(console.error);
