-- Operação (Claude/Antigravity, 23/09/2026) — ESTRUTURA: tabelas, colunas, RLS, índices e view.
-- Re-executável: pode rodar de novo com segurança (if not exists / drop policy if exists).
-- As funções (RPCs) da operação NÃO estão aqui: a versão anterior deste arquivo tinha funções provisórias que
-- devolviam "ok" sem fazer nada. Elas devem ser implementadas de verdade numa migração própria (ver backend-plan §3.1).

-- Enum
alter type public.metodo_pagamento add value if not exists 'FATURADO';

do $$ begin
  create type public.funcao_tripulante as enum ('COMANDANTE', 'IMEDIATO', 'MAQUINISTA', 'MARINHEIRO', 'TAIFEIRO', 'COMISSARIO');
exception when duplicate_object then null;
end $$;

-- Tabelas novas
create table if not exists public.comodos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas on delete cascade,
  embarcacao_id uuid not null references public.embarcacoes on delete cascade,
  nome text not null,
  descricao text not null,
  acrescimo numeric(10,2) not null check (acrescimo >= 0),
  cor text not null check (cor in ('rio','sol','rubro','emerald','slate')),
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.tripulantes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas on delete cascade,
  nome text not null,
  funcao public.funcao_tripulante not null,
  documento text not null,
  habilitacao text not null,
  validade_habilitacao date,
  telefone text not null,
  embarcacao_id uuid references public.embarcacoes on delete set null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.viagem_tripulantes (
  viagem_id uuid not null references public.viagens on delete cascade,
  tripulante_id uuid not null references public.tripulantes on delete cascade,
  primary key (viagem_id, tripulante_id)
);

create table if not exists public.convenios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas on delete cascade,
  nome text not null,
  cnpj text,
  desconto_percentual numeric(5,2) not null check (desconto_percentual >= 0 and desconto_percentual <= 100),
  faturado boolean not null default false,
  contato text,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Colunas
alter table public.empresas
  add column if not exists tipo_servico text,
  add column if not exists beneficios text[],
  add column if not exists whatsapps jsonb,
  add column if not exists multa_cancelamento_pct numeric(5,2) not null default 10,
  add column if not exists horas_cancelamento_sem_multa int not null default 24,
  add column if not exists taxa_sistema_pct numeric(5,2) not null default 3;

alter table public.assentos
  add column if not exists comodo_id uuid references public.comodos on delete set null;

alter table public.embarcacoes
  add column if not exists ano int,
  add column if not exists comprimento_m numeric(5,1),
  add column if not exists observacao text,
  add column if not exists assento_livre boolean not null default false;

alter table public.viagens
  add column if not exists motivo_cancelamento text,
  add column if not exists avulsa boolean not null default false;

alter table public.passagens
  add column if not exists convenio_id uuid references public.convenios on delete set null,
  add column if not exists acrescimo numeric(10,2) not null default 0 check (acrescimo >= 0),
  add column if not exists impressoes int not null default 0;

alter table public.pedidos
  add column if not exists numero text;

alter table public.caixa_sessoes
  add column if not exists valor_contado numeric(10,2),
  add column if not exists observacao text;

create table if not exists public.caixa_movimentos (
  id uuid primary key default gen_random_uuid(),
  caixa_id uuid not null references public.caixa_sessoes on delete cascade,
  tipo text not null check (tipo in ('SANGRIA', 'SUPRIMENTO')),
  valor numeric(10,2) not null check (valor > 0),
  observacao text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cancelamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas on delete cascade,
  pedido_id uuid not null references public.pedidos on delete cascade,
  passagem_ids uuid[] not null,
  motivo text not null,
  valor_pago numeric(10,2) not null check (valor_pago >= 0),
  multa numeric(10,2) not null check (multa >= 0),
  reembolso numeric(10,2) not null check (reembolso >= 0),
  usuario_id uuid references public.perfis on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.configuracoes_bilhete (
  empresa_id uuid primary key references public.empresas on delete cascade,
  largura_mm int not null check (largura_mm in (58, 80)),
  titulo text not null,
  mostrar_logo boolean not null default true,
  mostrar_valores boolean not null default true,
  mostrar_qr boolean not null default true,
  mostrar_beneficios boolean not null default true,
  local_embarque text not null,
  antecedencia_embarque_min int not null default 30,
  mensagens text[] not null default '{}'
);

create table if not exists public.festivais (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas on delete cascade,
  slug text not null unique,
  nome text not null,
  chamada text not null,
  descricao text not null,
  cidade_id uuid not null references public.cidades on delete restrict,
  inicio date not null,
  fim date not null,
  acrescimo_percentual numeric(5,2) not null default 0 check (acrescimo_percentual >= 0),
  cor text not null check (cor in ('rubro','rio','sol','emerald')),
  publicado boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.festival_viagens (
  festival_id uuid not null references public.festivais on delete cascade,
  viagem_id uuid not null unique references public.viagens on delete cascade,
  primary key (festival_id, viagem_id)
);

-- Drop assento_colo constraint
alter table public.passagens drop constraint if exists passagens_assento_colo;

-- RLS
alter table public.comodos enable row level security;
alter table public.tripulantes enable row level security;
alter table public.viagem_tripulantes enable row level security;
alter table public.convenios enable row level security;
alter table public.caixa_movimentos enable row level security;
alter table public.cancelamentos enable row level security;
alter table public.configuracoes_bilhete enable row level security;
alter table public.festivais enable row level security;
alter table public.festival_viagens enable row level security;

-- (Policies)
-- comodos
drop policy if exists "comodos_select" on public.comodos;
create policy "comodos_select" on public.comodos for select to authenticated using (empresa_id = (select private.empresa_atual()));
drop policy if exists "comodos_insert" on public.comodos;
create policy "comodos_insert" on public.comodos for insert to authenticated with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "comodos_update" on public.comodos;
create policy "comodos_update" on public.comodos for update to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN')) with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "comodos_delete" on public.comodos;
create policy "comodos_delete" on public.comodos for delete to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));

