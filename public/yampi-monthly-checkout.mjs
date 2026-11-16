const COPY = {
  pt: {
    title: 'Como você quer pagar?',
    help: 'Seu acesso é liberado assim que o Mercado Pago confirma.',
    card: 'Cartão de crédito', cardHelp: 'Renovação automática',
    pix: 'Pix no Mercado Pago', pixHelp: 'QR Code no Mercado Pago · renovação manual. Se o botão “Gerar código” ficar desabilitado no Mercado Pago, abra o mesmo link de pagamento em uma janela anônima e tente novamente.',
    switchPix: 'Trocar para Pix no Mercado Pago', switchHelp: 'Encerra a tentativa de cartão ainda não paga',
    switchRequired: 'Há uma tentativa de cartão aberta. Use “Trocar para Pix” para encerrá-la e seguir no Mercado Pago.',
    email: 'E-mail para o pagamento', document: 'CPF ou CNPJ',
    cardSubmit: 'Continuar no Mercado Pago', back: 'Voltar',
    waiting: 'Aguardando confirmação do Mercado Pago. Use “Já paguei: atualizar acesso” para verificar.',
    working: 'Preparando seu pagamento…',
    done: 'Pagamento confirmado. Seu acesso está liberado.', accessActive: 'Seu acesso está liberado.',
    failed: 'Não conseguimos abrir o pagamento. Confira seus dados e tente novamente.',
    conflict: 'Já há uma cobrança aberta ou um período ativo. Confira a assinatura antes de iniciar outra cobrança.',
    legacyPending: 'Existe um pagamento anterior em aberto. Fale com o suporte antes de pagar novamente.',
  },
  en: {
    title: 'How would you like to pay?',
    help: 'Access starts when Mercado Pago confirms your payment.',
    card: 'Credit card', cardHelp: 'Automatic renewal',
    pix: 'Pix on Mercado Pago', pixHelp: 'QR code on Mercado Pago · manual renewal. If the “Generate code” button is disabled in Mercado Pago, open the same payment link in an incognito window and try again.',
    switchPix: 'Switch to Pix on Mercado Pago', switchHelp: 'Closes the unpaid card checkout',
    switchRequired: 'A card checkout is open. Choose Switch to Pix to close it and continue.',
    email: 'Payment email', document: 'CPF or CNPJ',
    cardSubmit: 'Continue to Mercado Pago', back: 'Back',
    waiting: 'Waiting for Mercado Pago. Use “I’ve paid: refresh access” to check.',
    working: 'Preparing your payment…', done: 'Payment confirmed. Your access is active.', accessActive: 'Your access is active.',
    failed: 'Unable to open payment. Check your details and try again.',
    conflict: 'A payment is already open or access is active. Review your subscription before starting another payment.',
    legacyPending: 'An earlier payment is still open. Contact support before paying again.',
  },
  es: {
    title: '¿Cómo prefieres pagar?',
    help: 'Tu acceso se activa cuando Mercado Pago confirma el pago.',
    card: 'Tarjeta de crédito', cardHelp: 'Renovación automática',
    pix: 'Pix en Mercado Pago', pixHelp: 'Código QR en Mercado Pago · renovación manual. Si el botón “Generar código” está deshabilitado en Mercado Pago, abre el mismo enlace de pago en una ventana de incógnito e inténtalo de nuevo.',
    switchPix: 'Cambiar a Pix en Mercado Pago', switchHelp: 'Cierra el intento de tarjeta aún no pagado',
    switchRequired: 'Hay un intento de tarjeta abierto. Elige Cambiar a Pix para cerrarlo y continuar.',
    email: 'Correo del pagador', document: 'CPF o CNPJ',
    cardSubmit: 'Continuar en Mercado Pago', back: 'Volver',
    waiting: 'Esperamos la confirmación de Mercado Pago. Usa “Ya pagué: actualizar acceso” para verificar.',
    working: 'Preparando tu pago…', done: 'Pago confirmado. Tu acceso está activo.', accessActive: 'Tu acceso está activo.',
    failed: 'No pudimos abrir el pago. Revisa los datos e inténtalo de nuevo.',
    conflict: 'Ya tienes un cobro abierto o acceso activo. Revisa la suscripción antes de iniciar otro pago.',
    legacyPending: 'Hay un pago anterior abierto. Contacta con soporte antes de volver a pagar.',
  },
};

export function checkoutDestination(value, method) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://www.mercadopago.com.br' || url.username || url.password) return null;
    const validPath = method === 'pix'
      ? /^\/payments\/\d+\/ticket$/.test(url.pathname) || /^\/checkout\/v1\/redirect\/?$/.test(url.pathname) && !!url.searchParams.get('pref_id')
      : url.pathname === '/subscriptions/checkout';
    return validPath ? url.href : null;
  } catch {
    return null;
  }
}

