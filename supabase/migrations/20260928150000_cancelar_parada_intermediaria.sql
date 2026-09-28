-- Cancelamento em parada intermediária: a trava de "já partiu" passa a olhar a saída da parada de
-- embarque de cada passagem (partida + minutos_desde_origem), igual à venda. Antes, uma passagem
-- Parintins → Juruti não podia ser cancelada depois que o barco saía de Manaus.
do $migracao$
declare
  v_def text;
  v_novo text;
begin
  v_def := pg_get_functiondef('public.cancelar_pedido(text, text)'::regprocedure);

  v_novo := replace(v_def,
$old$    join public.viagens v on v.id = pas.viagem_id
    where pas.pedido_id = v_pedido.id
      and pas.status in ('RESERVADA', 'EMITIDA')
      and v.partida <= now()$old$,
$new$    join public.viagens v on v.id = pas.viagem_id
    join public.paradas_linha pl on pl.linha_id = v.linha_id and pl.ordem = pas.origem_ordem
    where pas.pedido_id = v_pedido.id
      and pas.status in ('RESERVADA', 'EMITIDA')
      and v.partida + pl.minutos_desde_origem * interval '1 minute' <= now()$new$);

  if v_novo = v_def then
    raise exception 'cancelar_pedido não está na versão esperada; ajuste a migração.';
  end if;

  execute v_novo;
end
$migracao$;
