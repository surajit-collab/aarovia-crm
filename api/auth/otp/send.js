const https = require('https');
const querystring = require('querystring');

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

function normalizeMobileForTwilio(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return null;
  }

  const digits = raw.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  if (raw.startsWith('+')) {
    return `+${digits}`;
  }

  if (raw.startsWith('00')) {
    return `+${digits.slice(2)}`;
  }

  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `+91${digits.slice(1)}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  if (digits.length > 7) {
    return `+${digits}`;
  }

  return null;
}

function sendTwilioSms({ accountSid, authToken, from, to, body }) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const payload = querystring.stringify({ From: from, To: to, Body: body });

    const req = https.request(
      {
        hostname: 'api.twilio.com',
        path: `/2010-04-01/Accounts/${accountSid}/Messages.json`,
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(data || 'Twilio request failed'));
          }
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed' });
    return;
  }

  const body = await parseBody(req);
  const { mobile, otp, userName } = body || {};

  if (!mobile || !otp) {
    res.status(400).json({ message: 'Mobile number and OTP are required.' });
    return;
  }

  const destination = normalizeMobileForTwilio(mobile);

  if (!destination) {
    res.status(400).json({ message: 'Please provide a valid mobile number to send OTP.' });
    return;
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;

  if (!accountSid || !authToken || !from) {
    res.status(503).json({
      message: 'SMS provider is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM in your deployment environment.'
    });
    return;
  }

  try {
    await sendTwilioSms({
      accountSid,
      authToken,
      from,
      to: destination,
      body: `Your Aarovia CRM OTP is ${otp}. ${userName ? `For ${userName}.` : ''}`
    });

    res.status(200).json({ status: 'sent', provider: 'twilio', to: destination });
  } catch (error) {
    res.status(502).json({ message: error.message || 'Failed to send OTP.' });
  }
};
