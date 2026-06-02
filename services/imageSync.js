import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import CsvReport from '../utils/csvReport.js';
import logger from '../utils/logger.js';
import NuvemshopClient from './nuvemshop.js';

const SUPPORTED_EXTENSIONS = new Set(['.gif', '.jpg', '.jpeg', '.png', '.webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DEFAULT_STATE_FILE = '.nuvemshop-sync-state.json';
const VALID_MODES = new Set(['add', 'sync', 'replace']);

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

async function fileSha256(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function readJsonFile(filePath, fallback) {
  if (!(await pathExists(filePath))) return fallback;
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

export class ImageSyncService {
  constructor(options = {}) {
    this.imagesRoot = path.resolve(options.imagesRoot || './Fotos');
    this.mode = options.mode || 'sync';
    this.dryRun = Boolean(options.dryRun);
    this.concurrency = Math.max(1, Number(options.concurrency || 2));
    this.onlySku = options.onlySku || null;
    this.maxSkus = options.maxSkus ? Number(options.maxSkus) : null;
    this.folders = Array.isArray(options.folders) ? options.folders : null;
    this.storeId = options.storeId || null;
    this.batch = options.batch || null;
    this.statePath = path.resolve(options.stateFile || DEFAULT_STATE_FILE);
    this.reportPath = options.reportPath || `reports/sku-image-sync-${Date.now()}.csv`;
    this.onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;

    this.client = null;
    this.report = null;
    this.state = { skus: {} };
    this.stats = {
      skusFound: 0,
      processed: 0,
      uploaded: 0,
      deleted: 0,
      skipped: 0,
      errors: 0,
    };
  }

  async initialize() {
    if (!VALID_MODES.has(this.mode)) {
      throw new Error(`Invalid sync mode: ${this.mode}. Use add, sync or replace.`);
    }

    if (!this.folders && !(await pathExists(this.imagesRoot))) {
      throw new Error(`Images root folder not found: ${this.imagesRoot}`);
    }

    this.client = await NuvemshopClient.fromStore(this.storeId);
    this.report = new CsvReport(this.reportPath, {
      batchLabel: this.batch?.label,
      batchStart: this.batch?.start,
      batchEnd: this.batch?.end,
      batchSize: this.batch?.size,
      batchTotal: this.batch?.total,
    });
    this.state = await readJsonFile(this.statePath, { skus: {} });
  }

  async saveState() {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  async listSkuFolders() {
    if (this.folders) {
      return this.folders
        .map((folder) => ({
          sku: folder.sku,
          dir: folder.dir,
          sourceFolder: folder.sourceFolder || folder.sku,
        }))
        .sort((a, b) => naturalSort(a.sku, b.sku));
    }

    const entries = await fs.readdir(this.imagesRoot, { withFileTypes: true });
    let folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        sku: entry.name.trim(),
        dir: path.join(this.imagesRoot, entry.name),
      }))
      .filter((entry) => entry.sku.length > 0)
      .sort((a, b) => naturalSort(a.sku, b.sku));

    if (this.onlySku) {
      folders = folders.filter((folder) => folder.sku === this.onlySku);
    }

    if (this.maxSkus) {
      folders = folders.slice(0, this.maxSkus);
    }

    return folders;
  }

  async listLocalImages(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const images = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      const filePath = path.join(dir, entry.name);
      const stat = await fs.stat(filePath);
      images.push({
        filename: entry.name,
        filePath,
        size: stat.size,
        hash: await fileSha256(filePath),
      });
    }

    return images.sort((a, b) => naturalSort(a.filename, b.filename));
  }

  async findProduct(sku) {
    const product = await this.client.getProductBySku(sku);
    await this.client.delay();

    if (!product?.id) {
      throw new Error('Product returned without id.');
    }

    return product;
  }

  async deleteImages(productId, images, sku, action = 'delete') {
    for (const image of images) {
      try {
        await this.client.deleteProductImage(productId, image.id);
        await this.client.delay();
        await this.report.addSuccess(sku, productId, image.id, action, 'Image deleted.');
        this.stats.deleted++;
      } catch (error) {
        await this.report.addError(sku, productId, image.id, action, error.message);
        this.stats.errors++;
      }
    }
  }

  async uploadImage(productId, sku, localImage, position, stateForSku) {
    if (localImage.size > MAX_IMAGE_BYTES) {
      throw new Error(`Image is larger than 10MB: ${localImage.size} bytes.`);
    }

    const attachment = (await fs.readFile(localImage.filePath)).toString('base64');
    const uploaded = await this.client.uploadProductImage(productId, {
      attachment,
      filename: localImage.filename,
      position,
    });
    await this.client.delay();

    stateForSku.files[localImage.filename] = {
      hash: localImage.hash,
      imageId: uploaded?.id || null,
      size: localImage.size,
      uploadedAt: new Date().toISOString(),
    };

    await this.report.addSuccess(sku, productId, localImage.filename, 'upload', `Image uploaded. ID: ${uploaded?.id || 'N/A'}`);
    this.stats.uploaded++;
  }

  async processSku(folder) {
    const { sku, dir } = folder;
    const stateForSku = this.state.skus[sku] || { productId: null, files: {} };
    const localImages = await this.listLocalImages(dir);

    logger.sku(sku, `Found ${localImages.length} local image(s).`);

    if (!localImages.length) {
      await this.report.addSkip(sku, '', '', 'No supported image files found in folder.');
      this.stats.skipped++;
      return;
    }

    let product;
    try {
      product = await this.findProduct(sku);
    } catch (error) {
      await this.report.addError(sku, '', '', 'find_product', error.message);
      logger.sku(sku, `Product not found: ${error.message}`);
      this.stats.errors++;
      return;
    }

    const productId = product.id;
    const remoteImages = await this.client.getProductImages(productId);
    await this.client.delay();

    if (this.dryRun) {
      await this.report.addSuccess(
        sku,
        productId,
        '',
        `dry-run:${this.mode}`,
        `Remote images: ${remoteImages.length}. Local images: ${localImages.length}.`
      );
      this.stats.processed++;
      return;
    }

    if (this.mode === 'replace') {
      logger.sku(sku, `Deleting ${remoteImages.length} existing image(s).`);
      await this.deleteImages(productId, remoteImages, sku, 'delete_replace');
      stateForSku.files = {};
    }

    let position = 1;
    for (const localImage of localImages) {
      const previous = stateForSku.files[localImage.filename];
      const unchanged = previous?.hash === localImage.hash && previous?.imageId;

      if ((this.mode === 'add' || this.mode === 'sync') && unchanged) {
        await this.report.addSkip(sku, productId, localImage.filename, 'File hash already synced.');
        this.stats.skipped++;
        position++;
        continue;
      }

      if (this.mode === 'sync' && previous?.imageId && previous.hash !== localImage.hash) {
        await this.deleteImages(productId, [{ id: previous.imageId }], sku, 'delete_changed');
      }

      try {
        await this.uploadImage(productId, sku, localImage, position, stateForSku);
        logger.sku(sku, `Uploaded ${localImage.filename}.`);
      } catch (error) {
        await this.report.addError(sku, productId, localImage.filename, 'upload', error.message);
        logger.sku(sku, `Upload failed for ${localImage.filename}: ${error.message}`);
        this.stats.errors++;
      }

      position++;
    }

    stateForSku.productId = productId;
    stateForSku.updatedAt = new Date().toISOString();
    this.state.skus[sku] = stateForSku;
    this.stats.processed++;
  }

  async runWithConcurrency(items, limit, worker) {
    const queue = [...items];
    const workers = Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        await worker(item);
      }
    });
    await Promise.all(workers);
  }

  async run() {
    await this.initialize();
    const folders = await this.listSkuFolders();
    this.stats.skusFound = folders.length;
    let completedFolders = 0;

    if (!folders.length) {
      throw new Error('No SKU folders found.');
    }

    logger.header('SKU Image Sync');
    logger.info(`Images root: ${this.imagesRoot}`);
    logger.info(`Mode: ${this.mode}${this.dryRun ? ' (dry-run)' : ''}`);
    if (this.batch?.label) {
      logger.info(`Batch: ${this.batch.label}`);
    }
    logger.info(`SKU folders: ${folders.length}`);
    logger.info(`Concurrency: ${this.concurrency}`);
    logger.info(`Report: ${path.resolve(this.reportPath)}`);
    this.onProgress?.({ total: folders.length, completed: 0, currentSku: null });

    await this.runWithConcurrency(folders, this.concurrency, async (folder) => {
      try {
        this.onProgress?.({ total: folders.length, completed: completedFolders, currentSku: folder.sku });
        await this.processSku(folder);
      } catch (error) {
        await this.report.addError(folder.sku, '', '', 'process_sku', error.message);
        logger.error(`SKU ${folder.sku}: ${error.message}`);
        this.stats.errors++;
      } finally {
        completedFolders++;
        this.onProgress?.({ total: folders.length, completed: completedFolders, currentSku: folder.sku });
      }
    });

    if (!this.dryRun) {
      await this.saveState();
    }

    logger.header('Summary');
    logger.info(`Processed SKUs: ${this.stats.processed}`);
    logger.info(`Uploaded images: ${this.stats.uploaded}`);
    logger.info(`Deleted images: ${this.stats.deleted}`);
    logger.info(`Skipped items: ${this.stats.skipped}`);
    logger.info(`Errors: ${this.stats.errors}`);

    return {
      stats: this.stats,
      batch: this.batch,
      report: this.report.getSummary(),
    };
  }
}

export default ImageSyncService;
