# Cobrança e persistência — 25/10/2026

Produção sem DATABASE_URL agora retorna503, sem ler ou gravar o arquivo local de OAuth. Pool com limite de conexões, timeout e tratamento de falha ociosa; inicialização do schema é compartilhada por chamadas concorrentes e pode ser repetida após falha.

Modelo vigente definido pela proprietária: um lote demo de até10 imagens e pagamento único79,90 via cobrança nativa. Não converter a data Último pagamento do Partners em paid_at automaticamente: contratos recorrentes antigos e compra única são modelos distintos. Pagamento único exige evento charge/paid assinado do próprio app, compra conhecida e validação de valor/moeda/conceito, já presentes no código.

Auditoria24/10: duas instalações legadas do Partners não tinham registro OAuth no banco usado pela Railway. Não há token que possa ser inventado; precisam recuperação verificável de instalação antiga ou reautorização. O cruzamento financeiro permanece exclusivamente no relatório operacional local. Há lacuna de migração entre modelos; isso não autoriza cobrar novamente.

Ambiente consultado24/10 não tinha os controles NUVEMSHOP_NATIVE_BILLING, NUVEMSHOP_BILLING_MODEL e NUVEMSHOP_ONE_TIME_PRICE exigidos para iniciar novas compras. Não ativados nesta rodada, para não cobrar de novo clientes do modelo antigo.

Validação local:55 testes aprovados e um teste PostgreSQL explicitamente ignorado. Código ainda sem integração/publicação. Nenhuma cobrança, upload real ou alteração de catálogo efetuada pela auditoria.
