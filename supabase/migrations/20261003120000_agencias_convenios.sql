-- Convênios com desconto no portal das agências parceiras.
--
-- Só convênios que a empresa marcar como "disponível para agências" aparecem no portal, e nunca os faturados
-- (faturado = a empresa cobra o convênio depois; a agência recebe do passageiro na hora).
-- O preço de tabela com convênio segue a mesma regra do balcão: vale o menor entre o desconto
-- (o maior entre categoria e convênio) e a tarifa negociada do trecho. O piso da agência continua sendo
-- o mesmo % da tabela, agora a tabela já com o convênio.

alter table public.convenios add column if not exists disponivel_agencias boolean not null default false;

create or replace function private.preco_tabela_convenio(
  p_viagem_id uuid, p_origem integer, p_destino integer, p_tipo public.tipo_passageiro, p_convenio_id uuid
)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viagem record;
  v_base numeric(10,2);
  v_festival numeric(5,2);
  v_desc numeric(5,2);
  v_conv numeric(5,2) := 0;
  v_especial numeric(10,2);
begin
  select linha_id, empresa_id into v_viagem from public.viagens where id = p_viagem_id;

  select t.valor into v_base
  from public.tarifas_trecho t
  join public.paradas_linha po on po.id = t.origem_parada_id and po.ordem = p_origem
  join public.paradas_linha pd on pd.id = t.destino_parada_id and pd.ordem = p_destino
  where t.linha_id = v_viagem.linha_id;
  if v_base is null then
    return null;
  end if;

  select f.acrescimo_percentual into v_festival
  from public.festival_viagens fv
  join public.festivais f on f.id = fv.festival_id
  where fv.viagem_id = p_viagem_id and f.publicado
  limit 1;
  if v_festival is not null then
    v_base := round(v_base * (1 + v_festival / 100), 2);
  end if;

  select coalesce(d.percentual, 0) into v_desc from public.descontos_tipo_passageiro d where d.tipo = p_tipo;

  if p_convenio_id is not null then
    select c.desconto_percentual into v_conv
    from public.convenios c
    where c.id = p_convenio_id and c.empresa_id = v_viagem.empresa_id
      and c.ativo and c.disponivel_agencias and not c.faturado;
    if not found then
      raise exception using errcode = 'P0001', message = 'Convênio indisponível para agências.';
    end if;
    select ct.valor into v_especial
    from public.convenio_tarifas_trecho ct
    where ct.convenio_id = p_convenio_id and ct.empresa_id = v_viagem.empresa_id
      and ct.linha_id = v_viagem.linha_id and ct.origem_ordem = p_origem and ct.destino_ordem = p_destino and ct.ativa;
  end if;

  return round(least(v_base * (1 - greatest(coalesce(v_desc, 0), v_conv) / 100), coalesce(v_especial, v_base)), 2);
end;
$$;

-- Preços do trecho agora aceitam um convênio (opcional)
drop function if exists public.precos_agencia_trecho(uuid, integer, integer);

create or replace function public.precos_agencia_trecho(p_viagem_id uuid, p_origem_ordem integer, p_destino_ordem integer, p_convenio_id uuid default null)
returns table (tipo public.tipo_passageiro, valor_tabela numeric, valor_piso numeric, taxa_embarque numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select x.t, x.tabela, private.piso_agencia(p_viagem_id, x.t, x.tabela),
         private.taxa_embarque_agencia(p_viagem_id, p_origem_ordem, p_destino_ordem, x.t)
  from (
    select t, private.preco_tabela_convenio(p_viagem_id, p_origem_ordem, p_destino_ordem, t, p_convenio_id) as tabela
    from unnest(enum_range(null::public.tipo_passageiro)) as t
  ) x
  where x.tabela is not null;
$$;

revoke execute on function private.preco_tabela_convenio(uuid, integer, integer, public.tipo_passageiro, uuid) from public, anon, authenticated;
revoke execute on function public.precos_agencia_trecho(uuid, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.precos_agencia_trecho(uuid, integer, integer, uuid) to service_role;

-- Venda: lê convenio_id do payload, usa a tabela com convênio e grava o convênio na passagem.
-- Reescreve a função em uso e aborta, sem alterar nada, se ela não estiver na versão esperada.
do $migracao$
declare
  v_def text;
  v_novo text;
begin
  v_def := pg_get_functiondef('public.vender_passagem_agencia(uuid, jsonb)'::regprocedure);
  v_novo := v_def;

  v_novo := replace(v_novo, E'  v_cobrado numeric(10,2);\n', E'  v_cobrado numeric(10,2);\n  v_convenio_id uuid;\n');

  v_novo := replace(v_novo,
    E'  v_nome := trim(coalesce(v_pj->>''nome'', ''''));\n',
    E'  begin\n'
    || E'    v_convenio_id := nullif(p_dados->>''convenio_id'', '''')::uuid;\n'
    || E'  exception when others then\n'
    || E'    raise exception using errcode = ''P0001'', message = ''Convênio inválido.'';\n'
    || E'  end;\n\n'
    || E'  v_nome := trim(coalesce(v_pj->>''nome'', ''''));\n');

  v_novo := replace(v_novo,
    'v_tabela := private.preco_tabela(v_viagem_id, v_origem, v_destino, v_tipo);',
    'v_tabela := private.preco_tabela_convenio(v_viagem_id, v_origem, v_destino, v_tipo, v_convenio_id);');

  v_novo := replace(v_novo, 'taxa_embarque, status, qr_token', 'taxa_embarque, convenio_id, status, qr_token');
  v_novo := replace(v_novo, 'v_cobrado, v_taxa, ''EMITIDA'', v_qr', 'v_cobrado, v_taxa, v_convenio_id, ''EMITIDA'', v_qr');

  if position('v_convenio_id uuid;' in v_def) > 0
     or position('v_convenio_id uuid;' in v_novo) = 0
     or position('nullif(p_dados->>''convenio_id''' in v_novo) = 0
     or position('preco_tabela_convenio(v_viagem_id' in v_novo) = 0
     or position('taxa_embarque, convenio_id, status, qr_token' in v_novo) = 0
     or position('v_taxa, v_convenio_id, ''EMITIDA''' in v_novo) = 0 then
    raise exception 'vender_passagem_agencia não está na versão esperada; ajuste a migração (nada foi alterado).';
  end if;

  execute v_novo;
end
$migracao$;
