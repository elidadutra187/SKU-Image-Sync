import {yampiPool} from '../yampiStore.js';
import {readStoreSession} from '../session.js';
import {createPurchaseLedger} from '../yampiPurchaseLedger.js';
import policyModule from '../billingPlatformPolicy.cjs';
import providerModule from './provider.cjs';
import repositoryModule from './repository.cjs';
import routerModule from './router.cjs';

const {createBillingPolicy, isYampiStoreId} = policyModule;
const policy = createBillingPolicy();
export const YAMPI_MONTHLY_PRICE_CENTS = 3990;

export function monthlyEntitlement(store, now = new Date()) {
  const paidUntil = new Date(store?.yampi_paid_until).getTime();
  const courtesy = Date.parse(store?.courtesy_until) > now.getTime();
  const active = Boolean(store?.installed && (store.legacy_paid_at || courtesy || paidUntil > now.getTime()));
  return {
    status: active ? 'active' : 'expired',
    accessMode: store?.legacy_paid_at ? 'legacy' : paidUntil > now.getTime() ? 'payment' : 'courtesy',
    monthlyPriceCents: YAMPI_MONTHLY_PRICE_CENTS,
    paidUntil: active && !store.legacy_paid_at && paidUntil > now.getTime() ? new Date(paidUntil).toISOString() : null,
  };
}

export function buildYampiMonthlyBilling({env=process.env, poolProvider=yampiPool, sessionReader=readStoreSession, fetchImpl=fetch}={}) {
  const baseUrl = env.APP_URL || env.RENDER_EXTERNAL_URL || 'http://localhost:4315';
  const token = env.YAMPI_MP_ACCESS_TOKEN || '';
  const testCredential = token.startsWith('TEST-') || env.YAMPI_MP_TEST_ACCOUNT_VERIFIED === 'true';
  const live = env.YAMPI_MP_MODE === 'production' && env.YAMPI_MP_PRODUCTION_ENABLED === 'true' && !testCredential;
  const test = (env.YAMPI_MP_MODE || 'test') === 'test' && testCredential;
  const testStores = new Set((env.YAMPI_MP_TEST_STORE_IDS || '').split(',').map(id => id.trim()));
  const eligible = id => isYampiStoreId(id) && Boolean(policy.assertProvider({appCode:'IE',platform:'yampi',storeId:id},'mercadopago')) && (live || testStores.has(id));
  const provider = providerModule.createMercadoPagoClient({
    appCode:'IE', priceCents:YAMPI_MONTHLY_PRICE_CENTS, baseUrl, fetchImpl,
    accessToken:token, webhookSecret:env.YAMPI_MP_WEBHOOK_SECRET,
    collectorId:env.YAMPI_MP_COLLECTOR_ID, applicationId:env.YAMPI_MP_APPLICATION_ID,
    enabled:env.YAMPI_MP_ENABLED === 'true' && env.YAMPI_MP_MONTHLY_ENABLED === 'true' && (live || test),
  });

  async function getStore(id) {
    if (!eligible(id)) return null;
    const pool = await poolProvider();
    const {rows:[row]} = await pool.query(
      `SELECT a.paid_at AS legacy_paid_at,a.yampi_paid_until,a.courtesy_until
        FROM image_sync_yampi_stores s LEFT JOIN image_sync_access a ON a.store_id=$1
        WHERE s.alias=$2`, [id,id.slice(6)],
    );
    return row ? {...row, storeId:id, platform:'yampi', installed:true} : null;
  }

  async function checkLegacyCheckout(id) {
    const pool = await poolProvider();
    await legacyLedger(pool).init();
    const {rows:[row]} = await pool.query(
      `SELECT status FROM yampi_purchase_intents WHERE store_id=$1
        AND status IN ('intent','uncertain','pending','paid') LIMIT 1`, [id],
    );
    if (row) throw Object.assign(Error('legacy_checkout_requires_review'), {status:409,code:'legacy_checkout_requires_review'});
  }

  let legacy;
  function legacyLedger(pool) { return legacy ??= createPurchaseLedger(pool); }

  let repositoryPromise;
  function repository() {
    return repositoryPromise ??= poolProvider().then(pool => repositoryModule.createYampiSubscriptionRepository({
      pool, appCode:'IE', priceCents:YAMPI_MONTHLY_PRICE_CENTS,
      async lockCheckout(db,id) {
        const {rows} = await db.query(
          `SELECT alias FROM image_sync_yampi_stores WHERE alias=$1
           AND (billing_disconnect_until IS NULL OR billing_disconnect_until<=now()) FOR UPDATE`,[id.slice(6)]);
        if (!rows.length) throw Object.assign(Error('store_not_available_for_checkout'),{status:409});
      },
      async lockStore(db,id) {
        await db.query('INSERT INTO image_sync_access (store_id,demo_batches_used) VALUES($1,0) ON CONFLICT DO NOTHING',[id]);
        await db.query('SELECT store_id FROM image_sync_access WHERE store_id=$1 FOR UPDATE',[id]);
      },
      async projectEntitlement(db,id,payment) {
        await db.query('UPDATE image_sync_access SET yampi_paid_until=$2 WHERE store_id=$1 AND yampi_paid_until IS DISTINCT FROM $2',
          [id,payment.paidUntil]);
      },
    })).catch(error => { repositoryPromise=undefined; throw error; });
  }
  const methods = ['reserveIntent','findContract','findStoreContract','recordPreapproval','recordCheckoutFailure',
    'recordPreference','applyPayment','findPreapproval','listContracts'];
  const repo = Object.fromEntries(methods.map(name => [name,async (...args)=>(await repository())[name](...args)]));
  const {router,service} = routerModule.createYampiBillingRouter({
    repo,provider,baseUrl,getStore,getEntitlement:monthlyEntitlement,checkLegacyCheckout,readAdminStoreId:sessionReader,
  });
  async function disconnect(id, remove) {
    if (!eligible(id) || !provider.isConfigured()) return remove();
    const pool = await poolProvider();
    const until = new Date(Date.now()+300_000).toISOString();
    const {rows} = await pool.query(
      `UPDATE image_sync_yampi_stores SET billing_disconnect_until=$2 WHERE alias=$1
       AND (billing_disconnect_until IS NULL OR billing_disconnect_until<=now()) RETURNING alias`,
      [id.slice(6),until],
    );
    if (!rows.length) throw Object.assign(Error('A loja já está desconectada ou em desconexão.'),{status:409});
    try {
      const contract = await repo.findStoreContract(id);
      if (contract?.preapproval_id && ['pending','authorized','paused'].includes(contract.status))
        await service.cancel(id);
      else if (contract?.external_reference.includes(':monthly:') && ['intent','uncertain'].includes(contract.status))
        throw Object.assign(Error('Não foi possível confirmar o encerramento da renovação. Verifique a assinatura antes de desconectar.'),{status:409});
      return await remove();
    } finally {
      await pool.query('UPDATE image_sync_yampi_stores SET billing_disconnect_until=NULL WHERE alias=$1 AND billing_disconnect_until=$2',
        [id.slice(6),until]);
    }
  }
  return {router,service,disconnect,available:id=>eligible(id)&&provider.isConfigured()};
}
let monthly;
export const getYampiMonthlyBilling = () => monthly ??= buildYampiMonthlyBilling();
