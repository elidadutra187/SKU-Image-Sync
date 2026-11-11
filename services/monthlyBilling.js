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

export async function grantMonthlyReceipt({storeId,chargeId,receipt},{poolProvider=getPool,initialize=initializeDatabase}={}) {
  const pool=await connection(poolProvider,initialize)();
  const {rows}=await pool.query(`with confirmed as (
    insert into image_sync_native_receipts(charge_id,store_id,app_id,amount_value,amount_currency,from_date,to_date)
    select $2,$1,$3,$4,$5,$6,$7 from stores where store_id=$1
    on conflict(charge_id) do update set charge_id=excluded.charge_id
    where image_sync_native_receipts.store_id=excluded.store_id
      and image_sync_native_receipts.app_id=excluded.app_id
      and image_sync_native_receipts.amount_value=excluded.amount_value
      and image_sync_native_receipts.amount_currency=excluded.amount_currency
      and image_sync_native_receipts.from_date=excluded.from_date
      and image_sync_native_receipts.to_date=excluded.to_date
    returning store_id
  ) insert into image_sync_monthly(store_id,paid_until,last_charge_id)
    select store_id,$7::timestamptz,$2 from confirmed
    on conflict(store_id) do update set
      paid_until=greatest(coalesce(image_sync_monthly.paid_until,'epoch'::timestamptz),excluded.paid_until),
      last_charge_id=case when image_sync_monthly.paid_until is null
        or excluded.paid_until>=image_sync_monthly.paid_until then excluded.last_charge_id
        else image_sync_monthly.last_charge_id end,
      updated_at=statement_timestamp()
    returning store_id`,[String(storeId),String(chargeId),String(receipt.appId),
      receipt.amountValue,receipt.amountCurrency,receipt.fromDate,receipt.toDate]);
  if(rows.length!==1)throw Error('native_monthly_receipt_not_applied');
}

// 'churn' is authoritative and blocks even a previously paid period. 'phoenix'
// re-enables only the time still covered by a genuine payment or trial.
export async function updateMonthlyLifecycle({storeId,topic},{poolProvider=getPool,initialize=initializeDatabase}={}) {
  if(!['churn','phoenix','installed','uninstalled','plan_changed'].includes(topic))throw Error('unknown_subscription_topic');
  const pool=await connection(poolProvider,initialize)();
  if(topic==='plan_changed')return;
  if(topic==='installed'){
    await registerMonthlyTrial(storeId,{poolProvider:()=>pool,initialize:async()=>{}});
    await pool.query("update image_sync_monthly set lifecycle='active',updated_at=statement_timestamp() where store_id=$1",[String(storeId)]);
    return;
  }
  const state=topic==='phoenix'?'active':'churn';
  const {rows}=await pool.query(`insert into image_sync_monthly(store_id,lifecycle)
    select store_id,$2 from stores where store_id=$1
    on conflict(store_id) do update set lifecycle=excluded.lifecycle,updated_at=statement_timestamp()
    returning store_id`,[String(storeId),state]);
  if(rows.length!==1)throw Error('unknown_subscription_store');
}

export async function setMonthlySuspended({storeId,suspended},{poolProvider=getPool,initialize=initializeDatabase}={}) {
  const pool=await connection(poolProvider,initialize)();
  const {rows}=await pool.query(`insert into image_sync_monthly(store_id,platform_suspended)
    select store_id,$2 from stores where store_id=$1
    on conflict(store_id) do update set platform_suspended=excluded.platform_suspended,updated_at=statement_timestamp()
    returning store_id`,[String(storeId),Boolean(suspended)]);
  if(rows.length!==1)throw Error('unknown_subscription_store');
}
