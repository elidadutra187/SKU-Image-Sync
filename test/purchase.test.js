import test from 'node:test';
import assert from 'node:assert/strict';
const module=await import('../services/purchase.js').catch(()=>({}));
test('one-time purchase requires consent and ten completed demo reservations, never retries an uncertain charge',async()=>{
  assert.equal(typeof module.createPurchaseService,'function');
  let intent=null,calls=0,used=9,paid=false;
  const repository={async claim(){if(intent)return false;intent={status:'creating'};return true;},async get(){return intent;},async save(id){intent={status:'pending',chargeId:id};}};
  const service=module.createPurchaseService({repository,configured:()=>true,appId:'33268',
    access:{async status(){return {paid,demoBatchesUsed:used};}},
    clientForStore:async()=>({async requestCharge(body){calls++;assert.equal(body.amount_value,79.9);assert.equal(body.amount_currency,'BRL');assert.match(body.external_reference,/33268.*123/);return {id:'charge-123',amount_value:79.9,amount_currency:'BRL'};}})});
  await assert.rejects(()=>service.purchase('123',false),e=>e.status===400);
  await assert.rejects(()=>service.purchase('123',true),e=>e.status===409);assert.equal(calls,0);
  used=10;const results=await Promise.all(Array.from({length:10},()=>service.purchase('123',true)));
  assert.equal(calls,1);assert.equal(results.filter(r=>r.status==='pending').length>=1,true);
  await service.purchase('123',true);assert.equal(calls,1);
  paid=true;assert.equal((await service.purchase('123',true)).status,'paid');assert.equal(calls,1);
});
test('native charge POST performs one request and does not retry a server failure',async()=>{
  assert.equal(typeof module.requestNativeCharge,'function');let calls=0;
  const client={baseUrl:'https://api.nuvemshop.com.br/2025-03/123',accessToken:'fake',userAgent:'test'};
  await assert.rejects(()=>module.requestNativeCharge(client,{amount_value:79.9},'33268',async(url,options)=>{
    calls++;assert.equal(url,'https://api.nuvemshop.com.br/2025-03/123/services/33268/charges');
    assert.equal(options.method,'POST');return {ok:false,status:503};
  }));assert.equal(calls,1);
});
test('an ambiguous network failure preserves the intent instead of creating another charge',async()=>{
  assert.equal(typeof module.createPurchaseService,'function');let intent=null,calls=0;
  const service=module.createPurchaseService({configured:()=>true,appId:'33268',access:{async status(){return {paid:false,demoBatchesUsed:2};}},
    repository:{async claim(){if(intent)return false;intent={status:'creating'};return true;},async get(){return intent;},async save(){}},
    clientForStore:async()=>({async requestCharge(){calls++;throw new Error('network_timeout');}})});
  await assert.rejects(()=>service.purchase('123',true),e=>e.status===503);
  assert.equal((await service.purchase('123',true)).status,'creating');assert.equal(calls,1);
});
