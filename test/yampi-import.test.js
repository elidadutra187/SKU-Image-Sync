import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {crc32} from 'node:zlib';
import {createSyncRouter} from '../routes/sync.js';
import {setStoreSession} from '../services/session.js';
import {createCommercialAccess} from '../services/commercialAccess.js';
import ImageSyncService from '../services/imageSync.js';
import {temporaryMedia,yampiRepository} from '../services/yampiStore.js';
import {YampiClient} from '../services/yampi.js';

test('Yampi HTTP preview, simulation and ten-photo upload preserve current images and consume only one batch',async(t)=>{
  const previous=process.env.YAMPI_CLIENT_ID;process.env.YAMPI_CLIENT_ID='imagem-own-id';
  t.after(()=>{if(previous===undefined)delete process.env.YAMPI_CLIENT_ID;else process.env.YAMPI_CLIENT_ID=previous;});
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'imagem-yampi-'));
  t.after(()=>fs.rm(directory,{recursive:true,force:true}));
  const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1ioAAAAASUVORK5CYII=','base64');
  const originalFetch=fetch;let uploaded=0,consumed=0;
  t.mock.method(YampiClient.prototype,'wait',async()=>{});
  t.mock.method(yampiRepository,'accessToken',async()=> 'token');
  t.mock.method(temporaryMedia,'create',async(storeId,payload)=>{
    assert.equal(storeId,'yampi:shop-one');assert.ok(Buffer.from(payload.attachment,'base64').subarray(0,8).equals(image.subarray(0,8)));
    return 'https://example.com/temporary/'+crypto.randomUUID();
  });
  t.mock.method(globalThis,'fetch',async(url,options={})=>{
    if(!String(url).startsWith('https://api.dooki.com.br/'))return originalFetch(url,options);
    assert.match(String(url),/^https:\/\/api.dooki.com.br\/v2\/shop-one\//);
    assert.equal(options.headers['X-Partner-Client-ID'],'imagem-own-id');
    assert.notEqual(options.method,'DELETE','add must preserve original photos');
    if(options.method==='POST'){assert.ok(consumed===1);uploaded++;return Response.json({data:[{id:1000+uploaded}]});}
    if(String(url).includes('/images'))return Response.json({data:[{id:99,order:1,large:{url:'https://example.com/current.png'}}]});
    if(String(url).includes('/products'))return Response.json({data:[{id:5,name:'Camiseta Azul'}]});
    return Response.json({data:[{id:101,product_id:5,sku:'AZ',title:'Camiseta Azul'}]});
  });
  const access=createCommercialAccess({status:async()=>({paid:false,demoBatchesUsed:consumed}),reserve:async()=>{if(consumed)return false;consumed++;return true;}});
  const app=express();app.use(express.json());app.use('/sync',createSyncRouter({access,
    serviceFactory:options=>new ImageSyncService({...options,history:null,stateFile:path.join(directory,'state.json'),reportPath:path.join(directory,'report.csv')})}));
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base=`http://127.0.0.1:${server.address().port}/sync`;let cookie;
  setStoreSession({setHeader(_,v){cookie=v.split(';')[0];}},'yampi:shop-one');
  const headers={cookie};
  const preview=async count=>{const form=new FormData();for(let n=1;n<=count;n++){
    const text=Buffer.from('Comment\0foto-'+n),chunk=Buffer.concat([Buffer.from('tEXt'),text]);
    const length=Buffer.alloc(4),crc=Buffer.alloc(4);length.writeUInt32BE(text.length);crc.writeUInt32BE(crc32(chunk));
    const distinct=Buffer.concat([image.subarray(0,-12),length,chunk,crc,image.subarray(-12)]);
    form.append('images',new Blob([distinct],{type:'image/png'}),`Camiseta Azul_${n}.png`);}
    return (await fetch(base+'/preview',{method:'POST',headers,body:form})).json();};
  const run=(session,dryRun)=>fetch(base+'/session/'+session.sessionId+'/run',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({dryRun,mode:'add',selectedSkus:session.items.map(i=>i.sku)})});
  const wait=async id=>{for(let n=0;n<100;n++){const {job}=await (await fetch(base+'/job/'+id,{headers})).json();if(job.status!=='running')return job;await new Promise(r=>setTimeout(r,10));}assert.fail('job timed out');};
  try{
    const tooMany=await preview(11);assert.equal((await run(tooMany,false)).status,402);assert.equal(consumed,0);
    const photos=await preview(10);assert.equal(photos.items[0].product.id,101);assert.equal(photos.items[0].remoteImages[0].id,99);
    const simulation=await (await run(photos,true)).json();assert.equal((await wait(simulation.jobId)).status,'completed');assert.equal(consumed,0);assert.equal(uploaded,0);
    const started=await (await run(photos,false)).json(),job=await wait(started.jobId);
    assert.equal(job.status,'completed');assert.equal(job.result.stats.uploaded,10);assert.equal(uploaded,10);assert.equal(consumed,1);
    const next=await preview(1);assert.equal((await run(next,false)).status,402);
    let foreign;setStoreSession({setHeader(_,v){foreign=v.split(';')[0];}},'yampi:shop-two');
    const res=await fetch(base+'/session/'+next.sessionId+'/match',{method:'POST',headers:{cookie:foreign,'Content-Type':'application/json'},body:JSON.stringify({groupId:next.items[0].sku,productId:101})});assert.equal(res.status,403);
    assert.equal((await fetch(base+'/purchase',{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:'{"confirmed":true}'})).status,503);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
