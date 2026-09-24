-- PIX com conferência manual (sem gateway): a empresa cadastra a chave no painel, o site gera o QR com valor e código
-- do pedido, o cliente avisa que pagou e a equipe confirma no painel. Re-executável.

-- 1. Dados do recebedor PIX (lidos só pelo servidor; o site nunca consulta esta tabela direto)
alter table public.empresas add column if not exists pix_tipo text;
alter table public.empresas add column if not exists pix_chave text;
alter table public.empresas add column if not exists pix_nome text;
alter table public.empresas add column if not exists pix_cidade text;
-- Quanto tempo a reserva fica segura depois que o cliente avisa "já paguei", à espera da conferência
alter table public.empresas add column if not exists horas_confirmacao_pix integer not null default 6;

alter table public.empresas drop constraint if exists empresas_pix_tipo_check;
alter table public.empresas add constraint empresas_pix_tipo_check
  check (pix_tipo is null or pix_tipo in ('CPF', 'CNPJ', 'EMAIL', 'TELEFONE', 'ALEATORIA'));
alter table public.empresas drop constraint if exists empresas_horas_confirmacao_pix_check;
alter table public.empresas add constraint empresas_horas_confirmacao_pix_check
  check (horas_confirmacao_pix between 1 and 48);

-- 2. Momento em que o cliente avisou que pagou
alter table public.pedidos add column if not exists pagamento_informado_em timestamptz;

-- 3. "Já paguei": estende a reserva até a conferência (limite: 1 h antes da primeira saída do pedido)
create or replace function public.informar_pagamento(codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_horas integer;
  v_partida timestamptz;
  v_novo timestamptz;
begin
  perform private.expirar_pedidos();

  select p.* into v_pedido
  from public.pedidos p
  where upper(trim(p.codigo)) = upper(trim(informar_pagamento.codigo))
  for update;

  if v_pedido.id is null then
    raise exception using errcode = 'P0001', message = 'Pedido não encontrado.';
  end if;

  if v_pedido.status <> 'AGUARDANDO_PAGAMENTO' then
    return jsonb_build_object('ok', v_pedido.status = 'PAGO', 'status', v_pedido.status);
  end if;

  -- Idempotente: avisar duas vezes não estende de novo
  if v_pedido.pagamento_informado_em is not null then
    return jsonb_build_object('ok', true, 'status', v_pedido.status, 'expira_em', v_pedido.expira_em);
  end if;

  select coalesce(e.horas_confirmacao_pix, 6) into v_horas from public.empresas e where e.id = v_pedido.empresa_id;
  select min(v.partida) into v_partida
  from public.passagens pas join public.viagens v on v.id = pas.viagem_id
  where pas.pedido_id = v_pedido.id;

  v_novo := least(now() + v_horas * interval '1 hour', coalesce(v_partida, now()) - interval '1 hour');
  update public.pedidos
  set pagamento_informado_em = now(),
      expira_em = greatest(expira_em, v_novo),
      updated_at = now()
  where id = v_pedido.id
  returning expira_em into v_novo;

  return jsonb_build_object('ok', true, 'status', 'AGUARDANDO_PAGAMENTO', 'expira_em', v_novo);
end;
$$;

revoke execute on function public.informar_pagamento(text) from public;
grant execute on function public.informar_pagamento(text) to anon, authenticated, service_role;

-- 4. pedido_publico passa a informar se o cliente já avisou o pagamento (resto igual à versão em produção)
create or replace function public.pedido_publico(codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_pedido record;
  v_passagens jsonb;
  v_pagamentos jsonb;
  v_pagamento_principal jsonb;
begin
  perform private.expirar_pedidos();

  select
    p.id, p.empresa_id, p.codigo, p.numero, p.canal, p.status,
    p.comprador_nome, p.comprador_email, p.comprador_telefone,
    p.subtotal, p.taxas, p.desconto, p.total, p.expira_em, p.created_at, p.pagamento_informado_em
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
    'pagamento_informado_em', v_pedido.pagamento_informado_em,
    'pagamentoInformadoEm', v_pedido.pagamento_informado_em,
    'created_at', v_pedido.created_at,
    'createdAt', v_pedido.created_at,
    'pagamentos', v_pagamentos,
    'pagamento', v_pagamento_principal,
    'passagens', v_passagens
  );
end;
$function$;

revoke execute on function public.pedido_publico(text) from public;
grant execute on function public.pedido_publico(text) to anon, authenticated, service_role;
