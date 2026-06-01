import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const SUPPORTED_EXTENSIONS = new Set(['.gif', '.jpg', '.jpeg', '.png', '.webp']);
const UPLOAD_ROOT = path.resolve('uploads');
const sessions = new Map();

function naturalSort(a, b) {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function safeName(value) {
  return String(value || '')
    .replaceAll('\\', '/')
    .split('/')
    .pop()
    .replace(/[^a-zA-Z0-9._ -]/g, '_')
    .trim();
}

export function extractSkuFromFolder(folderName) {
  const normalized = String(folderName || '').trim();
  const match = normalized.match(/^[A-Za-z0-9][A-Za-z0-9._-]*/);
  return match ? match[0] : normalized;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semicolons = (firstLine.match(/;/g) || []).length;
  return semicolons > commas ? ';' : ',';
}

function parseCsv(text) {
  const delimiter = detectDelimiter(text);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index++;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export function parseCsvSkus(text) {
  const rows = parseCsv(text);
  if (!rows.length) return new Set();

  const headers = rows[0].map((header) => header.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
  const knownHeaders = ['sku', 'codigo', 'cod', 'pasta', 'folder', 'produto', 'product_sku'];
  let skuIndex = headers.findIndex((header) => knownHeaders.includes(header));
  const dataRows = skuIndex >= 0 ? rows.slice(1) : rows;

  if (skuIndex < 0) skuIndex = 0;

  return new Set(
    dataRows
      .map((row) => row[skuIndex])
      .filter(Boolean)
      .map((value) => extractSkuFromFolder(value))
  );
}

export async function createUploadSession({ files, manifest, csvText }) {
  const sessionId = crypto.randomUUID();
  const sessionDir = path.join(UPLOAD_ROOT, sessionId);
  const csvSkus = csvText ? parseCsvSkus(csvText) : new Set();
  const groups = new Map();

  await fs.mkdir(sessionDir, { recursive: true });

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    const meta = manifest[index] || {};
    const relativePath = String(meta.path || file.originalname || '').replaceAll('\\', '/');
    const parts = relativePath.split('/').filter(Boolean);
    const folderName = parts.length > 1 ? parts[parts.length - 2] : path.parse(file.originalname).name;
    const filename = safeName(parts.at(-1) || file.originalname);
    const ext = path.extname(filename).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      await fs.rm(file.path, { force: true });
      continue;
    }

    const sku = extractSkuFromFolder(folderName);
    if (csvSkus.size && !csvSkus.has(sku)) {
      await fs.rm(file.path, { force: true });
      continue;
    }

    const groupDir = path.join(sessionDir, sku);
    await fs.mkdir(groupDir, { recursive: true });
    const destination = path.join(groupDir, filename);
    await fs.rename(file.path, destination);

    if (!groups.has(sku)) {
      groups.set(sku, {
        sku,
        sourceFolder: folderName,
        dir: groupDir,
        images: [],
      });
    }

    groups.get(sku).images.push({
      filename,
      size: file.size,
      previewUrl: `/sync/session/${sessionId}/image/${encodeURIComponent(sku)}/${encodeURIComponent(filename)}`,
    });
  }

  const session = {
    id: sessionId,
    dir: sessionDir,
    createdAt: new Date().toISOString(),
    csvSkus: [...csvSkus],
    groups: [...groups.values()].map((group) => ({
      ...group,
      images: group.images.sort((a, b) => naturalSort(a.filename, b.filename)),
    })).sort((a, b) => naturalSort(a.sku, b.sku)),
  };

  sessions.set(sessionId, session);
  return session;
}

export function getUploadSession(sessionId) {
  return sessions.get(sessionId) || null;
}

export function getSessionImagePath(sessionId, sku, filename) {
  const session = getUploadSession(sessionId);
  if (!session) return null;

  const group = session.groups.find((item) => item.sku === sku);
  if (!group) return null;

  const resolved = path.resolve(group.dir, filename);
  if (!resolved.startsWith(path.resolve(group.dir))) return null;
  return resolved;
}

export function foldersForSession(session, selectedSkus = []) {
  const selected = new Set(selectedSkus.length ? selectedSkus : session.groups.map((group) => group.sku));
  return session.groups
    .filter((group) => selected.has(group.sku))
    .map((group) => ({
      sku: group.sku,
      dir: group.dir,
      sourceFolder: group.sourceFolder,
    }));
}
