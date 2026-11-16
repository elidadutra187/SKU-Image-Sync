'use strict';
const crypto = require('node:crypto');
const bad = (code, status = 502) => Object.assign(Error(code), { status });
const cents = value => { const s = String(value ?? ''); if (!/^\d+(\.\d{1,2})?$/.test(s))
    return null; const n = Math.round(Number(s) * 100); return Number.isSafeInteger(n) && n > 0 ? n : null; };
function monthEnd(value) { const d = new Date(value), day = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(day, last)); return d.toISOString(); }
function createMercadoPagoClient({ accessToken, webhookSecret, collectorId, applicationId, appCode = 'IE', priceCents = 3990, baseUrl, enabled = false, fetchImpl = fetch, now = Date.now }) {
    const configured = () => enabled === true && !!accessToken && !!webhookSecret && /^\d+$/.test(String(collectorId || '')) && /^\d+$/.test(String(applicationId || '')) && Number.isSafeInteger(priceCents) && priceCents > 0 && /^[A-Z]{2,12}$/.test(appCode) && /^https:\/\//.test(baseUrl || '');
    const requireConfig = () => { if (!configured())
        throw bad('provider_not_configured', 503); };
    async function request(method, path, body, idempotencyKey) { requireConfig(); const headers = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }; if (idempotencyKey)
        headers['X-Idempotency-Key'] = idempotencyKey; let response; try {
        response = await fetchImpl('https://api.mercadopago.com' + path, { method, headers, redirect: 'error', signal: AbortSignal.timeout(15000), ...(body ? { body: JSON.stringify(body) } : {}) });
    }
    catch {
        throw bad('mercadopago_unavailable', 503);
    }
    if (!response.redirected && method === 'POST' && ['/preapproval', '/checkout/preferences'].includes(path) && response.status === 400) {
        const rejection = await response.json().catch(() => null);
        if (rejection?.status === 400 && !rejection.id)
            throw Object.assign(bad('checkout_rejected', 422), { checkoutRejected: true });
    }
    if (!response.ok || response.redirected) throw bad('mercadopago_unavailable', 503);
    try {
        return await response.json();
    }
    catch {
        throw bad('invalid_provider_response');
    } }
    function account(raw) { if (String(raw?.collector_id) !== String(collectorId) || String(raw?.application_id) !== String(applicationId))
        throw bad('provider_account_mismatch'); }
    function validatePreapproval(raw, reference) { account(raw); if (!/^[a-zA-Z0-9]{1,128}$/.test(String(raw.id || '')) || raw.external_reference !== reference || !['pending', 'authorized', 'paused', 'cancelled'].includes(raw.status))
        throw bad('subscription_mismatch'); const a = raw.auto_recurring; if (a?.frequency !== 1 || a?.frequency_type !== 'months' || a?.currency_id !== 'BRL' || cents(a?.transaction_amount) !== priceCents)
        throw bad('subscription_policy_mismatch'); return raw; }
    function checkoutUrl(raw) { let u; try {
        u = new URL(raw.init_point);
    }
    catch {
        throw bad('invalid_checkout');
    } if (u.protocol !== 'https:' || u.hostname !== 'www.mercadopago.com.br' || u.port || u.username || u.password || u.pathname !== '/subscriptions/checkout' || u.searchParams.get('preapproval_id') !== String(raw.id))
        throw bad('invalid_checkout'); return u.href; }
    async function getPreapproval(id, reference) { if (!/^[a-zA-Z0-9]{1,128}$/.test(String(id)))
        throw bad('invalid_provider_id', 400); const p = await request('GET', '/preapproval/' + encodeURIComponent(id)); if (String(p.id) !== String(id))
        throw bad('subscription_mismatch'); return validatePreapproval(p, reference); }
    async function createPreapproval({ payerEmail, externalReference, trialEndsAt }) { requireConfig(); const back = new URL('/?platform=yampi#access', baseUrl).href; const auto = { frequency: 1, frequency_type: 'months', transaction_amount: priceCents / 100, currency_id: 'BRL' }; const trial = Date.parse(trialEndsAt || ''); if (Number.isFinite(trial) && trial > now())
        auto.start_date = new Date(trial).toISOString(); const p = await request('POST', '/preapproval', { payer_email: payerEmail, reason: 'Imagem em Lote — assinatura mensal Yampi', external_reference: externalReference, auto_recurring: auto, back_url: back, status: 'pending' }, externalReference); validatePreapproval(p, externalReference); return { ...p, init_point: checkoutUrl(p) }; }
    async function reconcilePreapproval(reference) { const data = await request('GET', '/preapproval/search?external_reference=' + encodeURIComponent(reference)); if (!Array.isArray(data.results))
        throw bad('invalid_provider_response'); const list = data.results.filter(p => p.external_reference === reference); if (list.length > 1)
        throw bad('multiple_provider_contracts', 409); if (!list.length)
        return null; const p = await getPreapproval(list[0].id, reference); return { ...p, init_point: p.status === 'pending' ? checkoutUrl(p) : null }; }
    async function getPayment(id, {ignoreUnrelated=false}={}) { if (!/^\d{1,30}$/.test(String(id)))
        throw bad('invalid_payment_id', 400); const p = await request('GET', '/v1/payments/' + id); if (String(p.collector_id) !== String(collectorId) || (p.application_id != null && String(p.application_id) !== String(applicationId)))
        throw bad('provider_account_mismatch');
        if (String(p.id) !== String(id)) throw bad('payment_mismatch');
        const monthlyReference = new RegExp('^elunalab:' + appCode + ':(?:monthly|checkout):[a-f0-9-]{36}$');
        if (ignoreUnrelated && !monthlyReference.test(p.external_reference || '')) return null;
        if (p.currency_id !== 'BRL' || cents(p.transaction_amount) !== priceCents || typeof p.external_reference !== 'string')
        throw bad('payment_mismatch'); return { ...p, status: Number(p.transaction_amount_refunded) > 0 ? 'refunded' : p.status }; }
    function pixTicket(payment) {
        let url;
        try { url = new URL(payment.point_of_interaction?.transaction_data?.ticket_url); }
        catch { throw bad('invalid_pix_ticket'); }
        if (url.origin !== 'https://www.mercadopago.com.br' || url.username || url.password ||
            url.pathname !== '/payments/' + payment.id + '/ticket') throw bad('invalid_pix_ticket');
        return url.href;
    }
    async function getAuthorizedPayment(id) { if (!/^\d{1,30}$/.test(String(id)))
        throw bad('invalid_invoice_id', 400); const a = await request('GET', '/authorized_payments/' + id); if (String(a.id) !== String(id))
        throw bad('invoice_mismatch'); if(!a.payment?.id) { const contract=await getPreapproval(a.preapproval_id,a.external_reference); if(a.currency_id!=='BRL'||cents(a.transaction_amount)!==priceCents) throw bad('invoice_mismatch'); return {status:'pending',externalReference:contract.external_reference,preapprovalId:String(contract.id)}; } const p = await getPayment(a.payment.id), contract = await getPreapproval(a.preapproval_id, p.external_reference); if (a.external_reference !== contract.external_reference || a.currency_id !== 'BRL' || cents(a.transaction_amount) !== priceCents)
        throw bad('invoice_mismatch'); if (p.status !== 'approved' || a.payment.status !== 'approved')
        return { status: p.status === 'approved' ? 'pending' : p.status, paymentId: String(p.id), externalReference: contract.external_reference, preapprovalId: String(contract.id) }; const date = Date.parse(p.date_approved || ''); if (!Number.isFinite(date) || date > now())
        throw bad('invalid_payment_date'); return { status: 'approved', paymentId: String(p.id), authorizedPaymentId: String(a.id), externalReference: contract.external_reference, preapprovalId: String(contract.id), amountCents: priceCents, currency: 'BRL', dateApproved: new Date(date).toISOString(), periodEnd: monthEnd(date) }; }
    async function listInvoices(id) { let results = [], offset = 0; const seen = new Set(); for (let page = 0; page < 100; page++) {
        // Live API rejects explicit limit values; keep its default page size.
        const data = await request('GET', '/authorized_payments/search?preapproval_id=' + encodeURIComponent(id) + '&offset=' + offset);
        if (!Array.isArray(data.results))
            throw bad('invalid_invoice_search');
        for (const row of data.results) {
            if (String(row.preapproval_id) !== String(id) || !/^\d{1,30}$/.test(String(row.id)) || seen.has(String(row.id)))
                throw bad('invoice_search_mismatch');
            seen.add(String(row.id));
            results.push(row);
        }
        offset += data.results.length;
        const total = data.paging?.total == null ? NaN : Number(data.paging.total);
        if (Number.isFinite(total) && offset >= total)
            return results;
        if (data.results.length === 0 && (!Number.isFinite(total) || offset >= total))
            return results;
        if (data.results.length === 0) throw bad('incomplete_invoice_search', 503);
    } throw bad('invoice_search_limit', 503); }
    function verifyWebhookSignature({ queryId, xRequestId, xSignature }) { if (!configured() || typeof queryId !== 'string' || !/^[a-zA-Z0-9]{1,128}$/.test(queryId) || typeof xRequestId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(xRequestId) || typeof xSignature !== 'string')
        return false; const fields = Object.fromEntries(xSignature.split(',').map(s => s.trim().split('='))); if (!/^\d{10,13}$/.test(fields.ts || '') || !/^[a-f0-9]{64}$/.test(fields.v1 || ''))
        return false; const at = Number(fields.ts) * (fields.ts.length === 10 ? 1000 : 1); if (Math.abs(now() - at) > 300000)
        return false; const manifest = `id:${queryId.toLowerCase()};request-id:${xRequestId};ts:${fields.ts};`; const expected = crypto.createHmac('sha256', webhookSecret).update(manifest).digest(); return crypto.timingSafeEqual(expected, Buffer.from(fields.v1, 'hex')); }
    async function cancelPreapproval(id, reference) { const current = await getPreapproval(id, reference); if (current.status === 'cancelled')
        return current; await request('PUT', '/preapproval/' + id, { status: 'cancelled' }); return getPreapproval(id, reference); }
    const hosted = require('./hostedCheckoutProvider.cjs').createHostedCheckoutProvider({request,getPayment,getPreapproval,listInvoices,collectorId,applicationId,appCode,priceCents,baseUrl,now});
    return { ...hosted, isConfigured: configured, pixTicket, createPreapproval, getPreapproval, reconcilePreapproval, getPayment, getAuthorizedPayment, cancelPreapproval, listInvoices, verifyWebhookSignature, checkoutUrl };
}
module.exports = { createMercadoPagoClient, monthEnd, cents };
