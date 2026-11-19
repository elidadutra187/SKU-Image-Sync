import assert from 'node:assert/strict';
import test from 'node:test';
import {validateBatchAccess,createCommercialAccess} from '../services/commercialAccess.js';
test('free upload counts images even when they belong to one product',()=>{assert.doesNotThrow(()=>validateBatchAccess({paid:false,demoBatchesUsed:0},1,10));assert.throws(()=>validateBatchAccess({paid:false,demoBatchesUsed:0},1,11),/10 imagens/);assert.doesNotThrow(()=>validateBatchAccess({paid:true},1,100));assert.throws(()=>validateBatchAccess({paid:false,demoBatchesUsed:1},1,1),/pagamento/);});
test('only one concurrent free upload; preview never consumes it',async()=>{let used=0;const access=createCommercialAccess({async status(){return {paid:false,demoBatchesUsed:used};},async reserve(){if(used>=1)return false;used++;return true;}});await access.authorize('store',['1'],{dryRun:true,imageCount:10});assert.equal(used,0);const results=await Promise.allSettled(Array.from({length:20},()=>access.authorize('store',['1'],{imageCount:10})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await access.status('store')).demoBatchesRemaining,0);});
test('previously used demo remains exhausted',async()=>{for(const used of [1,2,10]){const access=createCommercialAccess({async status(){return {paid:false,demoBatchesUsed:used};}});assert.equal((await access.status('store')).demoUsed,true);}});

test('courtesy permits batches without consuming demo or marking payment',async()=>{
  let courtesyActive=true;
  const access=createCommercialAccess({
    async status(){return {paid:false,courtesyActive,demoBatchesUsed:1};},
    async reserve(){assert.fail('courtesy must not reserve a demo batch');}
  });
  const current=await access.authorize('5637867',['1'],{imageCount:11});
  assert.equal(current.paid,false);
  courtesyActive=false;
  await assert.rejects(access.authorize('5637867',['1']),/pagamento/);
});

test('Nuvemshop active monthly trial allows unlimited batches and images without consuming demo',async()=>{
  let reserveCalls=0,paid=false,trialActive=true;
  const access=createCommercialAccess({
    async status(){return {paid,trialActive,purchaseMode:'platform_monthly',demoBatchesUsed:1};},
    async reserve(){reserveCalls++;throw Error('monthly trial must not consume a demo batch');}
  });
  await access.authorize('123',['1'],{dryRun:true,imageCount:500});
  for(let i=0;i<4;i++)await access.authorize('123',['1'],{imageCount:125});
  assert.equal(reserveCalls,0);
  await assert.rejects(access.authorize('123',Array.from({length:51},(_,i)=>String(i)),{imageCount:51}),/50 produtos/);
  trialActive=false;
  await assert.rejects(access.authorize('123',['1'],{imageCount:1}),/período de teste/);
  paid=true;
  await assert.doesNotReject(access.authorize('123',['1'],{imageCount:125}));
});
test('expired Nuvemshop trial cannot use a remaining demo or get another one',()=>{
  assert.throws(()=>validateBatchAccess({paid:false,trialActive:false,purchaseMode:'platform_monthly',demoBatchesUsed:0},1,1),/período de teste/);
  assert.doesNotThrow(()=>validateBatchAccess({paid:false,trialActive:true,purchaseMode:'platform_monthly',demoBatchesUsed:1},1,125));
  assert.doesNotThrow(()=>validateBatchAccess({paid:false,trialActive:false,purchaseMode:'mercadopago_once',demoBatchesUsed:0},1,10));
  assert.doesNotThrow(()=>validateBatchAccess({paid:true,trialActive:false,purchaseMode:'platform_monthly',demoBatchesUsed:1},1,11));
});
