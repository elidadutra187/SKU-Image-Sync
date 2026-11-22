# Backend Yampi — 22/11/2026

Leituras simultâneas do catálogo no mesmo cliente/lote compartilham a importação. Falhas são descartadas e a próxima tentativa pode recuperar. Catálogos continuam isolados por cliente e loja, sem cache global ou expiração que esconda revogação. Paginação com página incorreta, registro sem ID ou ID repetido aborta, evitando associar produtos a partir de catálogo duplicado/incompleto. Respostas OAuth com tokens vazios/tipos inválidos ou expiração inválida não são aceitas.

Medição em teste: vinte leituras concorrentes de um catálogo de uma página passaram de quarenta chamadas para duas (produtos e SKUs). Isso não é uma medição de redução de fatura em produção. Simulação/envio com API simulada preserva fotos atuais e reserva o lote uma única vez. Suíte: 151 aprovados, um ignorado, zero falhas.

Codex implementou e verificou; Claude Code real fez revisão cruzada somente de leitura com os trechos necessários, sem credenciais. Não foi criado serviço, cache de credenciais, job ou nova cobrança.

Auditoria comercial: loja-infinity20 mantém conexão registrada e o lote gratuito não consumido; nenhum recibo pago no ledger. Isso não comprova um envio real bem-sucedido. Dois ambientes de teste têm lote consumido e ficam bloqueados até pagamento confirmado. Não reiniciar saldo para mascarar o bloqueio.
