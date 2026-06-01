# SKU Image Sync

Backend Node.js para sincronizar imagens de produtos da Nuvemshop usando o SKU como chave.

## Estrutura esperada das imagens

```text
Fotos/
  1001/
    1.jpg
    2.jpg
  1002/
    1.jpg
    2.jpg
```

Cada subpasta dentro de `Fotos` deve ter exatamente o SKU do produto.

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

OAuth scaffold:

- `GET /auth/install`
- `GET /auth/callback`
- `GET /auth/status`

When `NUVEMSHOP_CLIENT_ID` and `NUVEMSHOP_CLIENT_SECRET` are configured, `/auth/callback` exchanges the OAuth `code` for an `access_token` and stores it locally in `.nuvemshop-oauth-token.json`. The token is not printed in responses.

Sincronizacao:

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

- Language: `Node.js`
- Build Command: `npm install`
- Start Command: `npm start`

Variaveis de ambiente no Render:

```env
NUVEMSHOP_USER_AGENT=SKU Image Sync (seu-email@exemplo.com)
APP_URL=https://sku-image-sync.onrender.com
NUVEMSHOP_CLIENT_ID=33268
NUVEMSHOP_CLIENT_SECRET=
NUVEMSHOP_APP_SCOPES=read_products,write_products
PORT=3000
```

`NUVEMSHOP_STORE_ID` and `NUVEMSHOP_ACCESS_TOKEN` can still be used for manual-token mode. After OAuth installation, the callback stores `user_id` as the store ID and uses the generated access token automatically.

Depois do deploy, use a URL do Render na Nuvemshop Partners:

- URL do aplicativo: `https://sku-image-sync.onrender.com`
- Callback: `https://sku-image-sync.onrender.com/auth/callback`
- Privacy: `https://sku-image-sync.onrender.com/privacy`
- Support: `https://sku-image-sync.onrender.com/support`
- LGPD store redact: `https://sku-image-sync.onrender.com/webhooks/store-redact`
- LGPD customers redact: `https://sku-image-sync.onrender.com/webhooks/customers-redact`
- LGPD customers data request: `https://sku-image-sync.onrender.com/webhooks/customers-data-request`

## API Nuvemshop usada

- `GET /products/sku/{sku}`
- `GET /products/{product_id}/images`
- `POST /products/{product_id}/images`
- `DELETE /products/{product_id}/images/{image_id}`

As requisicoes usam o header `Authentication: bearer <token>` e `User-Agent`.
