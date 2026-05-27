// scripts/activate-all-users.js
// Usage:
// SUPABASE_URL=https://<project>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/activate-all-users.js
// To actually run the PATCH, set CONFIRM=true in the environment.

const SUPABASE_URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const CONFIRM = process.env.CONFIRM === 'true' || process.env.FORCE === 'true';

if (!SUPABASE_URL || !KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in your environment.');
  process.exit(1);
}

const fetchFn = (typeof fetch === 'function') ? fetch : (...args) => import('node-fetch').then(m => m.default(...args));

async function getUserCount() {
  const url = `${SUPABASE_URL}/rest/v1/crm_users?select=id`;
  const res = await fetchFn(url, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
  if (!res.ok) throw new Error(`Failed to fetch users: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? data.length : 0;
}

async function activateAll() {
  const count = await getUserCount();
  console.log(`Found ${count} user records in crm_users.`);
  if (!CONFIRM) {
    console.log('Preview only. To perform the update set CONFIRM=true in the environment and re-run.');
    return;
  }

  // Supabase requires a WHERE clause for UPDATE via REST — use a safe non-null id filter
  const url = `${SUPABASE_URL}/rest/v1/crm_users?id=not.is.null`;
  const res = await fetchFn(url, {
    method: 'PATCH',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ active: true })
  });

  const text = await res.text();
  if (!res.ok) {
    console.error('Activation failed:', res.status, text);
    process.exit(2);
  }

  console.log('Activation response:', res.status);
  try { console.log(JSON.parse(text)); } catch { console.log(text); }
}

activateAll().catch(err => { console.error(err); process.exit(1); });
