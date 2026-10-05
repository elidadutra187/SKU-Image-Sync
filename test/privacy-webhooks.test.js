import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {createPrivacyRouter} from '../routes/webhooks.js';
test('privacy webhooks verify raw signature, delete only the requested store and expose no PII',async()=>{
  const deleted=[];let fail=false;
  const app=express();app.use('/webhooks',express.raw({type:'application/json'}),createPrivacyRouter({secret:()=> 'test-secret',redact:async id=>{if(fail)throw new Error('private database details');deleted.push(id);}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/webhooks`;
  const post=(action,payload,valid=true)=>{const body=JSON.stringify(payload);return fetch(`${base}/${action}`,{method:'POST',headers:{'content-type':'application/json','x-linkedstore-hmac-sha256':valid?crypto.createHmac('sha256','test-secret').update(body).digest('hex'):'f'.repeat(64)},body});};
  try {
    assert.equal((await post('store-redact',{store_id:123},false)).status,401);assert.equal(deleted.length,0);
    assert.equal((await post('store-redact',{store_id:'../wrong'})).status,400);
    assert.deepEqual(await (await post('store-redact',{store_id:123})).json(),{success:true,action:'store-redact',deleted:true});
    assert.deepEqual(deleted,['123']);
    for(const action of ['customers-redact','customers-data-request']) {
      const response=await (await post(action,{store_id:123,customer:{email:'sensitive@example.com'},orders_requested:[999]})).json();
      assert.equal(response.customerDataStored,false);assert.equal(JSON.stringify(response).includes('sensitive'),false);assert.deepEqual(deleted,['123']);
    }
    fail=true;const response=await post('store-redact',{store_id:123});assert.equal(response.status,503);assert.deepEqual(await response.json(),{success:false});
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
