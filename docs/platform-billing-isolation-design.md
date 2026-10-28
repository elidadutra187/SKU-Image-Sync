# Cobrança por plataforma e expansão — desenho aprovado

## Regra da proprietária

Nuvemshop/Tiendanube usa exclusivamente a cobrança nativa Nuvemshop. Yampi usa Mercado Pago. Mercado Pago nunca deve participar do fluxo financeiro Nuvemshop: sem checkout, botão, link, SDK, chamada de pagamento, renovação ou fallback. Nova plataforma só entra após registro explícito e homologação de seu adaptador. Cadastro de aplicativo ou autorização de contrato não comprova pagamento.

## Abordagem recomendada

Manter os serviços e bancos Neon próprios dos apps. Organizar em cada app uma política explícita de plataforma, um serviço de acesso/assinatura, adaptadores de provedor e repositórios com isolamento por app/plataforma/loja. Contratos e casos de teste comuns serão versionados nos repositórios existentes, sem criar serviço central, novo banco, pacote publicado ou infraestrutura nesta fase.

Alternativas consideradas: conservar somente condicionais/copias atuais custa menos inicialmente, mas favorece divergências entre apps; centralizar a cobrança em serviço novo amplia dependências, migração e operação e não é necessário agora. A recomendação preserva a infraestrutura e permite adicionar adaptadores sem mudar o pagamento das plataformas existentes.

## Política e fronteiras

| Plataforma autenticada | Provedor permitido | Comportamento em erro/ausência |
|---|---|---|
| Nuvemshop/Tiendanube | Nuvemshop nativo | Informar pendência/reconexão/indisponibilidade do provedor nativo; jamais chamar MP |
| Yampi | Mercado Pago | Manter comprovantes válidos e conciliar; não criar cobrança sem integração homologada |
| Nova/desconhecida | Nenhum por padrão | Recusar operações financeiras até instalar e homologar adaptador explícito |

O resolvedor recebe app, plataforma e loja obtidos da sessão e confirmados pelo registro do servidor. Query string, formulário, nome do provedor enviado pelo navegador e flags de ambiente não escolhem a plataforma financeira. Divergência entre sessão, plataforma persistida ou namespace da loja é recusada antes de qualquer chamada ao provedor. Credenciais MP configuradas no serviço não autorizam uso por uma loja Nuvemshop.

As rotas Nuvemshop permanecem ligadas ao adaptador nativo. As rotas Yampi exigem identidade/sessão Yampi e elegibilidade operacional. O serviço de acesso recebe uma evidência normalizada; não contém fallback entre provedores nem chamadas HTTP de pagamento. O adaptador executa as APIs e valida conta/app/loja/referência/valor/moeda. A interface Nuvemshop não renderiza nem inicializa o fluxo MP; o código específico de pagamento Yampi fica separado e é carregado apenas no contexto Yampi. Isso não exige separar fisicamente o servidor de cada plataforma.

## Dados, notificações e reconciliação

Preservar instalação, primeiro teste e direitos já comprovados ao reconectar. Contratos, recibos e eventos mantêm app, plataforma, loja, provedor, conta/aplicação do provedor e referência imutáveis. Identificadores futuros não podem colidir entre provedores: usar namespaces/repositórios separados ou chaves compostas em migração explícita. Não migrar cobranças nativas ao MP nem transferir recibos entre plataformas.

Webhook é validado e consultado na API; sua vinculação vem do contrato imutável, não do payload declarando outra loja/plataforma. Estorno/contestação não pode ser revertido por evento antigo. Recibo e concessão de acesso são transacionais. Conciliação a cada30min e atualização por evento/ação preservam o objetivo de consumo do Neon; sem novo polling por visita. Workers e consultas de cada plataforma nunca processam lojas da outra. Se aparecer dado incompatível, bloquear e registrar para análise, sem cobrar/cancelar automaticamente outra plataforma.

## Contratos técnicos e extensão

Os adaptadores expõem capacidades reais: consultar acesso, iniciar contratação quando suportado, consultar comprovante, cancelar renovação quando aplicável, validar notificação e conciliar. Pagamento único não implementa renovação fictícia. Uma nova plataforma declara identidade/namespace, provedor autorizado, preço/modelo/teste, capacidades, persistência e tratamento de instalação/desinstalação. O registro é fechado por padrão; não existe provedor genérico Mercado Pago para plataformas desconhecidas.

Regras atuais preservadas: WhatsApp29,90/mês/10dias; Botão15/mês/5dias; Sheets29,90/mês/5dias; Peça39,90/mês/3dias; Imagem79,90único/um lote grátis até10fotos. CSV/Catálogo permanecem Nuvemshop; cadastro Yampi futuro exige integração própria. Sheets Nuvemshop não recebe MP como solução para a cobrança nativa ainda pendente. Peça Yampi continua bloqueado até catálogo/vitrine/OAuth homologados.

## Critérios de aceitação

1. Sessão Nuvemshop tentando qualquer operação MP é recusada; zero chamadas ao MP, inclusive com todas as flags MP habilitadas em teste.
2. Trocar `platform`/`storeId`/`provider` no navegador não muda o provedor nem o acesso financeiro.
3. Erros401/402/403/404/5xx e timeout da cobrança nativa nunca acionam MP.
4. Recibo/webhook de outro app, plataforma, conta ou loja não concede nem revoga acesso.
5. Interface Nuvemshop não apresenta ou inicializa contratação MP; Yampi não apresenta checkout nativo Nuvemshop.
6. Plataforma desconhecida é recusada antes de acesso ao provedor/banco financeiro; futuras integrações entram só por adaptador explícito e testes.
7. Reinstalação, pagamento pendente/aprovado, renovação, cancelamento, reembolso, eventos duplicados/atrasados e falha de persistência preservam as regras por plataforma.
8. Testes locais e consultas reais de sandbox são distinguidos de homologação completa. Os cinco acessos de teste no Railway permanecem desabilitados para cobrança e foram configurados sem deploy.

## Execução e limites

Primeiro auditar as fronteiras existentes com Claude real; Codex integra. Após aprovação deste desenho, produzir plano e testes de regressão, aplicar ajustes mínimos nos cinco rascunhos e revisar os diffs. Sem merge, deploy, mudança de preço, cobrança real ou migração automática de contratos nesta etapa. O desenho foi aprovado explicitamente pela proprietária em27/10. Registro/adaptadores e regressões implementados e revisados em28/10; publicação limitada aos rascunhos. A separação Nuvemshop/Yampi é requisito permanente.

Estado real27/10: cinco apps MP cadastrados; cinco tokens de teste próprios obtidos pelo MCP oficial, identidades `test_user` confirmadas na API e configuração preparada no Railway com ENABLED=false/PRODUCTION_ENABLED=false e --skip-deploys. APIs de consulta responderam200. Não houve pagamento ou contrato criado pelo Codex. Usuária informou salvar os produtos no painel, mas lista ainda mostra rótulos antigos; causa não comprovada. Não atribuir a cache sem evidência. Registro de testes e configuração em work/mercado-pago-test-identities-20261027.json, work/mercado-pago-test-api-probes-20261027.json e work/mercado-pago-railway-test-staging-20261027.json. Segredos não pertencem a estes documentos.
