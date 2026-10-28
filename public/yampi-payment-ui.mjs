/**
 * Yampi Payment UI Factory for Imagem app.
 * One-time purchase only (no monthly subscription).
 * Dynamically loaded only when backend confirms yampi platform.
 * MP never loaded/initialized in Nuvemshop context.
 * @module yampi-payment-ui
 */

const ALLOWED_CHECKOUT_HOST = 'www.mercadopago.com.br';
const ALLOWED_CHECKOUT_PATHS = ['/checkout/v1/redirect', '/mlb/checkout/start'];

/**
 * Validates checkout URL security.
 * @param {string} urlString - URL to validate
 * @returns {URL|null} - Valid URL or null
 */
function validateCheckoutUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') return null;
  let url;
  try { url = new URL(urlString); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  if (url.hostname !== ALLOWED_CHECKOUT_HOST) return null;
  if (!ALLOWED_CHECKOUT_PATHS.includes(url.pathname)) return null;
  if (url.port) return null;
  if (url.username || url.password) return null;
  return url;
}

/**
 * Creates Yampi payment UI for Imagem admin.
 * @param {Object} ctx - Context with dependencies
 * @param {Function} ctx.isAuthorized - Authorization checker (must return boolean)
 * @param {Function} ctx.request - API request function
 * @param {Function} ctx.renderAccess - Access state renderer
 * @param {Function} ctx.message - Message display function
 * @param {Function} ctx.busy - Busy state setter
 * @param {Function} ctx.t - Translation function
 * @param {Function} ctx.confirm - Confirmation dialog
 * @param {Function} ctx.navigate - Navigation function (receives URL)
 * @returns {Object} - {purchase, paymentDescription}
 */
export function createYampiPaymentUI(ctx) {
  const { isAuthorized, request, renderAccess, message, busy, t, confirm, navigate } = ctx;

  // Guard: must be Yampi-authorized before ANY request
  if (typeof isAuthorized !== 'function' || !isAuthorized()) {
    throw new Error('yampi_payment_ui_unauthorized');
  }

  /**
   * Initiates one-time purchase flow.
   */
  async function purchase() {
    // Identity guard before any action
    if (!isAuthorized()) return;

    const confirmMsg = t('Confirma a compra única de R$79,90 por loja, pelo Mercado Pago, sem mensalidade?');
    if (!confirm(confirmMsg)) return;

    // Revalidate after confirm dialog
    if (!isAuthorized()) return;

    busy(true, t('Abrindo o pagamento no Mercado Pago...'));
    try {
      // Revalidate before request
      if (!isAuthorized()) return;

      const data = await request('/yampi/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}'
      });
      if (!isAuthorized()) return;

      // Already paid
      if (data.status === 'paid') {
        const access = await request('/sync/access');
        if (!isAuthorized()) return;
        renderAccess(access);
        return;
      }

      // Validate checkout URL
      const url = validateCheckoutUrl(data.checkoutUrl);
      if (!url) {
        throw new Error('Não foi possível abrir o pagamento. Fale com o suporte.');
      }

      // Revalidate before navigation
      if (!isAuthorized()) return;

      navigate(url.href);
    } catch (error) {
      message(error.message, true);
    } finally {
      busy(false);
    }
  }

  /**
   * Returns payment description string.
   * @returns {string} - Description text
   */
  function paymentDescription() {
    if (!isAuthorized()) return '';
    return 'Pagamento único R$79,90 pelo Mercado Pago, sem mensalidade.';
  }

  return { purchase, paymentDescription };
}
