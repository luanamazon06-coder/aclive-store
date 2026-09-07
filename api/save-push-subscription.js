var { getAdminClient } = require('./_lib/supabaseAdmin');
var { requireAdmin } = require('./_lib/auth');

module.exports = async function(req, res){
  if (req.method !== 'POST'){ res.status(405).json({ error: 'method not allowed' }); return; }

  var user = await requireAdmin(req);
  if (!user){ res.status(401).json({ error: 'Não autenticado. Faça login no painel.' }); return; }

  var body = req.body;
  if (!body || typeof body === 'string'){
    try{ body = JSON.parse(body || '{}'); } catch(e){ body = {}; }
  }
  var sub = body.subscription;
  if (!sub || !sub.endpoint || !sub.keys){
    res.status(400).json({ error: 'Inscrição de notificação inválida.' });
    return;
  }

  var supabaseAdmin;
  try{ supabaseAdmin = getAdminClient(); }
  catch(e){ res.status(500).json({ error: e.message }); return; }

  try{
    await supabaseAdmin.from('push_subscriptions').upsert({
      endpoint: sub.endpoint,
      keys: sub.keys
    }, { onConflict: 'endpoint' });
    res.status(200).json({ ok: true });
  } catch(err){
    console.error('save-push-subscription error', err);
    res.status(500).json({ error: 'Não foi possível salvar a inscrição.' });
  }
};
