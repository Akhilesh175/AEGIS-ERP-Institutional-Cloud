// Mock localStorage
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = val; },
  removeItem: (key) => { delete mockStorage[key]; }
};

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

const { mockApi } = require('../src/services/mockApi.cjs');

async function run() {
  console.log('--- Simulating admin login ---');
  try {
    const session = await mockApi.login('jp@gmail.com', 'Password123!');
    console.log('Returned session:', JSON.stringify(session, null, 2));
  } catch (err) {
    console.error('Login error:', err.message);
  }
}

run().catch(console.error);
