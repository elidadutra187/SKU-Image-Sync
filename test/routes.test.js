import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import * as syncRoutes from '../routes/sync.js';
import {setStoreSession} from '../services/session.js';
import {createCommercialAccess} from '../services/commercialAccess.js';
test('guided import authenticates, resolves names, validates choices and enforces one demo', async () => {
  assert.equal(typeof syncRoutes.createSyncRouter,'function','guided import router is missing');
  let consumed=0, runs=0;
  const products=[{id:1,name:'Camiseta Azul',variants:[{sku:'AZ-123'}]},
    {id:2,name:'Camiseta Verde',variants:[{sku:'VD-123'}]}];
  const client={ async getProducts(){return products;}, async getProduct(id){
    const product=products.find(item=>String(item.id)===String(id)); if(!product)throw new Error('missing'); return product;
  },async getProductImages(){return [];}};
  const access=createCommercialAccess({async status(){return {paid:false,demoBatchesUsed:consumed};},
    async reserve(){if(consumed>=1)return false;consumed++;return true;}});
  const app=express(); app.use(express.json()); app.use('/sync',syncRoutes.createSyncRouter({
    clientForStore:async()=>client,access,
    serviceFactory:()=>({async run(){assert.equal(consumed,1);runs++;return {stats:{processed:1}};}})
  }));
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  const url=`http://127.0.0.1:${server.address().port}/sync`;
  let cookie; setStoreSession({setHeader(name,value){cookie=value.split(';')[0];}},'111');
  const headers={cookie};
  try {
    assert.equal((await fetch(`${url}/preview`,{method:'POST'})).status,401);
    assert.equal((await fetch(`${url}/add`,{method:'POST',headers})).status,410);
    const form=new FormData();
    form.append('images',new Blob(['image'],{type:'image/jpeg'}),'Camiseta Azul_01.jpg');
    form.append('images',new Blob(['image'],{type:'image/jpeg'}),'Camiseta Azul_02.jpg');
    form.append('images',new Blob(['image'],{type:'image/jpeg'}),'Camiseta Verde_01.jpg');
    const preview=await (await fetch(`${url}/preview`,{method:'POST',headers,body:form})).json();
    assert.equal(preview.success,true); assert.equal(preview.items.length,2);
    assert.equal(preview.items[0].product.name,'Camiseta Azul');
    assert.equal(preview.items[0].localImages.length,2);
    const foreign=await fetch(`${url}/session/${preview.sessionId}/match`,{method:'POST',
      headers:{...headers,'content-type':'application/json'},body:JSON.stringify({groupId:preview.items[0].sku,productId:999})});
    assert.equal(foreign.status,400);
    const run=async(id,body)=>fetch(`${url}/session/${id}/run`,{method:'POST',
      headers:{...headers,'content-type':'application/json'},body:JSON.stringify(body)});
    assert.equal((await run(preview.sessionId,{dryRun:'false'})).status,400);
    const manualForm=new FormData();manualForm.append('individual','true');
    for(let n=1;n<=11;n++)manualForm.append('images',new Blob(['image-'+n],{type:'image/jpeg'}),'IMG_'+n+'.jpg');
    const manual=await (await fetch(url+'/preview',{method:'POST',headers,body:manualForm})).json();
    assert.equal(manual.items.length,11);assert.ok(manual.items.every(item=>!item.product));
    for(const item of manual.items){const matched=await (await fetch(url+'/session/'+manual.sessionId+'/match',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({groupId:item.sku,productId:1})})).json();assert.equal(matched.item.product.id,1);}
    const oversized=await run(manual.sessionId,{selectedSkus:manual.items.map(item=>item.sku)});
    assert.equal(oversized.status,402);assert.match((await oversized.json()).error,/10 imagens/);assert.equal(consumed,0);
    const started=await (await run(preview.sessionId,{dryRun:false,selectedSkus:[preview.items[0].sku]})).json();
    assert.ok(started.jobId);
    for(let n=0;n<20 && !runs;n++) await new Promise(resolve=>setTimeout(resolve,10));
    assert.equal(runs,1);
    const status=await (await fetch(`${url}/access`,{headers})).json(); assert.equal(status.demoUsed,true);assert.equal(status.demoBatchesRemaining,0);
    const unauthorized=await fetch(`${url}/job/${started.jobId}`); assert.equal(unauthorized.status,401);
  } finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
