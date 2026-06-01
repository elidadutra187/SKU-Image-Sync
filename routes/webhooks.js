import { Router } from 'express';

import logger from '../utils/logger.js';

const router = Router();

function acknowledgeLgpdWebhook(action) {
  return (req, res) => {
    logger.info(`LGPD webhook received: ${action}`);
    res.json({
      success: true,
      action,
      receivedAt: new Date().toISOString(),
    });
  };
}

router.post('/store-redact', acknowledgeLgpdWebhook('store-redact'));
router.post('/customers-redact', acknowledgeLgpdWebhook('customers-redact'));
router.post('/customers-data-request', acknowledgeLgpdWebhook('customers-data-request'));

router.get('/status', (req, res) => {
  res.json({
    success: true,
    webhooks: [
      'POST /webhooks/store-redact',
      'POST /webhooks/customers-redact',
      'POST /webhooks/customers-data-request',
    ],
  });
});

export default router;
