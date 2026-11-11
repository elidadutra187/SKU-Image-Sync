import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import {recordPartnerPaymentEvidence} from '../services/partnerPayments.js';
import express from 'express';
import { applyVerifiedPartnerPaymentEvidence, reconcileStoredPartnersCredits } from '../services/partnerPaymentRecovery.js';
import { createPartnerPaymentRecoveryRouter } from '../routes/partnerPaymentRecovery.js';

const proof = {
  source: 'nuvemshop_partners_commissions', status: 'paid',
  creditId: '17194926', storeId: '6556813', appId: '33268',
  url: 'https://partners.nuvemshop.com.br/payments/details/4e4f8fdc-9ed6-4f5b-b1d9-a737509aaf07',
  paymentDate: '2026-10-20', contractedDays: 31, grossPaidBRL: 28.35,
  nativeCurrency: 'ARS', nativeAmount: 8573.91
};

test('verified Partners credit atomically grants permanent one-time access, and replay is idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE stores (store_id text PRIMARY KEY, access_token text NOT NULL);
      CREATE TABLE image_sync_partner_receipts (credit_id text PRIMARY KEY, store_id text NOT NULL, app_id text NOT NULL, evidence jsonb NOT NULL, verified_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz);
      CREATE TABLE image_sync_access (store_id text PRIMARY KEY, demo_batches_used integer DEFAULT 0, paid_at timestamptz, payment_reference text UNIQUE);
      INSERT INTO stores (store_id,access_token) VALUES ('6556813','token'),('6557210','token');
    `);
    await applyVerifiedPartnerPaymentEvidence(proof, { client: db, appId: '33268' });
    const first = (await db.query('SELECT * FROM image_sync_access WHERE store_id=$1',[proof.storeId])).rows[0];
    await applyVerifiedPartnerPaymentEvidence(proof, { client: db, appId: '33268' });
    const after = (await db.query('SELECT * FROM image_sync_access')).rows;
    assert.equal(after.length, 1);
    assert.equal(String(after[0].paid_at), String(first.paid_at));
    assert.equal(after[0].payment_reference, 'partners:17194926');
    await assert.rejects(
      applyVerifiedPartnerPaymentEvidence({...proof,storeId:'6557210'}, { client:db, appId:'33268' }),
      /partners_credit_already_bound/
    );
    assert.equal((await db.query('SELECT COUNT(*)::integer AS n FROM image_sync_partner_receipts')).rows[0].n, 1);
  } finally { await db.close(); }
});

test('unknown stores or unverified claims cannot obtain access or leave receipt artifacts', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE stores(store_id text PRIMARY KEY,access_token text NOT NULL);
      CREATE TABLE image_sync_partner_receipts(credit_id text PRIMARY KEY, store_id text, app_id text, evidence jsonb, applied_at timestamptz);
      CREATE TABLE image_sync_access(store_id text PRIMARY KEY,paid_at timestamptz,payment_reference text UNIQUE);
      INSERT INTO stores VALUES ('6556813','token');
    `);
    await assert.rejects(applyVerifiedPartnerPaymentEvidence({...proof,storeId:'999'}, {client:db,appId:'33268'}),/unknown_or_uninstalled_store/);
    await assert.rejects(applyVerifiedPartnerPaymentEvidence({...proof,status:'pending'}, {client:db,appId:'33268'}),/invalid_partners_payment_evidence/);
    assert.equal((await db.query('SELECT COUNT(*)::integer AS n FROM image_sync_partner_receipts')).rows[0].n,0);
    assert.equal((await db.query('SELECT COUNT(*)::integer AS n FROM image_sync_access')).rows[0].n,0);
  } finally { await db.close(); }
});

test('recovery endpoint rejects missing or wrong admin credentials', async () => {
  let calls = 0;
  const app = express();
  app.use(express.json());
  app.use('/ops/partner-payments', createPartnerPaymentRecoveryRouter({
    adminKey:()=> 'very-secret-admin-key',
    apply: async () => { calls++; return { applied:true }; }
  }));
  const server = app.listen(0);
  try {
    const url = `http://127.0.0.1:${server.address().port}/ops/partner-payments/verified-credit`;
    const unauthenticated = await fetch(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(proof)});
    assert.equal(unauthenticated.status,401);
    const fake = await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-eluna-reconcile-key':'wrong'},body:JSON.stringify(proof)});
    assert.equal(fake.status,401);
    assert.equal(calls,0);
    const valid = await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-eluna-reconcile-key':'very-secret-admin-key'},body:JSON.stringify(proof)});
    assert.equal(valid.status,200);
    assert.equal(calls,1);
  } finally { await new Promise(resolve=>server.close(resolve)); }
});

