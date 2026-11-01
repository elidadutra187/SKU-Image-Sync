# Pagamento único brasileiro — 01/11/2026

O valor confirmado pela proprietária é **R$79,99 por loja**, sem mensalidade. A confirmação de BRL79,99 era ignorada quando o receptor esperava79,90. O modo fixo agora reconhece apenas os dois valores brasileiros autorizados:7999 e7990 centavos. Uma configuração antiga79,90 também reconhece o preço novo. O registro conserva o valor realmente recebido. Não há alteração de recibos, referências ou datas de pagamentos já persistidos.

A política ARS existente79,90 foi preservada; não há conversão de moeda. O fluxo adicional `usage_once` continua separado, exige intenção/ID próprios e não está habilitado em produção. O modo publicado `platform_once` não faz POST de cobrança. Sua resposta sem confirmação é `unconfirmed`, não um suposto débito `pending`.

O aviso do demo consumido agora diz “Pagamento não confirmado” e oferece suporte em português, inglês e espanhol. Só um bloqueio informado pela plataforma é apresentado como pagamento exigido por ela. OAuth, credenciais e consumo do lote não comprovam dívida.

## Diagnóstico e limite externo

Na consulta autorizada de uma instalação de produção, GET `/store` confirmou a conexão e GET `/webhooks` confirmou `charge/paid` e `charge/failed` no domínio vigente. GET `/concepts/app-cost/services/{app_id}/subscriptions` retornou404 `SubscriptionConcept not found`.

Esse endpoint documenta assinatura periódica. O404, isoladamente, **não comprova inexistência de cobrança única**. O suporte da Nuvemshop deve verificar a modalidade no Portal de Parceiros, o vínculo da instalação, possíveis cobranças no preço anterior e o caminho de pagamento antes de emitir qualquer valor adicional. Não há endpoint documentado de criação de assinatura nesse fluxo. Não transformar o app em mensal nem usar POST de cobrança extra para contornar o problema.

## Validação

- Regressão RED confirmou que79,99 assinado era ignorado.
- Regressão RED adicional confirmou o problema com variável antiga79,90; correção revisada independentemente no Codex.
- Testes HTTP verificam HMAC, app, moeda, evento, valores vizinhos e manutenção de ARS.
- HTTP integrado ao PGlite verifica persistência dos valores79,90/79,99, liberação, repetição idempotente e recusa de alteração de recibo existente.
- Testes DOM verificam aviso e suporte nos três idiomas, além dos textos de preço e traduções.
- Claude Code foi acionado para revisão delimitada, mas retornou `Prompt is too long`; não houve revisão Claude concluída nesta alteração.

Nenhum pagamento real foi realizado nem cobrança criada para validar esta correção. Não houve modificação dos dados financeiros de clientes. PGlite local não equivale a teste financeiro real.

Fontes oficiais consultadas em01/11/2026:

- https://nuvemshop.dev/apps/publish/pricing-billing
- https://nuvemshop.dev/api/resources/2025-03/billing
