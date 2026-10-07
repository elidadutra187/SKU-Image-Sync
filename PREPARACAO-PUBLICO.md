> Atualização de 06/10/2026: por decisão mais recente da usuária, o demo passa a permitir **2 lotes gratuitos por loja**, mantendo até 10 produtos distintos por lote. O 3º envio exige acesso pago. Contadores antigos acima de 2 permanecem registrados e são tratados como demo encerrado. Esta decisão substitui as referências históricas abaixo ao limite anterior de 10 lotes.

# Preparação para reabertura — 04/10/2026

## Atualização de idioma e validação — 05/10/2026

Publicação confirmada: PR #1 integrado, main 359e050ff7c223696505356a4b55cb13032b6ee6; Render dep-db1pqe0jo6nc73asait0 live. No navegador de produção, seletor em inglês conservado ao abrir /how-to; espanhol conservado ao abrir /support e /privacy; mensagens de indisponibilidade do suporte e rodapé ElunaLab traduzidos. O suporte continua sem configuração Google, com alternativa por e-mail. Revisão posterior adapta exemplos didáticos de arquivos ao inglês e mantém arquivos reais do lojista sem tradução.

Arte Canva editável criada: design DAHXJN26JDA, duas páginas confirmadas em 1920 × 1080, português e espanhol. Link https://canva.link/g5nqslb6t4ddt97 . Ajuste final inclui identificação Imagem em Lote no rodapé; transação 6335956803248889075 aguardando aprovação explícita das prévias antes de commit, conforme exigência da ferramenta Canva. Prévias PNG salvas em D:\Users\elida\Documents\Codex\outputs; são miniaturas, não os arquivos finais em 1920 × 1080.

Por solicitação da proprietária, preparar publicação do painel em pt-BR, inglês e espanhol no domínio existente. Seletor compartilhado em início, guia, suporte e privacidade. Preferência em localStorage, propagada entre páginas e abas; mensagens dinâmicas e confirmações traduzidas. Nomes reais de produtos e arquivos preservados. Valores continuam em BRL; selecionar espanhol ou inglês não configura preço de outro país. Todos os arquivos desta revisão estão em D:\Users\elida\Documents\Codex\2026-06-01\continue-o-projeto-sku-image-sync\work\SKU-Image-Sync. Não usar C: como diretório de trabalho.

31 testes passaram, incluindo cobertura de textos das quatro páginas e preservação dos dados do lojista na troca de idioma. Teste adicional opt-in executado no PostgreSQL Neon real, em esquema aleatório exclusivo com registros fictícios: migração repetida, conservação do demo anterior, 20 reservas concorrentes permitindo exatamente 10, bloqueio do 11º após reconexão, trava por loja, persistência do histórico, acesso pago fictício e exclusão idempotente da loja sem alterar outra loja. O esquema de teste foi removido ao terminar. Não houve cobrança nem alteração de registros reais das lojas.

Histórico implementado no banco, salvo após cada upload para preservar deduplicação após reinícios. Trava transacional compatível com o pool Neon. Webhooks LGPD validam assinatura do corpo original e exclusão de loja apaga credenciais, acesso, histórico e sessões temporárias. Exclusão LGPD completa é diferente de reconectar: ela remove os registros da loja. Não armazenamos clientes nem pedidos. Produção continua na distribuição privada existente; pagamento nativo após dez lotes, envio em loja demo real e autorização do suporte Google continuam pendentes antes da reabertura para vendas. Publicar idiomas não implica reabrir vendas nem ativar cobrança.

## Suporte e privacidade — 04/10/2026

Páginas adaptadas ao Imagem em Lote com a mesma família visual dos demais apps. Formulário recebe nome, e-mail, endereço da loja, assunto, mensagem e um anexo de até 5 MB. Destino fixo: elunalab@gmail.com. Não há armazenamento de chamados no banco: protocolo e histórico ficam no e-mail. Só confirmar envio quando o provedor aceitar; falha do comprovante é indicada separadamente.

