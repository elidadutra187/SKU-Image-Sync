import billingPlatformPolicy from './billingPlatformPolicy.cjs';
const {createBillingPolicy,isYampiStoreId,assertYampiStoreId}=billingPlatformPolicy;
const billingPolicy=createBillingPolicy();
import { Router } from 'express';
import { createOneTimeProvider } from './yampiPaymentProvider.js';
import { createPurchaseLedger } from './yampiPurchaseLedger.js';
import { yampiPool } from './yampiStore.js';
import { readStoreSession } from './session.js';
const fail = (message, status = 503) => Object.assign(Error(message), { status });
export function buildYampiPaymentRuntime({ env = process.env, poolProvider = yampiPool, sessionReader = readStoreSession, provider: injectedProvider } = {}) {
    const baseUrl = env.APP_URL || env.RENDER_EXTERNAL_URL || 'http://localhost:4315';
    const testStores = new Set((env.YAMPI_MP_TEST_STORE_IDS || '').split(',').map(s => s.trim()));
    const live = env.YAMPI_MP_MODE === 'production' && env.YAMPI_MP_PRODUCTION_ENABLED === 'true';
    const test = (env.YAMPI_MP_MODE || 'test') === 'test' && (String(env.YAMPI_MP_ACCESS_TOKEN || '').startsWith('TEST-') || env.YAMPI_MP_TEST_ACCOUNT_VERIFIED === 'true');
    const provider = injectedProvider || createOneTimeProvider({ baseUrl, enabled: env.YAMPI_MP_ENABLED === 'true' && (live || test), accessToken: env.YAMPI_MP_ACCESS_TOKEN, webhookSecret: env.YAMPI_MP_WEBHOOK_SECRET, collectorId: env.YAMPI_MP_COLLECTOR_ID, applicationId: env.YAMPI_MP_APPLICATION_ID });
    const eligible = id => isYampiStoreId(id) && !!billingPolicy.assertProvider({appCode:'IE',platform:'yampi',storeId:id},'mercadopago') && (live || testStores.has(id));
    const available = id => eligible(id) && provider.isConfigured();
    let repoPromise;
    async function repository() {
        if (!provider.isConfigured())
            throw fail('payment_not_configured');
        repoPromise ??= poolProvider().then(pool => createPurchaseLedger(pool)).catch(e => { repoPromise = null; throw e; });
        return repoPromise;
    }
    async function authenticated(req, write = false) {
        const id = sessionReader(req);
        if (!/^yampi:[a-z0-9][a-z0-9_-]{0,99}$/.test(id || ''))
            throw fail('Conecte sua loja Yampi para continuar.', 401);
        if (write && req.headers.origin !== new URL(baseUrl).origin)
            throw fail('Origem não autorizada.', 403);
        if (!available(id))
            throw fail('O pagamento está em preparação. Fale com o suporte.');
        const pool = await poolProvider();
        const found = await pool.query('SELECT alias FROM image_sync_yampi_stores WHERE alias=$1', [id.slice(6)]);
        if (!found.rows[0])
            throw fail('Conecte sua loja Yampi para continuar.', 401);
        return id;
    }
    async function checkout(storeId) { assertYampiStoreId(storeId);
        const repo = await repository(), reservation = await repo.reserve(storeId), intent = reservation.intent;
        if (intent.status === 'paid')
            return { status: 'paid', checkoutUrl: null };
        let preference;
        if (reservation.created) {
            try {
                preference = await provider.createPreference(intent.external_reference);
            }
            catch (e) {
                await repo.uncertain(intent.external_reference);
                throw e;
            }
        }
        else {
            preference = intent.preference_id ? await provider.getPreference(intent.preference_id, intent.external_reference) : await provider.findPreference(intent.external_reference);
            if (!preference)
                throw fail('A criação do pagamento está sendo verificada. Fale com o suporte antes de tentar novamente.', 409);
        }
        await repo.savePreference(intent.external_reference, preference);
        if (!reservation.created) {
            for (const id of await provider.listPayments(intent.external_reference)) {
                const payment = await provider.getPayment(String(id), preference);
                const result = await repo.apply(payment);
                if (result.paid)
                    return { status: 'paid', checkoutUrl: null };
            }
        }
        return { status: 'pending', checkoutUrl: provider.checkoutUrl(preference) };
    }
    async function reconcilePayment(id) {
        const repo = await repository(), reference = await provider.paymentReference(id), intent = await repo.find(reference);
        if (!intent?.preference_id)
            return { ignored: true };
        assertYampiStoreId(intent.store_id); const preference = await provider.getPreference(intent.preference_id, reference), payment = await provider.getPayment(id, preference);
        return repo.apply(payment);
    }
    async function reconcileAll() {
        if (!provider.isConfigured())
            return;
        const repo = await repository();
        let failed = 0;
        for (const intent of await repo.list()) {
            try {
                assertYampiStoreId(intent.store_id);
                const preference = intent.preference_id ? await provider.getPreference(intent.preference_id, intent.external_reference) : await provider.findPreference(intent.external_reference);
                if (!preference)
                    continue;
                await repo.savePreference(intent.external_reference, preference);
                for (const id of await provider.listPayments(intent.external_reference))
                    await reconcilePayment(String(id));
            }
            catch {
                failed++;
            }
        }
        if (failed)
            throw fail('payment_reconciliation_pending');
    }
    const router = Router(), wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
    router.post('/checkout', wrap(async (req, res) => { const storeId = await authenticated(req, true); res.set('Cache-Control', 'no-store'); res.json({ success: true, ...await checkout(storeId) }); }));
    router.post('/webhook', wrap(async (req, res) => {
        const id = req.query['data.id'];
        if (!provider.isConfigured())
            throw fail('payment_not_configured');
        if (!provider.verifyWebhookSignature({ queryId: id, xRequestId: req.headers['x-request-id'], xSignature: req.headers['x-signature'] }))
            throw fail('invalid_notification', 401);
        if (req.body?.data?.id != null && String(req.body.data.id) !== id)
            throw fail('notification_id_mismatch', 400);
        if (req.body?.type === 'payment')
            await reconcilePayment(id);
        res.json({ received: true });
    }));
    let timer, running = false, stopped = false;
    const reconcile = async () => { if (running || stopped || !provider.isConfigured())
        return; running = true; try {
        await reconcileAll();
    }
    catch {
        console.error('Confirmação de pagamentos pendente; nova tentativa automática.');
    }
    finally {
        running = false;
    } };
    return { router, available, checkout, reconcilePayment, reconcileAll, start() { if (provider.isConfigured() && !timer) {
            timer = setInterval(reconcile, 1800000);
            timer.unref();
            void reconcile();
        } }, stop() { stopped = true; clearInterval(timer); } };
}
let runtime;
export const getYampiPaymentRuntime = () => runtime ??= buildYampiPaymentRuntime();
