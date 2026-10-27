import crypto from 'node:crypto';
const error = (code, status = 503) => Object.assign(Error(code), { status });
const amount = value => /^\d+(\.\d{1,2})?$/.test(String(value ?? '')) ? Math.round(Number(value) * 100) : null;
export function createOneTimeProvider({ enabled = false, accessToken, webhookSecret, collectorId, applicationId, baseUrl, fetchImpl = fetch, now = Date.now } = {}) {
    const isConfigured = () => enabled === true && !!accessToken && !!webhookSecret && /^\d+$/.test(String(collectorId || '')) && /^\d+$/.test(String(applicationId || '')) && /^https:\/\//.test(baseUrl || '');
    async function request(method, path, body, key) {
        if (!isConfigured())
            throw error('payment_not_configured');
        let response;
        try {
            response = await fetchImpl('https://api.mercadopago.com' + path, { method, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(key ? { 'X-Idempotency-Key': key } : {}) }, redirect: 'error', signal: AbortSignal.timeout(15000), ...(body ? { body: JSON.stringify(body) } : {}) });
        }
        catch {
            throw error('payment_temporarily_unavailable');
        }
        if (!response.ok || response.redirected)
            throw error('payment_temporarily_unavailable');
        try {
            return await response.json();
        }
        catch {
            throw error('invalid_payment_response');
        }
    }
    function checkoutUrl(preference) {
        let url;
        try {
            url = new URL(preference.init_point);
        }
        catch {
            throw error('invalid_checkout');
        }
        if (url.protocol !== 'https:' || url.hostname !== 'www.mercadopago.com.br' || url.port || url.username || url.password || !['/checkout/v1/redirect', '/mlb/checkout/start'].includes(url.pathname) || url.searchParams.get('pref_id') !== String(preference.id))
            throw error('invalid_checkout');
        return url.href;
    }
    function validatePreference(p, reference) {
        const item = p.items?.[0];
        if (!/^[a-zA-Z0-9-]{1,160}$/.test(String(p.id || '')) || String(p.collector_id) !== String(collectorId) || String(p.client_id) !== String(applicationId) || p.external_reference !== reference || p.items?.length !== 1 || item.id !== 'IE-YAMPI' || item.quantity !== 1 || item.currency_id !== 'BRL' || amount(item.unit_price) !== 7990)
            throw error('payment_preference_mismatch');
        checkoutUrl(p);
        return p;
    }
    async function getPreference(id, reference) {
        if (!/^[a-zA-Z0-9-]{1,160}$/.test(String(id)))
            throw error('invalid_preference_id', 400);
        const p = validatePreference(await request('GET', '/checkout/preferences/' + encodeURIComponent(id)), reference);
        if (String(p.id) !== String(id))
            throw error('payment_preference_mismatch');
        return p;
    }
    async function createPreference(reference) {
        if (!isConfigured())
            throw error('payment_not_configured');
        const back = new URL('/?platform=yampi', baseUrl).href;
        return validatePreference(await request('POST', '/checkout/preferences', { external_reference: reference, items: [{ id: 'IE-YAMPI', title: 'Imagem em Lote — acesso por loja, pagamento único', quantity: 1, currency_id: 'BRL', unit_price: 79.9 }], back_urls: { success: back, pending: back, failure: back }, notification_url: new URL('/yampi/billing/webhook', baseUrl).href, auto_return: 'approved' }, reference), reference);
    }
    async function findPreference(reference) {
        const page = await request('GET', '/checkout/preferences/search?external_reference=' + encodeURIComponent(reference));
        if (!Array.isArray(page.elements))
            throw error('invalid_preference_search');
        const rows = page.elements.filter(p => p.external_reference === reference);
        if (rows.length > 1)
            throw error('multiple_payment_preferences', 409);
        return rows.length ? getPreference(rows[0].id, reference) : null;
    }
    async function getPayment(id, preference) {
        if (!/^\d{1,30}$/.test(String(id)))
            throw error('invalid_payment_id', 400);
        const p = await request('GET', '/v1/payments/' + id);
        if (String(p.id) !== String(id) || String(p.collector_id) !== String(collectorId) || (p.application_id != null && String(p.application_id) !== String(applicationId)) || p.external_reference !== preference.external_reference || p.currency_id !== 'BRL' || amount(p.transaction_amount) !== 7990 || !/^\d+$/.test(String(p.order?.id || '')))
            throw error('payment_identity_mismatch');
        const order = await request('GET', '/merchant_orders/' + p.order.id);
        if (String(order.id) !== String(p.order.id) || String(order.preference_id) !== String(preference.id) || String(order.collector?.id) !== String(collectorId) || order.external_reference !== preference.external_reference)
            throw error('payment_order_mismatch');
        if (['approved', 'refunded', 'charged_back'].includes(p.status) && (!Number.isFinite(Date.parse(p.date_approved || '')) || Date.parse(p.date_approved) > now()))
            throw error('invalid_payment_date');
        return { ...p, status: Number(p.transaction_amount_refunded) > 0 ? 'refunded' : p.status };
    }
    async function paymentReference(id) {
        if (!/^\d{1,30}$/.test(String(id)))
            throw error('invalid_payment_id', 400);
        const p = await request('GET', '/v1/payments/' + id);
        if (String(p.id) !== String(id) || String(p.collector_id) !== String(collectorId) || typeof p.external_reference !== 'string')
            throw error('payment_identity_mismatch');
        return p.external_reference;
    }
    async function listPayments(reference) {
        const results = [];
        let offset = 0;
        for (let page = 0; page < 10; page++) {
            const data = await request('GET', '/v1/payments/search?external_reference=' + encodeURIComponent(reference) + '&limit=100&offset=' + offset);
            if (!Array.isArray(data.results))
                throw error('invalid_payment_search');
            for (const p of data.results) {
                if (p.external_reference !== reference)
                    throw error('payment_identity_mismatch');
                results.push(p.id);
            }
            offset += data.results.length;
            if (data.results.length < 100 || offset >= Number(data.paging?.total))
                return results;
        }
        throw error('payment_search_limit');
    }
    function verifyWebhookSignature({ queryId, xRequestId, xSignature }) {
        if (!isConfigured() || typeof queryId !== 'string' || !/^\d{1,30}$/.test(queryId) || typeof xRequestId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(xRequestId) || typeof xSignature !== 'string')
            return false;
        const f = Object.fromEntries(xSignature.split(',').map(s => s.trim().split('=')));
        if (!/^\d{10,13}$/.test(f.ts || '') || !/^[a-f0-9]{64}$/.test(f.v1 || ''))
            return false;
        const ts = Number(f.ts) * (f.ts.length === 10 ? 1000 : 1);
        if (Math.abs(now() - ts) > 300000)
            return false;
        const expected = crypto.createHmac('sha256', webhookSecret).update(`id:${queryId};request-id:${xRequestId};ts:${f.ts};`).digest();
        return crypto.timingSafeEqual(expected, Buffer.from(f.v1, 'hex'));
    }
    return { isConfigured, checkoutUrl, createPreference, getPreference, findPreference, getPayment, paymentReference, listPayments, verifyWebhookSignature };
}
