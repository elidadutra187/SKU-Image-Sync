import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {migrateDatabase} from '../services/database.js';import {grantPlatformPaidAccess} from '../services/nativeBilling.js';import {createCommercialAccess,createPostgresAccessRepository} from '../services/commercialAccess.js';
import crypto from 'node:crypto';import express from 'express';import {createBillingWebhook} from '../services/nativeBilling.js';
test('recibo fixo nativo persiste e libera sem pedido de cobrança local; duplicatas não alteram a compra',async()=>{
 const db=new PGlite();try{
  await migrateDatabase(db);await db.query("INSERT INTO stores(store_id,access_token) VALUES('123','fixture'),('456','fixture')");await db.query("INSERT INTO image_sync_access(store_id,demo_batches_used) VALUES('123',1)");
  const record={storeId:'123',chargeId:'native-one',receipt:{appId:'33268',amountValue:79.9,amountCurrency:'BRL',fromDate:'2026-10-27T00:00:00Z',toDate:'2026-10-28T00:00:00Z'}};
  const provider=()=>db,initialize=async()=>{};await grantPlatformPaidAccess(record,provider,initialize);const first=(await db.query('SELECT * FROM image_sync_access WHERE store_id=$1',['123'])).rows[0];await grantPlatformPaidAccess(record,provider,initialize);
  const second=(await db.query('SELECT * FROM image_sync_access WHERE store_id=$1',['123'])).rows[0];assert.equal(String(first.paid_at),String(second.paid_at));assert.equal(second.demo_batches_used,1);assert.equal((await db.query('SELECT * FROM image_sync_purchase')).rows.length,0);assert.equal((await db.query('SELECT * FROM image_sync_native_receipts')).rows.length,1);
  const access=createCommercialAccess(createPostgresAccessRepository(provider,initialize));assert.equal((await access.status('123')).paid,true);
  await assert.rejects(()=>grantPlatformPaidAccess({...record,storeId:'456'},provider,initialize));assert.equal((await access.status('456')).paid,false);
 }finally{await db.close();}
});

test('signed current and legacy payments persist their actual values and duplicate delivery preserves access',async()=>{
 const db=new PGlite();let server;
 try{
  await migrateDatabase(db);await db.query("INSERT INTO stores(store_id,access_token) VALUES('123','fixture'),('456','fixture')");
  const app=express();app.post('/hook',express.raw({type:'application/json'}),createBillingWebhook({mode:'platform_once',secret:'integration-fixture',appId:'33268',price:'79.99',
   isKnownStore:async({storeId})=>(await db.query('SELECT store_id FROM stores WHERE store_id=$1',[storeId])).rows.length===1,
   grant:record=>grantPlatformPaidAccess(record,()=>db,async()=>{})}));
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const send=async payload=>{const raw=JSON.stringify(payload);return fetch(`http://127.0.0.1:${server.address().port}/hook`,{method:'POST',headers:{'Content-Type':'application/json','X-Linkedstore-Hmac-Sha256':crypto.createHmac('sha256','integration-fixture').update(raw).digest('hex')},body:raw});};
  for(const [storeId,value] of [['123','79.90'],['456','79.99']]){
   const id=`native-${storeId}`,payload={store_id:storeId,event:'charge/paid',app_id:33268,id,charge:{id,concept_code:'app-cost',amount_value:value,amount_currency:'BRL',from_date:'2026-10-31T00:00:00Z',to_date:'2026-11-01T00:00:00Z'}};
   assert.equal((await send(payload)).status,200);
   const first=(await db.query('SELECT paid_at,payment_reference FROM image_sync_access WHERE store_id=$1',[storeId])).rows[0];
   assert.ok(first.paid_at);assert.equal(first.payment_reference,id);
   assert.equal((await send(payload)).status,200);
   assert.deepEqual((await db.query('SELECT paid_at,payment_reference FROM image_sync_access WHERE store_id=$1',[storeId])).rows[0],first);
   const receipt=(await db.query('SELECT amount_value FROM image_sync_native_receipts WHERE charge_id=$1',[id])).rows[0];
   assert.equal(Number(receipt.amount_value),Number(value));
   assert.equal((await send({...payload,charge:{...payload.charge,amount_value:value==='79.90'?'79.99':'79.90'}})).status,503,'a receipt ID cannot be rewritten at another price');
  }
  assert.equal((await db.query('SELECT * FROM image_sync_native_receipts')).rows.length,2);
  assert.equal((await db.query('SELECT * FROM image_sync_purchase')).rows.length,0);
 }finally{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}await db.close();}
});
