import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommercialAccess} from '../services/commercialAccess.js';

test('new Yampi customers see the independent monthly Mercado Pago plan', async () => {
  const previous = process.env.NUVEMSHOP_MONTHLY_PRICE;
  process.env.NUVEMSHOP_MONTHLY_PRICE = '25.00';
  try {
    const access = createCommercialAccess({status: async () => ({demoBatchesUsed:1, paid:true})});
    const yampi = await access.status('yampi:shop');
    assert.equal(yampi.purchaseMode, 'mercadopago_monthly');
    assert.equal(yampi.monthlyPriceCents, 3990);
    assert.equal(yampi.paid, true);
    assert.equal((await access.status('123')).monthlyPriceCents, 2500);
  } finally {
    if (previous === undefined) delete process.env.NUVEMSHOP_MONTHLY_PRICE;
    else process.env.NUVEMSHOP_MONTHLY_PRICE = previous;
  }
});

import {PGlite} from '@electric-sql/pglite';
import {buildYampiMonthlyBilling,monthlyEntitlement} from '../services/yampi-monthly/adapter.js';

async function fixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE image_sync_yampi_stores(alias text PRIMARY KEY,billing_disconnect_until timestamptz);
    INSERT INTO image_sync_yampi_stores(alias) VALUES ('shop'),('legacy');
    CREATE TABLE image_sync_access(
      store_id text PRIMARY KEY, demo_batches_used integer, paid_at timestamptz,
      payment_reference text, yampi_paid_until timestamptz, courtesy_until timestamptz
    );
    INSERT INTO image_sync_access VALUES ('yampi:legacy',1,now(),'mercadopago:legacy',null,null);
  `);
  const pool = {
    query: (sql,params) => !params && sql.includes(';') ? db.exec(sql) : db.query(sql,params),
    connect: async () => ({query:db.query.bind(db),release(){}}),
  };
  const calls = [];
  const approvedAt = new Date(Date.now()-60_000).toISOString();
  let contract, preference, paymentStatus='pending';
  const env={
    APP_URL:'https://example.test',YAMPI_MP_MODE:'test',YAMPI_MP_ACCESS_TOKEN:'TEST-fake',
    YAMPI_MP_COLLECTOR_ID:'123',YAMPI_MP_APPLICATION_ID:'456',YAMPI_MP_WEBHOOK_SECRET:'secret',
    YAMPI_MP_TEST_STORE_IDS:'yampi:shop,yampi:legacy',YAMPI_MP_ENABLED:'true',YAMPI_MP_MONTHLY_ENABLED:'true',
  };
  const runtime = buildYampiMonthlyBilling({
    env,poolProvider:async()=>pool,
    fetchImpl:async (url,options) => {
      const path = new URL(url).pathname;
      const payload = options.body && JSON.parse(options.body);
      calls.push({path,method:options.method,payload});
      if (path==='/preapproval' && options.method==='POST') {
        contract={...payload,id:'card1',collector_id:123,application_id:456,
          init_point:'https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=card1'};
        return Response.json(contract);
      }
      if (path==='/preapproval/card1') {
        if (options.method==='PUT') contract={...contract,status:payload.status};
        return Response.json(contract);
      }
      if (path==='/authorized_payments/57') {
        return Response.json({id:57,preapproval_id:'card1',external_reference:contract.external_reference,
          currency_id:'BRL',transaction_amount:39.9,payment:{id:71,status:paymentStatus}});
      }
      if (path==='/v1/payments/71') {
        return Response.json({id:71,collector_id:123,application_id:456,external_reference:contract.external_reference,
          currency_id:'BRL',transaction_amount:39.9,date_approved:approvedAt,status:paymentStatus});
      }
      if (path==='/checkout/preferences' && options.method==='POST') {
        preference={...payload,id:'123-pref',collector_id:123,client_id:456,
          init_point:'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=123-pref'};
        return Response.json(preference);
      }
      if (path==='/checkout/preferences/123-pref') return Response.json(preference);
      throw Error('Unexpected provider request: '+path);
    },
  });
  return {db,env,calls,runtime,changePayment:status=>{paymentStatus=status;}};
}

test('card checkout charges 39.90 per month and grants access only on a verified receipt', async () => {
  const {db,runtime,calls,changePayment}=await fixture();
  try {
    const {service}=runtime;
    await assert.rejects(service.checkout('yampi:legacy','buyer@example.test'),/access_already_active/);
    assert.equal((await service.status('yampi:legacy')).billing.accessMode,'legacy');
    assert.equal(calls.length,0);
    const checkout=await service.checkout('yampi:shop','buyer@example.test');
    assert.match(checkout.checkoutUrl,/preapproval_id=card1/);
    assert.deepEqual(calls[0].payload.auto_recurring,{frequency:1,frequency_type:'months',transaction_amount:39.9,currency_id:'BRL'});
    assert.match(calls[0].payload.external_reference,/^elunalab:IE:monthly:/);
    assert.equal((await service.status('yampi:shop')).billing.status,'expired');
    await service.reconcileInvoice('57');
    assert.equal((await service.status('yampi:shop')).billing.status,'expired');
    changePayment('approved');
    await service.reconcileInvoice('57');
    const paid=await service.status('yampi:shop');
    assert.equal(paid.billing.status,'active');
    await service.reconcileInvoice('57');
    assert.equal((await service.status('yampi:shop')).billing.paidUntil,paid.billing.paidUntil);
    await service.cancel('yampi:shop');
    assert.equal((await service.status('yampi:shop')).billing.paidUntil,paid.billing.paidUntil);
    assert.equal(monthlyEntitlement({installed:true,yampi_paid_until:paid.billing.paidUntil},new Date(paid.billing.paidUntil)).status,'expired');
    changePayment('refunded');
    await service.reconcilePayment('71');
    assert.equal((await service.status('yampi:shop')).billing.status,'expired');
    changePayment('approved');
    await service.reconcileInvoice('57');
    assert.equal((await service.status('yampi:shop')).billing.status,'expired');
    assert.equal((await service.status('yampi:legacy')).billing.status,'active');
  } finally { await db.close(); }
});

test('hosted Pix quotes 39.90, shares the checkout reservation and keeps a distinct webhook', async () => {
  const {db,runtime,calls}=await fixture();
  try {
    const {service}=runtime;
    await service.checkoutHosted('yampi:shop',false,'https://example.test');
    const {payload}=calls[0];
    assert.equal(payload.items[0].unit_price,39.9);
    assert.equal(payload.payment_methods.default_payment_method_id,'pix');
    assert.equal(payload.notification_url,'https://example.test/yampi/billing/monthly/webhook');
    await assert.rejects(service.checkout('yampi:shop','buyer@example.test'),/pix_checkout_already_open/);
    assert.equal(calls.filter(call=>call.method==='POST').length,1);
  } finally { await db.close(); }
});

test('capability is scoped to Yampi test stores and excludes test credentials from production', async () => {
  const {db,env,runtime}=await fixture();
  try {
    assert.equal(runtime.available('yampi:shop'),true);
    assert.equal(runtime.available('yampi:other'),false);
    assert.equal(runtime.available('123'),false);
    const live=buildYampiMonthlyBilling({env:{...env,YAMPI_MP_MODE:'production',YAMPI_MP_PRODUCTION_ENABLED:'true'}});
    assert.equal(live.available('yampi:shop'),false);
  } finally { await db.close(); }
});

test('an open legacy preference blocks a second checkout while still allowing historical reconciliation', async () => {
  const {db,runtime,calls}=await fixture();
  try {
    const {service}=runtime;
    const {createPurchaseLedger}=await import('../services/yampiPurchaseLedger.js');
    const pool={
      query:(sql,params)=>!params && sql.includes(';')?db.exec(sql):db.query(sql,params),
      connect:async()=>({query:db.query.bind(db),release(){}}),
    };
    const ledger=createPurchaseLedger(pool);
    const {intent}=await ledger.reserve('yampi:shop');
    await ledger.savePreference(intent.external_reference,{id:'old-pref',external_reference:intent.external_reference});
    await assert.rejects(service.checkout('yampi:shop','buyer@example.test'),/legacy_checkout_requires_review/);
    await assert.rejects(service.checkoutHosted('yampi:shop',false,'https://example.test'),/legacy_checkout_requires_review/);
    assert.equal(calls.length,0);
    const approvedAt=new Date(Date.now()-60_000).toISOString();
    await ledger.apply({id:12,external_reference:intent.external_reference,status:'approved',
      transaction_amount:79.90,currency_id:'BRL',date_approved:approvedAt});
    const state=await service.status('yampi:shop');
    assert.equal(state.billing.status,'active');
    assert.equal(state.billing.accessMode,'legacy');
    assert.equal(state.billing.paidUntil,null);
  } finally { await db.close(); }
});
