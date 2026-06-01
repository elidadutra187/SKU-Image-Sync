/**
 * Rotas de sincronização de imagens
 */

import { Router } from 'express';
import ImageSyncService from '../services/imageSync.js';

const router = Router();

// Status de sincronização em andamento
let currentSync = null;

function getSyncOptions(body = {}) {
  return {
    imagesRoot: body.imagesRoot || process.env.IMAGES_ROOT || './Fotos',
    onlySku: body.sku || null,
    maxSkus: body.maxSkus || null,
    concurrency: body.concurrency || 2,
  };
}

// POST /sync/add - Adicionar imagens novas
router.post('/add', async (req, res) => {
  if (currentSync) {
    return res.status(409).json({
      error: 'Sincronização já em andamento',
      status: 'busy',
    });
  }

  try {
    currentSync = 'add';
    const options = {
      ...getSyncOptions(req.body),
      mode: 'add',
      dryRun: false,
    };

    const service = new ImageSyncService(options);
    const result = await service.run();

    res.json({
      success: true,
      mode: 'add',
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    currentSync = null;
  }
});

// POST /sync/sync - Sincronizar (adicionar novas, atualizar alteradas)
router.post('/sync', async (req, res) => {
  if (currentSync) {
    return res.status(409).json({
      error: 'Sincronização já em andamento',
      status: 'busy',
    });
  }

  try {
    currentSync = 'sync';
    const options = {
      ...getSyncOptions(req.body),
      mode: 'sync',
      dryRun: false,
    };

    const service = new ImageSyncService(options);
    const result = await service.run();

    res.json({
      success: true,
      mode: 'sync',
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    currentSync = null;
  }
});

// POST /sync/replace - Substituir todas as imagens
router.post('/replace', async (req, res) => {
  if (currentSync) {
    return res.status(409).json({
      error: 'Sincronização já em andamento',
      status: 'busy',
    });
  }

  try {
    currentSync = 'replace';
    const options = {
      ...getSyncOptions(req.body),
      mode: 'replace',
      dryRun: false,
    };

    const service = new ImageSyncService(options);
    const result = await service.run();

    res.json({
      success: true,
      mode: 'replace',
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    currentSync = null;
  }
});

// POST /sync/dry-run - Simular sincronização
router.post('/dry-run', async (req, res) => {
  try {
    const mode = req.body.mode || 'sync';
    const options = {
      ...getSyncOptions(req.body),
      mode,
      dryRun: true,
    };

    const service = new ImageSyncService(options);
    const result = await service.run();

    res.json({
      success: true,
      mode: `dry-run:${mode}`,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /sync/status - Status da sincronização
router.get('/status', (req, res) => {
  res.json({
    running: currentSync !== null,
    mode: currentSync,
  });
});

export default router;
