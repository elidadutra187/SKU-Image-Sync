import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import productsRoutes from './routes/products.js';
import syncRoutes from './routes/sync.js';
import webhookRoutes from './routes/webhooks.js';
import { startUploadSessionCleanup } from './services/uploadSessions.js';
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
startUploadSessionCleanup();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'support.html'));
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    name: 'SKU Image Sync',
    version: '1.0.0',
    time: new Date().toISOString(),
  });
});

app.get('/api', (req, res) => {
  res.json({
    name: 'SKU Image Sync',
    routes: {
      pages: ['GET /', 'GET /privacy', 'GET /support'],
      auth: ['GET /auth/install', 'GET /auth/callback', 'GET /auth/status'],
      sync: ['POST /sync/preview', 'POST /sync/session/:sessionId/run', 'POST /sync/dry-run', 'POST /sync/add', 'POST /sync/sync', 'POST /sync/replace', 'GET /sync/status'],
      products: ['GET /products/sku/:sku', 'GET /products/:id', 'GET /products/:id/images'],
      webhooks: ['GET /webhooks/status', 'POST /webhooks/store-redact', 'POST /webhooks/customers-redact', 'POST /webhooks/customers-data-request'],
    },
  });
});

app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/products', productsRoutes);
app.use('/webhooks', webhookRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
});

app.use((err, req, res, next) => {
  logger.error(err.stack || err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

app.listen(port, () => {
  logger.header('SKU Image Sync');
  logger.info(`Server running on port ${port}`);
  logger.info(`Local URL: http://localhost:${port}`);
});

export default app;
