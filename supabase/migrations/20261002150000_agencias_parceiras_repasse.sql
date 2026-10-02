-- Agências parceiras — Etapa 4: repasse a receber (baixa manual), transferência de bilhete e resumo por agência.
--
-- Status do bilhete:
--   EMITIDO     — emitido pela agência, titular original.
--   TRANSFERIDO — continua VÁLIDO, mas o titular foi trocado pela empresa (renegociado fora do sistema).
--   CANCELADO   — sem validade; a vaga voltou.
-- Repasse a receber = soma de valor_repasse dos bilhetes EMITIDO/TRANSFERIDO ainda sem baixa.

-- ------------------------------------------------------------------------------
-- 1. Gatilho de sincronia: cancelar a passagem cancela também o bilhete TRANSFERIDO
-- ------------------------------------------------------------------------------
create or replace function private.sincronizar_bilhete_agencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with b as (
    update public.bilhetes_agencia n
       set status = 'CANCELADO'
      from public.bilhetes_agencia o
     where o.id = n.id and n.passagem_id = new.id and n.status in ('EMITIDO', 'TRANSFERIDO')
    returning n.id, o.status as anterior   -- o.status = valor de antes da atualização
  )
  insert into public.bilhete_agencia_historico (bilhete_id, evento, status_anterior, status_novo, usuario_id, detalhe)
  select b.id, 'CANCELAMENTO_INTERNO', b.anterior, 'CANCELADO',
         (select p.id from public.perfis p where p.id = (select auth.uid())),
         jsonb_build_object('origem', 'sistema interno')
  from b;
  return null;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Baixa manual do repasse (e desfazer a baixa)
