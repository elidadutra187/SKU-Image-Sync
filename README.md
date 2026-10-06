# Imagem em Lote

Sincronize fotos de produtos na Nuvemshop pelo nome do arquivo ou pelo SKU, com conferência antes de alterar a loja.

## Para o lojista

1. Conecte a loja e selecione as imagens. Não é necessário criar pastas por SKU.
2. Para o produto “Camiseta Azul”, use `Camiseta Azul_01.jpg` e `Camiseta Azul_02.jpg`.
3. Clique em **Encontrar produtos**. Confira o produto associado e as fotos atuais.
4. Para arquivos sem correspondência ou nomes repetidos, escolha o produto manualmente.
5. Envie apenas os produtos conferidos. O padrão mantém as fotos existentes. Uma simulação pode ser feita antes do envio.

Pastas com SKU e filtro CSV continuam em opções avançadas. A associação é por texto; não há IA visual.

## Demo e acesso

2 lotes grátis por loja, cada um com até 10 produtos distintos. Várias fotos do mesmo produto contam uma vez. Prévia e simulação não consomem lotes. O início de cada envio real reserva um lote; falhas parciais não devolvem o lote. O 3º envio exige acesso pago. A interface mostra quantos lotes restam; reconectar não zera a contagem.

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
