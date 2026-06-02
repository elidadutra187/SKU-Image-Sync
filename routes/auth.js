import { Router } from 'express';

import NuvemshopClient from '../services/nuvemshop.js';
import { saveStoredToken, tokenStatusAsync } from '../services/oauthStore.js';
import { readStoreSession, setStoreSession } from '../services/session.js';

const router = Router();

function appBaseUrl(req) {
  const configured = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
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
  const scopes = process.env.NUVEMSHOP_APP_SCOPES || 'read_products,write_products';
  const callbackUrl = `${appBaseUrl(req)}/auth/callback`;

  if (!clientId) {
    return res.json({
      success: true,
      oauthReady: false,
      message: 'OAuth scaffold is available, but NUVEMSHOP_CLIENT_ID is not configured yet. Use the manual token env vars for now.',
      callbackUrl,
      requiredEnv: ['NUVEMSHOP_CLIENT_ID', 'NUVEMSHOP_CLIENT_SECRET', 'NUVEMSHOP_APP_SCOPES'],
    });
  }

  const authUrl = new URL(`https://www.nuvemshop.com.br/apps/${clientId}/authorize`);
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', callbackUrl);

  res.redirect(authUrl.toString());
});

router.get('/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).json({
      success: false,
      error,
    });
  }

  if (!code) {
    return res.status(400).json({
      success: false,
      error: 'Missing OAuth code.',
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
    res.status(500).json({
      success: false,
      error: exchangeError.message,
    });
  }
});

export default router;