Projeto Google próprio na conta elidadutra182@gmail.com: https://script.google.com/u/1/home/projects/1SwAkwmyEuxK9aOWEiBn1gfXl9Nfk55P-2EltP7qxynJXPZZdyK58bOBa/edit . Código salvo; configurarSuporte selecionada. A proprietária autorizou explicitamente o envio e a publicação do webhook. A implantação foi preparada, mas o Google ainda exige concluir Autorizar acesso; o clique pelo navegador integrado não abriu a janela de autorização. Não confundir aprovação na conversa com permissão OAuth concluída. Em seguida, obter segredo nas propriedades do projeto e URL da implantação e configurar SUPPORT_WEBHOOK_URL/SUPPORT_WEBHOOK_SECRET no Render. Não publicar valores secretos no GitHub ou na conversa. Enquanto isso, formulário informa indisponibilidade e contato direto abre mailto:elunalab@gmail.com.

PR #3 integrado à main para páginas e backend de suporte. Dependências de uploads e parsing atualizadas em c36e05acf44650aeaada34af458c5ebf60874534: npm audit --omit=dev não encontrou vulnerabilidades. 15 testes da produção e 25 da atualização em preparação passaram. Envio real de e-mail e recebimento de anexo ainda dependem de concluir a autorização/configuração Google; não afirmar que foram verificados.

## Marca e domínio — 04/10/2026

Nome público atualizado para **Imagem em Lote**, por solicitação da usuária. URL principal: https://imagememlote.onrender.com. Repositório continua elidadutra187/SKU-Image-Sync e app Nuvemshop continua #33268.

PR #2 integrado à main (c4954b9656d7ad589629744256721e8d71b0a723), exclusivamente para marca e domínio. Render srv-db1ejulg1s2s739r08v0 publicado no plano gratuito com o banco, segredo de sessão e credenciais OAuth existentes. APP_URL usa o novo endereço. Deploy dep-db1ejv5g1s2s739r0b20 confirmado como live; /, /health, /privacy, /support e /nube/main.min.js retornam HTTP 200. Sem erros nos logs consultados após a publicação. A atualização maior de envio por nome/demo continua no PR #1 em preparação.

Serviço anterior srv-d8f18h8g4nts738dgdkg identificado como sku-image-sync-legacy e mantido em https://sku-image-sync.onrender.com durante a transição. Não apagar antes de terminar a alteração do Partners e validar reconexão.

**Confirmado no Partners em 04/10/2026:** acesso com credenciais salvas; nome Imagem em Lote, contato elunalab@gmail.com, site, callback e três URLs LGPD salvos com o novo domínio e conferidos ao reabrir o cadastro. Distribuição atual: Para os seus clientes. Não foi feita reabertura pública nem cobrança. Os campos de suporte/privacidade da listagem não aparecem nessa modalidade. Os caminhos conferidos foram: página principal, callback /auth/callback, suporte /support, privacidade /privacy, SDK /nube/main.min.js e webhooks /webhooks/store-redact, /webhooks/customers-redact, /webhooks/customers-data-request. Conferir URLs e textos de cada idioma presente no cadastro. Não apontar o guia para /how-to antes de publicar essa rota (disponível apenas na atualização em preparação).


O fluxo anterior exigia pastas por SKU e expunha termos técnicos. O novo fluxo permite selecionar várias imagens pelo nome do arquivo, conferir as associações e enviar apenas os grupos selecionados.

## Implementado nesta revisão

