/* "Como usar" content for Imagem em Lote (rendered by eluna-ui.js). */
(function () {
  "use strict";
  var C = {
    pt: {
      pageTitle: "Como usar — Imagem em Lote",
      title: "Como usar o Imagem em Lote",
      intro: "O Imagem em Lote coloca muitas fotos nos produtos certos de uma vez. Ele lê o nome de cada arquivo (ou o SKU), encontra o produto na sua loja e mostra tudo para você conferir antes de enviar. Nada muda na loja sem a sua confirmação.",
      demo: { title: "Veja como o app encontra os produtos", help: "Exemplo com nomes de arquivo. Fotos com o mesmo nome e números no final (01, 02) vão para o mesmo produto." },
      glossary: [
        ["Prévia", "A lista que o app monta depois de \"Encontrar produtos\": cada foto ao lado do produto encontrado. Gerar a prévia não altera a loja."],
        ["SKU", "O código do produto ou da variação cadastrado na loja. Se o nome do arquivo começar com o SKU, o app reconhece."],
        ["Lote", "Um grupo de fotos enviado de uma vez. Seleções grandes são divididas em lotes automaticamente."],
        ["Simular", "Faz o caminho todo sem enviar nada, para você ver o resultado com segurança."],
        ["Relatório", "Arquivo com o que foi enviado e o que deu erro, para conferir depois."]
      ],
      steps: [
        { title: "Conecte a sua loja", text: "No quadro de conexão, escolha a plataforma (Nuvemshop/Tiendanube ou Yampi) e clique em \"Conectar minha loja\". Autorize o app a consultar produtos e enviar imagens.", list: ["Quando aparecer \"Loja conectada\", está tudo certo.", "O app não pede a sua senha."], tip: "Se aparecer um aviso de acesso, use o link de ajuda do aviso ou fale com o suporte.", go: "/#connectionCard" },
        { title: "Escolha como vai selecionar as fotos", text: "Em \"Como você quer selecionar as fotos?\", escolha uma das três formas:", list: ["Por imagens: você escolhe as fotos, e o nome de cada arquivo diz o produto.", "Por pasta: você escolhe uma pasta; as fotos da pasta principal são agrupadas pelo nome, e subpastas podem ter o nome ou SKU do produto.", "Por CSV: uma planilha com as colunas sku e arquivo diz qual foto vai em qual produto."], tip: "Trocar a forma de seleção limpa a seleção anterior. Na dúvida, comece por imagens.", go: "/#inputModes" },
        { title: "Selecione as fotos", text: "Clique na área de seleção ou arraste os arquivos para ela. Use o nome do produto no nome do arquivo.", list: ["Exemplo: Camiseta Azul_01.jpg e Camiseta Azul_02.jpg vão para o produto \"Camiseta Azul\".", "Acentos, espaços, hífens e sublinhados são aceitos.", "No modo CSV, baixe o modelo, preencha e selecione o CSV e depois as fotos indicadas nele."], tip: "Arquivos como IMG_1234.jpg não dizem o produto: você escolhe o produto na prévia.", go: "/#imagesPanel" },
        { title: "Clique em \"Encontrar produtos\"", text: "O app compara o nome (ou o SKU) com o catálogo da sua loja e monta a prévia.", list: ["Seleções grandes são divididas em lotes. Escolha o lote para conferir.", "Nada é enviado nesta etapa."], tip: "Quer escolher o produto de cada foto à mão? Marque \"Escolher um produto para cada foto\" antes de encontrar.", go: "/#preview" },
        { title: "Confira a prévia", text: "Em \"Confira antes de enviar\", cada grupo de fotos aparece ao lado do produto encontrado e das fotos que ele já tem. Marque só os produtos certos.", list: ["Faltou encontrar? Busque o produto pelo nome e clique em \"Confirmar produto\".", "Nomes parecidos ou repetidos nunca são escolhidos sozinhos: você confirma.", "Mude entre 10 e 50 imagens por página; a seleção continua ao trocar de página."], tip: "O app não olha o conteúdo da foto, só o nome do arquivo ou o SKU.", go: "/#review" },
        { title: "Decida o que fazer com as fotos atuais", text: "Em \"Opções avançadas de atualização\", o padrão é manter as fotos atuais e adicionar as novas.", list: ["Manter as atuais e adicionar as novas (recomendado).", "Atualizar fotos enviadas antes pelo app.", "Remover as atuais e enviar estas fotos: apaga as imagens atuais dos produtos marcados."], tip: "Só use \"Remover as atuais\" depois de conferir bem a prévia.", go: "/#mode" },
        { title: "Simule e envie", text: "Clique em \"Simular sem alterar a loja\" para testar. Quando estiver tudo certo, clique em \"Enviar fotos selecionadas\".", list: ["Simular não gasta o lote grátis nem altera produtos."], tip: "Envie um lote de cada vez e confira antes de passar ao próximo.", go: "/#send" },
        { title: "Acompanhe o envio e baixe o relatório", text: "A barra de progresso mostra quantas fotos já foram. Espere a mensagem de conclusão e clique em \"Baixar relatório\" para ver os detalhes.", list: ["Se a conexão cair, não reenvie de imediato: confira o relatório e a loja primeiro."], tip: "Uma foto foi para o produto errado? Fale com o suporte antes de tentar de novo.", go: "/#progressPanel" }
      ],
      features: [
        ["Associação pelo nome", "Encontra o produto pelo nome do arquivo, sem precisar separar em pastas."],
        ["Reconhece SKU", "Se o nome do arquivo ou da subpasta tem o SKU, o produto é encontrado na hora."],
        ["Três formas de seleção", "Por imagens, por pasta ou por CSV."],
        ["Prévia segura", "Você confere cada produto antes de enviar. Prévia e simulação não alteram a loja."],
        ["Escolha manual", "Para nomes iguais, incompletos ou arquivos genéricos, você escolhe o produto."],
        ["Progresso e relatório", "Acompanhe o envio e baixe o resultado."]
      ],
      faq: [
        ["Preciso renomear todos os arquivos?", "Não. O nome ajuda a associação automática. Se o arquivo não tiver o nome do produto, escolha o produto na prévia."],
        ["Vou perder as fotos que já estão nos produtos?", "Não, a não ser que você escolha \"Remover as atuais\". O padrão é manter e adicionar."],
        ["Quantas fotos posso enviar?", "Até 50 produtos por lote e até 500 fotos por seleção. Seleções maiores são divididas em lotes."],
        ["Quanto custa?", "Na Nuvemshop: assinatura de R$ 39,90 por mês, com 3 dias grátis, cobrada pela Nuvemshop. Na Yampi: 1 lote grátis de até 10 imagens e depois pagamento único de R$ 79,90 pelo Mercado Pago."],
        ["Reconectar a loja reinicia o teste grátis?", "Não. O teste e o lote grátis valem uma vez por loja."]
      ]
    },
    es: {
      pageTitle: "Cómo usar — Imagem em Lote",
      title: "Cómo usar Imagem em Lote",
      intro: "Imagem em Lote pone muchas fotos en los productos correctos de una vez. Lee el nombre de cada archivo (o el SKU), encuentra el producto en tu tienda y te muestra todo para revisar antes de enviar. Nada cambia sin tu confirmación.",
      demo: { title: "Mira cómo encuentra los productos", help: "Ejemplo con nombres de archivo. Fotos con el mismo nombre y números al final (01, 02) van al mismo producto." },
      glossary: [
        ["Vista previa", "La lista que arma la app después de \"Encontrar productos\": cada foto junto a su producto. No cambia la tienda."],
        ["SKU", "El código del producto o variante. Si el archivo empieza con el SKU, la app lo reconoce."],
        ["Lote", "Grupo de fotos enviado de una vez. Las selecciones grandes se dividen solas."],
        ["Simular", "Hace todo el camino sin enviar nada."],
        ["Informe", "Archivo con lo que se envió y lo que falló."]
      ],
      steps: [
        { title: "Conecta tu tienda", text: "En el cuadro de conexión, elige la plataforma (Tiendanube o Yampi) y haz clic en \"Conectar mi tienda\". Autoriza la app.", list: ["Cuando aparezca \"Tienda conectada\", está todo listo.", "La app no pide tu contraseña."], tip: "Si aparece un aviso de acceso, usa su enlace de ayuda o escribe al soporte.", go: "/#connectionCard" },
        { title: "Elige cómo seleccionar las fotos", text: "En \"¿Cómo quieres seleccionar las fotos?\", elige una opción:", list: ["Por imágenes: el nombre de cada archivo indica el producto.", "Por carpeta: las fotos de la carpeta principal se agrupan por nombre; las subcarpetas pueden tener el nombre o SKU.", "Por CSV: una planilla con las columnas sku y arquivo indica qué foto va en qué producto."], tip: "Cambiar la forma limpia la selección anterior.", go: "/#inputModes" },
        { title: "Selecciona las fotos", text: "Haz clic en el área de selección o arrastra los archivos. Usa el nombre del producto en el archivo.", list: ["Ejemplo: Remera Azul_01.jpg y Remera Azul_02.jpg van a \"Remera Azul\".", "Se aceptan acentos, espacios, guiones y guiones bajos.", "En modo CSV, descarga el modelo, complétalo y selecciona el CSV y las fotos."], tip: "Archivos como IMG_1234.jpg no indican el producto: lo eliges en la vista previa.", go: "/#imagesPanel" },
        { title: "Haz clic en \"Encontrar productos\"", text: "La app compara el nombre (o SKU) con tu catálogo y arma la vista previa.", list: ["Las selecciones grandes se dividen en lotes.", "Nada se envía en este paso."], tip: "Para elegir a mano, marca \"Elegir un producto para cada foto\" antes.", go: "/#preview" },
        { title: "Revisa la vista previa", text: "Cada grupo de fotos aparece junto al producto encontrado y a sus fotos actuales. Marca solo los correctos.", list: ["¿Faltó alguno? Búscalo por nombre y haz clic en \"Confirmar producto\".", "Los nombres parecidos nunca se eligen solos.", "Cambia entre 10 y 50 imágenes por página sin perder la selección."], tip: "La app no mira el contenido de la foto, solo el nombre o el SKU.", go: "/#review" },
        { title: "Decide qué hacer con las fotos actuales", text: "En las opciones avanzadas, lo estándar es mantener las actuales y agregar las nuevas.", list: ["Mantener y agregar (recomendado).", "Actualizar fotos enviadas antes por la app.", "Quitar las actuales y enviar estas: borra las imágenes actuales de los productos marcados."], tip: "Usa \"Quitar las actuales\" solo después de revisar bien.", go: "/#mode" },
        { title: "Simula y envía", text: "Haz clic en \"Simular sin cambiar la tienda\". Cuando esté todo bien, \"Enviar fotos seleccionadas\".", list: ["Simular no gasta el lote gratis ni cambia productos."], tip: "Envía un lote por vez.", go: "/#send" },
        { title: "Sigue el envío y descarga el informe", text: "La barra muestra cuántas fotos van. Espera la confirmación y descarga el informe.", list: ["Si se corta la conexión, no reenvíes enseguida: revisa el informe y la tienda."], tip: "¿Una foto fue al producto equivocado? Escribe al soporte antes de reintentar.", go: "/#progressPanel" }
      ],
      features: [["Asociación por nombre", "Encuentra el producto por el nombre del archivo."], ["Reconoce SKU", "Si el archivo o la subcarpeta tiene el SKU, lo encuentra al instante."], ["Tres formas de selección", "Por imágenes, carpeta o CSV."], ["Vista previa segura", "Revisas todo antes de enviar."], ["Elección manual", "Para nombres iguales o archivos genéricos."], ["Progreso e informe", "Sigue el envío y descarga el resultado."]],
      faq: [["¿Tengo que renombrar todo?", "No. Si el archivo no tiene el nombre, eliges el producto en la vista previa."], ["¿Pierdo las fotos actuales?", "No, salvo que elijas \"Quitar las actuales\"."], ["¿Cuántas fotos puedo enviar?", "Hasta 50 productos por lote y 500 fotos por selección."], ["¿Cuánto cuesta?", "En Tiendanube: R$ 39,90 por mes con 3 días gratis, cobrado por Tiendanube. En Yampi: 1 lote gratis de hasta 10 imágenes y luego pago único de R$ 79,90 por Mercado Pago."], ["¿Reconectar reinicia la prueba?", "No. La prueba y el lote gratis valen una vez por tienda."]]
    },
    en: {
      pageTitle: "How to use — Imagem em Lote",
      title: "How to use Imagem em Lote",
      intro: "Imagem em Lote puts many photos on the right products at once. It reads each file name (or SKU), finds the product in your store and shows everything for you to check before sending. Nothing changes without your confirmation.",
      demo: { title: "See how products are found", help: "Example with file names. Photos with the same name and numbers at the end (01, 02) go to the same product." },
      glossary: [["Preview", "The list built after \"Find products\": each photo next to its product. It does not change the store."], ["SKU", "The product or variant code. If the file starts with the SKU, the app recognizes it."], ["Batch", "A group of photos sent at once. Large selections are split automatically."], ["Simulate", "Runs everything without sending anything."], ["Report", "A file with what was sent and what failed."]],
      steps: [
        { title: "Connect your store", text: "In the connection box, pick the platform (Nuvemshop/Tiendanube or Yampi) and click \"Connect my store\". Authorize the app.", list: ["When \"Store connected\" shows, you are ready.", "The app never asks for your password."], tip: "If an access notice shows, use its help link or contact support.", go: "/#connectionCard" },
        { title: "Choose how to select photos", text: "In \"How do you want to select photos?\", pick one:", list: ["By images: each file name tells the product.", "By folder: photos in the main folder are grouped by name; subfolders can carry the product name or SKU.", "By CSV: a sheet with sku and arquivo columns says which photo goes where."], tip: "Switching mode clears the previous selection.", go: "/#inputModes" },
        { title: "Select the photos", text: "Click the selection area or drag the files in. Use the product name in the file name.", list: ["Example: Blue Shirt_01.jpg and Blue Shirt_02.jpg go to \"Blue Shirt\".", "Accents, spaces, hyphens and underscores are fine.", "In CSV mode, download the template, fill it and select the CSV and the photos."], tip: "Files like IMG_1234.jpg do not name a product: pick it in the preview.", go: "/#imagesPanel" },
        { title: "Click \"Find products\"", text: "The app compares the name (or SKU) with your catalog and builds the preview.", list: ["Large selections are split into batches.", "Nothing is sent at this step."], tip: "To pick each product by hand, tick \"Choose a product for each photo\" first.", go: "/#preview" },
        { title: "Check the preview", text: "Each photo group shows next to the product found and its current photos. Tick only the right ones.", list: ["Missing one? Search by name and click \"Confirm product\".", "Similar names are never chosen automatically.", "Switch between 10 and 50 images per page without losing your selection."], tip: "The app never looks at the picture itself, only the name or SKU.", go: "/#review" },
        { title: "Decide what happens to current photos", text: "In the advanced options, the default keeps current photos and adds the new ones.", list: ["Keep and add (recommended).", "Update photos sent earlier by the app.", "Remove current and send these: deletes the current images of ticked products."], tip: "Only use \"Remove current\" after a careful check.", go: "/#mode" },
        { title: "Simulate and send", text: "Click \"Simulate without changing the store\". When all is right, click \"Send selected photos\".", list: ["Simulating does not use the free batch or change products."], tip: "Send one batch at a time.", go: "/#send" },
        { title: "Follow the upload and download the report", text: "The progress bar shows how many photos are done. Wait for the confirmation and download the report.", list: ["If the connection drops, do not resend right away: check the report and the store."], tip: "A photo went to the wrong product? Contact support before retrying.", go: "/#progressPanel" }
      ],
      features: [["Name matching", "Finds the product by file name."], ["SKU aware", "If the file or subfolder has the SKU, it is found instantly."], ["Three ways to select", "By images, folder or CSV."], ["Safe preview", "Check everything before sending."], ["Manual choice", "For duplicate names or generic files."], ["Progress and report", "Follow the upload and download the result."]],
      faq: [["Do I need to rename every file?", "No. If a file lacks the product name, pick the product in the preview."], ["Will I lose current photos?", "No, unless you choose \"Remove current\"."], ["How many photos can I send?", "Up to 50 products per batch and 500 photos per selection."], ["How much is it?", "On Nuvemshop: R$ 39.90 per month with 3 free days, billed by Nuvemshop. On Yampi: 1 free batch of up to 10 images, then a one-time R$ 79.90 payment with Mercado Pago."], ["Does reconnecting restart the trial?", "No. The trial and free batch apply once per store."]]
    }
  };
  var FILES = { pt: [["Camiseta Azul_01.jpg", "Camiseta Azul"], ["Camiseta Azul_02.jpg", "Camiseta Azul"], ["CAL-042 Calça Preta.jpg", "Calça Preta (SKU CAL-042)"], ["IMG_1234.jpg", "?"]], es: [["Remera Azul_01.jpg", "Remera Azul"], ["Remera Azul_02.jpg", "Remera Azul"], ["PAN-042 Pantalón Negro.jpg", "Pantalón Negro (SKU PAN-042)"], ["IMG_1234.jpg", "?"]], en: [["Blue Shirt_01.jpg", "Blue Shirt"], ["Blue Shirt_02.jpg", "Blue Shirt"], ["PAN-042 Black Pants.jpg", "Black Pants (SKU PAN-042)"], ["IMG_1234.jpg", "?"]] };
  var MANUAL = { pt: "Escolha o produto na prévia", es: "Elige el producto en la vista previa", en: "Pick the product in the preview" };
  function demo(container, locale) {
    var rows = FILES[locale] || FILES.pt;
    var list = document.createElement("div"); list.className = "il-demo"; list.setAttribute("data-no-translate", "");
    rows.forEach(function (r) {
      var row = document.createElement("div"); row.className = "il-demo-row" + (r[1] === "?" ? " is-manual" : "");
      row.innerHTML = '<span class="il-demo-file">🖼️ <code></code></span><span class="il-demo-arrow" aria-hidden="true">→</span><span class="il-demo-product"></span>';
      row.querySelector("code").textContent = r[0];
      row.querySelector(".il-demo-product").textContent = r[1] === "?" ? MANUAL[locale] || MANUAL.pt : r[1];
      list.appendChild(row);
    });
    container.appendChild(list);
  }
  window.ElunaGuideContent = C;
  window.ElunaGuideDemo = demo;
})();
