# Instruções do projeto

- A experiência principal é selecionar fotos pelo nome do arquivo; pastas com SKU e CSV são opções avançadas.
- Usar português claro e exemplos do ponto de vista do lojista. Não expor configuração de servidor no fluxo do cliente.
- Não usar IA visual para associar fotos. Comparar SKU exato e nome normalizado com o catálogo da loja autenticada.
- Nomes duplicados ou aproximados exigem escolha manual. Nunca enviar uma sugestão ambígua automaticamente.
- O padrão é adicionar mantendo fotos atuais. Substituição exige confirmação explícita.
- O demo é um único lote de até 10 produtos distintos por loja; várias fotos contam como um produto.
- Prévia e simulação não consomem o demo. O envio real reserva e utiliza o demo antes das operações. Não resetar por reconexão.
- Persistir o acesso no banco e bloquear processamento quando ele não estiver disponível. Não confiar em flags de pagamento do navegador.
- Pagamento único por loja. R$99,90 é apenas proposta, não um preço aprovado. Serviço e credenciais de pagamento ainda pendentes.
- Não reabrir para vendas antes de validar pagamento, reserva concorrente no PostgreSQL real e envio na loja demo.
- Suporte público: elunalab@gmail.com. O link atual abre o e-mail do cliente; não é webhook de suporte.
- Usar o plugin GitHub para escritas no GitHub. Não misturar banco, credenciais ou serviços com Botão Comprar ou Continuar pelo WhatsApp.
- Manter a documentação de preparação atualizada em PREPARACAO-PUBLICO.md.
