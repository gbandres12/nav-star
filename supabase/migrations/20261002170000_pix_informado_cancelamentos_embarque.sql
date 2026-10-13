-- Lote operacional: PIX informado não solta poltrona; cancelamento grava multa;
-- embarque QR amarrado à viagem selecionada. Re-executável.

-- 1. Expiração: pedido com "já paguei" fica AGUARDANDO_PAGAMENTO (poltronas presas)
--    até a equipe confirmar ou cancelar. Sem pagamento informado, o prazo continua valendo.
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
  with expirados as (
    update public.pedidos
    set status = 'EXPIRADO',
        updated_at = now()
    where status = 'AGUARDANDO_PAGAMENTO'
      and expira_em is not null
      and expira_em <= now()
      and pagamento_informado_em is null
    returning id
  )
  select coalesce(array_agg(id), array[]::uuid[])
  into v_expirados_ids
  from expirados;

  v_count := coalesce(array_length(v_expirados_ids, 1), 0);

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

-- 2. Cancelamento registra motivo, valor pago, multa e reembolso em cancelamentos.
--    Mantém a trava pela saída da parada de embarque (não pela origem da linha).
create or replace function public.cancelar_pedido(codigo text, motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_eh_gestao boolean;
  v_novo_status_ped public.status_pedido;
  v_novo_status_pag public.status_pagamento;
  v_empresa_solicitante uuid;
  v_passagem_ids uuid[];
  v_metodo public.metodo_pagamento;
  v_pct numeric(5, 2);
  v_horas_sem integer;
  v_saida timestamptz;
  v_valor_pago numeric(10, 2);
  v_multa numeric(10, 2);
  v_reembolso numeric(10, 2);
  v_motivo text;
begin
  if not (select private.tem_papel('GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario, 'VENDEDOR'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para cancelamento de pedidos.';
  end if;

  if cancelar_pedido.codigo is null or length(trim(cancelar_pedido.codigo)) = 0 then
    raise exception using errcode = 'P0001', message = 'Código do pedido é obrigatório.';
  end if;

  select p.*
  into v_pedido
  from public.pedidos p
  where upper(trim(p.codigo)) = upper(trim(cancelar_pedido.codigo))
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Pedido não encontrado.';
  end if;

  v_empresa_solicitante := (select private.empresa_atual());
  if v_empresa_solicitante is not null and v_pedido.empresa_id <> v_empresa_solicitante then
    raise exception using errcode = 'P0001', message = 'Pedido pertence a outra empresa.';
  end if;

  v_eh_gestao := (select private.tem_papel('GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario));
  if not v_eh_gestao then
    if v_pedido.vendedor_id is distinct from (select auth.uid()) then
      raise exception using errcode = 'P0001', message = 'Vendedores só podem cancelar seus próprios pedidos.';
    end if;
    if v_pedido.status <> 'AGUARDANDO_PAGAMENTO' then
      raise exception using errcode = 'P0001', message = 'Vendedores só podem cancelar pedidos com pagamento pendente.';
    end if;
  end if;

  if v_pedido.status in ('CANCELADO', 'EXPIRADO', 'REEMBOLSADO') then
    raise exception using errcode = 'P0001', message = 'Pedido já finalizado ou cancelado com status ' || v_pedido.status::text || '.';
  end if;

  if exists (
    select 1
    from public.passagens pas
    where pas.pedido_id = v_pedido.id
      and pas.status = 'EMBARCADA'
  ) then
    raise exception using errcode = 'P0001', message = 'Não é possível cancelar pedido com passagem já embarcada.';
  end if;

  if exists (
    select 1
    from public.passagens pas
    join public.viagens v on v.id = pas.viagem_id
    join public.paradas_linha pl on pl.linha_id = v.linha_id and pl.ordem = pas.origem_ordem
    where pas.pedido_id = v_pedido.id
      and pas.status in ('RESERVADA', 'EMITIDA')
      and v.partida + pl.minutos_desde_origem * interval '1 minute' <= now()
  ) then
    raise exception using errcode = 'P0001', message = 'A embarcação já partiu; não é possível cancelar o pedido.';
  end if;

  v_motivo := nullif(trim(cancelar_pedido.motivo), '');
  if v_motivo is null then
    v_motivo := 'Não informado';
  end if;

  select coalesce(array_agg(pas.id), array[]::uuid[])
  into v_passagem_ids
  from public.passagens pas
  where pas.pedido_id = v_pedido.id
    and pas.status in ('RESERVADA', 'EMITIDA');

  select pag.metodo
  into v_metodo
  from public.pagamentos pag
  where pag.pedido_id = v_pedido.id
  order by pag.created_at
  limit 1;

  select coalesce(e.multa_cancelamento_pct, 10), coalesce(e.horas_cancelamento_sem_multa, 24)
  into v_pct, v_horas_sem
  from public.empresas e
  where e.id = v_pedido.empresa_id;

  select min(v.partida + pl.minutos_desde_origem * interval '1 minute')
  into v_saida
  from public.passagens pas
  join public.viagens v on v.id = pas.viagem_id
  join public.paradas_linha pl on pl.linha_id = v.linha_id and pl.ordem = pas.origem_ordem
  where pas.pedido_id = v_pedido.id
    and pas.status in ('RESERVADA', 'EMITIDA');

  if v_pedido.status = 'AGUARDANDO_PAGAMENTO' or v_metodo = 'FATURADO' then
    v_valor_pago := 0;
    v_multa := 0;
    v_reembolso := 0;
  else
    v_valor_pago := coalesce(v_pedido.total, 0);
    if v_saida is not null and v_saida - now() >= make_interval(hours => v_horas_sem) then
      v_multa := 0;
    else
      v_multa := round(v_valor_pago * v_pct / 100, 2);
    end if;
    v_reembolso := greatest(v_valor_pago - v_multa, 0);
  end if;

  if v_pedido.status = 'AGUARDANDO_PAGAMENTO' then
    v_novo_status_ped := 'CANCELADO'::public.status_pedido;
    v_novo_status_pag := 'RECUSADO'::public.status_pagamento;
  elsif v_pedido.status = 'PAGO' then
    v_novo_status_ped := 'REEMBOLSADO'::public.status_pedido;
    v_novo_status_pag := 'ESTORNADO'::public.status_pagamento;
  end if;

  update public.pedidos
  set status = v_novo_status_ped,
      expira_em = null,
      updated_at = now()
  where pedidos.id = v_pedido.id;

  update public.pagamentos
  set status = v_novo_status_pag,
      updated_at = now()
  where pagamentos.pedido_id = v_pedido.id;

  update public.passagens
  set status = 'CANCELADA',
      updated_at = now()
  where passagens.pedido_id = v_pedido.id
    and passagens.status in ('RESERVADA', 'EMITIDA');

  insert into public.cancelamentos (
    empresa_id, pedido_id, passagem_ids, motivo, valor_pago, multa, reembolso, usuario_id
  ) values (
    v_pedido.empresa_id, v_pedido.id, v_passagem_ids, v_motivo, v_valor_pago, v_multa, v_reembolso, (select auth.uid())
  );

  return jsonb_build_object(
    'ok', true,
    'codigo', v_pedido.codigo,
    'status_anterior', v_pedido.status,
    'novo_status', v_novo_status_ped,
    'motivo', v_motivo,
    'valor_pago', v_valor_pago,
    'multa', v_multa,
    'reembolso', v_reembolso
  );
end;
$$;

revoke execute on function public.cancelar_pedido(text, text) from public, anon;
grant execute on function public.cancelar_pedido(text, text) to authenticated, service_role;

-- 3. Embarque: o conferente escolhe a viagem; bilhete de outra saída é recusado.
drop function if exists public.validar_embarque(text);
drop function if exists public.validar_embarque(text, uuid);

create function public.validar_embarque(qr_token text, p_viagem_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pas record;
  v_agora timestamptz;
  v_linha_nome text;
  v_assento_codigo text;
  v_origem_cidade text;
  v_origem_porto text;
  v_destino_cidade text;
  v_destino_porto text;
  v_empresa_solicitante uuid;
begin
  if not (select private.tem_papel('CONFERENTE'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para validação de embarque.';
  end if;

  if validar_embarque.p_viagem_id is null then
    raise exception using errcode = 'P0001', message = 'Selecione a viagem deste embarque antes de ler o QR.';
  end if;

  if validar_embarque.qr_token is null or length(trim(validar_embarque.qr_token)) = 0 then
    raise exception using errcode = 'P0001', message = 'Token QR do bilhete é obrigatório.';
  end if;

  select pas.*,
         v.linha_id,
         v.embarcacao_id,
         v.partida as viagem_partida,
         v.status as viagem_status,
         v.empresa_id as viagem_empresa_id
  into v_pas
  from public.passagens pas
  join public.viagens v on v.id = pas.viagem_id
  where upper(trim(pas.qr_token)) = upper(trim(validar_embarque.qr_token))
  for update of pas;

  if not found then
    raise exception using errcode = 'P0001', message = 'Bilhete não encontrado.';
  end if;

  v_empresa_solicitante := (select private.empresa_atual());
  if v_empresa_solicitante is not null and v_pas.viagem_empresa_id <> v_empresa_solicitante then
    raise exception using errcode = 'P0001', message = 'Bilhete pertence a outra empresa.';
  end if;

  if v_pas.viagem_id is distinct from validar_embarque.p_viagem_id then
    raise exception using errcode = 'P0001', message = 'Este bilhete é de outra viagem. Confira a saída selecionada.';
  end if;

  if v_pas.status = 'CANCELADA' then
    raise exception using errcode = 'P0001', message = 'Bilhete cancelado. Embarque não permitido.';
  end if;

  if v_pas.status = 'RESERVADA' then
    raise exception using errcode = 'P0001', message = 'Bilhete com pagamento pendente. Embarque não permitido.';
  end if;

  if v_pas.status = 'EMBARCADA' then
    raise exception using errcode = 'P0001',
      message = 'Bilhete já utilizado. Embarque realizado em ' ||
                to_char(v_pas.embarcado_em at time zone 'America/Manaus', 'DD/MM/YYYY às HH24:MI') || '.';
  end if;

  if v_pas.viagem_status = 'CANCELADA' then
    raise exception using errcode = 'P0001', message = 'A viagem associada a este bilhete foi cancelada.';
  end if;

  if v_pas.viagem_status = 'CONCLUIDA' then
    raise exception using errcode = 'P0001', message = 'A viagem associada a este bilhete já foi concluída.';
  end if;

  if v_pas.status <> 'EMITIDA' then
    raise exception using errcode = 'P0001', message = 'Status do bilhete inválido para embarque: ' || v_pas.status::text || '.';
  end if;

  v_agora := now();
  update public.passagens
  set status = 'EMBARCADA',
      embarcado_em = v_agora,
      validado_por_id = (select auth.uid()),
      updated_at = v_agora
  where passagens.id = v_pas.id;

  select l.nome into v_linha_nome
  from public.linhas l
  where l.id = v_pas.linha_id;

  select a.codigo into v_assento_codigo
  from public.assentos a
  where a.id = v_pas.assento_id;

  select c.nome, p.nome
  into v_origem_cidade, v_origem_porto
  from public.paradas_linha pl
  join public.portos p on p.id = pl.porto_id
  join public.cidades c on c.id = p.cidade_id
  where pl.linha_id = v_pas.linha_id and pl.ordem = v_pas.origem_ordem;

  select c.nome, p.nome
  into v_destino_cidade, v_destino_porto
  from public.paradas_linha pl
  join public.portos p on p.id = pl.porto_id
  join public.cidades c on c.id = p.cidade_id
  where pl.linha_id = v_pas.linha_id and pl.ordem = v_pas.destino_ordem;

  return jsonb_build_object(
    'ok', true,
    'passagem_id', v_pas.id,
    'status', 'EMBARCADA',
    'embarcado_em', v_agora,
    'embarcado_em_manaus', to_char(v_agora at time zone 'America/Manaus', 'DD/MM/YYYY HH24:MI'),
    'passageiro', jsonb_build_object(
      'nome', v_pas.nome,
      'documento', v_pas.documento,
      'tipo', v_pas.tipo
    ),
    'assento', coalesce(v_assento_codigo, 'Livre'),
    'linha', v_linha_nome,
    'viagem_id', v_pas.viagem_id,
    'trecho', jsonb_build_object(
      'origem_ordem', v_pas.origem_ordem,
      'origem_cidade', v_origem_cidade,
      'origem_porto', v_origem_porto,
      'destino_ordem', v_pas.destino_ordem,
      'destino_cidade', v_destino_cidade,
      'destino_porto', v_destino_porto
    )
  );
end;
$$;

revoke execute on function public.validar_embarque(text, uuid) from public, anon;
grant execute on function public.validar_embarque(text, uuid) to authenticated, service_role;

-- 4. PIX no balcão: o pedido nasce aguardando conferência para o QR poder usar o código
--    real (txid). Dinheiro, cartão e convênio faturado continuam emitidos na hora.
create or replace function public.criar_pedido_balcao(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_vendedor_id uuid;
  v_agencia_id uuid;
  v_empresa_id uuid;
  v_ativo boolean;
  v_canal public.canal_venda;
  v_viagem_id uuid;
  v_linha_id uuid;
  v_metodo text;
  v_caixa uuid;
  v_res jsonb;
  v_payload jsonb := payload;
  v_pago_no_ato boolean;
begin
  if not (select private.tem_papel('VENDEDOR'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para criação de pedido no balcão.';
  end if;

  v_vendedor_id := (select auth.uid());
  select p.agencia_id, p.empresa_id, p.ativo
  into v_agencia_id, v_empresa_id, v_ativo
  from public.perfis p
  where p.id = v_vendedor_id;

  if not found or not coalesce(v_ativo, false) then
    raise exception using errcode = 'P0001', message = 'Perfil do operador não encontrado ou inativo.';
  end if;

  if v_agencia_id is not null then
    v_canal := 'AGENCIA'::public.canal_venda;
  else
    v_canal := 'BALCAO'::public.canal_venda;
  end if;

  v_viagem_id := coalesce(nullif(payload->>'viagem_id', '')::uuid, nullif(payload->>'viagemId', '')::uuid);
  if v_viagem_id is null then
    raise exception using errcode = 'P0001', message = 'Viagem não informada no pedido.';
  end if;

  select v.linha_id into v_linha_id from public.viagens v where v.id = v_viagem_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'Viagem informada não foi encontrada.';
  end if;

  if exists (select 1 from public.perfis_linhas pl where pl.perfil_id = v_vendedor_id) then
    if not exists (select 1 from public.perfis_linhas pl where pl.perfil_id = v_vendedor_id and pl.linha_id = v_linha_id) then
      raise exception using errcode = 'P0001', message = 'Vendedor não possui permissão para emitir passagens nesta linha.';
    end if;
  end if;

  -- Telefone do comprador é opcional no balcão
  if length(trim(coalesce(payload->'comprador'->>'telefone', payload->>'comprador_telefone', payload->>'compradorTelefone', ''))) < 5 then
    v_payload := ((payload #- '{comprador,telefone}') - 'compradorTelefone') || jsonb_build_object('comprador_telefone', 'Não informado');
  end if;

  v_metodo := upper(trim(coalesce(payload->>'metodo', payload->>'metodo_pagamento', 'PIX')));
  select c.id into v_caixa from public.caixa_sessoes c where c.usuario_id = v_vendedor_id and c.fechado_em is null;
  if v_metodo = 'DINHEIRO' and v_caixa is null then
    raise exception using errcode = 'P0001', message = 'Abra o seu caixa antes de vender em dinheiro.';
  end if;

  -- PIX: reserva as poltronas e espera conferência. Demais métodos emitem na hora.
  v_pago_no_ato := v_metodo <> 'PIX';
  v_res := private.criar_pedido(v_payload, v_canal, v_vendedor_id, v_agencia_id, v_pago_no_ato);

  if v_caixa is not null then
    update public.pagamentos set caixa_id = v_caixa where pedido_id = (v_res->>'id')::uuid;
  end if;

  return v_res;
end;
$function$;

revoke execute on function public.criar_pedido_balcao(jsonb) from public, anon;
grant execute on function public.criar_pedido_balcao(jsonb) to authenticated, service_role;
