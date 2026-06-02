# Diagrama de sequencia - SKU Image Sync

Este documento representa os fluxos tecnicos do aplicativo e como os escopos da API Nuvemshop sao utilizados.

## Escopos

| Escopo | Uso no aplicativo |
| --- | --- |
| `read_products` | Buscar produto por SKU e listar imagens atuais do produto. |
| `write_products` | Enviar imagens novas e remover imagens antigas quando o usuario confirma uma sincronizacao. |

## 1. Instalacao OAuth

```mermaid
sequenceDiagram
    actor Lojista
    participant NS as Nuvemshop
    participant App as SKU Image Sync
    participant Store as Arquivo seguro do Render

    Lojista->>NS: Acessa URL de instalacao /apps/33268/authorize
    NS->>Lojista: Solicita autorizacao dos escopos read_products/write_products
    Lojista->>NS: Autoriza o aplicativo
    NS->>App: GET /auth/callback?code=...
    App->>NS: POST /apps/authorize/token com client_id, client_secret e code
    NS-->>App: Retorna access_token e user_id da loja
    App->>Store: Salva store_id e access_token
    App-->>Lojista: Redireciona para /?connected=1
```

Resultado: o aplicativo fica conectado a loja autorizada e pode consultar produtos e sincronizar imagens conforme acao do lojista.

## 2. Geracao de previa

```mermaid
sequenceDiagram
    actor Lojista
    participant Browser as Navegador
    participant App as SKU Image Sync
    participant NS as API Nuvemshop

    Lojista->>Browser: Seleciona pasta Fotos e lote 20 ou 50
    Browser->>App: POST /sync/preview com imagens e manifest
    App->>App: Agrupa imagens por subpasta e extrai SKU inicial
    loop Para cada SKU do lote
        App->>NS: GET /products/sku/{sku}
        NS-->>App: Produto correspondente
        App->>NS: GET /products/{product_id}/images?per_page=200
        NS-->>App: Imagens atuais do produto
    end
    App-->>Browser: Retorna previa com produto, fotos locais e fotos atuais
    Browser-->>Lojista: Mostra cards para confirmar, selecionar ou desmarcar
```

Escopo utilizado: `read_products`.

## 3. Simulacao antes de sincronizar

```mermaid
sequenceDiagram
    actor Lojista
    participant Browser as Navegador
    participant App as SKU Image Sync
    participant NS as API Nuvemshop
    participant Report as Relatorio CSV

    Lojista->>Browser: Clica em Simular selecionados
    Browser->>App: POST /sync/session/{sessionId}/run com dryRun=true
    App->>NS: Consulta produto e imagens atuais dos SKUs selecionados
    App->>Report: Registra acoes previstas sem alterar a loja
    App-->>Browser: Retorna estatisticas da simulacao
    Browser-->>Lojista: Mostra processados, enviados previstos, removidos previstos e erros
```

Escopo utilizado: `read_products`.

## 4. Sincronizacao ADD

```mermaid
sequenceDiagram
    actor Lojista
    participant Browser as Navegador
    participant App as SKU Image Sync
    participant NS as API Nuvemshop

    Lojista->>Browser: Confirma modo ADD
    Browser->>App: POST /sync/session/{sessionId}/run com mode=add
    loop Para cada imagem local selecionada
        App->>NS: POST /products/{product_id}/images
        NS-->>App: Imagem criada
    end
    App-->>Browser: Retorna resultado da sincronizacao
```

Escopos utilizados: `read_products` e `write_products`.

## 5. Sincronizacao REPLACE

```mermaid
sequenceDiagram
    actor Lojista
    participant Browser as Navegador
    participant App as SKU Image Sync
    participant NS as API Nuvemshop

    Lojista->>Browser: Escolhe REPLACE
    Browser-->>Lojista: Exibe confirmacao de risco
    Lojista->>Browser: Confirma remocao e reenvio
    Browser->>App: POST /sync/session/{sessionId}/run com mode=replace
    App->>NS: GET /products/{product_id}/images?per_page=200
    loop Para cada imagem atual
        App->>NS: DELETE /products/{product_id}/images/{image_id}
    end
    loop Para cada imagem local
        App->>NS: POST /products/{product_id}/images
    end
    App-->>Browser: Retorna imagens removidas, enviadas e erros
```

Escopos utilizados: `read_products` e `write_products`.

## 6. Webhooks LGPD

```mermaid
sequenceDiagram
    participant NS as Nuvemshop
    participant App as SKU Image Sync

    NS->>App: POST /webhooks/store-redact
    App-->>NS: 200 OK
    NS->>App: POST /webhooks/customers-redact
    App-->>NS: 200 OK
    NS->>App: POST /webhooks/customers-data-request
    App-->>NS: 200 OK
```

Resultado: o app responde aos webhooks obrigatorios de privacidade. O app nao armazena dados de clientes.

