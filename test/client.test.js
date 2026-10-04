import assert from 'node:assert/strict';
import test from 'node:test';
import NuvemshopClient from '../services/nuvemshop.js';
import ImageSyncService from '../services/imageSync.js';
test('catalog reads all pages and imports merge groups targeting the same product',async()=>{
  const client=new NuvemshopClient({storeId:'test'});
  const pages=[];
  client.request=async endpoint=>{pages.push(endpoint);return pages.length===1?Array.from({length:200},(_,id)=>({id})): [{id:201}];};
  assert.equal(typeof client.getProducts,'function','catalog pagination is missing');
  assert.equal((await client.getProducts()).length,201);
  assert.match(pages[1],/page=2/);
  const service=new ImageSyncService({folders:[{sku:'group-a',productId:1,dir:'a'},
    {sku:'group-b',productId:1,dir:'b'},{sku:'group-c',productId:2,dir:'c'}]});
  const folders=await service.listSkuFolders();
  assert.equal(folders.length,2);
  assert.deepEqual(folders[0].dirs,['a','b']);
  assert.equal(folders[0].productId,1);
});
test('a different authenticated store never uses another shops manual token',async()=>{
  const env={...process.env};
  process.env.NUVEMSHOP_STORE_ID='shop-a';process.env.NUVEMSHOP_ACCESS_TOKEN='test-token';
  process.env.NUVEMSHOP_USER_AGENT='test';delete process.env.DATABASE_URL;
  process.env.OAUTH_TOKEN_FILE='does-not-exist-for-test.json';
  try {await assert.rejects(()=>NuvemshopClient.fromStore('shop-b'),/Missing/);}
  finally {for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);}
});
