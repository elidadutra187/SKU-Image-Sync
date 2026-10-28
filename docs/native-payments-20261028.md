# Pagamento único da plataforma — 28/10/2026

Modo platform_once é o padrão do app publicado. O preço fixo cadastrado na Nuvemshop não gera POST de cobrança adicional pelo novo fluxo. O botão orienta a conferir o pagamento no administrador e alerta quem já pagou para não comprar novamente. Um lote gratuito de até dez imagens permanece; prévia/simulação não consomem o lote. Yampi não foi alterada.

Webhook nativo pode confirmar a cobrança fixa mesmo sem image_sync_purchase local. Exige HMAC/corpo original, app_id, loja conhecida, identificação da cobrança, conceito, preço e moeda correspondentes e datas válidas. Recebimentos BRL/ARS usam79,90 conforme fichas consultadas; outros países precisam política confirmada antes de receber pagamentos. image_sync_native_receipts registra evidência com unicidade por charge_id e atualiza o acesso na mesma instrução SQL. Duplicata não estende nem transfere pagamento para outra loja. O antigo modo usage_once fica isolado e explicitamente selecionado, sem ser ativado nesta entrega.

Cadastro dos hooks de confirmação independe da flag que desativa a criação de cobranças adicionais. A tabela nova é criada pela inicialização normal do banco. Nenhum token, contrato, pagamento ou configuração real foi modificado pelo código local.

Verificação: npm test,64 aprovados,1 teste PostgreSQL externo opcional ignorado,0 falhas. O teste SQL local em PGlite verifica liberação sem compra adicional, duplicatas, saldo preservado e isolamento de lojas. Não equivale a pagamento real nem envio real de fotos.

Pendências externas preservadas: Saldão5255436 continua com divergência Cancelado no Partners/Ativada no administrador e API402; Tannery6556813/Huapi6557210 possuem último pagamento23/10 no Partners, mas faltam OAuth e prova conciliada no banco atual. Nenhum direito vitalício ou nova cobrança foi inventado. Requer recuperação/reautorização e conciliação do modelo anterior. Ficha brasileira foi corrigida por autorização expressa da proprietária em28/10 para1lote/10imagens; verificar evidência operacional fora do repositório.

Código preparado para revisão, sem merge/deploy nesta entrega. Mercado Pago de outro chat permanece separado. Codex implementou e testou; revisão inicial Claude real teve sugestões rejeitadas por campos inexistentes no contrato oficial e, depois, a cota impediu a implementação delegada.
