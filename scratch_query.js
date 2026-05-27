const { Client } = require('pg');
const conn = 'postgres://postgres.ovzaefolxykxwhjsblux:ErQ1XL9iXm0eBeta@aws-1-us-east-1.pooler.supabase.com:5432/postgres?sslmode=disable';

async function main() {
  const client = new Client({ connectionString: conn, ssl: false });
  try {
    await client.connect();
    const res = await client.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'crm_users' OR table_name = 'users' ORDER BY table_schema, table_name");
    console.log(JSON.stringify(res.rows, null, 2));
    const userRes = await client.query("SELECT id, name, email, phone, mobile, role, active, is_active, password_salt, password_hash FROM public.crm_users ORDER BY created_at DESC LIMIT 20");
    console.log(JSON.stringify(userRes.rows, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
