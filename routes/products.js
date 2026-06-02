import { Router } from 'express';

import NuvemshopClient from '../services/nuvemshop.js';
import { readStoreSession } from '../services/session.js';

const router = Router();

router.get('/sku/:sku', async (req, res) => {
  try {
    const client = await NuvemshopClient.fromStore(readStoreSession(req));
    const product = await client.getProductBySku(req.params.sku);
    res.json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/:id/images', async (req, res) => {
  try {
    const client = await NuvemshopClient.fromStore(readStoreSession(req));
    const images = await client.getProductImages(req.params.id);
    res.json({
      success: true,
      productId: req.params.id,
      count: images.length,
      images,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const client = await NuvemshopClient.fromStore(readStoreSession(req));
    const product = await client.getProduct(req.params.id);
    res.json({
      success: true,
      product,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
