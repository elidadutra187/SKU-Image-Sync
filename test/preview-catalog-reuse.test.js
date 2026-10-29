import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {createSyncRouter} from '../routes/sync.js';
import {setStoreSession} from '../services/session.js';
import {deleteUploadSession} from '../services/uploadSessions.js';

async function runPreview(client,names) {
  const app=express();app.use('/sync',createSyncRouter({clientForStore:async()=>client,access:{status:async()=>({paid:false,demoUsed:false})}}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  let cookie;setStoreSession({setHeader(n,v){cookie=v.split(';')[0];}},'111');
  const form=new FormData();form.append('inputMode','folder');
  names.forEach(n=>form.append('images',new Blob(['photo']),n));
  form.append('manifest',JSON.stringify(names.map(n=>({path:'fotos/'+n}))));
  try {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/sync/preview`,{method:'POST',headers:{cookie},body:form});
    const data=await response.json();if(data.sessionId)await deleteUploadSession(data.sessionId);
    return {status:response.status,...data};
  } finally {server.closeAllConnections();await new Promise(r=>server.close(r));}
}

test('preview reuses catalog products and images instead of one API call per group',async()=>{
  const catalog=Array.from({length:41},(_,i)=>({id:i+1,name:`Piso Modelo ${i+1}`,variants:[{sku:`S${i+1}`}],
    images:[{id:100+i,src:`https://cdn.example/${i+1}.jpg`,position:1}]}));
  const calls={product:0,images:0};
  const client={getProducts:async()=>catalog,
    getProduct:async()=>{calls.product++;throw new Error('should not be called');},
    getProductImages:async()=>{calls.images++;throw new Error('should not be called');}};
  const result=await runPreview(client,catalog.map(p=>`${p.name}.jpg`));
  assert.equal(result.status,200);
  assert.equal(result.items.length,41);
  assert.deepEqual(calls,{product:0,images:0});
  assert.deepEqual(result.items[0].remoteImages,[{id:100,src:'https://cdn.example/1.jpg',position:1}]);
});

test('preview still fetches images when the catalog listing has none (Yampi)',async()=>{
  const catalog=[{id:7,name:'Piso Azul',variants:[{sku:'001'}]}];
  let imageCalls=0;
  const client={getProducts:async()=>catalog,getProduct:async()=>{throw new Error('should not be called');},
    getProductImages:async()=>{imageCalls++;return [{id:9,src:'https://cdn.example/a.jpg',position:1}];}};
  const result=await runPreview(client,['Piso Azul.jpg']);
  assert.equal(result.status,200);
  assert.equal(imageCalls,1);
  assert.equal(result.items[0].remoteImages[0].id,9);
});
