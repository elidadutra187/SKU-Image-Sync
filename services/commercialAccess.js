import {getPool, initializeDatabase} from './database.js';
import {platformBillingConfigured} from './nativeBilling.js';
import {getYampiPaymentRuntime} from './yampiPaymentRuntime.js';
export const DEMO_PRODUCTS = 10;
export const DEMO_IMAGES = 10;
export const DEMO_BATCHES = 1;

function denied(message,status=402) { return Object.assign(new Error(message),{status}); }
const paidAccessMessage=access=>access.purchaseMode==='platform_monthly'
  ? 'O período de teste ou a assinatura terminou. Regularize o Imagem em Lote na Nuvemshop para voltar a enviar imagens.'
  : `Seu lote gratuito já foi utilizado. O pagamento único de R${((access.oneTimePriceCents??7999)/100).toFixed(2).replace('.',',')} libera novos lotes e reutilizações.`;

const transientConnectionCodes = new Set(['08000','08001','08003','08006','57P01','57P02','57P03',
  'ECONNRESET','ECONNREFUSED','ETIMEDOUT','EAI_AGAIN','EPIPE']);

async function readAccessWithRetry(read,storeId) {
  try { return await read(); }
  catch (error) {
    if (!transientConnectionCodes.has(error?.code)) throw error;
  }
  await new Promise(resolve=>setTimeout(resolve,250));
  try { return await read(); }
  catch (error) {
    if (!transientConnectionCodes.has(error?.code)) throw error;
    const id=String(storeId);
    console.warn(JSON.stringify({event:'billing_verification_temporarily_unavailable',
      storeId:/^[0-9]{1,20}$/.test(id)?id:undefined,reason:error.code}));
    throw denied('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);
  }
}
export function validateBatchAccess(access,count,imageCount=count) {
  if (access.platformSuspended) throw denied('O acesso da loja está suspenso na Nuvemshop.');
  if (!Number.isInteger(count) || count < 1) throw denied('Selecione ao menos um produto.',400);
  if (count > 50) throw denied('Envie até 50 produtos por lote.',400);
  if (access.paid || access.trialActive || access.courtesyActive) return;
  if (access.demoBatchesUsed >= DEMO_BATCHES) throw denied(paidAccessMessage(access));
  if (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > DEMO_IMAGES) throw denied('O lote gratuito permite no máximo 10 imagens. Selecione até 10 fotos para continuar.');
}

// Separate from OAuth records: reconnecting does not grant another free batch.
export function createPostgresAccessRepository(poolProvider=getPool,initialize=initializeDatabase) { return {
  async pool() {
    const pool=poolProvider();
    if (!pool) throw denied('Não foi possível verificar seu acesso. Tente novamente mais tarde.',503);
    await initialize();
    return pool;
  },
  async status(storeId) {
    const pool=await this.pool();
    const {rows}=await readAccessWithRetry(()=>pool.query(`select a.paid_at,a.demo_batches_used,
      a.courtesy_until>statement_timestamp() as courtesy_active,p.status as purchase_status,
      m.paid_until,m.trial_until,m.lifecycle,m.partners_free,m.partners_paid_until,
      (coalesce(m.platform_suspended,false) or coalesce(m.lifecycle<>'active',false)) as platform_suspended,
      m.partners_paid_until>statement_timestamp() as partners_paid,
      (m.paid_until>statement_timestamp() and m.lifecycle='active' and not m.platform_suspended) as monthly_paid,
      (m.trial_until>statement_timestamp() and m.lifecycle='active' and not m.platform_suspended) as trial_active
      from (select $1::text as store_id) s
      left join image_sync_access a on a.store_id=s.store_id
      left join image_sync_monthly m on m.store_id=s.store_id
      left join image_sync_purchase p on p.store_id=s.store_id`,[storeId]),storeId);
    const row=rows[0]||{};
    return {paid:(Boolean(row.paid_at)||Boolean(row.monthly_paid)||Boolean(row.partners_free)||Boolean(row.partners_paid))&&!row.platform_suspended,
      trialActive:Boolean(row.trial_active),courtesyActive:Boolean(row.courtesy_active)&&!row.platform_suspended,
      demoBatchesUsed:row.demo_batches_used??0,purchaseStatus:row.purchase_status||null,
      subscriptionUntil:row.partners_free?null:row.partners_paid_until||row.paid_until||null,trialUntil:row.trial_until||null,
      subscriptionState:row.lifecycle||null,platformSuspended:Boolean(row.platform_suspended)};
  },
  async reserve(storeId) {
    const pool=await this.pool();
    // A single conditional upsert serializes concurrent requests, including different instances.
    const {rows}=await pool.query(`
      insert into image_sync_access (store_id, demo_used_at, demo_batches_used)
      select $1,now(),1 where not exists(select 1 from image_sync_monthly
        where store_id=$1 and (platform_suspended or lifecycle<>'active'))
      on conflict (store_id) do update set
        demo_used_at=coalesce(image_sync_access.demo_used_at,now()),
        demo_batches_used=image_sync_access.demo_batches_used+1
      where image_sync_access.demo_batches_used < $2 and image_sync_access.paid_at is null
      returning store_id`,[storeId,DEMO_BATCHES]);
    return rows.length === 1;
  }
}; }
const postgresRepository=createPostgresAccessRepository();

export function createCommercialAccess(repository=postgresRepository) {
  return {
    async status(storeId) {
      if (!storeId) throw denied('Conecte sua loja para continuar.',401);
      const current=await repository.status(storeId);
      if(!Number.isInteger(current.demoBatchesUsed) || current.demoBatchesUsed<0) {
        throw denied('Não foi possível verificar os lotes gratuitos. Tente novamente mais tarde.',503);
      }
      return {...current,demoUsed:current.demoBatchesUsed>=DEMO_BATCHES,
        demoBatches:DEMO_BATCHES,demoBatchesRemaining:Math.max(0,DEMO_BATCHES-current.demoBatchesUsed),demoProducts:DEMO_PRODUCTS,demoImages:DEMO_IMAGES,
        oneTimePriceCents:storeId.startsWith('yampi:')?7990:Math.round(Number(process.env.NUVEMSHOP_ONE_TIME_PRICE||'79.99')*100),
        monthlyPriceCents:Math.round(Number(process.env.NUVEMSHOP_MONTHLY_PRICE||'39.90')*100),
        trialDays:3,
        purchaseConfigured:storeId.startsWith('yampi:')?getYampiPaymentRuntime().available(storeId):platformBillingConfigured(),
        purchaseMode:storeId.startsWith('yampi:')?'mercadopago_once':process.env.NUVEMSHOP_BILLING_MODEL||'platform_once',
        paymentProvider:storeId.startsWith('yampi:')?(getYampiPaymentRuntime().available(storeId)?'mercadopago':'pending'):'nuvemshop'};
    },
    async authorize(storeId, productIds, {dryRun=false,imageCount=productIds.length}={}) {
      const access=await this.status(storeId);
      validateBatchAccess(access,new Set(productIds.map(String)).size,imageCount);
      if (!dryRun && !access.paid && !access.trialActive && !access.courtesyActive && !await repository.reserve(storeId)) {
        throw denied(paidAccessMessage(access));
      }
      return access;
    }
  };
}
export default createCommercialAccess();
