import test from 'node:test';
import assert from 'node:assert/strict';
import { createOneTimeProvider } from '../services/yampiPaymentProvider.js';
const preference = { id: '123-pref', collector_id: 123, client_id: '456', external_reference: 'ref', items: [{ id: 'IE-YAMPI', currency_id: 'BRL', quantity: 1, unit_price: 79.9 }], init_point: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123-pref' };
function fixture(overrides = {}) {
    const calls = [];
    const data = { '/checkout/preferences': preference, '/checkout/preferences/123-pref': preference, '/v1/payments/7': { id: 7, collector_id: 123, external_reference: 'ref', status: 'approved', currency_id: 'BRL', transaction_amount: 79.9, date_approved: '2026-10-25T12:00:00Z', order: { id: 8, type: 'mercadopago' } }, '/merchant_orders/8': { id: 8, preference_id: '123-pref', collector: { id: 123 }, external_reference: 'ref' } };
    const api = createOneTimeProvider({ enabled: true, accessToken: 'TEST-example', webhookSecret: 'test-secret', collectorId: '123', applicationId: '456', baseUrl: 'https://image.example', now: () => Date.parse('2026-10-26T12:00:00Z'), fetchImpl: async (url, options) => { calls.push({ url, options }); return new Response(JSON.stringify(overrides[new URL(url).pathname] || data[new URL(url).pathname])); } });
    return { api, calls };
}
test('Imagem creates one item for BRL79.90 and never a recurring preapproval', async () => {
    const { api, calls } = fixture();
    assert.equal((await api.createPreference('ref')).id, '123-pref');
    const body = JSON.parse(calls[0].options.body);
    assert.equal(body.items[0].unit_price, 79.9);
    assert.equal(body.items[0].quantity, 1);
    assert.equal(body.auto_recurring, undefined);
    assert.equal(body.external_reference, 'ref');
    assert.equal(calls[0].options.headers['X-Idempotency-Key'], 'ref');
});
test('single purchase requires exact preference, merchant order, collector, amount and reference', async () => {
    const paid = await fixture().api.getPayment('7', preference);
    assert.equal(paid.status, 'approved');
    for (const patch of [{ collector_id: 987 }, { client_id: '999' }, { external_reference: 'other' }, { init_point: 'https://evil.example/checkout/v1/redirect?pref_id=123-pref' }, { items: [{ currency_id: 'BRL', quantity: 1, unit_price: 1 }] }])
        await assert.rejects(fixture({ '/checkout/preferences/123-pref': { ...preference, ...patch } }).api.getPreference('123-pref', 'ref'));
    await assert.rejects(fixture({ '/merchant_orders/8': { id: 8, preference_id: 'foreign', collector: { id: 123 }, external_reference: 'ref' } }).api.getPayment('7', preference));
});
test('disabled one-time provider cannot create a checkout or call the API', async () => {
    let calls = 0;
    const api = createOneTimeProvider({ fetchImpl: async () => calls++ });
    await assert.rejects(api.createPreference('ref'));
    assert.equal(calls, 0);
});
