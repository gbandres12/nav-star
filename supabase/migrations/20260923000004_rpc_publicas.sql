-- ==============================================================================
-- Migração 4: Funções RPC Públicas e Regras de Negócio Transacionais
-- NavStar - Banco de Dados PostgreSQL / Supabase
-- Conforme especificação B4 do backend-plan.md
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. Sequência para numeração legível de pedidos (ex.: MAO-2026-0001)
-- ------------------------------------------------------------------------------
create sequence if not exists public.pedido_numero_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;

grant usage, select on sequence public.pedido_numero_seq to anon, authenticated;

-- ------------------------------------------------------------------------------
-- 1. Função Privada de Expiração de Pedidos Vencidos
-- ------------------------------------------------------------------------------
create or replace function private.expirar_pedidos()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expirados_ids uuid[];
  v_count integer;
begin
  -- Atualiza pedidos com status 'AGUARDANDO_PAGAMENTO' e expira_em <= now() para 'EXPIRADO'
  with expirados as (
    update public.pedidos
    set status = 'EXPIRADO',
        updated_at = now()
    where status = 'AGUARDANDO_PAGAMENTO'
      and expira_em is not null
      and expira_em <= now()
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into v_expirados_ids
  from expirados;

  v_count := coalesce(array_length(v_expirados_ids, 1), 0);

  -- Atualiza as passagens associadas aos pedidos expirados para 'CANCELADA'
  if v_count > 0 then
    update public.passagens
    set status = 'CANCELADA',
        updated_at = now()
    where pedido_id = any(v_expirados_ids)
      and status = 'RESERVADA';
  end if;

  return v_count;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Função Privada de Geração de Código Alfanumérico Único
--    Caracteres seguros (sem 0, O, 1, I para evitar ambiguidade visual)
-- ------------------------------------------------------------------------------
create or replace function private.gerar_codigo(prefixo text, len integer default 6)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
  chars_len constant integer := length(chars);
begin
  for i in 1..len loop
    result := result || substr(chars, floor(random() * chars_len + 1)::integer, 1);
  end loop;

  if prefixo is not null and length(trim(prefixo)) > 0 then
    return trim(prefixo) || '-' || result;
  end if;

  return result;
end;
$$;

-- ------------------------------------------------------------------------------
-- Helper Privado de Mascaramento de Documentos (CPF / Outros)
-- Exemplo: 123.456.789-00 -> ***.456.789-**
-- ------------------------------------------------------------------------------
create or replace function private.mascarar_documento(doc text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  digits text;
begin
  if doc is null or length(trim(doc)) = 0 then
    return '***';
  end if;

  digits := regexp_replace(doc, '\D', '', 'g');
  if length(digits) = 11 then
    return '***.' || substr(digits, 4, 3) || '.' || substr(digits, 7, 3) || '-**';
  elsif length(digits) >= 6 then
    return '***' || substr(digits, 4, length(digits) - 5) || '**';
  else
    return '***';
  end if;
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. Função Privada Núcleo de Criação de Pedidos
-- ------------------------------------------------------------------------------
do $$
begin
  create type private.t_passagem_item as (
    nome text,
    documento text,
    telefone text,
    tipo public.tipo_passageiro,
    assento_id uuid,
    valor numeric(10,2),
    taxa numeric(10,2)
  );
exception
  when duplicate_object then null;
end;
$$;

create or replace function private.criar_pedido(
  payload jsonb,
  p_canal public.canal_venda,
  p_vendedor_id uuid default null,
  p_agencia_id uuid default null,
  p_pago_no_ato boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem_id uuid;
  v_origem_ordem integer;
  v_destino_ordem integer;
  v_comprador_nome text;
  v_comprador_email text;
  v_comprador_telefone text;
  v_metodo public.metodo_pagamento;
  v_viagem record;
  v_origem_parada_id uuid;
  v_origem_porto_id uuid;
  v_destino_parada_id uuid;
  v_destino_porto_id uuid;
  v_origem_cidade_sigla varchar(3);
  v_taxa_embarque_unit numeric(10,2);
  v_tarifa_base numeric(10,2);
  v_minutos_reserva integer;
  v_comissao_pct numeric(5,2);
  v_comissao_agencia numeric(10,2);
  v_passageiros_json jsonb;
  v_qtd_passageiros integer;
  v_p jsonb;
  v_p_nome text;
  v_p_documento text;
  v_p_telefone text;
  v_p_tipo public.tipo_passageiro;
  v_p_assento_id uuid;
  v_p_valor numeric(10,2);
  v_p_taxa numeric(10,2);
  v_desc_pct numeric(5,2);
  v_subtotal numeric(10,2) := 0.00;
  v_taxas numeric(10,2) := 0.00;
  v_total numeric(10,2) := 0.00;
  v_assentos_usados uuid[] := array[]::uuid[];
  v_pedido_id uuid;
  v_codigo text;
  v_numero text;
  v_status_ped public.status_pedido;
  v_status_pas public.status_passagem;
  v_status_pag public.status_pagamento;
  v_expira_em timestamptz;
  v_pago_em timestamptz;
  v_qr_token text;
  v_assento_check uuid;
  i integer;

  v_itens private.t_passagem_item[];
  v_item private.t_passagem_item;
begin
  -- 1. Validação dos dados essenciais do payload
  v_viagem_id := coalesce(
    nullif(payload->>'viagem_id', '')::uuid,
    nullif(payload->>'viagemId', '')::uuid
  );
  v_origem_ordem := coalesce(
    (payload->>'origem_ordem')::integer,
    (payload->>'origemOrdem')::integer
  );
  v_destino_ordem := coalesce(
    (payload->>'destino_ordem')::integer,
    (payload->>'destinoOrdem')::integer
  );

  if v_viagem_id is null or v_origem_ordem is null or v_destino_ordem is null then
    raise exception using errcode = 'P0001', message = 'Viagem e trecho de origem/destino são obrigatórios.';
  end if;

  if v_origem_ordem >= v_destino_ordem then
    raise exception using errcode = 'P0001', message = 'Trecho inválido: a origem deve ser anterior ao destino.';
  end if;

  -- Comprador
  v_comprador_nome := trim(coalesce(
    payload->'comprador'->>'nome',
    payload->>'comprador_nome',
    payload->>'compradorNome',
    ''
  ));
  v_comprador_email := nullif(trim(coalesce(
    payload->'comprador'->>'email',
    payload->>'comprador_email',
    payload->>'compradorEmail',
    ''
  )), '');
  v_comprador_telefone := trim(coalesce(
    payload->'comprador'->>'telefone',
    payload->>'comprador_telefone',
    payload->>'compradorTelefone',
    ''
  ));

  if length(v_comprador_nome) < 2 then
    raise exception using errcode = 'P0001', message = 'Nome do comprador é obrigatório.';
  end if;
  if length(v_comprador_telefone) < 5 then
    raise exception using errcode = 'P0001', message = 'Telefone do comprador é obrigatório.';
  end if;

  -- Método de pagamento
  begin
    v_metodo := upper(trim(coalesce(payload->>'metodo', payload->>'metodo_pagamento', 'PIX')))::public.metodo_pagamento;
  exception when others then
    v_metodo := 'PIX'::public.metodo_pagamento;
  end;

  -- 2. Validação da viagem (partida futura, vendas abertas, status permitido)
  select v.id, v.empresa_id, v.linha_id, v.embarcacao_id, v.partida, v.status, v.vendas_abertas
  into v_viagem
  from public.viagens v
  where v.id = v_viagem_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Viagem não encontrada.';
  end if;

  if v_viagem.partida <= now() then
    raise exception using errcode = 'P0001', message = 'A viagem selecionada já partiu.';
  end if;

  if not v_viagem.vendas_abertas then
    raise exception using errcode = 'P0001', message = 'Vendas encerradas para esta viagem.';
  end if;

  if v_viagem.status not in ('PROGRAMADA', 'EMBARQUE') then
    raise exception using errcode = 'P0001', message = 'Viagem indisponível para venda.';
  end if;

  -- 3. Validação das paradas da linha no trecho
  select id, porto_id
  into v_origem_parada_id, v_origem_porto_id
  from public.paradas_linha
  where linha_id = v_viagem.linha_id and ordem = v_origem_ordem;

  select id, porto_id
  into v_destino_parada_id, v_destino_porto_id
  from public.paradas_linha
  where linha_id = v_viagem.linha_id and ordem = v_destino_ordem;

  if v_origem_parada_id is null or v_destino_parada_id is null then
    raise exception using errcode = 'P0001', message = 'Trecho não encontrado na linha da viagem.';
  end if;

  -- Taxa de embarque do porto de origem e sigla da cidade para o código do bilhete
  select coalesce(p.taxa_embarque, 0.00), c.sigla
  into v_taxa_embarque_unit, v_origem_cidade_sigla
  from public.portos p
  join public.cidades c on c.id = p.cidade_id
  where p.id = v_origem_porto_id;

  -- 4. Cálculo de preço NO BANCO consultando tarifas_trecho (NUNCA confia em valores do cliente)
  select valor
  into v_tarifa_base
  from public.tarifas_trecho
  where linha_id = v_viagem.linha_id
    and origem_parada_id = v_origem_parada_id
    and destino_parada_id = v_destino_parada_id;

  if v_tarifa_base is null then
    raise exception using errcode = 'P0001', message = 'Tarifa não cadastrada para o trecho selecionado.';
  end if;

  -- 5. Executa expiração de pedidos vencidos antes de validar disponibilidade
  perform private.expirar_pedidos();

  -- 6. Validação dos passageiros
  v_passageiros_json := coalesce(payload->'passageiros', '[]'::jsonb);
  v_qtd_passageiros := jsonb_array_length(v_passageiros_json);

  if v_qtd_passageiros = 0 then
    raise exception using errcode = 'P0001', message = 'Selecione ao menos um assento / passageiro.';
  end if;

  -- Configuração da empresa para tempo de expiração
  select coalesce(minutos_reserva_site, 30)
  into v_minutos_reserva
  from public.empresas
  where id = v_viagem.empresa_id;

  -- Comissão de agência (se aplicável)
  if p_agencia_id is not null then
    select coalesce(comissao_percentual, 0.00)
    into v_comissao_pct
    from public.agencias
    where id = p_agencia_id and ativa = true;
  else
    v_comissao_pct := 0.00;
  end if;

  -- Processamento de cada passageiro
  for i in 0..(v_qtd_passageiros - 1) loop
    v_p := v_passageiros_json->i;
    v_p_nome := trim(coalesce(v_p->>'nome', ''));
    v_p_documento := trim(coalesce(v_p->>'documento', ''));
    v_p_telefone := nullif(trim(coalesce(v_p->>'telefone', '')), '');

    if length(v_p_nome) < 2 then
      raise exception using errcode = 'P0001', message = 'Nome de todos os passageiros é obrigatório.';
    end if;
    if length(v_p_documento) < 3 then
      raise exception using errcode = 'P0001', message = 'Documento de todos os passageiros é obrigatório.';
    end if;

    begin
      v_p_tipo := upper(trim(coalesce(v_p->>'tipo', 'INTEIRA')))::public.tipo_passageiro;
    exception when others then
      v_p_tipo := 'INTEIRA'::public.tipo_passageiro;
    end;

    -- Desconto oficial por tipo de passageiro
    select coalesce(percentual, 0.00)
    into v_desc_pct
    from public.descontos_tipo_passageiro
    where tipo = v_p_tipo;

    if not found then
      v_desc_pct := 0.00;
    end if;

    v_p_valor := round(v_tarifa_base * (1.00 - (v_desc_pct / 100.00)), 2);

    -- Alocação / Validação de assento
    if v_p_tipo = 'COLO' then
      -- Criança de colo não ocupa assento e não paga taxa de embarque
      v_p_assento_id := null;
      v_p_taxa := 0.00;
    else
      v_p_taxa := v_taxa_embarque_unit;
      v_p_assento_id := coalesce(
        nullif(v_p->>'assento_id', '')::uuid,
        nullif(v_p->>'assentoId', '')::uuid
      );

      if v_p_assento_id is not null then
        -- Valida se o assento pertence à embarcação da viagem e está ativo
        select id
        into v_assento_check
        from public.assentos
        where id = v_p_assento_id
          and embarcacao_id = v_viagem.embarcacao_id
          and ativo = true;

        if not found then
          raise exception using errcode = 'P0001', message = 'Assento selecionado inválido para esta embarcação.';
        end if;

        if v_p_assento_id = any(v_assentos_usados) then
          raise exception using errcode = 'P0001', message = 'O mesmo assento foi selecionado mais de uma vez.';
        end if;
      else
        -- Alocação automática do próximo assento livre no trecho
        select a.id
        into v_p_assento_id
        from public.assentos a
        where a.embarcacao_id = v_viagem.embarcacao_id
          and a.ativo = true
          and a.id <> all(v_assentos_usados)
          and not exists (
            select 1
            from public.passagens pass
            where pass.viagem_id = v_viagem.id
              and pass.assento_id = a.id
              and pass.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
              and pass.trecho && int4range(v_origem_ordem, v_destino_ordem)
          )
        order by a.fileira asc, a.coluna asc
        limit 1;

        if v_p_assento_id is null then
          raise exception using errcode = 'P0001', message = 'Não há assentos disponíveis suficientes para este trecho.';
        end if;
      end if;

      v_assentos_usados := array_append(v_assentos_usados, v_p_assento_id);
    end if;

    v_subtotal := v_subtotal + v_p_valor;
    v_taxas := v_taxas + v_p_taxa;

    v_item.nome := v_p_nome;
    v_item.documento := v_p_documento;
    v_item.telefone := v_p_telefone;
    v_item.tipo := v_p_tipo;
    v_item.assento_id := v_p_assento_id;
    v_item.valor := v_p_valor;
    v_item.taxa := v_p_taxa;
    v_itens := array_append(v_itens, v_item);
  end loop;

  v_total := v_subtotal + v_taxas;
  v_comissao_agencia := round(v_subtotal * (v_comissao_pct / 100.00), 2);

  -- 7. Identificadores únicos do pedido
  v_pedido_id := gen_random_uuid();

  -- Código alfanumérico seguro para consulta pública (ex.: ST-7K3P9A)
  v_codigo := private.gerar_codigo('ST', 6);
  while exists (select 1 from public.pedidos where codigo = v_codigo) loop
    v_codigo := private.gerar_codigo('ST', 6);
  end loop;

  -- Número fiscal/operacional sequencial (ex.: MAO-2026-0001)
  v_numero := coalesce(v_origem_cidade_sigla, 'NAV') || '-' ||
              to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.pedido_numero_seq'::regclass)::text, 4, '0');
  while exists (select 1 from public.pedidos where numero = v_numero) loop
    v_numero := coalesce(v_origem_cidade_sigla, 'NAV') || '-' ||
                to_char(now(), 'YYYY') || '-' ||
                lpad(nextval('public.pedido_numero_seq'::regclass)::text, 4, '0');
  end loop;

  -- Definição de status e prazos
  if p_pago_no_ato then
    v_status_ped := 'PAGO';
    v_status_pas := 'EMITIDA';
    v_status_pag := 'APROVADO';
    v_pago_em := now();
    v_expira_em := null;
  else
    v_status_ped := 'AGUARDANDO_PAGAMENTO';
    v_status_pas := 'RESERVADA';
    v_status_pag := 'PENDENTE';
    v_pago_em := null;
    v_expira_em := now() + (v_minutos_reserva * interval '1 minute');
  end if;

  -- 8. Inserção atômica de pedido + passagens + pagamento com captura de exclusion_violation
  begin
    insert into public.pedidos (
      id,
      empresa_id,
      codigo,
      numero,
      canal,
      status,
      comprador_nome,
      comprador_email,
      comprador_telefone,
      vendedor_id,
      agencia_id,
      subtotal,
      taxas,
      desconto,
      total,
      comissao_agencia,
      expira_em,
      created_at,
      updated_at
    ) values (
      v_pedido_id,
      v_viagem.empresa_id,
      v_codigo,
      v_numero,
      p_canal,
      v_status_ped,
      v_comprador_nome,
      v_comprador_email,
      v_comprador_telefone,
      p_vendedor_id,
      p_agencia_id,
      v_subtotal,
      v_taxas,
      0.00,
      v_total,
      v_comissao_agencia,
      v_expira_em,
      now(),
      now()
    );

    foreach v_item in array v_itens loop
      v_qr_token := private.gerar_codigo('QR', 12);
      while exists (select 1 from public.passagens where qr_token = v_qr_token) loop
        v_qr_token := private.gerar_codigo('QR', 12);
      end loop;

      insert into public.passagens (
        empresa_id,
        pedido_id,
        viagem_id,
        assento_id,
        origem_ordem,
        destino_ordem,
        nome,
        documento,
        telefone,
        tipo,
        valor,
        taxa_embarque,
        status,
        qr_token,
        created_at,
        updated_at
      ) values (
        v_viagem.empresa_id,
        v_pedido_id,
        v_viagem.id,
        v_item.assento_id,
        v_origem_ordem,
        v_destino_ordem,
        v_item.nome,
        v_item.documento,
        v_item.telefone,
        v_item.tipo,
        v_item.valor,
        v_item.taxa,
        v_status_pas,
        v_qr_token,
        now(),
        now()
      );
    end loop;

    insert into public.pagamentos (
      empresa_id,
      pedido_id,
      metodo,
      status,
      valor,
      parcelas,
      pix_copia_cola,
      pago_em,
      created_at,
      updated_at
    ) values (
      v_viagem.empresa_id,
      v_pedido_id,
      v_metodo,
      v_status_pag,
      v_total,
      1,
      case
        when v_metodo = 'PIX' and not p_pago_no_ato then
          '00020126580014BR.GOV.BCB.PIX0136navstar-demo-' || v_pedido_id::text || '5204000053039865406' || to_char(v_total, 'FM999999990.00') || '5802BR'
        else null
      end,
      v_pago_em,
      now(),
      now()
    );

  exception
    when exclusion_violation then
      raise exception using errcode = 'P0001', message = 'Um dos assentos acabou de ser vendido. Escolha outro.';
  end;

  return jsonb_build_object(
    'codigo', v_codigo,
    'id', v_pedido_id,
    'numero', v_numero,
    'total', v_total
  );
end;
$$;

-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assentos_ocupados(viagem_id uuid, origem integer, destino integer)
 RETURNS uuid[]
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ocupados uuid[];
begin
  perform private.expirar_pedidos();

  select coalesce(array_agg(distinct p.assento_id), array[]::uuid[])
  into v_ocupados
  from public.passagens p
  where p.viagem_id = assentos_ocupados.viagem_id
    and p.assento_id is not null
    and p.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
    and p.trecho && int4range(assentos_ocupados.origem, assentos_ocupados.destino);

  return v_ocupados;
end;
$function$


CREATE OR REPLACE FUNCTION public.buscar_viagens(origem_slug text, destino_slug text, dia date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_origem_cidade_id uuid;
  v_destino_cidade_id uuid;
  v_resultado jsonb;
begin
  perform private.expirar_pedidos();

  select id into v_origem_cidade_id
  from public.cidades
  where slug = buscar_viagens.origem_slug or id::text = buscar_viagens.origem_slug
  limit 1;

  select id into v_destino_cidade_id
  from public.cidades
  where slug = buscar_viagens.destino_slug or id::text = buscar_viagens.destino_slug
  limit 1;

  if v_origem_cidade_id is null or v_destino_cidade_id is null or v_origem_cidade_id = v_destino_cidade_id then
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
    join public.cidades c_orig on c_orig.id = porto_orig.cidade_id and c_orig.id = v_origem_cidade_id
    join public.paradas_linha p_dest on p_dest.linha_id = l.id
    join public.portos porto_dest on porto_dest.id = p_dest.porto_id
    join public.cidades c_dest on c_dest.id = porto_dest.cidade_id and c_dest.id = v_destino_cidade_id
    left join public.tarifas_trecho t
      on t.linha_id = l.id
     and t.origem_parada_id = p_orig.id
     and t.destino_parada_id = p_dest.id
    where v.vendas_abertas = true
      and v.status in ('PROGRAMADA', 'EMBARQUE')
      and p_orig.ordem < p_dest.ordem
  ),
  filtrados as (
    select
      tr.*,
      greatest(
        0,
        (
          select count(*)::integer
          from public.assentos a
          where a.embarcacao_id = tr.embarcacao_id
            and a.ativo = true
        ) - (
          select count(distinct p.assento_id)::integer
          from public.passagens p
          where p.viagem_id = tr.viagem_id
            and p.assento_id is not null
            and p.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
            and p.trecho && int4range(tr.origem_ordem, tr.destino_ordem)
        )
      ) as livres
    from trechos tr
    where tr.saida > now()
      and (
        buscar_viagens.dia is null
        or (tr.saida at time zone coalesce(tr.origem_cidade_tz, 'America/Manaus'))::date = buscar_viagens.dia
      )
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
      ) order by f.saida asc
    ),
    '[]'::jsonb
  )
  into v_resultado
  from filtrados f;

  return v_resultado;
end;
$function$


CREATE OR REPLACE FUNCTION public.criar_pedido_site(payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return private.criar_pedido(
    payload        => payload,
    p_canal        => 'SITE'::public.canal_venda,
    p_vendedor_id  => null,
    p_agencia_id   => null,
    p_pago_no_ato  => false
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.pedido_publico(codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_pedido record;
  v_passagens jsonb;
  v_pagamentos jsonb;
  v_pagamento_principal jsonb;
begin
  perform private.expirar_pedidos();

  select
    p.id,
    p.empresa_id,
    p.codigo,
    p.numero,
    p.canal,
    p.status,
    p.comprador_nome,
    p.comprador_email,
    p.comprador_telefone,
    p.subtotal,
    p.taxas,
    p.desconto,
    p.total,
    p.expira_em,
    p.created_at
  into v_pedido
  from public.pedidos p
  where upper(trim(p.codigo)) = upper(trim(pedido_publico.codigo));

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pas.id,
        'nome', pas.nome,
        'documento', private.mascarar_documento(pas.documento),
        'tipo', pas.tipo,
        'status', pas.status,
        'valor', pas.valor,
        'taxa_embarque', pas.taxa_embarque,
        'taxaEmbarque', pas.taxa_embarque,
        'qr_token', pas.qr_token,
        'qrToken', pas.qr_token,
        'origem_ordem', pas.origem_ordem,
        'origemOrdem', pas.origem_ordem,
        'destino_ordem', pas.destino_ordem,
        'destinoOrdem', pas.destino_ordem,
        'assento_id', pas.assento_id,
        'assentoId', pas.assento_id,
        'assento', coalesce(a.codigo, 'COLO'),
        'assento_codigo', coalesce(a.codigo, 'COLO'),
        'embarcacao', emb.nome,
        'viagem_id', v.id,
        'viagemId', v.id,
        'saida', v.partida + (p_orig.minutos_desde_origem * interval '1 minute'),
        'chegada', v.partida + (p_dest.minutos_desde_origem * interval '1 minute'),
        'duracao_min', p_dest.minutos_desde_origem - p_orig.minutos_desde_origem,
        'duracaoMin', p_dest.minutos_desde_origem - p_orig.minutos_desde_origem,
        'origem_cidade', c_orig.nome,
        'origemCidade', c_orig.nome,
        'origem_uf', c_orig.uf,
        'origemUf', c_orig.uf,
        'origem_sigla', c_orig.sigla,
        'origemSigla', c_orig.sigla,
        'origem_porto', porto_orig.nome,
        'portoEmbarque', porto_orig.nome,
        'destino_cidade', c_dest.nome,
        'destinoCidade', c_dest.nome,
        'destino_uf', c_dest.uf,
        'destinoUf', c_dest.uf,
        'destino_sigla', c_dest.sigla,
        'destinoSigla', c_dest.sigla,
        'destino_porto', porto_dest.nome
      ) order by pas.created_at asc, pas.nome asc
    ),
    '[]'::jsonb
  )
  into v_passagens
  from public.passagens pas
  join public.viagens v on v.id = pas.viagem_id
  join public.embarcacoes emb on emb.id = v.embarcacao_id
  join public.paradas_linha p_orig on p_orig.linha_id = v.linha_id and p_orig.ordem = pas.origem_ordem
  join public.portos porto_orig on porto_orig.id = p_orig.porto_id
  join public.cidades c_orig on c_orig.id = porto_orig.cidade_id
  join public.paradas_linha p_dest on p_dest.linha_id = v.linha_id and p_dest.ordem = pas.destino_ordem
  join public.portos porto_dest on porto_dest.id = p_dest.porto_id
  join public.cidades c_dest on c_dest.id = porto_dest.cidade_id
  left join public.assentos a on a.id = pas.assento_id
  where pas.pedido_id = v_pedido.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', pg.id,
        'metodo', pg.metodo,
        'status', pg.status,
        'valor', pg.valor,
        'pix_copia_cola', pg.pix_copia_cola,
        'pixCopiaCola', pg.pix_copia_cola,
        'pago_em', pg.pago_em,
        'pagoEm', pg.pago_em
      ) order by pg.created_at asc
    ),
    '[]'::jsonb
  )
  into v_pagamentos
  from public.pagamentos pg
  where pg.pedido_id = v_pedido.id;

  v_pagamento_principal := coalesce(v_pagamentos->0, '{}'::jsonb);

  return jsonb_build_object(
    'id', v_pedido.id,
    'codigo', v_pedido.codigo,
    'numero', v_pedido.numero,
    'canal', v_pedido.canal,
    'status', v_pedido.status,
    'comprador_nome', v_pedido.comprador_nome,
    'compradorNome', v_pedido.comprador_nome,
    'comprador_email', v_pedido.comprador_email,
    'compradorEmail', v_pedido.comprador_email,
    'comprador_telefone', v_pedido.comprador_telefone,
    'compradorTelefone', v_pedido.comprador_telefone,
    'subtotal', v_pedido.subtotal,
    'taxas', v_pedido.taxas,
    'desconto', v_pedido.desconto,
    'total', v_pedido.total,
    'expira_em', v_pedido.expira_em,
    'expiraEm', v_pedido.expira_em,
    'created_at', v_pedido.created_at,
    'createdAt', v_pedido.created_at,
    'pagamentos', v_pagamentos,
    'pagamento', v_pagamento_principal,
    'passagens', v_passagens
  );
