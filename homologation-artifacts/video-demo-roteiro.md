# Roteiro do video demo - SKU Image Sync

Duracao sugerida: ate 3 minutos.

## Objetivo do video

Demonstrar a jornada real do lojista desde a instalacao pela Nuvemshop ate a simulacao e sincronizacao de imagens por SKU.

## Cenas obrigatorias

### 1. Instalacao pela Nuvemshop

Mostrar a URL:

`https://www.tiendanube.com/apps/33268/authorize`

Passos:

1. Acessar a URL de instalacao.
2. Autorizar o aplicativo na loja.
3. Mostrar o redirecionamento para `https://sku-image-sync.onrender.com/?connected=1`.
4. Mostrar o status `Conectado na loja`.

Narracao sugerida:

> O aplicativo e instalado pelo fluxo OAuth da Nuvemshop. Apos a autorizacao, ele recebe o token da loja e volta automaticamente para a tela principal conectado.

### 2. Login e acesso de usuario ja conectado

Passos:

1. Acessar `https://sku-image-sync.onrender.com`.
2. Mostrar que o app consulta `/auth/status`.
3. Confirmar que a loja aparece conectada.

Narracao sugerida:

> Quando o lojista retorna ao app, a conexao com a loja e validada automaticamente antes de permitir qualquer previa ou sincronizacao.

### 3. Reinstalacao

Passos:

1. Simular nova instalacao acessando novamente a URL de autorizacao.
2. Confirmar que o app renova a conexao OAuth.
3. Mostrar o retorno para a tela principal.

Narracao sugerida:

> Em uma reinstalacao, o app executa novamente o callback OAuth e atualiza os dados de conexao da loja.

### 4. Upload da pasta Fotos

Estrutura de exemplo:

```text
Fotos/
  MEGA-1001 Produto A/
    1.jpg
    2.jpg
  MEGA-1002 Produto B/
    1.jpg
```

Passos:

1. Selecionar a pasta `Fotos`.
2. Mostrar que o app identifica subpastas que comecam pelo SKU.
3. Escolher lote de 20 ou 50 subpastas.
4. Clicar em `Gerar previa`.

Narracao sugerida:

> O app usa o primeiro bloco do nome da subpasta como SKU. Isso permite que a pasta tenha tambem nome do produto, cor ou descricao sem atrapalhar a busca.

### 5. Previa visual

Passos:

1. Mostrar cards com SKU, nome do produto e fotos locais.
2. Mostrar fotos atuais da loja.
3. Desmarcar um produto como exemplo.
4. Filtrar por status ou buscar por SKU.

Narracao sugerida:

> Antes de alterar a loja, o lojista confere visualmente quais fotos serao enviadas e quais fotos ja existem no produto.

### 6. Simulacao

Passos:

1. Clicar em `Simular selecionados`.
2. Mostrar o resumo com SKUs processados, imagens previstas, ignorados e erros.

Narracao sugerida:

> A simulacao permite validar o resultado antes de modificar qualquer produto.

### 7. Sincronizacao

Passos:

1. Escolher `ADD`, `SYNC` ou `REPLACE`.
2. Explicar rapidamente cada modo.
3. Executar a sincronizacao em um produto de teste.
4. Mostrar o resultado final.

Narracao sugerida:

> No modo ADD, o app adiciona fotos sem apagar as atuais. No modo REPLACE, ele mostra uma confirmacao antes de remover imagens antigas e reenviar tudo.

## Pontos importantes para mostrar

- Instalacao via Nuvemshop, nao pelo painel interno.
- Loja conectada por OAuth.
- Uso dos escopos `read_products` e `write_products`.
- Previa antes da sincronizacao.
- Selecao e desselecao de SKUs.
- Simulacao antes da alteracao real.
- Modo por lotes para catalogos grandes.
- Confirmacao extra no modo REPLACE.

