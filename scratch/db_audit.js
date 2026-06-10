const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc2RjcHFreG94cGJpbmF6bWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4NDkzNiwiZXhwIjoyMDk1MzYwOTM2fQ.i3JVukYtqoEQVxIwzgMyicC_jwRgSsFkQ99BqRWPTrc';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function runAudit() {
  console.log('--- AUDITING SCHOOLS ---');
  const { data: schools, error: schoolErr } = await supabase.from('schools').select('*');
  if (schoolErr) console.error('Error fetching schools:', schoolErr);
  else console.log('Schools:', schools);

  console.log('\n--- AUDITING TRANSPORT ASSIGNMENTS ---');
  const { data: transAssign, error: transErr } = await supabase.from('transport_assignments').select('*').limit(5);
  if (transErr) console.error('Error fetching transport_assignments:', transErr);
  else console.log('Transport Assignments:', transAssign);

  console.log('\n--- AUDITING BOOK INVENTORY ---');
  const { data: books, error: bookErr } = await supabase.from('book_inventory').select('*').limit(5);
  if (bookErr) console.error('Error fetching book_inventory:', bookErr);
  else console.log('Book Inventory:', books);

  console.log('\n--- AUDITING REPORT CARDS ---');
  const { data: reportCards, error: rcErr } = await supabase.from('report_cards').select('*').limit(5);
  if (rcErr) console.error('Error fetching report_cards:', rcErr);
  else console.log('Report Cards:', reportCards);

  console.log('\n--- AUDITING FORUM CATEGORIES ---');
  const { data: forums, error: forumErr } = await supabase.from('forum_categories').select('*').limit(5);
  if (forumErr) console.error('Error fetching forum_categories:', forumErr);
  else console.log('Forum Categories:', forums);
}

runAudit();
