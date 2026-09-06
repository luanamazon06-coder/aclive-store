var { createClient } = require('@supabase/supabase-js');
var { SUPABASE_URL } = require('./supabaseAdmin');

var SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxodHF2emhtcGlycG5rdWphbGFoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzNTgyMTcsImV4cCI6MjEwMzkzNDIxN30.x8itvIk4oCd6dUUjPpkdB84PK2aMowcXg9KLkmpQPSM';

// Confere se a requisição trouxe um token de sessão válido do Supabase Auth (login do admin.html).
// Retorna o usuário autenticado, ou null se não autenticado/token inválido.
async function requireAdmin(req){
  var authHeader = req.headers['authorization'] || req.headers['Authorization'] || '';
  var token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  var supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  var result = await supabase.auth.getUser(token);
  if (result.error || !result.data || !result.data.user) return null;
  return result.data.user;
}

module.exports = { requireAdmin: requireAdmin };
