var Stripe = require('stripe');
var { getAdminClient } = require('./_lib/supabaseAdmin');
var { notifyAdminPaymentApproved } = require('./_lib/notify');
var { notifyPushPaymentApproved } = require('./_lib/push');

// Precisa do corpo cru (não parseado) pra validar a assinatura da Stripe.
module.exports.config = { api: { bodyParser: false } };

function buffer(readable){
  return new Promise(function(resolve, reject){
    var chunks = [];
    readable.on('data', function(chunk){ chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk); });
    readable.on('end', function(){ resolve(Buffer.concat(chunks)); });
    readable.on('error', reject);
  });
}

module.exports = async function(req, res){
  if (req.method !== 'POST'){ res.status(405).end(); return; }

  var stripe = Stripe(process.env.STRIPE_SECRET_KEY);
  var sig = req.headers['stripe-signature'];
  var event;

  try{
    var rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch(err){
    res.status(400).send('Webhook signature inválida: ' + err.message);
    return;
  }

  var supabaseAdmin;
  try{ supabaseAdmin = getAdminClient(); }
  catch(e){ res.status(500).send(e.message); return; }

  try{
    if (event.type === 'checkout.session.completed'){
      var session = event.data.object;
      var pedidoId = session.metadata && session.metadata.pedido_id;
      if (pedidoId){
        var pedidoRes = await supabaseAdmin.from('pedidos').select('*').eq('id', pedidoId).maybeSingle();
        var pedido = pedidoRes.data;
        // Idempotente: só avança se ainda estiver aguardando pagamento (reenvio do mesmo evento
        // pela Stripe não duplica nem reprocessa).
        if (pedido && pedido.status === 'AGUARDANDO_PAGAMENTO'){
          await supabaseAdmin.from('pedidos').update({
            status: 'PAGAMENTO_APROVADO',
            stripe_payment_intent_id: session.payment_intent,
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }).eq('id', pedidoId);
          await supabaseAdmin.from('pedido_logs').insert([
            { pedido_id: pedidoId, evento: 'Pagamento aprovado' },
            { pedido_id: pedidoId, evento: 'Aguardando criação do acesso' }
          ]);
          var clienteRes = await supabaseAdmin.from('clientes').select('*').eq('id', pedido.cliente_id).maybeSingle();
          var sent = await notifyAdminPaymentApproved(pedido, clienteRes.data);
          var pushSent = await notifyPushPaymentApproved(pedido, clienteRes.data, supabaseAdmin);
          await supabaseAdmin.from('pedido_logs').insert([
            { pedido_id: pedidoId, evento: sent ? 'E-mail de aviso enviado ao admin' : 'E-mail de aviso não enviado (RESEND_API_KEY ausente ou falhou)' },
            { pedido_id: pedidoId, evento: pushSent ? 'Notificação push enviada ao admin' : 'Notificação push não enviada (não configurada ou sem inscrições)' }
          ]);
        }
      }
    } else if (event.type === 'checkout.session.expired'){
      var expSession = event.data.object;
      var expPedidoId = expSession.metadata && expSession.metadata.pedido_id;
      if (expPedidoId){
        await supabaseAdmin.from('pedido_logs').insert({ pedido_id: expPedidoId, evento: 'Checkout expirado sem pagamento' });
      }
    } else if (event.type === 'charge.refunded'){
      var charge = event.data.object;
      var refPedidoRes = await supabaseAdmin.from('pedidos').select('*').eq('stripe_payment_intent_id', charge.payment_intent).maybeSingle();
      var refPedido = refPedidoRes.data;
      if (refPedido && refPedido.status !== 'REEMBOLSADO'){
        await supabaseAdmin.from('pedidos').update({ status: 'REEMBOLSADO', updated_at: new Date().toISOString() }).eq('id', refPedido.id);
        await supabaseAdmin.from('pedido_logs').insert({ pedido_id: refPedido.id, evento: 'Pagamento reembolsado' });
      }
    } else if (event.type === 'payment_intent.payment_failed'){
      var pi = event.data.object;
      var failPedidoRes = await supabaseAdmin.from('pedidos').select('*').eq('stripe_payment_intent_id', pi.id).maybeSingle();
      var failPedido = failPedidoRes.data;
      if (failPedido){
        await supabaseAdmin.from('pedido_logs').insert({ pedido_id: failPedido.id, evento: 'Pagamento recusado' });
      }
    }
  } catch(handlerErr){
    console.error('stripe-webhook handler error', handlerErr);
    res.status(500).send('erro ao processar evento');
    return;
  }

  res.status(200).json({ received: true });
};
