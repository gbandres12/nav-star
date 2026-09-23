-- ------------------------------------------------------------------------------
-- Migração: 20260923000007_usuarios_onboarding.sql
-- Adiciona suporte a onboarding estratégico, contato e ativação de operadores
-- ------------------------------------------------------------------------------

-- 1. Novas colunas em public.perfis para onboarding e contato
alter table public.perfis
  add column if not exists telefone text,
  add column if not exists onboarding_concluido boolean not null default false,
  add column if not exists onboarding_passo integer not null default 0,
  add column if not exists convite_enviado_em timestamptz;

-- 2. Permissão para o próprio usuário atualizar seu progresso de onboarding e telefone
create policy "perfis_update_proprio_onboarding"
  on public.perfis
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- 3. RPC atômica para registrar avanço de onboarding e telefone
create or replace function public.atualizar_onboarding(
  p_passo integer,
  p_concluido boolean default false,
  p_telefone text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Não autenticado.';
  end if;

  update public.perfis
  set
    onboarding_passo = greatest(onboarding_passo, coalesce(p_passo, onboarding_passo)),
    onboarding_concluido = case when p_concluido then true else onboarding_concluido end,
    telefone = coalesce(p_telefone, telefone),
    updated_at = now()
  where id = v_uid;
end;
$$;

revoke all on function public.atualizar_onboarding(integer, boolean, text) from public, anon, authenticated;
grant execute on function public.atualizar_onboarding(integer, boolean, text) to authenticated;
