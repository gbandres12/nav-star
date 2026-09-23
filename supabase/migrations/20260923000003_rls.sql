-- ==============================================================================
-- Migração 3: Políticas de Segurança em Nível de Linha (RLS) e Controle de Acesso
-- NavStar - Banco de Dados PostgreSQL / Supabase
-- Conforme especificação B3 do backend-plan.md
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Ativação de Row Level Security (RLS) em TODAS as 21 tabelas de public
-- ------------------------------------------------------------------------------

alter table public.empresas enable row level security;
alter table public.cidades enable row level security;
alter table public.portos enable row level security;
alter table public.agencias enable row level security;
alter table public.perfis enable row level security;
alter table public.embarcacoes enable row level security;
alter table public.assentos enable row level security;
alter table public.linhas enable row level security;
alter table public.perfis_linhas enable row level security;
alter table public.paradas_linha enable row level security;
alter table public.tarifas_trecho enable row level security;
alter table public.horarios_linha enable row level security;
alter table public.viagens enable row level security;
alter table public.clientes enable row level security;
alter table public.caixa_sessoes enable row level security;
alter table public.pedidos enable row level security;
alter table public.descontos_tipo_passageiro enable row level security;
alter table public.passagens enable row level security;
alter table public.pagamentos enable row level security;
alter table public.encomendas enable row level security;
alter table public.encomenda_eventos enable row level security;

-- ------------------------------------------------------------------------------
-- 2. Funções auxiliares (Helpers) no schema private
--    Projetadas com stable, security definer, set search_path = ''
-- ------------------------------------------------------------------------------

create schema if not exists private;

-- Recupera o ID da empresa do perfil ativo do usuário logado
create or replace function private.empresa_atual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select empresa_id
  from public.perfis
  where id = (select auth.uid())
    and ativo = true
  limit 1;
$$;

-- Recupera o papel (role) do perfil ativo do usuário logado
create or replace function private.papel_atual()
returns public.papel_usuario
language sql
stable
security definer
set search_path = ''
as $$
  select papel
  from public.perfis
  where id = (select auth.uid())
    and ativo = true
  limit 1;
$$;

-- Recupera o ID da agência do perfil ativo do usuário logado (se houver)
create or replace function private.agencia_atual()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select agencia_id
  from public.perfis
  where id = (select auth.uid())
    and ativo = true
  limit 1;
$$;

-- Verifica se o papel do usuário atual coincide com algum dos papéis fornecidos
create or replace function private.tem_papel(variadic papeis public.papel_usuario[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select private.papel_atual()) = any(papeis), false);
$$;

-- ------------------------------------------------------------------------------
-- 3. Permissões de infraestrutura e Hardening de funções públicas
-- ------------------------------------------------------------------------------

-- Concede uso do schema private e execução estrita das 4 funções auxiliares
grant usage on schema private to anon, authenticated;
grant execute on function private.empresa_atual() to anon, authenticated;
grant execute on function private.papel_atual() to anon, authenticated;
grant execute on function private.agencia_atual() to anon, authenticated;
grant execute on function private.tem_papel(variadic public.papel_usuario[]) to anon, authenticated;

-- Revoga permissões globais de funções públicas (item B3.5 do backend-plan)
-- As permissões específicas serão concedidas função por função na etapa B4
revoke all on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. View pública: empresa_publica
--    Expõe unicamente dados institucionais e operacionais públicos
-- ------------------------------------------------------------------------------

create policy "empresas_select_anon"
  on public.empresas
  for select
  to anon
  using (true);

create or replace view public.empresa_publica
with (security_invoker = true)
as
select
  id,
  nome_fantasia,
  razao_social,
  cnpj,
  email,
  telefone,
  whatsapp,
  logo_url,
  minutos_reserva_site
from public.empresas;

grant select on public.empresa_publica to anon, authenticated;

-- ==============================================================================
-- 5. Matriz de Políticas de Acesso (RLS)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 5.1 Cidades (cidades)
-- anon: S | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "cidades_select_anon"
  on public.cidades
  for select
  to anon
  using (true);

