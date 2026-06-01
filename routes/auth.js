import { Router } from 'express';

import NuvemshopClient from '../services/nuvemshop.js';
import { saveStoredToken, tokenStatus } from '../services/oauthStore.js';

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
    res.json({
      ...result,
      token: tokenStatus(),
    });
  } catch (error) {
    res.json({
      connected: false,
      token: tokenStatus(),
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

  const authUrl = new URL(`https://www.nuvemshop.com/apps/${clientId}/authorize`);
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

    res.send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>SKU Image Sync instalado</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; margin: 40px; color: #17202a; }
            main { max-width: 720px; }
            code { background: #edf2f7; border-radius: 4px; padding: 2px 6px; }
          </style>
        </head>
        <body>
          <main>
            <h1>SKU Image Sync instalado</h1>
            <p>O aplicativo foi autorizado e o token da loja foi salvo com sucesso.</p>
            <p>Store ID: <code>${exchanged.storeId}</code></p>
            <p>Agora voce pode usar as rotas de sincronizacao do backend.</p>
          </main>
        </body>
      </html>
    `);
  } catch (exchangeError) {
    res.status(500).json({
      success: false,
      error: exchangeError.message,
    });
  }
});

export default router;
