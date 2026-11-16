'use strict';
const {isYampiStoreId,assertYampiStoreId}=require('../billingPlatformPolicy.cjs');
const crypto = require('node:crypto');
const failure = (code, status = 503) => Object.assign(Error(code), { status });
const ACTIVE = "('intent','uncertain','pending','authorized','paused')";
function createYampiSubscriptionRepository({ pool, appCode = 'IE', priceCents = 3990, projectEntitlement, lockStore, lockCheckout, now = Date.now }) {
    if (!pool?.query || !pool?.connect || typeof lockCheckout !== 'function' || typeof projectEntitlement !== 'function' || typeof lockStore !== 'function' || !/^[A-Z]{2,12}$/.test(appCode))
        throw Error('billing_repository_configuration_required');
    let initializing;
    async function init() { if (!initializing)
        initializing = pool.query(`CREATE TABLE IF NOT EXISTS yampi_billing_contracts(id text PRIMARY KEY,app_code text NOT NULL,store_id text NOT NULL,external_reference text UNIQUE NOT NULL,preapproval_id text UNIQUE,payer_email text NOT NULL,status text NOT NULL DEFAULT 'intent',provider_modified_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());ALTER TABLE yampi_billing_contracts ADD COLUMN IF NOT EXISTS preference_id text;CREATE UNIQUE INDEX IF NOT EXISTS yampi_preference_unique ON yampi_billing_contracts(preference_id) WHERE preference_id IS NOT NULL;CREATE UNIQUE INDEX IF NOT EXISTS yampi_one_active_billing_contract ON yampi_billing_contracts(app_code,store_id) WHERE status IN ${ACTIVE};CREATE TABLE IF NOT EXISTS yampi_billing_receipts(payment_id text PRIMARY KEY,contract_id text NOT NULL REFERENCES yampi_billing_contracts(id),authorized_payment_id text,amount_cents integer NOT NULL CHECK(amount_cents>0),currency text NOT NULL CHECK(currency='BRL'),period_start timestamptz NOT NULL,period_end timestamptz NOT NULL CHECK(period_end>period_start),status text NOT NULL CHECK(status IN('paid','refunded','charged_back')),created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());`).catch(e => { initializing = null; throw e; }); await initializing; }
    async function transaction(work) { await init(); const db = await pool.connect(); try {
        await db.query('BEGIN');
        const value = await work(db);
        await db.query('COMMIT');
        return value;
    }
    catch (e) {
        await db.query('ROLLBACK').catch(() => { });
        throw e;
    }
    finally {
        db.release();
    } }
    async function reserveIntent({ storeId, payerEmail, kind = 'subscription' }) { if (!/^yampi:[a-z0-9][a-z0-9_-]{0,99}$/.test(storeId) || typeof payerEmail !== 'string' || payerEmail.length > 254 || (!(kind === 'checkout' && payerEmail === '') && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail)))
        throw failure('invalid_checkout_identity', 400); return transaction(async (db) => { await lockCheckout(db,storeId); const id = crypto.randomUUID(), reference = `elunalab:${appCode}:${kind === 'checkout' ? 'checkout:' : 'monthly:'}${id}`; const r = await db.query('INSERT INTO yampi_billing_contracts(id,app_code,store_id,external_reference,payer_email) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *', [id, appCode, storeId, reference, payerEmail]); if (r.rows[0])
        return { created: true, contract: r.rows[0] }; const row = (await db.query(`SELECT * FROM yampi_billing_contracts WHERE app_code=$1 AND store_id=$2 AND status IN ${ACTIVE} FOR UPDATE`, [appCode, storeId])).rows[0]; if (!row)
        throw failure('checkout_conflict'); return { created: false, contract: row }; }); }
    async function findContract(reference) { await init(); return (await pool.query('SELECT * FROM yampi_billing_contracts WHERE app_code=$1 AND external_reference=$2', [appCode, reference])).rows[0] || null; }
    async function findStoreContract(storeId) { assertYampiStoreId(storeId); await init(); return (await pool.query(`SELECT * FROM yampi_billing_contracts WHERE app_code=$1 AND store_id=$2 ORDER BY CASE WHEN status IN ${ACTIVE} THEN 0 ELSE 1 END,created_at DESC LIMIT 1`, [appCode, storeId])).rows[0] || null; }
    async function recordPreapproval(reference, p) { return transaction(async (db) => { const c = (await db.query('SELECT * FROM yampi_billing_contracts WHERE app_code=$1 AND external_reference=$2 FOR UPDATE', [appCode, reference])).rows[0]; if (!c || !isYampiStoreId(c.store_id) || p.external_reference !== reference || (c.preapproval_id && c.preapproval_id !== String(p.id)))
        throw failure('contract_mismatch', 409); const old = Date.parse(c.provider_modified_at || ''), at = Date.parse(p.last_modified || p.date_created || ''); const stale = Number.isFinite(old) && (!Number.isFinite(at) || at < old); const status = c.status === 'cancelled' || stale ? c.status : p.status; if (!['pending', 'authorized', 'paused', 'cancelled'].includes(status) && !stale)
        throw failure('invalid_contract_status'); const result = await db.query('UPDATE yampi_billing_contracts SET preapproval_id=$3,status=$4,provider_modified_at=$5,updated_at=now() WHERE id=$1 AND app_code=$2 RETURNING *', [c.id, appCode, String(p.id), status, stale ? c.provider_modified_at : Number.isFinite(at) ? new Date(at).toISOString() : null]); return result.rows[0]; }); }
    async function recordCheckoutFailure(reference, rejected = false) {
        await init();
        await pool.query("UPDATE yampi_billing_contracts SET status=$3,updated_at=now() WHERE app_code=$1 AND external_reference=$2 AND preapproval_id IS NULL AND status='intent'", [appCode, reference, rejected ? 'rejected' : 'uncertain']);
    }
    async function recordPreference(reference, preference) {
        if (!reference.startsWith('elunalab:' + appCode + ':checkout:') || preference.external_reference !== reference) throw failure('hosted_contract_mismatch',409);
        await init(); const r=await pool.query(`UPDATE yampi_billing_contracts SET preference_id=$3,status=CASE WHEN status IN ${ACTIVE} THEN 'pending' ELSE status END,updated_at=now() WHERE app_code=$1 AND external_reference=$2 AND preapproval_id IS NULL AND (preference_id IS NULL OR preference_id=$3) RETURNING *`,[appCode,reference,String(preference.id)]);
        if(!r.rows[0])throw failure('hosted_contract_mismatch',409);return r.rows[0];
    }
    async function applyPayment(p) { const status = p.status === 'approved' ? 'paid' : p.status; if (!['paid', 'refunded', 'charged_back'].includes(status) || !p.paymentId || !Number.isSafeInteger(p.amountCents) || p.amountCents !== priceCents || p.currency !== 'BRL' || !Number.isFinite(Date.parse(p.dateApproved)) || Date.parse(p.dateApproved) > now() || !(Date.parse(p.periodEnd) > Date.parse(p.dateApproved)))
        throw failure('invalid_receipt', 400); const result = await transaction(async (db) => { const contract = (await db.query('SELECT * FROM yampi_billing_contracts WHERE app_code=$1 AND external_reference=$2 FOR UPDATE', [appCode, p.externalReference])).rows[0]; if (!contract || !isYampiStoreId(contract.store_id) || (p.kind === 'hosted'
            ? !contract.external_reference.startsWith('elunalab:' + appCode + ':checkout:') || contract.preference_id !== String(p.preferenceId)
            : !contract.preapproval_id || String(contract.preapproval_id) !== String(p.preapprovalId)))
        throw failure('payment_contract_mismatch', 409); await lockStore(db, contract.store_id); await db.query('INSERT INTO yampi_billing_receipts(payment_id,contract_id,authorized_payment_id,amount_cents,currency,period_start,period_end,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING', [String(p.paymentId), contract.id, p.authorizedPaymentId || null, p.amountCents, p.currency, p.dateApproved, p.periodEnd, status]); const existing = (await db.query('SELECT * FROM yampi_billing_receipts WHERE payment_id=$1 FOR UPDATE', [String(p.paymentId)])).rows[0]; if (existing.contract_id !== contract.id || existing.amount_cents !== p.amountCents || existing.currency !== p.currency)
        throw failure('receipt_identity_mismatch', 409); if (status !== 'paid')
        await db.query("UPDATE yampi_billing_receipts SET status=$2,updated_at=now() WHERE payment_id=$1 AND status='paid'", [String(p.paymentId), status]); const valid = (await db.query("SELECT r.* FROM yampi_billing_receipts r JOIN yampi_billing_contracts c ON c.id=r.contract_id WHERE c.app_code=$1 AND c.store_id=$2 AND r.status='paid' ORDER BY r.period_end DESC LIMIT 1", [appCode, contract.store_id])).rows[0]; const payment = { provider: 'mercadopago', reference: valid?.payment_id || String(p.paymentId), status: valid ? 'paid' : status === 'paid' ? 'pending' : status, paidUntil: valid ? new Date(valid.period_end).toISOString() : null, verifiedAt: new Date(now()).toISOString() }; await projectEntitlement(db, contract.store_id, payment); if (p.kind === 'hosted') {
            // Keep the shared checkout reservation for an already paid month.
            const stillPaid = status === 'paid' && existing.status === 'paid' && Date.parse(existing.period_end) > now();
            await db.query("UPDATE yampi_billing_contracts SET status=$2,updated_at=now() WHERE id=$1", [contract.id, stillPaid && contract.status === 'pending' ? 'pending' : 'checkout_settled']);
        } return { storeId: contract.store_id, payment }; }); return result; }
    async function findPreapproval(id) {
        await init();
        return (await pool.query('SELECT * FROM yampi_billing_contracts WHERE app_code=$1 AND preapproval_id=$2',[appCode,id])).rows[0] || null;
    }
    async function listContracts() {
        await init();
        return (await pool.query(`SELECT * FROM yampi_billing_contracts WHERE app_code=$1
          AND status<>'rejected' AND (status IN ${ACTIVE} OR created_at>now()-interval '90 days')
          ORDER BY created_at`, [appCode])).rows;
    }
    return { init, reserveIntent, findContract, findStoreContract, recordPreapproval, recordCheckoutFailure, recordPreference, applyPayment, findPreapproval, listContracts };
}
module.exports = { createYampiSubscriptionRepository };
