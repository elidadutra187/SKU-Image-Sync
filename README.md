# SKU Image Sync

Sincronize fotos de produtos na Nuvemshop pelo nome do arquivo ou pelo SKU, com conferência antes de alterar a loja.

## Para o lojista

1. Conecte a loja e selecione as imagens. Não é necessário criar pastas por SKU.
2. Para o produto “Camiseta Azul”, use `Camiseta Azul_01.jpg` e `Camiseta Azul_02.jpg`.
3. Clique em **Encontrar produtos**. Confira o produto associado e as fotos atuais.
4. Para arquivos sem correspondência ou nomes repetidos, escolha o produto manualmente.
5. Envie apenas os produtos conferidos. O padrão mantém as fotos existentes. Uma simulação pode ser feita antes do envio.

Pastas com SKU e filtro CSV continuam em opções avançadas. A associação é por texto; não há IA visual.

## Demo e acesso

Um único lote grátis de até 10 produtos distintos por loja. Várias fotos do mesmo produto contam uma vez. Prévia e simulação não consomem o demo. O início do envio real reserva o demo; falhas parciais não liberam um novo lote.

Depois do demo, pagamento único pela **Nuvemshop** deve liberar novos lotes e reutilizações na mesma loja. O receptor de confirmação nativa está implementado em `/webhooks/billing`, validando HMAC, aplicativo, loja, valor, moeda e conceito. **Preço e configuração no Partners pendentes.** O bloqueio é feito no servidor e persistido no PostgreSQL, independente da autorização OAuth. Sem DATABASE_URL, o processamento fica bloqueado. Não há checkout externo.

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
