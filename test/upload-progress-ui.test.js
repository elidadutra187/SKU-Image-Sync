import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {imageGroupName,normalizeName} from '../services/productMatching.js';
import * as csvMapping from '../services/csvMapping.js';
test('send shows live progress, preserves unknown network outcome and prevents duplicate send',async()=>{
 const html=await fs.readFile('public/index.html','utf8'),runtime=(await fs.readFile('public/app.js','utf8')).replace(/^import .*;\r?\n/gm,'');
 const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,d=w.document;
 Object.assign(w,{t:x=>x,imageGroupName,normalizeName,...csvMapping});w.HTMLElement.prototype.scrollIntoView=()=>{};w.confirm=()=>true;
 const later=w.setTimeout.bind(w);w.setTimeout=(f,n)=>later(f,Math.min(n,5));
 const access={paid:true,demoUsed:false,demoBatches:1,demoImages:10};let sent=0,polls=0,networkFails=true;
 w.fetch=async url=>{if(url.endsWith('/run')){sent++;return{ok:true,json:async()=>({jobId:'job-1'})};}
 if(url.includes('/job/')){polls++;if(networkFails)throw Error('offline');return{ok:true,json:async()=>({job:{status:'completed',dryRun:false,progress:{total:1,completed:1},result:{stats:{uploaded:2,errors:0,skipped:0}}}})};}
 return{ok:true,json:async()=>url==='/auth/status'?{connected:true,storeId:'111',apiAvailable:true}:url==='/sync/status'?{running:false}:access};};
 try{w.eval(runtime+`;window.seed=()=>{state.session='session';state.items=[{sku:'a',product:{id:1},localImages:[{},{}]}];state.selection=new Set(['a']);updateActions();};`);await new Promise(r=>setTimeout(r,15));w.seed();
 d.getElementById('send').click();await new Promise(r=>setTimeout(r,80));
 assert.equal(sent,1);assert.equal(polls,3);assert.equal(d.getElementById('progressPanel').hidden,false);assert.equal(d.getElementById('resumeProgress').hidden,false);assert.equal(d.getElementById('send').disabled,true);assert.notEqual(d.getElementById('uploadProgress').value,100);
 networkFails=false;d.getElementById('resumeProgress').click();await new Promise(r=>setTimeout(r,30));assert.equal(sent,1);assert.equal(d.getElementById('uploadProgress').value,100);assert.equal(d.getElementById('progressTitle').textContent,'Envio concluído');assert.equal(d.getElementById('send').disabled,true);
 }finally{w.close();}
});
