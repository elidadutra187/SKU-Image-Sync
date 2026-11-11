import {getPool,initializeDatabase} from './database.js';

// App Billing is collected by Nuvemshop, never by this application.
// Legacy paid_at licences remain permanent; monthly entitlements use a separate ledger.
function connection(poolProvider=getPool,initialize=initializeDatabase) {
  return async () => {
    const pool=poolProvider();
    if(!pool)throw Error('database_unavailable');
    await initialize();
    return pool;
  };
}

export async function registerMonthlyTrial(storeId,{poolProvider=getPool,initialize=initializeDatabase,days=3}={}) {
  if(!/^[1-9]\d*$/.test(String(storeId)) || !Number.isInteger(days) || days<0 || days>30)throw Error('invalid_monthly_trial');
  const pool=await connection(poolProvider,initialize)();
  await pool.query(`insert into image_sync_monthly (store_id,trial_until)
    select store_id,statement_timestamp()+($2::integer*interval '1 day') from stores where store_id=$1
    on conflict(store_id) do update set trial_until=coalesce(image_sync_monthly.trial_until,excluded.trial_until)`,[String(storeId),days]);
}

export async function grantMonthlyReceipt({storeId,chargeId,receipt,occurredAt=null},{poolProvider=getPool,initialize=initializeDatabase}={}) {
  const pool=await connection(poolProvider,initialize)();
  const {rows}=await pool.query(`with confirmed as (
    insert into image_sync_native_receipts(charge_id,store_id,app_id,amount_value,amount_currency,from_date,to_date)
    select $2,$1,$3,$4,$5,$6,$7 from stores where store_id=$1
    on conflict(charge_id) do nothing
    returning store_id,confirmed_at
  ) insert into image_sync_monthly(store_id,paid_until,last_charge_id,last_payment_event_at)
    select store_id,$7::timestamptz,$2,coalesce($8::timestamptz,confirmed_at) from confirmed
    where $7::timestamptz>statement_timestamp()
    on conflict(store_id) do update set
      paid_until=case when image_sync_monthly.platform_suspended or image_sync_monthly.lifecycle<>'active'
        then excluded.paid_until
        else greatest(coalesce(image_sync_monthly.paid_until,'epoch'::timestamptz),excluded.paid_until) end,
      last_charge_id=case when image_sync_monthly.platform_suspended or image_sync_monthly.lifecycle<>'active'
        or image_sync_monthly.paid_until is null
        or excluded.paid_until>=image_sync_monthly.paid_until then excluded.last_charge_id
        else image_sync_monthly.last_charge_id end,
      lifecycle='active',
      platform_suspended=false,
      last_payment_event_at=greatest(image_sync_monthly.last_payment_event_at,excluded.last_payment_event_at),
      updated_at=statement_timestamp()
    where excluded.last_payment_event_at>coalesce(
      image_sync_monthly.last_blocked_at,
      case when image_sync_monthly.platform_suspended or image_sync_monthly.lifecycle<>'active'
        then image_sync_monthly.updated_at end,'-infinity'::timestamptz)
    returning store_id`,[String(storeId),String(chargeId),String(receipt.appId),
      receipt.amountValue,receipt.amountCurrency,receipt.fromDate,receipt.toDate,occurredAt]);
  if(rows.length!==1){
    const {rows:known}=await pool.query(`select 1 from image_sync_native_receipts
      where charge_id=$1 and store_id=$2 and app_id=$3 and amount_value=$4 and amount_currency=$5
      and from_date=$6 and to_date=$7`,[String(chargeId),String(storeId),String(receipt.appId),
      receipt.amountValue,receipt.amountCurrency,receipt.fromDate,receipt.toDate]);
    if(!known.length)throw Error('native_monthly_receipt_not_applied');
  }
}

export async function updateMonthlyLifecycle({storeId,topic,occurredAt},{poolProvider=getPool,initialize=initializeDatabase}={}) {
  if(!['churn','phoenix','installed','uninstalled','plan_changed'].includes(topic))throw Error('unknown_subscription_topic');
  const pool=await connection(poolProvider,initialize)();
  if(topic==='plan_changed'||topic==='phoenix')return;
  if(topic==='installed'){
    await registerMonthlyTrial(storeId,{poolProvider:()=>pool,initialize:async()=>{}});
    return;
  }
  await setMonthlySuspended({storeId,suspended:true,lifecycle:topic,occurredAt},{poolProvider:()=>pool,initialize:async()=>{}});
}

export async function setMonthlySuspended({storeId,suspended,lifecycle='suspended',occurredAt=null},{poolProvider=getPool,initialize=initializeDatabase}={}) {
  if(!suspended)return;
  const pool=await connection(poolProvider,initialize)();
  await pool.query(`insert into image_sync_monthly(store_id,platform_suspended,lifecycle,last_blocked_at)
    select store_id,true,$2,coalesce($3::timestamptz,statement_timestamp()) from stores where store_id=$1
    on conflict(store_id) do update set platform_suspended=true,lifecycle=excluded.lifecycle,
      paid_until=null,last_charge_id=null,partners_paid_until=null,partners_free=false,
      last_blocked_at=excluded.last_blocked_at,updated_at=statement_timestamp()
    where excluded.last_blocked_at>=coalesce(image_sync_monthly.last_payment_event_at,'-infinity'::timestamptz)
      and excluded.last_blocked_at>coalesce(image_sync_monthly.last_blocked_at,'-infinity'::timestamptz)
  `,[String(storeId),lifecycle,occurredAt]);
}
