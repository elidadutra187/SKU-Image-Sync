import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { createPurchaseLedger } from '../services/yampiPurchaseLedger.js';
async function fixture({ failProjection = false } = {}) {
    const db = new PGlite();
    await db.exec('CREATE TABLE image_sync_access(store_id text PRIMARY KEY,paid_at timestamptz,payment_reference text,demo_batches_used integer NOT NULL DEFAULT 0);');
    let queue = Promise.resolve();
    const pool = { query: async (sql, params) => !params && sql.includes(';') ? db.exec(sql) : db.query(sql, params), connect: async () => { const prev = queue; let release; queue = new Promise(r => release = r); await prev; return { query: async (sql, params) => { if (failProjection && sql.startsWith('UPDATE image_sync_access'))
                throw Error('projection_failed'); return db.query(sql, params); }, release }; } };
    return { db, repo: createPurchaseLedger(pool) };
}
test('one-time intent is unique under concurrency and uncertain requests cannot create a second preference', async () => {
    const { db, repo } = await fixture();
    try {
        const rows = await Promise.all(Array.from({ length: 5 }, () => repo.reserve('yampi:one')));
        assert.equal(rows.filter(r => r.created).length, 1);
        await repo.uncertain(rows[0].intent.external_reference);
        assert.equal((await repo.reserve('yampi:one')).created, false);
    }
    finally {
        await db.close();
    }
});
test('one-time receipts are idempotent, refunds cannot be reversed by delayed approval, and other stores cannot steal a receipt', async () => {
    const { db, repo } = await fixture();
    try {
        const { intent } = await repo.reserve('yampi:one');
        await repo.savePreference(intent.external_reference, { id: '123-one', external_reference: intent.external_reference });
        const p = { id: 7, external_reference: intent.external_reference, status: 'approved', transaction_amount: 79.9, currency_id: 'BRL', date_approved: '2026-10-25T12:00:00Z' };
        await repo.apply(p);
        await repo.apply(p);
        assert.equal((await db.query('SELECT count(*)::int n FROM yampi_purchase_receipts')).rows[0].n, 1);
        assert.ok((await db.query('SELECT paid_at FROM image_sync_access')).rows[0].paid_at);
        await repo.apply({ ...p, status: 'refunded' });
        await repo.apply(p);
        assert.equal((await db.query('SELECT paid_at FROM image_sync_access')).rows[0].paid_at, null);
        const other = await repo.reserve('yampi:two');
        await repo.savePreference(other.intent.external_reference, { id: '123-two', external_reference: other.intent.external_reference });
        await assert.rejects(repo.apply({ ...p, external_reference: other.intent.external_reference }), /receipt_identity_mismatch/);
        assert.equal((await db.query('SELECT demo_batches_used FROM image_sync_access WHERE store_id=$1', ['yampi:one'])).rows[0].demo_batches_used, 0);
    }
    finally {
        await db.close();
    }
});
test('failed access projection rolls back the one-time receipt', async () => {
    const { db, repo } = await fixture({ failProjection: true });
    try {
        const { intent } = await repo.reserve('yampi:one');
        await repo.savePreference(intent.external_reference, { id: '123-one', external_reference: intent.external_reference });
        await assert.rejects(repo.apply({ id: 7, external_reference: intent.external_reference, status: 'approved', transaction_amount: 79.9, currency_id: 'BRL', date_approved: '2026-10-25T12:00:00Z' }), /projection_failed/);
        assert.equal((await db.query('SELECT count(*)::int n FROM yampi_purchase_receipts')).rows[0].n, 0);
    }
    finally {
        await db.close();
    }
});
