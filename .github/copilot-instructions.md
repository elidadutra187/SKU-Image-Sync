# Instrucoes do agente de qualidade ELUNA Lab

Ao receber uma issue de falha de CI, monitoramento ou melhoria:

1. Reproduza a falha e identifique causa raiz com evidencias dos testes e logs. Nao presuma que o banco ou a API esta com problema por um unico HTTP de erro.
2. Execute `npm ci` e `npm test` e demais scripts existentes; adicione testes de regressao pertinentes.
3. Revise autenticacao OAuth, webhooks, limites/rate limits, idempotencia, expiracao de assinatura e permissoes da Nuvemshop sempre que aplicavel.
4. Revise uso de Neon/PostgreSQL: chamadas repetidas, SELECT *, paginacao, JOINs, transacoes, pool e volume de egress. Evite mudancas no schema sem migracao testada e estrategia de rollback.
5. Revise endpoints /health, timeouts, reconexao, filas, memoria, retry/backoff, limites de API e logs sem dados pessoais.
6. Proponha melhorias pequenas, mensuraveis e reversiveis em pull requests separados. Descreva risco, testes, impacto na integracao e modo de verificar em producao.
7. NUNCA copie tokens, URLs com credenciais, dados de clientes ou secrets para issues, logs ou PRs.
8. NUNCA execute operacoes mutaveis reais na API Nuvemshop nem escreva em Neon/Railway de producao como parte de testes. Use mocks, fixtures e ambientes de teste.
9. NUNCA faca merge automatico, deploy, alteracao de variaveis, cancelamento de assinaturas ou remocao de dados. Solicite revisao humana.
10. Se a issue tiver causa externa ou credenciais opcionais ausentes, explique claramente e marque como pendencia de configuracao; nao invente validacao.

As GitHub Actions sao o sinal objetivo inicial. Uma pipeline verde nao prova que OAuth, faturamento, webhooks ou banco de producao estejam saudaveis. Relate cobertura e lacunas.
