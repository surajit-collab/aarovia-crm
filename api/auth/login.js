const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const USERS_TABLE = 'crm_users';
const LOCAL_ADMIN_EMAIL = 'admin@aarovia.co.in';
const LOCAL_ADMIN_PASSWORD = 'Aarovia@2026';

function parseBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      resolve(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);
      return;
    }

    let raw = '';
    req.on('data', chunk => raw += chunk);
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

function getHeaders() {
  return {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    'Content-Type': 'application/json'
  };
}

async function supabaseRequest(path, options = {}) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your deployment environment.');
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: getHeaders(),
    ...options
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = payload?.message || payload?.error?.message || `Supabase request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizeBoolean(value) {
  if (value === false || value === 'false') {
    return false;
  }

  return value !== undefined ? Boolean(value) : true;
}

function isUserActive(user) {
  return normalizeBoolean(user?.active ?? user?.is_active ?? true);
}

function getUserId(user) {
  return user?.userId || user?.user_id || user?.email || user?.id;
}

function getMobile(user) {
  return normalizePhone(user?.mobile || user?.phone || '');
}

function sanitizeUser(user) {
  if (!user) return null;

  const active = isUserActive(user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone || user.mobile || '',
    mobile: getMobile(user),
    userId: getUserId(user),
    role: user.role || 'Sales Executive',
    avatar: user.avatar || null,
    color: user.color || null,
    active,
    is_active: active,
    leads: Number(user.leads || 0),
    closed: Number(user.closed || 0)
  };
}

function verifyPassword(password, salt, hash) {
  const derived = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return derived === hash;
}

function isLocalAdminLogin(email, password) {
  return String(email || '').trim().toLowerCase() === LOCAL_ADMIN_EMAIL && String(password || '') === LOCAL_ADMIN_PASSWORD;
}

function buildLocalAdminUser() {
  return {
    id: 'local-admin',
    name: 'Admin User',
    email: LOCAL_ADMIN_EMAIL,
    phone: '+919999999999',
    mobile: '+919999999999',
    userId: LOCAL_ADMIN_EMAIL,
    role: 'Administrator',
    avatar: 'AU',
    color: '#4f8ef7',
    active: true,
    is_active: true,
    leads: 0,
    closed: 0
  };
}

async function findUserByEmail(email) {
  const encodedEmail = encodeURIComponent(email);
  const records = await supabaseRequest(`${USERS_TABLE}?select=*&email=eq.${encodedEmail}&limit=1`);
  return Array.isArray(records)
    ? records.find(user => isUserActive(user) && String(user.email || '').toLowerCase() === email)
    : null;
}

async function findUserByMobile(mobile) {
  const encodedMobile = encodeURIComponent(mobile);
  const records = await supabaseRequest(`${USERS_TABLE}?select=*&mobile=eq.${encodedMobile}&limit=1`);
  return Array.isArray(records)
    ? records.find(user => isUserActive(user) && getMobile(user) === mobile)
    : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  try {
    const body = await parseBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const mobile = normalizePhone(body.mobile);
    const password = String(body.password || '').trim();

    if (!email && !mobile) {
      res.status(400).json({ message: 'Email or mobile number is required.' });
      return;
    }

    let user = null;

    if (email) {
      if (!password) {
        res.status(400).json({ message: 'Password is required for email login.' });
        return;
      }

      if (isLocalAdminLogin(email, password)) {
        res.status(200).json(sanitizeUser(buildLocalAdminUser()));
        return;
      }

      user = await findUserByEmail(email);
      if (!user || !user.password_salt || !user.password_hash || !verifyPassword(password, user.password_salt, user.password_hash)) {
        res.status(401).json({ message: 'Invalid email or password.' });
        return;
      }
    } else {
      user = await findUserByMobile(mobile);
      if (!user) {
        res.status(401).json({ message: 'No user is registered on this mobile number.' });
        return;
      }
    }

    res.status(200).json(sanitizeUser(user));
  } catch (error) {
    res.status(502).json({ message: error.message || 'Authentication service is unavailable.' });
  }
};