-- ------------------------------------------------------------------------------
create or replace function public.marcar_repasse_agencia(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_bilhete_ids uuid[],
  p_pago boolean,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_qtd integer;
  v_total numeric(12,2);
begin
  if p_bilhete_ids is null or coalesce(array_length(p_bilhete_ids, 1), 0) = 0 then
    raise exception using errcode = 'P0001', message = 'Selecione ao menos um bilhete.';
  end if;

  with alterados as (
    update public.bilhetes_agencia b
       set repasse_pago = p_pago,
           repasse_pago_em = case when p_pago then now() else null end
     where b.id = any(p_bilhete_ids)
       and b.empresa_id = p_empresa_id
       and b.repasse_pago <> p_pago
       and (not p_pago or b.status in ('EMITIDO', 'TRANSFERIDO'))   -- só se dá baixa em bilhete válido
    returning b.id, b.status, b.valor_repasse
  ), hist as (
    insert into public.bilhete_agencia_historico (bilhete_id, evento, status_anterior, status_novo, usuario_id, detalhe)
    select a.id, case when p_pago then 'REPASSE_BAIXADO' else 'BAIXA_DESFEITA' end, a.status, a.status,
           p_usuario_id, jsonb_build_object('valor', a.valor_repasse, 'observacao', nullif(trim(p_observacao), ''))
    from alterados a
    returning 1
  )
  select count(*)::integer, coalesce(sum(valor_repasse), 0) into v_qtd, v_total from alterados;

  return jsonb_build_object('quantidade', v_qtd, 'total', v_total);
end;
$function$;

-- ------------------------------------------------------------------------------
-- 3. Transferência de bilhete (troca de titular, feita pela empresa)
--    p_passageiro: { nome, documento, telefone, email, nascimento (AAAA-MM-DD), endereco, aceita_marketing }
-- ------------------------------------------------------------------------------
create or replace function public.transferir_bilhete_agencia(
  p_empresa_id uuid,
  p_usuario_id uuid,
  p_bilhete_id uuid,
  p_passageiro jsonb,
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_b record;
  v_pas record;
  v_antigo record;
  v_nome text := trim(coalesce(p_passageiro->>'nome', ''));
  v_doc_original text := trim(coalesce(p_passageiro->>'documento', ''));
  v_doc text := upper(regexp_replace(trim(coalesce(p_passageiro->>'documento', '')), '[^0-9A-Za-z]', '', 'g'));
  v_tel text := nullif(trim(coalesce(p_passageiro->>'telefone', '')), '');
  v_email text := nullif(lower(trim(coalesce(p_passageiro->>'email', ''))), '');
  v_endereco text := nullif(trim(coalesce(p_passageiro->>'endereco', '')), '');
  v_marketing boolean := coalesce((p_passageiro->>'aceita_marketing')::boolean, false);
  v_nasc date;
  v_passageiro_id uuid;
begin
  if length(v_nome) < 2 then
    raise exception using errcode = 'P0001', message = 'Nome do novo passageiro é obrigatório.';
  end if;
  if length(v_doc) < 3 then
    raise exception using errcode = 'P0001', message = 'Documento do novo passageiro é obrigatório.';
  end if;
  if v_tel is null and v_email is null then
    raise exception using errcode = 'P0001', message = 'Informe telefone ou e-mail do novo passageiro.';
  end if;
  if v_email is not null and position('@' in v_email) < 2 then
    raise exception using errcode = 'P0001', message = 'E-mail do novo passageiro inválido.';
  end if;
  begin
    v_nasc := (p_passageiro->>'nascimento')::date;
  exception when others then
    v_nasc := null;
  end;
  if v_nasc is null or v_nasc > current_date or v_nasc < date '1900-01-01' then
    raise exception using errcode = 'P0001', message = 'Data de nascimento do novo passageiro inválida.';
  end if;

  select b.id, b.passagem_id, b.passageiro_id, b.status into v_b
  from public.bilhetes_agencia b
  where b.id = p_bilhete_id and b.empresa_id = p_empresa_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Bilhete não encontrado.';
  end if;
  if v_b.status not in ('EMITIDO', 'TRANSFERIDO') then
    raise exception using errcode = 'P0001', message = 'Só é possível transferir bilhete válido.';
  end if;

  select pas.status, v.partida, pl.minutos_desde_origem into v_pas
  from public.passagens pas
  join public.viagens v on v.id = pas.viagem_id
  join public.paradas_linha pl on pl.linha_id = v.linha_id and pl.ordem = pas.origem_ordem
  where pas.id = v_b.passagem_id
  for update of pas;
  if v_pas.status <> 'EMITIDA' then
    raise exception using errcode = 'P0001', message = 'Este bilhete já embarcou ou não está mais ativo.';
  end if;
  if v_pas.partida + v_pas.minutos_desde_origem * interval '1 minute' <= now() then
    raise exception using errcode = 'P0001', message = 'A embarcação já saiu do embarque; não é mais possível transferir.';
  end if;

  select p.nome, p.documento, p.documento_original into v_antigo from public.passageiros p where p.id = v_b.passageiro_id;
  if v_antigo.documento = v_doc then
    raise exception using errcode = 'P0001', message = 'O novo passageiro tem o mesmo documento do atual.';
  end if;

  insert into public.passageiros (empresa_id, documento, documento_original, nome, telefone, email, nascimento, endereco, aceita_marketing)
  values (p_empresa_id, v_doc, v_doc_original, v_nome, v_tel, v_email, v_nasc, v_endereco, v_marketing)
  on conflict (empresa_id, documento) do update
    set nome = excluded.nome,
        telefone = coalesce(excluded.telefone, passageiros.telefone),
        email = coalesce(excluded.email, passageiros.email),
        nascimento = excluded.nascimento,
        endereco = coalesce(excluded.endereco, passageiros.endereco),
        aceita_marketing = excluded.aceita_marketing,
        updated_at = now()
  returning id into v_passageiro_id;

  -- A passagem (e seu QR) é a mesma; só muda quem viaja
  update public.passagens
     set nome = v_nome, documento = v_doc_original, nascimento = v_nasc::timestamptz, telefone = v_tel
   where id = v_b.passagem_id;
  update public.bilhetes_agencia set passageiro_id = v_passageiro_id, status = 'TRANSFERIDO' where id = v_b.id;

  insert into public.bilhete_agencia_historico (bilhete_id, evento, status_anterior, status_novo, usuario_id, detalhe)
  values (v_b.id, 'TRANSFERENCIA', v_b.status, 'TRANSFERIDO', p_usuario_id,
          jsonb_build_object('de', jsonb_build_object('nome', v_antigo.nome, 'documento', v_antigo.documento_original),
                             'para', jsonb_build_object('nome', v_nome, 'documento', v_doc_original),
                             'motivo', nullif(trim(p_motivo), '')));

  return jsonb_build_object('bilhete_id', v_b.id, 'status', 'TRANSFERIDO');
end;
$function$;

-- ------------------------------------------------------------------------------
-- 4. Resumo por agência (ADMIN/GERENTE, só da própria empresa)
--    Vendido/repasse/margem valem para o período (data de emissão); "a receber" é o saldo em aberto de sempre.
--    vendido = o que o passageiro pagou (valor cobrado + taxa); repasse = piso + taxa; margem = cobrado − piso.
-- ------------------------------------------------------------------------------
create or replace function public.resumo_agencias_parceiras(p_inicio timestamptz, p_fim timestamptz)
returns table (
  agencia_id uuid,
  bilhetes_periodo integer,
  vendido_periodo numeric,
  repasse_periodo numeric,
  margem_periodo numeric,
  a_receber numeric,
  a_receber_qtd integer,
  a_devolver numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id,
         (count(b.id) filter (where b.status <> 'CANCELADO' and b.created_at >= p_inicio and b.created_at < p_fim))::integer,
         coalesce(sum(b.valor_cobrado + b.taxa_embarque) filter (where b.status <> 'CANCELADO' and b.created_at >= p_inicio and b.created_at < p_fim), 0),
         coalesce(sum(b.valor_repasse) filter (where b.status <> 'CANCELADO' and b.created_at >= p_inicio and b.created_at < p_fim), 0),
         coalesce(sum(b.valor_cobrado - b.valor_piso) filter (where b.status <> 'CANCELADO' and b.created_at >= p_inicio and b.created_at < p_fim), 0),
         coalesce(sum(b.valor_repasse) filter (where b.status in ('EMITIDO', 'TRANSFERIDO') and not b.repasse_pago), 0),
         (count(b.id) filter (where b.status in ('EMITIDO', 'TRANSFERIDO') and not b.repasse_pago))::integer,
         -- baixa dada e bilhete cancelado depois: a empresa deve este valor à agência
         coalesce(sum(b.valor_repasse) filter (where b.status = 'CANCELADO' and b.repasse_pago), 0)
  from public.agencias_parceiras a
  left join public.bilhetes_agencia b on b.agencia_id = a.id
  where a.empresa_id = (select private.empresa_atual())
    and private.tem_papel('ADMIN', 'GERENTE')
  group by a.id;
$$;

-- ------------------------------------------------------------------------------
-- 5. Permissões
-- ------------------------------------------------------------------------------
revoke execute on function
  public.marcar_repasse_agencia(uuid, uuid, uuid[], boolean, text),
  public.transferir_bilhete_agencia(uuid, uuid, uuid, jsonb, text),
  public.resumo_agencias_parceiras(timestamptz, timestamptz)
from public, anon, authenticated;

grant execute on function
  public.marcar_repasse_agencia(uuid, uuid, uuid[], boolean, text),
  public.transferir_bilhete_agencia(uuid, uuid, uuid, jsonb, text)
to service_role;

-- O resumo é lido pela sessão do operador; a própria função confere papel e empresa
grant execute on function public.resumo_agencias_parceiras(timestamptz, timestamptz) to authenticated;
