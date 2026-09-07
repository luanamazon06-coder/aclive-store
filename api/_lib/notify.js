// Aviso por e-mail pro admin quando um pagamento é aprovado (via Resend).
// Se RESEND_API_KEY não existir ainda, não faz nada — não quebra o webhook.
var ADMIN_EMAIL = 'luanamazon06@gmail.com';

async function notifyAdminPaymentApproved(pedido, cliente){
  var apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  var valor = 'R$ ' + Number(pedido.valor || 0).toFixed(2).replace('.', ',');
  var html =
    '<h2>💰 Pagamento aprovado</h2>' +
    '<p><strong>Pedido:</strong> ' + pedido.order_code + '</p>' +
    '<p><strong>Cliente:</strong> ' + ((cliente && cliente.nome) || '—') + '</p>' +
    '<p><strong>WhatsApp:</strong> ' + ((cliente && cliente.whatsapp) || '—') + '</p>' +
    '<p><strong>E-mail:</strong> ' + ((cliente && cliente.email) || '—') + '</p>' +
    '<p><strong>Plano:</strong> ' + pedido.plan_label + '</p>' +
    '<p><strong>Valor:</strong> ' + valor + '</p>' +
    '<p><a href="https://aclive-store-3358.vercel.app/admin.html">Abrir painel pra criar o acesso</a></p>';

  try{
    var resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Aclive Store <onboarding@resend.dev>',
        to: [ADMIN_EMAIL],
        subject: '💰 Pagamento aprovado — ' + pedido.order_code,
        html: html
      })
    });
    return resp.ok;
  } catch(e){
    return false;
  }
}

module.exports = { notifyAdminPaymentApproved: notifyAdminPaymentApproved };
