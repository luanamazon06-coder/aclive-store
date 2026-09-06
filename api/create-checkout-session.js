var Stripe = require('stripe');
var { getAdminClient } = require('./_lib/supabaseAdmin');
var { getPlan } = require('./_lib/plans');
var { sendWhatsApp } = require('./_lib/whatsapp');
var { getTemplate, fillTemplate, DEFAULT_MSG_PEDIDO } = require('./_lib/messages');

module.exports = async function(req, res){
  if (req.method !== 'POST'){ res.status(405).json({ error: 'method not allowed' }); return; }

  var body = req.body;
  if (!body || typeof body === 'string'){
    try{ body = JSON.parse(body || '{}'); } catch(e){ body = {}; }
  }
  var nome = (body.nome || '').trim();
  var whatsapp = (body.whatsapp || '').trim();
  var email = (body.email || '').trim();
  var planId = body.planId;
  var recursos = Array.isArray(body.recursos) ? body.recursos : [];
  var telas = body.telas;

  if (!nome || !whatsapp || !planId){
    res.status(400).json({ error: 'Preencha nome, WhatsApp e escolha um plano.' });
    return;
  }

  var supabaseAdmin;
  try{ supabaseAdmin = getAdminClient(); }
  catch(e){ res.status(500).json({ error: e.message }); return; }

  try{
    var plan = await getPlan(supabaseAdmin, planId);
    if (!plan){ res.status(400).json({ error: 'Plano inválido.' }); return; }

    var permitidos = plan.recursos_disponiveis || [];
    var recursosValidos = permitidos.length
      ? recursos.filter(function(r){ return permitidos.indexOf(r) !== -1; })
      : recursos;
    var telasFinal = telas ? Number(telas) : (plan.telas_padrao || 1);

    var clienteRes = await supabaseAdmin.from('clientes')
      .insert({ nome: nome, whatsapp: whatsapp, email: email || null })
      .select().single();
    if (clienteRes.error) throw clienteRes.error;
    var cliente = clienteRes.data;

    var pedidoRes = await supabaseAdmin.from('pedidos')
      .insert({
        cliente_id: cliente.id,
        plan_id: plan.id,
        plan_label: plan.label,
        valor: plan.price,
        recursos: recursosValidos,
        telas: telasFinal,
        status: 'AGUARDANDO_PAGAMENTO'
      })
      .select().single();
    if (pedidoRes.error) throw pedidoRes.error;
    var pedido = pedidoRes.data;

    await supabaseAdmin.from('pedido_logs').insert({ pedido_id: pedido.id, evento: 'Cadastro realizado' });

    // Enquanto a Stripe não estiver configurada (variável STRIPE_SECRET_KEY ausente), o pedido
    // é criado normalmente e o combinado de pagamento segue pelo WhatsApp na conversa — assim
    // que a chave existir, esse mesmo fluxo passa a gerar o checkout de verdade sozinho.
    var checkoutUrl = null;
    if (process.env.STRIPE_SECRET_KEY){
      var stripe = Stripe(process.env.STRIPE_SECRET_KEY);
      var origin = (req.headers.origin) || ('https://' + req.headers.host);
      var session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'brl',
            product_data: { name: plan.label + ' — Aclive Store' },
            unit_amount: Math.round(Number(plan.price) * 100)
          },
          quantity: 1
        }],
        client_reference_id: pedido.id,
        metadata: { pedido_id: pedido.id, order_code: pedido.order_code },
        customer_email: email || undefined,
        success_url: origin + '/?pedido=' + pedido.order_code + '&status=sucesso',
        cancel_url: origin + '/?pedido=' + pedido.order_code + '&status=cancelado'
      });
      checkoutUrl = session.url;
      await supabaseAdmin.from('pedidos').update({ stripe_session_id: session.id }).eq('id', pedido.id);
      await supabaseAdmin.from('pedido_logs').insert({ pedido_id: pedido.id, evento: 'Checkout gerado' });
    } else {
      await supabaseAdmin.from('pedido_logs').insert({
        pedido_id: pedido.id,
        evento: 'Pagamento a combinar pelo WhatsApp (Stripe ainda não configurada)'
      });
    }

    var tpl = await getTemplate(supabaseAdmin, 'aclive_msg_pedido', DEFAULT_MSG_PEDIDO);
    var msg = fillTemplate(tpl, {
      NOME: nome,
      PLANO: plan.label,
      RECURSOS: recursosValidos.join(' + ') || '-',
      TELAS: telasFinal,
      VALOR: 'R$ ' + Number(plan.price).toFixed(2).replace('.', ','),
      LINK_PAGAMENTO: checkoutUrl || 'Nosso time vai confirmar com você a forma de pagamento aqui mesmo pelo WhatsApp.'
    });

    await sendWhatsApp(whatsapp, msg, pedido.id, supabaseAdmin);

    res.status(200).json({
      orderCode: pedido.order_code,
      checkoutUrl: checkoutUrl,
      whatsappNumber: (process.env.SUPPORT_WHATSAPP || '5516996263295'),
      message: msg
    });
  } catch(err){
    console.error('create-checkout-session error', err);
    res.status(500).json({ error: 'Não foi possível gerar o pagamento. Tente novamente em instantes.' });
  }
};
