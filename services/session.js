import crypto from 'node:crypto';

const COOKIE_NAME = 'sku_image_sync_store';

function sessionSecret() {
  return process.env.SESSION_SECRET || process.env.NUVEMSHOP_CLIENT_SECRET || 'dev-session-secret';
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', sessionSecret()).update(value).digest('base64url');
}

function parseCookies(header = '') {
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        if (index === -1) return [part, ''];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      })
  );
}

export function setStoreSession(res, storeId) {
  const payload = base64Url(JSON.stringify({ storeId: String(storeId), createdAt: new Date().toISOString() }));
  const value = `${payload}.${sign(payload)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';

  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`
  );
}

export function readStoreSession(req) {
  const value = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  if (!value) return null;

  const [payload, signature] = value.split('.');
  if (!payload || !signature || sign(payload) !== signature) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return data.storeId ? String(data.storeId) : null;
  } catch {
    return null;
  }
}

