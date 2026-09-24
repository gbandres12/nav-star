-- Lotação por trecho contando criança de colo (regra do usuário, 24/09): colo não ocupa poltrona, mas conta na lotação
-- de passageiros da embarcação. Re-executável. Igual à versão em produção de private.criar_pedido, com 4 mudanças
-- marcadas "MUDANÇA":
--   1. trava a viagem (FOR UPDATE): vendas da mesma viagem entram uma de cada vez — a contagem não "fura" com vendas
--      simultâneas e a escolha automática de poltrona deixa de colidir;
--   2. confere a lotação trecho a trecho: pessoas a bordo (com e sem poltrona) + novas <= capacidade_passageiros;
--   3. criança de colo precisa de um adulto no mesmo pedido;
--   4. deixa de gravar o PIX "navstar-demo" falso (o QR real é gerado pelo site a partir da chave cadastrada).

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
as $function$
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
  -- MUDANÇA 2 e 3
  v_capacidade integer;
  v_ocupados_max integer;
  v_qtd_colo integer := 0;

  v_itens_jsonb jsonb := '[]'::jsonb;
  v_item_jsonb jsonb;
begin
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

  begin
    v_metodo := upper(trim(coalesce(payload->>'metodo', payload->>'metodo_pagamento', 'PIX')))::public.metodo_pagamento;
  exception when others then
    v_metodo := 'PIX'::public.metodo_pagamento;
  end;

  -- MUDANÇA 1: trava a viagem até o fim da transação
  select v.id, v.empresa_id, v.linha_id, v.embarcacao_id, v.partida, v.status, v.vendas_abertas
  into v_viagem
  from public.viagens v
  where v.id = v_viagem_id
  for update;

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

  select coalesce(p.taxa_embarque, 0.00), c.sigla
  into v_taxa_embarque_unit, v_origem_cidade_sigla
  from public.portos p
  join public.cidades c on c.id = p.cidade_id
  where p.id = v_origem_porto_id;

  select valor
  into v_tarifa_base
  from public.tarifas_trecho
  where linha_id = v_viagem.linha_id
    and origem_parada_id = v_origem_parada_id
    and destino_parada_id = v_destino_parada_id;

  if v_tarifa_base is null then
    raise exception using errcode = 'P0001', message = 'Tarifa não cadastrada para o trecho selecionado.';
  end if;

  perform private.expirar_pedidos();

  v_passageiros_json := coalesce(payload->'passageiros', '[]'::jsonb);
  v_qtd_passageiros := jsonb_array_length(v_passageiros_json);

  if v_qtd_passageiros = 0 then
    raise exception using errcode = 'P0001', message = 'Selecione ao menos um assento / passageiro.';
  end if;

  -- MUDANÇA 2: lotação da embarcação em cada trecho percorrido, contando quem não tem poltrona (colo)
  select e.capacidade_passageiros into v_capacidade
  from public.embarcacoes e where e.id = v_viagem.embarcacao_id;

  select coalesce(max(t.n), 0) into v_ocupados_max
  from (
    select count(pas.id) as n
    from generate_series(v_origem_ordem, v_destino_ordem - 1) as s(ordem)
    left join public.passagens pas
      on pas.viagem_id = v_viagem.id
     and pas.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
     and pas.trecho @> s.ordem
    group by s.ordem
  ) t;

  if v_capacidade is not null and v_ocupados_max + v_qtd_passageiros > v_capacidade then
    raise exception using errcode = 'P0001',
      message = format('Lotação máxima da embarcação atingida neste trecho: restam %s lugar(es), incluindo crianças de colo.',
                       greatest(v_capacidade - v_ocupados_max, 0));
  end if;

  select coalesce(minutos_reserva_site, 30)
  into v_minutos_reserva
  from public.empresas
  where id = v_viagem.empresa_id;

  if p_agencia_id is not null then
    select coalesce(comissao_percentual, 0.00)
    into v_comissao_pct
    from public.agencias
    where id = p_agencia_id and ativa = true;
  else
    v_comissao_pct := 0.00;
  end if;

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

    select coalesce(percentual, 0.00)
    into v_desc_pct
    from public.descontos_tipo_passageiro
    where tipo = v_p_tipo;

    if not found then
      v_desc_pct := 0.00;
    end if;

    v_p_valor := round(v_tarifa_base * (1.00 - (v_desc_pct / 100.00)), 2);

    if v_p_tipo = 'COLO' then
      v_qtd_colo := v_qtd_colo + 1; -- MUDANÇA 3
      v_p_assento_id := null;
      v_p_taxa := 0.00;
    else
      v_p_taxa := v_taxa_embarque_unit;
      v_p_assento_id := coalesce(
        nullif(v_p->>'assento_id', '')::uuid,
        nullif(v_p->>'assentoId', '')::uuid
      );

      if v_p_assento_id is not null then
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

    v_item_jsonb := jsonb_build_object(
      'nome', v_p_nome,
      'documento', v_p_documento,
      'telefone', v_p_telefone,
      'tipo', v_p_tipo,
      'assento_id', v_p_assento_id,
      'valor', v_p_valor,
      'taxa', v_p_taxa
    );
    v_itens_jsonb := v_itens_jsonb || jsonb_build_array(v_item_jsonb);
  end loop;

  -- MUDANÇA 3: cada criança de colo vai no colo de um adulto do mesmo pedido
  if v_qtd_colo > v_qtd_passageiros - v_qtd_colo then
    raise exception using errcode = 'P0001', message = 'Cada criança de colo precisa de um adulto com poltrona no mesmo pedido.';
  end if;

  v_total := v_subtotal + v_taxas;
  v_comissao_agencia := round(v_subtotal * (v_comissao_pct / 100.00), 2);

  v_pedido_id := gen_random_uuid();

  v_codigo := private.gerar_codigo('ST', 6);
  while exists (select 1 from public.pedidos where codigo = v_codigo) loop
    v_codigo := private.gerar_codigo('ST', 6);
  end loop;

  v_numero := coalesce(v_origem_cidade_sigla, 'NAV') || '-' ||
              to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.pedido_numero_seq'::regclass)::text, 4, '0');
  while exists (select 1 from public.pedidos where numero = v_numero) loop
    v_numero := coalesce(v_origem_cidade_sigla, 'NAV') || '-' ||
                to_char(now(), 'YYYY') || '-' ||
                lpad(nextval('public.pedido_numero_seq'::regclass)::text, 4, '0');
  end loop;

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

  begin
    insert into public.pedidos (
      id, empresa_id, codigo, numero, canal, status,
      comprador_nome, comprador_email, comprador_telefone,
      vendedor_id, agencia_id, subtotal, taxas, desconto, total, comissao_agencia,
      expira_em, created_at, updated_at
    ) values (
      v_pedido_id, v_viagem.empresa_id, v_codigo, v_numero, p_canal, v_status_ped,
      v_comprador_nome, v_comprador_email, v_comprador_telefone,
      p_vendedor_id, p_agencia_id, v_subtotal, v_taxas, 0.00, v_total, v_comissao_agencia,
      v_expira_em, now(), now()
    );

    for i in 0..(jsonb_array_length(v_itens_jsonb) - 1) loop
      v_item_jsonb := v_itens_jsonb->i;

      v_qr_token := private.gerar_codigo('QR', 12);
      while exists (select 1 from public.passagens where qr_token = v_qr_token) loop
        v_qr_token := private.gerar_codigo('QR', 12);
      end loop;

      insert into public.passagens (
        empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem,
        nome, documento, telefone, tipo, valor, taxa_embarque, status, qr_token, created_at, updated_at
      ) values (
        v_viagem.empresa_id,
        v_pedido_id,
        v_viagem.id,
        nullif(v_item_jsonb->>'assento_id', '')::uuid,
        v_origem_ordem,
        v_destino_ordem,
        v_item_jsonb->>'nome',
        v_item_jsonb->>'documento',
        v_item_jsonb->>'telefone',
        (v_item_jsonb->>'tipo')::public.tipo_passageiro,
        (v_item_jsonb->>'valor')::numeric,
        (v_item_jsonb->>'taxa')::numeric,
        v_status_pas,
        v_qr_token,
        now(),
        now()
      );
    end loop;

    insert into public.pagamentos (
      empresa_id, pedido_id, metodo, status, valor, parcelas, pix_copia_cola, pago_em, created_at, updated_at
    ) values (
      v_viagem.empresa_id,
      v_pedido_id,
      v_metodo,
      v_status_pag,
      v_total,
      1,
      null, -- MUDANÇA 4
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
$function$;

revoke execute on function private.criar_pedido(jsonb, public.canal_venda, uuid, uuid, boolean) from public, anon, authenticated;
