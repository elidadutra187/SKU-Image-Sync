import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';import express from 'express';
import {createBillingWebhook} from '../services/nativeBilling.js';import {createPurchaseService} from '../services/purchase.js';
const event={store_id:123,event:'charge/paid',app_id:33268,id:'platform-charge',charge:{id:'platform-charge',concept_code:'app-cost',amount_value:'79.90',amount_currency:'BRL',from_date:'2026-10-27T00:00:00Z',to_date:'2026-10-28T00:00:00Z'}};
test('pagamento fixo nativo confirmado não exige criar uma cobrança adicional local',async()=>{
 const grants=[];let known=true;
 const handler=createBillingWebhook({mode:'platform_once',secret:'platform-test',appId:'33268',price:'79.90',isKnownStore:async()=>known,isExpectedCharge:async()=>false,grant:async r=>grants.push(r)});
 const app=express();app.post('/hook',express.raw({type:'application/json'}),handler);const server=app.listen(0);await new Promise(r=>server.once('listening',r));
 const send=async body=>{const raw=JSON.stringify(body);return fetch('http://127.0.0.1:'+server.address().port+'/hook',{method:'POST',headers:{'Content-Type':'application/json','X-Linkedstore-Hmac-Sha256':crypto.createHmac('sha256','platform-test').update(raw).digest('hex')},body:raw});};
 try{
  assert.equal((await send(event)).status,200);assert.equal(grants.length,1);assert.equal(grants[0].receipt.amountCurrency,'BRL');
  for(const bad of [{...event,app_id:44759},{...event,charge:{...event.charge,amount_value:'1.00'}},{...event,charge:{...event.charge,amount_currency:'USD'}},{...event,charge:{...event.charge,to_date:'invalid'}},{...event,event:'charge/failed'}]){await send(bad);assert.equal(grants.length,1);}
  known=false;assert.equal((await send(event)).status,503);assert.equal(grants.length,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('fluxo publicado encaminha ao pagamento da plataforma sem POST financeiro adicional',async()=>{
 let calls=0;
 const service=createPurchaseService({mode:'platform_once',appId:'33268',configured:()=>false,access:{status:async()=>({paid:false,demoBatchesUsed:1})},clientForStore:async()=>{calls++;throw Error('unexpected charge client');},repository:{claim:async()=>{calls++;throw Error('unexpected claim');}}});
 const result=await service.purchase('123',true);assert.equal(result.managedBy,'nuvemshop');assert.equal(result.status,'pending');assert.equal(calls,0);
});
