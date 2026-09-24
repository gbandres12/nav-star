-- C1 (plano-melhorias.md): alíquotas de desconto por tipo de passageiro editáveis pelo ADMIN, com histórico.
-- Re-executável. Vale para todas as rotas; a mudança só afeta vendas novas (passagens guardam o valor cobrado).

create table if not exists public.descontos_historico (
  id uuid primary key default gen_random_uuid(),
  tipo public.tipo_passageiro not null,
  percentual_anterior numeric(5,2),
  percentual_novo numeric(5,2) not null,
  alterado_por uuid references public.perfis on delete set null,
  alterado_em timestamptz not null default now()
);
create index if not exists idx_descontos_historico_tipo on public.descontos_historico (tipo, alterado_em desc);
alter table public.descontos_historico enable row level security;

drop policy if exists "descontos_historico_select" on public.descontos_historico;
create policy "descontos_historico_select" on public.descontos_historico
  for select to authenticated
  using ((select private.tem_papel('ADMIN'::public.papel_usuario, 'GERENTE'::public.papel_usuario)));

-- Registra cada mudança de alíquota (quem, quando, de quanto para quanto)
create or replace function private.registrar_alteracao_desconto()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.percentual is distinct from old.percentual then
    insert into public.descontos_historico (tipo, percentual_anterior, percentual_novo, alterado_por)
    values (new.tipo, old.percentual, new.percentual, (select auth.uid()));
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_descontos_historico on public.descontos_tipo_passageiro;
create trigger trg_descontos_historico
  before update on public.descontos_tipo_passageiro
  for each row execute function private.registrar_alteracao_desconto();

-- Até aqui a tabela só tinha leitura; o ADMIN passa a poder alterar o percentual
drop policy if exists "descontos_tipo_passageiro_update_admin" on public.descontos_tipo_passageiro;
create policy "descontos_tipo_passageiro_update_admin" on public.descontos_tipo_passageiro
  for update to authenticated
  using ((select private.tem_papel('ADMIN'::public.papel_usuario)))
  with check ((select private.tem_papel('ADMIN'::public.papel_usuario)) and percentual >= 0 and percentual <= 100);
