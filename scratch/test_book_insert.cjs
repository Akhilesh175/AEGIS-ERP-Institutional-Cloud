const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://frsdcpqkxoxpbinazmgz.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZyc2RjcHFreG94cGJpbmF6bWd6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc4NDkzNiwiZXhwIjoyMDk1MzYwOTM2fQ.i3JVukYtqoEQVxIwzgMyicC_jwRgSsFkQ99BqRWPTrc';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function testInsert() {
  const { data, error } = await supabase.from('book_inventory').insert({
    school_id: 'eaa39dd2-d93f-4583-81d4-c89b0ee83f3a',
    title: 'Test Book Title',
    author: 'Test Author',
    isbn: '1234567890',
    subject: 'Science',
    total_copies: 5,
    available_copies: 5,
    barcode: 'BAR-TEST-123'
  }).select();

  console.log('Insert Result:', data, 'Error:', error);
}

testInsert();
