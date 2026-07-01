const { Client } = require('pg');

async function main() {
  const connectionString = 'postgresql://postgres:Akhilesh%4018@db.frsdcpqkxoxpbinazmgz.supabase.co:5432/postgres';
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database.');

    const sql = `
      -- Add father_name and mother_name columns to students table
      ALTER TABLE public.students 
      ADD COLUMN IF NOT EXISTS father_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS mother_name VARCHAR(100);
    `;

    console.log('Applying database schema modifications...');
    await client.query(sql);
    console.log('✅ Schema modified successfully!');
  } catch (err) {
    console.error('❌ Failed to modify schema:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
