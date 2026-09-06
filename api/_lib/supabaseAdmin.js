var { createClient } = require('@supabase/supabase-js');

var SUPABASE_URL = process.env.SUPABASE_URL || 'https://lhtqvzhmpirpnkujalah.supabase.co';

// Usa a service role key (nunca exposta ao navegador) — só existe nas funções serverless.
function getAdminClient(){
  var key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY não configurada nas variáveis de ambiente do Vercel');
  return createClient(SUPABASE_URL, key);
}

module.exports = { getAdminClient: getAdminClient, SUPABASE_URL: SUPABASE_URL };
