-- Migração: sistema de pedidos, pagamentos e ativação manual (Aclive Store)
-- Cole isso inteiro no SQL Editor do Supabase (projeto aclive-store) e rode uma vez.

-- ---------- CLIENTES ----------
create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  whatsapp text not null,
  email text,
  created_at timestamptz not null default now()
);

alter table public.clientes enable row level security;

create policy "anon pode criar cliente" on public.clientes
  for insert to anon with check (true);

create policy "autenticado le clientes" on public.clientes
  for select to authenticated using (true);

create policy "autenticado atualiza clientes" on public.clientes
  for update to authenticated using (true) with check (true);

-- ---------- PEDIDOS ----------
create sequence if not exists public.pedido_seq start 1;

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique default ('ACL-' || lpad(nextval('public.pedido_seq')::text, 6, '0')),
  cliente_id uuid not null references public.clientes(id),
  plan_id text not null,
  plan_label text not null,
  valor numeric not null,
  recursos jsonb not null default '[]'::jsonb,
  telas int not null default 1,
  status text not null default 'AGUARDANDO_PAGAMENTO'
    check (status in (
      'AGUARDANDO_PAGAMENTO','PAGAMENTO_APROVADO','AGUARDANDO_ATIVACAO',
      'ATIVO','PROXIMO_VENCIMENTO','VENCIDO','CANCELADO','REEMBOLSADO'
    )),
  stripe_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  activated_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.pedidos enable row level security;

create policy "anon pode criar pedido" on public.pedidos
  for insert to anon with check (status = 'AGUARDANDO_PAGAMENTO');

create policy "autenticado le pedidos" on public.pedidos
  for select to authenticated using (true);

create policy "autenticado atualiza pedidos" on public.pedidos
  for update to authenticated using (true) with check (true);

-- ---------- ACESSOS (credenciais do app externo) ----------
create table if not exists public.acessos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null unique references public.pedidos(id),
  usuario text not null,
  senha text not null,
  criado_por text,
  credenciais_enviadas_em timestamptz,
  created_at timestamptz not null default now()
);

alter table public.acessos enable row level security;
-- Nenhuma policy pra "anon" aqui de propósito — só service role (servidor) e authenticated.
create policy "autenticado le acessos" on public.acessos
  for select to authenticated using (true);
create policy "autenticado escreve acessos" on public.acessos
  for insert to authenticated with check (true);
create policy "autenticado atualiza acessos" on public.acessos
  for update to authenticated using (true) with check (true);

-- ---------- LOGS / TIMELINE DO PEDIDO ----------
create table if not exists public.pedido_logs (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id),
  evento text not null,
  detalhe text,
  created_at timestamptz not null default now()
);

alter table public.pedido_logs enable row level security;
create policy "anon pode logar evento de pedido" on public.pedido_logs
  for insert to anon with check (true);
create policy "autenticado le logs" on public.pedido_logs
  for select to authenticated using (true);

-- Índices úteis pro dashboard
create index if not exists idx_pedidos_status on public.pedidos(status);
create index if not exists idx_pedidos_cliente on public.pedidos(cliente_id);
create index if not exists idx_pedido_logs_pedido on public.pedido_logs(pedido_id);
