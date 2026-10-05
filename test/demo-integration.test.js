import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import express from 'express';
import {createSyncRouter} from '../routes/sync.js';
import {createCommercialAccess} from '../services/commercialAccess.js';
import {setStoreSession} from '../services/session.js';
import {deleteUploadSession} from '../services/uploadSessions.js';
import NuvemshopClient from '../services/nuvemshop.js';
import ImageSyncService from '../services/imageSync.js';

const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=','base64');
const colors=['Azul','Verde','Vermelha','Amarela','Branca','Preta','Roxa','Rosa','Cinza','Laranja','Bege'];

for(const mode of ['name','sku-folder']) {
  test(`HTTP import by ${mode}: 10 products, simulation, 11 rejected and demo cannot repeat`,async(t)=>{
    const directory=await fs.mkdtemp(path.join(os.tmpdir(),'imagem-demo-'));
    const sessions=[];
    const products=colors.map((color,index)=>({id:index+1,name:`Camiseta ${color}`,variants:[{sku:`CAM-${String(index+1).padStart(3,'0')}`}]}));
    const uploaded=[];
    const client={
      async getProducts(){return products;},
      async getProduct(id){const product=products.find(p=>String(p.id)===String(id));assert.ok(product);return product;},
      async getProductImages(){return [{id:100,src:'https://example.com/current.png',position:1}];},
      async uploadProductImage(id,payload){uploaded.push({id,...payload});return {id:1000+uploaded.length};},
      async deleteProductImage(){assert.fail('add mode must preserve current photos');},
      async delay(){},
    };
    t.mock.method(NuvemshopClient,'fromStore',async()=>client);
    let consumed=false,paid=false;
    const access=createCommercialAccess({
      async status(){return {paid,demoUsed:consumed};},
      async reserve(){if(consumed)return false;consumed=true;return true;},
    });
    const app=express();app.use(express.json());
    app.use('/sync',createSyncRouter({clientForStore:async()=>client,access,
      serviceFactory:options=>new ImageSyncService({...options,stateFile:path.join(directory,'state.json'),reportPath:path.join(directory,`${crypto.randomUUID()}.csv`)})}));
    const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
    const base=`http://127.0.0.1:${server.address().port}/sync`;
    const cookieFor=store=>{let cookie;setStoreSession({setHeader(name,value){cookie=value.split(';')[0];}},store);return cookie;};
    let headers={cookie:cookieFor(`test-${mode}`)};
    const preview=async(count)=>{
      const form=new FormData(),manifest=[];
      for(const product of products.slice(0,count)) {
        const filename=mode==='name'?`${product.name}_01.png`:'foto_01.png';
        form.append('images',new Blob([image],{type:'image/png'}),filename);
        manifest.push({path:mode==='name'?filename:`Fotos/${product.variants[0].sku} - Produto/${filename}`});
      }
      form.append('manifest',JSON.stringify(manifest));
      const response=await fetch(`${base}/preview`,{method:'POST',headers,body:form});
      assert.equal(response.status,200);
      const data=await response.json();sessions.push(data.sessionId);
      assert.equal(data.items.length,count);
      assert.ok(data.items.every(item=>item.status==='ok' && item.matchReason===(mode==='name'?'name':'sku')));
      assert.deepEqual(data.items.map(item=>item.product.id).sort((a,b)=>a-b),products.slice(0,count).map(p=>p.id));
      return data;
    };
    const run=(preview,dryRun=false)=>fetch(`${base}/session/${preview.sessionId}/run`,{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({dryRun,mode:'add',selectedSkus:preview.items.map(item=>item.sku)})});
    const completed=async(response)=>{
      assert.equal(response.status,202);const {jobId}=await response.json();
      for(let attempt=0;attempt<100;attempt++) {
        const {job}=await (await fetch(`${base}/job/${jobId}`,{headers})).json();
        if(job.status==='completed'){assert.equal(job.result.stats.errors,0);return job.result;}
        assert.notEqual(job.status,'failed');await new Promise(resolve=>setTimeout(resolve,10));
      }
      assert.fail('job did not complete');
    };
    try {
      const excessive=await preview(11);
      const blocked=await run(excessive);assert.equal(blocked.status,402);assert.match((await blocked.json()).error,/10/);
      assert.equal(consumed,false);assert.equal(uploaded.length,0);
      const first=await preview(10);
      await completed(await run(first,true));assert.equal(consumed,false);assert.equal(uploaded.length,0);
      const result=await completed(await run(first));assert.equal(consumed,true);assert.equal(result.stats.processed,10);assert.equal(uploaded.length,10);
      assert.deepEqual(uploaded.map(item=>Number(item.id)).sort((a,b)=>a-b),products.slice(0,10).map(p=>p.id));
      assert.ok(uploaded.every(item=>item.position===2));
      headers={cookie:cookieFor(`test-${mode}`)};
      const next=await preview(1);assert.equal((await run(next)).status,402);assert.equal(uploaded.length,10);
      const foreignHeaders={cookie:cookieFor('another-store'),'content-type':'application/json'};
      assert.equal((await fetch(`${base}/session/${next.sessionId}/run`,{method:'POST',headers:foreignHeaders,body:JSON.stringify({selectedSkus:next.items.map(i=>i.sku)})})).status,403);
      paid=true;await completed(await run(excessive));assert.equal(uploaded.length,11);
    } finally {
      server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
      for(const session of sessions)await deleteUploadSession(session);
      await fs.rm(directory,{recursive:true,force:true});
    }
  });
}
