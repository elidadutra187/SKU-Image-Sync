import { randomUUID } from 'node:crypto';

export const SUPPORT_EMAIL = 'elunalab@gmail.com';
export const SUPPORT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export function supportConfigured(env = process.env) {
  try {
    const url = new URL(env.SUPPORT_WEBHOOK_URL);
    return url.origin === 'https://script.google.com' && /^\/macros\/s\/[^/]+\/exec$/.test(url.pathname) && !url.search && !url.username && !url.password && Boolean(env.SUPPORT_WEBHOOK_SECRET);
  } catch { return false; }
}

export async function sendSupportRequest({ request, attachment }, { env = process.env, fetchImpl = fetch } = {}) {
  if (!supportConfigured(env)) throw new Error('support_not_configured');
  const ticketId = randomUUID();
  async function deliver(message) {
    const response = await fetchImpl(env.SUPPORT_WEBHOOK_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ ...message, secret: env.SUPPORT_WEBHOOK_SECRET })
    });
    if (!response.ok || (await response.json()).ok !== true) throw new Error('support_delivery_failed');
  }
  await deliver({
    to: SUPPORT_EMAIL, replyTo: request.email,
    subject: `[Suporte] Imagem em Lote — ${request.subject}`,
    text: `Protocolo: ${ticketId}\nAplicativo: Imagem em Lote\nNome: ${request.name}\nE-mail: ${request.email}\nLoja: ${request.storeUrl}\n\n${request.message}`,
    attachments: attachment ? [{ filename: attachment.originalname.replace(/[\r\n\\/]/g, '_').slice(0, 150), contentType: attachment.mimetype, content: attachment.buffer.toString('base64') }] : []
  });
  let receiptSent = true;
  try {
    await deliver({ to: request.email, replyTo: SUPPORT_EMAIL,
      subject: `[Imagem em Lote] Chamado recebido - ${ticketId}`,
      text: `Recebemos seu chamado no Imagem em Lote.\n\nProtocolo: ${ticketId}\nAssunto: ${request.subject}\nLoja: ${request.storeUrl}\n\nA equipe responderá pelo e-mail elunalab@gmail.com. Guarde este protocolo para acompanhar o atendimento.`, attachments: [] });
  } catch { receiptSent = false; }
  return { ticketId, receiptSent };
}
