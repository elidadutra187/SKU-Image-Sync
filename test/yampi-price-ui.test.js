import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import * as paymentModule from '../public/yampi-payment-ui.mjs';

for(const configured of [false,true])test(`authenticated Yampi price is consistent throughout the access card, MP configured=${configured}`,async()=>{
 const dom=new JSDOM(await fs.readFile('public/index.html','utf8'),{url:'https://example.test/?platform=nuvemshop',runScripts:'outside-only'}),w=dom.window;
 const access={paid:false,demoUsed:true,demoBatches:1,demoBatchesRemaining:0,demoImages:10,oneTimePriceCents:7990,paymentProvider:configured?'mercadopago':'pending',purchaseMode:'mercadopago_once',purchaseConfigured:configured};
 Object.assign(w,{t:x=>x,imageGroupName:x=>x,normalizeName:x=>x,fixturePaymentModule:paymentModule});
 w.fetch=async url=>Response.json(url==='/auth/status'?{connected:true,storeId:'yampi:shop',platform:'yampi',apiAvailable:true}:access);
 try{
  const runtime=(await fs.readFile('public/app.js','utf8')).replace(/^import .*;\r?\n/gm,'').replace("await import('/yampi-payment-ui.mjs')",'window.fixturePaymentModule');
  w.eval(runtime);await new Promise(resolve=>setTimeout(resolve,25));
  const card=w.document.querySelector('#access').textContent;
  assert.match(w.document.querySelector('#accessPlan').textContent,/79,90/);
  assert.doesNotMatch(card,/79,99|Nuvemshop/);
  if(configured)assert.match(w.document.querySelector('#purchasePending').textContent,/Mercado Pago/);
 }finally{w.close();}
});