create policy "cidades_select_authenticated"
  on public.cidades
  for select
  to authenticated
  using (true);

create policy "cidades_insert_admin"
  on public.cidades
  for insert
  to authenticated
  with check ((select private.tem_papel('ADMIN'::public.papel_usuario)));

create policy "cidades_update_admin"
  on public.cidades
  for update
  to authenticated
  using ((select private.tem_papel('ADMIN'::public.papel_usuario)))
  with check ((select private.tem_papel('ADMIN'::public.papel_usuario)));

create policy "cidades_delete_admin"
  on public.cidades
  for delete
  to authenticated
  using ((select private.tem_papel('ADMIN'::public.papel_usuario)));

-- ------------------------------------------------------------------------------
-- 5.2 Portos (portos)
-- anon: S | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "portos_select_anon"
  on public.portos
  for select
  to anon
  using (true);

create policy "portos_select_authenticated"
  on public.portos
  for select
  to authenticated
  using (true);

create policy "portos_insert_admin"
  on public.portos
  for insert
  to authenticated
  with check ((select private.tem_papel('ADMIN'::public.papel_usuario)));

create policy "portos_update_admin"
  on public.portos
  for update
  to authenticated
  using ((select private.tem_papel('ADMIN'::public.papel_usuario)))
  with check ((select private.tem_papel('ADMIN'::public.papel_usuario)));

create policy "portos_delete_admin"
  on public.portos
  for delete
  to authenticated
  using ((select private.tem_papel('ADMIN'::public.papel_usuario)));

-- ------------------------------------------------------------------------------
-- 5.3 Linhas (linhas)
-- anon: S (só linhas ativas) | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "linhas_select_anon"
  on public.linhas
  for select
  to anon
  using (ativa = true);

create policy "linhas_select_authenticated"
  on public.linhas
  for select
  to authenticated
  using (empresa_id = (select private.empresa_atual()));

create policy "linhas_insert_admin"
  on public.linhas
  for insert
  to authenticated
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

create policy "linhas_update_admin"
  on public.linhas
  for update
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  )
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

create policy "linhas_delete_admin"
  on public.linhas
  for delete
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

-- ------------------------------------------------------------------------------
-- 5.4 Paradas da Linha (paradas_linha)
-- anon: S (só linhas ativas) | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "paradas_linha_select_anon"
  on public.paradas_linha
  for select
  to anon
  using (
    exists (
      select 1 from public.linhas l
      where l.id = paradas_linha.linha_id
        and l.ativa = true
    )
  );

