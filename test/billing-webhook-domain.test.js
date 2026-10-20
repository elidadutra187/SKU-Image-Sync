import test from 'node:test';
import assert from 'node:assert/strict';
import {registerBillingWebhooks,refreshAllBillingWebhooks} from '../services/nativeBilling.js';

test('billing webhooks move to the new APP_URL and old-host hooks are removed',async()=>{
  const saved={...process.env};
  Object.assign(process.env,{NUVEMSHOP_CLIENT_ID:'1',NUVEMSHOP_CLIENT_SECRET:'s',NUVEMSHOP_ONE_TIME_PRICE:'79.90',NUVEMSHOP_BILLING_MODEL:'usage_once',NUVEMSHOP_NATIVE_BILLING:'true',APP_URL:'https://imagens.elunalab.com.br'});
  try{
    const calls=[];
    const client={request:async(path,init={})=>{calls.push({path,method:init.method||'GET',body:init.body&&JSON.parse(init.body)});
      if(path==='/webhooks'&&!init.method)return [{id:7,event:'charge/paid',url:'https://imagememlote.onrender.com/webhooks/billing'},{id:8,event:'product/updated',url:'https://x.example/hook'}];return {};}};
    await registerBillingWebhooks(client);
    assert.deepEqual(calls.filter(c=>c.method==='POST').map(c=>c.body.url),['https://imagens.elunalab.com.br/webhooks/billing','https://imagens.elunalab.com.br/webhooks/billing']);
    assert.deepEqual(calls.filter(c=>c.method==='DELETE').map(c=>c.path),['/webhooks/7']);
    const done=await refreshAllBillingWebhooks({listStoreIds:async()=>['1','2'],clientFor:async id=>{if(id==='2')throw Error('x');return client;},log:{error(){}}});
    assert.equal(done,1);
  }finally{process.env=saved;}
});
