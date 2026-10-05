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
