(() => {
  const form = document.querySelector('#supportForm');
  const status = document.querySelector('#supportStatus');
  const button = document.querySelector('#supportSubmit');
  const messages = {
    invalid_support_request: 'Confira os campos. O anexo precisa ser uma imagem, PDF, texto ou documento válido.',
    attachment_too_large: 'O anexo excede o limite de 5 MB.',
    support_rate_limit_exceeded: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.',
    support_not_configured: 'O formulário está indisponível no momento. Escreva para elunalab@gmail.com.',
    support_delivery_unavailable: 'Não conseguimos confirmar o envio. Você pode escrever para elunalab@gmail.com.'
  };
  function show(message, type, focus = true) {
    status.hidden = false; status.className = 'status ' + type; status.textContent = message; if (focus) status.focus();
  }
  fetch('/support/status').then(r => r.json()).then(data => {
    if (!data.configured) { button.disabled = true; show(messages.support_not_configured, 'error', false); }
  }).catch(() => {});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const file = form.elements.attachment.files[0];
    if (file?.size > 5 * 1024 * 1024) return show(messages.attachment_too_large, 'error');
    button.disabled = true; button.textContent = 'Enviando…';
    try {
      const response = await fetch('/support', { method: 'POST', body: new FormData(form), signal: AbortSignal.timeout(40000) });
      const data = await response.json();
      if (!response.ok || data.mailStatus !== 'sent') throw new Error(messages[data.error] || messages.support_delivery_unavailable);
      show('Chamado enviado. Protocolo: ' + data.ticketId + '. ' + (data.receiptSent ? 'Enviamos um comprovante para ' + data.receiptEmail + '.' : 'Seu chamado chegou à equipe; o comprovante por e-mail não pôde ser enviado.'), 'success');
      form.reset();
    } catch (error) {
      show(error.name === 'TimeoutError' ? 'O envio demorou e não foi possível confirmá-lo. Confira seu e-mail antes de reenviar ou escreva para elunalab@gmail.com.' : (error.message || messages.support_delivery_unavailable), 'error');
    } finally { button.disabled = false; button.textContent = 'Enviar chamado'; }
  });
})();
