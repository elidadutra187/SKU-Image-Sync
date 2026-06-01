/**
 * Serviço de sincronização de imagens por SKU
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import logger from '../utils/logger.js';
import CsvReport from '../utils/csvReport.js';
import NuvemshopClient from './nuvemshop.js';

const SUPPORTED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const STATE_FILE = '.nuvemshop-sync-state.json';

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

async function sha256File(filePath) {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export class ImageSyncService {
  constructor(options = {}) {
    this.imagesRoot = path.resolve(options.imagesRoot || './Fotos');
    this.mode = options.mode || 'sync';
    this.dryRun = options.dryRun || false;
    this.concurrency = options.concurrency || 2;
    this.onlySku = options.onlySku || null;
    this.maxSkus = options.maxSkus || null;
    this.statePath = path.resolve(options.stateFile || STATE_FILE);
    this.reportPath = options.reportPath || `relatorio-sync-${Date.now()}.csv`;

    this.client = null;
    this.state = { skus: {} };
    this.report = null;
    this.stats = {
      processed: 0,
      uploaded: 0,
      deleted: 0,
      skipped: 0,
      errors: 0,
    };
  }

  async initialize() {
    this.client = NuvemshopClient.fromEnv();
    this.state = await this.loadState();
    this.report = new CsvReport(this.reportPath);

    if (!(await pathExists(this.imagesRoot))) {
      throw new Error(`Pasta de imagens não encontrada: ${this.imagesRoot}`);
    }
  }

  async loadState() {
    if (!(await pathExists(this.statePath))) {
      return { skus: {} };
    }
    const raw = await fs.readFile(this.statePath, 'utf8');
    return JSON.parse(raw);
  }

  async saveState() {
    await fs.writeFile(this.statePath, JSON.stringify(this.state, null, 2), 'utf8');
  }

  async listSkuFolders() {
    const entries = await fs.readdir(this.imagesRoot, { withFileTypes: true });

    let folders = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        sku: entry.name.trim(),
        dir: path.join(this.imagesRoot, entry.name),
      }))
      .filter((item) => item.sku.length > 0)
      .sort((a, b) => naturalSort(a.sku, b.sku));

    if (this.onlySku) {
      folders = folders.filter((item) => item.sku === this.onlySku);
    }

    if (this.maxSkus) {
      folders = folders.slice(0, this.maxSkus);
    }

    return folders;
  }

  async listImagesInFolder(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!SUPPORTED_EXTENSIONS.has(ext)) continue;

      const filePath = path.join(dir, entry.name);
      const stat = await fs.stat(filePath);

      files.push({
        filename: entry.name,
        filePath,
        size: stat.size,
        hash: await sha256File(filePath),
      });
    }

    return files.sort((a, b) => naturalSort(a.filename, b.filename));
  }

  async processSku(folder) {
    const { sku, dir } = folder;
    const stateForSku = this.state.skus[sku] || { productId: null, files: {} };

    logger.sku(sku, 'Lendo imagens da pasta...');
    const localImages = await this.listImagesInFolder(dir);

    if (localImages.length === 0) {
      await this.report.addSkip(sku, '', '', 'Nenhuma imagem suportada na pasta');
      logger.sku(sku, 'Nenhuma imagem encontrada');
      return;
    }

    // Buscar produto
    let product;
    try {
      product = await this.client.getProductBySku(sku);
      await this.client.delay();
    } catch (error) {
      await this.report.addError(sku, '', '', 'buscar_produto', error.message);
      logger.sku(sku, `Produto não encontrado: ${error.message}`);
      this.stats.errors++;
      return;
    }

    const productId = product?.id;
    if (!productId) {
      await this.report.addError(sku, '', '', 'buscar_produto', 'Produto sem ID');
      this.stats.errors++;
      return;
    }

    logger.sku(sku, `Produto ${productId} encontrado. ${localImages.length} imagens locais`);

    // Modo DRY-RUN
    if (this.dryRun) {
      const currentImages = await this.client.getProductImages(productId);
      await this.report.addSuccess(sku, productId, '', `dry-run:${this.mode}`,
        `Loja: ${currentImages.length} imagens. Local: ${localImages.length} imagens`);
      logger.sku(sku, `[DRY-RUN] Loja: ${currentImages.length}, Local: ${localImages.length}`);
      return;
    }

    // Modo REPLACE: apagar todas as imagens primeiro
    if (this.mode === 'replace') {
      const currentImages = await this.client.getProductImages(productId);
      logger.sku(sku, `Removendo ${currentImages.length} imagens atuais...`);

      for (const image of currentImages) {
        try {
          await this.client.deleteProductImage(productId, image.id);
          await this.client.delay();
          await this.report.addSuccess(sku, productId, image.id, 'delete', 'Imagem removida');
          this.stats.deleted++;
        } catch (error) {
          await this.report.addError(sku, productId, image.id, 'delete', error.message);
          this.stats.errors++;
        }
      }

      stateForSku.files = {};
    }

    // Processar cada imagem local
    let position = 1;
    for (const localImage of localImages) {
      const previous = stateForSku.files[localImage.filename];
      const unchanged = previous?.hash === localImage.hash && previous?.imageId;

      // Skip se já sincronizado (modos sync e add)
      if ((this.mode === 'sync' || this.mode === 'add') && unchanged) {
        await this.report.addSkip(sku, productId, localImage.filename, 'Já sincronizado');
        this.stats.skipped++;
        position++;
        continue;
      }

      // Modo SYNC: remover imagem alterada antes de reenviar
      if (this.mode === 'sync' && previous?.imageId && previous.hash !== localImage.hash) {
        try {
          await this.client.deleteProductImage(productId, previous.imageId);
          await this.client.delay();
          await this.report.addSuccess(sku, productId, localImage.filename, 'delete_changed',
            `Imagem ${previous.imageId} removida para reenvio`);
          this.stats.deleted++;
        } catch (error) {
          await this.report.addError(sku, productId, localImage.filename, 'delete_changed', error.message);
        }
      }

      // Upload da imagem
      try {
        if (localImage.size > MAX_IMAGE_BYTES) {
          throw new Error(`Imagem maior que 10MB: ${localImage.size} bytes`);
        }

        const base64 = (await fs.readFile(localImage.filePath)).toString('base64');
        const uploaded = await this.client.uploadProductImage(productId, {
          filename: localImage.filename,
          attachment: base64,
          position,
        });
        await this.client.delay();

        stateForSku.productId = productId;
        stateForSku.files[localImage.filename] = {
          hash: localImage.hash,
          imageId: uploaded?.id || null,
          uploadedAt: new Date().toISOString(),
          size: localImage.size,
        };

        await this.report.addSuccess(sku, productId, localImage.filename, 'upload',
          `Imagem enviada. ID: ${uploaded?.id || 'N/A'}`);
        logger.sku(sku, `Enviada: ${localImage.filename}`);
        this.stats.uploaded++;
      } catch (error) {
        await this.report.addError(sku, productId, localImage.filename, 'upload', error.message);
        logger.sku(sku, `Erro ao enviar ${localImage.filename}: ${error.message}`);
        this.stats.errors++;
      }

      position++;
    }

    this.state.skus[sku] = stateForSku;
    this.stats.processed++;
  }

  async runWithConcurrency(items, limit, worker) {
    const queue = [...items];
    const workers = Array.from({ length: limit }, async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        await worker(item);
      }
    });
    await Promise.all(workers);
  }

  async run() {
    await this.initialize();

    const folders = await this.listSkuFolders();

    if (folders.length === 0) {
      throw new Error('Nenhuma pasta de SKU encontrada');
    }

    logger.header('SKU Image Sync');
    logger.info(`Pasta: ${this.imagesRoot}`);
    logger.info(`Modo: ${this.mode}${this.dryRun ? ' (DRY-RUN)' : ''}`);
    logger.info(`SKUs encontrados: ${folders.length}`);
    logger.info(`Concorrência: ${this.concurrency}`);
    logger.info(`Relatório: ${this.reportPath}`);
    logger.separator();

    await this.runWithConcurrency(folders, this.concurrency, async (folder) => {
      try {
        await this.processSku(folder);
      } catch (error) {
        await this.report.addError(folder.sku, '', '', 'processar_sku', error.message);
        logger.error(`SKU ${folder.sku}: ${error.message}`);
        this.stats.errors++;
      }
    });

    if (!this.dryRun) {
      await this.saveState();
    }

    logger.separator();
    logger.header('Resumo');
    logger.info(`SKUs processados: ${this.stats.processed}`);
    logger.info(`Imagens enviadas: ${this.stats.uploaded}`);
    logger.info(`Imagens removidas: ${this.stats.deleted}`);
    logger.info(`Imagens ignoradas: ${this.stats.skipped}`);
    logger.info(`Erros: ${this.stats.errors}`);
    logger.info(`Relatório salvo em: ${this.reportPath}`);

    return {
      stats: this.stats,
      report: this.report.getSummary(),
    };
  }
}

export default ImageSyncService;
