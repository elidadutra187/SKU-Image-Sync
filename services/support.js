import { randomUUID } from 'node:crypto';
import logger from '../utils/logger.js';

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
    // ContentService returns a single-use response URL; each delivery must be independent.
    const deliveryUrl=new URL(env.SUPPORT_WEBHOOK_URL);
    deliveryUrl.searchParams.set('request_id',randomUUID());
    let response;
    try { response = await fetchImpl(deliveryUrl.href, {
      method: 'POST', headers: { 'Content-Type': 'application/json','Cache-Control':'no-store' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ ...message, secret: env.SUPPORT_WEBHOOK_SECRET })
    }); } catch {logger.warn('support_provider_network_failure');throw new Error('support_delivery_failed');}
    let result;try{result=await response.json();}catch{logger.warn(`support_provider_non_json_${response.status || 0}`);throw new Error('support_delivery_failed');}
    if (!response.ok || result.ok !== true) {
      const known=['invalid_secret','missing_recipient','invalid_message','invalid_destination','invalid_attachment','send_failed'];
      logger.warn(`support_provider_rejected_${response.status || 0}_${known.includes(result.error)?result.error:'unknown'}`);
      throw new Error('support_delivery_failed');
    }
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
