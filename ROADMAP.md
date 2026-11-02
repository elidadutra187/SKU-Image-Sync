

## Cobrança Yampi — 26/10/2026

Mercado Pago PF aprovado pela proprietária; cobrança Nuvemshop permanece nativa. Implementação isolada por app/loja no próprio banco, sem segredos compartilhados, desabilitada por padrão. Checkout hospedado; aprovação do contrato e OAuth não comprovam parcela paga. Somente consulta canônica ao provedor, assinatura do webhook e recibo vinculado à conta/app/loja liberam acesso. Eventos duplicados não renovam em dobro; estornos são terminais, cancelamento mantém períodos já pagos; conciliação30min e escrita transacional do recibo/acesso.

Não ativado em produção: faltam credenciais próprias no Railway, segredo/URL de webhook e homologação com contas de teste. Nenhuma cobrança real foi criada. Testes locais e SQL PGlite não substituem PostgreSQL Neon real e validação no Mercado Pago.
Pagamento único R$79,90, sem assinatura mensal; preservado1 lote grátis com até10 fotos conforme decisão posterior de14/10. Recibos persistem ao desconectar/reconectar.


##28/10/2026 — isolamento e expansão de cobrança

Desenho aprovado: política fechada e adaptadores por plataforma, Nuvemshop exclusivamente nativa/Yampi exclusivamente MP, sem fallback e desconhecidos bloqueados. Guardas adicionais nos runtimes/serviços/ledgers e testes de isolamento; UI específica Yampi separada da inicialização nativa. Ver docs/billing-platform-contract.md. Codex integrou, Claude real criou módulosUI e colaborou na auditoria; revisão independente corrigida com regressões. Não integrado ou ativado; homologação real permanece pendente.

Validação final28/10: 84 aprovados, 1 opcionais PostgreSQL ignorados; sem falhas. Revisão independente de UI/corridas concluída, regressões aprovadas. Preparação em rascunho, sem merge/deploy/cobrança real.
