/**
 * SKU Image Sync - Servidor Express
 * Sincroniza imagens de produtos da Nuvemshop através do SKU
 */

import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import authRoutes from './routes/auth.js';
import syncRoutes from './routes/sync.js';
import productsRoutes from './routes/products.js';
import logger from './utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API
app.use('/auth', authRoutes);
app.use('/sync', syncRoutes);
app.use('/products', productsRoutes);

// Páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

app.get('/support', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'support.html'));
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// API info
app.get('/api', (req, res) => {
  res.json({
    name: 'SKU Image Sync',
    version: '1.0.0',
    endpoints: {
      auth: {
        'GET /auth/status': 'Verificar conexão com Nuvemshop',
      },
      sync: {
        'POST /sync/add': 'Adicionar imagens novas',
        'POST /sync/sync': 'Sincronizar imagens',
        'POST /sync/replace': 'Substituir todas as imagens',
        'POST /sync/dry-run': 'Simular sincronização',
        'GET /sync/status': 'Status da sincronização',
      },
      products: {
        'GET /products/sku/:sku': 'Buscar produto por SKU',
        'GET /products/:id': 'Buscar produto por ID',
        'GET /products/:id/images': 'Listar imagens do produto',
      },
    },
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    error: 'Rota não encontrada',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error(err.message);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: err.message,
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  logger.header('SKU Image Sync');
  logger.info(`Servidor rodando na porta ${PORT}`);
  logger.info(`http://localhost:${PORT}`);
  logger.separator();
});

export default app;
