const {test, describe} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
test('failed access verification is shown without claiming payment is overdue',()=>{const dom=new JSDOM('<html><body></body></html>',{url:'https://app.example',runScripts:'outside-only'}),w=dom.window;let current;w.ElunaBillingNotice={update:value=>{current=value}};w.eval(fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'),'utf8'));w.BillingNoticeAdapter.update({connected:true,storeId:'42',verificationFailed:true,access:{}});assert.equal(current.allowed,false);assert.equal(current.status,'unverified');w.close();});

/**
 * Billing Notice Adapter tests — Imagem em Lote
 *
 * Tests verify:
 * - Adapter calls window.ElunaBillingNotice.update with correct contract
 * - Demo batch logic: blocking when demo exhausted and not paid
 * - Platform payment required state
 * - Retry event refreshes access
 */

describe('Imagem billing-notice-adapter', () => {
  test('adapter shows allowed when demo batches remaining', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    let updateData = null;
    w.ElunaBillingNotice = {
      update: (data) => { updateData = data; }
    };

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.BillingNoticeAdapter.update({
      connected: true,
      storeId: 'img-store',
      platform: 'nuvemshop',
      paymentRequired: false,
      access: {
        paid: false,
        demoUsed: false,
        demoBatches: 1,
        demoBatchesRemaining: 1,
        demoImages: 10
      }
    });

    assert.equal(updateData.allowed, true, 'should be allowed when demo available');
    assert.equal(updateData.status, 'demo_available');
    assert.equal(updateData.state, 'demo');

    w.close();
  });

  test('adapter shows blocked when demo exhausted and purchaseConfigured', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    let updateData = null;
    w.ElunaBillingNotice = {
      update: (data) => { updateData = data; }
    };

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.BillingNoticeAdapter.update({
      connected: true,
      storeId: 'img-store',
      platform: 'nuvemshop',
      paymentRequired: false,
      access: {
        paid: false,
        demoUsed: true,
        demoBatches: 1,
        demoBatchesRemaining: 0,
        purchaseConfigured: true
      }
    });

    assert.equal(updateData.allowed, false, 'should be blocked when demo exhausted');
    // When purchaseConfigured=true, status is payment_required (component recognizes this)
    assert.equal(updateData.status, 'payment_required');
    assert.equal(updateData.state, 'needs_payment');

    w.close();
  });

  test('adapter shows unverified when demo exhausted but purchaseConfigured=false', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    let updateData = null;
    w.ElunaBillingNotice = {
      update: (data) => { updateData = data; }
    };

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.BillingNoticeAdapter.update({
      connected: true,
      storeId: 'img-store',
      platform: 'nuvemshop',
      paymentRequired: false,
      access: {
        paid: false,
        demoUsed: true,
        demoBatches: 1,
        demoBatchesRemaining: 0,
        purchaseConfigured: false
      }
    });

    assert.equal(updateData.allowed, false);
    // When purchaseConfigured=false, status is unverified (can't charge yet)
    assert.equal(updateData.status, 'unverified');
    assert.equal(updateData.state, 'needs_payment');

    w.close();
  });

  test('adapter shows blocked when platform paymentRequired', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    let updateData = null;
    w.ElunaBillingNotice = {
      update: (data) => { updateData = data; }
    };

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.BillingNoticeAdapter.update({
      connected: true,
      storeId: 'img-store',
      platform: 'nuvemshop',
      paymentRequired: true, // Platform blocked API access
      access: {
        paid: false,
        demoUsed: false,
        demoBatchesRemaining: 1
      }
    });

    assert.equal(updateData.allowed, false, 'should be blocked when platform requires payment');
    assert.equal(updateData.status, 'payment_required');
    assert.equal(updateData.state, 'platform_blocked');

    w.close();
  });

  test('adapter shows allowed when paid', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    let updateData = null;
    w.ElunaBillingNotice = {
      update: (data) => { updateData = data; }
    };

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.BillingNoticeAdapter.update({
      connected: true,
      storeId: 'img-store',
      platform: 'nuvemshop',
      paymentRequired: false,
      access: {
        paid: true,
        demoUsed: true
      }
    });

    assert.equal(updateData.allowed, true, 'should be allowed when paid');
    assert.equal(updateData.status, 'paid');
    assert.equal(updateData.state, 'active');

    w.close();
  });

  test('adapter handles yampi pending payment provider', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    let updateData = null;
    w.ElunaBillingNotice = {
      update: (data) => { updateData = data; }
    };

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.BillingNoticeAdapter.update({
      connected: true,
      storeId: 'yampi-img',
      platform: 'yampi',
      paymentRequired: false,
      access: {
        paid: false,
        demoUsed: true,
        paymentProvider: 'pending'
      }
    });

    assert.equal(updateData.allowed, false);
    assert.equal(updateData.state, 'pending');
    assert.equal(updateData.platform, 'yampi');

    w.close();
  });

  test('adapter dispatches eluna:billing event', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    w.ElunaBillingNotice = { update: () => {} };

    let eventDetail = null;
    w.addEventListener('eluna:billing', (e) => {
      eventDetail = e.detail;
    });

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.BillingNoticeAdapter.update({
      connected: true,
      storeId: 'event-test',
      platform: 'nuvemshop',
      paymentRequired: false,
      access: { paid: true, demoUsed: true }
    });

    assert.ok(eventDetail, 'event should be dispatched');
    assert.equal(eventDetail.allowed, true);

    w.close();
  });

  test('adapter retry event refreshes access state', async () => {
    const dom = new JSDOM(`<!doctype html><html><body></body></html>`, {
      url: 'https://app.example/',
      runScripts: 'outside-only'
    });
    const w = dom.window;

    w.ElunaBillingNotice = { update: () => {} };

    let fetchCalls = [];
    w.fetch = async (url) => {
      fetchCalls.push(url);
      if (url.includes('/sync/access')) {
        return { ok: true, json: async () => ({ paid: true, demoUsed: true }) };
      }
      if (url.includes('/auth/status')) {
        return { ok: true, json: async () => ({ connected: true, storeId: 'retry-test', platform: 'nuvemshop' }) };
      }
      return { ok: false };
    };

    const adapterSource = fs.readFileSync(require.resolve('../public/billing-notice-adapter.js'), 'utf8');
    w.eval(adapterSource);

    w.dispatchEvent(new w.CustomEvent('eluna:billing-retry'));
    await new Promise(r => setTimeout(r, 20));

    assert.ok(fetchCalls.some(u => u.includes('/sync/access')), 'should fetch access on retry');
    assert.ok(fetchCalls.some(u => u.includes('/auth/status')), 'should fetch auth status on retry');

    w.close();
  });
});
