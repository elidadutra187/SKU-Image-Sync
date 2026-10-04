import assert from 'node:assert/strict';
import test from 'node:test';
const access = await import('../services/commercialAccess.js').catch(() => ({}));
test('demo accepts at most ten products; paid access permits later batches', () => {
  assert.equal(typeof access.validateBatchAccess,'function','commercial access is missing');
  assert.doesNotThrow(()=>access.validateBatchAccess({paid:false,demoUsed:false},10));
  assert.throws(()=>access.validateBatchAccess({paid:false,demoUsed:false},11),/10/);
  assert.throws(()=>access.validateBatchAccess({paid:false,demoUsed:true},1),/pagamento/);
  assert.doesNotThrow(()=>access.validateBatchAccess({paid:true,demoUsed:true},50));
  assert.throws(()=>access.validateBatchAccess({paid:true},0),/Selecione/);
});
test('preview does not consume demo; only one concurrent real batch reserves it', async () => {
  assert.equal(typeof access.createCommercialAccess,'function');
  let consumed=false;
  const service=access.createCommercialAccess({
    async status(){return {paid:false,demoUsed:consumed};},
    async reserve(){ if(consumed)return false; consumed=true; return true; }
  });
  await service.authorize('store-a',['1','1','2'],{dryRun:true});
  assert.equal(consumed,false);
  const result=await Promise.allSettled([
    service.authorize('store-a',['1','2'],{dryRun:false}),
    service.authorize('store-a',['3'],{dryRun:false})
  ]);
  assert.equal(result.filter(item=>item.status==='fulfilled').length,1);
  await assert.rejects(()=>service.authorize('store-a',['1'],{dryRun:false}),/pagamento/);
});
