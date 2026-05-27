const crypto = require('crypto');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const USERS_TABLE = 'crm_users';

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

function parseQuery(url = '') {
  const query = new URL(url, 'http://localhost').searchParams;
  return Object.fromEntries(query.entries());
}

function getHeaders(requireServiceRole = false) {
  const key = requireServiceRole ? SUPABASE_SERVICE_ROLE_KEY : (SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json'
  };
}

async function supabaseRequest(path, options = {}, requestOptions = {}) {
  const requireServiceRole = Boolean(requestOptions.requireServiceRole);

  if (!SUPABASE_URL) {
    throw new Error('Supabase URL is not configured. Set SUPABASE_URL in your deployment environment.');
  }

  if (requireServiceRole && !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase service role key is not configured. Add SUPABASE_SERVICE_ROLE_KEY in Vercel to enable user creation and updates.');
  }

  if (!requireServiceRole && !SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_ANON_KEY) {
    throw new Error('Supabase API key is not configured. Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY in your deployment environment.');
  }

  const headers = {
    ...getHeaders(requireServiceRole),
    ...(options.headers || {})
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method || 'GET')) {
    headers.Prefer = 'return=representation';
  }

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers
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

function getAvatar(name) {
  const parts = String(name || '').split(' ').filter(Boolean);
  return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
}

function getColor(name) {
  const colors = ['#4f8ef7', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#22d3ee'];
  const idx = String(name || '').split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % colors.length;
  return colors[idx];
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return { password_salt: salt, password_hash: hash };
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

function getStoredUserId(user) {
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
    userId: getStoredUserId(user),
    role: user.role || 'Sales Executive',
    avatar: user.avatar || null,
    color: user.color || null,
    active,
    is_active: active,
    leads: Number(user.leads || 0),
    closed: Number(user.closed || 0)
  };
}

function getMissingColumnError(error) {
  const match = /Could not find the '([^']+)' column of 'crm_users' in the schema cache/.exec(error?.message || '');
  return match ? match[1] : null;
}

function removeColumn(payload, missingColumn) {
  if (!missingColumn) {
    return payload;
  }

  const next = { ...payload };
  delete next[missingColumn];
  return next;
}

async function executeWithColumnFallback(path, payload, method = 'POST') {
  let currentPayload = payload;
  let lastError;

  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      return await supabaseRequest(path, {
        method,
        body: JSON.stringify(currentPayload)
      }, { requireServiceRole: true });
    } catch (error) {
      lastError = error;
      const missingColumn = getMissingColumnError(error);

      if (!missingColumn) {
        throw error;
      }

      currentPayload = removeColumn(currentPayload, missingColumn);
      if (Object.keys(currentPayload).length === 0) {
        throw error;
      }
    }
  }

  throw lastError;
}

function buildUserPayload(body, current = {}) {
  const name = String(body.name ?? current.name ?? '').trim();
  const email = String(body.email ?? current.email ?? '').trim().toLowerCase();
  const phone = String(body.phone ?? current.phone ?? '').trim();
  const mobile = normalizePhone(phone);
  const role = String(body.role ?? current.role ?? 'Sales Executive').trim();
  const active = body.active !== undefined ? body.active !== false : isUserActive(current);

  const payload = {
    name,
    email,
    phone,
    mobile,
    role,
    active,
    is_active: active,
    leads: Number(body.leads ?? current.leads ?? 0),
    closed: Number(body.closed ?? current.closed ?? 0)
  };

  if (body.userId ?? current.userId ?? current.user_id) {
    payload.userId = body.userId ?? current.userId ?? current.user_id;
  }

  if (body.avatar ?? current.avatar) {
    payload.avatar = body.avatar ?? current.avatar;
  }

  if (body.color ?? current.color) {
    payload.color = body.color ?? current.color;
  }

  if (body.password) {
    Object.assign(payload, hashPassword(String(body.password).trim()));
  }

  return payload;
}

async function loadUserById(id) {
  const records = await supabaseRequest(`${USERS_TABLE}?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
  return Array.isArray(records) ? records[0] : null;
}

module.exports = async function handler(req, res) {
  const { url = '' } = req;
  const query = parseQuery(url);

  try {
    if (req.method === 'GET') {
      const records = await supabaseRequest(`${USERS_TABLE}?select=*&order=name.asc`);
      res.status(200).json(Array.isArray(records) ? records.map(sanitizeUser) : []);
      return;
    }

    if (req.method === 'POST') {
      const body = await parseBody(req);
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const phone = String(body.phone || '').trim();
      const password = String(body.password || '').trim();

      if (!name || !email || !phone || !password) {
        res.status(400).json({ message: 'Name, email, phone, and password are required.' });
        return;
      }

      const payload = buildUserPayload({
        ...body,
        name,
        email,
        phone,
        password,
        active: body.active === undefined ? true : body.active !== false
      });

      payload.id = body.id || `U${Date.now()}`;
      const created = await executeWithColumnFallback(USERS_TABLE, payload, 'POST');

      res.status(201).json(sanitizeUser(Array.isArray(created) ? created[0] : created));
      return;
    }

    if (req.method === 'PUT') {
      const id = query.id;
      if (!id) {
        res.status(400).json({ message: 'User id is required.' });
        return;
      }

      const body = await parseBody(req);
      const current = await loadUserById(id);
      if (!current) {
        res.status(404).json({ message: 'User not found.' });
        return;
      }

      const payload = buildUserPayload(body, current);
      const updated = await executeWithColumnFallback(`${USERS_TABLE}?id=eq.${encodeURIComponent(id)}`, payload, 'PATCH');

      res.status(200).json(sanitizeUser(Array.isArray(updated) ? updated[0] : updated));
      return;
    }

    if (req.method === 'DELETE') {
      const id = query.id;
      if (!id) {
        res.status(400).json({ message: 'User id is required.' });
        return;
      }

      await supabaseRequest(`${USERS_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      res.status(200).json({ success: true, id });
      return;
    }

    res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    res.status(502).json({ message: error.message || 'User service is unavailable.' });
  }
};
