import { Router } from 'express';

import NuvemshopClient from '../services/nuvemshop.js';
import { saveStoredToken, tokenStatusAsync } from '../services/oauthStore.js';
import { readStoreSession, setStoreSession } from '../services/session.js';
import logger from '../utils/logger.js';

const router = Router();

function appBaseUrl(req) {
  const configured = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

function redirectToApp(req, res, params = {}) {
  const url = new URL(appBaseUrl(req));
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  });
  res.redirect(303, url.toString());
}

export function buildAuthorizeUrl(clientId) {
  return `https://www.nuvemshop.com.br/apps/${encodeURIComponent(clientId)}/authorize`;
}

router.get('/status', async (req, res) => {
  try {
    const storeId = readStoreSession(req);
    const client = await NuvemshopClient.fromStore(storeId);
    const result = await client.testConnection();
    res.json({
      ...result,
      token: await tokenStatusAsync(result.storeId),
    });
  } catch (error) {
    const storeId = readStoreSession(req);
    res.json({
      connected: false,
      token: await tokenStatusAsync(storeId),
      message: error.message,
    });
  }
});

router.get('/install', (req, res) => {
  const clientId = process.env.NUVEMSHOP_CLIENT_ID;

  if (!clientId) {
    return redirectToApp(req, res, {
      oauth_error: 'oauth_not_configured',
    });
  }

  res.redirect(buildAuthorizeUrl(clientId));
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return redirectToApp(req, res, {
      oauth_error: String(error),
    });
  }

  if (!code) {
    return redirectToApp(req, res, {
      oauth_error: 'missing_code',
    });
  }

  try {
    const exchanged = await NuvemshopClient.exchangeAuthorizationCode(code);
    await saveStoredToken({
      storeId: exchanged.storeId,
      accessToken: exchanged.accessToken,
      scopes: exchanged.scopes,
      installedAt: new Date().toISOString(),
    });
    setStoreSession(res, exchanged.storeId);

    res.redirect(303, `${appBaseUrl(req)}/?connected=1`);
  } catch (exchangeError) {
    logger.error(`OAuth callback failed: ${exchangeError.message}`);
    return redirectToApp(req, res, {
      oauth_error: 'token_exchange_failed',
    });
  }
});

export default router;
