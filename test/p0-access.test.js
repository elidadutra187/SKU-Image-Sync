import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommercialAccess,createPostgresAccessRepository} from '../services/commercialAccess.js';
import NuvemshopClient from '../services/nuvemshop.js';

test('backend publishes the same commercial decision enforced for monthly batches',async()=>{
 const before=process.env.NUVEMSHOP_BILLING_MODEL;process.env.NUVEMSHOP_BILLING_MODEL='platform_monthly';
 try{
  for(const [extra,allowed,reason] of [
   [{trialActive:true},true,'trial_active'],
   [{trialActive:false},false,'trial_expired'],
   [{paid:true},true,'paid'],
   [{courtesyActive:true},true,'courtesy'],
   [{paid:true,trialActive:true,platformSuspended:true},false,'platform_blocked'],
   [{subscriptionState:null},false,'unverified']
  ]){
   const access=createCommercialAccess({status:async()=>({demoBatchesUsed:1,subscriptionState:'active',...extra})});
   const result=await access.status('1068328');
   assert.equal(result.allowed,allowed);assert.equal(result.accessReason,reason);
   assert.equal(result.storeId,'1068328');assert.ok(Date.parse(result.checkedAt));
   if(allowed)await access.authorize('1068328',['p'],{imageCount:120});
   else await assert.rejects(()=>access.authorize('1068328',['p']),{status:reason==='unverified'?503:402});
  }
  const yampi=createCommercialAccess({status:async()=>({demoBatchesUsed:1,trialActive:true})});
  assert.equal((await yampi.status('yampi:fixture')).allowed,false,'Nuvemshop trial never grants Yampi access');
 }finally{if(before===undefined)delete process.env.NUVEMSHOP_BILLING_MODEL;else process.env.NUVEMSHOP_BILLING_MODEL=before;}
});

test('database failure never becomes a financial refusal or permission',async()=>{
 for(const code of ['ECONNRESET','53300','XX000']){
  const access=createCommercialAccess(createPostgresAccessRepository(()=>({query:async()=>{throw Object.assign(Error('private detail'),{code});}}),async()=>{}));
  await assert.rejects(()=>access.status('1068328'),error=>error.status===503&&!error.message.includes('private detail'));
 }
});

for(const [status,reason] of [[402,'platform_api_restricted'],[401,'reauthorization_required'],[403,'reauthorization_required'],[429,'verification_unavailable'],[503,'verification_unavailable']]){
 test(`provider ${status} has an explicit non-ambiguous backend classification`,async()=>{
  const client=new NuvemshopClient({storeId:'1068328'});
  client.request=async()=>{throw Object.assign(Error('private'),{status});};
  const result=await client.testConnection();
  assert.equal(result.accessDecision.allowed,false);assert.equal(result.accessDecision.reason,reason);
  assert.equal(result.upstreamStatus,status);
  assert.equal(result.paymentRequired,status===402);
 });
}
