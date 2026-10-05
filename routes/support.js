import { Router } from 'express';
import multer from 'multer';
import { sendSupportRequest, supportConfigured, SUPPORT_EMAIL, SUPPORT_MAX_ATTACHMENT_BYTES } from '../services/support.js';

const allowedTypes = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain', '.doc': 'application/msword', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
function validAttachment(file) {
  const extension = /\.[a-z0-9]+$/i.exec(file.originalname)?.[0].toLowerCase();
  if (allowedTypes[extension] !== file.mimetype) return false;
  const bytes = file.buffer;
  if (extension === '.txt') return !bytes.includes(0);
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (extension === '.jpg' || extension === '.jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (extension === '.webp') return bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP';
  if (extension === '.pdf') return bytes.subarray(0,5).toString() === '%PDF-';
  if (extension === '.docx') return bytes[0] === 80 && bytes[1] === 75;
  return bytes.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225]));
}
function validate(body) {
  const limits = { name: 120, email: 254, storeUrl: 2048, subject: 160, message: 5000 };
  const request = {};
  for (const [field, limit] of Object.entries(limits)) {
    if (typeof body?.[field] !== 'string') return null;
    const value = body[field].trim();
    if (!value || value.length > limit || (field !== 'message' && /[\r\n\0]/.test(value))) return null;
    request[field] = value;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) return null;
  try { const url = new URL(request.storeUrl); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null; }
  catch { return null; }
  return request;
}
export function createSupportRouter({ send = sendSupportRequest, maxRequests = 5, windowMs = 15 * 60 * 1000 } = {}) {
  const router = Router();
  const clients = new Map();
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: SUPPORT_MAX_ATTACHMENT_BYTES, files: 1, fields: 5, parts: 7, fieldSize: 10000, fieldNameSize: 30 } });
  router.get('/status', (req, res) => res.json({ configured: supportConfigured(), email: SUPPORT_EMAIL }));
  router.post('/', (req, res, next) => {
    if (req.get('origin')) {
      try { if (new URL(req.get('origin')).origin !== `${req.protocol}://${req.get('host')}`) return res.status(403).json({ error: 'invalid_origin' }); }
      catch { return res.status(403).json({ error: 'invalid_origin' }); }
    }
    const now = Date.now();
    for (const [key, entry] of clients) if (entry.until <= now) clients.delete(key);
    const key = req.ip;
    if (!clients.has(key) && clients.size >= 2048) return res.status(429).json({ error: 'support_rate_limit_exceeded' });
    const entry = clients.get(key) || { count: 0, until: now + windowMs };
    clients.set(key, entry);
    if (++entry.count > maxRequests) return res.status(429).set('Retry-After', String(Math.ceil((entry.until - now) / 1000))).json({ error: 'support_rate_limit_exceeded' });
    next();
  }, upload.single('attachment'), async (req, res) => {
    const request = validate(req.body);
    if (!request || (req.file && !validAttachment(req.file))) return res.status(422).json({ error: 'invalid_support_request' });
    try {
      const delivery = await send({ request, attachment: req.file });
      res.json({ ok: true, mailStatus: 'sent', ticketId: delivery.ticketId, receiptSent: delivery.receiptSent, receiptEmail: request.email });
    } catch (error) {
      res.status(error.message === 'support_not_configured' ? 503 : 502).json({ error: error.message === 'support_not_configured' ? 'support_not_configured' : 'support_delivery_unavailable' });
    }
  });
  router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) return res.status(422).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'attachment_too_large' : 'invalid_support_request' });
    return res.status(400).json({ error: 'invalid_support_request' });
  });
  return router;
}
export default createSupportRouter();
