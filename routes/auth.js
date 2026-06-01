/**
 * Rotas de autenticação (preparado para OAuth futuro)
 */

import { Router } from 'express';
import NuvemshopClient from '../services/nuvemshop.js';

const router = Router();

// Verificar status da conexão
router.get('/status', async (req, res) => {
  try {
    const client = NuvemshopClient.fromEnv();
    const result = await client.testConnection();

    res.json({
      connected: result.success,
      storeId: result.storeId,
      message: result.message,
    });
  } catch (error) {
    res.json({
      connected: false,
      storeId: null,
      message: error.message,
    });
  }
});

// Placeholder para OAuth (implementação futura)
router.get('/install', (req, res) => {
  res.json({
    message: 'OAuth não implementado nesta versão. Configure o token manualmente no .env',
    docs: 'https://tiendanube.github.io/api-documentation/authentication',
  });
});

router.get('/callback', (req, res) => {
  res.json({
    message: 'OAuth callback - implementação futura',
  });
});

export default router;
