'use strict';
/**
 * Billing Notice Adapter — Imagem em Lote
 *
 * Integrates with window.ElunaBillingNotice component.
 * Component CSS/JS loaded in index.html before this script.
 *
 * Contract:
 *   window.ElunaBillingNotice.update({connected,storeId,platform,allowed,status,state,supportUrl,billingUrl})
 *   Retry button emits eluna:billing-retry
 *   Event eluna:billing dispatched on state change
 *
 * Imagem uses demo batches model:
 * - Show blocking when: paymentRequired (platform) OR (demoUsed && !paid)
 * - Never block when demo batches still available
 *
 * Status mapping:
 * - payment_required: platform blocked API access
 * - needs_payment: demo exhausted and purchaseConfigured=true
 * - unverified: demo exhausted but purchaseConfigured=false (can't charge yet)
 * - paid: user paid
 * - demo_available: free batch remaining
 */
(function() {
  const SUPPORT_URL = '/support';
  const BILLING_URL = null; // Nuvemshop native billing

  let lastState = null;
  let lastKnownStoreId = null;

  function update(data) {
    if (!window.ElunaBillingNotice) return;

    // Track storeId across calls — initial connection provides it, later access updates may not
    if (data.storeId) lastKnownStoreId = data.storeId;
    const storeId = data.storeId || lastKnownStoreId || null;

    // Determine if blocking is needed
    // - paymentRequired: platform (Nuvemshop) blocked API access
    // - demoUsed && !paid: free batch consumed, need payment
    const access = data.access || {};
    const paymentRequired = Boolean(data.paymentRequired);
    const needsPayment = !access.paid && access.demoUsed;
    const allowed = data.verificationFailed ? false : !paymentRequired && (!access.demoUsed || access.paid);

    // Status mapping: use payment_required only for platform block or purchaseConfigured=true.
    // When purchaseConfigured=false, use 'unverified' since component may not recognize demo_exhausted.
    let status = null;
    let state = null;
    if (data.verificationFailed) {
      status = 'unverified';
      state = 'unverified';
    } else if (paymentRequired) {
      status = 'payment_required';
      state = 'platform_blocked';
    } else if (needsPayment) {
      // Use payment_required when purchaseConfigured=true; otherwise unverified
      status = access.purchaseConfigured ? 'payment_required' : 'unverified';
      state = access.paymentProvider === 'pending' ? 'pending' : 'needs_payment';
    } else if (access.paid) {
      status = 'paid';
      state = 'active';
    } else if (access.demoBatchesRemaining > 0) {
      status = 'demo_available';
      state = 'demo';
    }

    const detail = {
      connected: Boolean(data.connected),
      storeId: storeId,
      platform: data.platform || 'nuvemshop',
      allowed: allowed,
      status: status,
      state: state,
      supportUrl: SUPPORT_URL,
      billingUrl: BILLING_URL
    };

    // Avoid redundant updates
    const stateKey = JSON.stringify(detail);
    if (stateKey === lastState) return;
    lastState = stateKey;

    window.ElunaBillingNotice.update(detail);
    window.dispatchEvent(new CustomEvent('eluna:billing', { detail }));
  }

  // Listen for retry requests - refresh access state via real routes
  window.addEventListener('eluna:billing-retry', async function() {
    try {
      // Fetch connection status first
      const connectionResponse = await fetch('/auth/status', { cache: 'no-store' });
      const connection = connectionResponse.ok ? await connectionResponse.json() : {};
      if (!connection.connected || !connection.storeId) {
        update({ connected: false, storeId: null, platform: 'nuvemshop', access: {} });
        return;
      }
      // Then fetch access for the billing state
      const accessResponse = await fetch('/sync/access', { cache: 'no-store' });
      const access = accessResponse.ok ? await accessResponse.json() : {};
      update({
        connected: true,
        storeId: connection.storeId,
        platform: connection.platform || 'nuvemshop',
        paymentRequired: Boolean(connection.paymentRequired),
        access: access,
        verificationFailed: !accessResponse.ok
      });
    } catch (error) {
      console.error('Billing retry failed:', error);
    }
  });

  // Expose for integration with existing app.js
  window.BillingNoticeAdapter = { update };
})();
