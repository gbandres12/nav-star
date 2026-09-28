-- Caixa do balcão no banco (antes: protótipo em memória). Re-executável.
-- As tabelas só têm política de leitura; toda gravação passa por estas funções, que conferem quem opera:
--   abrir_caixa, movimentar_caixa (sangria/suprimento), fechar_caixa.
-- Regras: um caixa aberto por pessoa; venda em DINHEIRO no balcão exige caixa aberto; toda venda do balcão feita com
-- caixa aberto fica ligada a ele (pagamentos.caixa_id); sangria não pode deixar a gaveta negativa.

create unique index if not exists caixa_sessoes_um_aberto_por_usuario
  on public.caixa_sessoes (usuario_id) where fechado_em is null;

alter table public.caixa_movimentos drop constraint if exists caixa_movimentos_tipo_check;
alter table public.caixa_movimentos add constraint caixa_movimentos_tipo_check check (tipo in ('SANGRIA', 'SUPRIMENTO'));
alter table public.caixa_movimentos drop constraint if exists caixa_movimentos_valor_check;
alter table public.caixa_movimentos add constraint caixa_movimentos_valor_check check (valor > 0);

-- Dinheiro que deveria estar na gaveta: troco + vendas em dinheiro aprovadas + suprimentos − sangrias
create or replace function private.dinheiro_esperado(p_caixa_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select c.valor_abertura
    + coalesce((select sum(pg.valor) from public.pagamentos pg
                where pg.caixa_id = c.id and pg.metodo = 'DINHEIRO' and pg.status = 'APROVADO'), 0)
    + coalesce((select sum(m.valor) from public.caixa_movimentos m where m.caixa_id = c.id and m.tipo = 'SUPRIMENTO'), 0)
    - coalesce((select sum(m.valor) from public.caixa_movimentos m where m.caixa_id = c.id and m.tipo = 'SANGRIA'), 0)
  from public.caixa_sessoes c
  where c.id = p_caixa_id;
$$;

-- 1234.5 → "1.234,50" (mensagens de erro em pt-BR, independente do locale do servidor)
create or replace function private.reais(v numeric)
returns text
language sql
immutable
set search_path = ''
as $$
  select replace(replace(replace(to_char(round(v, 2), 'FM999,999,990.00'), ',', '#'), '.', ','), '#', '.');
$$;

-- Quem pode operar caixa: perfil ativo de balcão
create or replace function private.operador_de_caixa()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not (select private.tem_papel('VENDEDOR'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Seu perfil não opera caixa.';
  end if;
  return (select auth.uid());
end;
$$;

create or replace function public.abrir_caixa(p_valor_abertura numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := private.operador_de_caixa();
  v_id uuid;
begin
  if p_valor_abertura is null or p_valor_abertura < 0 then
    raise exception using errcode = 'P0001', message = 'Informe o troco inicial (zero ou mais).';
  end if;
  if exists (select 1 from public.caixa_sessoes where usuario_id = v_usuario and fechado_em is null) then
    raise exception using errcode = 'P0001', message = 'Você já tem um caixa aberto.';
  end if;
  insert into public.caixa_sessoes (usuario_id, valor_abertura)
  values (v_usuario, round(p_valor_abertura, 2))
  returning id into v_id;
  return jsonb_build_object('id', v_id);
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'Você já tem um caixa aberto.';
end;
$$;

create or replace function public.movimentar_caixa(p_tipo text, p_valor numeric, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := private.operador_de_caixa();
  v_caixa uuid;
begin
  select id into v_caixa from public.caixa_sessoes
  where usuario_id = v_usuario and fechado_em is null
  for update;
  if v_caixa is null then
    raise exception using errcode = 'P0001', message = 'Abra o seu caixa primeiro.';
  end if;
  if p_tipo not in ('SANGRIA', 'SUPRIMENTO') then
    raise exception using errcode = 'P0001', message = 'Tipo de movimento inválido.';
  end if;
  if p_valor is null or p_valor <= 0 then
    raise exception using errcode = 'P0001', message = 'Informe um valor maior que zero.';
  end if;
  if p_tipo = 'SANGRIA' and round(p_valor, 2) > private.dinheiro_esperado(v_caixa) then
    raise exception using errcode = 'P0001',
      message = format('A sangria (R$ %s) é maior que o dinheiro esperado na gaveta (R$ %s).',
                       private.reais(p_valor), private.reais(private.dinheiro_esperado(v_caixa)));
  end if;
  insert into public.caixa_movimentos (caixa_id, tipo, valor, observacao)
  values (v_caixa, p_tipo, round(p_valor, 2), coalesce(nullif(trim(p_observacao), ''), '—'));
  return jsonb_build_object('ok', true, 'esperado', private.dinheiro_esperado(v_caixa));
end;
$$;

create or replace function public.fechar_caixa(p_valor_contado numeric, p_observacao text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := private.operador_de_caixa();
  v_caixa uuid;
  v_esperado numeric;
begin
  if p_valor_contado is null or p_valor_contado < 0 then
    raise exception using errcode = 'P0001', message = 'Informe o dinheiro contado na gaveta.';
  end if;
  select id into v_caixa from public.caixa_sessoes
  where usuario_id = v_usuario and fechado_em is null
  for update;
  if v_caixa is null then
    raise exception using errcode = 'P0001', message = 'Nenhum caixa aberto.';
  end if;
  v_esperado := private.dinheiro_esperado(v_caixa);
  -- valor_fechamento e valor_contado guardam o que foi contado; a diferença sai de private.dinheiro_esperado
  update public.caixa_sessoes
  set fechado_em = now(),
      valor_fechamento = round(p_valor_contado, 2),
      valor_contado = round(p_valor_contado, 2),
      observacao = nullif(trim(p_observacao), ''),
      updated_at = now()
  where id = v_caixa;
  return jsonb_build_object('id', v_caixa, 'esperado', v_esperado, 'contado', round(p_valor_contado, 2),
                            'diferenca', round(p_valor_contado, 2) - v_esperado);
end;
$$;

-- Venda no balcão: igual à versão em produção, mais o caixa (exige caixa aberto para DINHEIRO e liga a venda ao caixa)
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

  -- Caixa do operador
  v_metodo := upper(trim(coalesce(payload->>'metodo', payload->>'metodo_pagamento', 'PIX')));
  select c.id into v_caixa from public.caixa_sessoes c where c.usuario_id = v_vendedor_id and c.fechado_em is null;
  if v_metodo = 'DINHEIRO' and v_caixa is null then
    raise exception using errcode = 'P0001', message = 'Abra o seu caixa antes de vender em dinheiro.';
  end if;

  v_res := private.criar_pedido(payload, v_canal, v_vendedor_id, v_agencia_id, true);

  if v_caixa is not null then
    update public.pagamentos set caixa_id = v_caixa where pedido_id = (v_res->>'id')::uuid;
  end if;

  return v_res;
end;
$function$;

revoke execute on function private.dinheiro_esperado(uuid) from public, anon, authenticated;
revoke execute on function private.reais(numeric) from public, anon, authenticated;
revoke execute on function private.operador_de_caixa() from public, anon, authenticated;
revoke execute on function public.abrir_caixa(numeric) from public, anon;
revoke execute on function public.movimentar_caixa(text, numeric, text) from public, anon;
revoke execute on function public.fechar_caixa(numeric, text) from public, anon;
revoke execute on function public.criar_pedido_balcao(jsonb) from public, anon;
grant execute on function public.abrir_caixa(numeric) to authenticated, service_role;
grant execute on function public.movimentar_caixa(text, numeric, text) to authenticated, service_role;
grant execute on function public.fechar_caixa(numeric, text) to authenticated, service_role;
grant execute on function public.criar_pedido_balcao(jsonb) to authenticated, service_role;
