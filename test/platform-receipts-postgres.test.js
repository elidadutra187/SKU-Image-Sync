import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {migrateDatabase} from '../services/database.js';import {grantPlatformPaidAccess} from '../services/nativeBilling.js';import {createCommercialAccess,createPostgresAccessRepository} from '../services/commercialAccess.js';
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
