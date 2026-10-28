import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {imageGroupName,normalizeName} from '../services/productMatching.js';
test('three exclusive modes clear prior preview and keep CSV isolated from images and folder',async()=>{
 const html=await fs.readFile('public/index.html','utf8');
 const runtime=(await fs.readFile('public/app.js','utf8')).replace(/^import .*;\r?\n/gm,'');
 const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only'}),w=dom.window;
 Object.assign(w,{t:x=>x,imageGroupName,normalizeName});
 w.fetch=async url=>({ok:true,json:async()=>url==='/auth/status'?{connected:true,storeId:'123',apiAvailable:true}:{paid:false,demoUsed:false,demoBatches:1,demoBatchesRemaining:1,demoImages:10}});
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 try{w.eval(runtime+`;window.previewFixture=()=>{state.session='fixture';state.items=[12,8,3].map((n,i)=>({sku:String(i),status:'ok',product:{id:i+1,name:'Produto '+i},sourceFolder:'grupo '+i,localImages:Array.from({length:n},(_,j)=>({previewUrl:'photo.jpg',originalName:'foto'+j})),remoteImages:[]}));state.selection=new Set(['0','1','2']);renderItems();};window.selectedFixture=()=>selected();`);await new Promise(r=>setTimeout(r,15));const d=w.document;
  const modes=[...d.querySelectorAll('[name="inputMode"]')];assert.equal(modes.length,3);
  w.eval("renderProgress({status:'running',dryRun:false,progress:{total:4,completed:2,uploaded:3,errors:1}})");
  assert.equal(d.getElementById('uploadProgress').value,50);assert.match(d.getElementById('progressText').textContent,/2 de 4/);
  assert.match(d.getElementById('progressStats').textContent,/3/);
  w.eval("renderProgress({status:'completed',dryRun:false,progress:{total:4,completed:4},result:{stats:{uploaded:7,errors:1,skipped:0}}})");
  assert.equal(d.getElementById('uploadProgress').value,100);assert.match(d.getElementById('progressTitle').textContent,/com erros/);
  w.eval("renderProgress({status:'failed',dryRun:false,progress:{total:4,completed:2}})");
  assert.match(d.getElementById('progressTitle').textContent,/interrompido/);assert.equal(d.getElementById('uploadProgress').value,50);
  w.previewFixture();assert.equal(d.querySelectorAll('.photos img').length,10);assert.equal(d.getElementById('reviewPage').options.length,3);
  d.getElementById('nextPage').click();assert.equal(d.querySelectorAll('.photos img').length,10);
  const checkbox=d.querySelector('[data-select]');checkbox.checked=false;checkbox.dispatchEvent(new w.Event('change'));
  d.getElementById('previousPage').click();assert.equal(d.querySelector('[data-select]').checked,false);assert.deepEqual([...w.selectedFixture()],['1','2']);
  const size=d.getElementById('reviewPageSize');size.value='20';size.dispatchEvent(new w.Event('change'));assert.equal(d.querySelectorAll('.photos img').length,20);assert.equal(d.getElementById('reviewPage').options.length,2);
  function mode(value){const x=modes.find(x=>x.value===value);x.checked=true;x.dispatchEvent(new w.Event('change'));}
  function files(id,names){const input=d.getElementById(id);Object.defineProperty(input,'files',{configurable:true,value:names.map(n=>new w.File(['image'],n))});input.dispatchEvent(new w.Event('change'));}
  files('images',['Piso_01.jpg']);assert.equal(d.getElementById('preview').disabled,false);
  mode('folder');assert.equal(d.getElementById('preview').disabled,true);assert.equal(d.getElementById('imagesPanel').hidden,true);assert.equal(d.getElementById('folderPanel').hidden,false);
  mode('csv');files('csvImages',['random.jpg']);assert.equal(d.getElementById('preview').disabled,true);
  files('csv',['mapa.csv']);assert.equal(d.getElementById('preview').disabled,false);
  mode('images');assert.equal(d.getElementById('preview').disabled,true);assert.equal(d.getElementById('csvPanel').hidden,true);
 }finally{w.close();}
});
