-- Agências parceiras — Etapa 2: contagem atômica de tentativas de login.
-- Cinco erros seguidos bloqueiam a agência por 15 minutos (o servidor consulta bloqueado_ate antes de conferir a senha).
-- Só o service role executa.

create or replace function public.agencia_login_falha(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.agencias_parceiras
     set tentativas_falhas = case when tentativas_falhas + 1 >= 5 then 0 else tentativas_falhas + 1 end,
         bloqueado_ate = case when tentativas_falhas + 1 >= 5 then now() + interval '15 minutes' else bloqueado_ate end
   where id = p_id;
$$;

create or replace function public.agencia_login_ok(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.agencias_parceiras
     set tentativas_falhas = 0, bloqueado_ate = null, ultimo_login = now()
   where id = p_id;
$$;

revoke execute on function public.agencia_login_falha(uuid), public.agencia_login_ok(uuid) from public, anon, authenticated;
grant execute on function public.agencia_login_falha(uuid), public.agencia_login_ok(uuid) to service_role;
