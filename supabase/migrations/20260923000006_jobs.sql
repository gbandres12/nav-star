-- ==============================================================================
-- Migração 6: Jobs Agendados (pg_cron) e Gerador de Viagens
-- NavStar - Banco de Dados PostgreSQL / Supabase
-- Conforme especificação B5 do backend-plan.md e Requisitos Etapa B5
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Função: private.gerar_viagens
--    Gera automaticamente as viagens programadas com base nos horários ativos das linhas.
--    Itera pelos próximos N dias (padrão 60 dias) a partir do dia atual no fuso de Manaus.
-- ------------------------------------------------------------------------------
create or replace function private.gerar_viagens(dias int default 60)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date;
  v_total_geradas int := 0;
begin
  if dias is null or dias <= 0 then
    return 0;
  end if;

  -- Determina a data de hoje no fuso horário de Manaus (America/Manaus)
  v_hoje := (pg_catalog.now() at time zone 'America/Manaus')::date;

  -- Insere as viagens para os próximos N dias respeitando horários, vigência e dia da semana
  with dias_serie as (
    select (v_hoje + s.i)::date as dia
    from pg_catalog.generate_series(0, dias - 1) as s(i)
  ),
  candidatos as (
    select
      l.empresa_id,
      hl.linha_id,
      hl.embarcacao_id,
      ((ds.dia + hl.hora_saida) at time zone 'America/Manaus') as partida,
      hl.vigencia_inicio,
      hl.vigencia_fim
    from dias_serie ds
    cross join public.horarios_linha hl
    inner join public.linhas l on l.id = hl.linha_id
    where hl.ativo = true
      and l.ativa = true
      and extract(dow from ds.dia)::int = hl.dia_semana
  )
  insert into public.viagens (
    empresa_id,
    linha_id,
    embarcacao_id,
    partida,
    status,
    vendas_abertas
  )
  select
    c.empresa_id,
    c.linha_id,
    c.embarcacao_id,
    c.partida,
    'PROGRAMADA'::public.status_viagem,
    true
  from candidatos c
  where c.partida > pg_catalog.now()
    and (c.vigencia_inicio is null or c.partida >= c.vigencia_inicio)
    and (c.vigencia_fim is null or c.partida <= c.vigencia_fim)
  on conflict (linha_id, partida) do nothing;

  get diagnostics v_total_geradas = row_count;

  return v_total_geradas;
end;
$$;

comment on function private.gerar_viagens(int) is 
  'Gera viagens automáticas para os próximos N dias com base nos horários ativos das linhas, idempotente via on conflict.';

revoke all on function private.gerar_viagens(int) from public;
grant execute on function private.gerar_viagens(int) to postgres, service_role;

-- ------------------------------------------------------------------------------
-- 2. Agendamento de Jobs Recorrentes via pg_cron
--    Garante idempotência cancelando agendamentos prévios caso existam.
-- ------------------------------------------------------------------------------
do $$
begin
  -- Desmarcar job de expiração de reservas se já existir
  if exists (select 1 from cron.job where jobname = 'expirar-reservas') then
    perform cron.unschedule('expirar-reservas');
  end if;

  -- Desmarcar job de geração de viagens se já existir
  if exists (select 1 from cron.job where jobname = 'gerar-viagens') then
    perform cron.unschedule('gerar-viagens');
  end if;
end;
$$;

-- Job 1: Expirar reservas não pagas a cada minuto
select cron.schedule(
  'expirar-reservas',
  '* * * * *',
  'select private.expirar_pedidos()'
);

-- Job 2: Gerar viagens para os próximos 60 dias diariamente às 06:00 UTC (02:00 Manaus)
select cron.schedule(
  'gerar-viagens',
  '0 6 * * *',
  'select private.gerar_viagens(60)'
);
