import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';
import {imageGroupName,normalizeName} from '../services/productMatching.js';
import * as csvMapping from '../services/csvMapping.js';

async function openApp() {
  const html=await fs.readFile('public/index.html','utf8');
  const runtime=(await fs.readFile('public/app.js','utf8')).replace(/^import .*;\r?\n/gm,'');
  const dom=new JSDOM(html,{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,sent=[];
  const captured={rows:null};
  Object.assign(w,{t:x=>x,imageGroupName,normalizeName,...csvMapping,
    buildCsv:rows=>{captured.rows=rows;return csvMapping.buildCsv(rows);}});
  w.fetch=async(url,options)=>{
    if(url==='/sync/preview'){sent.push(options.body);return {ok:false,status:400,json:async()=>({success:false,error:'fixture'})};}
    return {ok:true,json:async()=>url==='/auth/status'?{connected:true,storeId:'123',apiAvailable:true}:{paid:false,demoUsed:false,demoBatches:1,demoBatchesRemaining:1,demoImages:10}};
  };
  w.HTMLElement.prototype.scrollIntoView=()=>{};
  w.eval(runtime);await new Promise(r=>setTimeout(r,20));
  const d=w.document;
  const mode=value=>{const x=[...d.querySelectorAll('[name="inputMode"]')].find(x=>x.value===value);x.checked=true;x.dispatchEvent(new w.Event('change'));};
  const setFiles=(id,files)=>{const input=d.getElementById(id);Object.defineProperty(input,'files',{configurable:true,value:files});input.dispatchEvent(new w.Event('change'));};
  return {w,d,sent,captured,mode,setFiles};
}

test('CSV mode splits a large spreadsheet into batches and sends only that batch rows and photos',async()=>{
  const {w,d,sent,captured,mode,setFiles}=await openApp();
  try {
    const names=Array.from({length:25},(_,i)=>[`P${i+1}-a.JPG`,`P${i+1}-b.jpg`]).flat();
    mode('csv');setFiles('csvImages',names.map(n=>new w.File(['image'],n)));
    assert.match(d.getElementById('fileCount').textContent,/Selecione o CSV para organizar os lotes/);
    // Lowercase filenames in the CSV still match, as on the server.
    const text='sku;arquivo\n'+Array.from({length:25},(_,i)=>`S${i+1};p${i+1}-a.jpg\nS${i+1};P${i+1}-b.jpg`).join('\n');
    setFiles('csv',[{name:'mapa.csv',text:async()=>text}]);await new Promise(r=>setTimeout(r,0));
    assert.equal(d.getElementById('batchOptions').hidden,false);
    assert.equal(d.getElementById('batchPage').options.length,3);
    assert.match(d.getElementById('fileCount').textContent,/50 foto\(s\) selecionada\(s\), em 25 grupo\(s\)/);
    const page=d.getElementById('batchPage');page.value='1';page.dispatchEvent(new w.Event('change'));
    d.getElementById('preview').click();await new Promise(r=>setTimeout(r,0));
    assert.equal(sent.length,1);
    assert.deepEqual([...new Set(captured.rows.map(row=>row.sku))],Array.from({length:10},(_,i)=>`S${i+11}`));
    assert.equal(sent[0].getAll('images').length,20);
    assert.equal(sent[0].get('inputMode'),'csv');
  } finally {w.close();}
});

test('invalid CSV keeps preview disabled and shows the reason',async()=>{
  const {w,d,mode,setFiles}=await openApp();
  try {
    mode('csv');setFiles('csvImages',[new w.File(['image'],'a.jpg')]);
    setFiles('csv',[{name:'mapa.csv',text:async()=>'codigo;foto\n1;a.jpg'}]);await new Promise(r=>setTimeout(r,0));
    assert.equal(d.getElementById('preview').disabled,true);
    assert.match(d.getElementById('message').textContent,/colunas sku e arquivo/);
  } finally {w.close();}
});

test('heavy batches show an upload time notice and light ones do not',async()=>{
  const {w,d,setFiles}=await openApp();
  try {
    const photo=(name,mb)=>({name,size:mb*1024*1024,webkitRelativePath:''});
    setFiles('images',[photo('Piso Azul_01.jpg',9),photo('Piso Verde_01.jpg',9)]);
    assert.equal(d.getElementById('batchWeight').hidden,true);
    setFiles('images',Array.from({length:6},(_,i)=>[photo(`Piso ${i}_01.jpg`,9.5),photo(`Piso ${i}_02.jpg`,9.5)]).flat());
    assert.equal(d.getElementById('batchWeight').hidden,false);
    assert.match(d.getElementById('batchWeight').textContent,/somam 114 MB/);
  } finally {w.close();}
});

test('batch CSV round-trips through the server parser, including quoted names',()=>{
  const rows=[{sku:'001',filename:'Piso; azul.jpg'},{sku:'002',filename:'foto "verde".jpg'},{sku:'002',filename:'pasta/b.jpg'}];
  const parsed=[...csvMapping.parseCsvAssignments(csvMapping.buildCsv(rows)).values()];
  assert.deepEqual(parsed,rows);
});
