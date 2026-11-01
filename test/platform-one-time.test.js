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
 const result=await service.purchase('123',true);assert.equal(result.managedBy,'nuvemshop');assert.equal(result.status,'unconfirmed');assert.equal(calls,0);
});

test('default platform pricing accepts 79.99 and the exact BRL legacy receipt without rewriting amounts',async()=>{
 const previous=process.env.NUVEMSHOP_ONE_TIME_PRICE;delete process.env.NUVEMSHOP_ONE_TIME_PRICE;
 const grants=[];
 const app=express();app.post('/hook',express.raw({type:'application/json'}),createBillingWebhook({mode:'platform_once',secret:'price-test',appId:'33268',isKnownStore:async()=>true,grant:async record=>grants.push(record)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const send=async(body,signed=true)=>{const raw=JSON.stringify(body);return fetch(`http://127.0.0.1:${server.address().port}/hook`,{method:'POST',headers:{'Content-Type':'application/json','X-Linkedstore-Hmac-Sha256':signed?crypto.createHmac('sha256','price-test').update(raw).digest('hex'):'0'.repeat(64)},body:raw});};
 try{
  for(const value of ['79.99','79.90']){
   const response=await send({...event,id:`charge-${value}`,charge:{...event.charge,id:`charge-${value}`,amount_value:value}});
   assert.equal(response.status,200);assert.equal((await response.json()).ignored,undefined,`valid receipt ${value} must be accepted`);
   assert.equal(grants.at(-1).receipt.amountValue,Number(value),'ledger must preserve the actual amount');
  }
  assert.equal(grants.length,2);
  for(const value of ['79.98','79.91','1.00','799.90','79.999'])await send({...event,charge:{...event.charge,amount_value:value}});
  await send({...event,app_id:999});await send({...event,event:'charge/failed'});
  await send({...event,charge:{...event.charge,amount_value:'79.99',amount_currency:'USD'}});
  assert.equal((await send(event,false)).status,401);assert.equal(grants.length,2);
  process.env.NUVEMSHOP_ONE_TIME_PRICE='79.99';
  await send({...event,charge:{...event.charge,amount_value:'79.99',amount_currency:'ARS'}});assert.equal(grants.length,2,'BRL price update must not change ARS even with an explicit BRL environment price');
  await send({...event,charge:{...event.charge,amount_value:'79.90',amount_currency:'ARS'}});assert.equal(grants.length,3);assert.equal(grants.at(-1).receipt.amountValue,79.9);
  process.env.NUVEMSHOP_ONE_TIME_PRICE='79.90';
  await send({...event,charge:{...event.charge,amount_value:'79.99'}});assert.equal(grants.length,4,'a legacy BRL environment setting must not discard current payments');assert.equal(grants.at(-1).receipt.amountValue,79.99);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));if(previous===undefined)delete process.env.NUVEMSHOP_ONE_TIME_PRICE;else process.env.NUVEMSHOP_ONE_TIME_PRICE=previous;}
});
