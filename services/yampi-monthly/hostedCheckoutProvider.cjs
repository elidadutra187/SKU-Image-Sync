'use strict';
const error=(code,status=503)=>Object.assign(Error(code),{code,status});
function createHostedCheckoutProvider({request,getPayment,getPreapproval,listInvoices,collectorId,applicationId,appCode,priceCents,baseUrl,now}){
 const pixMethods={default_payment_method_id:'pix',installments:1,excluded_payment_types:['credit_card','debit_card','prepaid_card','ticket'].map(id=>({id}))};
 const returnUrl=origin=>{ const allowed=new Set([new URL(baseUrl).origin]); const chosen=origin||new URL(baseUrl).origin; if(!allowed.has(chosen))throw error('invalid_return_origin',403); return new URL('/?platform=yampi#access',chosen).href; };
 function hostedCheckoutUrl(p){let u;try{u=new URL(p.init_point)}catch{throw error('invalid_hosted_checkout')}
  if(u.origin!=='https://www.mercadopago.com.br'||u.username||u.password||!/^\/checkout\/v1\/redirect\/?$/.test(u.pathname)||u.searchParams.get('pref_id')!==String(p.id))throw error('invalid_hosted_checkout');return u.href;}
 function validate(p,reference){const items=p.items;
  if(String(p.collector_id)!==String(collectorId)||String(p.client_id??p.application_id)!==String(applicationId)||p.external_reference!==reference||!Array.isArray(items)||items.length!==1||items[0].id!==appCode+'-yampi-monthly'||Number(items[0].quantity)!==1||items[0].currency_id!=='BRL'||Number(items[0].unit_price)!==priceCents/100)throw error('hosted_preference_mismatch');
  hostedCheckoutUrl(p);return p;}
 async function getHostedPreference(id,reference){if(!/^[a-zA-Z0-9-]{1,128}$/.test(String(id)))throw error('invalid_preference_id');return validate(await request('GET','/checkout/preferences/'+encodeURIComponent(id)),reference);}
 async function createHostedPreference({externalReference,intentId,payerEmail,returnOrigin}){
  const body={items:[{id:appCode+'-yampi-monthly',title:'Imagem em Lote — acesso mensal Yampi',quantity:1,currency_id:'BRL',unit_price:priceCents/100}],external_reference:externalReference,back_urls:{success:returnUrl(returnOrigin),pending:returnUrl(returnOrigin),failure:returnUrl(returnOrigin)},auto_return:'approved',notification_url:new URL('/yampi/billing/monthly/webhook',baseUrl).href,payment_methods:pixMethods,metadata:{app_code:appCode,intent_id:intentId}};
  if(typeof payerEmail==='string'&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payerEmail))body.payer={email:payerEmail};
  const p=validate(await request('POST','/checkout/preferences',body,intentId),externalReference);
  return getHostedPreference(p.id,externalReference);
 }
 async function findHostedPreference(reference){const data=await request('GET','/checkout/preferences/search?external_reference='+encodeURIComponent(reference));if(!Array.isArray(data.elements))throw error('invalid_preference_search');const matches=data.elements.filter(p=>p.external_reference===reference);if(matches.length>1)throw error('multiple_hosted_preferences',409);return matches.length?getHostedPreference(matches[0].id,reference):null;}
 async function payments(reference){const out=[],seen=new Set();let offset=0;for(let page=0;page<100;page++){
  const data=await request('GET','/v1/payments/search?external_reference='+encodeURIComponent(reference)+'&limit=100&offset='+offset);
  if(!Array.isArray(data.results))throw error('invalid_payment_search');
  for(const row of data.results){if(row.external_reference!==reference||seen.has(String(row.id)))throw error('payment_search_mismatch');seen.add(String(row.id));out.push(await getPayment(row.id));}
  offset+=data.results.length;const total=data.paging?.total==null?NaN:Number(data.paging.total);
  if(Number.isFinite(total)&&offset>=total||!data.results.length&&!Number.isFinite(total))return out;
  if(!data.results.length)throw error('incomplete_payment_search');
 }throw error('payment_search_limit');}
 async function listHostedPayments(preferenceId,reference){const list=await payments(reference);for(const p of list){if(!p.order?.id)throw error('hosted_payment_order_missing');const order=await request('GET','/merchant_orders/'+encodeURIComponent(p.order.id));if(String(order.preference_id)!==String(preferenceId)||order.external_reference!==reference||String(order.collector?.id??order.collector_id)!==String(collectorId)||!order.payments?.some(row=>String(row.id)===String(p.id)))throw error('hosted_payment_mismatch');}return list;}
 async function prepareHostedPreference(id,reference){const p=await getHostedPreference(id,reference);if(pixMethods.excluded_payment_types.every(t=>p.payment_methods?.excluded_payment_types?.some(x=>x.id===t.id)))return p;await request('PUT','/checkout/preferences/'+encodeURIComponent(id),{payment_methods:pixMethods});return getHostedPreference(id,reference);}
 async function cancelExpiredHostedPix(id,preferenceId,reference){const p=(await listHostedPayments(preferenceId,reference)).find(p=>String(p.id)===String(id));if(!p)throw error('hosted_payment_mismatch');if(p.status!=='pending')return p;const expires=Date.parse(p.date_of_expiration||'');if(p.payment_method_id!=='pix'||!Number.isFinite(expires)||expires>now())throw error('pix_not_expired',409);await request('PUT','/v1/payments/'+encodeURIComponent(id),{status:'cancelled'});const fresh=await getPayment(id);if(fresh.external_reference!==reference||!['cancelled','rejected','approved','refunded','charged_back'].includes(fresh.status))throw error('pix_cancellation_unconfirmed');return fresh;}
 async function cancelPendingPreapproval(id,reference){let p=await getPreapproval(id,reference);if(p.status==='cancelled')return p;
  if(p.status!=='pending'||(await listInvoices(id)).length||(await payments(reference)).length)throw error('subscription_not_replaceable',409);
  p=await getPreapproval(id,reference);if(p.status!=='pending')throw error('subscription_not_replaceable',409);
  await request('PUT','/preapproval/'+encodeURIComponent(id),{status:'cancelled'});
  const cancelled=await getPreapproval(id,reference);if(cancelled.status!=='cancelled')throw error('cancellation_not_confirmed');return cancelled;
 }
 return{createHostedPreference,getHostedPreference,findHostedPreference,hostedCheckoutUrl,listHostedPayments,cancelPendingPreapproval,prepareHostedPreference,cancelExpiredHostedPix};
}
module.exports={createHostedCheckoutProvider};
