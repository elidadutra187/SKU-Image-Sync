# Entradas, páginas e progresso —28/10/2026

Uma pasta principal com fotos nomeadas era tratada como um único produto. O nome `fotos` agrupava todos os arquivos; nomes individuais funcionavam. O agrupamento passa a usar os nomes dos arquivos da raiz; pastas identificadas pelo catálogo e subpastas por produto continuam aceitas. Nomes ambíguos ainda exigem escolha manual.

As três entradas são exclusivas. Trocar entre imagens, pasta e CSV limpa a seleção/prévia anterior. No CSV, `sku` e `arquivo` associam uma foto por linha, com as fotos selecionadas dentro dessa opção. Não é necessário que o arquivo tenha o nome do produto. O SKU exato prevalece sobre o nome da foto; desconhecidos e duplicados não recebem associação automática. BOM, separador vírgula/ponto e vírgula e campos entre aspas são aceitos; arquivos ausentes/conflitantes geram erro claro. O modelo para download é fictício. CSV limita a prévia a50 produtos; planilhas maiores precisam ser divididas.

A prévia mostra10/20/30/40/50 imagens por página. Produtos com mais fotos podem aparecer em várias páginas; marcar um produto seleciona todas as suas fotos do lote. A seleção é independente dos elementos da página visível. Paginar não altera o limite gratuito de dez imagens.

O envio tem barra de progresso por produtos concluídos e contadores de fotos confirmadas, já existentes e erros. Cada imagem confirmada atualiza o contador antes do produto terminar. O100% aparece somente após o trabalho concluir. Falha de consulta tenta novamente três vezes, mantém o envio bloqueado contra repetição e permite atualizar o mesmo trabalho. Uma resposta de início desconhecida consulta o estado antes de qualquer nova tentativa; não cria envio duplicado. Reabrir durante trabalho em execução recupera o progresso da loja autenticada. Estados finais distinguem erro parcial e interrupção.

Validação:74 testes aprovados,1 teste externo opcional ignorado,0 falhas; diff check sem erros. Inclui os três fluxos HTTP, agrupamento de pasta raiz/SKU, CSV sem fallback indevido, paginação com seleção preservada e falha de rede no acompanhamento. Auditoria local dos298 nomes da pasta fornecida resultou em149 grupos e298 imagens preservadas. Isso valida agrupamento, não a presença de todos os produtos no catálogo. Três fotos reais foram conferidas na prévia de produção e encontraram dois produtos, sem envio à loja.

A inspeção visual local confirmou os três modos. Seleção da pasta completa via automação não foi concluída; a inspeção nativa parou porque a ferramenta não conseguiu confirmar a URL ativa. Não declarar teste visual completo nem envio real. Claude real já estava indisponível por cota na frente delegada anterior; nenhuma nova implementação foi atribuída a ele. Codex implementou e testou.

Esta revisão está preparada para autorização de merge; o PR12 anterior de cobrança nativa foi integrado separadamente. Não inclui alterações financeiras, Mercado Pago, permissões ou implantação Render.
