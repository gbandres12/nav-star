-- Emissão no balcão. Re-executável.
-- 1. Venda de balcão sem telefone do comprador: o telefone é opcional no guichê; grava "Não informado" em vez de recusar
--    (private.criar_pedido exige 5+ caracteres, regra que continua valendo para o site).
-- 2. Vias impressas: registrar_impressao soma uma via às passagens emitidas do pedido; a partir da segunda impressão
--    o bilhete sai marcado "2ª VIA". Só conta impressão feita pela empresa (perfis de balcão), não a do passageiro.

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

  -- Caixa do operador
  v_metodo := upper(trim(coalesce(payload->>'metodo', payload->>'metodo_pagamento', 'PIX')));
  select c.id into v_caixa from public.caixa_sessoes c where c.usuario_id = v_vendedor_id and c.fechado_em is null;
  if v_metodo = 'DINHEIRO' and v_caixa is null then
    raise exception using errcode = 'P0001', message = 'Abra o seu caixa antes de vender em dinheiro.';
  end if;

  v_res := private.criar_pedido(v_payload, v_canal, v_vendedor_id, v_agencia_id, true);

  if v_caixa is not null then
    update public.pagamentos set caixa_id = v_caixa where pedido_id = (v_res->>'id')::uuid;
  end if;

  return v_res;
end;
$function$;

create or replace function public.registrar_impressao(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_vias integer;
begin
  if not (select private.tem_papel('VENDEDOR'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Só a equipe de balcão registra impressão.';
  end if;
  select * into v_pedido from public.pedidos p where upper(trim(p.codigo)) = upper(trim(p_codigo));
  if v_pedido.id is null or v_pedido.empresa_id <> (select private.empresa_atual()) then
    raise exception using errcode = 'P0001', message = 'Pedido não encontrado.';
  end if;
  if v_pedido.status <> 'PAGO' then
    raise exception using errcode = 'P0001', message = 'Bilhete só é impresso depois do pagamento.';
  end if;
  update public.passagens
  set impressoes = impressoes + 1, updated_at = now()
  where pedido_id = v_pedido.id and status in ('EMITIDA', 'EMBARCADA');
  select coalesce(max(impressoes), 0) into v_vias from public.passagens where pedido_id = v_pedido.id;
  return jsonb_build_object('ok', true, 'vias', v_vias);
end;
$$;

revoke execute on function public.criar_pedido_balcao(jsonb) from public, anon;
revoke execute on function public.registrar_impressao(text) from public, anon;
grant execute on function public.criar_pedido_balcao(jsonb) to authenticated, service_role;
grant execute on function public.registrar_impressao(text) to authenticated, service_role;
