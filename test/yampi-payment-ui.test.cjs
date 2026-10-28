/**
 * Tests for yampi-payment-ui.mjs (Imagem admin).
 * No jsdom needed - Imagem module is DOM-free.
 * @module yampi-payment-ui.test
 */
const test = require('node:test');
const assert = require('node:assert/strict');

/**
 * Creates context for testing with mutable request handler.
 * @param {boolean} authorized - Initial authorization state
 * @param {Object} opts - Options for request behavior
 * @returns {Object} - Test context
 */
function createTestContext(authorized = true, opts = {}) {
  let authState = authorized;
  let requestCalls = [];
  let navigatedTo = null;
  let messages = [];
  let busyState = false;
  let confirmResult = opts.confirmResult !== undefined ? opts.confirmResult : true;
  let requestHandler = opts.requestHandler || (async () => ({
    checkoutUrl: 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=abc'
  }));

  return {
    isAuthorized: () => authState,
    request: async (url, reqOpts) => {
      requestCalls.push({ url, opts: reqOpts });
      return requestHandler(url, reqOpts);
    },
    renderAccess: () => {},
    message: (msg, isError) => { messages.push({ msg, isError }); },
    busy: (state) => { busyState = state; },
    t: (text) => text,
    confirm: () => {
      if (typeof opts.onConfirm === 'function') opts.onConfirm();
      return confirmResult;
    },
    navigate: (url) => { navigatedTo = url; },

    // Test helpers
    setAuthState: (v) => { authState = v; },
    getNavigatedTo: () => navigatedTo,
    getRequestCalls: () => requestCalls,
    getMessages: () => messages,
    getBusyState: () => busyState,
    clearRequestCalls: () => { requestCalls = []; },
    clearMessages: () => { messages = []; },
    clearNavigated: () => { navigatedTo = null; }
  };
}

test('constructor throws when not authorized (before network)', async () => {
  const ctx = createTestContext(false);
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  assert.throws(
    () => createYampiPaymentUI(ctx),
    { message: 'yampi_payment_ui_unauthorized' }
  );

  assert.equal(ctx.getRequestCalls().length, 0);
});

test('session revoked between constructor and purchase - no request', async () => {
  const ctx = createTestContext(true);
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  ctx.setAuthState(false);
  ctx.clearRequestCalls();

  await ui.purchase();

  assert.equal(ctx.getRequestCalls().length, 0, 'no request after revocation');
  assert.equal(ctx.getNavigatedTo(), null, 'no navigation after revocation');
});

test('checkout validates URL - blocks invalid host', async () => {
  const ctx = createTestContext(true, {
    requestHandler: async () => ({ checkoutUrl: 'https://evil.com/steal' })
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);
  ctx.clearMessages();

  await ui.purchase();

  assert.equal(ctx.getNavigatedTo(), null, 'no navigation to invalid host');
  assert.ok(ctx.getMessages().some(m => m.isError), 'should show error');
});

test('checkout validates URL - blocks invalid path', async () => {
  const ctx = createTestContext(true, {
    requestHandler: async () => ({ checkoutUrl: 'https://www.mercadopago.com.br/malicious/path' })
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  await ui.purchase();

  assert.equal(ctx.getNavigatedTo(), null, 'no navigation to invalid path');
});

test('checkout validates URL - blocks non-HTTPS', async () => {
  const ctx = createTestContext(true, {
    requestHandler: async () => ({ checkoutUrl: 'http://www.mercadopago.com.br/checkout/v1/redirect' })
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  await ui.purchase();

  assert.equal(ctx.getNavigatedTo(), null, 'no navigation to HTTP');
});

test('checkout validates URL - blocks credentials', async () => {
  const ctx = createTestContext(true, {
    requestHandler: async () => ({ checkoutUrl: 'https://user:pass@www.mercadopago.com.br/checkout/v1/redirect' })
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  await ui.purchase();

  assert.equal(ctx.getNavigatedTo(), null, 'no navigation with credentials');
});

test('checkout validates URL - blocks port', async () => {
  const ctx = createTestContext(true, {
    requestHandler: async () => ({ checkoutUrl: 'https://www.mercadopago.com.br:8080/checkout/v1/redirect' })
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  await ui.purchase();

  assert.equal(ctx.getNavigatedTo(), null, 'no navigation with port');
});

test('checkout navigates to valid MP URL - checkout/v1/redirect', async () => {
  const validUrl = 'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123456';
  const ctx = createTestContext(true, {
    requestHandler: async () => ({ checkoutUrl: validUrl })
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  await ui.purchase();

  assert.equal(ctx.getNavigatedTo(), validUrl, 'navigates to valid URL');
});

test('checkout navigates to valid MP URL - mlb/checkout/start', async () => {
  const validUrl = 'https://www.mercadopago.com.br/mlb/checkout/start?pref_id=789';
  const ctx = createTestContext(true, {
    requestHandler: async () => ({ checkoutUrl: validUrl })
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  await ui.purchase();

  assert.equal(ctx.getNavigatedTo(), validUrl, 'navigates to valid URL');
});

test('paymentDescription returns one-time payment text without monthly fee', async () => {
  const ctx = createTestContext(true);
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);

  const desc = ui.paymentDescription();

  assert.ok(desc.includes('79,90'), 'price in description');
  assert.ok(desc.includes('sem mensalidade'), 'no monthly fee mentioned');
  assert.ok(desc.includes('Pagamento único'), 'one-time payment');
});

test('purchase respects confirm dialog rejection', async () => {
  const ctx = createTestContext(true, { confirmResult: false });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);
  ctx.clearRequestCalls();

  await ui.purchase();

  assert.equal(ctx.getRequestCalls().length, 0, 'no request when confirm rejected');
  assert.equal(ctx.getNavigatedTo(), null, 'no navigation when confirm rejected');
});

test('revocation after confirm but before request - no navigation', async () => {
  const ctx = createTestContext(true, {
    onConfirm: () => { ctx.setAuthState(false); }
  });
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  const ui = createYampiPaymentUI(ctx);
  ctx.clearRequestCalls();

  await ui.purchase();

  // Request may or may not be made depending on exact timing
  // Key assertion: no navigation
  assert.equal(ctx.getNavigatedTo(), null, 'no navigation after revocation');
});

test('Nuvemshop isolation - unauthorized context cannot create factory', async () => {
  const ctx = createTestContext(false);
  const { createYampiPaymentUI } = await import('../public/yampi-payment-ui.mjs');

  assert.throws(() => createYampiPaymentUI(ctx));
});
