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
