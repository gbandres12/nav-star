-- 1. empresa_publica sem SECURITY DEFINER (alerta ERROR do Supabase).
--    A view passa a rodar com as permissões de quem consulta; o visitante só enxerga as colunas públicas,
--    porque o SELECT da tabela empresas foi trocado por um GRANT por coluna (pix_chave, taxas etc. ficam fora).
revoke select on public.empresas from anon;
grant select (id, nome_fantasia, razao_social, cnpj, email, telefone, whatsapp, logo_url, minutos_reserva_site,
              tipo_servico, beneficios, whatsapps)
  on public.empresas to anon;

drop policy if exists "empresas_select_anon" on public.empresas;
create policy "empresas_select_anon" on public.empresas for select to anon using (true);

alter view public.empresa_publica set (security_invoker = true);

-- 2. Limite de requisições. As RPCs abertas ao visitante (criar pedido, avisar pagamento, consultar pedido) ficavam
--    expostas na chave anônima, que qualquer pessoa vê no navegador: dava para segurar poltronas em massa ou
--    varrer códigos de pedido sem passar pelo site. Agora só o servidor (service_role) as chama, depois de checar o limite.
create table if not exists public.limites_requisicao (
  chave text not null,
  janela timestamptz not null,
  contagem integer not null default 0,
  primary key (chave, janela)
);
alter table public.limites_requisicao enable row level security; -- sem policy: só o servidor acessa
revoke all on public.limites_requisicao from anon, authenticated;

-- Janela fixa: conta a chamada e diz se ainda está dentro do limite
create or replace function public.checar_limite(p_chave text, p_max integer, p_janela_seg integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_janela timestamptz;
  v_contagem integer;
begin
  v_janela := to_timestamp(floor(extract(epoch from now()) / p_janela_seg) * p_janela_seg);
  insert into public.limites_requisicao (chave, janela, contagem)
  values (p_chave, v_janela, 1)
  on conflict (chave, janela) do update set contagem = public.limites_requisicao.contagem + 1
  returning contagem into v_contagem;
  return v_contagem <= p_max;
end;
$$;

revoke execute on function public.checar_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.checar_limite(text, integer, integer) to service_role;

revoke execute on function public.criar_pedido_site(jsonb) from public, anon, authenticated;
revoke execute on function public.informar_pagamento(text) from public, anon, authenticated;
revoke execute on function public.pedido_publico(text) from public, anon, authenticated;
grant execute on function public.criar_pedido_site(jsonb) to service_role;
grant execute on function public.informar_pagamento(text) to service_role;
grant execute on function public.pedido_publico(text) to service_role;

-- Limpeza: contadores com mais de um dia não servem mais
do $$
begin
  if exists (select 1 from cron.job where jobname = 'limpar-limites') then
    perform cron.unschedule('limpar-limites');
  end if;
end;
$$;
select cron.schedule('limpar-limites', '15 * * * *', $$delete from public.limites_requisicao where janela < now() - interval '1 day'$$);
