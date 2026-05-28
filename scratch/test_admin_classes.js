import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Mock localStorage for getAdminSchoolId
const mockStorage = {
  aegis_session: JSON.stringify({
    user: {
      id: 'mock-admin-id',
      email: 'jp@gmail.com',
      role: 'ADMIN',
      schoolId: '29f56531-352f-49bd-8a6b-554a36256f40'
    },
    token: 'mock-token'
  })
};

global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, val) => { mockStorage[key] = val; },
  removeItem: (key) => { delete mockStorage[key]; }
};

// Mock delay to run instantly
const delay = () => Promise.resolve();

// Now import mockApi
import { mockApi } from '../src/services/mockApi.js';

async function run() {
  try {
    console.log('--- Calling adminGetClasses() ---');
    const classes = await mockApi.adminGetClasses();
    console.log('Success! Returned classes:', classes);
  } catch (err) {
    console.error('adminGetClasses() threw an error:', err);
  }

  try {
    console.log('--- Calling adminGetSubjects() ---');
    const subjects = await mockApi.adminGetSubjects();
    console.log('Success! Returned subjects:', subjects);
  } catch (err) {
    console.error('adminGetSubjects() threw an error:', err);
  }
}

run();
