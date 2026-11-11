# Instruções do projeto

- Trabalhar e salvar artefatos em D:\Users\elida\Documents\Codex. Sempre informar esse diretório nos comandos; o diretório inicial de uma conversa pode estar em C: e não deve ser usado para este projeto.
- Interface em pt-BR, en e es. Usar o seletor compartilhado em todas as páginas e conservar a escolha entre páginas. Traduzir mensagens dinâmicas e confirmações; nunca traduzir nomes reais de produtos ou arquivos enviados. Preço BRL não implica conversão de moeda pelo idioma.

- Nome público: Imagem em Lote. URL de produção: https://imagememlote.onrender.com. Manter o identificador técnico do repositório SKU-Image-Sync.
- Serviço Render principal: srv-db1ejulg1s2s739r08v0. O serviço srv-d8f18h8g4nts738dgdkg mantém o endereço antigo durante a transição; não apagar antes de confirmar as URLs do Partners.

- A experiência principal é selecionar fotos pelo nome do arquivo; pastas com SKU e CSV são opções avançadas.
- Usar português claro e exemplos do ponto de vista do lojista. Não expor configuração de servidor no fluxo do cliente.
- Não usar IA visual para associar fotos. Comparar SKU exato e nome normalizado com o catálogo da loja autenticada.
- Nomes duplicados ou aproximados exigem escolha manual. Nunca enviar uma sugestão ambígua automaticamente.
- O padrão é adicionar mantendo fotos atuais. Substituição exige confirmação explícita.
- O demo permite exatamente 1 lote gratuito por loja com no máximo 10 imagens no total, incluindo várias fotos do mesmo produto. Depois do primeiro envio, exigir acesso pago. Decisão da usuária em 07/10/2026.
- Prévia e simulação não consomem o demo. O envio real reserva e utiliza o demo antes das operações. Não resetar por reconexão.
- Persistir o acesso no banco e bloquear processamento quando ele não estiver disponível. Não confiar em flags de pagamento do navegador.
- Pagamento único de R$79,99 por loja, confirmado pela usuária em 01/11/2026 (substitui R$79,90), exclusivamente pela cobrança nativa da Nuvemshop. Não criar checkout externo.
- Liberação paga exige webhook charge/paid com HMAC válido, app_id deste app, loja conhecida, valor, moeda e conceito esperados. Não liberar com charge/created, charge/failed ou simples acesso à API.
- Não criar cobrança nem mudar preço para clientes antes de confirmar o valor e validar o comportamento do demo por lote na cobrança nativa.
- Não reabrir para vendas antes de validar pagamento, reserva concorrente no PostgreSQL real e envio na loja demo.
- Suporte público: elunalab@gmail.com. Formulário com um anexo de até 5 MB, via webhook exclusivo Google Apps Script executado pela conta autorizada elidadutra182@gmail.com. Não reutilizar implantação nem segredo de outro app. Informar indisponibilidade e oferecer contato direto por e-mail até terminar a autorização/configuração; só confirmar chamado após aceite do provedor.
- Usar o plugin GitHub para escritas no GitHub. Não misturar banco, credenciais ou serviços com Botão Comprar ou Continuar pelo WhatsApp.
- Manter a documentação de preparação atualizada em PREPARACAO-PUBLICO.md.

## Orientação posterior da proprietária —28/10/2026

Três entradas exclusivas e visíveis: por imagens, por pasta e por CSV. A pasta principal não é um produto: fotos nomeadas na raiz devem ser agrupadas pelos nomes dos arquivos. Uma pasta identificada por nome/SKU do catálogo e subpastas por produto continuam aceitas. CSV relaciona `sku` e `arquivo`, uma linha por foto, com fotos selecionadas no próprio modo CSV; não associar pelo nome quando o SKU da linha não existe ou é ambíguo. Mostrar erro de arquivo ausente/conflitante. Trocar entrada limpa seleção/prévia anterior e não herda CSV oculto.

Prévia paginada por10/20/30/40/50 imagens, seleção de produtos preservada entre páginas. Mostrar progresso do envio e conclusão/erros. Falha de consulta não significa envio encerrado e não deve permitir repetição automática. A URL atual é https://imagens.elunalab.com.br/ no Railway; as antigas instruções Render não são destino de implantação. Suporte público por formulário, conforme instrução global posterior. Cobrança nativa fixa separada do fluxo adicional; PR12 integrado por autorização explícita em28/10. Esta nova melhoria de entrada/progresso ainda depende de revisão e autorização de merge.

