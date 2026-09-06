var { getAdminClient } = require('./_lib/supabaseAdmin');
var { requireAdmin } = require('./_lib/auth');
var { getPlan } = require('./_lib/plans');
var { sendWhatsApp } = require('./_lib/whatsapp');
var { getTemplate, fillTemplate, DEFAULT_MSG_CREDENCIAIS } = require('./_lib/messages');

module.exports = async function(req, res){
  if (req.method !== 'POST'){ res.status(405).json({ error: 'method not allowed' }); return; }

  var user = await requireAdmin(req);
  if (!user){ res.status(401).json({ error: 'Não autenticado. Faça login no painel.' }); return; }

  var body = req.body;
  if (!body || typeof body === 'string'){
    try{ body = JSON.parse(body || '{}'); } catch(e){ body = {}; }
  }
  var pedidoId = body.pedidoId;
  var usuario = (body.usuario || '').trim();
  var senha = (body.senha || '').trim();
  var dataAtivacao = body.dataAtivacao; // 'YYYY-MM-DD'

  if (!pedidoId || !usuario || !senha || !dataAtivacao){
    res.status(400).json({ error: 'Preencha usuário, senha e data de ativação.' });
    return;
  }

  var supabaseAdmin;
  try{ supabaseAdmin = getAdminClient(); }
  catch(e){ res.status(500).json({ error: e.message }); return; }

  try{
    var pedidoRes = await supabaseAdmin.from('pedidos').select('*').eq('id', pedidoId).maybeSingle();
    var pedido = pedidoRes.data;
    if (!pedido){ res.status(404).json({ error: 'Pedido não encontrado.' }); return; }
    if (pedido.status !== 'PAGAMENTO_APROVADO'){
      res.status(400).json({ error: 'Esse pedido não está aguardando ativação (status atual: ' + pedido.status + ').' });
      return;
    }

    var plan = await getPlan(supabaseAdmin, pedido.plan_id);
    var months = (plan && plan.months) || 1;

    var activatedAt = new Date(dataAtivacao + 'T12:00:00');
    var expiresAt = new Date(activatedAt.getTime());
    expiresAt.setMonth(expiresAt.getMonth() + months);

    await supabaseAdmin.from('acessos').upsert({
      pedido_id: pedidoId,
      usuario: usuario,
      senha: senha,
      criado_por: user.email || user.id
    }, { onConflict: 'pedido_id' });

    await supabaseAdmin.from('pedidos').update({
      status: 'ATIVO',
      activated_at: activatedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', pedidoId);

    await supabaseAdmin.from('pedido_logs').insert({
      pedido_id: pedidoId,
      evento: 'Usuário criado',
      detalhe: 'por ' + (user.email || user.id)
    });

    var clienteRes = await supabaseAdmin.from('clientes').select('*').eq('id', pedido.cliente_id).maybeSingle();
    var cliente = clienteRes.data;

    var tpl = await getTemplate(supabaseAdmin, 'aclive_msg_credenciais', DEFAULT_MSG_CREDENCIAIS);
    var msg = fillTemplate(tpl, {
      NOME: cliente ? cliente.nome : '',
      PLANO: pedido.plan_label,
      USUARIO: usuario,
      SENHA: senha,
      DATA_ATIVACAO: activatedAt.toLocaleDateString('pt-BR'),
      DATA_VENCIMENTO: expiresAt.toLocaleDateString('pt-BR')
    });

    var sent = await sendWhatsApp(cliente ? cliente.whatsapp : '', msg, pedidoId, supabaseAdmin);
    if (sent){
      await supabaseAdmin.from('acessos').update({ credenciais_enviadas_em: new Date().toISOString() }).eq('pedido_id', pedidoId);
      await supabaseAdmin.from('pedido_logs').insert({ pedido_id: pedidoId, evento: 'Credenciais enviadas pelo WhatsApp' });
    }

    res.status(200).json({ ok: true, expiresAt: expiresAt.toISOString(), whatsappSent: sent, message: msg });
  } catch(err){
    console.error('confirmar-ativacao error', err);
    res.status(500).json({ error: 'Não foi possível confirmar a ativação.' });
  }
};
