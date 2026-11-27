import {getPool,initializeDatabase} from './database.js';
import NuvemshopClient from './nuvemshop.js';

// Called only after charge/paid HMAC, app, identity, amount and period validation.
// A subscription proves the expected contract, never that a payment occurred.
export async function readMonthlyReceiptContext({storeId,chargeId,receipt},{poolProvider=getPool,initialize=initializeDatabase}={}) {
  const pool=poolProvider();if(!pool)throw Error('monthly_verification_unavailable');
  await initialize();
  // One read supplies both deduplication evidence and the token for a new event.
  const {rows}=await pool.query(`select s.store_id,s.access_token,r.charge_id,
    r.store_id as receipt_store,r.app_id,r.amount_value,r.amount_currency,r.from_date,r.to_date
    from (select $1::text as store_id) wanted
    left join stores s on s.store_id=wanted.store_id
    left join image_sync_native_receipts r on r.charge_id=$2`,[storeId,chargeId]);
  const row=rows[0]||{};
  const recorded=Boolean(row.charge_id)&&row.receipt_store===storeId&&row.app_id===receipt.appId
    &&Number(row.amount_value)===receipt.amountValue&&row.amount_currency===receipt.amountCurrency
    &&new Date(row.from_date).toISOString()===receipt.fromDate&&new Date(row.to_date).toISOString()===receipt.toDate;
  return {knownStore:row.store_id===storeId,accessToken:row.access_token,recorded,conflict:Boolean(row.charge_id)&&!recorded};
}

async function readOfficialSubscription({storeId,receipt},accessToken) {
  if(!accessToken||!process.env.NUVEMSHOP_USER_AGENT)throw Error('monthly_verification_unavailable');
  const client=new NuvemshopClient({storeId,accessToken,userAgent:process.env.NUVEMSHOP_USER_AGENT,
    apiVersion:process.env.NUVEMSHOP_API_VERSION,requestDelay:process.env.NUVEMSHOP_REQUEST_DELAY_MS});
  return client.request(`/concepts/app-cost/services/${encodeURIComponent(receipt.appId)}/subscriptions`,
    {signal:AbortSignal.timeout(2000)});
}

function money(value) {
  if(!/^\d+(\.\d{1,2})?$/.test(String(value)))return null;
  const cents=Math.round(Number(value)*100);
  return Number.isSafeInteger(cents)&&cents>0?cents:null;
}

export function createMonthlyCurrencyVerifier({readContext=readMonthlyReceiptContext,
  readSubscription=readOfficialSubscription,maxInFlight=64}={}) {
  const pending=new Map();
  return async input=>{
    const {storeId,chargeId,receipt}=input;
    const key=JSON.stringify([storeId,chargeId,receipt.appId,receipt.amountValue,receipt.amountCurrency,receipt.fromDate,receipt.toDate]);
    if(pending.has(key))return pending.get(key);
    if(pending.size>=maxInFlight)throw Error('monthly_verification_capacity');
    const task=(async()=>{
      const context=await readContext(input);
      if(!context.knownStore||context.conflict)throw Error('monthly_receipt_unverified');
      if(context.recorded)return {verified:true,source:'stored_receipt'};
      const subscription=await readSubscription(input,context.accessToken);
      const expected=money(subscription?.amount_value),received=money(receipt.amountValue);
      if(String(subscription?.store_id)!==storeId||subscription?.concept_code!=='app-cost'
        ||subscription?.amount_currency!==receipt.amountCurrency||subscription?.recurring_frequency!=='M'
        ||Number(subscription?.recurring_interval)!==1||!expected||!received||received>expected)
        throw Error('monthly_contract_unverified');
      return {verified:true,source:'official_subscription'};
    })();
    pending.set(key,task);
    try{return await task;}finally{if(pending.get(key)===task)pending.delete(key);}
  };
}

export default createMonthlyCurrencyVerifier();
