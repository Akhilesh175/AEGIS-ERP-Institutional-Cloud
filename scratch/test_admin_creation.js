import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Read .env file manually
const envFile = fs.readFileSync('.env', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function run() {
  const schoolId = 'cd6e9aa8-ebe1-4e57-b4a2-5c4c84dd2762'; // PARANTAP PUBLIC SCHOOL
  const email = 'test_admin_' + Math.random().toString(36).substr(2, 5) + '@school.com';
  const firstName = 'Test';
  const lastName = 'Admin';
  const phone = '+919999999999';
  const password = 'password123';

  console.log('Testing admin creation with schoolId:', schoolId);

  try {
    // 0. Validate that the school actually exists in Supabase
    const { data: schoolCheck, error: schoolCheckError } = await supabaseAdmin
      .from('schools')
      .select('id')
      .eq('id', schoolId)
      .single();

    if (schoolCheckError || !schoolCheck) {
      throw new Error(
        'The selected institution does not exist in the database. ' +
        'Please refresh the page and try again — the school list may be out of sync. ' +
        (schoolCheckError ? JSON.stringify(schoolCheckError) : '')
      );
    }

    console.log('School exists. Creating auth user...');

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { school_id: schoolId, role: 'ADMIN' }
    });

    if (authError || !authData.user) {
      throw new Error('Failed to create admin auth user: ' + JSON.stringify(authError));
    }

    console.log('Auth user created with ID:', authData.user.id);

    // 2. Insert into users table
    const { error: dbError } = await supabaseAdmin.from('users').insert({
      id: authData.user.id,
      email,
      role: 'ADMIN',
      first_name: firstName,
      last_name: lastName,
      phone,
      school_id: schoolId,
      is_active: true
    });

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Failed to create admin user profile: ' + JSON.stringify(dbError));
    }

    console.log('User profile created. Inserting into school_admins...');

    // 3. Insert into school_admins table
    const { error: adminTableError } = await supabaseAdmin.from('school_admins').insert({
      user_id: authData.user.id,
      school_id: schoolId,
      role_settings: 'ADMIN',
      permissions: { all: true },
      status: 'ACTIVE'
    });

    if (adminTableError) {
      await supabaseAdmin.from('users').delete().eq('id', authData.user.id);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error('Failed to create school admin record: ' + JSON.stringify(adminTableError));
    }

    console.log('School admin record created successfully!');
  } catch (err) {
    console.error('FAILED:', err.message);
  }
}

run();
