# Imagem em Lote

Sincronize fotos de produtos na Nuvemshop pelo nome do arquivo ou pelo SKU, com conferência antes de alterar a loja.

## Para o lojista

1. Conecte a loja e selecione as imagens. Não é necessário criar pastas por SKU.
2. Para o produto “Camiseta Azul”, use `Camiseta Azul_01.jpg` e `Camiseta Azul_02.jpg`.
3. Clique em **Encontrar produtos**. Confira o produto associado e as fotos atuais.
4. Para arquivos sem correspondência ou nomes repetidos, escolha o produto manualmente.
5. Envie apenas os produtos conferidos. O padrão mantém as fotos existentes. Uma simulação pode ser feita antes do envio.

Escolha uma das três entradas: imagens, pasta ou CSV. Uma pasta principal com fotos nomeadas usa os nomes dos arquivos; subpastas por produto continuam aceitas. No CSV, use as colunas `sku` e `arquivo` (uma linha por foto) e selecione também as fotos indicadas. O modelo está em `/modelo-imagens.csv`. A associação é por texto; não há IA visual. CSV aceita até50 produtos por prévia; divida planilhas maiores.

A prévia tem páginas de10/20/30/40/50 imagens e preserva os produtos marcados entre páginas. Marcar um produto inclui todas as fotos dele no lote. O envio mostra percentual por produtos concluídos, contadores de fotos e erros, resultado final e opção de retomar a consulta após falha de rede, sem reenviar o lote.

## Demo e acesso

Um lote gratuito por loja, com até10 imagens no total. Cada foto conta, inclusive várias do mesmo produto. Prévia e simulação não consomem o lote. O início do envio real reserva o lote; falhas parciais não devolvem o lote. Depois do primeiro envio, novos lotes exigem acesso pago. Reconectar não reinicia o gratuito.

Depois do demo, pagamento único de **R$79,90 por loja**, pela **Nuvemshop**, deve liberar novos lotes e reutilizações na mesma loja. O receptor de confirmação nativa está implementado em `/webhooks/billing`, validando HMAC, aplicativo, loja, valor, moeda e conceito. **Preço aprovado pela usuária; configuração da cobrança no Partners e validação do fluxo pendentes.** O bloqueio é feito no servidor e persistido no PostgreSQL, independente da autorização OAuth. Sem DATABASE_URL, o processamento fica bloqueado. Não há checkout externo.

Veja [PREPARACAO-PUBLICO.md](PREPARACAO-PUBLICO.md) para as pendências antes da reabertura. Esta revisão está em preparação, sem implantação pública.

## Desenvolvimento

Node.js 18+, Express, PostgreSQL e API Nuvemshop. Configure o servidor usando `.env.example`; não publique segredos.

```sh
npm ci
npm test
npm start
```

A interface está em `/`; guia em `/how-to`, suporte em `/support` e privacidade em `/privacy`.

A CLI administrativa mantém os comandos `sync:add`, `sync:sync`, `sync:replace` e `sync:dry-run`, com pastas por SKU. Esses comandos são do operador, não etapas para o cliente. Envios HTTP usam sessões autenticadas e prévia; as antigas rotas de processamento por caminhos locais retornam 410.

## Modos de envio

- Adicionar: mantém as fotos atuais e envia as novas.
- Atualizar: usa o histórico do app para substituir imagens alteradas. Persistência desse histórico no banco ainda pendente.
- Substituir: remove as fotos atuais e envia o conjunto selecionado; exige confirmação.

Suporte: [elunalab@gmail.com](mailto:elunalab@gmail.com). O link abre o aplicativo de e-mail do cliente.

Autora: Elida Dutra. Repositório: [SKU-Image-Sync](https://github.com/elidadutra187/SKU-Image-Sync).

## Suporte e privacidade

- Páginas públicas: https://imagememlote.onrender.com/support e https://imagememlote.onrender.com/privacy.
- Destinatário fixo dos chamados: elunalab@gmail.com. Formulário com cinco campos e um anexo de até 5 MB; confirmação somente quando o provedor aceita o chamado. Falha do comprovante é indicada separadamente. Não há persistência do chamado no banco; o histórico fica no e-mail.
- Envio por webhook exclusivo Google Apps Script, executado pela conta autorizada elidadutra182@gmail.com. Nunca reutilizar a implantação nem o segredo de outro aplicativo; nunca usar InfoxHub.
- Projeto próprio: https://script.google.com/u/1/home/projects/1SwAkwmyEuxK9aOWEiBn1gfXl9Nfk55P-2EltP7qxynJXPZZdyK58bOBa/edit . Código em scripts/google-apps-script-support.js. Executar configurarSuporte com autorização da proprietária, publicar como aplicativo web e configurar SUPPORT_WEBHOOK_URL e SUPPORT_WEBHOOK_SECRET no Render. A publicação sem login Google exige confirmação por criar novo acesso; o segredo deve permanecer somente nas propriedades do script e no Render.
- GET /support/status mostra somente disponibilidade e e-mail público. Enquanto não configurado, o formulário fica indisponível e oferece contato direto por e-mail. Não afirmar que houve entrega sem confirmar o provedor.
- Testes em test/support.test.js cobrem anexos, validação, origem, limites de tentativas, destinatário fixo, erros sem segredos e comprovante. Mensagens não devem expor configurações internas ao lojista.
# Integração Yampi (14/10/2026)

O mesmo painel atende Nuvemshop e Yampi. Selecione a plataforma antes de conectar; a instalação Yampi usa `/auth/yampi/install` e callback `/auth/yampi/callback`, com OAuth PKCE e somente catálogo (`view_catalog` e `manage_catalog`). Configure o Client ID próprio de Imagem em Lote em `YAMPI_CLIENT_ID`, além de `YAMPI_REDIRECT_URI=https://imagememlote.onrender.com/auth/yampi/callback` e `APP_URL=https://imagememlote.onrender.com`.

Tokens Yampi são cifrados com AES-256-GCM usando `YAMPI_TOKEN_SECRET` ou a chave de sessão existente, com renovação serializada por loja. Não troque essa chave sem migrar as credenciais/reconectar lojas. PostgreSQL é obrigatório. Tabelas exclusivas: `image_sync_yampi_stores`, `image_sync_yampi_oauth`, `image_sync_yampi_media`. Identificadores de acesso e histórico usam prefixo `yampi:` para evitar colisão com Nuvemshop.

Na Yampi, cada SKU/variação é um destino separado. Nomes de produtos com múltiplas variações exigem escolha manual ou SKU exato. Upload usa a API oficial de imagens por URL: uma foto recebe URL aleatória válida por dez minutos, sem token OAuth; a Yampi importa por esse endereço. Consultas têm controle de frequência; somente GET pode ser repetido em 429. POST de imagem não é repetido automaticamente para evitar duplicatas.

O lote gratuito continua único por loja, até dez fotos no total. Prévia e simulação não consomem; envio reserva antes de alterar. Desconexão remove tokens, sem reiniciar gratuito. Cobrança Yampi está desabilitada, inclusive no servidor: jamais reutilizar a cobrança nativa Nuvemshop nessa plataforma. Instalação e envio numa loja Yampi real precisam ser confirmados antes de homologação; testes com API simulada não os substituem.

