/**
 * Gerador de relatórios CSV
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const HEADERS = ['data', 'sku', 'produto_id', 'arquivo', 'acao', 'status', 'mensagem'];

function csvEscape(value) {
  const str = String(value ?? '');
  return `"${str.replaceAll('"', '""')}"`;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export class CsvReport {
  constructor(reportPath = 'relatorio-sync.csv') {
    this.reportPath = path.resolve(reportPath);
    this.rows = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    const exists = await pathExists(this.reportPath);
    if (!exists) {
      await fs.writeFile(this.reportPath, HEADERS.join(';') + '\n', 'utf8');
    }
    this.initialized = true;
  }

  async addRow(row) {
    await this.initialize();

    const record = {
      data: row.data || new Date().toISOString(),
      sku: row.sku || '',
      produto_id: row.produto_id || '',
      arquivo: row.arquivo || '',
      acao: row.acao || '',
      status: row.status || '',
      mensagem: row.mensagem || '',
    };

    const line = HEADERS.map((key) => csvEscape(record[key])).join(';') + '\n';
    await fs.appendFile(this.reportPath, line, 'utf8');
    this.rows.push(record);
  }

  async addSuccess(sku, productId, arquivo, acao, mensagem) {
    await this.addRow({
      sku,
      produto_id: productId,
      arquivo,
      acao,
      status: 'ok',
      mensagem,
    });
  }

  async addError(sku, productId, arquivo, acao, mensagem) {
    await this.addRow({
      sku,
      produto_id: productId,
      arquivo,
      acao,
      status: 'erro',
      mensagem,
    });
  }

  async addSkip(sku, productId, arquivo, mensagem) {
    await this.addRow({
      sku,
      produto_id: productId,
      arquivo,
      acao: 'skip',
      status: 'ok',
      mensagem,
    });
  }

  getSummary() {
    const total = this.rows.length;
    const success = this.rows.filter((r) => r.status === 'ok').length;
    const errors = this.rows.filter((r) => r.status === 'erro').length;
    const skipped = this.rows.filter((r) => r.acao === 'skip').length;
    const uploads = this.rows.filter((r) => r.acao === 'upload' && r.status === 'ok').length;
    const deletes = this.rows.filter((r) => r.acao === 'delete' && r.status === 'ok').length;

    return {
      total,
      success,
      errors,
      skipped,
      uploads,
      deletes,
      reportPath: this.reportPath,
    };
  }
}

export default CsvReport;
