# SKU Image Sync

Aplicativo Node.js para sincronizar imagens de produtos da Nuvemshop automaticamente atraves do SKU.

## Funcionalidades

- Sincronizacao de imagens em massa por SKU
- Tres modos de operacao: ADD, SYNC e REPLACE
- Interface web simples
- CLI para automacao
- Dry Run para simular sem alteracoes
- Relatorio CSV detalhado
- Retry automatico em caso de erros
- Suporte a JPG, PNG, GIF e WebP
- Controle de estado para evitar reenvios

## Estrutura das Imagens

```
Fotos/
├── 1001/
│   ├── 1.jpg
│   ├── 2.jpg
├── 1002/
│   ├── 1.jpg
│   ├── 2.png
```

Cada pasta deve ter exatamente o nome do SKU do produto na Nuvemshop.

## Instalacao

```bash
git clone https://github.com/elidadutra187/SKU-Image-Sync.git
cd SKU-Image-Sync
npm install
```

## Configuracao

Copie o arquivo de exemplo e configure:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
NUVEMSHOP_STORE_ID=seu_id_da_loja
NUVEMSHOP_ACCESS_TOKEN=seu_token_de_acesso
NUVEMSHOP_USER_AGENT=SKU Image Sync (seu@email.com)
PORT=3000
```

## Uso - Interface Web

```bash
npm start
```

Acesse `http://localhost:3000`

## Uso - Linha de Comando

### Dry Run (simular)

```bash
node sync-images.js --dry-run
```

### Adicionar imagens novas

```bash
node sync-images.js --mode add
```

### Sincronizar (adicionar novas + atualizar alteradas)

```bash
node sync-images.js --mode sync
```

### Substituir todas as imagens

```bash
node sync-images.js --mode replace
```

### Opcoes adicionais

```bash
# Processar apenas um SKU
node sync-images.js --only-sku 1001 --dry-run

# Limitar quantidade de SKUs
node sync-images.js --max-skus 10

# Pasta de imagens personalizada
node sync-images.js --images-root ./MinhasImagens

# Aumentar concorrencia
node sync-images.js --concurrency 3
```

## Modos de Operacao

| Modo | Descricao |
|------|-----------|
| `add` | Adiciona apenas imagens novas. Nao altera imagens existentes. |
| `sync` | Adiciona novas e reenvia imagens que foram modificadas localmente. |
| `replace` | Remove TODAS as imagens do produto e envia as da pasta. |

## Endpoints da API

### Autenticacao

- `GET /auth/status` - Verificar conexao com Nuvemshop

### Sincronizacao

- `POST /sync/add` - Executar modo ADD
- `POST /sync/sync` - Executar modo SYNC
- `POST /sync/replace` - Executar modo REPLACE
- `POST /sync/dry-run` - Simular sincronizacao
- `GET /sync/status` - Status da sincronizacao atual

### Produtos

- `GET /products/sku/:sku` - Buscar produto por SKU
- `GET /products/:id` - Buscar produto por ID
- `GET /products/:id/images` - Listar imagens do produto

## Deploy no Render

1. Conecte seu repositorio GitHub ao Render
2. Configure as variaveis de ambiente
3. Build Command: `npm install`
4. Start Command: `npm start`

URL esperada: `https://sku-image-sync.onrender.com`

## Arquivos Gerados

- `relatorio-sync-[timestamp].csv` - Relatorio de cada execucao
- `.nuvemshop-sync-state.json` - Estado da sincronizacao (nao apagar)

## Estrutura do Projeto

```
SKU-Image-Sync/
├── server.js           # Servidor Express
├── sync-images.js      # CLI
├── package.json
├── .env.example
├── .gitignore
├── README.md
├── public/
│   ├── index.html      # Interface web
│   ├── privacy.html    # Politica de privacidade
│   └── support.html    # Pagina de suporte
├── routes/
│   ├── auth.js         # Rotas de autenticacao
│   ├── sync.js         # Rotas de sincronizacao
│   └── products.js     # Rotas de produtos
├── services/
│   ├── nuvemshop.js    # Cliente da API Nuvemshop
│   └── imageSync.js    # Logica de sincronizacao
└── utils/
    ├── logger.js       # Utilitario de log
    └── csvReport.js    # Gerador de relatorios
```

## Limites

- Tamanho maximo por imagem: 10MB
- Formatos suportados: JPG, JPEG, PNG, GIF, WebP
- Respeita rate limit da API (retry automatico)

## Licenca

MIT

## Autor

Elida Dutra - [@elidadutra187](https://github.com/elidadutra187)
