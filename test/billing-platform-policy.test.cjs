const test=require('node:test'),assert=require('node:assert/strict');
const {createBillingPolicy,isYampiStoreId,assertYampiStoreContext}=require('../services/billingPlatformPolicy.cjs');
const ctx=(platform,storeId,billingKind='subscription')=>({appCode:'WA',platform,storeId,billingKind});
test('Nuvemshop and Tiendanube always resolve to native billing; Yampi resolves to Mercado Pago',()=>{
 const p=createBillingPolicy();for(const platform of ['nuvemshop','tiendanube'])assert.equal(p.resolve(ctx(platform,'123')).provider,'nuvemshop');
 assert.equal(p.resolve(ctx('yampi','yampi:one')).provider,'mercadopago');
 assert.throws(()=>p.assertProvider(ctx('nuvemshop','123'),'mercadopago'),{code:'billing_provider_mismatch'});
 assert.throws(()=>p.assertProvider(ctx('yampi','yampi:one'),'nuvemshop'),{code:'billing_provider_mismatch'});
});
test('Unknown platforms and mismatched namespaces cannot select a fallback provider',()=>{
 const p=createBillingPolicy();for(const c of [ctx('future','123'),ctx(undefined,'123'),ctx('nuvemshop','yampi:one'),ctx('yampi','123')])assert.throws(()=>p.resolve(c));
 assert.equal(isYampiStoreId('123'),false);assert.equal(isYampiStoreId('yampi:../one'),false);assert.equal(isYampiStoreId('yampi:one'),true);
 assert.throws(()=>assertYampiStoreContext('yampi:one',{platform:'nuvemshop',storeId:'yampi:one'}));
 assert.throws(()=>assertYampiStoreContext('yampi:one',{platform:'yampi',storeId:'yampi:other'}));
});
test('A native provider failure never invokes Mercado Pago even with that adapter configured',async()=>{
 let native=0,mp=0;const p=createBillingPolicy({adapters:{nuvemshop:{getStatus:async()=>{native++;throw Object.assign(Error('native_unavailable'),{status:503});}},mercadopago:{getStatus:async()=>mp++}}});
 await assert.rejects(p.execute(ctx('nuvemshop','123'),'getStatus'),{message:'native_unavailable'});assert.equal(native,1);assert.equal(mp,0);
 await assert.rejects(p.execute(ctx('unknown','123'),'getStatus'));assert.equal(mp,0);
});
test('Future platforms require explicit registration and cannot replace native platform policies',async()=>{
 assert.throws(()=>createBillingPolicy({platforms:[{platform:'nuvemshop',provider:'mercadopago',matches:()=>true}]}));
 assert.throws(()=>createBillingPolicy({platforms:[{platform:'tiendanube',provider:'mercadopago',matches:()=>true}]}));
 const p=createBillingPolicy({platforms:[{platform:'future',provider:'future_native',matches:id=>/^future:[a-z]+$/.test(id)}],adapters:{future_native:{getStatus:async c=>({provider:c.provider,storeId:c.storeId})}}});
 assert.equal(p.resolve(ctx('nuvemshop','123')).provider,'nuvemshop');assert.equal(p.resolve(ctx('yampi','yampi:one')).provider,'mercadopago');
 assert.deepEqual(await p.execute(ctx('future','future:one'),'getStatus'),{provider:'future_native',storeId:'future:one'});
 await assert.rejects(p.execute(ctx('future','123'),'getStatus'));
});
test('One-time billing cannot claim renewal cancellation capabilities; missing operations do not fall back',async()=>{
 let mp=0;const p=createBillingPolicy({adapters:{mercadopago:{cancelRenewal:async()=>mp++}}});
 await assert.rejects(p.execute(ctx('yampi','yampi:one','one_time'),'cancelRenewal'),{code:'billing_operation_not_supported'});
 await assert.rejects(p.execute(ctx('nuvemshop','123'),'createCheckout'),{code:'billing_operation_not_supported'});assert.equal(mp,0);
});