- Associação por SKU exato, depois nome completo normalizado; acentos e separadores são normalizados.
- Sequências _01, _02 e _03 agrupam fotos. Catálogo de produtos é consultado na loja autenticada.
- Nomes duplicados e sugestões incompletas ficam sem produto até uma escolha manual validada no catálogo e API da loja.
- Pastas com SKU e CSV permanecem disponíveis em opções avançadas.
- Prévia mostra fotos enviadas e fotos atuais. Simulação não altera imagens.
- Grupos associados ao mesmo produto são processados juntos para não apagar fotos de um grupo anterior no modo de substituição.
- Fotos idênticas dentro de uma operação são deduplicadas por hash.
- Demo alterado pela usuária para 10 lotes gratuitos por loja, cada um com até 10 produtos distintos. Reserva condicional atômica e contador no PostgreSQL, independente da instalação OAuth.
- Envios por caminhos locais foram retirados da API HTTP; a CLI administrativa continua disponível.
- Sessões, fotos temporárias, relatórios e jobs exigem autenticação e vínculo com a loja.
- Manual token de outra loja não substitui o token da loja autenticada.
- Novos guia, suporte e privacidade. Contato elunalab@gmail.com; suporte abre o aplicativo de e-mail, com anexos enviados pelo próprio cliente.

## Validação realizada

20 testes Node passaram, incluindo associação por nome/SKU, ambiguidade, agrupamento, paginação, reserva concorrente simulada, limites de acesso, fluxo HTTP e validação de confirmação nativa de pagamento. Sintaxe do script da interface e `git diff --check` passaram. Tela inicial e guia foram revisados no navegador local. A reserva concorrente usa um repositório em memória nos testes; não foi executada em PostgreSQL real nesta revisão.

## Pendências para reabrir

1. Preço aprovado pela usuária: **R$79,90, pagamento único por loja**. Configurar **Valor único no Partners**, pela cobrança nativa da Nuvemshop, depois de validar como o pagamento é iniciado após o demo. .env.example da atualização contém 79.90 e mantém a cobrança desativada; o teste verifica esse valor e rejeita o antigo 99.90. O webhook `/webhooks/billing` valida a assinatura HMAC do corpo original, `app_id`, loja, valor, moeda e conceito antes de liberar acesso de modo idempotente. `charge/failed` e eventos de outros apps não liberam nada. Não há checkout externo nem criação de cobranças pela aplicação. `NUVEMSHOP_NATIVE_BILLING=false` por padrão; configurar preço/identidade corretos e testar evento real antes de ativar. O registro dos hooks ocorre na autenticação quando habilitado; lojas já conectadas precisam de registro dos hooks. O acesso ao Partners foi recuperado; nenhuma alteração de cobrança foi feita.
   A cobrança única existe oficialmente, mas sua documentação não descreve um gatilho por quantidade de lotes. Validar como o lojista inicia o pagamento depois do lote demo e garantir que o teste não seja convertido silenciosamente em cobrança por prazo. Não prometer que a Nuvemshop cobra automaticamente ao completar 10 produtos. Fonte: https://nuvemshop.dev/apps/publish/pricing-billing e https://tiendanube.github.io/api-documentation/resources/webhook .
2. Configurar/validar DATABASE_URL da aplicação e migrar a tabela `image_sync_access`. Sem banco, o processamento fica bloqueado. Validar reserva em conexões simultâneas no PostgreSQL real.
3. Fazer instalação e envio real em uma loja demo, incluindo escolha manual e comparação do resultado. Os testes HTTP usam um cliente de API e processamento simulados; não comprovam upload real na Nuvemshop.
4. Definir retenção e limpeza de relatórios/estado, tratamento real de webhooks de exclusão e expiração das sessões de autenticação. Os webhooks existentes apenas acusam recebimento; não considerar fluxo de exclusão implementado.
5. Persistir histórico de imagens sincronizadas no banco para preservar deduplicação/atualização após reinício do Render, cujo disco é temporário. Estado atual é separado por loja em arquivos locais; jobs e associações de relatórios são temporários.
6. Revisar casos de falha do demo. A reserva ocorre antes do início do envio e permanece utilizada em falhas; pré-validação rejeita seleção inválida sem consumir. Não vender isso como cobrança nem como processamento garantido.

