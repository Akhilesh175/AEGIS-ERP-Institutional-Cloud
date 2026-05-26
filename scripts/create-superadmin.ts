import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Read .env manually
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

const SUPER_ADMIN_EMAIL    = 'jy7018080@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Akhilesh@18';
const OLD_EMAIL            = 'superadmin@aegis.com';

async function run() {
  console.log('🚀 Starting Super Admin setup...\n');

  // ── Step 1: Remove old placeholder superadmin if exists ──────────────────
  console.log('Step 1: Cleaning up old placeholder superadmin...');
  const { data: oldUsers } = await supabaseAdmin.auth.admin.listUsers();
  const oldUser = oldUsers?.users?.find(u => u.email === OLD_EMAIL);
  if (oldUser) {
    await supabaseAdmin.from('users').delete().eq('id', oldUser.id);
    await supabaseAdmin.auth.admin.deleteUser(oldUser.id);
    console.log(`  ✅ Deleted old auth user: ${OLD_EMAIL}`);
  } else {
    console.log(`  ℹ️  No old user found for ${OLD_EMAIL}, skipping.`);
  }

  // ── Step 2: Check if new Super Admin already exists ───────────────────────
  console.log(`\nStep 2: Checking if ${SUPER_ADMIN_EMAIL} already exists...`);
  const existingUser = oldUsers?.users?.find(u => u.email === SUPER_ADMIN_EMAIL);
  if (existingUser) {
    console.log(`  ⚠️  Auth user ${SUPER_ADMIN_EMAIL} already exists (id: ${existingUser.id})`);
    console.log('  Updating password and ensuring profile exists...');
    
    // Update password
    const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true
    });
    if (pwErr) { console.error('  ❌ Password update error:', pwErr); process.exit(1); }
    console.log('  ✅ Password updated');

    // Upsert profile
    const { error: profileErr } = await supabaseAdmin.from('users').upsert({
      id: existingUser.id,
      email: SUPER_ADMIN_EMAIL,
      role: 'SUPER_ADMIN',
      first_name: 'Super',
      last_name: 'Admin',
      is_active: true
    });
    if (profileErr) { console.error('  ❌ Profile upsert error:', profileErr); process.exit(1); }
    console.log('  ✅ Profile upserted');
    console.log('\n✅ Super Admin setup complete!');
    printSummary(existingUser.id);
    return;
  }

  // ── Step 3: Create new auth user ──────────────────────────────────────────
  console.log(`\nStep 3: Creating new auth user: ${SUPER_ADMIN_EMAIL}...`);
  const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    email_confirm: true   // Auto-confirms email — no verification email needed
  });
  if (authErr || !authData.user) {
    console.error('  ❌ Auth user creation error:', authErr);
    process.exit(1);
  }
  console.log(`  ✅ Auth user created (id: ${authData.user.id})`);

  // ── Step 4: Insert profile into public.users ──────────────────────────────
  console.log('\nStep 4: Creating Super Admin profile in users table...');
  const { error: profileErr } = await supabaseAdmin.from('users').insert({
    id: authData.user.id,
    email: SUPER_ADMIN_EMAIL,
    role: 'SUPER_ADMIN',
    first_name: 'Super',
    last_name: 'Admin',
    is_active: true
  });
  if (profileErr) {
    console.error('  ❌ Profile insert error:', profileErr);
    // Rollback auth user
    await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
    process.exit(1);
  }
  console.log('  ✅ Profile created in users table');

  // ── Step 5: Verify login works ────────────────────────────────────────────
  console.log('\nStep 5: Verifying login credentials...');
  const publicClient = createClient(supabaseUrl, env['VITE_SUPABASE_ANON_KEY']);
  const { data: loginData, error: loginErr } = await publicClient.auth.signInWithPassword({
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD
  });
  if (loginErr || !loginData.user) {
    console.error('  ❌ Login verification failed:', loginErr);
    process.exit(1);
  }
  console.log('  ✅ Login verified successfully!');
  await publicClient.auth.signOut();

  console.log('\n🎉 Super Admin setup complete!');
  printSummary(authData.user.id);
}

function printSummary(id: string) {
  console.log('\n─────────────────────────────────────────');
  console.log('  SUPER ADMIN CREDENTIALS');
  console.log('─────────────────────────────────────────');
  console.log(`  Email    : ${SUPER_ADMIN_EMAIL}`);
  console.log(`  Password : ${SUPER_ADMIN_PASSWORD}`);
  console.log(`  Role     : SUPER_ADMIN`);
  console.log(`  UUID     : ${id}`);
  console.log('─────────────────────────────────────────');
}

run().catch(err => { console.error('Fatal error:', err); process.exit(1); });
