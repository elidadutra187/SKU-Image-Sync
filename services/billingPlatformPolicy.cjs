'use strict';
// Versioned pure contract copied into each independent app. No network,
// credentials or persistence belong here. Built-in policies cannot be replaced.
const VERSION=1;
const YAMPI_ID=/^yampi:[a-z0-9][a-z0-9_-]{0,99}$/;
const NATIVE_ID=/^\d{1,18}$/;
const OPERATIONS=new Set(['getStatus','createCheckout','cancelRenewal','getReceipt','verifyWebhook','reconcile']);
const fail=code=>Object.assign(Error(code),{code,status:403});
const isYampiStoreId=id=>typeof id==='string'&&YAMPI_ID.test(id);
function assertYampiStoreId(id){if(!isYampiStoreId(id))throw fail('billing_platform_mismatch');return id;}
function assertYampiStoreContext(id,store){
 assertYampiStoreId(id);
 if(store?.platform!=='yampi'||(store.storeId!=null&&store.storeId!==id))throw fail('billing_platform_mismatch');
 return store;
}
function createBillingPolicy({platforms=[],adapters={}}={}){
 const registry=new Map([
  ['nuvemshop',Object.freeze({platform:'nuvemshop',provider:'nuvemshop',matches:id=>typeof id==='string'&&NATIVE_ID.test(id)})],
  ['yampi',Object.freeze({platform:'yampi',provider:'mercadopago',matches:isYampiStoreId})]
 ]);
 for(const spec of platforms){
  if(!spec||!(/^[a-z][a-z0-9_-]{1,31}$/).test(spec.platform)||spec.platform==='tiendanube'||registry.has(spec.platform)||!(/^[a-z][a-z0-9_-]{1,31}$/).test(spec.provider)||typeof spec.matches!=='function')throw fail('invalid_billing_platform_registration');
  registry.set(spec.platform,Object.freeze({platform:spec.platform,provider:spec.provider,matches:spec.matches}));
 }
 // Capture adapter operations: mutating a caller's registry cannot rebind a
 // previously constructed policy to another provider later.
 const implementations=new Map(Object.entries(adapters).map(([name,adapter])=>[name,Object.freeze(Object.fromEntries([...OPERATIONS].filter(op=>typeof adapter?.[op]==='function').map(op=>[op,adapter[op].bind(adapter)])))]));
 function resolve(context){
  if(!context||!(/^[A-Z]{2,12}$/).test(context.appCode||''))throw fail('billing_app_required');
  const platform=context.platform==='tiendanube'?'nuvemshop':context.platform;
  const spec=registry.get(platform);
  if(!spec)throw fail('unsupported_billing_platform');
  if(typeof context.storeId!=='string'||!spec.matches(context.storeId))throw fail('billing_platform_mismatch');
  const billingKind=context.billingKind||'subscription';
  if(!['subscription','one_time'].includes(billingKind))throw fail('unsupported_billing_kind');
  return Object.freeze({policyVersion:VERSION,appCode:context.appCode,platform:spec.platform,provider:spec.provider,storeId:context.storeId,billingKind});
 }
 function assertProvider(context,provider){const resolved=resolve(context);if(resolved.provider!==provider)throw fail('billing_provider_mismatch');return resolved;}
 async function execute(context,operation,...args){
  const resolved=resolve(context);
  const method=implementations.get(resolved.provider)?.[operation];
  if(!OPERATIONS.has(operation)||!method||(resolved.billingKind==='one_time'&&operation==='cancelRenewal'))throw fail('billing_operation_not_supported');
  // Deliberately no catch/retry with another provider.
  return method(resolved,...args);
 }
 return Object.freeze({version:VERSION,resolve,assertProvider,execute});
}
module.exports={BILLING_POLICY_VERSION:VERSION,createBillingPolicy,isYampiStoreId,assertYampiStoreId,assertYampiStoreContext};