-- tripulantes
drop policy if exists "tripulantes_select" on public.tripulantes;
create policy "tripulantes_select" on public.tripulantes for select to authenticated using (empresa_id = (select private.empresa_atual()));
drop policy if exists "tripulantes_insert" on public.tripulantes;
create policy "tripulantes_insert" on public.tripulantes for insert to authenticated with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "tripulantes_update" on public.tripulantes;
create policy "tripulantes_update" on public.tripulantes for update to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN')) with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "tripulantes_delete" on public.tripulantes;
create policy "tripulantes_delete" on public.tripulantes for delete to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));

-- viagem_tripulantes
drop policy if exists "vt_select" on public.viagem_tripulantes;
create policy "vt_select" on public.viagem_tripulantes for select to authenticated using (
  exists (select 1 from public.viagens v where v.id = viagem_id and v.empresa_id = (select private.empresa_atual()))
);
drop policy if exists "vt_insert" on public.viagem_tripulantes;
create policy "vt_insert" on public.viagem_tripulantes for insert to authenticated with check (
  exists (select 1 from public.viagens v where v.id = viagem_id and v.empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'))
);
drop policy if exists "vt_delete" on public.viagem_tripulantes;
create policy "vt_delete" on public.viagem_tripulantes for delete to authenticated using (
  exists (select 1 from public.viagens v where v.id = viagem_id and v.empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'))
);

-- convenios
drop policy if exists "convenios_select" on public.convenios;
create policy "convenios_select" on public.convenios for select to authenticated using (empresa_id = (select private.empresa_atual()));
drop policy if exists "convenios_insert" on public.convenios;
create policy "convenios_insert" on public.convenios for insert to authenticated with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "convenios_update" on public.convenios;
create policy "convenios_update" on public.convenios for update to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN')) with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "convenios_delete" on public.convenios;
create policy "convenios_delete" on public.convenios for delete to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));

-- caixa_movimentos
drop policy if exists "cm_select" on public.caixa_movimentos;
create policy "cm_select" on public.caixa_movimentos for select to authenticated using (
  -- caixa_sessoes não tem empresa_id: a empresa vem do perfil do operador dono do caixa
  exists (
    select 1 from public.caixa_sessoes c
    join public.perfis pf on pf.id = c.usuario_id
    where c.id = caixa_id
      and pf.empresa_id = (select private.empresa_atual())
      and (c.usuario_id = (select auth.uid()) or private.tem_papel('GERENTE', 'ADMIN'))
  )
);

-- cancelamentos
drop policy if exists "cancelamentos_select" on public.cancelamentos;
create policy "cancelamentos_select" on public.cancelamentos for select to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN', 'VENDEDOR'));

-- configuracoes_bilhete
drop policy if exists "cb_select" on public.configuracoes_bilhete;
create policy "cb_select" on public.configuracoes_bilhete for select to authenticated using (empresa_id = (select private.empresa_atual()));
drop policy if exists "cb_update" on public.configuracoes_bilhete;
create policy "cb_update" on public.configuracoes_bilhete for update to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN')) with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));

-- festivais
drop policy if exists "fest_anon" on public.festivais;
create policy "fest_anon" on public.festivais for select to anon using (publicado = true and fim >= current_date);
drop policy if exists "fest_auth" on public.festivais;
create policy "fest_auth" on public.festivais for select to authenticated using (empresa_id = (select private.empresa_atual()));
drop policy if exists "fest_insert" on public.festivais;
create policy "fest_insert" on public.festivais for insert to authenticated with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "fest_update" on public.festivais;
create policy "fest_update" on public.festivais for update to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN')) with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));
drop policy if exists "fest_delete" on public.festivais;
create policy "fest_delete" on public.festivais for delete to authenticated using (empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'));

-- festival_viagens
drop policy if exists "fv_anon" on public.festival_viagens;
create policy "fv_anon" on public.festival_viagens for select to anon using (
  exists (select 1 from public.festivais f where f.id = festival_id and f.publicado = true and f.fim >= current_date)
);
drop policy if exists "fv_auth" on public.festival_viagens;
create policy "fv_auth" on public.festival_viagens for select to authenticated using (
  exists (select 1 from public.festivais f where f.id = festival_id and f.empresa_id = (select private.empresa_atual()))
);
drop policy if exists "fv_insert" on public.festival_viagens;
create policy "fv_insert" on public.festival_viagens for insert to authenticated with check (
  exists (select 1 from public.festivais f where f.id = festival_id and f.empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'))
);
drop policy if exists "fv_delete" on public.festival_viagens;
create policy "fv_delete" on public.festival_viagens for delete to authenticated using (
  exists (select 1 from public.festivais f where f.id = festival_id and f.empresa_id = (select private.empresa_atual()) and private.tem_papel('GERENTE', 'ADMIN'))
);

-- Fix empresa_publica view
drop policy if exists "empresas_select_anon" on public.empresas;
drop view if exists public.empresa_publica;
create view public.empresa_publica as
select id, nome_fantasia, razao_social, cnpj, email, telefone, whatsapp, logo_url, minutos_reserva_site,
       tipo_servico, beneficios, whatsapps
from public.empresas;
grant select on public.empresa_publica to anon, authenticated;

-- Composite indexes
create index if not exists idx_passagens_viagem_status on public.passagens(viagem_id, status);
create index if not exists idx_pedidos_empresa_status on public.pedidos(empresa_id, status);
create index if not exists idx_viagens_empresa_status on public.viagens(empresa_id, status);
