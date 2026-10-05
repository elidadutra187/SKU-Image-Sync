import crypto from 'node:crypto';

const COOKIE_NAME = 'sku_image_sync_store';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret() {
  const secret=process.env.SESSION_SECRET || process.env.NUVEMSHOP_CLIENT_SECRET;
  if(secret)return secret;
  if(process.env.NODE_ENV==='production')throw new Error('session_secret_not_configured');
  return 'dev-session-secret';
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
        try{return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];}
        catch{return [part.slice(0,index),''];}
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
  try {
  const value = parseCookies(req.headers.cookie || '')[COOKIE_NAME];
  if (!value) return null;

  const parts=value.split('.');
  const [payload, signature] = parts;
  if(parts.length!==2 || !payload || !/^[A-Za-z0-9_-]{43}$/.test(signature || ''))return null;
  const expected=Buffer.from(sign(payload));
  const actual=Buffer.from(signature);
  if(actual.length!==expected.length || !crypto.timingSafeEqual(expected,actual))return null;

  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const createdAt=Date.parse(data.createdAt),now=Date.now();
    if(!Number.isFinite(createdAt) || createdAt>now+60000 || now-createdAt>=SESSION_TTL_MS)return null;
    return /^[1-9]\d*$/.test(String(data.storeId || '')) ? String(data.storeId) : null;
  } catch {
    return null;
  }
  }catch{return null;}
}

