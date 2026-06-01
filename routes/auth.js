import { Router } from 'express';

import NuvemshopClient from '../services/nuvemshop.js';

const router = Router();

function appBaseUrl(req) {
  const configured = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
  if (configured) return configured.replace(/\/$/, '');
  return `${req.protocol}://${req.get('host')}`;
}

router.get('/status', async (req, res) => {
  try {
    const client = NuvemshopClient.fromEnv();
    const result = await client.testConnection();
    res.json(result);
  } catch (error) {
    res.json({
      connected: false,
      storeId: process.env.NUVEMSHOP_STORE_ID || null,
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

  const authUrl = new URL('https://www.nuvemshop.com/apps/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('redirect_uri', callbackUrl);

  res.redirect(authUrl.toString());
});

router.get('/callback', (req, res) => {
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

  res.json({
    success: true,
    oauthReady: false,
    message: 'OAuth callback received. Automatic token exchange is intentionally not enabled in this first backend version.',
    nextStep: 'After enabling complete OAuth, exchange this code for user_id/store_id and access_token.',
    code,
  });
});

export default router;