create policy "paradas_linha_select_authenticated"
  on public.paradas_linha
  for select
  to authenticated
  using (
    exists (
      select 1 from public.linhas l
      where l.id = paradas_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "paradas_linha_insert_admin"
  on public.paradas_linha
  for insert
  to authenticated
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = paradas_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "paradas_linha_update_admin"
  on public.paradas_linha
  for update
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = paradas_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  )
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = paradas_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "paradas_linha_delete_admin"
  on public.paradas_linha
  for delete
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = paradas_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

-- ------------------------------------------------------------------------------
-- 5.5 Tarifas por Trecho (tarifas_trecho)
-- anon: S (só linhas ativas) | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "tarifas_trecho_select_anon"
  on public.tarifas_trecho
  for select
  to anon
  using (
    exists (
      select 1 from public.linhas l
      where l.id = tarifas_trecho.linha_id
        and l.ativa = true
    )
  );

create policy "tarifas_trecho_select_authenticated"
  on public.tarifas_trecho
  for select
  to authenticated
  using (
    exists (
      select 1 from public.linhas l
      where l.id = tarifas_trecho.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "tarifas_trecho_insert_admin"
  on public.tarifas_trecho
  for insert
  to authenticated
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = tarifas_trecho.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "tarifas_trecho_update_admin"
  on public.tarifas_trecho
  for update
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = tarifas_trecho.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  )
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = tarifas_trecho.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "tarifas_trecho_delete_admin"
  on public.tarifas_trecho
  for delete
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = tarifas_trecho.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

-- ------------------------------------------------------------------------------
-- 5.6 Horários da Linha (horarios_linha)
-- anon: S (só linhas e horários ativos) | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "horarios_linha_select_anon"
  on public.horarios_linha
  for select
  to anon
  using (
    ativo = true
    and exists (
      select 1 from public.linhas l
      where l.id = horarios_linha.linha_id
        and l.ativa = true
    )
  );

create policy "horarios_linha_select_authenticated"
  on public.horarios_linha
  for select
  to authenticated
  using (
    exists (
      select 1 from public.linhas l
      where l.id = horarios_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "horarios_linha_insert_admin"
  on public.horarios_linha
  for insert
  to authenticated
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = horarios_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "horarios_linha_update_admin"
  on public.horarios_linha
  for update
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = horarios_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  )
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = horarios_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "horarios_linha_delete_admin"
  on public.horarios_linha
  for delete
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.linhas l
      where l.id = horarios_linha.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

-- ------------------------------------------------------------------------------
-- 5.7 Embarcações (embarcacoes)
-- anon: S | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "embarcacoes_select_anon"
  on public.embarcacoes
  for select
  to anon
  using (true);

create policy "embarcacoes_select_authenticated"
  on public.embarcacoes
  for select
  to authenticated
  using (empresa_id = (select private.empresa_atual()));

create policy "embarcacoes_insert_admin"
  on public.embarcacoes
  for insert
  to authenticated
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

create policy "embarcacoes_update_admin"
  on public.embarcacoes
  for update
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  )
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

create policy "embarcacoes_delete_admin"
  on public.embarcacoes
  for delete
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

-- ------------------------------------------------------------------------------
-- 5.8 Assentos (assentos)
-- anon: S | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "assentos_select_anon"
  on public.assentos
  for select
  to anon
  using (true);

create policy "assentos_select_authenticated"
  on public.assentos
  for select
  to authenticated
  using (
    exists (
      select 1 from public.embarcacoes e
      where e.id = assentos.embarcacao_id
        and e.empresa_id = (select private.empresa_atual())
    )
  );

create policy "assentos_insert_admin"
  on public.assentos
  for insert
  to authenticated
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.embarcacoes e
      where e.id = assentos.embarcacao_id
        and e.empresa_id = (select private.empresa_atual())
    )
  );

create policy "assentos_update_admin"
  on public.assentos
  for update
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.embarcacoes e
      where e.id = assentos.embarcacao_id
        and e.empresa_id = (select private.empresa_atual())
    )
  )
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.embarcacoes e
      where e.id = assentos.embarcacao_id
        and e.empresa_id = (select private.empresa_atual())
    )
  );

create policy "assentos_delete_admin"
  on public.assentos
  for delete
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.embarcacoes e
      where e.id = assentos.embarcacao_id
        and e.empresa_id = (select private.empresa_atual())
    )
  );

-- ------------------------------------------------------------------------------
-- 5.9 Viagens (viagens)
-- anon: S (não canceladas) | VENDEDOR: S | CONFERENTE: S | GERENTE: S, U | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "viagens_select_anon"
  on public.viagens
  for select
  to anon
  using (status <> 'CANCELADA');

create policy "viagens_select_authenticated"
  on public.viagens
  for select
  to authenticated
  using (empresa_id = (select private.empresa_atual()));

create policy "viagens_update_gerente_admin"
  on public.viagens
  for update
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  )
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  );

create policy "viagens_insert_admin"
  on public.viagens
  for insert
  to authenticated
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

create policy "viagens_delete_admin"
  on public.viagens
  for delete
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

-- ------------------------------------------------------------------------------
-- 5.10 Pedidos (pedidos)
-- anon: — | VENDEDOR: S (os que vendeu ou da sua agência) | CONFERENTE: — | GERENTE: S | ADMIN: S
-- Inserções e atualizações são estritamente intermediadas por RPC transacional
-- ------------------------------------------------------------------------------

create policy "pedidos_select_gerente_admin"
  on public.pedidos
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  );

create policy "pedidos_select_vendedor"
  on public.pedidos
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('VENDEDOR'::public.papel_usuario))
    and (
      vendedor_id = (select auth.uid())
      or (
        agencia_id is not null
        and agencia_id = (select private.agencia_atual())
      )
    )
  );

