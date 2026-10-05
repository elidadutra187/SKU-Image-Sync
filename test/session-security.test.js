import test from 'node:test';
import express from 'express';
import authRouter from '../routes/auth.js';
import NuvemshopClient from '../services/nuvemshop.js';

test('an anonymous visitor never inherits a stored shop connection',async()=>{
  const original=NuvemshopClient.fromStore;let calls=0;
  NuvemshopClient.fromStore=async()=>{calls++;return {testConnection:async()=>({connected:true,storeId:'123'})};};
  const app=express();app.use('/auth',authRouter);const server=app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  try {const response=await fetch(`http://127.0.0.1:${server.address().port}/auth/status`);
    assert.deepEqual(await response.json(),{connected:false});assert.equal(calls,0);
  }finally{NuvemshopClient.fromStore=original;server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readStoreSession,setStoreSession} from '../services/session.js';

test('sessions reject expired, future, tampered and malformed cookies without crashing',()=>{
  process.env.SESSION_SECRET='local-test-secret';
  const cookie=(createdAt,storeId='123')=>{
    const payload=Buffer.from(JSON.stringify({storeId,createdAt})).toString('base64url');
    const signature=crypto.createHmac('sha256',process.env.SESSION_SECRET).update(payload).digest('base64url');
    return `sku_image_sync_store=${payload}.${signature}`;
  };
  const read=value=>readStoreSession({headers:{cookie:value}});
  assert.equal(read(cookie(new Date().toISOString())),'123');
  assert.equal(read(cookie('2020-01-01T00:00:00Z')),null);
  assert.equal(read(cookie(new Date(Date.now()+600000).toISOString())),null);
  assert.equal(read(cookie('invalid')),null);
  assert.equal(read(cookie(new Date().toISOString(),'invalid')),null);
  assert.equal(read('irrelevant=%ZZ'),null);
  assert.equal(read('sku_image_sync_store=%ZZ'),null);
  assert.equal(read(cookie(new Date().toISOString())+'.extra'),null);
});

test('production refuses to sign sessions without a configured secret',()=>{
  const previous={...process.env};
  try {
    process.env.NODE_ENV='production';
    delete process.env.SESSION_SECRET;delete process.env.NUVEMSHOP_CLIENT_SECRET;
    assert.throws(()=>setStoreSession({setHeader(){}},'123'),/session_secret_not_configured/);
    assert.equal(readStoreSession({headers:{cookie:'sku_image_sync_store=a.b'}}),null);
  }finally {process.env.NODE_ENV=previous.NODE_ENV || '';process.env.SESSION_SECRET=previous.SESSION_SECRET || '';process.env.NUVEMSHOP_CLIENT_SECRET=previous.NUVEMSHOP_CLIENT_SECRET || '';}
});
