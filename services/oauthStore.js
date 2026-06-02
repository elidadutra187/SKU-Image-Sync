import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

import { getPool, hasDatabase, initializeDatabase } from './database.js';

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
  if (hasDatabase()) {
    await initializeDatabase();
    await getPool().query(
      `
        insert into stores (store_id, access_token, scopes, installed_at, updated_at)
        values ($1, $2, $3, $4, now())
        on conflict (store_id)
        do update set
          access_token = excluded.access_token,
          scopes = excluded.scopes,
          installed_at = coalesce(stores.installed_at, excluded.installed_at),
          updated_at = now()
      `,
      [token.storeId, token.accessToken, token.scopes || null, token.installedAt || new Date().toISOString()]
    );
    return 'database';
  }

  const filePath = tokenFilePath();
  await fsp.writeFile(filePath, JSON.stringify(token, null, 2), 'utf8');
  return filePath;
}

export async function readStoredTokenAsync(storeId = null) {
  if (hasDatabase()) {
    if (!storeId) return null;
    await initializeDatabase();
    const result = await getPool().query(
      'select store_id, access_token, scopes, installed_at, updated_at from stores where store_id = $1',
      [storeId]
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      storeId: row.store_id,
      accessToken: row.access_token,
      scopes: row.scopes,
      installedAt: row.installed_at,
      updatedAt: row.updated_at,
    };
  }

  const token = readStoredToken();
  if (!token) return null;
  if (storeId && String(token.storeId) !== String(storeId)) return null;
  return token;
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

export async function tokenStatusAsync(storeId = null) {
  const token = await readStoredTokenAsync(storeId);
  if (!token) {
    return {
      configured: false,
      source: hasDatabase() ? 'database' : null,
      storeId: storeId || process.env.NUVEMSHOP_STORE_ID || null,
    };
  }

  return {
    configured: Boolean(token.accessToken && token.storeId),
    source: hasDatabase() ? 'database' : 'oauth-file',
    storeId: token.storeId || null,
    installedAt: token.installedAt || null,
    updatedAt: token.updatedAt || null,
    scopes: token.scopes || null,
  };
}
