# Contrato de cobrança por plataforma — versão1

## Regra obrigatória

Nuvemshop/Tiendanube usa SOMENTE cobrança nativa Nuvemshop. Yampi usa Mercado Pago. Nunca oferecer MP, inicializar interface/SDK MP ou fazer chamada de pagamento MP em sessão Nuvemshop. Não existe fallback financeiro:401/402/403/404/5xx ou timeout nativo não autoriza outro provedor. Não migrar contratos ou recibos entre plataformas.

## Política e adaptadores

Consulte billingPlatformPolicy.cjs e seus testes. createBillingPolicy resolve {appCode,platform,storeId,billingKind} em contexto imutável. Os valores vêm de sessão e registro autenticado no servidor; nunca de query/body/localStorage. Nuvemshop requer ID nativo; Yampi requer namespace yampi:. Plataforma desconhecida, combinação incoerente ou operação ausente é recusada antes de I/O. As políticas nativas não podem ser sobrepostas por extensões.

O contrato de adaptador prevê getStatus,createCheckout,cancelRenewal,getReceipt,verifyWebhook,reconcile. Cada adaptador implementa apenas capacidades existentes. Compra única não possui cancelamento de renovação. execute seleciona um único provedor e propaga falhas, sem tentar outro. Os adaptadores já existentes mantêm APIs e persistência próprios; a política não contém credenciais/rede/banco. Para registrar uma plataforma futura, declarar explicitamente plataforma, provedor e validador de ID na construção server-side; fornecer adaptador e testes antes de expor rotas ou habilitar flags.

## Isolamento e prova financeira

Operações Yampi validam namespace, sessão atual, plataforma persistida e elegibilidade operacional. Contrato conhecido com ID nativo é recusado antes de consultar MP. Ledger recusa projeção de recibo MP para loja Nuvemshop, mesmo em registro corrompido. Prova de pagamento vincula conta/aplicação do provedor, app, plataforma, loja, referência, valor e moeda. Nenhum OAuth, flag ou status de contrato substitui recibo canônico. Instalação/reconexão não reinicia teste ou apaga recibos. Estornos e eventos antigos mantêm as regras transacionais já testadas.

Na interface, a seleção financeira vem da resposta autenticada do backend, não do seletor/URL. Módulos de checkout Yampi são separados das páginas e inicialização Nuvemshop. No WhatsApp e Imagem, importação dinâmica exige identidade Yampi; callbacks revalidam a identidade após awaits. Campos de pagamento Yampi não pertencem ao HTML Nuvemshop. Botão/Sheets mantêm páginas e scripts próprios Yampi. Não há SDK de cartão externo no app.

## Checklist para nova plataforma

1. Definir identidade autenticada, namespace e ciclo instalar/reconectar/desinstalar.
2. Registrar explicitamente provedor e capacidades; desconhecidos continuam bloqueados.
3. Definir preço, modelo, moeda e primeiro teste; não copiar plano de outra plataforma.
4. Separar dados/credenciais por app/plataforma/conta; planejar chaves sem colisão entre provedores e migrações explícitas.
5. Validar webhook e consultar prova canônica; recibo e acesso na mesma transação.
6. Testar isolamento, falha nativa semfallback, idempotência, estornos, cancelamento, reinstalação e eventos atrasados.
7. Homologar com contas de teste, revisar e obter autorização de publicação/ativação real. Credenciais preenchidas não equivalem a homologação.

Conciliação30min e invalidação por evento/ação permanecem; não adicionar polling por visita ou infraestrutura nova. Rascunhos não estão integrados/deployados. MP mantém flags desabilitadas; testes locais/PGlite e GETs de sandbox não equivalem a um pagamento homologado.

## Manutenção

As cinco cópias da política são equivalentes e versionadas no próprio repositório, sem compartilhar segredos. Mudança do contrato exige incrementar versão quando incompatível, atualizar cópias/testes e conferir hashes. O registro preparado não ativa nenhuma plataforma futura automaticamente. Fonte do desenho aprovado: platform-billing-isolation-design.md.
