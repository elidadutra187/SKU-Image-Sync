import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { imageGroupName, normalizeName, matchProduct, displayProductName } from './productMatching.js';
import { csvRowMatchesFile, parseCsv, parseCsvAssignments } from './csvMapping.js';

export { parseCsvAssignments };

const SUPPORTED_EXTENSIONS = new Set(['.gif', '.jpg', '.jpeg', '.png', '.webp']);
const UPLOAD_ROOT = path.resolve('uploads');
const DEFAULT_SESSION_TTL_MS = 6 * 60 * 60 * 1000;
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

const invalidCsv=message=>Object.assign(new Error(message),{status:400,public:true});

export async function createUploadSession({ files, manifest = [], csvText, batch, storeId, catalog = [], individual = false, inputMode = 'images' }) {
  await cleanupExpiredUploadSessions();

  const sessionId = crypto.randomUUID();
  const sessionDir = path.join(UPLOAD_ROOT, sessionId);
  const csvMap=inputMode==='csv'?parseCsvAssignments(csvText):null;
  const csvSkus = csvText&&!csvMap ? parseCsvSkus(csvText) : new Set();
  const assignments=new Map();
  if(csvMap)for(const [key,row] of csvMap) {
    const matches=files.map((file,index)=>({file,index}))
      .filter(item=>csvRowMatchesFile(key,manifest[item.index]?.path||item.file.originalname,item.file.originalname));
    if(matches.length!==1)throw invalidCsv(matches.length?`Há mais de uma foto chamada ${row.filename}. Informe o caminho completo no CSV.`:`A foto ${row.filename} do CSV não foi selecionada. Selecione as fotos indicadas na planilha.`);
    const index=matches[0].index;
    if(assignments.has(index)&&assignments.get(index)!==row.sku)throw invalidCsv(`O arquivo ${row.filename} está associado a mais de um SKU no CSV.`);
    assignments.set(index,row.sku);
  }
  const groups = new Map();

  await fs.mkdir(sessionDir, { recursive: true });

  for (let index = 0; index < files.length; index++) {
    const file = files[index];
    if(csvMap&&!assignments.has(index))continue;
    const meta = manifest[index] || {};
    const relativePath = String(meta.path || file.originalname || '').replaceAll('\\', '/');
    const parts = relativePath.split('/').filter(Boolean);
    const csvSku=assignments.get(index);
    const csvProducts=csvSku?catalog.filter(p=>(p.variants||[]).some(v=>String(v.sku)===csvSku)):[];
    const parent=parts.length>1?parts[parts.length-2]:'';
    const parentMatch=parent?matchProduct(parent,catalog):{status:'unmatched'};
    const filenameMatch=matchProduct(file.originalname,catalog);
    const useParent=!!parent&&(parentMatch.status!=='unmatched'||parts.length>2&&!filenameMatch.product);
    const exactProduct=!useParent?filenameMatch.product:null;
    const folderName = csvSku || (useParent ? parent
      : exactProduct ? displayProductName(exactProduct) : imageGroupName(file.originalname));
    const filename = safeName(parts.at(-1) || file.originalname);
    const ext = path.extname(filename).toLowerCase();

    if (!SUPPORTED_EXTENSIONS.has(ext)) {
      await fs.rm(file.path, { force: true });
      continue;
    }

    const groupKey = csvSku ? csvProducts.length===1?`csv-product:${csvProducts[0].id}`:`csv:${csvSku}` : individual ? `image:${index}` : exactProduct ? `product:${exactProduct.id}` : normalizeName(folderName);
    if (!groups.has(groupKey)) {
      const id = crypto.randomUUID();
      groups.set(groupKey, { sku: id, sourceFolder: folderName,csvSku,
        dir: path.join(sessionDir, id), images: [] });
    }
    const group = groups.get(groupKey);
    const sku = group.sku;
    const groupDir = group.dir;
    await fs.mkdir(groupDir, { recursive: true });
    let storedFilename = filename;
    if (group.images.some(image => image.filename === storedFilename)) {
      storedFilename = `${path.parse(filename).name}-${crypto.randomUUID()}${ext}`;
    }
    const destination = path.join(groupDir, storedFilename);
    await fs.rename(file.path, destination);
    group.images.push({
      filename: storedFilename,
      originalName: parts.at(-1) || file.originalname,
      size: file.size,
      previewUrl: `/sync/session/${sessionId}/image/${encodeURIComponent(sku)}/${encodeURIComponent(storedFilename)}`,
    });
  }

  const session = {
    id: sessionId,
    dir: sessionDir,
    createdAt: new Date().toISOString(),
    storeId: storeId || null,
    batch: batch || null,
    csvSkus: [...csvSkus],
    groups: [...groups.values()].map((group) => ({
      ...group,
      images: group.images.sort((a, b) => naturalSort(a.filename, b.filename)),
    })).sort((a, b) => naturalSort(a.sourceFolder, b.sourceFolder)),
  };

  sessions.set(sessionId, session);
  return session;
}

export function getUploadSession(sessionId) {
  const session = sessions.get(sessionId) || null;
  if (!session) return null;

  if (!session.running && isExpired(session)) {
    deleteUploadSession(sessionId).catch(()=>{});
    return null;
  }

  return session;
}

export function getSessionImagePath(sessionId, sku, filename) {
  const session = getUploadSession(sessionId);
  if (!session) return null;

  const group = session.groups.find((item) => item.sku === sku);
  if (!group) return null;
  if (!group.images.some(image => image.filename === filename)) return null;

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
      productId: group.productId,
    }));
}

function sessionTtlMs() {
  const value = Number(process.env.UPLOAD_SESSION_TTL_MS || DEFAULT_SESSION_TTL_MS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_SESSION_TTL_MS;
}

function isExpired(session) {
  return Date.now() - new Date(session.createdAt).getTime() > sessionTtlMs();
}

export async function deleteUploadSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;

  sessions.delete(sessionId);
  await fs.rm(session.dir, { recursive: true, force: true });
  return true;
}

export async function cleanupExpiredUploadSessions() {
  const removed = [];
  for (const session of sessions.values()) {
    if (!session.running && isExpired(session)) {
      await deleteUploadSession(session.id);
      removed.push(session.id);
    }
  }
  return removed;
}

export async function deleteStoreUploadSessions(storeId) {
  for(const session of sessions.values())if(session.storeId===String(storeId))await deleteUploadSession(session.id);
}

export function startUploadSessionCleanup() {
  const intervalMs = Math.min(sessionTtlMs(), 30 * 60 * 1000);
  const timer = setInterval(() => {
    cleanupExpiredUploadSessions().catch(() => {});
  }, intervalMs);
  timer.unref?.();
  return timer;
}
