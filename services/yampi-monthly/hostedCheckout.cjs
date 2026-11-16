'use strict';
const error=(code,status=503)=>Object.assign(Error(code),{code,status});
const isHosted=c=>/^elunalab:[A-Z]{2,12}:checkout:[a-f0-9-]{36}$/.test(c?.external_reference||'');
function createHostedCheckoutService({repo,provider,getStore,getEntitlement,checkLegacyCheckout,now,monthEnd,cents}){
 async function store(id){if(!/^yampi:[a-z0-9][a-z0-9_-]{0,99}$/.test(id))throw error('yampi_session_required',401);const s=await getStore(id);if(!s||s.platform!=='yampi'||s.installed===false||s.subscriptionOfficialState==='uninstalled')throw error('store_not_connected',401);return s;}
 async function reconcileHosted(c,retry=false){if(!isHosted(c))throw error('hosted_contract_mismatch',409);
  let preference=c.preference_id?await provider.getHostedPreference(c.preference_id,c.external_reference):await provider.findHostedPreference(c.external_reference);
  if(!preference)return{pending:true};await repo.recordPreference(c.external_reference,preference);
  let list=await provider.listHostedPayments(preference.id,c.external_reference);
  async function project(){for(const p of list){if(!['approved','refunded','charged_back'].includes(p.status))continue;const at=Date.parse(p.date_approved||'');if(!Number.isFinite(at)||at>now())throw error('invalid_payment_date');
   await repo.applyPayment({kind:'hosted',preferenceId:preference.id,paymentId:String(p.id),externalReference:c.external_reference,status:p.status,amountCents:cents(p.transaction_amount),currency:p.currency_id,dateApproved:new Date(at).toISOString(),periodEnd:monthEnd(at)});}
   return list.some(p=>p.status==='approved'&&Date.parse(monthEnd(p.date_approved))>now());}
  if(await project())return{status:'approved',checkoutUrl:null};
  if(retry){let changed=false;for(const p of list){const expiry=Date.parse(p.date_of_expiration||'');if(p.status==='pending'&&p.payment_method_id==='pix'&&Number.isFinite(expiry)&&expiry<=now()){await provider.cancelExpiredHostedPix(p.id,preference.id,c.external_reference);changed=true;}}if(changed){list=await provider.listHostedPayments(preference.id,c.external_reference);if(await project())return{status:'approved',checkoutUrl:null};}}
  const pending=list.filter(p=>!['cancelled','rejected','refunded','charged_back','approved'].includes(p.status));
  const pix=pending.find(p=>p.status==='pending'&&p.payment_method_id==='pix'&&(!Number.isFinite(Date.parse(p.date_of_expiration||''))||Date.parse(p.date_of_expiration)>now()));
  if(pix)return{status:'pending',checkoutUrl:provider.pixTicket(pix)};
  if(pending.length)return{status:'pending',checkoutUrl:null};
  if(list.some(p=>['approved','refunded','charged_back'].includes(p.status)))return{status:'settled',checkoutUrl:null};
  if(retry&&provider.prepareHostedPreference)preference=await provider.prepareHostedPreference(preference.id,c.external_reference);
  return{status:'pending',checkoutUrl:provider.hostedCheckoutUrl(preference)};
 }
 async function checkoutHosted(id,replacePending=false,returnOrigin){if(!provider?.isConfigured())throw error('provider_not_configured');const s=await store(id);if(getEntitlement(s,new Date(now())).status==='active')throw error('access_already_active',409);
  await checkLegacyCheckout(id);
  let current=await repo.findStoreContract(id);
  if(current&&!isHosted(current)&&['intent','uncertain','pending','authorized','paused'].includes(current.status)){
   if(!current.preapproval_id)throw error('checkout_reconciliation_pending',409);
   const p=await provider.getPreapproval(current.preapproval_id,current.external_reference);
   if(p.status!=='pending')throw error('subscription_not_replaceable',409);
   if(!replacePending)throw error('switch_to_hosted_required',409);
   const cancelled=await provider.cancelPendingPreapproval(p.id,current.external_reference);await repo.recordPreapproval(current.external_reference,cancelled);
  }
  const reserve=()=>repo.reserveIntent({storeId:id,payerEmail:current?.payer_email||'',kind:'checkout'});
  let {contract:c,created}=await reserve();
  if(!isHosted(c))throw error('checkout_reconciliation_pending',409);
  if(!created){
   const reconciled=await reconcileHosted(c,true);
   if(reconciled.status!=='settled')return reconciled;
   ({contract:c,created}=await reserve());
   if(!created || !isHosted(c))throw error('checkout_reconciliation_pending',409);
  }
  try{const p=await provider.createHostedPreference({externalReference:c.external_reference,intentId:c.id,payerEmail:c.payer_email,returnOrigin});await repo.recordPreference(c.external_reference,p);return{status:'pending',checkoutUrl:provider.hostedCheckoutUrl(p)};}
  catch(e){await repo.recordCheckoutFailure(c.external_reference,e.checkoutRejected===true);throw e;}
 }
 return{checkoutHosted,reconcileHosted,isHosted};
}
module.exports={createHostedCheckoutService,isHosted};
