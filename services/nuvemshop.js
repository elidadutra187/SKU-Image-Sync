import logger from '../utils/logger.js';

const DEFAULT_API_VERSION = '2025-03';
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseResponseBody(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export class NuvemshopClient {
  constructor(config) {
    this.storeId = config.storeId;
    this.accessToken = config.accessToken;
    this.userAgent = config.userAgent;
    this.apiVersion = config.apiVersion || DEFAULT_API_VERSION;
    this.baseUrl = `https://api.nuvemshop.com.br/${this.apiVersion}/${this.storeId}`;
    this.requestDelay = Number(config.requestDelay || 250);
  }

  static fromEnv() {
    const missing = [];
    if (!process.env.NUVEMSHOP_STORE_ID) missing.push('NUVEMSHOP_STORE_ID');
    if (!process.env.NUVEMSHOP_ACCESS_TOKEN) missing.push('NUVEMSHOP_ACCESS_TOKEN');
    if (!process.env.NUVEMSHOP_USER_AGENT) missing.push('NUVEMSHOP_USER_AGENT');

    if (missing.length) {
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    return new NuvemshopClient({
      storeId: process.env.NUVEMSHOP_STORE_ID,
      accessToken: process.env.NUVEMSHOP_ACCESS_TOKEN,
      userAgent: process.env.NUVEMSHOP_USER_AGENT,
      apiVersion: process.env.NUVEMSHOP_API_VERSION || DEFAULT_API_VERSION,
      requestDelay: process.env.NUVEMSHOP_REQUEST_DELAY_MS,
    });
  }

  async request(endpoint, options = {}, attempt = 1) {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        Authentication: `bearer ${this.accessToken}`,
        'User-Agent': this.userAgent,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });

    const data = parseResponseBody(await response.text());

    if ((response.status === 429 || response.status >= 500) && attempt <= MAX_RETRIES) {
      const waitMs = Math.min(RETRY_BASE_MS * 2 ** (attempt - 1), 15000);
      logger.warn(`Nuvemshop API returned ${response.status}. Retry ${attempt}/${MAX_RETRIES} in ${waitMs}ms.`);
      await sleep(waitMs);
      return this.request(endpoint, options, attempt + 1);
    }

    if (!response.ok) {
      const detail = typeof data === 'string' ? data : JSON.stringify(data);
      throw new Error(`Nuvemshop API ${response.status}: ${detail}`);
    }

    return data;
  }

  async delay() {
    if (this.requestDelay > 0) {
      await sleep(this.requestDelay);
    }
  }

  getProductBySku(sku) {
    return this.request(`/products/sku/${encodeURIComponent(sku)}`);
  }

  getProduct(productId) {
    return this.request(`/products/${encodeURIComponent(productId)}`);
  }

  getProductImages(productId) {
    return this.request(`/products/${encodeURIComponent(productId)}/images?per_page=250`);
  }

  uploadProductImage(productId, image) {
    return this.request(`/products/${encodeURIComponent(productId)}/images`, {
      method: 'POST',
      body: JSON.stringify({
        attachment: image.attachment,
        filename: image.filename,
        position: image.position,
      }),
    });
  }

  deleteProductImage(productId, imageId) {
    return this.request(`/products/${encodeURIComponent(productId)}/images/${encodeURIComponent(imageId)}`, {
      method: 'DELETE',
    });
  }

  async testConnection() {
    try {
      await this.request('/products?per_page=1');
      return {
        connected: true,
        storeId: this.storeId,
        apiVersion: this.apiVersion,
        message: 'Connection with Nuvemshop API is working.',
      };
    } catch (error) {
      return {
        connected: false,
        storeId: this.storeId,
        apiVersion: this.apiVersion,
        message: error.message,
      };
    }
  }
}

export default NuvemshopClient;
