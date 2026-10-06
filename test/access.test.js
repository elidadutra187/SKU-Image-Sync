import assert from 'node:assert/strict';
import test from 'node:test';
const access = await import('../services/commercialAccess.js').catch(() => ({}));
test('demo accepts at most ten products; paid access permits later batches', () => {
  assert.equal(typeof access.validateBatchAccess,'function','commercial access is missing');
  assert.doesNotThrow(()=>access.validateBatchAccess({paid:false,demoBatchesUsed:0},10));
  assert.throws(()=>access.validateBatchAccess({paid:false,demoBatchesUsed:0},11),/10/);
  assert.throws(()=>access.validateBatchAccess({paid:false,demoBatchesUsed:2},1),/pagamento/);
  assert.doesNotThrow(()=>access.validateBatchAccess({paid:true,demoBatchesUsed:2},50));
  assert.throws(()=>access.validateBatchAccess({paid:true},0),/Selecione/);
});
test('two batches allowed; preview is free and concurrent attempts cannot exceed two', async () => {
  assert.equal(typeof access.createCommercialAccess,'function');
  let consumed=0;
  const service=access.createCommercialAccess({
    async status(){return {paid:false,demoBatchesUsed:consumed};},
    async reserve(){ if(consumed>=2)return false; consumed++; return true; }
  });
  await service.authorize('store-a',['1','1','2'],{dryRun:true});
  assert.equal(consumed,0);
  for(let n=0;n<1;n++)await service.authorize('store-a',['1','2'],{dryRun:false});
  assert.equal((await service.status('store-a')).demoBatchesRemaining,1);
  const result=await Promise.allSettled(Array.from({length:20},()=>service.authorize('store-a',['3'],{dryRun:false})));
  assert.equal(result.filter(item=>item.status==='fulfilled').length,1);
  assert.equal(consumed,2);
  assert.equal((await service.status('store-a')).demoBatchesRemaining,0);
  await assert.rejects(()=>service.authorize('store-a',['1'],{dryRun:false}),/pagamento/);
});
test('invalid persisted counters fail closed',async()=>{
  for(const value of [undefined,-1,'2',NaN]) {
    const service=access.createCommercialAccess({async status(){return {paid:false,demoBatchesUsed:value};}});
    await assert.rejects(()=>service.status('store-a'),error=>error.status===503);
  }
});

test('legacy counters above the new demo limit are treated as exhausted, not invalid',async()=>{
  const service=access.createCommercialAccess({async status(){return {paid:false,demoBatchesUsed:7};}});
  const status=await service.status('store-a');
  assert.equal(status.demoUsed,true);
  assert.equal(status.demoBatchesRemaining,0);
});
