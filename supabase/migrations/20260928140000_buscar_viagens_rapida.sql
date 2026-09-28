-- Busca de viagens mais rápida e com lotação correta.
-- 1. Origem e destino passam a ser opcionais: a venda no balcão busca todos os trechos do dia numa chamada só
--    (antes eram ~30 chamadas, uma por par de cidades).
-- 2. Lugares livres = lotação menos o pico de passageiros (inclusive colo) nos trechos percorridos.
--    Em embarcação com poltrona numerada, também limita pelas poltronas livres. Antes só contava poltronas,
--    e com assento livre mostrava sempre a lotação cheia.
create or replace function public.buscar_viagens(origem_slug text, destino_slug text, dia date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_origem_cidade_id uuid;
  v_destino_cidade_id uuid;
  v_resultado jsonb;
begin
  perform private.expirar_pedidos();

  if nullif(buscar_viagens.origem_slug, '') is not null then
    select id into v_origem_cidade_id from public.cidades
    where slug = buscar_viagens.origem_slug or id::text = buscar_viagens.origem_slug limit 1;
    if v_origem_cidade_id is null then return '[]'::jsonb; end if;
  end if;

  if nullif(buscar_viagens.destino_slug, '') is not null then
    select id into v_destino_cidade_id from public.cidades
    where slug = buscar_viagens.destino_slug or id::text = buscar_viagens.destino_slug limit 1;
    if v_destino_cidade_id is null then return '[]'::jsonb; end if;
  end if;

  if v_origem_cidade_id = v_destino_cidade_id then
    return '[]'::jsonb;
  end if;

  -- Sem origem nem destino é preciso a data, para não varrer todas as viagens futuras
  if v_origem_cidade_id is null and v_destino_cidade_id is null and buscar_viagens.dia is null then
    return '[]'::jsonb;
  end if;

  with trechos as (
    select
      v.id as viagem_id,
      v.linha_id,
      v.embarcacao_id,
      v.partida,
      v.status as viagem_status,
      v.comandante,
      v.vendas_abertas,
      l.nome as linha_nome,
      emb.nome as embarcacao_nome,
      emb.capacidade_passageiros,
      emb.assento_livre,
      p_orig.ordem as origem_ordem,
      p_dest.ordem as destino_ordem,
      porto_orig.nome as porto_orig_nome,
      coalesce(porto_orig.taxa_embarque, 0.00) as taxa_embarque,
      c_orig.nome as origem_cidade_nome,
      c_orig.sigla as origem_cidade_sigla,
      c_orig.timezone as origem_cidade_tz,
      c_dest.nome as destino_cidade_nome,
      c_dest.sigla as destino_cidade_sigla,
      coalesce(t.valor, 0.00) as tarifa_valor,
      (v.partida + (p_orig.minutos_desde_origem * interval '1 minute')) as saida,
      (v.partida + (p_dest.minutos_desde_origem * interval '1 minute')) as chegada,
      (p_dest.minutos_desde_origem - p_orig.minutos_desde_origem) as duracao_min
    from public.viagens v
    join public.linhas l on l.id = v.linha_id and l.ativa = true
    join public.embarcacoes emb on emb.id = v.embarcacao_id
    join public.paradas_linha p_orig on p_orig.linha_id = l.id
    join public.portos porto_orig on porto_orig.id = p_orig.porto_id
    join public.cidades c_orig on c_orig.id = porto_orig.cidade_id
    join public.paradas_linha p_dest on p_dest.linha_id = l.id
    join public.portos porto_dest on porto_dest.id = p_dest.porto_id
    join public.cidades c_dest on c_dest.id = porto_dest.cidade_id
    left join public.tarifas_trecho t
      on t.linha_id = l.id
     and t.origem_parada_id = p_orig.id
     and t.destino_parada_id = p_dest.id
    where v.vendas_abertas = true
      and v.status in ('PROGRAMADA', 'EMBARQUE')
      and p_orig.ordem < p_dest.ordem
      and c_orig.id <> c_dest.id
      and (v_origem_cidade_id is null or c_orig.id = v_origem_cidade_id)
      and (v_destino_cidade_id is null or c_dest.id = v_destino_cidade_id)
      -- corta cedo pela data da partida (a viagem pode começar no dia anterior à saída da parada)
      and (buscar_viagens.dia is null or v.partida between buscar_viagens.dia - interval '3 days' and buscar_viagens.dia + interval '2 days')
  ),
  no_dia as (
    select tr.*
    from trechos tr
    where tr.saida > now()
      and (
        buscar_viagens.dia is null
        or (tr.saida at time zone coalesce(tr.origem_cidade_tz, 'America/Manaus'))::date = buscar_viagens.dia
      )
  ),
  filtrados as (
    select
      nd.*,
      greatest(0, least(
        coalesce(nd.capacidade_passageiros, 2147483647) - (
          select coalesce(max(seg.n), 0)
          from (
            select count(pas.id) as n
            from generate_series(nd.origem_ordem, nd.destino_ordem - 1) as s(ordem)
            left join public.passagens pas
              on pas.viagem_id = nd.viagem_id
             and pas.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
             and pas.trecho @> s.ordem
            group by s.ordem
          ) seg
        ),
        case when nd.assento_livre then 2147483647 else (
          (select count(*)::integer from public.assentos a
            where a.embarcacao_id = nd.embarcacao_id and a.ativo = true)
          - (select count(distinct p.assento_id)::integer from public.passagens p
            where p.viagem_id = nd.viagem_id
              and p.assento_id is not null
              and p.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
              and p.trecho && int4range(nd.origem_ordem, nd.destino_ordem))
        ) end
      )) as livres
    from no_dia nd
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'viagem', jsonb_build_object(
          'id', f.viagem_id,
          'linhaId', f.linha_id,
          'linha_id', f.linha_id,
          'embarcacaoId', f.embarcacao_id,
          'embarcacao_id', f.embarcacao_id,
          'partida', f.partida,
          'status', f.viagem_status,
          'comandante', f.comandante,
          'vendasAbertas', f.vendas_abertas,
          'vendas_abertas', f.vendas_abertas
        ),
        'viagemId', f.viagem_id,
        'viagem_id', f.viagem_id,
        'linhaNome', f.linha_nome,
        'linha_nome', f.linha_nome,
        'origemOrdem', f.origem_ordem,
        'origem_ordem', f.origem_ordem,
        'destinoOrdem', f.destino_ordem,
        'destino_ordem', f.destino_ordem,
        'saida', f.saida,
        'chegada', f.chegada,
        'duracaoMin', f.duracao_min,
        'duracao_min', f.duracao_min,
        'valor', f.tarifa_valor,
        'taxa', f.taxa_embarque,
        'livres', f.livres,
        'portoEmbarque', f.porto_orig_nome,
        'porto_embarque', f.porto_orig_nome,
        'origemCidade', f.origem_cidade_nome,
        'origem_cidade', f.origem_cidade_nome,
        'origemSigla', f.origem_cidade_sigla,
        'origem_sigla', f.origem_cidade_sigla,
        'destinoCidade', f.destino_cidade_nome,
        'destino_cidade', f.destino_cidade_nome,
        'destinoSigla', f.destino_cidade_sigla,
        'destino_sigla', f.destino_cidade_sigla,
        'embarcacao', f.embarcacao_nome
      ) order by f.saida asc, f.destino_ordem asc
    ),
    '[]'::jsonb
  )
  into v_resultado
  from filtrados f;

  return v_resultado;
end;
$function$;
