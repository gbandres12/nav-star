-- ============================================================================
-- NavStar - Calendário público de viagens
-- G1: datas disponíveis por mês, sem dados pessoais
-- ============================================================================

drop function if exists public.calendario_viagens(text, text, date);

create function public.calendario_viagens(
  origem_slug text,
  destino_slug text,
  mes date
)
returns table (
  dia date,
  viagem_id uuid,
  saida timestamptz,
  chegada timestamptz,
  valor numeric,
  taxa numeric,
  livres integer,
  festival text,
  origem_ordem integer,
  destino_ordem integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem_cidade_id uuid;
  v_destino_cidade_id uuid;
  v_mes_inicio date;
  v_mes_fim date;
begin
  if calendario_viagens.origem_slug is null
     or calendario_viagens.destino_slug is null
     or calendario_viagens.mes is null then
    return;
  end if;

  v_mes_inicio := date_trunc('month', calendario_viagens.mes)::date;
  v_mes_fim := (v_mes_inicio + interval '1 month')::date;

  select c.id
    into v_origem_cidade_id
  from public.cidades c
  where c.slug = calendario_viagens.origem_slug
     or c.id::text = calendario_viagens.origem_slug
  limit 1;

  select c.id
    into v_destino_cidade_id
  from public.cidades c
  where c.slug = calendario_viagens.destino_slug
     or c.id::text = calendario_viagens.destino_slug
  limit 1;

  if v_origem_cidade_id is null
     or v_destino_cidade_id is null
     or v_origem_cidade_id = v_destino_cidade_id then
    return;
  end if;

  -- Mantém a disponibilidade do calendário alinhada à busca pública.
  perform private.expirar_pedidos();

  return query
  with trechos as (
    select
      v.id as viagem_id,
      v.embarcacao_id,
      v.partida,
      v.status as viagem_status,
      p_orig.ordem as origem_ordem,
      p_dest.ordem as destino_ordem,
      c_orig.timezone as origem_timezone,
      (v.partida + (p_orig.minutos_desde_origem * interval '1 minute')) as saida,
      (v.partida + (p_dest.minutos_desde_origem * interval '1 minute')) as chegada,
      coalesce(t.valor, 0.00) as tarifa_valor,
      coalesce(porto_orig.taxa_embarque, 0.00) as taxa_embarque,
      f.nome as festival_nome,
      f.inicio as festival_inicio,
      f.fim as festival_fim
    from public.viagens v
    join public.linhas l
      on l.id = v.linha_id
     and l.ativa = true
    join public.paradas_linha p_orig
      on p_orig.linha_id = l.id
    join public.portos porto_orig
      on porto_orig.id = p_orig.porto_id
    join public.cidades c_orig
      on c_orig.id = porto_orig.cidade_id
     and c_orig.id = v_origem_cidade_id
    join public.paradas_linha p_dest
      on p_dest.linha_id = l.id
     and p_orig.ordem < p_dest.ordem
    join public.portos porto_dest
      on porto_dest.id = p_dest.porto_id
    join public.cidades c_dest
      on c_dest.id = porto_dest.cidade_id
     and c_dest.id = v_destino_cidade_id
    left join public.tarifas_trecho t
      on t.linha_id = l.id
     and t.origem_parada_id = p_orig.id
     and t.destino_parada_id = p_dest.id
    left join public.festival_viagens fv
      on fv.viagem_id = v.id
    left join public.festivais f
      on f.id = fv.festival_id
     and f.publicado = true
    where v.vendas_abertas = true
      and v.status in ('PROGRAMADA', 'EMBARQUE')
      and (v.partida + (p_orig.minutos_desde_origem * interval '1 minute')) > now()
      and (
        (
          v.partida + (p_orig.minutos_desde_origem * interval '1 minute')
        ) at time zone coalesce(c_orig.timezone, 'America/Manaus')
      )::date >= v_mes_inicio
      and (
        (
          v.partida + (p_orig.minutos_desde_origem * interval '1 minute')
        ) at time zone coalesce(c_orig.timezone, 'America/Manaus')
      )::date < v_mes_fim
  ),
  com_disponibilidade as (
    select
      tr.*,
      greatest(
        0,
        (
          select count(*)::integer
          from public.assentos a
          where a.embarcacao_id = (
            select v_assento.embarcacao_id
            from public.viagens v_assento
            where v_assento.id = tr.viagem_id
          )
            and a.ativo = true
        ) - (
          select count(distinct p.assento_id)::integer
          from public.passagens p
          where p.viagem_id = tr.viagem_id
            and p.assento_id is not null
            and p.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
            and p.trecho && int4range(tr.origem_ordem, tr.destino_ordem)
        )
      ) as lugares_livres
    from trechos tr
  )
  select
    (
      cd.saida at time zone coalesce(cd.origem_timezone, 'America/Manaus')
    )::date as dia,
    cd.viagem_id,
    cd.saida,
    cd.chegada,
    cd.tarifa_valor as valor,
    cd.taxa_embarque as taxa,
    cd.lugares_livres as livres,
    case
      when cd.festival_nome is not null
       and (
         cd.saida at time zone coalesce(cd.origem_timezone, 'America/Manaus')
       )::date between cd.festival_inicio and cd.festival_fim
      then cd.festival_nome
      else null
    end as festival,
    cd.origem_ordem,
    cd.destino_ordem
  from com_disponibilidade cd
  order by cd.saida asc;
end;
$$;

revoke all on function public.calendario_viagens(text, text, date) from public;
grant execute on function public.calendario_viagens(text, text, date) to anon, authenticated;

create index if not exists idx_viagens_calendario_publico
  on public.viagens (linha_id, partida)
  where vendas_abertas = true
    and status in ('PROGRAMADA', 'EMBARQUE');
