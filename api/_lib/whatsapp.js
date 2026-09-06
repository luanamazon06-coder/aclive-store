// Módulo único de envio de WhatsApp.
// Se WHATSAPP_PHONE_NUMBER_ID + WHATSAPP_ACCESS_TOKEN existirem (Meta Cloud API oficial), manda
// de verdade. Se não existirem ainda (conta em aprovação na Meta), só registra a mensagem pronta
// no log do pedido pra envio manual — nada quebra, o fluxo continua.
async function sendWhatsApp(to, message, pedidoId, supabaseAdmin){
  var phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  var token = process.env.WHATSAPP_ACCESS_TOKEN;
  var digits = String(to || '').replace(/\D/g, '');

  if (phoneId && token && digits){
    try{
      var resp = await fetch('https://graph.facebook.com/v20.0/' + phoneId + '/messages', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: digits,
          type: 'text',
          text: { body: message }
        })
      });
      var ok = resp.ok;
      if (pedidoId && supabaseAdmin){
        await supabaseAdmin.from('pedido_logs').insert({
          pedido_id: pedidoId,
          evento: ok ? 'WhatsApp enviado automaticamente' : 'Falha ao enviar WhatsApp (API respondeu erro)',
          detalhe: message
        });
      }
      return ok;
    } catch(e){
      if (pedidoId && supabaseAdmin){
        await supabaseAdmin.from('pedido_logs').insert({
          pedido_id: pedidoId,
          evento: 'Falha ao enviar WhatsApp (erro de conexão)',
          detalhe: String((e && e.message) || e)
        });
      }
      return false;
    }
  }

  if (pedidoId && supabaseAdmin){
    await supabaseAdmin.from('pedido_logs').insert({
      pedido_id: pedidoId,
      evento: 'WhatsApp pendente — API oficial ainda não configurada, copie e envie manualmente',
      detalhe: message
    });
  }
  return false;
}

module.exports = { sendWhatsApp: sendWhatsApp };
