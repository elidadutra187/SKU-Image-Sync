import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';

import ImageSyncService from '../services/imageSync.js';
import NuvemshopClient from '../services/nuvemshop.js';
import { readStoreSession } from '../services/session.js';
import {
  createUploadSession,
  deleteUploadSession,
  foldersForSession,
  getSessionImagePath,
  getUploadSession,
} from '../services/uploadSessions.js';

const router = Router();
const upload = multer({ dest: 'uploads/tmp', limits: { fileSize: 12 * 1024 * 1024, files: 2000 } });
let currentSync = null;

function hasManualToken() {
  return Boolean(process.env.NUVEMSHOP_STORE_ID && process.env.NUVEMSHOP_ACCESS_TOKEN);
}

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

function productName(product) {
  if (!product?.name) return '';
  if (typeof product.name === 'string') return product.name;
  return product.name.pt || product.name.es || product.name.en || Object.values(product.name)[0] || '';
}

function normalizeSelectedSkus(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeBatch(value) {
  if (!value || typeof value !== 'object') return null;
  const start = normalizePositiveInteger(value.start, null);
  const end = normalizePositiveInteger(value.end, null);
  const size = normalizePositiveInteger(value.size, null);
  const total = normalizePositiveInteger(value.total, null);
  const label = String(value.label || '').trim();

  if (!label && !start && !end && !size && !total) return null;

  return {
    label: label || (start && end ? `${start}-${end}` : ''),
    start,
    end,
    size,
    total,
  };
}

async function previewSession(session) {
  const client = await NuvemshopClient.fromStore(session.storeId);
  const items = [];

  for (const group of session.groups) {
    try {
      const product = await client.getProductBySku(group.sku);
      await client.delay();
      const remoteImages = await client.getProductImages(product.id);
      await client.delay();

      items.push({
        sku: group.sku,
        sourceFolder: group.sourceFolder,
        selected: true,
        status: 'ok',
        product: {
          id: product.id,
          name: productName(product),
        },
        localImages: group.images,
        remoteImages: remoteImages.map((image) => ({
          id: image.id,
          src: image.src,
          position: image.position,
        })),
      });
    } catch (error) {
      items.push({
        sku: group.sku,
        sourceFolder: group.sourceFolder,
        selected: false,
        status: 'error',
        error: error.message,
        product: null,
        localImages: group.images,
        remoteImages: [],
      });
    }
  }

  return items;
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
    const service = new ImageSyncService({
      ...syncOptions(req, mode, dryRun),
      storeId: readStoreSession(req),
    });
    const result = await service.run();
    if (!dryRun) {
      await deleteUploadSession(session.id);
    }
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

router.post('/preview', upload.fields([
  { name: 'images', maxCount: 2000 },
  { name: 'csv', maxCount: 1 },
]), async (req, res) => {
  try {
    const manifest = JSON.parse(req.body?.manifest || '[]');
    const batch = normalizeBatch(JSON.parse(req.body?.batch || 'null'));
    const storeId = readStoreSession(req);
    const imageFiles = req.files?.images || [];
    const csvFile = req.files?.csv?.[0] || null;
    const csvText = csvFile ? await fs.readFile(csvFile.path, 'utf8') : '';

    if (csvFile) await fs.rm(csvFile.path, { force: true });

    if (!imageFiles.length) {
      return res.status(400).json({
        success: false,
        error: 'Send at least one image file.',
      });
    }

    const session = await createUploadSession({
      files: imageFiles,
      manifest,
      csvText,
      batch,
      storeId,
    });
    const items = await previewSession(session);

    res.json({
      success: true,
      sessionId: session.id,
      batch: session.batch,
      csvSkus: session.csvSkus,
      count: items.length,
      items,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/session/:sessionId/image/:sku/:filename', async (req, res) => {
  const session = getUploadSession(req.params.sessionId);
  const storeId = readStoreSession(req);
  if (session?.storeId && session.storeId !== storeId && !hasManualToken()) {
    return res.status(403).json({ success: false, error: 'Session does not belong to this store.' });
  }

  const filePath = getSessionImagePath(req.params.sessionId, req.params.sku, req.params.filename);
  if (!filePath) {
    return res.status(404).json({ success: false, error: 'Image not found.' });
  }

  res.sendFile(path.resolve(filePath));
});

router.post('/session/:sessionId/run', async (req, res) => {
  if (currentSync) {
    return res.status(409).json({
      success: false,
      status: 'busy',
      currentSync,
      error: 'A sync process is already running.',
    });
  }

  const session = getUploadSession(req.params.sessionId);
  if (!session) {
    return res.status(404).json({
      success: false,
      error: 'Upload session not found.',
    });
  }

  const storeId = readStoreSession(req);
  if (session.storeId && session.storeId !== storeId && !hasManualToken()) {
    return res.status(403).json({
      success: false,
      error: 'Session does not belong to this store.',
    });
  }

  const mode = ['add', 'sync', 'replace'].includes(req.body?.mode) ? req.body.mode : 'add';
  const dryRun = Boolean(req.body?.dryRun);
  const selectedSkus = normalizeSelectedSkus(req.body?.selectedSkus);
  const folders = foldersForSession(session, selectedSkus);

  if (!folders.length) {
    return res.status(400).json({
      success: false,
      error: 'No selected SKUs to sync.',
    });
  }

  try {
    currentSync = dryRun ? `dry-run:${mode}` : mode;
    const service = new ImageSyncService({
      mode,
      dryRun,
      folders,
      batch: session.batch,
      concurrency: normalizePositiveInteger(req.body?.concurrency, 1),
      reportPath: `reports/sku-image-sync-${Date.now()}.csv`,
      storeId: session.storeId,
    });
    const result = await service.run();
    res.json({
      success: true,
      mode,
      dryRun,
      selectedSkus: folders.map((folder) => folder.sku),
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
