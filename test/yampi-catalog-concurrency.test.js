import test from 'node:test';import assert from 'node:assert/strict';
import {YampiClient,tokenRequest} from '../services/yampi.js';
test('concurrent catalog reads share the same import and failures never poison the next read',async()=>{
 let calls=0,fail=true;
 const client=new YampiClient({alias:'shop',clientId:'own',token:async()=> 'token',fetchImpl:async url=>{
  calls++;if(fail)throw Error('temporary');return Response.json({data:url.includes('/products')?[{id:1,name:'Product'}]:[{id:2,product_id:1,sku:'SKU'}]});
 }});client.wait=async()=>{};
 await assert.rejects(Promise.all([client.getProducts(),client.getProducts()]));
 fail=false;calls=0;const results=await Promise.all(Array.from({length:20},()=>client.getProducts()));
 assert.equal(calls,2);assert.ok(results.every(r=>r[0].id===2));
});
test('repeated catalog pages abort instead of associating duplicate products',async()=>{
 const client=new YampiClient({alias:'shop',clientId:'own',token:async()=> 'token',fetchImpl:async()=>Response.json({data:[{id:1}],meta:{pagination:{total_pages:2}}})});client.wait=async()=>{};
 await assert.rejects(client.getProducts(),/pagination/);
});
test('OAuth rejects empty or invalid credentials before they can be persisted',async()=>{
 for(const response of [{access_token:'a',refresh_token:'r',expires_in:-1},{access_token:42,refresh_token:'r',expires_in:600},{access_token:'a',refresh_token:'r',expires_in:'not-a-date'}]){
  await assert.rejects(tokenRequest({},async()=>Response.json(response)),/yampi_token/);
 }
});
