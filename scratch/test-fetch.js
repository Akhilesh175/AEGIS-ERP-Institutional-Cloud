import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf8');
const getEnv = (key) => {
  const line = env.split('\n').find(l => l.startsWith(key + '='));
  return line ? line.split('=')[1].trim() : null;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL');
const supabaseServiceKey = getEnv('VITE_SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const adminRoles = [
    'ADMIN', 'SUPER_ADMIN', 'FINANCE_ADMIN', 'ACADEMIC_ADMIN', 
    'EXAM_CONTROLLER', 'LIBRARIAN', 'TRANSPORT_MANAGER', 'CUSTOM_SUB_ADMIN',
    'HOSTEL_ADMIN', 'WARDEN'
  ];
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('school_id', '0dccd8a8-ec60-42d2-8f2e-381c01f49ac8')
    .in('role', adminRoles);

  console.log('Error:', error);
  console.log('Data count:', data?.length);
  console.log('Data:', data?.map(d => ({ id: d.id, first_name: d.first_name, role: d.role, is_active: d.is_active })));
}

check();
