// Serviço exclusivo do Imagem em Lote. Não reutilizar a implantação de outro app.
// Propriedades do script: WEBHOOK_SECRET (segredo exclusivo) e SUPPORT_TO_EMAIL.
function doPost(e) {
  try {
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('WEBHOOK_SECRET');
    var recipient = properties.getProperty('SUPPORT_TO_EMAIL');
    var payload = JSON.parse(e.postData.contents || '{}');
    if (!secret || payload.secret !== secret) return supportJson({ok:false,error:'invalid_secret'});
    if (!recipient) return supportJson({ok:false,error:'missing_recipient'});
    var to = String(payload.to || '').trim();
    var subject = String(payload.subject || '').trim();
    var body = String(payload.text || '').trim();
    var replyTo = String(payload.replyTo || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to) || !subject || !body) {
      return supportJson({ok:false,error:'invalid_message'});
    }
    // Somente chamados para o suporte e os respectivos comprovantes ao solicitante.
    var inbox = to.toLowerCase() === recipient.toLowerCase() && subject.indexOf('[Suporte] ') === 0;
    var receipt = replyTo.toLowerCase() === recipient.toLowerCase() && subject.indexOf('[Imagem em Lote] Chamado recebido - ') === 0;
    if (!inbox && !receipt) return supportJson({ok:false,error:'invalid_destination'});
    var files = payload.attachments || [];
    if (!Array.isArray(files) || files.length > 1 || (receipt && files.length)) {
      return supportJson({ok:false,error:'invalid_attachment'});
    }
    var attachments = files.map(function(file) {
      var content = String(file.content || '');
      if (content.length > 6990508) throw new Error('attachment_too_large');
      var bytes = Utilities.base64Decode(content);
      if (bytes.length > 5242880) throw new Error('attachment_too_large');
      return Utilities.newBlob(bytes, String(file.contentType || 'application/octet-stream'), String(file.filename || 'anexo'));
    });
    var options = {to:to,subject:subject,body:body,name:'Imagem em Lote'};
    if (replyTo) options.replyTo = replyTo;
    if (attachments.length) options.attachments = attachments;
    MailApp.sendEmail(options);
    var receiptSent;
    if (inbox && payload.receipt) {
      receiptSent=false;
      var confirmation=payload.receipt;
      if (confirmation.to === replyTo && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)
          && typeof confirmation.subject==='string' && confirmation.subject.indexOf('[Imagem em Lote] Chamado recebido - ')===0
          && typeof confirmation.text==='string' && confirmation.text.length>0 && confirmation.text.length<=10000) {
        try {MailApp.sendEmail({to:replyTo,replyTo:recipient,subject:confirmation.subject,body:confirmation.text,name:'Imagem em Lote'});receiptSent=true;}
        catch (receiptError) {receiptSent=false;}
      }
    }
    return supportJson({ok:true,messageId:Utilities.getUuid(),receiptSent:receiptSent});
  } catch (error) {
    return supportJson({ok:false,error:'send_failed'});
  }
}
function supportJson(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Execute pela conta proprietária para criar a credencial exclusiva e autorizar o MailApp.
function configurarSuporte() {
 var p = PropertiesService.getScriptProperties();
 if (!p.getProperty("WEBHOOK_SECRET")) p.setProperty("WEBHOOK_SECRET", Utilities.getUuid()+Utilities.getUuid());
 p.setProperty("SUPPORT_TO_EMAIL", "elunalab@gmail.com");
 console.log("Configuração pronta. Cota diária de envio: " + MailApp.getRemainingDailyQuota());
}
