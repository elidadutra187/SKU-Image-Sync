import { getPool, initializeDatabase } from './database.js';
import { recordPartnerPaymentEvidence } from './partnerPayments.js';

// This operation is deliberately administrative: a Partners credit cannot be
// verified through a documented read API. Only a trusted operator who checked
// the canonical Partners record may call it. Never expose to merchant sessions.
export async function applyVerifiedPartnerPaymentEvidence(input, {
  client, appId = process.env.NUVEMSHOP_CLIENT_ID
} = {}) {
  const ownsClient = !client;
  if (ownsClient) {
    await initializeDatabase();
    const pool = getPool();
    if (!pool) throw new Error('database_unavailable');
    client = await pool.connect();
  }
  const query = (...args) => client.query(...args);
  try {
    await query('BEGIN');
    const storeId = String(input?.storeId ?? '');
    const store = await query('SELECT store_id FROM stores WHERE store_id=$1 FOR UPDATE', [storeId]);
    if (store.rows?.length !== 1) throw new Error('unknown_or_uninstalled_store');

    // Stores the immutable, app-bound credit with UNIQUE(credit_id). Replays with
    // different metadata are rejected, including a credit reused by another store.
    await recordPartnerPaymentEvidence(input, { query, appId });

    // The native charge ledger remains untouched; Partners commissions are not
    // equivalent to an API charge event. This app sells permanent ONE-TIME access.
    const result = await query(`
      INSERT INTO image_sync_access (store_id, paid_at, payment_reference)
      VALUES ($1, statement_timestamp(), $2)
      ON CONFLICT (store_id) DO UPDATE SET
        paid_at = COALESCE(image_sync_access.paid_at, excluded.paid_at),
        payment_reference = COALESCE(image_sync_access.payment_reference, excluded.payment_reference)
      RETURNING store_id, paid_at
    `, [storeId, `partners:${input.creditId}`]);
    if (result.rows?.length !== 1) throw new Error('access_grant_failed');
    await query('COMMIT');
    return { storeId, appId: String(appId), creditId: String(input.creditId), applied: true };
  } catch (error) {
    try { await query('ROLLBACK'); } catch { /* preserve original error */ }
    throw error;
  } finally {
    if (ownsClient) client.release();
  }
}

/**
 * Recover previously verified Partners credits that were persisted before the
 * operator recovery endpoint existed, but never projected to paid entitlement.
 * No merchant claim or undocumented Partners endpoint is consulted here.
 * Excludes uninstalled shops and never changes an already paid entitlement.
 * This is a bounded one-shot boot reconciliation, NOT frequent Neon polling.
 */
export async function reconcileStoredPartnersCredits({
  query,
  appId = process.env.NUVEMSHOP_CLIENT_ID,
  apply = applyVerifiedPartnerPaymentEvidence,
  limit = 100
} = {}) {
  if (!/^\d+$/.test(String(appId)) || !Number.isInteger(limit) || limit < 1 || limit > 500) {
    throw new Error('invalid_recovery_parameters');
  }
  if (!query) {
    await initializeDatabase();
    const pool = getPool();
    if (!pool) throw new Error('database_unavailable');
    query = (...args) => pool.query(...args);
  }
  const rows = (await query(`
    SELECT r.evidence FROM image_sync_partner_receipts r
    JOIN stores s ON s.store_id=r.store_id
    LEFT JOIN image_sync_access a ON a.store_id=r.store_id
    WHERE r.app_id=$1 AND r.evidence->>'source'='nuvemshop_partners_commissions'
      AND r.evidence->>'status'='paid' AND a.paid_at IS NULL
    ORDER BY r.verified_at ASC LIMIT $2
  `, [String(appId), limit])).rows || [];
  const results = { examined: rows.length, recovered: 0, failed: 0 };
  for (const row of rows) {
    try {
      await apply(row.evidence, { appId });
      results.recovered += 1;
    } catch {
      results.failed += 1;
    }
  }
  return results;
}
