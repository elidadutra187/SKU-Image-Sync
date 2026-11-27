import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import {createBillingWebhook} from '../services/nativeBilling.js';

const period={from_date:'2026-11-22T03:00:00.000Z',to_date:'2026-12-16T03:00:00.000Z'};
const event={store_id:8534887,event:'charge/paid',app_id:33268,id:'ars-paid-fixture',charge:{id:'ars-paid-fixture',concept_code:'app-cost',amount_value:'10580.62',amount_currency:'ARS',...period}};
test('signed ARS monthly receipt uses the verified store contract instead of BRL price',async()=>{
 const verified=[],granted=[];
 const app=express();app.post('/',express.raw({type:'application/json'}),createBillingWebhook({mode:'platform_monthly',secret:'fixture',appId:'33268',price:'39.90',
  verifyMonthlyCurrency:async input=>{verified.push(input);return {verified:true,source:'official_subscription'};},
  isKnownStore:async()=>true,grantMonthly:async input=>granted.push(input)}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 async function send(payload,valid=true){const body=JSON.stringify(payload);return fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'content-type':'application/json','x-linkedstore-hmac-sha256':valid?crypto.createHmac('sha256','fixture').update(body).digest('hex'):'0'.repeat(64)},body});}
 try{
  assert.equal((await send(event,false)).status,401);assert.equal(verified.length,0);
  await send({...event,app_id:999});await send({...event,event:'charge/created'});
  assert.equal(verified.length,0);assert.equal(granted.length,0);
  const response=await send(event);assert.equal(response.status,200);
  assert.equal(granted.length,1);assert.equal(verified.length,1);
  assert.equal(granted[0].receipt.amountValue,10580.62);assert.equal(granted[0].receipt.amountCurrency,'ARS');
  assert.equal(granted[0].receipt.fromDate,period.from_date);assert.equal(granted[0].receipt.toDate,period.to_date);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('unavailable official ARS verification requests webhook retry without a grant',async()=>{
 let grants=0;const app=express();app.post('/',express.raw({type:'application/json'}),createBillingWebhook({mode:'platform_monthly',secret:'fixture',appId:'33268',price:'39.90',verifyMonthlyCurrency:async()=>{throw Error('temporary');},grantMonthly:async()=>grants++}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const body=JSON.stringify(event),response=await fetch('http://127.0.0.1:'+server.address().port,{method:'POST',headers:{'content-type':'application/json','x-linkedstore-hmac-sha256':crypto.createHmac('sha256','fixture').update(body).digest('hex')},body});assert.equal(response.status,503);assert.equal(grants,0);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
