<div align="center">
  <strong>φ</strong>
  <h1>SKU Image Sync</h1>
  <p><em>Backend Node.js para sincronizar imagens de produtos da Nuvemshop usando o SKU como chave.</em></p>
  <p>
    <a href="https://github.com/elidadutra187/SKU-Image-Sync">Repository</a> ·
    <a href="https://github.com/elidadutra187">GitHub Profile</a>
  </p>
</div>


## Positioning

This repository is part of the `φ` portfolio by [Élida Dutra](https://github.com/elidadutra187), focused on practical systems for e-commerce, automation, analytics, content generation and growth operations.

**Repository:** [elidadutra187/SKU-Image-Sync](https://github.com/elidadutra187/SKU-Image-Sync)  
**GitHub:** [https://github.com/elidadutra187](https://github.com/elidadutra187)  
**Purpose:** Backend Node.js para sincronizar imagens de produtos da Nuvemshop usando o SKU como chave.


Backend Node.js para sincronizar imagens de produtos da Nuvemshop usando o SKU como chave.

## Estrutura esperada das imagens

```text
Fotos/
  1001 Produto Azul/
    1.jpg
    2.jpg
  ABC-123 - Camiseta/
    1.jpg
    2.jpg
```

Cada subpasta dentro de `Fotos` deve comecar pelo SKU do produto. O texto depois do primeiro bloco do nome da pasta e ignorado. Exemplos:

- `1001`
- `1001 Produto Azul`
- `ABC-123 - Camiseta`

Nesses casos o app usa `1001` ou `ABC-123` para buscar o produto na Nuvemshop.

## Uso pelo site

1. Acesse `https://sku-image-sync.onrender.com`.
2. Selecione a pasta `Fotos`.
3. Escolha o tamanho da previa por lote: `20 subpastas` ou `50 subpastas`.
4. Escolha o intervalo do lote, por exemplo `1-20`, `21-40` ou `51-100`.
5. Opcionalmente envie um CSV para filtrar os SKUs que entram na previa.
6. Clique em `Gerar previa`.
7. Confira produto, fotos locais e fotos atuais da Nuvemshop.
8. Desmarque qualquer produto incorreto.
9. Escolha `ADD`, `SYNC` ou `REPLACE`.
10. Use `Simular selecionados` antes de sincronizar.
11. Clique em `Sincronizar selecionados`.

O CSV pode usar virgula ou ponto e virgula. A coluna pode se chamar `sku`, `codigo`, `pasta`, `folder` ou ser a primeira coluna do arquivo.

Para pastas grandes, use `20 subpastas` como padrao. Esse lote e mais estavel porque cada SKU precisa consultar produto e imagens atuais na API da Nuvemshop. Use `50 subpastas` quando houver poucas imagens por SKU ou quando a previa estiver respondendo rapido.

## Modos

- `dry-run`: simula a sincronizacao sem enviar ou remover imagens.
- `add`: adiciona imagens locais que ainda nao aparecem no estado local de sincronizacao.
- `sync`: adiciona imagens novas e reenvia imagens alteradas por hash local.
- `replace`: remove todas as imagens atuais do produto e envia todas as imagens da pasta do SKU.

## Variaveis de ambiente

Copie `.env.example` para `.env` em ambiente local.

```env
NUVEMSHOP_STORE_ID=
NUVEMSHOP_ACCESS_TOKEN=
NUVEMSHOP_USER_AGENT=
PORT=3000
```

O arquivo tambem inclui variaveis opcionais para pasta de imagens, versao da API e estrutura futura de OAuth.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## Rotas

Paginas:

- `GET /`
- `GET /privacy`
- `GET /support`
- `GET /nube/main.min.js`

Estrutura OAuth:

- `GET /auth/install`
- `GET /auth/callback`
- `GET /auth/status`

Quando `NUVEMSHOP_CLIENT_ID` e `NUVEMSHOP_CLIENT_SECRET` estao configurados, `/auth/callback` troca o `code` do OAuth por um `access_token` e salva esse token localmente em `.nuvemshop-oauth-token.json`. O token nao e exibido nas respostas da API.

Sincronizacao:

- `POST /sync/preview`
- `POST /sync/session/:sessionId/run`
- `POST /sync/dry-run`
- `POST /sync/add`
- `POST /sync/sync`
- `POST /sync/replace`
- `GET /sync/status`

Produtos:

- `GET /products/sku/:sku`
- `GET /products/:id`
- `GET /products/:id/images`

LGPD webhooks:

- `POST /webhooks/store-redact`
- `POST /webhooks/customers-redact`
- `POST /webhooks/customers-data-request`
- `GET /webhooks/status`

NubeSDK:

- Script publico: `https://sku-image-sync.onrender.com/nube/main.min.js`
- Uso no Partner Portal: cadastrar esse script com a opcao `Uses Nube SDK` ativada.
- Comportamento: o SKU Image Sync e um app administrativo para o lojista, sem componente de vitrine. O script NubeSDK e neutro, nao injeta interface no storefront, nao manipula DOM e existe apenas para compatibilidade tecnica de homologacao quando a Nuvemshop exigir um script SDK vinculado ao app.

Exemplo de dry-run:

```bash
curl -X POST http://localhost:3000/sync/dry-run \
  -H "Content-Type: application/json" \
  -d "{\"imagesRoot\":\"./Fotos\",\"mode\":\"sync\"}"
```

## CLI

```bash
npm run sync:dry-run
npm run sync:add
npm run sync:sync
npm run sync:replace
```

Ou:

```bash
node sync-images.js --images-root ./Fotos --mode replace --only-sku 1001
```

## Deploy no Render

Configure um Web Service com:

- Linguagem: `Node.js`
- Comando de build: `npm install`
- Comando de inicio: `npm start`

Variaveis de ambiente no Render:

```env
NUVEMSHOP_USER_AGENT=SKU Image Sync (seu-email@exemplo.com)
APP_URL=https://sku-image-sync.onrender.com
NUVEMSHOP_CLIENT_ID=33268
NUVEMSHOP_CLIENT_SECRET=
NUVEMSHOP_APP_SCOPES=read_products,write_products
PORT=3000
```

`NUVEMSHOP_STORE_ID` e `NUVEMSHOP_ACCESS_TOKEN` ainda podem ser usados no modo de token manual. Depois da instalacao via OAuth, o callback salva `user_id` como ID da loja e usa automaticamente o token de acesso gerado.

Depois do deploy, use a URL do Render na Nuvemshop Partners:

- URL do aplicativo: `https://sku-image-sync.onrender.com`
- Callback: `https://sku-image-sync.onrender.com/auth/callback`
- Privacidade: `https://sku-image-sync.onrender.com/privacy`
- Suporte: `https://sku-image-sync.onrender.com/support`
- LGPD remocao de dados da loja: `https://sku-image-sync.onrender.com/webhooks/store-redact`
- LGPD remocao de dados de clientes: `https://sku-image-sync.onrender.com/webhooks/customers-redact`
- LGPD solicitacao de dados de clientes: `https://sku-image-sync.onrender.com/webhooks/customers-data-request`
- Script NubeSDK: `https://sku-image-sync.onrender.com/nube/main.min.js`

## API Nuvemshop usada

- `GET /products/sku/{sku}`
- `GET /products/{product_id}/images`
- `POST /products/{product_id}/images`
- `DELETE /products/{product_id}/images/{image_id}`

As requisicoes usam o header `Authentication: bearer <token>` e `User-Agent`.

<div align="center">
  <strong>φ</strong>
  <br />
  <sub>Built and maintained by <a href="https://github.com/elidadutra187">Élida Dutra</a>.</sub>
</div>

