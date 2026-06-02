# Artefatos para homologacao Nuvemshop

Este pacote organiza os documentos solicitados pela equipe da Nuvemshop para iniciar a homologacao do aplicativo SKU Image Sync.

## Arquivos deste pacote

- `sequence-diagram.md`: diagrama de sequencia dos fluxos tecnicos e escopos utilizados.
- `video-demo-roteiro.md`: roteiro do video demonstrativo obrigatorio.
- `faq-nuvemshop.md`: FAQ e tutorial de instalacao para envio junto aos artefatos.
- `technical-notes.md`: requisitos tecnicos, cuidados, cobranca e observacoes para a equipe de homologacao.

## Links do aplicativo

- App publicado no Render: `https://sku-image-sync.onrender.com`
- Instalacao OAuth: `https://www.tiendanube.com/apps/33268/authorize`
- Callback OAuth: `https://sku-image-sync.onrender.com/auth/callback`
- Politica de privacidade: `https://sku-image-sync.onrender.com/privacy`
- Suporte: `https://sku-image-sync.onrender.com/support`

## Escopos usados

- `read_products`: buscar produtos por SKU e listar imagens atuais.
- `write_products`: enviar imagens novas e remover imagens antigas quando o modo REPLACE for confirmado.

O aplicativo nao usa escopos de pedidos, clientes, pagamentos, envios ou estoque.

