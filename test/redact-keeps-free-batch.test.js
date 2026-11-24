import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoreRedactor} from '../services/storeData.js';

test('Dado store-redact, quando apaga a loja, então mantém uso do lote grátis e compra paga (sem dados pessoais)', async()=>{
  const queries=[];
  const client={query:async sql=>{queries.push(sql);return {rows:[]};},release(){}};
  const redact=createStoreRedactor(()=>({connect:async()=>client}),async()=>{},async()=>async()=>{},async()=>{});
  await redact('5255436');
  const deletes=queries.filter(q=>/^delete from/i.test(q)).map(q=>q.match(/delete from (\w+)/i)[1]);
  assert.deepEqual(deletes.sort(),['image_sync_history','stores']);
  assert.ok(!deletes.includes('image_sync_access'));
  assert.ok(!deletes.includes('image_sync_purchase'));
});
