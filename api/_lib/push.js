// Notificação push pro celular do admin (sininho do painel), via Web Push padrão do navegador.
// Se VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não existirem ainda, não faz nada — não quebra o webhook.
var webpush = require('web-push');

function isConfigured(){
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function setupVapid(){
  webpush.setVapidDetails(
    'mailto:luanamazon06@gmail.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

async function notifyPushPaymentApproved(pedido, cliente, supabaseAdmin){
  if (!isConfigured()) return false;
  setupVapid();

  var res = await supabaseAdmin.from('push_subscriptions').select('*');
  var subs = res.data || [];
  if (subs.length === 0) return false;

  var valor = 'R$ ' + Number(pedido.valor || 0).toFixed(2).replace('.', ',');
  var payload = JSON.stringify({
    title: '💰 Pagamento aprovado — ' + pedido.order_code,
    body: ((cliente && cliente.nome) || 'Cliente') + ' · ' + pedido.plan_label + ' · ' + valor,
    url: '/admin.html'
  });

  var anySent = false;
  await Promise.all(subs.map(async function(sub){
    try{
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      anySent = true;
    } catch(err){
      if (err && (err.statusCode === 404 || err.statusCode === 410)){
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
      }
    }
  }));
  return anySent;
}

module.exports = { notifyPushPaymentApproved: notifyPushPaymentApproved, isConfigured: isConfigured };
