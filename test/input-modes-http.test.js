import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createSyncRouter} from '../routes/sync.js';
import {setStoreSession} from '../services/session.js';
import {deleteUploadSession} from '../services/uploadSessions.js';
test('all three entry points produce correct products and CSV never falls back to a different filename match',async()=>{
 const catalog=[{id:1,name:'Piso Azul',variants:[{sku:'001'}]},{id:2,name:'Piso Verde',variants:[{sku:'002'}]}];
 const client={getProducts:async()=>catalog,getProduct:async id=>catalog.find(p=>p.id===Number(id)),getProductImages:async()=>[]};
 const app=express();app.use('/sync',createSyncRouter({clientForStore:async()=>client,access:{status:async()=>({paid:false,demoUsed:false})}}));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const url=`http://127.0.0.1:${server.address().port}/sync/preview`;
 let cookie;setStoreSession({setHeader(n,v){cookie=v.split(';')[0];}},'111');const ids=[];
 async function preview(mode,names,csv,paths){const f=new FormData();f.append('inputMode',mode);names.forEach(n=>f.append('images',new Blob(['photo']),n));
 // Explicit manifest preserves the merchant filename, as the browser does.
 f.append('manifest',JSON.stringify(names.map((n,i)=>({path:paths?.[i]||n}))));if(csv)f.append('csv',new Blob([csv]),'map.csv');
 const r=await fetch(url,{method:'POST',headers:{cookie},body:f});const data=await r.json();if(data.sessionId)ids.push(data.sessionId);return{status:r.status,...data};}
 try {
  for(const mode of ['images','folder']){const names=['Piso Azul_01.jpg','Piso Verde_01.jpg'];const p=await preview(mode,names,null,mode==='folder'?names.map(n=>'fotos/'+n):null);assert.equal(p.status,200);assert.deepEqual(p.items.map(x=>x.product.id),[1,2]);}
  const csv=await preview('csv',['camera.jpg','Piso Verde.jpg'],'sku;arquivo\n001;camera.jpg\n001;Piso Verde.jpg');assert.equal(csv.status,200);assert.equal(csv.items.length,1);assert.equal(csv.items[0].product.id,1);assert.equal(csv.items[0].localImages.length,2);
  const unknown=await preview('csv',['Piso Verde.jpg'],'sku,arquivo\n999,Piso Verde.jpg');assert.equal(unknown.status,200);assert.equal(unknown.items[0].product,null);
  const missing=await preview('csv',['camera.jpg'],'sku,arquivo\n001,ausente.jpg');assert.equal(missing.status,400);assert.match(missing.error,/ausente.jpg/);
 }finally{await Promise.all(ids.map(deleteUploadSession));server.closeAllConnections();await new Promise(r=>server.close(r));}
});
