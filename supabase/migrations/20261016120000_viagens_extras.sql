-- Viagens extras e fretamentos: registro para acompanhamento (receita, passageiros, ida e volta).
--
-- Não passam por linhas, paradas nem tarifas: o destino é texto livre e os valores são informados pela empresa.
-- Por isso NÃO vendem passagem no sistema e ficam separadas da programação regular (public.viagens).
-- Tudo aditivo: nenhuma tabela existente é alterada.

create type public.tipo_viagem_extra as enum ('EXTRA', 'FRETAMENTO');

create table public.viagens_extras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  tipo public.tipo_viagem_extra not null,
  origem text not null check (length(trim(origem)) >= 2),
  destino text not null check (length(trim(destino)) >= 2),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete restrict,
  saida_ida timestamptz not null,
  saida_volta timestamptz,
  status public.status_viagem not null default 'PROGRAMADA',
  cliente_nome text,                    -- fretamento: quem contratou
  cliente_contato text,
  valor_total numeric(12,2) not null default 0 check (valor_total >= 0),     -- valor do frete ou receita da viagem
  valor_recebido numeric(12,2) not null default 0 check (valor_recebido >= 0),
  passageiros integer check (passageiros is null or passageiros >= 0),
  observacao text,
  motivo_cancelamento text,
  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viagens_extras_volta_depois_da_ida check (saida_volta is null or saida_volta > saida_ida),
  constraint viagens_extras_fretamento_com_cliente check (tipo <> 'FRETAMENTO' or length(trim(coalesce(cliente_nome, ''))) >= 2)
);

create index idx_viagens_extras_empresa_saida on public.viagens_extras (empresa_id, saida_ida desc);
create index idx_viagens_extras_embarcacao on public.viagens_extras (embarcacao_id);
create index idx_viagens_extras_criado_por on public.viagens_extras (criado_por);

create trigger set_updated_at before update on public.viagens_extras
  for each row execute function private.set_updated_at();

-- RLS: administrador e gerente da própria empresa; ninguém mais (nem visitante)
alter table public.viagens_extras enable row level security;
revoke all on public.viagens_extras from anon, authenticated;
grant select, insert, update, delete on public.viagens_extras to authenticated;

create policy viagens_extras_select on public.viagens_extras for select to authenticated
  using (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN', 'GERENTE'));
create policy viagens_extras_insert on public.viagens_extras for insert to authenticated
  with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN', 'GERENTE'));
create policy viagens_extras_update on public.viagens_extras for update to authenticated
  using (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN', 'GERENTE'))
  with check (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN', 'GERENTE'));
create policy viagens_extras_delete on public.viagens_extras for delete to authenticated
  using (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN'));
