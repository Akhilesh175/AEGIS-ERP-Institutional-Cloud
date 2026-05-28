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

async function deduplicate() {
  console.log('Deduplicating classes...');
  const { data: classes, error: classError } = await supabaseAdmin.from('classes').select('*').order('created_at', { ascending: true });
  if (classError) {
    console.error('Error fetching classes for deduplication:', classError);
  }
  if (classes) {
    const seenClasses = new Set();
    const classesToDelete = [];
    for (const c of classes) {
      const key = `${c.school_id}_${c.name}`;
      if (seenClasses.has(key)) {
        classesToDelete.push(c.id);
      } else {
        seenClasses.add(key);
      }
    }
    if (classesToDelete.length > 0) {
      console.log(`Deleting ${classesToDelete.length} duplicate classes...`);
      // Delete in chunks of 100
      for (let i = 0; i < classesToDelete.length; i += 100) {
        const chunk = classesToDelete.slice(i, i + 100);
        await supabaseAdmin.from('classes').delete().in('id', chunk);
      }
      console.log('Done classes.');
    } else {
      console.log('No duplicate classes found.');
    }
  }

  console.log('Deduplicating subjects...');
  const { data: subjects, error: subjectError } = await supabaseAdmin.from('subjects').select('*');
  if (subjectError) {
    console.error('Error fetching subjects for deduplication:', subjectError);
  }
  if (subjects) {
    const seenSubjects = new Set();
    const subjectsToDelete = [];
    for (const s of subjects) {
      const key = `${s.school_id}_${s.code}`;
      if (seenSubjects.has(key)) {
        subjectsToDelete.push(s.id);
      } else {
        seenSubjects.add(key);
      }
    }
    if (subjectsToDelete.length > 0) {
      console.log(`Deleting ${subjectsToDelete.length} duplicate subjects...`);
      for (let i = 0; i < subjectsToDelete.length; i += 100) {
        const chunk = subjectsToDelete.slice(i, i + 100);
        await supabaseAdmin.from('subjects').delete().in('id', chunk);
      }
      console.log('Done subjects.');
    } else {
      console.log('No duplicate subjects found.');
    }
  }
}

deduplicate();
