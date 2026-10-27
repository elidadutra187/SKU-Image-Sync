import crypto from 'node:crypto';
const fail = (message, status = 409) => Object.assign(Error(message), { status });
export function createPurchaseLedger(pool) {
    let initialization;
    async function init() {
        initialization ??= pool.query(`
      CREATE TABLE IF NOT EXISTS yampi_purchase_intents(
        id text PRIMARY KEY,store_id text NOT NULL,external_reference text UNIQUE NOT NULL,
        preference_id text UNIQUE,status text NOT NULL DEFAULT 'intent',created_at timestamptz NOT NULL DEFAULT now());
      CREATE UNIQUE INDEX IF NOT EXISTS yampi_one_purchase ON yampi_purchase_intents(store_id)
        WHERE status IN('intent','uncertain','pending','paid');
      CREATE TABLE IF NOT EXISTS yampi_purchase_receipts(
        payment_id text PRIMARY KEY,intent_id text NOT NULL REFERENCES yampi_purchase_intents(id),
        amount_cents integer NOT NULL CHECK(amount_cents=7990),currency text NOT NULL CHECK(currency='BRL'),
        approved_at timestamptz NOT NULL,status text NOT NULL CHECK(status IN('paid','refunded','charged_back')));
    `).catch(e => { initialization = null; throw e; });
        await initialization;
    }
    async function transaction(work) {
        await init();
        const db = await pool.connect();
        try {
            await db.query('BEGIN');
            const result = await work(db);
            await db.query('COMMIT');
            return result;
        }
        catch (e) {
            await db.query('ROLLBACK').catch(() => { });
            throw e;
        }
        finally {
            db.release();
        }
    }
    async function reserve(storeId) {
        if (!/^yampi:[a-z0-9][a-z0-9_-]{0,99}$/.test(storeId))
            throw fail('invalid_store', 401);
        return transaction(async (db) => {
            const id = crypto.randomUUID(), reference = 'elunalab:IE:' + id;
            const inserted = await db.query('INSERT INTO yampi_purchase_intents(id,store_id,external_reference) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING *', [id, storeId, reference]);
            if (inserted.rows[0])
                return { created: true, intent: inserted.rows[0] };
            const existing = await db.query("SELECT * FROM yampi_purchase_intents WHERE store_id=$1 AND status IN('intent','uncertain','pending','paid') FOR UPDATE", [storeId]);
            if (!existing.rows[0])
                throw fail('purchase_conflict');
            return { created: false, intent: existing.rows[0] };
        });
    }
    async function find(reference) { await init(); return (await pool.query('SELECT * FROM yampi_purchase_intents WHERE external_reference=$1', [reference])).rows[0] || null; }
    async function savePreference(reference, p) {
        return transaction(async (db) => {
            const intent = (await db.query('SELECT * FROM yampi_purchase_intents WHERE external_reference=$1 FOR UPDATE', [reference])).rows[0];
            if (!intent || p.external_reference !== reference || (intent.preference_id && intent.preference_id !== String(p.id)))
                throw fail('preference_identity_mismatch');
            await db.query("UPDATE yampi_purchase_intents SET preference_id=$2,status=CASE WHEN status IN('intent','uncertain') THEN 'pending' ELSE status END WHERE external_reference=$1", [reference, String(p.id)]);
        });
    }
    async function uncertain(reference) { await init(); await pool.query("UPDATE yampi_purchase_intents SET status='uncertain' WHERE external_reference=$1 AND preference_id IS NULL", [reference]); }
    async function apply(p) {
        const status = p.status === 'approved' ? 'paid' : p.status;
        if (!['paid', 'refunded', 'charged_back'].includes(status))
            return { pending: true };
        if (!/^\d+$/.test(String(p.id)) || p.currency_id !== 'BRL' || !/^\d+(\.\d{1,2})?$/.test(String(p.transaction_amount)) || Math.round(Number(p.transaction_amount) * 100) !== 7990 || !Number.isFinite(Date.parse(p.date_approved)) || Date.parse(p.date_approved) > Date.now())
            throw fail('invalid_payment', 400);
        return transaction(async (db) => {
            const intent = (await db.query('SELECT * FROM yampi_purchase_intents WHERE external_reference=$1 FOR UPDATE', [p.external_reference])).rows[0];
            if (!intent?.preference_id)
                throw fail('payment_intent_mismatch');
            await db.query('INSERT INTO image_sync_access(store_id,demo_batches_used) VALUES($1,0) ON CONFLICT DO NOTHING', [intent.store_id]);
            await db.query('SELECT store_id FROM image_sync_access WHERE store_id=$1 FOR UPDATE', [intent.store_id]);
            await db.query('INSERT INTO yampi_purchase_receipts(payment_id,intent_id,amount_cents,currency,approved_at,status) VALUES($1,$2,7990,$3,$4,$5) ON CONFLICT DO NOTHING', [String(p.id), intent.id, p.currency_id, p.date_approved, status]);
            const receipt = (await db.query('SELECT * FROM yampi_purchase_receipts WHERE payment_id=$1 FOR UPDATE', [String(p.id)])).rows[0];
            if (receipt.intent_id !== intent.id)
                throw fail('receipt_identity_mismatch');
            if (status !== 'paid')
                await db.query("UPDATE yampi_purchase_receipts SET status=$2 WHERE payment_id=$1 AND status='paid'", [String(p.id), status]);
            const valid = (await db.query("SELECT r.* FROM yampi_purchase_receipts r JOIN yampi_purchase_intents i ON i.id=r.intent_id WHERE i.store_id=$1 AND r.status='paid' ORDER BY r.approved_at DESC LIMIT 1", [intent.store_id])).rows[0];
            await db.query('UPDATE image_sync_access SET paid_at=$2,payment_reference=$3 WHERE store_id=$1', [intent.store_id, valid?.approved_at || null, valid ? 'mercadopago:' + valid.payment_id : null]);
            const intentPaid = (await db.query("SELECT payment_id FROM yampi_purchase_receipts WHERE intent_id=$1 AND status='paid' LIMIT 1", [intent.id])).rows[0];
            await db.query('UPDATE yampi_purchase_intents SET status=$2 WHERE id=$1', [intent.id, intentPaid ? 'paid' : status === 'paid' ? 'refunded' : status]);
            return { paid: !!valid };
        });
    }
    async function list() { await init(); return (await pool.query('SELECT * FROM yampi_purchase_intents ORDER BY created_at')).rows; }
    return { init, reserve, find, savePreference, uncertain, apply, list };
}
