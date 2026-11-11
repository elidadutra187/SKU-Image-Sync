import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresAccessRepository} from '../services/commercialAccess.js';

test('a disconnected read can recover while a persisted platform block still wins',async()=>{
  let reads=0;
  const repository=createPostgresAccessRepository(()=>({query:async()=>{
    if(++reads===1)throw Object.assign(new Error('connection reset'),{code:'ECONNRESET'});
    return {rows:[{paid_at:new Date(),platform_suspended:true}]};
  }}),async()=>{});
  const access=await repository.status('123');
  assert.equal(reads,2);
  assert.equal(access.paid,false);
  assert.equal(access.platformSuspended,true);
});