-- ------------------------------------------------------------------------------
-- 5.11 Pagamentos (pagamentos)
-- anon: — | VENDEDOR: S (os que vendeu ou da sua agência) | CONFERENTE: — | GERENTE: S | ADMIN: S
-- Inserções e alterações de status são estritamente intermediadas por RPC
-- ------------------------------------------------------------------------------

create policy "pagamentos_select_gerente_admin"
  on public.pagamentos
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  );

create policy "pagamentos_select_vendedor"
  on public.pagamentos
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('VENDEDOR'::public.papel_usuario))
    and exists (
      select 1 from public.pedidos p
      where p.id = pagamentos.pedido_id
        and (
          p.vendedor_id = (select auth.uid())
          or (
            p.agencia_id is not null
            and p.agencia_id = (select private.agencia_atual())
          )
        )
    )
  );

-- ------------------------------------------------------------------------------
-- 5.12 Passagens (passagens)
-- anon: — | VENDEDOR: S (dos seus pedidos) | CONFERENTE: S (manifesto) | GERENTE: S | ADMIN: S
-- Inserções e embarque são estritamente intermediados por RPC
-- ------------------------------------------------------------------------------

create policy "passagens_select_gerente_admin"
  on public.passagens
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  );

create policy "passagens_select_conferente"
  on public.passagens
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('CONFERENTE'::public.papel_usuario))
  );

create policy "passagens_select_vendedor"
  on public.passagens
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('VENDEDOR'::public.papel_usuario))
    and exists (
      select 1 from public.pedidos p
      where p.id = passagens.pedido_id
        and (
          p.vendedor_id = (select auth.uid())
          or (
            p.agencia_id is not null
            and p.agencia_id = (select private.agencia_atual())
          )
        )
    )
  );

-- ------------------------------------------------------------------------------
-- 5.13 Clientes (clientes)
-- anon: — | VENDEDOR: S | CONFERENTE: — | GERENTE: S | ADMIN: S
-- ------------------------------------------------------------------------------

create policy "clientes_select_authenticated"
  on public.clientes
  for select
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'VENDEDOR'::public.papel_usuario))
  );

-- ------------------------------------------------------------------------------
-- 5.14 Encomendas (encomendas)
-- anon: — (rastreio via RPC pública) | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S
-- Criação e avanço de status são intermediados por RPC
-- ------------------------------------------------------------------------------

create policy "encomendas_select_authenticated"
  on public.encomendas
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel(
      'ADMIN'::public.papel_usuario,
      'GERENTE'::public.papel_usuario,
      'VENDEDOR'::public.papel_usuario,
      'CONFERENTE'::public.papel_usuario
    ))
  );

-- ------------------------------------------------------------------------------
-- 5.15 Eventos da Encomenda (encomenda_eventos)
-- anon: — (rastreio via RPC pública) | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S
-- ------------------------------------------------------------------------------

create policy "encomenda_eventos_select_authenticated"
  on public.encomenda_eventos
  for select
  to authenticated
  using (
    (select private.tem_papel(
      'ADMIN'::public.papel_usuario,
      'GERENTE'::public.papel_usuario,
      'VENDEDOR'::public.papel_usuario,
      'CONFERENTE'::public.papel_usuario
    ))
    and exists (
      select 1 from public.encomendas e
      where e.id = encomenda_eventos.encomenda_id
        and e.empresa_id = (select private.empresa_atual())
    )
  );

-- ------------------------------------------------------------------------------
-- 5.16 Perfis (perfis)
-- anon: — | VENDEDOR: S (o próprio) | CONFERENTE: S (o próprio) | GERENTE: S (empresa) | ADMIN: S, U (empresa)
-- ------------------------------------------------------------------------------

create policy "perfis_select_proprio"
  on public.perfis
  for select
  to authenticated
  using (id = (select auth.uid()));

create policy "perfis_select_empresa"
  on public.perfis
  for select
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
  );

create policy "perfis_update_admin"
  on public.perfis
  for update
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  )
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

