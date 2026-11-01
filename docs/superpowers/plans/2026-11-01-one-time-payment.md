# Correção da confirmação do pagamento único

**Goal:** reconhecer BRL 79,99 e preservar confirmações nativas de BRL 79,90 sem gerar outra cobrança.

**Architecture:** manter `platform_once`, HMAC, app, loja, conceito, moeda, período e idempotência. O preço atual brasileiro passa a 79,99; o único preço legado aceito é 79,90 em BRL. ARS mantém o valor anterior. Persistir o valor recebido, nunca substituir o valor do recibo pelo preço atual. O modo adicional `usage_once` permanece desativado em produção e exige seu ID de compra.

**Tech Stack:** Node.js, Express, node:test, jsdom, PostgreSQL/PGlite.

- [x] Em `test/platform-one-time.test.js`, enviar webhooks assinados de 79,99 e 79,90 sem preço configurado; verificar valor exato persistido, rejeição de valores vizinhos, app estrangeiro, moeda e HMAC inválidos. Rodar `node --test test/platform-one-time.test.js` e observar a falha de 79,99.
- [x] Em `services/nativeBilling.js`, atualizar preço padrão brasileiro, permitir somente o preço legado exato no modo fixo e persistir `amount_value` validado. Não ampliar permissões nem gerar cobranças.
- [x] Em `services/purchase.js`, alinhar preço do modo adicional e testar que o modo publicado não executa POST financeiro.
- [x] Atualizar interface, guia, traduções e instruções vigentes para 79,99. Mostrar ausência de confirmação sem afirmar dívida ao consumir o demo. Testar pelo DOM a faixa, o modal e o encaminhamento ao suporte.
- [ ] Executar `npm test`, revisar diff e publicar PR pelo plugin GitHub. Não alterar a cobrança da loja, habilitar cobrança adicional ou realizar pagamento real.
- [ ] Registrar diagnóstico real, limites do 404 de assinatura recorrente e texto ao suporte Nuvemshop com IDs app33268/loja5637867. A liberação financeira permanece dependente da plataforma.

Divisão: Codex implementa, testa e integra. Claude Code foi acionado com revisão delimitada e retornou `Prompt is too long`; revisão não concluída. Não repetir a tentativa nesta execução.
