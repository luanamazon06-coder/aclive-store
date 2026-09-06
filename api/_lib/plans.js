// Lê os planos do mesmo lugar que o site público usa (tabela site_content, chave aclive_plans).
async function getPlans(supabaseAdmin){
  var res = await supabaseAdmin.from('site_content').select('value').eq('key', 'aclive_plans').maybeSingle();
  if (res.error || !res.data) return [];
  return res.data.value || [];
}

async function getPlan(supabaseAdmin, planId){
  var plans = await getPlans(supabaseAdmin);
  var found = null;
  plans.forEach(function(p){ if (p.id === planId) found = p; });
  return found;
}

module.exports = { getPlans: getPlans, getPlan: getPlan };
