import assert from 'node:assert/strict';
import test from 'node:test';
const access = await import('../services/commercialAccess.js').catch(() => ({}));
test('demo accepts at most ten products; paid access permits later batches', () => {
  assert.equal(typeof access.validateBatchAccess,'function','commercial access is missing');
  assert.doesNotThrow(()=>access.validateBatchAccess({paid:false,demoBatchesUsed:0},10));
  assert.throws(()=>access.validateBatchAccess({paid:false,demoBatchesUsed:0},11),/10/);
  assert.throws(()=>access.validateBatchAccess({paid:false,demoBatchesUsed:10},1),/pagamento/);
  assert.doesNotThrow(()=>access.validateBatchAccess({paid:true,demoBatchesUsed:10},50));
  assert.throws(()=>access.validateBatchAccess({paid:true},0),/Selecione/);
});
test('ten batches allowed; preview is free and concurrent attempts cannot exceed ten', async () => {
  assert.equal(typeof access.createCommercialAccess,'function');
  let consumed=0;
  const service=access.createCommercialAccess({
    async status(){return {paid:false,demoBatchesUsed:consumed};},
    async reserve(){ if(consumed>=10)return false; consumed++; return true; }
  });
  await service.authorize('store-a',['1','1','2'],{dryRun:true});
  assert.equal(consumed,0);
  for(let n=0;n<9;n++)await service.authorize('store-a',['1','2'],{dryRun:false});
  assert.equal((await service.status('store-a')).demoBatchesRemaining,1);
  const result=await Promise.allSettled(Array.from({length:20},()=>service.authorize('store-a',['3'],{dryRun:false})));
  assert.equal(result.filter(item=>item.status==='fulfilled').length,1);
  assert.equal(consumed,10);
  assert.equal((await service.status('store-a')).demoBatchesRemaining,0);
  await assert.rejects(()=>service.authorize('store-a',['1'],{dryRun:false}),/pagamento/);
});
test('invalid persisted counters fail closed',async()=>{
  for(const value of [undefined,-1,11,'2',NaN]) {
    const service=access.createCommercialAccess({async status(){return {paid:false,demoBatchesUsed:value};}});
    await assert.rejects(()=>service.status('store-a'),error=>error.status===503);
  }
});