Render principal: `imagememlote`, serviço `srv-db1ejulg1s2s739r08v0`, origem GitHub main. A mudança de marca/domínio foi implantada; a revisão maior de demo e envio por nome deve permanecer em PR rascunho até resolver as pendências essenciais.

## Teste ampliado do demo e layout — 04/10/2026

27 testes passaram. Novo teste de integração HTTP executa upload multipart, associação e o ImageSyncService real, com API Nuvemshop e repositório de acesso simulados. Casos separados para nome completo da imagem e pasta iniciada por SKU: 11 produtos rejeitados sem consumir, 10 produtos simulados sem consumir, envio dos 10 aceito, segundo envio bloqueado mesmo com nova sessão da mesma loja, acesso de outra loja negado e acesso pago permitindo mais produtos. Isso não comprova upload em loja real nem concorrência no PostgreSQL real.

Encontrado e corrigido: modo adicionar enviava novas imagens começando na posição 1 e podia trocar a capa. A nova versão usa a próxima posição depois das imagens existentes. Teste confere foto atual preservada e novas imagens na posição 2 quando existe uma foto inicial.

Revisão visual local: desktop e celular; sem overflow horizontal no celular. Três etapas, exemplos de nomes, comparação entre fotos novas/atuais e SKU/CSV nas opções avançadas. Interface reconheceu 10/10 produtos e simulação mostrou 10 produtos, zero uploads e zero erros. Confirmação de envio no navegador integrado ficou pendente do clique da usuária: a janela JavaScript bloqueou o controle. Servidor isolado de teste em localhost:3135; nenhuma loja real foi alterada. scripts/visual-preview.mjs permite repetir a revisão com catálogo fictício, sem OAuth, banco ou cobrança reais.

A usuária confirmou depois desta revisão: 10 lotes gratuitos por loja. A implementação e os testes abaixo substituem a regra anterior de um lote.
## Regra final do demo — 04/10/2026

A usuária confirmou 10 lotes gratuitos por loja; somente depois do décimo lote há exigência de pagamento único de R$79,90. Cada lote gratuito mantém até 10 produtos distintos. Contador demo_batches_used é persistido separado de OAuth; reserva condicional atômica incrementa somente abaixo de 10. Migração mantém o consumo anterior como 1 lote quando demo_used_at já está preenchido, sem zerar consumo em reinícios. Prévia/simulação não incrementam. Contadores inválidos bloqueiam acesso; falha parcial conserva o consumo.

28 testes passaram: integração com serviço real e API/armazenamento simulados por nome e por SKU aceita os lotes 1–10, rejeita o 11º, não reseta ao reconectar e libera novos lotes para acesso pago. Vinte tentativas simultâneas com nove lotes já utilizados aceitam exatamente uma reserva. PostgreSQL real e loja demo real ainda não validados. UI e guia mostram 10 lotes e saldo restante. A alteração está apenas na versão em preparação, sem implantação no Render.

## Artes finais aprovadas — 05/10/2026

A usuária adicionou a logo da ElunaLab às duas páginas e autorizou utilizar essas versões salvas. O rascunho de edição anterior foi cancelado, preservando suas alterações. Design editável: https://www.canva.com/design/DAHXJN26JDA/iEOfbb0uBkujOo3Pfve-KQ/edit .

Exportação PNG verificada: página 1 em português, 1920 × 1080, 1.202.299 bytes; página 2 em espanhol, 1920 × 1080, 1.222.962 bytes. Ambas abaixo de 5 MB. Arquivos finais em D:/Users/elida/Documents/Codex/outputs/imagememlote-artes-logo/1.png e 2.png. Ainda não enviados aos campos de imagens do Partners, indisponíveis na configuração atual de distribuição.

## Revisão do Partners — 05/10/2026