## Confirmação de preço — 01/11/2026

Preço brasileiro vigente: R$79,99, pagamento único pela Nuvemshop. No modo platform_once, confirmações nativas assinadas de BRL79,90 continuam aceitas como legado; guardar o valor real do recibo e preservar paid_at/payment_reference existentes. Não inferir dívida só pelo demo consumido ou por credenciais presentes. Não criar cobrança adicional para contornar ausência de pagamento no painel. Um GET de assinatura recorrente com404 não comprova, sozinho, inexistência de cobrança única.


- 26/10/2026, pedido posterior: cobrança externa Mercado Pago PF autorizada SOMENTE para Yampi, com pagamento único R$79,90. A proibição anterior de checkout externo permanece para Nuvemshop. Não ativar cobranças reais antes da homologação.


## Cobrança por plataforma — requisito obrigatório28/10/2026

Nuvemshop/Tiendanube cobra SOMENTE nativamente; Yampi cobra pelo Mercado Pago. MP nunca entra no fluxo/interface de pagamento Nuvemshop, nem como fallback de erro. Nova plataforma exige adaptador e registro explícitos/homologados; desconhecida é recusada. Nunca escolher provedor por query/body/localStorage, reaproveitar recibo entre plataformas, reiniciar teste no OAuth ou ativar cobrança por preencher credenciais. Seguir docs/billing-platform-contract.md e manter as cinco políticas versionadas/testadas. Código desta etapa permanece em PRrascunho, sem merge/deploy/cobrança real.

## Orientação posterior da proprietária — 11/11/2026 (substitui pagamento único para novas Nuvemshop)

- O novo plano no Nuvemshop Partners é **mensal recorrente R$39,90, teste grátis 3 dias**. A Nuvemshop é a única responsável por gerar e cobrar a assinatura mensal.
- Modo técnico: `NUVEMSHOP_BILLING_MODEL=platform_monthly`, `NUVEMSHOP_MONTHLY_PRICE=39.90`. Não criar cobranças adicionais pelo backend, nem confundir o preço por mês com o preço proporcional de um primeiro período.
- Registrar webhooks assinados HMAC: `charge/paid`, `app_subscription/updated` (churn e phoenix), `app/suspended` e `app/resumed`. O `subscription/updated` avisa alterações, mas por si só não prova quitação.
- Salvar a cobertura de cada período pago com validade; revogar automaticamente em `churn`, suspensão ou expiração. Deduplicar por charge_id e app_id e conferir origem/loja/valor/moeda.
- **Não converter retroativamente o `paid_at` de pagamentos únicos existentes em mensalidade.** Permanecem vitalícios sob contrato original.
- Trial: 3 dias registrados apenas uma vez por loja, independentemente de reconexão OAuth. O lote gratuito anterior continua separado.
- Cobrança da Yampi e seus contratos permanecem independentes.
- Verificar a ativação das permissões de Billing (`read_subscriptions`, `write_subscriptions`, `write_charges`, `write_plans`) com o suporte da Nuvemshop. Leitura direta de assinaturas requer escopos autorizados e pode retornar 404 para apps instalados antes da configuração. Não inferir falta de pagamento a partir de 404.

## Partners é a verdade — 11/11/2026

- Cancelamento, suspensão, inadimplência e desinstalação bloqueiam novos envios, inclusive lote gratuito, teste e acesso vitalício. Preserve a licença antiga, o token e as configurações no bloqueio; o fluxo de privacidade continua separado.
- Eventos de retomada e reconexão não levantam o bloqueio. Um novo recibo nativo mensal válido pode reativar; reapresentar um recibo já registrado não reativa.
- O app expõe `POST /billing/admin/partners-status` com `X-Admin-Token` para espelhar `paid`, `free`, `unpaid`, `cancelled` e `suspended`. Use a data real do Partners para `paid`, que vale por 30 dias. O servidor responde 409 se o estado não puder ser aplicado. Nunca altere acesso manualmente no Neon.
- O pool Railway usa `application_name=imagem-em-lote`; as triggers protegem as tabelas de acesso e recibos e registram alterações em `image_sync_entitlement_audit`. Essa identificação evita alterações acidentais. Permissões do banco continuam sendo necessárias.
- Yampi mantém cobrança própria e não recebe estados de acesso pelo endpoint do Partners.
