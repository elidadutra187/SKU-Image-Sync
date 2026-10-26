import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {imageGroupName,normalizeName} from '../services/productMatching.js';
const html=await fs.readFile('public/index.html','utf8');
const runtime=(await fs.readFile('public/app.js','utf8')).replace(/^import .*;\r?\n/gm,'');
for(const blocked of [true,false])test(`authenticated store UI and photo selection, billing blocked=${blocked}`,async()=>{
 const dom=new JSDOM(html,{url:'https://example.test/?connected=1',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{t:x=>x,imageGroupName,normalizeName});
 w.fetch=async url=>({ok:true,json:async()=>url==='/auth/status'?{connected:true,storeId:'5255436',platform:'nuvemshop',apiAvailable:!blocked,paymentRequired:blocked}:{paid:false,demoUsed:false,demoBatches:1,demoBatchesRemaining:1,demoImages:10,purchaseConfigured:false}});
 try{
 w.eval(runtime);await new Promise(resolve=>setTimeout(resolve,15));
 assert.equal(w.document.querySelector('#connect').hidden,true);
 assert.match(w.document.querySelector('#connection').textContent,/5255436/);
 assert.equal(w.document.querySelector('#access').hidden,false);
 assert.match(w.document.querySelector('#access').textContent,/79,90/);
 const input=w.document.querySelector('#images');
 Object.defineProperty(input,'files',{value:[new w.File(['image'],'Piso_01.jpg',{type:'image/jpeg'})]});
 input.dispatchEvent(new w.Event('change'));
 assert.equal(w.document.querySelector('#preview').disabled,blocked);
 if(blocked){assert.equal(w.document.querySelector('#connectionIssue').hidden,false);assert.match(w.document.querySelector('#message').textContent,/pagamento/i);}
 else assert.match(w.document.querySelector('#message').textContent,/Encontrar produtos/);
 }finally{w.close();}
});