Nome Imagem em Lote, descrição curta e longa e dez perguntas frequentes salvos e conferidos nas fichas já existentes de Brasil, Argentina, Chile, Colômbia e México. Português no Brasil; espanhol nas outras fichas. Não foram criados novos países ou idiomas. Removidas promessas de milhares de atualizações em minutos e a exigência de pastas SKU. Explicados nomes de arquivos, escolha manual, modos adicionar/substituir, 10 lotes gratuitos com até 10 produtos, consumo no envio real, falhas parciais, simulação e reconexão. Link correto do guia: /how-to. Preço único existente R$79,90 preservado; moedas/valores de outros países não convertidos.

Textos finais: D:/Users/elida/Documents/Codex/outputs/imagememlote-textos-partners.json.

Pendência comprovada: formulário geral de publicação não persiste alterações das URLs e handle. Após Salvar e recarregar, preferences/privacy/support retornam a sku-image-sync.onrender.com e handle imagens-em-massa-nuvemshop. Não afirmar URLs atualizadas. Nenhuma mensagem útil de validação aparece; as fichas por país salvam normalmente. Também há somente uma imagem cadastrada em cada ficha observada; o portal informa mínimo de três. As duas artes finais ainda não foram enviadas. Publicação técnica e cobrança pós-demo não validadas por esta revisão editorial.

## Auditoria de funcionamento — 05/10/2026

32 validações passaram: 31 testes normais e um teste opt-in no PostgreSQL real (migração, reserva concorrente limitada a 10, histórico e exclusão por loja). npm audit --omit=dev: zero vulnerabilidades conhecidas nas dependências. Render principal confirmado live no commit f257cc7a6c35a1933b92af07da622ac4f51113d5. Isso não comprova pagamento real nem upload real na loja demo.

Demo: dez lotes por loja, até dez produtos distintos em cada lote; prévia/simulação sem consumo. O 11º envio sem acesso pago é bloqueado. Reconectar não zera. Falhas parciais consomem o lote reservado.

Pendência crítica de cobrança: existe receptor autenticado de charge/paid, mas nenhum endpoint ou botão inicia a compra depois do décimo lote. O preço único no Partners não estabelece um gatilho por contagem de lotes. Não anunciar cobrança pós-demo como concluída nem ativar flag de billing sem confirmar o contrato real da plataforma. Referências oficiais: https://nuvemshop.dev/apps/publish/pricing-billing e https://nuvemshop.dev/api/resources/2025-03/billing .

Bugs reproduzidos localmente sem credenciais reais: services/session.js aceita cookie HMAC válido com createdAt de 2020 (sem expiração validada no servidor); parseCookies lança URIError ao receber cookie irrelevante com %ZZ. Em produção, ausência dos dois segredos também ativa fallback dev-session-secret. O segredo configurado atualmente não foi exposto por esta auditoria. Corrigir e testar antes de afirmar revisão de segurança completa.

Retenção: mapas de jobs/relatórios sem TTL e redator da loja só limpa as sessões de upload, não todos os relatórios/jobs. cleanupExpiredUploadSessions não protege lote running de remoção por TTL. Esses caminhos precisam de testes e correções.

URL antiga: Render sku-image-sync-legacy, srv-d8f18h8g4nts738dgdkg, confirmado não suspenso e com autoDeploy. URL https://sku-image-sync.onrender.com continua funcional porque a migração ainda tem referências antigas no formulário geral de publicação do Partners. Não suspender sem confirmar callback e URLs gerais no novo domínio, para evitar interromper lojas existentes.

## Correções para venda — 05/10/2026

Corrigidas expiração de sessão, cookies malformados, ausência de segredo em produção e conexão falsa de visitantes sem sessão. Upload em execução não é apagado pela expiração. Relatórios/jobs têm retenção de 24 horas; a exclusão por loja também encontra relatórios após reinício do processo.

Compra única implementada em /sync/purchase com confirmação explícita, somente após dez lotes, intenção atômica por loja, sem repetição de POST de cobrança em falha ambígua. Charge/paid precisa corresponder ao ID da compra registrada, além de assinatura/app/valor/moeda/conceito. A compra permanece desativada até validar modelo de cobrança e autorização Edit Charges no Partners, reconectar a demo e testar pagamento real. Não reabrir vendas com esses testes pendentes.