end;
$function$


CREATE OR REPLACE FUNCTION public.rastrear_encomenda(codigo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_encomenda record;
  v_eventos jsonb;
begin
  select
    e.id,
    e.codigo,
    e.status,
    e.volumes,
    e.peso_kg,
    e.frete,
    e.pagador,
    e.frete_pago,
    split_part(trim(e.destinatario_nome), ' ', 1) as destinatario_primeiro_nome,
    c_orig.nome as origem_cidade_nome,
    c_orig.sigla as origem_cidade_sigla,
    c_dest.nome as destino_cidade_nome,
    c_dest.sigla as destino_cidade_sigla
  into v_encomenda
  from public.encomendas e
  join public.cidades c_orig on c_orig.id = e.origem_cidade_id
  join public.cidades c_dest on c_dest.id = e.destino_cidade_id
  where upper(trim(e.codigo)) = upper(trim(rastrear_encomenda.codigo));

  if not found then
    return null;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'status', ev.status,
        'descricao', ev.descricao,
        'createdAt', ev.created_at,
        'created_at', ev.created_at
      ) order by ev.created_at asc
    ),
    '[]'::jsonb
  )
  into v_eventos
  from public.encomenda_eventos ev
  where ev.encomenda_id = v_encomenda.id;

  return jsonb_build_object(
    'codigo', v_encomenda.codigo,
    'status', v_encomenda.status,
    'origem_cidade', v_encomenda.origem_cidade_nome,
    'origemCidade', v_encomenda.origem_cidade_nome,
    'origem_sigla', v_encomenda.origem_cidade_sigla,
    'destino_cidade', v_encomenda.destino_cidade_nome,
    'destinoCidade', v_encomenda.destino_cidade_nome,
    'destino_sigla', v_encomenda.destino_cidade_sigla,
    'destinatario_primeiro_nome', v_encomenda.destinatario_primeiro_nome,
    'destinatarioPrimeiroNome', v_encomenda.destinatario_primeiro_nome,
    'destinatarioNome', v_encomenda.destinatario_primeiro_nome,
    'volumes', v_encomenda.volumes,
    'peso_kg', v_encomenda.peso_kg,
    'pesoKg', v_encomenda.peso_kg,
    'frete', v_encomenda.frete,
    'pagador', v_encomenda.pagador,
    'frete_pago', v_encomenda.frete_pago,
    'fretePago', v_encomenda.frete_pago,
    'eventos', v_eventos
  );
end;
$function$


-- 9. Grants de Execução Explícitos
-- ------------------------------------------------------------------------------
grant execute on function public.criar_pedido_site(jsonb) to anon, authenticated;
grant execute on function public.buscar_viagens(text, text, date) to anon, authenticated;
grant execute on function public.assentos_ocupados(uuid, int, int) to anon, authenticated;
grant execute on function public.pedido_publico(text) to anon, authenticated;
grant execute on function public.rastrear_encomenda(text) to anon, authenticated;
