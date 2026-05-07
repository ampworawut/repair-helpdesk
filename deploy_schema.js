const { Client } = require('pg');

async function main() {
  const c = new Client({
    host: '52.77.146.31',
    port: 6543,
    database: 'postgres',
    user: 'postgres.uyiiwcqplpdmiafvxahn',
    password: 'f/mb28Qreq2QU_u',
    ssl: { rejectUnauthorized: false, servername: 'aws-0-ap-southeast-1.pooler.supabase.com' }
  });

  try {
    await c.connect();
    console.log('CONNECTED via pooler!');
    
    // Read and execute schema
    const fs = require('fs');
    const sql = fs.readFileSync('/home/wwkk/repair-helpdesk/supabase/migrations/001_initial_schema.sql', 'utf8');
    await c.query(sql);
    console.log('Schema deployed successfully!');
    
    // Verify tables
    const res = await c.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
    console.log('Tables created:', res.rows.map(r => r.tablename).join(', '));
    
    await c.end();
  } catch (err) {
    console.error('Error:', err.message);
    if (err.detail) console.error('Detail:', err.detail);
    if (err.hint) console.error('Hint:', err.hint);
    process.exit(1);
  }
}

main();