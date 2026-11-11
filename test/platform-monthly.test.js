import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {migrateDatabase} from '../services/database.js';
import {createPostgresAccessRepository,createCommercialAccess} from '../services/commercialAccess.js';
import {registerMonthlyTrial,grantMonthlyReceipt,updateMonthlyLifecycle,setMonthlySuspended} from '../services/monthlyBilling.js';
import {createBillingWebhook} from '../services/nativeBilling.js';
import {createPurchaseService} from '../services/purchase.js';

test('monthly trial, expiry, renewal, churn, suspension, replay and old paid licences',async()=>{
 const db=new PGlite(),options={poolProvider:()=>db,initialize:async()=>{}};
 try {
  await migrateDatabase(db);
  await db.exec("set application_name='imagem-em-lote'");
  await db.query("insert into stores(store_id,access_token) values ('123','token'),('456','token')");
  const access=createCommercialAccess(createPostgresAccessRepository(()=>db,async()=>{}));
  await registerMonthlyTrial('123',options);
  let state=await access.status('123');
  assert.equal(state.trialActive,true);assert.equal(state.paid,false);
  const first=state.trialUntil;
  await registerMonthlyTrial('123',options);
  assert.equal(String((await access.status('123')).trialUntil),String(first),'OAuth reconnect cannot reset trial');
  await db.query("update image_sync_monthly set trial_until=now()-interval '1 second' where store_id='123'");
  assert.equal((await access.status('123')).trialActive,false);
  const start=new Date(Date.now()-86400000).toISOString(),end=new Date(Date.now()+12*86400000).toISOString();
  const receipt={storeId:'123',chargeId:'monthly-001',receipt:{appId:'33268',amountValue:12.99,amountCurrency:'BRL',fromDate:start,toDate:end}};
  await grantMonthlyReceipt(receipt,options);
  await grantMonthlyReceipt(receipt,options);
  assert.equal((await access.status('123')).paid,true);
  assert.equal((await db.query("select count(*)::integer as count from image_sync_native_receipts")).rows[0].count,1);
  await assert.rejects(()=>grantMonthlyReceipt({...receipt,storeId:'456'},options),/not_applied/);
  await updateMonthlyLifecycle({storeId:'123',topic:'churn'},options);
  assert.equal((await access.status('123')).paid,false);
  await updateMonthlyLifecycle({storeId:'123',topic:'phoenix'},options);
  assert.equal((await access.status('123')).paid,false);
  await grantMonthlyReceipt(receipt,options);
  assert.equal((await access.status('123')).paid,false,'replaying the old receipt cannot lift the block');
  await setMonthlySuspended({storeId:'123',suspended:true},options);
  assert.equal((await access.status('123')).paid,false);
  await setMonthlySuspended({storeId:'123',suspended:false},options);
  assert.equal((await access.status('123')).paid,false);
  await grantMonthlyReceipt({...receipt,chargeId:'monthly-002'},options);
  assert.equal((await access.status('123')).paid,true);
  await db.query("update image_sync_monthly set paid_until=now()-interval '1 second' where store_id='123'");
  assert.equal((await access.status('123')).paid,false);
  await db.query("insert into image_sync_access(store_id,paid_at) values ('456',now())");
  assert.equal((await access.status('456')).paid,true,'retired one-time purchases remain permanent');
  await updateMonthlyLifecycle({storeId:'456',topic:'uninstalled'},options);
  await assert.rejects(()=>access.authorize('456',['1']),{status:402});
  assert.ok((await db.query("select paid_at from image_sync_access where store_id='456'")).rows[0].paid_at);
  const past=ms=>new Date(Date.now()-ms).toISOString();
  await updateMonthlyLifecycle({storeId:'456',topic:'churn',occurredAt:past(3000)},options);
  const renewal={...receipt,storeId:'456',chargeId:'late-001'};
  await grantMonthlyReceipt({...renewal,occurredAt:past(6000)},options);
  assert.equal((await access.status('456')).paid,false,'first delivery of an older payment cannot undo cancellation');
  await grantMonthlyReceipt({...renewal,chargeId:'renewal-002',occurredAt:new Date().toISOString()},options);
  await updateMonthlyLifecycle({storeId:'456',topic:'churn',occurredAt:past(3000)},options);
  assert.equal((await access.status('456')).paid,true,'delayed cancellation cannot undo a newer payment');
 } finally {await db.close();}
});

test('monthly webhook scopes signed receipts to app, accepts prorations and handles cancellation',async()=>{
 const events=[],grants=[];let server;
 const event={store_id:123,event:'charge/paid',app_id:33268,id:'monthly-1',
   charge:{id:'monthly-1',concept_code:'app-cost',amount_value:12.99,amount_currency:'BRL',
     from_date:new Date().toISOString(),to_date:new Date(Date.now()+20*86400000).toISOString()}};
 const app=express();app.post('/webhooks/billing',express.raw({type:'application/json'}),
   createBillingWebhook({mode:'platform_monthly',secret:'test-monthly',appId:'33268',price:'39.90',
    isKnownStore:async({storeId})=>storeId==='123',grantMonthly:async x=>grants.push(x),
    subscriptionEvent:async x=>events.push(x),suspensionEvent:async x=>events.push(x)}));
 try {
  server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  async function send(payload,valid=true) {
   const body=JSON.stringify(payload);
   return fetch('http://127.0.0.1:'+server.address().port+'/webhooks/billing',{
     method:'POST',headers:{'Content-Type':'application/json',
      'X-Linkedstore-Hmac-Sha256':valid?crypto.createHmac('sha256','test-monthly').update(body).digest('hex'):'0'.repeat(64)},body});
  }
  assert.equal((await send(event,false)).status,401);
  await send({...event,app_id:33269});await send({...event,charge:{...event.charge,amount_value:40}});
  await send({...event,charge:{...event.charge,amount_value:0}});
  assert.equal(grants.length,0);
  assert.equal((await send(event)).status,200);assert.equal(grants.length,1);
  await send({...event,event:'app_subscription/updated',id:33268,topic:'churn'});
  await send({...event,event:'app_subscription/updated',id:33268,topic:'phoenix'});
  await send({...event,event:'app/suspended',id:33268});
  assert.deepEqual(events.map(x=>x.topic||String(x.suspended)),['churn','phoenix','true']);
  await send({...event,event:'app_subscription/updated',id:33269,topic:'churn'});
  assert.equal(events.length,3);
 } finally {if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}}
});

test('monthly purchase never creates a second charge',async()=>{
 let calls=0;
 const service=createPurchaseService({mode:'platform_monthly',
  access:{status:async()=>({paid:false,trialActive:false,demoBatchesUsed:1})},
  clientForStore:async()=>{calls++;throw Error('should not bill')},
  repository:{claim:async()=>{calls++;throw Error('should not bill')} }});
 assert.equal((await service.purchase('123',true)).managedBy,'nuvemshop');
 assert.equal(calls,0);
});
