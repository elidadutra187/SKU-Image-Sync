'use strict';
const {isYampiStoreId,assertYampiStoreId,assertYampiStoreContext}=require('../billingPlatformPolicy.cjs');
const { Router } = require('express');
const { monthEnd, cents } = require('./provider.cjs');
const fail = (code, status = 503) => Object.assign(Error(code), { status });
function createYampiBillingService({ repo, provider, getStore, getEntitlement, checkLegacyCheckout, now = Date.now }) {
    for (const name of ['reserveIntent', 'findContract', 'findStoreContract', 'recordPreapproval', 'recordCheckoutFailure', 'recordPreference', 'findPreapproval', 'applyPayment', 'listContracts'])
        if (typeof repo?.[name] !== 'function')
            throw Error('billing_repository_incomplete');
    if (typeof getStore !== 'function' || typeof getEntitlement !== 'function')
        throw Error('billing_store_adapter_required');
    const configured = () => { if (!provider?.isConfigured())
        throw fail('provider_not_configured'); };
    const hosted = require('./hostedCheckout.cjs').createHostedCheckoutService({repo,provider,getStore,getEntitlement,checkLegacyCheckout,now,monthEnd,cents});
    async function reconcileInvoice(id) { configured(); const invoice = await provider.getAuthorizedPayment(id), contract = await repo.findContract(invoice.externalReference); if (!contract || !isYampiStoreId(contract.store_id) || String(contract.preapproval_id) !== String(invoice.preapprovalId))
        return { ignored: true }; if (invoice.status !== 'approved') {
        if (['refunded', 'charged_back'].includes(invoice.status))
            return reconcilePayment(invoice.paymentId);
        return { pending: true };
    } return repo.applyPayment(invoice); }
    async function reconcilePayment(id) { configured(); const payment = await provider.getPayment(id,{ignoreUnrelated:true});
    if (!payment) return { ignored:true };
    const contract = await repo.findContract(payment.external_reference); if (contract && hosted.isHosted(contract)) return hosted.reconcileHosted(contract); if (!contract?.preapproval_id || !isYampiStoreId(contract.store_id))
        return { ignored: true }; await provider.getPreapproval(contract.preapproval_id, contract.external_reference); if (payment.status === 'approved') return reconcileContract(contract); if (!['refunded', 'charged_back'].includes(payment.status))
        return { ignored: true }; const at = Date.parse(payment.date_approved || ''); if (!Number.isFinite(at) || at > now())
        throw fail('invalid_payment_date', 400); return repo.applyPayment({ paymentId: String(payment.id), preapprovalId: contract.preapproval_id, externalReference: contract.external_reference, status: payment.status, amountCents: cents(payment.transaction_amount), currency: payment.currency_id, dateApproved: new Date(at).toISOString(), periodEnd: monthEnd(at) }); }
    async function reconcileContract(contract) { assertYampiStoreId(contract?.store_id); configured(); if (hosted.isHosted(contract)) return hosted.reconcileHosted(contract); const p = contract.preapproval_id ? await provider.getPreapproval(contract.preapproval_id, contract.external_reference) : await provider.reconcilePreapproval(contract.external_reference); if (!p)
        return { pending: true }; await repo.recordPreapproval(contract.external_reference, p); const invoices = await provider.listInvoices(p.id); let failed=0; for (const row of invoices) { try { await reconcileInvoice(row.id); } catch { failed++; } } if(failed) throw fail('invoice_reconciliation_pending'); return p; }
    async function checkout(storeId, payerEmail) { assertYampiStoreId(storeId); configured(); const store = await getStore(storeId); if (!store || store.installed === false || store.subscriptionOfficialState === 'uninstalled')
        throw fail('store_not_connected', 401); assertYampiStoreContext(storeId,store);
    if (getEntitlement(store, new Date(now())).status === 'active') throw fail('access_already_active', 409);
    await checkLegacyCheckout(storeId);
    const reservation = await repo.reserveIntent({ storeId, payerEmail }); const c = reservation.contract; if (hosted.isHosted(c)) throw fail('pix_checkout_already_open', 409); let p; if (!reservation.created) {
        p = c.preapproval_id ? await provider.getPreapproval(c.preapproval_id, c.external_reference) : await provider.reconcilePreapproval(c.external_reference);
        if (!p)
            throw fail('pending_checkout_requires_reconciliation', 409);
    }
    else {
        try {
            p = await provider.createPreapproval({ payerEmail, externalReference: c.external_reference, trialEndsAt: store.trialEndsAt });
        }
        catch (e) {
            await repo.recordCheckoutFailure(c.external_reference, e?.checkoutRejected === true);
            throw e;
        }
    } await repo.recordPreapproval(c.external_reference, p); return { checkoutUrl: p.status === 'pending' ? provider.checkoutUrl(p) : null, status: p.status, preapprovalId: String(p.id) }; }
    async function cancel(storeId) { assertYampiStoreId(storeId); configured(); const store = await getStore(storeId); if (!store || store.installed === false || store.subscriptionOfficialState === 'uninstalled') throw fail('store_not_connected',401); assertYampiStoreContext(storeId,store); const c = await repo.findStoreContract(storeId); if (!c?.preapproval_id)
        throw fail('no_subscription', 404); const p = await provider.cancelPreapproval(c.preapproval_id, c.external_reference); if (p.status !== 'cancelled')
        throw fail('cancellation_not_confirmed'); await repo.recordPreapproval(c.external_reference, p); return { cancelled: true }; }
    async function status(storeId) { assertYampiStoreId(storeId); const store = await getStore(storeId); if (!store?.installed)
        throw fail('store_not_connected', 401); assertYampiStoreContext(storeId,store); const contract = provider?.isConfigured() ? await repo.findStoreContract(storeId) : null; return { billing: getEntitlement(store, new Date(now())), subscriptionStatus: contract?.status || null, payerEmail: contract?.payer_email || store.email || null, canSwitchHosted: !!contract?.preapproval_id && contract.status === 'pending', canCancel: !!contract?.preapproval_id && contract.status !== 'cancelled', checkoutAvailable: !!provider?.isConfigured() }; }
    async function refresh(storeId) { assertYampiStoreId(storeId); configured(); const store=await getStore(storeId); if(!store||store.installed===false||store.subscriptionOfficialState==='uninstalled') throw fail('store_not_connected',401); assertYampiStoreContext(storeId,store); const contract=await repo.findStoreContract(storeId); if(contract) await reconcileContract(contract); return status(storeId); }
    async function reconcileAll() { configured(); const contracts = await repo.listContracts(); let failed = 0; for (const c of contracts)
        try {
            await reconcileContract(c);
        }
        catch {
            failed++;
        } if (failed)
        throw fail('subscription_reconciliation_pending');
        // Recent contracts (open checkouts, first payment) keep the 5-minute fallback active.
        return { recent: contracts.some(c => Date.now() - new Date(c.created_at).getTime() < 86400000) }; }
    return { ...hosted, checkout, cancel, status, refresh, reconcileInvoice, reconcilePayment, reconcileContract, reconcileAll, isConfigured: () => !!provider?.isConfigured() };
}
function createYampiBillingRouter({ repo, provider, getStore, getEntitlement, checkLegacyCheckout, now = Date.now, baseUrl, trustedOrigins = [], readAdminStoreId }) {
    if (typeof readAdminStoreId !== 'function')
        throw Error('billing_session_adapter_required');
    const service = createYampiBillingService({ repo, provider, getStore, getEntitlement, checkLegacyCheckout, now }), router = Router();
    const origins = new Set([new URL(baseUrl).origin, ...trustedOrigins]);
    const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
    async function session(req, write = false) { const id = await readAdminStoreId(req); if (typeof id !== 'string' || !/^yampi:[a-z0-9][a-z0-9_-]{0,99}$/.test(id))
        throw fail('yampi_session_required', 401); if (write && !origins.has(req.headers.origin))
        throw fail('invalid_origin', 403); return id; }
    router.get('/status', wrap(async (req, res) => { res.set('Cache-Control', 'no-store'); res.json(await service.status(await session(req))); }));
    router.post('/refresh', wrap(async (req, res) => res.json(await service.refresh(await session(req, true)))));
    router.post('/hosted', wrap(async (req, res) => { const id=await session(req,true); try { res.json(await service.checkoutHosted(id,req.body?.replacePending===true,req.headers.origin)); } catch(e) { const known=['switch_to_hosted_required','subscription_not_replaceable','checkout_reconciliation_pending','access_already_active','legacy_checkout_requires_review']; if(known.includes(e.code))return res.status(e.status||409).json({error:e.code}); throw e; } }));
    router.post('/checkout', wrap(async (req, res) => res.json(await service.checkout(await session(req, true), req.body?.payerEmail))));
    router.post('/cancel', wrap(async (req, res) => res.json(await service.cancel(await session(req, true)))));
    router.post('/webhook', wrap(async (req, res) => { if (!service.isConfigured())
        throw fail('provider_not_configured'); const id = req.query['data.id']; if (typeof id !== 'string' || !provider.verifyWebhookSignature({ queryId: id, xRequestId: req.headers['x-request-id'], xSignature: req.headers['x-signature'] }))
        throw fail('invalid_notification', 401); if (req.body?.data?.id != null && String(req.body.data.id) !== id)
        throw fail('notification_id_mismatch', 400); switch (req.body?.type) {
        case 'subscription_authorized_payment':
            await service.reconcileInvoice(id);
            break;
        case 'payment':
            await service.reconcilePayment(id);
            break;
        case 'subscription_preapproval': {
            const c = await repo.findPreapproval(id);
            if (c)
                await service.reconcileContract(c);
            break;
        }
        default: return res.json({ received: true, ignored: true });
    } res.json({ received: true }); }));
    return { router, service };
}
module.exports = { createYampiBillingRouter, createYampiBillingService };
