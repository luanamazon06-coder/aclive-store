var DEFAULT_MSG_PEDIDO = 'Olá, {NOME}! \uD83D\uDC4B\n\nRecebemos sua solicitação.\n\n\uD83D\uDCE6 Plano: {PLANO}\n\uD83D\uDCFA Recursos: {RECURSOS}\n\uD83D\uDDA5\uFE0F Telas: {TELAS}\n\uD83D\uDCB0 Valor: {VALOR}\n\nPara continuar, realize seu pagamento através do checkout seguro:\n{LINK_PAGAMENTO}\n\nApós a confirmação do pagamento, seu acesso será preparado.';

var DEFAULT_MSG_CREDENCIAIS = '\uD83C\uDF89 Pagamento confirmado!\n\nOlá, {NOME}!\n\nSeu acesso foi criado com sucesso.\n\n\uD83D\uDCE6 Plano: {PLANO}\n\n\uD83D\uDC64 Usuário:\n{USUARIO}\n\n\uD83D\uDD11 Senha:\n{SENHA}\n\n\uD83D\uDCC5 Ativação:\n{DATA_ATIVACAO}\n\n\uD83D\uDCC5 Vencimento:\n{DATA_VENCIMENTO}\n\nObrigado por escolher a Aclive Store! \u2764\uFE0F';

function fillTemplate(tpl, params){
  var out = tpl;
  Object.keys(params).forEach(function(key){
    var value = params[key] == null ? '' : String(params[key]);
    out = out.split('{' + key + '}').join(value);
  });
  return out;
}

async function getTemplate(supabaseAdmin, key, fallback){
  var res = await supabaseAdmin.from('site_content').select('value').eq('key', key).maybeSingle();
  if (res.error || !res.data || !res.data.value) return fallback;
  return res.data.value;
}

module.exports = {
  DEFAULT_MSG_PEDIDO: DEFAULT_MSG_PEDIDO,
  DEFAULT_MSG_CREDENCIAIS: DEFAULT_MSG_CREDENCIAIS,
  fillTemplate: fillTemplate,
  getTemplate: getTemplate
};
