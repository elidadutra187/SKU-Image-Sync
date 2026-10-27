

## Cobrança Yampi — 26/10/2026

Mercado Pago PF aprovado pela proprietária; cobrança Nuvemshop permanece nativa. Implementação isolada por app/loja no próprio banco, sem segredos compartilhados, desabilitada por padrão. Checkout hospedado; aprovação do contrato e OAuth não comprovam parcela paga. Somente consulta canônica ao provedor, assinatura do webhook e recibo vinculado à conta/app/loja liberam acesso. Eventos duplicados não renovam em dobro; estornos são terminais, cancelamento mantém períodos já pagos; conciliação30min e escrita transacional do recibo/acesso.

Não ativado em produção: faltam credenciais próprias no Railway, segredo/URL de webhook e homologação com contas de teste. Nenhuma cobrança real foi criada. Testes locais e SQL PGlite não substituem PostgreSQL Neon real e validação no Mercado Pago.
Pagamento único R$79,90, sem assinatura mensal; preservado1 lote grátis com até10 fotos conforme decisão posterior de14/10. Recibos persistem ao desconectar/reconectar.