Verificação: 40 testes automatizados passaram; teste PostgreSQL opt-in passou separadamente, incluindo vinte reservas concorrentes (somente dez autorizadas), vinte intenções de compra (somente uma criada), migração e redaction. Dependências de produção: zero vulnerabilidades conhecidas.

Publicação das correções confirmada: GitHub main 84e9d8f987efcc3ed4f2efa97097c210d867f114; Render dep-db1ua9c9v7es73fs10p0 live. Produção mostra visitantes sem sessão como desconectados. Partners agora preserva URLs imagememlote para configurações, privacidade e suporte; os dados básicos foram salvos novamente. O handle antigo foi mantido para preservar endereço da ficha existente.

Ficha: três capturas/imagens adicionais por idioma preparadas com 1920x1080 e tamanho inferior a 5 MB. Portal rejeitou nomes 1.png/2.png já existentes; cópias com nomes únicos resolveram o conflito. Argentina, Chile, Colômbia e México exibiram quatro imagens e foram salvos. Brasil tinha três imagens e recebeu a arte final com nome único. Antes de encerrar, confirmar salvamento da arte brasileira.

Pendências de confirmação: Edit Charges está desmarcado. Solicitação específica de autorização enviada para ampliá-lo; não mudar sem resposta. Suporte Google Apps Script na conta elidadutra182@gmail.com: nenhuma implantação ativa, formulário preparado para App da Web/Qualquer pessoa; confirmação específica de publicação enviada, ainda sem resposta. Não clicar Implantar sem autorização. Contato direto elunalab@gmail.com funciona como alternativa; envio do formulário ainda desativado. Também faltam contrato/modelo nativo pós-demo, reconexão, pagamento e upload reais na demo antes de habilitar vendas.
Confirmação final: Brasil salvo e reaberto com quatro imagens; prova em outputs/imagememlote-partners-imagens-final.jpg. A publicação do suporte e a ampliação de Edit Charges permanecem aguardando respostas às perguntas específicas. Nenhuma cobrança real foi criada ou paga nesta revisão.

## Autorizações executadas — 05/10/2026

Usuária autorizou explicitamente as duas ações. Edit Charges habilitado, salvo e confirmado ao reabrir o Partners. OAuth reconectado na demo ElunaLab, store 7793322, domínio elidaimagensemmassa.lojavirtualnuvem.com.br, com read_products,write_products,write_charges. Permissão de cobrança não significa compra validada: configuração nativa continua desativada; leitura da assinatura exigiria read_subscriptions, não concedida nesta etapa.

Suporte exclusivo Apps Script implantado como elidadutra182@gmail.com, versão 1, URL de implantação configurada via plugin no Render principal, segredo exclusivo armazenado apenas nas propriedades do Google e ambiente Render. configurarSuporte executada com sucesso; destinatário ElunaLab confirmado. Deploy dep-db1uhv67bikc73bovdkg live.

Teste de produção com anexo aceito, protocolo 69b9d27a-8ce3-46ec-8bf7-c952159f8077, mas comprovante falhou e novos testes não foram confirmados. Diagnóstico seguro adicionado sem dados/credenciais nos logs. Render mostrou support_provider_non_json_404, embora execução Google concluísse. Confirmação direta do comprovante no Google foi aceita. Ajuste para resposta independente por entrega (ContentService usa URL de resposta descartável): main ed3b241783ea6496f235a7d740a5877da69a77ce, deploy dep-db1un26q1p3s73e1htu0 live. Validação final em andamento; não afirmar estabilidade sem resultado.

## Estado atual após autorização

