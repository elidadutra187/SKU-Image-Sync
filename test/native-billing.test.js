import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import test from 'node:test';
const native=await import('../services/nativeBilling.js').catch(()=>({}));
test('only a signed native paid charge for this app grants one-time access',async()=>{
  assert.equal(typeof native.createBillingWebhook,'function','native payment confirmation is missing');
  const writes=[];
  const handler=native.createBillingWebhook({secret:'test-secret',appId:'33268',price:'79.90',
    grant:async record=>writes.push(record)});
  const app=express();app.post('/billing',express.raw({type:'application/json',limit:'64kb'}),handler);
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/billing`;
  const body={store_id:123,event:'charge/paid',app_id:33268,id:'charge-1',
    charge:{id:'charge-1',concept_code:'plan-cost',amount_value:79.9,amount_currency:'BRL'}};
  const send=async(payload,signed=true)=>{
    const raw=JSON.stringify(payload);
    return fetch(url,{method:'POST',headers:{'content-type':'application/json',
      'x-linkedstore-hmac-sha256':signed?crypto.createHmac('sha256','test-secret').update(raw).digest('hex'):'f'.repeat(64)},body:raw});
  };
  try {
    assert.equal((await send(body,false)).status,401);assert.equal(writes.length,0);
    assert.equal((await send({...body,app_id:44759})).status,200);assert.equal(writes.length,0);
    assert.equal((await send({...body,event:'charge/failed'})).status,200);assert.equal(writes.length,0);
    assert.equal((await send({...body,charge:{...body.charge,amount_value:1}})).status,200);assert.equal(writes.length,0);
    assert.equal((await send({...body,charge:{...body.charge,amount_value:99.9}})).status,200);assert.equal(writes.length,0);
    assert.equal((await send(body)).status,200);assert.equal(writes.length,1);
    assert.deepEqual(writes[0],{storeId:'123',chargeId:'charge-1'});
  } finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
