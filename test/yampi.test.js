import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {setStoreSession,readStoreSession} from '../services/session.js';
import {createCommercialAccess} from '../services/commercialAccess.js';
import fs from 'node:fs/promises';
import {JSDOM} from 'jsdom';

test('platform selection connects Yampi and does not describe Nuvemshop billing',async()=>{
  const html=await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const dom=new JSDOM(html,{url:'https://example.com/?platform=yampi',runScripts:'outside-only'});
  const {window}=dom;window.fetch=async url=>Response.json(url==='/auth/status'?{connected:false}:{success:true});
  const script=(await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'');
  window.t=s=>s;window.imageGroupName=s=>s;window.normalizeName=s=>s;window.eval(script);
  await new Promise(r=>setTimeout(r,20));
  assert.equal(window.document.getElementById('connect').getAttribute('href'),'/auth/yampi/install');
  const selector=window.document.getElementById('platform');assert.ok(selector);assert.equal(selector.value,'yampi');
  selector.value='nuvemshop';selector.dispatchEvent(new window.Event('change'));
  assert.equal(window.document.getElementById('connect').getAttribute('href'),'/auth/install');dom.window.close();
});

test('a Yampi URL preference cannot replace native Nuvemshop payment or load external payment UI',async()=>{
 const dom=new JSDOM(await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://example.com/?platform=yampi',runScripts:'outside-only'});
 const {window}=dom,calls=[],confirmations=[];
 const access={success:true,paid:false,demoUsed:true,demoBatchesRemaining:0,demoBatches:1,demoImages:10,paymentProvider:'nuvemshop',purchaseConfigured:true};
 window.fetch=async url=>{calls.push(String(url));return Response.json(url==='/auth/status'?{connected:true,storeId:'123',platform:'nuvemshop'}:url==='/sync/purchase'?{status:'pending'}:access);};
 window.t=s=>s;window.imageGroupName=s=>s;window.normalizeName=s=>s;window.confirm=text=>{confirmations.push(text);return true;};
 try{
  window.eval((await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,''));
  await new Promise(r=>setTimeout(r,25));window.document.getElementById('purchase').click();await new Promise(r=>setTimeout(r,25));
  assert.equal(calls.filter(p=>p==='/sync/purchase').length,1);assert.ok(calls.every(p=>!p.includes('/yampi/billing')&&!p.includes('mercadopago')));
  assert.equal(confirmations.length,1);assert.match(confirmations[0],/Nuvemshop/);assert.doesNotMatch(window.document.body.textContent,/Mercado Pago/);
 }finally{dom.window.close();}
});

test('exhausted Yampi demo does not claim a free batch is still available',async()=>{
  const dom=new JSDOM(await fs.readFile(new URL('../public/index.html',import.meta.url),'utf8'),{url:'https://example.com/?platform=yampi',runScripts:'outside-only'});
  const {window}=dom;window.fetch=async url=>Response.json(url==='/auth/status'?{connected:true,storeId:'yampi:teste',platform:'yampi'}
    :{success:true,paid:false,demoUsed:true,demoBatchesRemaining:0,demoBatches:1,demoImages:10,paymentProvider:'pending',purchaseConfigured:false});
  window.t=s=>s;window.imageGroupName=s=>s;window.normalizeName=s=>s;
  window.eval((await fs.readFile(new URL('../public/app.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,''));
  await new Promise(r=>setTimeout(r,20));
  try{const access=window.document.getElementById('access').textContent;assert.ok(!access.includes('permanece disponível'));assert.ok(!window.document.getElementById('accessText').textContent.includes('R$79,90'));assert.equal(window.document.getElementById('purchase').hidden,true);}
  finally{dom.window.close();}
});

test('valid OAuth states are consumed once and merchant mismatch never saves tokens',async()=>{
  const express=(await import('express')).default;
  const {createYampiAuthRouter}=await import('../routes/yampiAuth.js');let unused=true,saved=[];
  const app=express();app.use(createYampiAuthRouter({repository:{consumeState:async()=>{if(!unused)return null;unused=false;return 'verifier';},save:async(...args)=>saved.push(args)},
    exchange:async()=>({merchant:'shop-one',access_token:'access',refresh_token:'refresh'}),verify:async()=>({connected:true})}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const url=`http://127.0.0.1:${server.address().port}/callback?code=code&state=state&merchant=shop-one`;
  const options={redirect:'manual',headers:{cookie:'image_sync_yampi_oauth=browser'}};
  try{const res=await fetch(url,options);assert.equal(res.status,302);assert.equal(saved[0][0],'shop-one');
    assert.match(res.headers.get('set-cookie'),/sku_image_sync_store/);
    assert.equal((await fetch(url,options)).status,400);assert.equal(saved.length,1);
    unused=true;app.use((e,req,res,next)=>res.status(400).send('invalid'));
    assert.equal((await fetch(url.replace('merchant=shop-one','merchant=other'),options)).status,400);assert.equal(saved.length,1);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('signed Yampi sessions stay distinct from Nuvemshop numeric stores',()=>{
  let cookie;setStoreSession({setHeader(_,v){cookie=v;}},'yampi:loja-teste');
  assert.equal(readStoreSession({headers:{cookie}}),'yampi:loja-teste');
  setStoreSession({setHeader(_,v){cookie=v;}},'yampi:../other');
  assert.equal(readStoreSession({headers:{cookie}}),null);
});

test('Yampi access never advertises or invokes Nuvemshop payment',async()=>{
  const access=createCommercialAccess({status:async()=>({paid:false,demoBatchesUsed:0})});
  const state=await access.status('yampi:teste');
  assert.equal(state.paymentProvider,'pending');assert.equal(state.purchaseConfigured,false);
});

test('PKCE and authenticated ciphertext do not expose credentials',async()=>{
  const {createPkce,encrypt,decrypt}=await import('../services/yampiStore.js');
  process.env.SESSION_SECRET='test-secret-yampi';
  const pkce=createPkce();assert.equal(pkce.verifier.length,128);
  assert.equal(pkce.challenge,crypto.createHash('sha256').update(pkce.verifier).digest('base64url'));
  const sealed=encrypt({access_token:'private-token',refresh_token:'refresh-private'});
  assert.ok(!sealed.includes('private'));assert.deepEqual(decrypt(sealed),{access_token:'private-token',refresh_token:'refresh-private'});
  assert.throws(()=>decrypt(sealed.slice(0,-5)+'AAAAA'));
});

test('catalog preserves variation destinations and paginates with OAuth headers',async()=>{
  const {YampiClient}=await import('../services/yampi.js');let calls=[];
  const client=new YampiClient({alias:'teste',clientId:'own-app',token:async()=> 'token',fetchImpl:async(url,options)=>{
    calls.push({url,options});const page=new URL(url).searchParams.get('page');
    return Response.json(url.includes('/products')?{data:[{id:5,name:'Camiseta'}],meta:{pagination:{total_pages:1}}}
      :{data:page==='1'?[{id:101,product_id:5,sku:'AZ',title:'Camiseta Azul',variations:[{value:'Azul'}]}]
        :[{id:102,product_id:5,sku:'VD',title:'Camiseta Verde',variations:[{value:'Verde'}]}],meta:{pagination:{total_pages:2}}});
  }});
  client.wait=async()=>{};
  const catalog=await client.getProducts();assert.deepEqual(catalog.map(p=>p.id),[101,102]);
  assert.equal(catalog[0].variants[0].sku,'AZ');
  assert.equal(calls.length,3);assert.equal(calls[0].options.headers.Authorization,'Bearer token');
  assert.equal(calls[0].options.headers['X-Partner-Client-ID'],'own-app');
  const {matchProduct}=await import('../services/productMatching.js');
  assert.equal(matchProduct('Camiseta.jpg',catalog).status,'ambiguous');
  assert.equal(matchProduct('AZ.jpg',catalog).product.id,101);
});

test('uploads use temporary URLs and do not retry ambiguous image creation',async()=>{
  const {YampiClient}=await import('../services/yampi.js');let requests=[];
  const client=new YampiClient({alias:'teste',clientId:'app',token:async()=> 'token',media:{create:async()=> 'https://example.com/temporary/random'},fetchImpl:async(url,options)=>{
    requests.push({url,options});return Response.json({data:[{id:88,large:{url:'https://example.com/image.png'},order:1}]});
  }});
  client.wait=async()=>{};
  assert.equal((await client.uploadProductImage(101,{attachment:Buffer.from('photo').toString('base64'),filename:'photo.png'})).id,88);
  assert.deepEqual(JSON.parse(requests[0].options.body),{upload_option:'resize',images:[{url:'https://example.com/temporary/random'}]});
  assert.match(requests[0].url,/catalog\/skus\/101\/images$/);
  let attempts=0;client.fetchImpl=async()=>{attempts++;return new Response('private diagnostic',{status:503});};
  await assert.rejects(()=>client.uploadProductImage(101,{attachment:'a',filename:'a.png'}),/Yampi API 503/);
  assert.equal(attempts,1);
});

test('read requests are throttled and recover from 429 without retrying mutations',async()=>{
  const {YampiClient}=await import('../services/yampi.js');let attempts=0,waits=[];
  const client=new YampiClient({alias:'teste',clientId:'app',token:async()=> 'token',fetchImpl:async()=>{
    attempts++;return attempts===1?new Response('',{status:429,headers:{'retry-after':'3'}}):Response.json({data:[]});
  }});client.wait=async ms=>waits.push(ms);
  assert.deepEqual(await client.request('/catalog/products'),{data:[]});assert.equal(attempts,2);assert.equal(waits.length,2);assert.ok(waits[1]>=3000);
});

test('callback with missing state cannot save tokens or establish a session',async()=>{
  const express=(await import('express')).default;
  const {createYampiAuthRouter}=await import('../routes/yampiAuth.js');let exchanges=0;
  const app=express();app.use(createYampiAuthRouter({repository:{consumeState:async()=>null},exchange:async()=>{exchanges++;}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{const res=await fetch(`http://127.0.0.1:${server.address().port}/callback?code=rogue&merchant=other`,{redirect:'manual'});
    assert.equal(res.status,400);assert.equal(exchanges,0);assert.equal(res.headers.get('set-cookie'),null);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
