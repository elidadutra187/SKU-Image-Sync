import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {imageGroupName,normalizeName} from '../services/productMatching.js';
import * as csvMapping from '../services/csvMapping.js';
const html=await fs.readFile('public/index.html','utf8');
const runtime=(await fs.readFile('public/app.js','utf8')).replace(/^import .*;\r?\n/gm,'');
const adapter=await fs.readFile('public/billing-notice-adapter.js','utf8');
const tick=()=>new Promise(r=>setTimeout(r,20));
const good={success:true,storeId:'1068328',allowed:true,accessReason:'trial_active',accessStatus:'trial_active',trialActive:true,purchaseMode:'platform_monthly',demoUsed:true,demoBatchesRemaining:null};
const connection={connected:true,storeId:'1068328',platform:'nuvemshop',apiAvailable:true,paymentRequired:false};
function setup(fetch){const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'outside-only'}),w=dom.window;Object.assign(w,{t:x=>x,imageGroupName,normalizeName,...csvMapping,fetch});return {dom,w};}

test('adapter never calculates finance from partial or contradictory legacy flags',()=>{
 const {w}=setup();let current;w.ElunaBillingNotice={update:d=>current=d};w.eval(adapter);
 try{
  w.BillingNoticeAdapter.update({connected:true,storeId:'1068328',access:good});
  assert.equal(current.allowed,true,'backend trial decision wins over legacy demoUsed');
  w.BillingNoticeAdapter.update({connected:true,storeId:'1068328',access:{purchaseMode:'platform_monthly'}});
  assert.equal(current.allowed,false);assert.equal(current.status,'unverified');
  w.BillingNoticeAdapter.update({connected:false,storeId:null});
  assert.equal(current.storeId,null,'disconnect clears prior store identity');
 }finally{w.close();}
});

test('retry refreshes app authorization and old responses cannot overwrite a newer store',async()=>{
 let resolveOld,calls=0;const options=[];
 const {w}=setup(async(url,opts)=>{
  options.push(opts);
  if(url==='/auth/status')return {ok:true,json:async()=>({...connection,storeId:calls>=1?'222':'1068328'})};
  if(url==='/sync/access'){
   if(++calls===1)return new Promise(r=>resolveOld=r);
   return {ok:true,json:async()=>({...good,storeId:'222'})};
  }
  return {ok:true,json:async()=>({running:false})};
 });
 let detail;w.ElunaBillingNotice={update:d=>detail=d};w.eval(adapter);
 try{
  w.eval(runtime+';window.__state=state;');await tick();
  w.dispatchEvent(new w.CustomEvent('eluna:billing-retry'));await tick();
  assert.equal(w.__state.storeId,'222');assert.equal(w.__state.access?.allowed,true);
  resolveOld({ok:true,json:async()=>({...good,allowed:false,accessStatus:'payment_unconfirmed'})});await tick();
  assert.equal(w.__state.storeId,'222');assert.equal(detail.allowed,true);
  assert.equal(w.__state.access?.allowed,true);
  assert.ok(options.every(o=>o.cache==='no-store'));
 }finally{w.close();}
});

test('a failed recheck clears previous authorization and displays verification unavailable',async()=>{
 let failed=false;
 const {w}=setup(async url=>({ok:!failed,json:async()=>url==='/auth/status'?connection:url==='/sync/access'?good:{running:false}}));
 let detail;w.ElunaBillingNotice={update:d=>detail=d};w.eval(adapter);
 try{
  w.eval(runtime+';window.__state=state;');await tick();failed=true;
  w.dispatchEvent(new w.CustomEvent('eluna:billing-retry'));await tick();
  assert.equal(w.__state.access,null);assert.equal(detail.status,'unverified');
  assert.equal(w.document.getElementById('send').disabled,true);
 }finally{w.close();}
});

test('monthly trial enables send with more than ten images, while suspension still blocks it',async()=>{
 let access={...good,demoUsed:false,maxImages:null};
 const {w}=setup(async url=>({ok:true,json:async()=>url==='/auth/status'?connection:url==='/sync/access'?access:{running:false}}));
 w.ElunaBillingNotice={update:()=>{}};w.eval(adapter);
 try{
  w.eval(runtime+`;window.seed=()=>{state.session='preview';state.items=[{sku:'a',product:{id:1},localImages:Array.from({length:20},()=>({}))}];state.selection=new Set(['a']);updateActions();};`);
  await tick();w.seed();assert.equal(w.document.getElementById('send').disabled,false);
  access={...access,allowed:false,accessStatus:'suspended',accessReason:'platform_blocked',platformSuspended:true};
  w.dispatchEvent(new w.CustomEvent('eluna:billing-retry'));await tick();
  assert.equal(w.document.getElementById('send').disabled,true);
 }finally{w.close();}
});

test('reconnection and restored browser cache reverify instead of reusing a financial snapshot',async()=>{
 let authCalls=0;
 const {w}=setup(async url=>{if(url==='/auth/status')authCalls++;return {ok:true,json:async()=>url==='/auth/status'?connection:url==='/sync/access'?good:{running:false}};});
 w.ElunaBillingNotice={update:()=>{}};w.eval(adapter);
 try{
  w.eval(runtime);await tick();assert.equal(authCalls,1);
  w.dispatchEvent(new w.Event('online'));await tick();assert.equal(authCalls,2);
  w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));await tick();assert.equal(authCalls,3);
 }finally{w.close();}
});

for(const [lang,title] of [['pt-BR','Acesso restrito pela plataforma'],['en','Access restricted by the platform'],['es','Acceso restringido por la plataforma']])test(`API restriction respects the trial ledger without attributing an app debt (${lang})`,async()=>{
 const {w}=setup(async url=>({ok:true,json:async()=>url==='/auth/status'?{...connection,apiAvailable:false,paymentRequired:true,accessDecision:{allowed:false,reason:'platform_api_restricted',status:'platform_restricted'}}:url==='/sync/access'?good:{running:false}}));
 try{
  w.document.documentElement.lang=lang;
  w.eval(await fs.readFile('public/billing-notice.js','utf8'));w.eval(adapter);w.eval(runtime);
  await tick();
  assert.equal(w.document.querySelector('[data-billing-title]').textContent,title);
  assert.equal(w.document.getElementById('send').disabled,true);
  assert.equal(w.document.getElementById('connectionIssue').hidden,false);
  assert.doesNotMatch(w.document.getElementById('connectionIssue').textContent,/regularizar.*pagamento do aplicativo|informa uma restrição de pagamento/);
 }finally{w.close();}
});