-- ------------------------------------------------------------------------------
-- 5.17 Agências (agencias)
-- anon: — | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "agencias_select_authenticated"
  on public.agencias
  for select
  to authenticated
  using (empresa_id = (select private.empresa_atual()));

create policy "agencias_insert_admin"
  on public.agencias
  for insert
  to authenticated
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

create policy "agencias_update_admin"
  on public.agencias
  for update
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  )
  with check (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

create policy "agencias_delete_admin"
  on public.agencias
  for delete
  to authenticated
  using (
    empresa_id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

-- ------------------------------------------------------------------------------
-- 5.18 Linhas Permitidas por Perfil (perfis_linhas)
-- anon: — | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, I/U/D
-- ------------------------------------------------------------------------------

create policy "perfis_linhas_select_authenticated"
  on public.perfis_linhas
  for select
  to authenticated
  using (
    exists (
      select 1 from public.perfis p
      where p.id = perfis_linhas.perfil_id
        and p.empresa_id = (select private.empresa_atual())
    )
  );

create policy "perfis_linhas_insert_admin"
  on public.perfis_linhas
  for insert
  to authenticated
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.perfis p
      where p.id = perfis_linhas.perfil_id
        and p.empresa_id = (select private.empresa_atual())
    )
    and exists (
      select 1 from public.linhas l
      where l.id = perfis_linhas.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "perfis_linhas_update_admin"
  on public.perfis_linhas
  for update
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.perfis p
      where p.id = perfis_linhas.perfil_id
        and p.empresa_id = (select private.empresa_atual())
    )
  )
  with check (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.perfis p
      where p.id = perfis_linhas.perfil_id
        and p.empresa_id = (select private.empresa_atual())
    )
    and exists (
      select 1 from public.linhas l
      where l.id = perfis_linhas.linha_id
        and l.empresa_id = (select private.empresa_atual())
    )
  );

create policy "perfis_linhas_delete_admin"
  on public.perfis_linhas
  for delete
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario))
    and exists (
      select 1 from public.perfis p
      where p.id = perfis_linhas.perfil_id
        and p.empresa_id = (select private.empresa_atual())
    )
  );

-- ------------------------------------------------------------------------------
-- 5.19 Empresas (empresas)
-- anon: S (só campos públicos, via view empresa_publica) | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S, U
-- ------------------------------------------------------------------------------

create policy "empresas_select_authenticated"
  on public.empresas
  for select
  to authenticated
  using (id = (select private.empresa_atual()));

create policy "empresas_update_admin"
  on public.empresas
  for update
  to authenticated
  using (
    id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  )
  with check (
    id = (select private.empresa_atual())
    and (select private.tem_papel('ADMIN'::public.papel_usuario))
  );

-- ------------------------------------------------------------------------------
-- 5.20 Sessões de Caixa (caixa_sessoes)
-- anon: — | VENDEDOR: S (as próprias) | CONFERENTE: — | GERENTE: S | ADMIN: S
-- ------------------------------------------------------------------------------

create policy "caixa_sessoes_select_vendedor"
  on public.caixa_sessoes
  for select
  to authenticated
  using (
    usuario_id = (select auth.uid())
    and (select private.tem_papel('VENDEDOR'::public.papel_usuario))
  );

create policy "caixa_sessoes_select_gerente_admin"
  on public.caixa_sessoes
  for select
  to authenticated
  using (
    (select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario))
    and exists (
      select 1 from public.perfis p
      where p.id = caixa_sessoes.usuario_id
        and p.empresa_id = (select private.empresa_atual())
    )
  );

-- ------------------------------------------------------------------------------
-- 5.21 Descontos por Tipo de Passageiro (descontos_tipo_passageiro)
-- anon: S | VENDEDOR: S | CONFERENTE: S | GERENTE: S | ADMIN: S
-- Tabela de referência pública para cálculo de passagens
-- ------------------------------------------------------------------------------

create policy "descontos_tipo_passageiro_select_anon"
  on public.descontos_tipo_passageiro
  for select
  to anon
  using (true);

create policy "descontos_tipo_passageiro_select_authenticated"
  on public.descontos_tipo_passageiro
  for select
  to authenticated
  using (true);
