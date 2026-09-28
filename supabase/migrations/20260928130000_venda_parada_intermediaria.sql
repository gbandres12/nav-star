-- Venda em parada intermediária: a trava de "já partiu" passa a olhar o horário de saída
-- da parada de embarque (partida + minutos_desde_origem), não a saída do porto inicial.
-- Assim, depois que o barco sai de Manaus, ainda dá para vender Parintins → Juruti até ele sair de Parintins.
do $migracao$
declare
  v_def text;
  v_novo text;
begin
  v_def := pg_get_functiondef('private.criar_pedido(jsonb, public.canal_venda, uuid, uuid, boolean)'::regprocedure);

  v_novo := replace(v_def,
$old$  if v_viagem.partida <= now() then
    raise exception using errcode = 'P0001', message = 'A viagem selecionada já partiu.';
  end if;
$old$, '');

  v_novo := replace(v_novo,
$old$    raise exception using errcode = 'P0001', message = 'Trecho não encontrado na linha da viagem.';
  end if;
$old$,
$new$    raise exception using errcode = 'P0001', message = 'Trecho não encontrado na linha da viagem.';
  end if;

  if v_viagem.partida + (
       select pl.minutos_desde_origem from public.paradas_linha pl where pl.id = v_origem_parada_id
     ) * interval '1 minute' <= now() then
    raise exception using errcode = 'P0001', message = 'A embarcação já saiu da parada de embarque deste trecho.';
  end if;
$new$);

  if v_novo = v_def or position('já saiu da parada' in v_novo) = 0 or position('A viagem selecionada já partiu' in v_novo) > 0 then
    raise exception 'criar_pedido não está na versão esperada; ajuste a migração.';
  end if;

  execute v_novo;
end
$migracao$;
