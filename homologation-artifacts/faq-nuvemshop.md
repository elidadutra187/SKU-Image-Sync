# FAQ - SKU Image Sync

## O que e o SKU Image Sync?

O SKU Image Sync e um aplicativo para sincronizar imagens de produtos da Nuvemshop usando o SKU como chave. Ele ajuda lojas com muitos produtos a enviar fotos em massa com previa visual e controle por produto.

## Para quem o app e indicado?

Para e-commerces que trabalham com catalogos grandes, recebem imagens de fornecedores, atualizam produtos com frequencia ou precisam reduzir tarefas manuais no cadastro de fotos.

## Como instalar o aplicativo?

1. Acesse a URL de instalacao:
   `https://www.tiendanube.com/apps/33268/authorize`
2. Autorize os escopos solicitados.
3. Aguarde o redirecionamento para:
   `https://sku-image-sync.onrender.com`
4. Verifique se aparece `Conectado na loja`.

## Quais permissoes o app usa?

- `read_products`: para buscar produtos por SKU e listar imagens atuais.
- `write_products`: para enviar ou remover imagens de produtos quando o lojista confirma a sincronizacao.

O app nao acessa pedidos, clientes, pagamentos, envios ou estoque.

## Como as pastas de imagens devem ser organizadas?

As imagens devem estar dentro de uma pasta raiz, com subpastas que comecem pelo SKU:

```text
Fotos/
  MEGA-1001 Produto Azul/
    1.jpg
    2.jpg
  MEGA-1002 Produto Preto/
    1.jpg
```

O app usa o primeiro bloco do nome da pasta como SKU. Por exemplo:

- `MEGA-1001 Produto Azul` usa o SKU `MEGA-1001`.
- `1001 Camiseta Branca` usa o SKU `1001`.

## Posso usar CSV?

Sim. O CSV e opcional e pode limitar quais SKUs entram na previa. Ele aceita virgula ou ponto e virgula. A coluna pode se chamar `sku`, `codigo`, `pasta`, `folder` ou ser a primeira coluna do arquivo.

## O que e a previa?

A previa mostra o produto encontrado, as fotos locais que serao enviadas e as fotos atuais da loja. O lojista pode selecionar ou desmarcar produtos antes de qualquer alteracao.

## O que significa ADD?

ADD adiciona imagens novas sem remover as fotos atuais do produto. E o modo recomendado para primeira sincronizacao.

## O que significa SYNC?

SYNC compara as imagens locais com o estado salvo de sincronizacao e envia imagens novas ou alteradas.

## O que significa REPLACE?

REPLACE remove as imagens atuais do produto selecionado e envia todas as imagens locais da pasta do SKU. Antes de executar, o app mostra uma confirmacao de risco.

## O app altera produtos automaticamente?

Nao. O app so altera produtos quando o lojista seleciona os SKUs e confirma a sincronizacao. Antes disso, e possivel gerar previa e simular.

## O app funciona com catalogos grandes?

Sim. Para evitar lentidao e reduzir risco de limite da API, a previa pode ser feita por lotes de 20 ou 50 subpastas.

## O app armazena dados de clientes?

Nao. O app nao usa dados de clientes. Ele trabalha com produtos, imagens e SKUs.

## Como obter suporte?

Use a pagina de suporte:

`https://sku-image-sync.onrender.com/support`

Ou envie mensagem para o e-mail de suporte configurado no painel de parceiros.

