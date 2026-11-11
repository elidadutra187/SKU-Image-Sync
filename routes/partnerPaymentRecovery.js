import crypto from 'node:crypto';
import { Router } from 'express';
import { applyVerifiedPartnerPaymentEvidence } from '../services/partnerPaymentRecovery.js';

function authorized(provided, expected) {
  if (typeof provided !== 'string' || !expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Separate key from public webhook HMAC; only one explicitly authenticated
// operator may send records independently verified in the Partners portal.
export function createPartnerPaymentRecoveryRouter({
  apply = applyVerifiedPartnerPaymentEvidence,
  adminKey = () => process.env.PARTNERS_RECONCILE_OPS_KEY
} = {}) {
  const router = Router();
  router.post('/verified-credit', async (req, res) => {
    const expected = adminKey();
    if (!expected) return res.status(503).json({ success: false, error: 'recovery_disabled' });
    if (!authorized(req.get('x-eluna-reconcile-key'), expected)) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }
    if (!req.is('application/json') || !req.body || JSON.stringify(req.body).length > 4096) {
      return res.status(400).json({ success: false, error: 'invalid_request' });
    }
    try {
      const result = await apply(req.body);
      return res.status(200).json({ success: true, ...result });
    } catch (error) {
      const invalid = /^(invalid_partners_payment_evidence|unknown_or_uninstalled_store|partners_credit_already_bound)$/.test(error.message);
      return res.status(invalid ? 422 : 503).json({
        success: false, error: invalid ? error.message : 'payment_reconciliation_unavailable'
      });
    }
  });
  return router;
}
export default createPartnerPaymentRecoveryRouter();
