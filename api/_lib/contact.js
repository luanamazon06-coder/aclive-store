// Lê o WhatsApp de contato do mesmo lugar que o site público usa (tabela site_content,
// chave aclive_contact) — o mesmo número editável em "Editar WhatsApp" no site.
async function getSupportWhatsapp(supabaseAdmin){
  var res = await supabaseAdmin.from('site_content').select('value').eq('key', 'aclive_contact').maybeSingle();
  var fallback = process.env.SUPPORT_WHATSAPP || '5516996263295';
  if (res.error || !res.data || !res.data.value || !res.data.value.whatsapp) return fallback;
  var digits = String(res.data.value.whatsapp).replace(/[^0-9]/g, '');
  return digits || fallback;
}

module.exports = { getSupportWhatsapp: getSupportWhatsapp };
