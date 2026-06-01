import fs from 'node:fs/promises';
import path from 'node:path';

const HEADERS = ['date', 'sku', 'product_id', 'file', 'action', 'status', 'message'];

function csvEscape(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(path.resolve(filePath)), { recursive: true });
}

export class CsvReport {
  constructor(reportPath = 'reports/sku-image-sync.csv') {
    this.reportPath = path.resolve(reportPath);
    this.rows = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    await ensureDir(this.reportPath);
    await fs.writeFile(this.reportPath, `${HEADERS.join(';')}\n`, 'utf8');
    this.initialized = true;
  }

  async addRow(row) {
    await this.initialize();

    const record = {
      date: row.date || new Date().toISOString(),
      sku: row.sku || '',
      product_id: row.product_id || '',
      file: row.file || '',
      action: row.action || '',
      status: row.status || '',
      message: row.message || '',
    };

    const line = `${HEADERS.map((key) => csvEscape(record[key])).join(';')}\n`;
    await fs.appendFile(this.reportPath, line, 'utf8');
    this.rows.push(record);
  }

  addSuccess(sku, productId, file, action, message) {
    return this.addRow({ sku, product_id: productId, file, action, status: 'ok', message });
  }

  addError(sku, productId, file, action, message) {
    return this.addRow({ sku, product_id: productId, file, action, status: 'error', message });
  }

  addSkip(sku, productId, file, message) {
    return this.addRow({ sku, product_id: productId, file, action: 'skip', status: 'ok', message });
  }

  getSummary() {
    return {
      rows: this.rows.length,
      success: this.rows.filter((row) => row.status === 'ok').length,
      errors: this.rows.filter((row) => row.status === 'error').length,
      skipped: this.rows.filter((row) => row.action === 'skip').length,
      uploads: this.rows.filter((row) => row.action === 'upload' && row.status === 'ok').length,
      deletes: this.rows.filter((row) => row.action.startsWith('delete') && row.status === 'ok').length,
      reportPath: this.reportPath,
    };
  }
}

export default CsvReport;
