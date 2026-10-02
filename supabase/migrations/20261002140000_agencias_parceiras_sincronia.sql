-- Agências parceiras — Etapa 3: consistência quando a passagem é cancelada pelo sistema interno.
--
-- O gestor pode cancelar o pedido de uma agência pelas telas e funções que já existem (cancelar_pedido).
-- Esse caminho só cancela pedido e passagem; sem este gatilho o bilhete da agência continuaria EMITIDO.
-- O gatilho marca o bilhete como CANCELADO e registra no histórico.
-- (Único ponto em que esta série de migrações toca uma tabela existente: um gatilho em public.passagens.)

create or replace function private.sincronizar_bilhete_agencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  with b as (
    update public.bilhetes_agencia
       set status = 'CANCELADO'
     where passagem_id = new.id and status = 'EMITIDO'
    returning id
  )
  insert into public.bilhete_agencia_historico (bilhete_id, evento, status_anterior, status_novo, usuario_id, detalhe)
  select b.id, 'CANCELAMENTO_INTERNO', 'EMITIDO', 'CANCELADO',
         (select p.id from public.perfis p where p.id = (select auth.uid())),
         jsonb_build_object('origem', 'sistema interno')
  from b;
  return null;
end;
$$;

revoke execute on function private.sincronizar_bilhete_agencia() from public, anon, authenticated;

create trigger sincronizar_bilhete_agencia
  after update of status on public.passagens
  for each row
  when (new.status = 'CANCELADA' and old.status is distinct from 'CANCELADA')
  execute function private.sincronizar_bilhete_agencia();

-- Mesma função de cancelamento da agência, agora atualizando o bilhete ANTES da passagem:
-- assim o gatilho acima já o encontra cancelado e não grava um segundo registro no histórico.
create or replace function public.cancelar_bilhete_agencia(p_agencia_id uuid, p_bilhete_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_b record;
  v_ag_status public.status_agencia_parceira;
  v_pas record;
begin
  select a.status into v_ag_status from public.agencias_parceiras a where a.id = p_agencia_id;
  if v_ag_status is distinct from 'APROVADA' then
    raise exception using errcode = 'P0001', message = 'Agência sem autorização para esta operação.';
  end if;

  select b.id, b.agencia_id, b.passagem_id, b.pedido_id, b.status, b.repasse_pago
  into v_b
  from public.bilhetes_agencia b
  where b.id = p_bilhete_id and b.agencia_id = p_agencia_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Bilhete não encontrado.';
  end if;
  if v_b.status <> 'EMITIDO' then
    raise exception using errcode = 'P0001', message = 'Este bilhete não pode mais ser cancelado.';
  end if;
  if v_b.repasse_pago then
    raise exception using errcode = 'P0001', message = 'O repasse deste bilhete já foi baixado. Fale com a empresa.';
  end if;

  select pas.status, v.partida, pl.minutos_desde_origem
  into v_pas
  from public.passagens pas
  join public.viagens v on v.id = pas.viagem_id
  join public.paradas_linha pl on pl.linha_id = v.linha_id and pl.ordem = pas.origem_ordem
  where pas.id = v_b.passagem_id
  for update of pas;

  if v_pas.status <> 'EMITIDA' then
    raise exception using errcode = 'P0001', message = 'Este bilhete não pode mais ser cancelado.';
  end if;
  if v_pas.partida + v_pas.minutos_desde_origem * interval '1 minute' <= now() then
    raise exception using errcode = 'P0001', message = 'A embarcação já saiu da parada de embarque; não é mais possível cancelar.';
  end if;

  update public.bilhetes_agencia set status = 'CANCELADO' where id = v_b.id;
  update public.passagens set status = 'CANCELADA' where id = v_b.passagem_id;
  update public.pedidos set status = 'CANCELADO' where id = v_b.pedido_id;

  insert into public.bilhete_agencia_historico (bilhete_id, evento, status_anterior, status_novo, agencia_id, detalhe)
  values (v_b.id, 'CANCELAMENTO', 'EMITIDO', 'CANCELADO', p_agencia_id, jsonb_build_object('motivo', nullif(trim(p_motivo), '')));

  return jsonb_build_object('bilhete_id', v_b.id, 'status', 'CANCELADO');
end;
$function$;