export function mountYampiCheckout({
  document, root, getLocale, isAuthorized, fetchImpl, navigate,
  onPaid, browser = globalThis.window,
}) {
  const create = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  };
  const copy = () => COPY[(getLocale() || 'pt').slice(0, 2)] || COPY.pt;
  const title = create('h3', 'yampi-checkout-title');
  const help = create('p', 'yampi-checkout-help');
  const choices = create('div', 'yampi-checkout-choices');
  const fields = create('form', 'yampi-checkout-fields');
  const message = create('p', 'yampi-checkout-status');
  message.setAttribute('role', 'status');
  message.setAttribute('aria-live', 'polite');
  message.hidden = true;

  function labeledInput(type) {
    const label = create('label', 'yampi-checkout-label');
    const caption = create('span');
    const input = create('input');
    input.type = type;
    input.required = true;
    label.appendChild(caption);
    label.appendChild(input);
    fields.appendChild(label);
    return { label, caption, input };
  }

  const email = labeledInput('email');
  email.input.autocomplete = 'email';
  const submit = create('button', 'yampi-checkout-submit');
  submit.type = 'submit';
  const back = create('button', 'yampi-checkout-back');
  back.type = 'button';
  fields.appendChild(submit);
  fields.appendChild(back);

  let selected, busy = false, available = false, active = false, paidAccess = false;
  let waiting = false, disposed = false, checking = false, canSwitchHosted = false;
  let statusMessage = '';
  const permitted = () => !disposed && isAuthorized();

  function select(method, focus = true) {
    if (!permitted() || !available || active || busy) return;
    selected = method;
    statusMessage = '';
    render();
    if (method === 'pix') return submitPayment('pix');
    if (focus) email.input.focus();
  }

  function choice(method) {
    const button = create('button', 'yampi-checkout-choice');
    const name = create('strong');
    const description = create('span');
    button.type = 'button';
    button.appendChild(name);
    button.appendChild(description);
    button.addEventListener('click', () => select(method));
    choices.appendChild(button);
    return { button, name, description };
  }

  const card = choice('card');
  const pix = choice('pix');
  for (const node of [title, help, choices, fields, message]) root.appendChild(node);

  function render() {
    const words = copy();
    title.textContent = words.title;
    help.textContent = words.help;
    card.name.textContent = words.card;
    card.description.textContent = words.cardHelp;
    pix.name.textContent = canSwitchHosted ? words.switchPix : words.pix;
    pix.description.textContent = canSwitchHosted ? words.switchHelp : words.pixHelp;
    email.caption.textContent = words.email;
    back.textContent = words.back;
    submit.textContent = selected === 'pix' ? words.pix : words.cardSubmit;
    choices.hidden = !available || active;
    title.hidden = help.hidden = !available || active;
    fields.hidden = selected !== 'card' || !available || active;
    email.input.disabled = busy;
    submit.disabled = back.disabled = busy;
    for (const [method, option] of [['card', card], ['pix', pix]]) {
      option.button.disabled = busy;
      option.button.setAttribute('aria-pressed', String(selected === method));
    }
    const key = active ? (paidAccess ? 'done' : 'accessActive') : busy ? 'working' : statusMessage || (waiting ? 'waiting' : '');
    message.hidden = !key;
    message.textContent = key ? words[key] : '';
  }

  function update({ checkoutAvailable, billing, subscriptionStatus, canSwitchHosted: maySwitch, payerEmail }) {
    const wasActive = active;
    available = checkoutAvailable === true;
    if (typeof maySwitch === 'boolean') canSwitchHosted = maySwitch;
    if (typeof payerEmail === 'string' && !email.input.value) email.input.value = payerEmail;
    active = billing?.status === 'active';
    paidAccess = active && (!billing.accessMode || billing.accessMode === 'payment');
    waiting = !active && ['pending', 'authorized', 'uncertain', 'intent'].includes(subscriptionStatus);
    if (active) {
      selected = undefined;
      statusMessage = '';
      email.input.value = '';
    }
    render();
    if (active && !wasActive) return true;
    return false;
  }

  async function check() {
    if (!permitted() || !available || active || busy || !waiting || checking || document.visibilityState === 'hidden') return;
    checking = true;
    try {
      const response = await fetchImpl('/yampi/billing/monthly/status', { signal: AbortSignal.timeout(10000) });
      if (!response.ok || !permitted()) return;
      const data = await response.json();
      if (!permitted()) return;
      if (update(data)) await onPaid?.();
    } catch {
      // The server continues reconciliation even when this tab is offline.
    } finally {
      checking = false;
    }
  }

  back.addEventListener('click', () => {
    const previous = selected;
    selected = undefined;
    statusMessage = '';
    render();
    (previous === 'pix' ? pix : card).button.focus();
  });

  async function submitPayment(method) {
    if (!permitted() || !selected || !available || active || busy) return;
    const body = method === 'pix' ? { replacePending: canSwitchHosted } : { payerEmail: email.input.value.trim() };
    statusMessage = '';
    busy = true;
    render();
    try {
      const response = await fetchImpl('/yampi/billing/monthly/' + (method === 'pix' ? 'hosted' : 'checkout'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });
      if (!permitted()) return;
      if (response.status === 409) {
        const data = await response.json().catch(() => ({}));
        if (data.error === 'switch_to_hosted_required') { canSwitchHosted = true; statusMessage = 'switchRequired'; }
        else statusMessage = data.error === 'legacy_checkout_requires_review' ? 'legacyPending' : 'conflict';
        return;
      }
      if (!response.ok) throw Error('checkout_failed');
      const data = await response.json();
      if (!permitted()) return;
      selected = undefined;
      waiting = true;
      if (data.checkoutUrl) {
        const destination = checkoutDestination(data.checkoutUrl, method);
        if (!destination) throw Error('invalid_checkout');
        navigate(destination);
      }
    } catch {
      if (permitted()) statusMessage = 'failed';
    } finally {
      busy = false;
      if (permitted()) {
        render();
        if (waiting) void check();
      }
    }
  }
  fields.addEventListener('submit', async event => { event.preventDefault(); return submitPayment(selected); });

  if (browser) {
    browser.addEventListener('focus', check);
    browser.addEventListener('pageshow', check);
  }
  render();

  return {
    select, update, render,
    destroy() {
      disposed = true;
      browser?.removeEventListener('focus', check);
      browser?.removeEventListener('pageshow', check);
    },
  };
}
