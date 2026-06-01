/**
 * Cliente da API da Nuvemshop
 */

import logger from '../utils/logger.js';

const API_VERSION = '2025-03';
const MAX_RETRIES = 5;
const RETRY_DELAY_BASE = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class NuvemshopClient {
  constructor(config) {
    this.storeId = config.storeId;
    this.accessToken = config.accessToken;
    this.userAgent = config.userAgent;
    this.baseUrl = `https://api.nuvemshop.com.br/${API_VERSION}/${this.storeId}`;
    this.requestDelay = config.requestDelay || 250;
  }

  static fromEnv() {
    const storeId = process.env.NUVEMSHOP_STORE_ID;
    const accessToken = process.env.NUVEMSHOP_ACCESS_TOKEN;
    const userAgent = process.env.NUVEMSHOP_USER_AGENT || 'SKU Image Sync';

    const missing = [];
    if (!storeId) missing.push('NUVEMSHOP_STORE_ID');
    if (!accessToken) missing.push('NUVEMSHOP_ACCESS_TOKEN');

    if (missing.length > 0) {
      throw new Error(`Configure no .env: ${missing.join(', ')}`);
    }

    return new NuvemshopClient({
      storeId,
      accessToken,
      userAgent,
    });
  }

  async request(endpoint, options = {}, attempt = 1) {
    const url = `${this.baseUrl}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authentication: `bearer ${this.accessToken}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const text = await response.text();
    let data = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    // Retry em caso de rate limit ou erro de servidor
    if ((response.status === 429 || response.status >= 500) && attempt <= MAX_RETRIES) {
      const waitMs = Math.min(RETRY_DELAY_BASE * Math.pow(2, attempt), 15000);
      logger.warn(`API retornando ${response.status}, tentativa ${attempt}/${MAX_RETRIES}. Aguardando ${waitMs}ms...`);
      await sleep(waitMs);
      return this.request(endpoint, options, attempt + 1);
    }

    if (!response.ok) {
      const detail = typeof data === 'string' ? data : JSON.stringify(data);
      throw new Error(`API ${response.status}: ${detail}`);
    }

    return data;
  }

  async delay() {
    await sleep(this.requestDelay);
  }

  // === PRODUTOS ===

  async getProductBySku(sku) {
    return this.request(`/products/sku/${encodeURIComponent(sku)}`);
  }

  async getProduct(productId) {
    return this.request(`/products/${productId}`);
  }

  // === IMAGENS ===

  async getProductImages(productId) {
    return this.request(`/products/${productId}/images?per_page=250`);
  }

  async uploadProductImage(productId, { filename, attachment, position }) {
    return this.request(`/products/${productId}/images`, {
      method: 'POST',
      body: JSON.stringify({
        filename,
        attachment,
        position,
      }),
    });
  }

  async deleteProductImage(productId, imageId) {
    return this.request(`/products/${productId}/images/${imageId}`, {
      method: 'DELETE',
    });
  }

  // === VERIFICAÇÃO ===

  async testConnection() {
    try {
      const response = await this.request('/products?per_page=1');
      return {
        success: true,
        storeId: this.storeId,
        message: 'Conexão com a API estabelecida com sucesso',
      };
    } catch (error) {
      return {
        success: false,
        storeId: this.storeId,
        message: error.message,
      };
    }
  }
}

export default NuvemshopClient;
