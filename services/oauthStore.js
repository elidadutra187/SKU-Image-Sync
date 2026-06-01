import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_TOKEN_FILE = '.nuvemshop-oauth-token.json';

function tokenFilePath() {
  return path.resolve(process.env.OAUTH_TOKEN_FILE || DEFAULT_TOKEN_FILE);
}

export function readStoredToken() {
  const filePath = tokenFilePath();
  if (!fs.existsSync(filePath)) return null;

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

export async function saveStoredToken(token) {
  const filePath = tokenFilePath();
  await fsp.writeFile(filePath, JSON.stringify(token, null, 2), 'utf8');
  return filePath;
}

export function tokenStatus() {
  const token = readStoredToken();
  if (!token) {
    return {
      configured: false,
      source: null,
      storeId: process.env.NUVEMSHOP_STORE_ID || null,
    };
  }

  return {
    configured: Boolean(token.accessToken && token.storeId),
    source: 'oauth-file',
    storeId: token.storeId || null,
    installedAt: token.installedAt || null,
    scopes: token.scopes || null,
  };
}
