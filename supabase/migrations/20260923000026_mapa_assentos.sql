-- Mapa de poltronas salvo de uma vez (antes: protótipo em memória). Re-executável. Só ADMIN, só a própria empresa.
-- Poltronas são identificadas pelo código ("12A"): quem mantém o código mantém o id (passagens continuam ligadas).
-- Poltrona retirada do mapa: se tem passagem ativa numa viagem que ainda não terminou, a gravação é recusada; se só tem
-- passagens antigas, fica inativa (o histórico continua apontando para ela); se nunca foi vendida, é apagada.

create or replace function public.salvar_mapa_assentos(p_embarcacao_id uuid, p_colunas integer, p_assentos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigos text[];
  v_repetido text;
  v_em_uso text;
  v_item jsonb;
  v_codigo text;
  v_comodo uuid;
  v_ativos integer;
begin
  if not (select private.tem_papel('ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Só o administrador altera o mapa de poltronas.';
  end if;
  if not exists (select 1 from public.embarcacoes e where e.id = p_embarcacao_id and e.empresa_id = (select private.empresa_atual())) then
    raise exception using errcode = 'P0001', message = 'Embarcação não encontrada.';
  end if;
  if p_colunas is null or p_colunas < 2 or p_colunas > 9 then
    raise exception using errcode = 'P0001', message = 'O mapa deve ter de 2 a 9 posições por fileira.';
  end if;
  if jsonb_typeof(p_assentos) <> 'array' then
    raise exception using errcode = 'P0001', message = 'Mapa inválido.';
  end if;

  select array_agg(upper(trim(x->>'codigo'))) into v_codigos from jsonb_array_elements(p_assentos) x;
  v_codigos := coalesce(v_codigos, array[]::text[]);
  if exists (select 1 from unnest(v_codigos) c where c is null or c = '') then
    raise exception using errcode = 'P0001', message = 'Toda poltrona precisa de um código.';
  end if;
  select c into v_repetido from unnest(v_codigos) c group by c having count(*) > 1 limit 1;
  if v_repetido is not null then
    raise exception using errcode = 'P0001', message = format('Código repetido: %s', v_repetido);
  end if;

  -- Trava a embarcação: duas gravações do mapa ao mesmo tempo não se misturam
  perform 1 from public.embarcacoes where id = p_embarcacao_id for update;

  -- Poltronas que saem do mapa com passagem ativa em viagem que ainda não terminou
  select string_agg(distinct a.codigo, ', ' order by a.codigo) into v_em_uso
  from public.assentos a
  join public.passagens p on p.assento_id = a.id and p.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
  join public.viagens v on v.id = p.viagem_id and v.status not in ('CONCLUIDA', 'CANCELADA')
  where a.embarcacao_id = p_embarcacao_id and a.ativo and not (a.codigo = any(v_codigos));
  if v_em_uso is not null then
    raise exception using errcode = 'P0001', message = format('Não dá para remover poltronas com passagem vendida: %s', v_em_uso);
  end if;

  -- Saem do mapa: inativa se já foi vendida alguma vez, apaga se nunca foi
  update public.assentos a set ativo = false, updated_at = now()
  where a.embarcacao_id = p_embarcacao_id and a.ativo and not (a.codigo = any(v_codigos))
    and exists (select 1 from public.passagens p where p.assento_id = a.id);
  delete from public.assentos a
  where a.embarcacao_id = p_embarcacao_id and not (a.codigo = any(v_codigos))
    and not exists (select 1 from public.passagens p where p.assento_id = a.id);

  -- Entram ou mudam: grava por código (mantém o id de quem já existia)
  for v_item in select * from jsonb_array_elements(p_assentos) loop
    v_codigo := upper(trim(v_item->>'codigo'));
    v_comodo := nullif(v_item->>'comodoId', '')::uuid;
    if v_comodo is not null and not exists (select 1 from public.comodos c where c.id = v_comodo and c.embarcacao_id = p_embarcacao_id) then
      raise exception using errcode = 'P0001', message = format('Cômodo inválido na poltrona %s.', v_codigo);
    end if;
    insert into public.assentos (embarcacao_id, codigo, fileira, coluna, tipo, comodo_id, ativo)
    values (
      p_embarcacao_id, v_codigo, (v_item->>'fileira')::integer, (v_item->>'coluna')::integer,
      coalesce(nullif(v_item->>'tipo', ''), 'POLTRONA')::public.tipo_assento, v_comodo, true
    )
    on conflict (embarcacao_id, codigo) do update
      set fileira = excluded.fileira, coluna = excluded.coluna, tipo = excluded.tipo,
          comodo_id = excluded.comodo_id, ativo = true, updated_at = now();
  end loop;

  select count(*) into v_ativos from public.assentos where embarcacao_id = p_embarcacao_id and ativo;
  update public.embarcacoes set colunas_mapa = p_colunas, updated_at = now() where id = p_embarcacao_id;

  return jsonb_build_object('ok', true, 'poltronas', v_ativos);
end;
$$;

revoke execute on function public.salvar_mapa_assentos(uuid, integer, jsonb) from public, anon;
grant execute on function public.salvar_mapa_assentos(uuid, integer, jsonb) to authenticated, service_role;
