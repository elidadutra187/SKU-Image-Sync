# Instruções do projeto

- Trabalhar e salvar artefatos em D:\Users\elida\Documents\Codex. Sempre informar esse diretório nos comandos; o diretório inicial de uma conversa pode estar em C: e não deve ser usado para este projeto.
- Interface em pt-BR, en e es. Usar o seletor compartilhado em todas as páginas e conservar a escolha entre páginas. Traduzir mensagens dinâmicas e confirmações; nunca traduzir nomes reais de produtos ou arquivos enviados. Preço BRL não implica conversão de moeda pelo idioma.

- Nome público: Imagem em Lote. URL de produção: https://imagememlote.onrender.com. Manter o identificador técnico do repositório SKU-Image-Sync.
- Serviço Render principal: srv-db1ejulg1s2s739r08v0. O serviço srv-d8f18h8g4nts738dgdkg mantém o endereço antigo durante a transição; não apagar antes de confirmar as URLs do Partners.

- A experiência principal é selecionar fotos pelo nome do arquivo; pastas com SKU e CSV são opções avançadas.
- Usar português claro e exemplos do ponto de vista do lojista. Não expor configuração de servidor no fluxo do cliente.
- Não usar IA visual para associar fotos. Comparar SKU exato e nome normalizado com o catálogo da loja autenticada.
- Nomes duplicados ou aproximados exigem escolha manual. Nunca enviar uma sugestão ambígua automaticamente.
- O padrão é adicionar mantendo fotos atuais. Substituição exige confirmação explícita.
- O demo permite exatamente 10 lotes gratuitos por loja. Manter até 10 produtos distintos por lote gratuito; várias fotos contam como um produto. Depois do décimo lote, somente acesso pago permite novos envios. Decisão da usuária em 04/10/2026.
- Prévia e simulação não consomem o demo. O envio real reserva e utiliza o demo antes das operações. Não resetar por reconexão.
- Persistir o acesso no banco e bloquear processamento quando ele não estiver disponível. Não confiar em flags de pagamento do navegador.
- Pagamento único de R$79,90 por loja, aprovado pela usuária em 04/10/2026, exclusivamente pela cobrança nativa da Nuvemshop. Não criar checkout externo.
- Liberação paga exige webhook charge/paid com HMAC válido, app_id deste app, loja conhecida, valor, moeda e conceito esperados. Não liberar com charge/created, charge/failed ou simples acesso à API.
- Não criar cobrança nem mudar preço para clientes antes de confirmar o valor e validar o comportamento do demo por lote na cobrança nativa.
- Não reabrir para vendas antes de validar pagamento, reserva concorrente no PostgreSQL real e envio na loja demo.
- Suporte público: elunalab@gmail.com. Formulário com um anexo de até 5 MB, via webhook exclusivo Google Apps Script executado pela conta autorizada elidadutra182@gmail.com. Não reutilizar implantação nem segredo de outro app. Informar indisponibilidade e oferecer contato direto por e-mail até terminar a autorização/configuração; só confirmar chamado após aceite do provedor.
- Usar o plugin GitHub para escritas no GitHub. Não misturar banco, credenciais ou serviços com Botão Comprar ou Continuar pelo WhatsApp.
- Manter a documentação de preparação atualizada em PREPARACAO-PUBLICO.md.
