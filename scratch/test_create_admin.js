import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envFile = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envFile.split('\n').forEach(line => {
  if (line && line.includes('=')) {
    const [key, val] = line.split('=');
    envVars[key.trim()] = val.trim();
  }
});

const supabaseAdmin = createClient(
  envVars['VITE_SUPABASE_URL'],
  envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'],
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// We define a minimal mockApi object or just copy the logic from mockApi.ts
async function superAdminCreateAdmin(superAdminId, email, firstName, lastName, schoolId, phone, password) {
  // 0. Validate school
  const { data: schoolCheck, error: schoolCheckError } = await supabaseAdmin
    .from('schools')
    .select('id')
    .eq('id', schoolId)
    .single();

  if (schoolCheckError || !schoolCheck) {
    throw new Error(
      'The selected institution does not exist in the database. ' +
      'Please refresh the page and try again — the school list may be out of sync.'
    );
  }

  // 1. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { school_id: schoolId, role: 'ADMIN' }
  });

  if (authError || !authData.user) {
    throw new Error('Failed to create admin auth user: ' + (authError?.message || 'Unknown error'));
  }

  const userId = authData.user.id;
  console.log('Successfully created auth user:', userId);

  // 2. Insert into users table
  const { error: dbError } = await supabaseAdmin.from('users').insert({
    id: userId,
    email,
    role: 'ADMIN',
    first_name: firstName,
    last_name: lastName,
    phone,
    school_id: schoolId,
    is_active: true
  });

  if (dbError) {
    console.error('Failed to insert into users table:', dbError);
    // Rollback
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error('Failed to create admin user profile: ' + dbError.message);
  }
  console.log('Successfully inserted user profile into users table');

  // 3. Insert into school_admins table
  const { error: adminTableError } = await supabaseAdmin.from('school_admins').insert({
    user_id: userId,
    school_id: schoolId,
    role_settings: 'ADMIN',
    permissions: { all: true },
    status: 'ACTIVE'
  });

  if (adminTableError) {
    console.error('Failed to insert into school_admins table:', adminTableError);
    // Rollback
    await supabaseAdmin.from('users').delete().eq('id', userId);
    await supabaseAdmin.auth.admin.deleteUser(userId);
    throw new Error('Failed to create school admin record: ' + adminTableError.message);
  }
  console.log('Successfully inserted school admin record into school_admins table');
}

async function run() {
  const schoolId = '3d7a70e5-8aa0-40f6-8e9b-c22abb001cdd'; // XYZ PUBLIC SCHOOL
  const email = `test_admin_${Date.now()}@example.com`;
  
  console.log('Testing creating admin with email:', email);
  await superAdminCreateAdmin('dummy-super-admin', email, 'Test', 'Admin', schoolId, '1234567890', 'securepassword123');
  console.log('Test admin creation complete!');
}

run().catch(console.error);
