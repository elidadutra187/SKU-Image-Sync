# Preparação para reabertura — 04/10/2026

O fluxo anterior exigia pastas por SKU e expunha termos técnicos. O novo fluxo permite selecionar várias imagens pelo nome do arquivo, conferir as associações e enviar apenas os grupos selecionados.

## Implementado nesta revisão

- Associação por SKU exato, depois nome completo normalizado; acentos e separadores são normalizados.
- Sequências _01, _02 e _03 agrupam fotos. Catálogo de produtos é consultado na loja autenticada.
- Nomes duplicados e sugestões incompletas ficam sem produto até uma escolha manual validada no catálogo e API da loja.
- Pastas com SKU e CSV permanecem disponíveis em opções avançadas.
- Prévia mostra fotos enviadas e fotos atuais. Simulação não altera imagens.
- Grupos associados ao mesmo produto são processados juntos para não apagar fotos de um grupo anterior no modo de substituição.
- Fotos idênticas dentro de uma operação são deduplicadas por hash.
- Demo limitado a um lote de até 10 produtos distintos, com reserva condicional atômica no PostgreSQL, independente da instalação OAuth.
- Envios por caminhos locais foram retirados da API HTTP; a CLI administrativa continua disponível.
- Sessões, fotos temporárias, relatórios e jobs exigem autenticação e vínculo com a loja.
- Manual token de outra loja não substitui o token da loja autenticada.
- Novos guia, suporte e privacidade. Contato elunalab@gmail.com; suporte abre o aplicativo de e-mail, com anexos enviados pelo próprio cliente.

## Validação realizada

20 testes Node passaram, incluindo associação por nome/SKU, ambiguidade, agrupamento, paginação, reserva concorrente simulada, limites de acesso, fluxo HTTP e validação de confirmação nativa de pagamento. Sintaxe do script da interface e `git diff --check` passaram. Tela inicial e guia foram revisados no navegador local. A reserva concorrente usa um repositório em memória nos testes; não foi executada em PostgreSQL real nesta revisão.

## Pendências para reabrir

1. Confirmar preço e configurar **Valor único no Partners**, pela cobrança nativa da Nuvemshop, conforme decisão da usuária. R$99,90 por loja é sugestão. O webhook `/webhooks/billing` valida a assinatura HMAC do corpo original, `app_id`, loja, valor, moeda e conceito antes de liberar acesso de modo idempotente. `charge/failed` e eventos de outros apps não liberam nada. Não há checkout externo nem criação de cobranças pela aplicação. `NUVEMSHOP_NATIVE_BILLING=false` por padrão; configurar preço/identidade corretos e testar evento real antes de ativar. O registro dos hooks ocorre na autenticação quando habilitado; lojas já conectadas precisam de registro dos hooks. O painel Partners abriu sem listar aplicativos e com erro NaN nesta sessão; nenhuma alteração de cobrança foi feita.
   A cobrança única existe oficialmente, mas sua documentação não descreve um gatilho por quantidade de lotes. Validar como o lojista inicia o pagamento depois do lote demo e garantir que o teste não seja convertido silenciosamente em cobrança por prazo. Não prometer que a Nuvemshop cobra automaticamente ao completar 10 produtos. Fonte: https://nuvemshop.dev/apps/publish/pricing-billing e https://tiendanube.github.io/api-documentation/resources/webhook .
2. Configurar/validar DATABASE_URL da aplicação e migrar a tabela `image_sync_access`. Sem banco, o processamento fica bloqueado. Validar reserva em conexões simultâneas no PostgreSQL real.
3. Fazer instalação e envio real em uma loja demo, incluindo escolha manual e comparação do resultado. Os testes HTTP usam um cliente de API e processamento simulados; não comprovam upload real na Nuvemshop.
4. Definir retenção e limpeza de relatórios/estado, tratamento real de webhooks de exclusão e expiração das sessões de autenticação. Os webhooks existentes apenas acusam recebimento; não considerar fluxo de exclusão implementado.
5. Persistir histórico de imagens sincronizadas no banco para preservar deduplicação/atualização após reinício do Render, cujo disco é temporário. Estado atual é separado por loja em arquivos locais; jobs e associações de relatórios são temporários.
6. Revisar casos de falha do demo. A reserva ocorre antes do início do envio e permanece utilizada em falhas; pré-validação rejeita seleção inválida sem consumir. Não vender isso como cobrança nem como processamento garantido.

Render existente: `sku-image-sync`, serviço `srv-d8f18h8g4nts738dgdkg`, origem GitHub main. Esta revisão deve permanecer em PR rascunho até resolver as pendências essenciais. Não foi implantada.

## Marca e domínio — 04/10/2026

Nome público atualizado para **Imagem em Lote**, por solicitação da usuária. URL principal: https://imagememlote.onrender.com. Repositório continua elidadutra187/SKU-Image-Sync e app Nuvemshop continua #33268.

PR #2 integrado à main (c4954b9656d7ad589629744256721e8d71b0a723), exclusivamente para marca e domínio. Render srv-db1ejulg1s2s739r08v0 publicado no plano gratuito com o banco, segredo de sessão e credenciais OAuth existentes. APP_URL usa o novo endereço. Deploy dep-db1ejv5g1s2s739r0b20 confirmado como live; /, /health, /privacy, /support e /nube/main.min.js retornam HTTP 200. Sem erros nos logs consultados após a publicação. A atualização maior de envio por nome/demo continua no PR #1 em preparação.

Serviço anterior srv-d8f18h8g4nts738dgdkg identificado como sku-image-sync-legacy e mantido em https://sku-image-sync.onrender.com durante a transição. Não apagar antes de terminar a alteração do Partners e validar reconexão.

**Pendente no Partners:** sessão está na tela de login. Ainda não foi possível salvar o nome nem as URLs do cadastro. Ao recuperar a sessão, verificar todas as abas e substituir o host antigo pelo novo, preservando os caminhos: página principal, callback /auth/callback, suporte /support, privacidade /privacy, SDK /nube/main.min.js e webhooks /webhooks/store-redact, /webhooks/customers-redact, /webhooks/customers-data-request. Conferir URLs e textos de cada idioma presente no cadastro. Não apontar o guia para /how-to antes de publicar essa rota (disponível apenas na atualização em preparação).
