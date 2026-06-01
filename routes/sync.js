import { Router } from 'express';

import ImageSyncService from '../services/imageSync.js';

const router = Router();
let currentSync = null;

function normalizePositiveInteger(value, fallback) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1) return fallback;
  return number;
}

function syncOptions(req, mode, dryRun = false) {
  return {
    imagesRoot: req.body?.imagesRoot || process.env.IMAGES_ROOT || './Fotos',
    mode,
    dryRun,
    onlySku: req.body?.sku || req.body?.onlySku || null,
    maxSkus: req.body?.maxSkus ? normalizePositiveInteger(req.body.maxSkus, null) : null,
    concurrency: normalizePositiveInteger(req.body?.concurrency, 2),
    reportPath: req.body?.reportPath || `reports/sku-image-sync-${Date.now()}.csv`,
  };
}

async function runSync(req, res, mode, dryRun = false) {
  if (currentSync) {
    return res.status(409).json({
      success: false,
      status: 'busy',
      currentSync,
      error: 'A sync process is already running.',
    });
  }

  try {
    currentSync = dryRun ? `dry-run:${mode}` : mode;
    const service = new ImageSyncService(syncOptions(req, mode, dryRun));
    const result = await service.run();
    res.json({
      success: true,
      mode,
      dryRun,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      mode,
      dryRun,
      error: error.message,
    });
  } finally {
    currentSync = null;
  }
}

router.post('/dry-run', (req, res) => {
  const mode = ['add', 'sync', 'replace'].includes(req.body?.mode) ? req.body.mode : 'sync';
  return runSync(req, res, mode, true);
});

router.post('/add', (req, res) => runSync(req, res, 'add', false));
router.post('/sync', (req, res) => runSync(req, res, 'sync', false));
router.post('/replace', (req, res) => runSync(req, res, 'replace', false));

router.get('/status', (req, res) => {
  res.json({
    running: Boolean(currentSync),
    mode: currentSync,
  });
});

export default router;
