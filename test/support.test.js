import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createSupportRouter } from '../routes/support.js';
import { sendSupportRequest } from '../services/support.js';

function form(values = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ name: 'Pessoa', email: 'pessoa@example.com', storeUrl: 'https://loja.example.com', subject: 'Preciso de ajuda', message: 'Não consegui enviar as fotos.', ...values })) data.set(key, value);
  return data;
}
async function run(options, fn) {
  const app = express(); app.use('/support', createSupportRouter(options));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try { await fn(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}
test('suporte entrega os cinco campos e um anexo, confirmando somente envio real', async () => {
  await run({ send: async ({ request, attachment }) => {
    assert.equal(request.email, 'pessoa@example.com'); assert.equal(attachment.originalname, 'erro.txt');
    return { ticketId: 'protocolo', receiptSent: true };
  } }, async origin => {
    const data = form(); data.set('attachment', new Blob(['erro'], { type: 'text/plain' }), 'erro.txt');
    const response = await fetch(`${origin}/support`, { method: 'POST', body: data });
    assert.equal(response.status, 200); assert.equal((await response.json()).mailStatus, 'sent');
  });
});
test('suporte rejeita origem externa, campos excessivos, URL inválida e executável', async () => {
  await run({ send: () => assert.fail('não enviar') }, async origin => {
    for (const data of [form({ storeUrl: 'javascript:alert(1)' }), form({ message: 'x'.repeat(11000) }), form({ email: 'a@example.com\r\nBcc:b@example.com' })]) {
      assert.equal((await fetch(`${origin}/support`, { method: 'POST', body: data })).status, 422);
    }
    const executable = form(); executable.set('attachment', new Blob(['x'], { type: 'application/octet-stream' }), 'arquivo.exe');
    assert.equal((await fetch(`${origin}/support`, { method: 'POST', body: executable })).status, 422);
    assert.equal((await fetch(`${origin}/support`, { method: 'POST', body: form(), headers: { Origin: 'https://outro.example.com' } })).status, 403);
  });
});
test('suporte limita tentativas e não expõe erro interno nem confirma envio que falhou', async () => {
  await run({ maxRequests: 1, send: async () => { throw new Error('credencial privada'); } }, async origin => {
    const response = await fetch(`${origin}/support`, { method: 'POST', body: form() });
    assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /privada|sent|saved_only/);
    assert.equal((await fetch(`${origin}/support`, { method: 'POST', body: form() })).status, 429);
  });
});
test('provedor usa destinatário fixo, anexo e comprovante, sem aceitar destinatário do cliente', async () => {
  const calls = [];
  const result = await sendSupportRequest({ request: { name: 'Pessoa', email: 'pessoa@example.com', storeUrl: 'https://loja.example.com', subject: 'Ajuda', message: 'Teste', to: 'outro@example.com' }, attachment: { buffer: Buffer.from('anexo'), originalname: 'erro.txt', mimetype: 'text/plain' } }, {
    env: { SUPPORT_WEBHOOK_URL: 'https://script.google.com/macros/s/EXEMPLO/exec', SUPPORT_WEBHOOK_SECRET: 'segredo-exclusivo' },
    fetchImpl: async (url, options) => { calls.push(JSON.parse(options.body)); return { ok: true, json: async () => ({ ok: true, messageId: 'id' }) }; }
  });
  assert.equal(calls[0].to, 'elunalab@gmail.com'); assert.equal(calls[0].attachments[0].content, Buffer.from('anexo').toString('base64'));
  assert.equal(calls[1].to, 'pessoa@example.com'); assert.match(calls[1].subject, /Imagem em Lote/); assert.equal(result.receiptSent, true);
});
test('configuração ausente falha explicitamente e falha de comprovante preserva confirmação do chamado entregue', async () => {
  await assert.rejects(sendSupportRequest({ request: {} }, { env: {} }), /support_not_configured/);
  let count = 0;
  const result = await sendSupportRequest({ request: { name: 'Pessoa', email: 'pessoa@example.com', subject: 'Ajuda', message: 'Teste', storeUrl: 'https://loja.example.com' } }, {
    env: { SUPPORT_WEBHOOK_URL: 'https://script.google.com/macros/s/EXEMPLO/exec', SUPPORT_WEBHOOK_SECRET: 'segredo' },
    fetchImpl: async () => ({ ok: true, json: async () => ({ ok: ++count === 1 }) })
  });
  assert.equal(result.receiptSent, false); assert.ok(result.ticketId);
});