test('boot reconciliation activates only installed, previously verified, unpaid stores', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE stores (store_id text PRIMARY KEY, access_token text NOT NULL);
      CREATE TABLE image_sync_partner_receipts (
        credit_id text PRIMARY KEY, store_id text NOT NULL,
        app_id text NOT NULL, evidence jsonb NOT NULL,
        verified_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz
      );
      CREATE TABLE image_sync_access (
        store_id text PRIMARY KEY, paid_at timestamptz,
        payment_reference text UNIQUE
      );
      INSERT INTO stores (store_id,access_token) VALUES ('6556813','installed');
    `);
    await recordPartnerPaymentEvidence(proof,{query:(...args)=>db.query(...args),appId:'33268'});
    const result = await reconcileStoredPartnersCredits({
      query: (...args) => db.query(...args), appId: '33268',
      apply: (input, options) => applyVerifiedPartnerPaymentEvidence(input,{...options,client:db})
    });
    assert.deepEqual(result, {examined:1,recovered:1,failed:0});
    const row=(await db.query('SELECT paid_at,payment_reference FROM image_sync_access WHERE store_id=$1',[proof.storeId])).rows[0];
    assert.ok(row.paid_at);
    assert.equal(row.payment_reference,'partners:17194926');
    assert.deepEqual(await reconcileStoredPartnersCredits({
      query: (...args) => db.query(...args),appId:'33268'
    }), {examined:0,recovered:0,failed:0});
  } finally { await db.close(); }
});


test('verified new monthly Partners credit grants only a dated period, and retries do not grant permanent access',async()=>{
 const db=new PGlite();const previous=process.env.NUVEMSHOP_BILLING_MODEL;
 process.env.NUVEMSHOP_BILLING_MODEL='platform_monthly';
 try{
  await db.exec(`
    CREATE TABLE stores(store_id text PRIMARY KEY,access_token text NOT NULL);
    CREATE TABLE image_sync_partner_receipts(credit_id text PRIMARY KEY,store_id text NOT NULL,app_id text NOT NULL,evidence jsonb NOT NULL,verified_at timestamptz DEFAULT now(),applied_at timestamptz);
    CREATE TABLE image_sync_access(store_id text PRIMARY KEY,paid_at timestamptz,payment_reference text UNIQUE);
    CREATE TABLE image_sync_monthly(store_id text PRIMARY KEY,trial_until timestamptz,paid_until timestamptz,last_charge_id text,updated_at timestamptz DEFAULT now());
    INSERT INTO stores VALUES('6556813','token');
  `);
  const monthly={...proof,creditId:'21211212',paymentDate:'2026-11-11',contractedDays:30};
  await applyVerifiedPartnerPaymentEvidence(monthly,{client:db,appId:'33268'});
  await applyVerifiedPartnerPaymentEvidence(monthly,{client:db,appId:'33268'});
  assert.equal((await db.query('SELECT count(*) as count FROM image_sync_access')).rows[0].count,0);
  const period=(await db.query("SELECT paid_until,last_charge_id FROM image_sync_monthly WHERE store_id='6556813'")).rows[0];
  assert.equal(period.last_charge_id,'partners:21211212');
  assert.equal(new Date(period.paid_until).toISOString(),'2026-12-11T00:00:00.000Z');
  assert.ok((await db.query("SELECT applied_at FROM image_sync_partner_receipts WHERE credit_id='21211212'")).rows[0].applied_at);
  const recon=await reconcileStoredPartnersCredits({query:(...args)=>db.query(...args),appId:'33268'});
  assert.deepEqual(recon,{examined:0,recovered:0,failed:0});
 }finally{
  if(previous===undefined)delete process.env.NUVEMSHOP_BILLING_MODEL;
  else process.env.NUVEMSHOP_BILLING_MODEL=previous;
  await db.close();
 }
});
