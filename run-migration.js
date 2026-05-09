
const { Pool } = require('pg');
const fs = require('fs');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function migrate() {
  const sql = fs.readFileSync('./supabase/migrations/002_vendor_groups.sql', 'utf8');
  
  // Split by semicolons but keep function bodies intact
  // Simple approach: execute each statement separately
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Execute the entire SQL as one transaction
    await client.query(sql);
    
    await client.query('COMMIT');
    console.log('Migration complete!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(err => { console.error(err); process.exit(1); });
