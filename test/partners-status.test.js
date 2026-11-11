import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {PGlite} from '@electric-sql/pglite';
import {validateBatchAccess,createPostgresAccessRepository} from '../services/commercialAccess.js';
import {migrateDatabase} from '../services/database.js';
import {applyPartnersStatus,createPartnersStatusRouter} from '../routes/partnersStatus.js';

test('a platform block takes precedence over a permanent licence and an unused free batch',()=>{
  for(const paid of [true,false]){
    assert.throws(()=>validateBatchAccess({platformSuspended:true,paid,demoBatchesUsed:0},1),{status:402});
  }
});

test('authenticated Partners states persist and audit; a cancellation revokes free and paid',async()=>{
  const db=new PGlite();
  const dependencies={poolProvider:()=>db,initialize:async()=>{}};
  let server;
  try{
    await migrateDatabase(db);
    await db.query("insert into stores(store_id,access_token) values ('123','fixture'),('456','fixture')");
    await assert.rejects(db.query("insert into image_sync_monthly(store_id,partners_free) values ('123',true)"),{code:'42501'});
    await db.exec("set application_name='imagem-em-lote'");
    const access=createPostgresAccessRepository(()=>db,async()=>{});
    const app=express();
    app.use(express.json());
    app.use('/billing/admin',createPartnersStatusRouter({token:()=>'fixture-token',
      apply:input=>applyPartnersStatus(input,dependencies)}));
    server=app.listen(0,'127.0.0.1');
    await new Promise(resolve=>server.once('listening',resolve));
    async function post(body,token='fixture-token'){
      return fetch('http://127.0.0.1:'+server.address().port+'/billing/admin/partners-status',{
        method:'POST',headers:{'Content-Type':'application/json','X-Admin-Token':token},body:JSON.stringify(body)});
    }
    const paidAt=new Date(Date.now()-86400000).toISOString();
    assert.equal((await post({storeId:'123',state:'free'},'')).status,403);
    assert.equal((await post({storeId:'123',state:'paid',paidAt:new Date(Date.now()+86400000).toISOString()})).status,400);
    assert.equal((await post({storeId:'123',state:'paid',paidAt})).status,200);
    assert.equal((await access.status('123')).paid,true);
    assert.equal((await post({storeId:'123',state:'free'})).status,200);
    assert.equal((await access.status('123')).subscriptionUntil,null);
    assert.equal((await post({storeId:'123',state:'cancelled'})).status,200);
    assert.equal((await post({storeId:'123',state:'paid',paidAt})).status,409);
    assert.equal((await access.status('123')).paid,false);
    assert.equal(await access.reserve('123'),false);
    for(const state of ['unpaid','suspended']){
      assert.equal((await post({storeId:'456',state})).status,200);
      assert.equal((await access.status('456')).platformSuspended,true);
    }
    const {rows:[audit]}=await db.query("select before_state,after_state from image_sync_entitlement_audit where after_state->>'lifecycle'='cancelled'");
    assert.equal(audit.before_state.partners_free,true);
    assert.equal(audit.after_state.partners_free,false);
    assert.equal(audit.after_state.partners_paid_until,null);
  }finally{
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    await db.close();
  }
});