As pendências antigas de autorização acima foram resolvidas. Apps Script atualizado para versão 2, preservando proprietário Gmail, destinatário ElunaLab, acesso e URL. Chamado e comprovante agora usam uma execução/uma resposta, mantendo compatibilidade com provedor anterior. Testes: 41 aprovados, zero falhas, um PostgreSQL opt-in não executado nesta rodada (validado separadamente antes). Código publicado pelo plugin GitHub: 1a65531b7fa911e24186af8a23e375dd6d88538f. Render dep-db1uqne7bikc73dc3qj0 em implantação; teste de produção preparado com anexo.

Não há autorização pendente dessas duas ações. Permanecem validação do modelo nativo de cobrança após dez lotes, pagamento real e envio real na demo. Não habilitar cobrança apenas com a permissão; nenhuma cobrança criada nesta etapa.
Resultado final: Render dep-db1uqne7bikc73dc3qj0 live. Formulário de produção confirmou chamado com anexo e comprovante na mesma execução: protocolo 4ea7a11f-c2d7-437d-b998-43df2ddbdba6. Comprovante para elidadutra182@gmail.com; chamado destinado a elunalab@gmail.com. Prova outputs/imagememlote-suporte-confirmado.jpg. Isso confirma aceitação do provedor; não foi inspecionada a caixa de entrada do destinatário nesta validação.

## Teste real da demo — 05/10/2026

Produto exclusivo oculto 372119911, Validacao Imagem em Lote 20261005, SKU ELUNA-TEST-20261005. Simulação na produção terminou sem erros e manteve 10 lotes. Envio pelo nome adicionou imagem 1289172710 e consumiu um lote; envio pelo SKU adicionou 1289174252 na posição 2 preservando a primeira imagem e consumiu outro. API confirmou produto não publicado e duas imagens. Banco confirmou demo_batches_used=2, paid_at=null; saldo oito lotes. Nenhum produto existente foi alterado.

Testes frescos: nove testes de demo/compra/webhook aprovados, incluindo dez lotes e bloqueio do décimo primeiro via HTTP em ambiente isolado; teste PostgreSQL real separado aprovado. Esse teste isolado não representa pagamento real. Nenhuma cobrança criada nem paga. Para verificar assinatura nativa e possíveis cobranças pré-demo, View Subscriptions precisa ser autorizada; pergunta específica enviada, campo permanece desmarcado. Provas em outputs/imagememlote-teste-nome.jpg e imagememlote-teste-sku.jpg. Produto oculto mantido para inspeção; contador da demo não foi resetado.

View Subscriptions autorizada e salva; OAuth reconectado. API retornou Concept should be app-cost para o conceito antigo plan-cost. Corrigidos os padrões de compra, webhook e .env.example para app-cost; teste de webhook reproduziu falha antes e passou após correção. Suíte completa: 41 aprovados, zero falhas, um opt-in ignorado nesta execução; PostgreSQL real passou separadamente.

Consulta app-cost revelou assinatura existente da demo com amount_value 79.90 BRL, recurring_frequency M, next_execution 2026-10-16, last_execution 2026-10-05. Partners Brasil confirmado Pagamento único selecionado, 79,90, mensal desmarcado. Divergência entre ficha e assinatura já instalada não foi resolvida. Não criar cobrança adicional: pode duplicar cobrança existente. Edit Subscriptions permanece não autorizada; nenhum preço/assinatura existente alterado nesta investigação. Cobrança do aplicativo continua desativada. Decisão da usuária reiterada: R$79,90 em pagamento único por loja após dez lotes.


## Simplificação da interface — 07/10/2026

- Instruções detalhadas de nomes ficam recolhidas; a seleção de fotos é a ação principal.
- Controles de lotes aparecem somente quando há mais de dez grupos.
- Prévia orienta a buscar manualmente produtos não encontrados; envio destaca a preservação das fotos atuais.
- Simular e enviar exigem uma prévia válida, inclusive depois de trocar o lote.
- Textos adicionados traduzidos em português, inglês e espanhol. Limite vigente de dois lotes gratuitos preservado.
