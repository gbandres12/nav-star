-- Fecha RPCs internas que ficaram executáveis por PUBLIC (inclui o papel anon: qualquer um com a chave publicável do site).
-- O revoke da 0003 veio antes da criação destas funções, então o EXECUTE padrão do Postgres para PUBLIC ficou valendo.
-- Re-executável.

-- Operação do painel: só usuário logado (cada função confere o papel por dentro)
revoke execute on function public.alterar_status_viagem(uuid, public.status_viagem) from public, anon;
revoke execute on function public.alternar_vendas_viagem(uuid, boolean) from public, anon;
revoke execute on function public.avancar_encomenda(text, text) from public, anon;
revoke execute on function public.cancelar_pedido(text, text) from public, anon;
revoke execute on function public.criar_encomenda(jsonb) from public, anon;
revoke execute on function public.criar_pedido_balcao(jsonb) from public, anon;
revoke execute on function public.resumo_financeiro(timestamptz, timestamptz) from public, anon;
revoke execute on function public.validar_embarque(text) from public, anon;
grant execute on function public.alterar_status_viagem(uuid, public.status_viagem) to authenticated, service_role;
grant execute on function public.alternar_vendas_viagem(uuid, boolean) to authenticated, service_role;
grant execute on function public.avancar_encomenda(text, text) to authenticated, service_role;
grant execute on function public.cancelar_pedido(text, text) to authenticated, service_role;
grant execute on function public.criar_encomenda(jsonb) to authenticated, service_role;
grant execute on function public.criar_pedido_balcao(jsonb) to authenticated, service_role;
grant execute on function public.resumo_financeiro(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.validar_embarque(text) to authenticated, service_role;

-- Confirmar pagamento não confere quem chama: só o servidor (webhook do gateway, com a chave secreta)
revoke execute on function public.confirmar_pagamento(text, text) from public, anon, authenticated;
grant execute on function public.confirmar_pagamento(text, text) to service_role;

-- Site público continua com: buscar_viagens, calendario_viagens, assentos_ocupados, criar_pedido_site,
-- pedido_publico e rastrear_encomenda (concedidas explicitamente a anon). Só tiramos o PUBLIC redundante delas.
revoke execute on function public.buscar_viagens(text, text, date) from public;
revoke execute on function public.assentos_ocupados(uuid, integer, integer) from public;
revoke execute on function public.criar_pedido_site(jsonb) from public;
revoke execute on function public.pedido_publico(text) from public;
revoke execute on function public.rastrear_encomenda(text) from public;
