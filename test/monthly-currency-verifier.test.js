import test from 'node:test';
import assert from 'node:assert/strict';
const input={storeId:'8534887',chargeId:'charge-1',receipt:{appId:'33268',amountValue:10580.62,amountCurrency:'ARS',fromDate:'2026-11-22T03:00:00.000Z',toDate:'2026-12-16T03:00:00.000Z'}};
const subscription={store_id:8534887,amount_currency:'ARS',amount_value:'10580.62',concept_code:'app-cost',recurring_frequency:'M',recurring_interval:1};
async function factory(options){return (await import('../services/monthlyCurrency.js')).createMonthlyCurrencyVerifier(options);}
test('official store-specific converted amount accepts full/prorated charge, never a BRL constant',async()=>{
 let calls=0;const verify=await factory({readContext:async()=>({knownStore:true}),readSubscription:async()=>{calls++;return subscription;}});
 assert.equal((await verify(input)).verified,true);
 assert.equal((await verify({...input,receipt:{...input.receipt,amountValue:5000}})).verified,true);
 await assert.rejects(()=>verify({...input,receipt:{...input.receipt,amountValue:10580.63}}));
 assert.equal(calls,3);
});
for(const [name,override] of [['store',{store_id:8219542}],['currency',{amount_currency:'BRL'}],['amount',{amount_value:'0'}],['interval',{recurring_interval:2}],['frequency',{recurring_frequency:'Y'}],['concept',{concept_code:'other'}]]){
 test(`official ${name} mismatch cannot grant access`,async()=>{
  const verify=await factory({readContext:async()=>({knownStore:true}),readSubscription:async()=>({...subscription,...override})});
  await assert.rejects(()=>verify(input));
 });
}
test('recorded exact receipt avoids external call, but does not itself reactivate a ledger',async()=>{
 let calls=0;const verify=await factory({readContext:async()=>({knownStore:true,recorded:true}),readSubscription:async()=>{calls++;throw Error('must not fetch');}});
 assert.deepEqual(await verify(input),{verified:true,source:'stored_receipt'});assert.equal(calls,0);
});
test('unknown store or conflicting receipt fails before external call',async()=>{
 for(const context of [{knownStore:false},{knownStore:true,conflict:true}]){
  const verify=await factory({readContext:async()=>context,readSubscription:async()=>assert.fail('unexpected external call')});
  await assert.rejects(()=>verify(input));
 }
});
test('identical simultaneous events share a lookup; failures are not cached',async()=>{
 let reads=0,calls=0,release;const gate=new Promise(r=>release=r);
 const verify=await factory({readContext:async()=>{reads++;return {knownStore:true};},readSubscription:async()=>{calls++;await gate;throw Error('temporary');}});
 const pending=Array.from({length:8},()=>verify(input));release();
 assert.ok((await Promise.allSettled(pending)).every(x=>x.status==='rejected'));assert.equal(reads,1);assert.equal(calls,1);
 await assert.rejects(()=>verify(input));assert.equal(calls,2);
});
test('different stores never share verification; in-flight bound fails closed',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const verify=await factory({maxInFlight:1,readContext:async()=>({knownStore:true}),readSubscription:async()=>{await gate;return subscription;}});
 const first=verify(input);
 await assert.rejects(()=>verify({...input,storeId:'8219542'}));
 release();assert.equal((await first).verified,true);
});

test('real SQL proof reuses exact receipt; delayed ARS without event time cannot undo cancellation',async()=>{
 const {PGlite}=await import('@electric-sql/pglite');
 const {migrateDatabase}=await import('../services/database.js');
 const {grantMonthlyReceipt,setMonthlySuspended}=await import('../services/monthlyBilling.js');
 const {readMonthlyReceiptContext}=await import('../services/monthlyCurrency.js');
 const db=new PGlite(),options={poolProvider:()=>db,initialize:async()=>{}};
 try{
  await migrateDatabase(db);await db.exec("set application_name='imagem-em-lote'");
  await db.query("insert into stores(store_id,access_token) values ('8534887','fixture'),('8219542','fixture')");
  assert.equal((await readMonthlyReceiptContext(input,options)).knownStore,true);
  await setMonthlySuspended({storeId:input.storeId,suspended:true,lifecycle:'churn'},options);
  await grantMonthlyReceipt({...input,requireEventTimeForRecovery:true},options);
  const m=(await db.query('select lifecycle,platform_suspended from image_sync_monthly where store_id=$1',[input.storeId])).rows[0];
  assert.equal(m.platform_suspended,true,'an unknown payment timestamp cannot supersede cancellation');
  assert.equal(m.lifecycle,'churn');
  assert.equal((await readMonthlyReceiptContext(input,options)).recorded,true);
  assert.equal((await readMonthlyReceiptContext({...input,storeId:'8219542'},options)).conflict,true);
  assert.equal((await readMonthlyReceiptContext({...input,receipt:{...input.receipt,amountValue:1}},options)).conflict,true);
  await grantMonthlyReceipt({...input,storeId:'8219542',chargeId:'unknown-time',requireEventTimeForRecovery:true},options);
  const priority=(await db.query("select last_payment_event_at from image_sync_monthly where store_id='8219542'")).rows[0];
  assert.equal(priority.last_payment_event_at,null,'delivery time must not masquerade as the payment event time');
  await setMonthlySuspended({storeId:'8219542',suspended:true,lifecycle:'churn',occurredAt:new Date(Date.now()-1000).toISOString()},options);
  assert.equal((await db.query("select platform_suspended from image_sync_monthly where store_id='8219542'")).rows[0].platform_suspended,true);
 }finally{await db.close();}
});
