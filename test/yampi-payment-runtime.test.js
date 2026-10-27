import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { buildYampiPaymentRuntime } from '../services/yampiPaymentRuntime.js';
test('disabled Yampi payment makes no database or provider calls, even on reconciliation', async () => {
    let reads = 0;
    const runtime = buildYampiPaymentRuntime({ env: { APP_URL: 'https://image.example' }, poolProvider: async () => { reads++; throw Error('unexpected'); } });
    assert.equal(runtime.available('yampi:one'), false);
    runtime.start();
    await runtime.reconcileAll();
    await assert.rejects(runtime.checkout('yampi:one'));
    runtime.stop();
    assert.equal(reads, 0);
});
test('Yampi payment routes reject Nuvemshop sessions, foreign origins and disconnected stores before checkout', async () => {
    let providerCalls = 0, reads = 0;
    const runtime = buildYampiPaymentRuntime({ env: { APP_URL: 'https://image.example', YAMPI_MP_TEST_STORE_IDS: 'yampi:one' }, sessionReader: req => req.headers['test-store'], provider: { isConfigured: () => true, createPreference: async () => providerCalls++ }, poolProvider: async () => ({ query: async () => { reads++; return { rows: [] }; } }) });
    const app = express();
    app.use(express.json());
    app.use(runtime.router);
    app.use((e, req, res, next) => res.status(e.status || 500).json({ error: e.message }));
    const server = app.listen(0, '127.0.0.1');
    await new Promise(r => server.once('listening', r));
    try {
        const url = 'http://127.0.0.1:' + server.address().port + '/checkout';
        for (const [store, origin, status] of [['123', 'https://image.example', 401], ['yampi:one', 'https://evil.example', 403], ['yampi:one', 'https://image.example', 401]])
            assert.equal((await fetch(url, { method: 'POST', headers: { Origin: origin, 'test-store': store, 'Content-Type': 'application/json' }, body: '{}' })).status, status);
        assert.equal(providerCalls, 0);
        assert.equal(reads, 1);
    }
    finally {
        server.closeAllConnections();
        await new Promise(r => server.close(r));
    }
});
