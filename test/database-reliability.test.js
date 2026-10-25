import test from 'node:test';import assert from 'node:assert/strict';
import {readStoredTokenAsync,saveStoredToken} from '../services/oauthStore.js';
import {hasDatabase} from '../services/database.js';
test('production without its database cannot read or write the local OAuth fallback',async()=>{
 const oldNode=process.env.NODE_ENV,oldUrl=process.env.DATABASE_URL;
 process.env.NODE_ENV='production';delete process.env.DATABASE_URL;
 try{
  assert.throws(()=>hasDatabase(),error=>error.status===503);
  await assert.rejects(()=>readStoredTokenAsync('123'),error=>error.status===503);
  await assert.rejects(()=>saveStoredToken({storeId:'123',accessToken:'test-only'}),error=>error.status===503);
 }finally{if(oldNode===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=oldNode;if(oldUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=oldUrl;}
});
