# Notas tecnicas para homologacao

## Aplicativo

- Nome: SKU Image Sync
- App ID: `33268`
- URL: `https://sku-image-sync.onrender.com`
- Plataforma: Node.js hospedado no Render
- Autenticacao: OAuth Nuvemshop

## Modelo de cobranca

O aplicativo esta configurado como gratuito.

Nao ha plano pago, assinatura, etapa de pagamento ou bloqueio comercial para a equipe de homologacao.

## Fluxo de instalacao

O app deve ser instalado pela URL:

`https://www.tiendanube.com/apps/33268/authorize`

Apos a autorizacao, a Nuvemshop chama:

`https://sku-image-sync.onrender.com/auth/callback`

O callback troca o `code` por `access_token`, salva a conexao e redireciona para a tela principal.

## Escopos

- `read_products`
- `write_products`

Justificativa:

- `read_products`: necessario para buscar produto por SKU e listar imagens atuais.
- `write_products`: necessario para criar imagens e remover imagens no modo REPLACE.

## Uso eficiente da API

- A previa e feita por lote de 20 ou 50 subpastas.
- A listagem de imagens usa `per_page=200`, respeitando o limite aceito pela API.
- O app possui intervalo entre chamadas e retry para respostas `429 Too Many Requests`.
- Nao ha GET continuo ou polling para monitorar alteracoes.
- O app so consulta a API quando o lojista gera previa, simula ou confirma sincronizacao.

## Privacidade e LGPD

O app nao armazena dados de clientes.

Rotas LGPD implementadas:

- `POST /webhooks/store-redact`
- `POST /webhooks/customers-redact`
- `POST /webhooks/customers-data-request`

## Riscos controlados

- O modo REPLACE exige confirmacao antes de remover imagens antigas.
- Produtos com erro ou nao encontrados aparecem desmarcados por padrao.
- O lojista pode simular antes de sincronizar.
- O lojista pode selecionar ou desmarcar SKUs individualmente.

## Conta demo

Para a equipe de homologacao, utilizar uma loja de teste Nuvemshop e instalar o aplicativo pela URL OAuth. Nao existe cadastro interno separado no app.

