-- ==============================================================================
-- Migração 5: RPCs Operacionais e Transações da Gestão NavStar
-- NavStar - Banco de Dados PostgreSQL / Supabase
-- Conforme especificação B4 do backend-plan.md e Requisitos Etapa B4
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: criar_pedido_balcao
--    Permissões: VENDEDOR, GERENTE, ADMIN
--    Venda presencial no balcão ou por agência credenciada, com assentos emitidos na hora.
-- ------------------------------------------------------------------------------
create or replace function public.criar_pedido_balcao(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vendedor_id uuid;
  v_agencia_id uuid;
  v_empresa_id uuid;
  v_ativo boolean;
  v_canal public.canal_venda;
  v_viagem_id uuid;
  v_linha_id uuid;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('VENDEDOR'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para criação de pedido no balcão.';
  end if;

  -- 2. Identificação do operador e agência vinculada
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

  -- 3. Validação das linhas autorizadas para o vendedor (perfis_linhas)
  v_viagem_id := coalesce(
    nullif(criar_pedido_balcao.payload->>'viagem_id', '')::uuid,
    nullif(criar_pedido_balcao.payload->>'viagemId', '')::uuid
  );

  if v_viagem_id is null then
    raise exception using errcode = 'P0001', message = 'Viagem não informada no pedido.';
  end if;

  select v.linha_id
  into v_linha_id
  from public.viagens v
  where v.id = v_viagem_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Viagem informada não foi encontrada.';
  end if;

  if exists (select 1 from public.perfis_linhas pl where pl.perfil_id = v_vendedor_id) then
    if not exists (
      select 1
      from public.perfis_linhas pl
      where pl.perfil_id = v_vendedor_id
        and pl.linha_id = v_linha_id
    ) then
      raise exception using errcode = 'P0001', message = 'Vendedor não possui permissão para emitir passagens nesta linha.';
    end if;
  end if;

  -- 4. Delegação para o núcleo de pedido transacional (pago no ato = true)
  return private.criar_pedido(
    criar_pedido_balcao.payload,
    v_canal,
    v_vendedor_id,
    v_agencia_id,
    true
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. RPC: cancelar_pedido
--    Permissões: GERENTE, ADMIN (VENDEDOR apenas para seus próprios pedidos em AGUARDANDO_PAGAMENTO)
--    Cancela o pedido, estorna/cancela pagamentos e libera a exclusão de assentos.
-- ------------------------------------------------------------------------------
create or replace function public.cancelar_pedido(codigo text, motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_eh_gestao boolean;
  v_novo_status_ped public.status_pedido;
  v_novo_status_pag public.status_pagamento;
  v_empresa_solicitante uuid;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario, 'VENDEDOR'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para cancelamento de pedidos.';
  end if;

  if cancelar_pedido.codigo is null or length(trim(cancelar_pedido.codigo)) = 0 then
    raise exception using errcode = 'P0001', message = 'Código do pedido é obrigatório.';
  end if;

  -- 2. Localização do pedido com lock exclusivo
  select p.*
  into v_pedido
  from public.pedidos p
  where upper(trim(p.codigo)) = upper(trim(cancelar_pedido.codigo))
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Pedido não encontrado.';
  end if;

  v_empresa_solicitante := (select private.empresa_atual());
  if v_empresa_solicitante is not null and v_pedido.empresa_id <> v_empresa_solicitante then
    raise exception using errcode = 'P0001', message = 'Pedido pertence a outra empresa.';
  end if;

  -- 3. Regra de autorização para papel VENDEDOR
  v_eh_gestao := (select private.tem_papel('GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario));
  if not v_eh_gestao then
    if v_pedido.vendedor_id is distinct from (select auth.uid()) then
      raise exception using errcode = 'P0001', message = 'Vendedores só podem cancelar seus próprios pedidos.';
    end if;
    if v_pedido.status <> 'AGUARDANDO_PAGAMENTO' then
      raise exception using errcode = 'P0001', message = 'Vendedores só podem cancelar pedidos com pagamento pendente.';
    end if;
  end if;

  -- 4. Validação de status atual
  if v_pedido.status in ('CANCELADO', 'EXPIRADO', 'REEMBOLSADO') then
    raise exception using errcode = 'P0001', message = 'Pedido já finalizado ou cancelado com status ' || v_pedido.status::text || '.';
  end if;

  -- 5. Recusa se houver passagem EMBARCADA
  if exists (
    select 1
    from public.passagens pas
    where pas.pedido_id = v_pedido.id
      and pas.status = 'EMBARCADA'
  ) then
    raise exception using errcode = 'P0001', message = 'Não é possível cancelar pedido com passagem já embarcada.';
  end if;

  -- 6. Recusa se a viagem já partiu (partida <= now())
  if exists (
    select 1
    from public.passagens pas
    join public.viagens v on v.id = pas.viagem_id
    where pas.pedido_id = v_pedido.id
      and pas.status in ('RESERVADA', 'EMITIDA')
      and v.partida <= now()
  ) then
    raise exception using errcode = 'P0001', message = 'A embarcação já partiu; não é possível cancelar o pedido.';
  end if;

  -- 7. Determinação das transições de status
  if v_pedido.status = 'AGUARDANDO_PAGAMENTO' then
    v_novo_status_ped := 'CANCELADO'::public.status_pedido;
    v_novo_status_pag := 'RECUSADO'::public.status_pagamento;
  elsif v_pedido.status = 'PAGO' then
    v_novo_status_ped := 'REEMBOLSADO'::public.status_pedido;
    v_novo_status_pag := 'ESTORNADO'::public.status_pagamento;
  end if;

  -- 8. Atualização atômica
  update public.pedidos
  set status = v_novo_status_ped,
      expira_em = null,
      updated_at = now()
  where pedidos.id = v_pedido.id;

  update public.pagamentos
  set status = v_novo_status_pag,
      updated_at = now()
  where pagamentos.pedido_id = v_pedido.id;

  -- Passagens viram CANCELADA, liberando a exclusion constraint passagens_sem_sobreposicao
  update public.passagens
  set status = 'CANCELADA',
      updated_at = now()
  where passagens.pedido_id = v_pedido.id
    and passagens.status in ('RESERVADA', 'EMITIDA');

  return jsonb_build_object(
    'ok', true,
    'codigo', v_pedido.codigo,
    'status_anterior', v_pedido.status,
    'novo_status', v_novo_status_ped,
    'motivo', cancelar_pedido.motivo
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. RPC: validar_embarque
--    Permissões: CONFERENTE, GERENTE, ADMIN
--    Valida token QR no porto/embarcação, atualizando status para EMBARCADA
-- ------------------------------------------------------------------------------
create or replace function public.validar_embarque(qr_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pas record;
  v_agora timestamptz;
  v_linha_nome text;
  v_assento_codigo text;
  v_origem_cidade text;
  v_origem_porto text;
  v_destino_cidade text;
  v_destino_porto text;
  v_empresa_solicitante uuid;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('CONFERENTE'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para validação de embarque.';
  end if;

  if validar_embarque.qr_token is null or length(trim(validar_embarque.qr_token)) = 0 then
    raise exception using errcode = 'P0001', message = 'Token QR do bilhete é obrigatório.';
  end if;

  -- 2. Localização do bilhete e dados da viagem associada
  select pas.*,
         v.linha_id,
         v.embarcacao_id,
         v.partida as viagem_partida,
         v.status as viagem_status,
         v.empresa_id as viagem_empresa_id
  into v_pas
  from public.passagens pas
  join public.viagens v on v.id = pas.viagem_id
  where upper(trim(pas.qr_token)) = upper(trim(validar_embarque.qr_token))
  for update of pas;

  if not found then
    raise exception using errcode = 'P0001', message = 'Bilhete não encontrado.';
  end if;

  v_empresa_solicitante := (select private.empresa_atual());
  if v_empresa_solicitante is not null and v_pas.viagem_empresa_id <> v_empresa_solicitante then
    raise exception using errcode = 'P0001', message = 'Bilhete pertence a outra empresa.';
  end if;

  -- 3. Validação do status do bilhete
  if v_pas.status = 'CANCELADA' then
    raise exception using errcode = 'P0001', message = 'Bilhete cancelado. Embarque não permitido.';
  end if;

  if v_pas.status = 'RESERVADA' then
    raise exception using errcode = 'P0001', message = 'Bilhete com pagamento pendente. Embarque não permitido.';
  end if;

  if v_pas.status = 'EMBARCADA' then
    raise exception using errcode = 'P0001',
      message = 'Bilhete já utilizado. Embarque realizado em ' ||
                to_char(v_pas.embarcado_em at time zone 'America/Manaus', 'DD/MM/YYYY às HH24:MI') || '.';
  end if;

  if v_pas.viagem_status = 'CANCELADA' then
    raise exception using errcode = 'P0001', message = 'A viagem associada a este bilhete foi cancelada.';
  end if;

  if v_pas.viagem_status = 'CONCLUIDA' then
    raise exception using errcode = 'P0001', message = 'A viagem associada a este bilhete já foi concluída.';
  end if;

  if v_pas.status <> 'EMITIDA' then
    raise exception using errcode = 'P0001', message = 'Status do bilhete inválido para embarque: ' || v_pas.status::text || '.';
  end if;

  -- 4. Atualização de status e carimbo de validação
  v_agora := now();
  update public.passagens
  set status = 'EMBARCADA',
      embarcado_em = v_agora,
      validado_por_id = (select auth.uid()),
      updated_at = v_agora
  where passagens.id = v_pas.id;

  -- 5. Recuperação dos dados legíveis para o terminal do conferente
  select l.nome into v_linha_nome
  from public.linhas l
  where l.id = v_pas.linha_id;

  select a.codigo into v_assento_codigo
  from public.assentos a
  where a.id = v_pas.assento_id;

  select c.nome, p.nome
  into v_origem_cidade, v_origem_porto
  from public.paradas_linha pl
  join public.portos p on p.id = pl.porto_id
  join public.cidades c on c.id = p.cidade_id
  where pl.linha_id = v_pas.linha_id and pl.ordem = v_pas.origem_ordem;

  select c.nome, p.nome
  into v_destino_cidade, v_destino_porto
  from public.paradas_linha pl
  join public.portos p on p.id = pl.porto_id
  join public.cidades c on c.id = p.cidade_id
  where pl.linha_id = v_pas.linha_id and pl.ordem = v_pas.destino_ordem;

  return jsonb_build_object(
    'ok', true,
    'passagem_id', v_pas.id,
    'status', 'EMBARCADA',
    'embarcado_em', v_agora,
    'embarcado_em_manaus', to_char(v_agora at time zone 'America/Manaus', 'DD/MM/YYYY HH24:MI'),
    'passageiro', jsonb_build_object(
      'nome', v_pas.nome,
      'documento', v_pas.documento,
      'tipo', v_pas.tipo
    ),
    'assento', coalesce(v_assento_codigo, 'Livre'),
    'linha', v_linha_nome,
    'trecho', jsonb_build_object(
      'origem_ordem', v_pas.origem_ordem,
      'origem_cidade', v_origem_cidade,
      'origem_porto', v_origem_porto,
      'destino_ordem', v_pas.destino_ordem,
      'destino_cidade', v_destino_cidade,
      'destino_porto', v_destino_porto
    )
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. RPC: alterar_status_viagem
--    Permissões: GERENTE, ADMIN
--    Transições permitidas:
--      PROGRAMADA -> EMBARQUE, EMBARQUE -> EM_CURSO, EM_CURSO -> CONCLUIDA,
--      PROGRAMADA -> CANCELADA, EMBARQUE -> CANCELADA.
-- ------------------------------------------------------------------------------
create or replace function public.alterar_status_viagem(viagem_id uuid, novo_status public.status_viagem)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagens%rowtype;
  v_empresa_solicitante uuid;
  v_usuario_id uuid;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para alteração de status de viagem.';
  end if;

  if alterar_status_viagem.viagem_id is null or alterar_status_viagem.novo_status is null then
    raise exception using errcode = 'P0001', message = 'Identificador da viagem e novo status são obrigatórios.';
  end if;

  -- 2. Localização e validação de empresa
  select * into v_viagem
  from public.viagens v
  where v.id = alterar_status_viagem.viagem_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Viagem não encontrada.';
  end if;

  v_empresa_solicitante := (select private.empresa_atual());
  if v_empresa_solicitante is not null and v_viagem.empresa_id <> v_empresa_solicitante then
    raise exception using errcode = 'P0001', message = 'Viagem pertence a outra empresa.';
  end if;

  -- 3. Validação estrita da máquina de estados
  if not (
    (v_viagem.status = 'PROGRAMADA' and alterar_status_viagem.novo_status in ('EMBARQUE', 'CANCELADA')) or
    (v_viagem.status = 'EMBARQUE'   and alterar_status_viagem.novo_status in ('EM_CURSO', 'CANCELADA')) or
    (v_viagem.status = 'EM_CURSO'   and alterar_status_viagem.novo_status = 'CONCLUIDA')
  ) then
    raise exception using errcode = 'P0001',
      message = 'Transição de status não permitida de ' || v_viagem.status::text || ' para ' || alterar_status_viagem.novo_status::text || '.';
  end if;

  v_usuario_id := (select auth.uid());

  -- 4. Efeitos colaterais por transição
  if alterar_status_viagem.novo_status = 'EM_CURSO' then
    -- Encomendas embarcadas entram em trânsito
    with encs as (
      update public.encomendas
      set status = 'EM_TRANSITO', updated_at = now()
      where public.encomendas.viagem_id = v_viagem.id and public.encomendas.status = 'EMBARCADA'
      returning id
    )
    insert into public.encomenda_eventos (encomenda_id, status, descricao, usuario_id, created_at)
    select id, 'EM_TRANSITO', 'Em viagem fluvial', v_usuario_id, now()
    from encs;

  elsif alterar_status_viagem.novo_status = 'CONCLUIDA' then
    -- Passagens não embarcadas viram NAO_COMPARECEU
    update public.passagens
    set status = 'NAO_COMPARECEU', updated_at = now()
    where public.passagens.viagem_id = v_viagem.id and public.passagens.status = 'EMITIDA';

    -- Encomendas passam a ficar disponíveis para retirada no porto de destino
    with encs as (
      update public.encomendas e
      set status = 'DISPONIVEL_RETIRADA', updated_at = now()
      where e.viagem_id = v_viagem.id and e.status in ('EMBARCADA', 'EM_TRANSITO')
      returning e.id, e.destino_cidade_id
    )
    insert into public.encomenda_eventos (encomenda_id, status, descricao, usuario_id, created_at)
    select e.id, 'DISPONIVEL_RETIRADA',
           'Disponível para retirada em ' || coalesce((select c.nome from public.cidades c where c.id = e.destino_cidade_id), 'porto de destino'),
           v_usuario_id, now()
    from encs e;

  elsif alterar_status_viagem.novo_status = 'CANCELADA' then
    -- Encomendas voltam a aguardar nova viagem
    with encs as (
      update public.encomendas
      set status = 'RECEBIDA', viagem_id = null, updated_at = now()
      where public.encomendas.viagem_id = v_viagem.id and public.encomendas.status = 'EMBARCADA'
      returning id
    )
    insert into public.encomenda_eventos (encomenda_id, status, descricao, usuario_id, created_at)
    select id, 'RECEBIDA', 'Viagem cancelada: aguardando nova viagem no porto de origem', v_usuario_id, now()
    from encs;
  end if;

  -- 5. Atualização da viagem
  update public.viagens
  set status = alterar_status_viagem.novo_status,
      vendas_abertas = case when alterar_status_viagem.novo_status in ('CONCLUIDA', 'CANCELADA') then false else vendas_abertas end,
      updated_at = now()
  where public.viagens.id = v_viagem.id;

  return jsonb_build_object(
    'ok', true,
    'viagem_id', v_viagem.id,
    'status_anterior', v_viagem.status,
    'novo_status', alterar_status_viagem.novo_status
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC: alternar_vendas_viagem
--    Permissões: GERENTE, ADMIN
--    Abre ou fecha vendas para novas reservas/emissões na viagem selecionada.
-- ------------------------------------------------------------------------------
create or replace function public.alternar_vendas_viagem(viagem_id uuid, abertas bool)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viagem public.viagens%rowtype;
  v_empresa_solicitante uuid;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para alternar vendas da viagem.';
  end if;

  if alternar_vendas_viagem.viagem_id is null or alternar_vendas_viagem.abertas is null then
    raise exception using errcode = 'P0001', message = 'Identificador da viagem e indicador de vendas são obrigatórios.';
  end if;

  -- 2. Localização e validação
  select * into v_viagem
  from public.viagens v
  where v.id = alternar_vendas_viagem.viagem_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Viagem não encontrada.';
  end if;

  v_empresa_solicitante := (select private.empresa_atual());
  if v_empresa_solicitante is not null and v_viagem.empresa_id <> v_empresa_solicitante then
    raise exception using errcode = 'P0001', message = 'Viagem pertence a outra empresa.';
  end if;

  if v_viagem.status in ('CONCLUIDA', 'CANCELADA') then
    raise exception using errcode = 'P0001', message = 'Não é possível alterar vendas de uma viagem cancelada ou concluída.';
  end if;

  -- 3. Atualização
  update public.viagens
  set vendas_abertas = alternar_vendas_viagem.abertas,
      updated_at = now()
  where public.viagens.id = v_viagem.id;

  return jsonb_build_object(
    'ok', true,
    'viagem_id', v_viagem.id,
    'vendas_abertas', alternar_vendas_viagem.abertas
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. RPC: criar_encomenda
--    Permissões: VENDEDOR, CONFERENTE, GERENTE, ADMIN
--    Cadastra nova remessa de carga fluvial e registra o evento inicial RECEBIDA
-- ------------------------------------------------------------------------------
create or replace function public.criar_encomenda(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_origem_cidade_id uuid;
  v_destino_cidade_id uuid;
  v_origem_cidade_nome text;
  v_viagem_id uuid;
  v_remetente_nome text;
  v_remetente_doc text;
  v_remetente_tel text;
  v_destinatario_nome text;
  v_destinatario_doc text;
  v_destinatario_tel text;
  v_descricao text;
  v_volumes integer;
  v_peso_kg numeric(10,2);
  v_valor_declarado numeric(10,2);
  v_frete numeric(10,2);
  v_pagador public.pagador_frete;
  v_frete_pago boolean;
  v_encomenda_id uuid;
  v_codigo text;
  v_usuario_id uuid;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('VENDEDOR'::public.papel_usuario, 'CONFERENTE'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para cadastro de encomendas.';
  end if;

  v_usuario_id := (select auth.uid());
  v_empresa_id := coalesce(
    (select private.empresa_atual()),
    (select p.empresa_id from public.perfis p where p.id = v_usuario_id)
  );

  if v_empresa_id is null then
    raise exception using errcode = 'P0001', message = 'Usuário sem empresa vinculada.';
  end if;

  -- 2. Extração e validação dos dados de rota
  v_origem_cidade_id := coalesce(nullif(criar_encomenda.payload->>'origem_cidade_id', '')::uuid, nullif(criar_encomenda.payload->>'origemCidadeId', '')::uuid);
  v_destino_cidade_id := coalesce(nullif(criar_encomenda.payload->>'destino_cidade_id', '')::uuid, nullif(criar_encomenda.payload->>'destinoCidadeId', '')::uuid);
  v_viagem_id := coalesce(nullif(criar_encomenda.payload->>'viagem_id', '')::uuid, nullif(criar_encomenda.payload->>'viagemId', '')::uuid);

  if v_origem_cidade_id is null or v_destino_cidade_id is null then
    raise exception using errcode = 'P0001', message = 'Cidades de origem e destino são obrigatórias.';
  end if;

  if v_origem_cidade_id = v_destino_cidade_id then
    raise exception using errcode = 'P0001', message = 'Origem e destino não podem ser a mesma cidade.';
  end if;

  select c.nome into v_origem_cidade_nome
  from public.cidades c
  where c.id = v_origem_cidade_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'Cidade de origem não cadastrada.';
  end if;

  if not exists (select 1 from public.cidades where id = v_destino_cidade_id) then
    raise exception using errcode = 'P0001', message = 'Cidade de destino não cadastrada.';
  end if;

  if v_viagem_id is not null then
    if not exists (
      select 1
      from public.viagens
      where viagens.id = v_viagem_id
        and viagens.empresa_id = v_empresa_id
        and viagens.status not in ('CONCLUIDA', 'CANCELADA')
    ) then
      raise exception using errcode = 'P0001', message = 'Viagem selecionada é inválida ou encerrada.';
    end if;
  end if;

  -- 3. Extração dos dados das partes e da carga
  v_remetente_nome := trim(coalesce(criar_encomenda.payload->>'remetente_nome', criar_encomenda.payload->>'remetenteNome', ''));
  v_remetente_doc := trim(coalesce(criar_encomenda.payload->>'remetente_doc', criar_encomenda.payload->>'remetenteDoc', ''));
  v_remetente_tel := trim(coalesce(criar_encomenda.payload->>'remetente_tel', criar_encomenda.payload->>'remetenteTel', ''));

  v_destinatario_nome := trim(coalesce(criar_encomenda.payload->>'destinatario_nome', criar_encomenda.payload->>'destinatarioNome', ''));
  v_destinatario_doc := nullif(trim(coalesce(criar_encomenda.payload->>'destinatario_doc', criar_encomenda.payload->>'destinatarioDoc', '')), '');
  v_destinatario_tel := trim(coalesce(criar_encomenda.payload->>'destinatario_tel', criar_encomenda.payload->>'destinatarioTel', ''));

  v_descricao := trim(coalesce(criar_encomenda.payload->>'descricao', ''));
  v_volumes := coalesce((criar_encomenda.payload->>'volumes')::integer, 1);
  v_peso_kg := coalesce((criar_encomenda.payload->>'peso_kg')::numeric, (criar_encomenda.payload->>'pesoKg')::numeric, 0.00);
  v_valor_declarado := nullif(coalesce(criar_encomenda.payload->>'valor_declarado', criar_encomenda.payload->>'valorDeclarado', ''), '')::numeric;
  v_frete := coalesce((criar_encomenda.payload->>'frete')::numeric, 0.00);

  begin
    v_pagador := upper(trim(coalesce(criar_encomenda.payload->>'pagador', 'REMETENTE')))::public.pagador_frete;
  exception when others then
    v_pagador := 'REMETENTE'::public.pagador_frete;
  end;

  v_frete_pago := coalesce((criar_encomenda.payload->>'frete_pago')::boolean, (criar_encomenda.payload->>'fretePago')::boolean, false);

  if length(v_remetente_nome) < 2 or length(v_remetente_doc) < 3 or length(v_remetente_tel) < 5 then
    raise exception using errcode = 'P0001', message = 'Dados do remetente (nome, documento e telefone) são obrigatórios.';
  end if;

  if length(v_destinatario_nome) < 2 or length(v_destinatario_tel) < 5 then
    raise exception using errcode = 'P0001', message = 'Dados do destinatário (nome e telefone) são obrigatórios.';
  end if;

  if length(v_descricao) < 2 then
    raise exception using errcode = 'P0001', message = 'Descrição da encomenda é obrigatória.';
  end if;

  if v_volumes <= 0 then
    raise exception using errcode = 'P0001', message = 'Quantidade de volumes deve ser maior que zero.';
  end if;

  if v_peso_kg < 0 then
    raise exception using errcode = 'P0001', message = 'Peso da encomenda não pode ser negativo.';
  end if;

  if v_frete < 0 then
    raise exception using errcode = 'P0001', message = 'Valor do frete não pode ser negativo.';
  end if;

  -- 4. Inserção atômica da encomenda
  v_encomenda_id := gen_random_uuid();

  insert into public.encomendas (
    id,
    empresa_id,
    viagem_id,
    origem_cidade_id,
    destino_cidade_id,
    remetente_nome,
    remetente_doc,
    remetente_tel,
    destinatario_nome,
    destinatario_doc,
    destinatario_tel,
    descricao,
    volumes,
    peso_kg,
    valor_declarado,
    frete,
    pagador,
    frete_pago,
    status,
    created_at,
    updated_at
  ) values (
    v_encomenda_id,
    v_empresa_id,
    v_viagem_id,
    v_origem_cidade_id,
    v_destino_cidade_id,
    v_remetente_nome,
    v_remetente_doc,
    v_remetente_tel,
    v_destinatario_nome,
    v_destinatario_doc,
    v_destinatario_tel,
    v_descricao,
    v_volumes,
    v_peso_kg,
    v_valor_declarado,
    v_frete,
    v_pagador,
    v_frete_pago,
    'RECEBIDA',
    now(),
    now()
  ) returning codigo into v_codigo;

  -- 5. Inserção do evento inicial de rastreamento com operador
  insert into public.encomenda_eventos (
    encomenda_id,
    status,
    descricao,
    usuario_id,
    created_at
  ) values (
    v_encomenda_id,
    'RECEBIDA',
    'Recebida no porto de ' || v_origem_cidade_nome,
    v_usuario_id,
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'id', v_encomenda_id,
    'codigo', v_codigo,
    'status', 'RECEBIDA'
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 7. RPC: avancar_encomenda
--    Permissões: VENDEDOR, CONFERENTE, GERENTE, ADMIN
--    Transição sequencial: RECEBIDA -> EMBARCADA -> EM_TRANSITO -> DISPONIVEL_RETIRADA -> ENTREGUE
-- ------------------------------------------------------------------------------
create or replace function public.avancar_encomenda(codigo text, descricao text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enc record;
  v_novo_status public.status_encomenda;
  v_desc_padrao text;
  v_empresa_solicitante uuid;
  v_usuario_id uuid;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('VENDEDOR'::public.papel_usuario, 'CONFERENTE'::public.papel_usuario, 'GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado para avançar status de encomenda.';
  end if;

  if avancar_encomenda.codigo is null or length(trim(avancar_encomenda.codigo)) = 0 then
    raise exception using errcode = 'P0001', message = 'Código da encomenda é obrigatório.';
  end if;

  -- 2. Localização da encomenda
  select e.*, c.nome as destino_cidade_nome
  into v_enc
  from public.encomendas e
  join public.cidades c on c.id = e.destino_cidade_id
  where upper(trim(e.codigo)) = upper(trim(avancar_encomenda.codigo))
  for update of e;

  if not found then
    raise exception using errcode = 'P0001', message = 'Encomenda não encontrada.';
  end if;

  v_empresa_solicitante := (select private.empresa_atual());
  if v_empresa_solicitante is not null and v_enc.empresa_id <> v_empresa_solicitante then
    raise exception using errcode = 'P0001', message = 'Encomenda pertence a outra empresa.';
  end if;

  -- 3. Transição de estados linear e descrição do evento
  case v_enc.status
    when 'RECEBIDA' then
      v_novo_status := 'EMBARCADA'::public.status_encomenda;
      v_desc_padrao := 'Embarcada na embarcação';
    when 'EMBARCADA' then
      v_novo_status := 'EM_TRANSITO'::public.status_encomenda;
      v_desc_padrao := 'Em viagem fluvial';
    when 'EM_TRANSITO' then
      v_novo_status := 'DISPONIVEL_RETIRADA'::public.status_encomenda;
      v_desc_padrao := 'Disponível para retirada em ' || v_enc.destino_cidade_nome;
    when 'DISPONIVEL_RETIRADA' then
      v_novo_status := 'ENTREGUE'::public.status_encomenda;
      v_desc_padrao := 'Entregue ao destinatário';
    when 'ENTREGUE' then
      raise exception using errcode = 'P0001', message = 'Encomenda já se encontra entregue.';
    when 'DEVOLVIDA' then
      raise exception using errcode = 'P0001', message = 'Encomenda com status devolvida não pode ser avançada.';
    else
      raise exception using errcode = 'P0001', message = 'Status da encomenda inválido para avanço: ' || v_enc.status::text || '.';
  end case;

  v_usuario_id := (select auth.uid());

  -- 4. Atualização da encomenda
  update public.encomendas
  set status = v_novo_status,
      frete_pago = case when v_novo_status = 'ENTREGUE' then true else frete_pago end,
      updated_at = now()
  where encomendas.id = v_enc.id;

  -- 5. Registro do evento de histórico
  insert into public.encomenda_eventos (
    encomenda_id,
    status,
    descricao,
    usuario_id,
    created_at
  ) values (
    v_enc.id,
    v_novo_status,
    coalesce(nullif(trim(avancar_encomenda.descricao), ''), v_desc_padrao),
    v_usuario_id,
    now()
  );

  return jsonb_build_object(
    'ok', true,
    'codigo', v_enc.codigo,
    'status_anterior', v_enc.status,
    'novo_status', v_novo_status
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 8. RPC: resumo_financeiro
--    Permissões: GERENTE, ADMIN
--    Agregações completas da receita no período informado
-- ------------------------------------------------------------------------------
create or replace function public.resumo_financeiro(inicio timestamptz, fim timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_empresa_id uuid;
  v_bruto numeric(10,2) := 0.00;
  v_taxas numeric(10,2) := 0.00;
  v_comissoes numeric(10,2) := 0.00;
  v_liquido numeric(10,2) := 0.00;
  v_fretes_pagos numeric(10,2) := 0.00;
  v_fretes_a_receber numeric(10,2) := 0.00;
  v_por_canal jsonb := '[]'::jsonb;
  v_por_metodo jsonb := '[]'::jsonb;
  v_por_linha jsonb := '[]'::jsonb;
  v_por_agencia jsonb := '[]'::jsonb;
  v_por_vendedor jsonb := '[]'::jsonb;
begin
  -- 1. Validação de papéis de acesso
  if not (select private.tem_papel('GERENTE'::public.papel_usuario, 'ADMIN'::public.papel_usuario)) then
    raise exception using errcode = 'P0001', message = 'Acesso não autorizado ao resumo financeiro.';
  end if;

  if resumo_financeiro.inicio is null or resumo_financeiro.fim is null then
    raise exception using errcode = 'P0001', message = 'Período financeiro incompleto: informe início e fim.';
  end if;

  if resumo_financeiro.inicio >= resumo_financeiro.fim then
    raise exception using errcode = 'P0001', message = 'Data inicial deve ser anterior à data final.';
  end if;

  v_empresa_id := coalesce(
    (select private.empresa_atual()),
    (select p.empresa_id from public.perfis p where p.id = (select auth.uid()))
  );

  if v_empresa_id is null then
    raise exception using errcode = 'P0001', message = 'Usuário sem empresa vinculada.';
  end if;

  -- 2. Agregações de pedidos pagos no período
  select
    coalesce(sum(p.total), 0.00),
    coalesce(sum(p.taxas), 0.00),
    coalesce(sum(p.comissao_agencia), 0.00)
  into v_bruto, v_taxas, v_comissoes
  from public.pedidos p
  where p.empresa_id = v_empresa_id
    and p.status = 'PAGO'
    and p.created_at >= resumo_financeiro.inicio
    and p.created_at < resumo_financeiro.fim;

  v_liquido := v_bruto - v_taxas - v_comissoes;

  -- 3. Agregações de fretes de encomendas
  select
    coalesce(sum(case when e.frete_pago then e.frete else 0.00 end), 0.00),
    coalesce(sum(case when not e.frete_pago then e.frete else 0.00 end), 0.00)
  into v_fretes_pagos, v_fretes_a_receber
  from public.encomendas e
  where e.empresa_id = v_empresa_id
    and e.created_at >= resumo_financeiro.inicio
    and e.created_at < resumo_financeiro.fim;

  -- 4. Distribuição por canal de venda
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'canal', c.canal,
        'valor', c.valor,
        'qtd', c.qtd
      ) order by c.valor desc
    ),
    '[]'::jsonb
  )
  into v_por_canal
  from (
    select p.canal::text as canal, sum(p.total) as valor, count(*) as qtd
    from public.pedidos p
    where p.empresa_id = v_empresa_id
      and p.status = 'PAGO'
      and p.created_at >= resumo_financeiro.inicio
      and p.created_at < resumo_financeiro.fim
    group by p.canal
  ) c;

  -- 5. Distribuição por método de pagamento (pagamentos aprovados)
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'metodo', m.metodo,
        'valor', m.valor,
        'qtd', m.qtd
      ) order by m.valor desc
    ),
    '[]'::jsonb
  )
  into v_por_metodo
  from (
    select pag.metodo::text as metodo, sum(pag.valor) as valor, count(*) as qtd
    from public.pagamentos pag
    join public.pedidos p on p.id = pag.pedido_id
    where p.empresa_id = v_empresa_id
      and p.status = 'PAGO'
      and pag.status = 'APROVADO'
      and p.created_at >= resumo_financeiro.inicio
      and p.created_at < resumo_financeiro.fim
    group by pag.metodo
  ) m;

  -- 6. Distribuição por linha fluvial
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'linha_id', l_agg.linha_id,
        'linha_nome', l_agg.linha_nome,
        'valor', l_agg.valor,
        'qtd', l_agg.qtd
      ) order by l_agg.valor desc
    ),
    '[]'::jsonb
  )
  into v_por_linha
  from (
    select
      l.id as linha_id,
      l.nome as linha_nome,
      sum(p.total) as valor,
      count(distinct p.id) as qtd
    from public.pedidos p
    join lateral (
      select pas.viagem_id from public.passagens pas where pas.pedido_id = p.id limit 1
    ) pas_first on true
    join public.viagens v on v.id = pas_first.viagem_id
    join public.linhas l on l.id = v.linha_id
    where p.empresa_id = v_empresa_id
      and p.status = 'PAGO'
      and p.created_at >= resumo_financeiro.inicio
      and p.created_at < resumo_financeiro.fim
    group by l.id, l.nome
  ) l_agg;

  -- 7. Distribuição por agência credenciada
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'agencia_id', a_agg.agencia_id,
        'agencia_nome', a_agg.agencia_nome,
        'valor', a_agg.valor,
        'comissao', a_agg.comissao,
        'qtd', a_agg.qtd
      ) order by a_agg.valor desc
    ),
    '[]'::jsonb
  )
  into v_por_agencia
  from (
    select
      a.id as agencia_id,
      a.nome as agencia_nome,
      sum(p.total) as valor,
      sum(p.comissao_agencia) as comissao,
      count(p.id) as qtd
    from public.pedidos p
    join public.agencias a on a.id = p.agencia_id
    where p.empresa_id = v_empresa_id
      and p.status = 'PAGO'
      and p.created_at >= resumo_financeiro.inicio
      and p.created_at < resumo_financeiro.fim
    group by a.id, a.nome
  ) a_agg;

  -- 8. Distribuição por vendedor
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'vendedor_id', v_agg.vendedor_id,
        'vendedor_nome', v_agg.vendedor_nome,
        'valor', v_agg.valor,
        'qtd', v_agg.qtd
      ) order by v_agg.valor desc
    ),
    '[]'::jsonb
  )
  into v_por_vendedor
  from (
    select
      perf.id as vendedor_id,
      perf.nome as vendedor_nome,
      sum(p.total) as valor,
      count(p.id) as qtd
    from public.pedidos p
    join public.perfis perf on perf.id = p.vendedor_id
    where p.empresa_id = v_empresa_id
      and p.status = 'PAGO'
      and p.created_at >= resumo_financeiro.inicio
      and p.created_at < resumo_financeiro.fim
    group by perf.id, perf.nome
  ) v_agg;

  -- 9. Retorno consolidado
  return jsonb_build_object(
    'bruto', v_bruto,
    'taxas', v_taxas,
    'comissoes', v_comissoes,
    'liquido', v_liquido,
    'fretes_pagos', v_fretes_pagos,
    'fretes_a_receber', v_fretes_a_receber,
    'por_canal', v_por_canal,
    'por_metodo', v_por_metodo,
    'por_linha', v_por_linha,
    'por_agencia', v_por_agencia,
    'por_vendedor', v_por_vendedor
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 9. RPC: confirmar_pagamento
--    Permissões: service_role, authenticated
--    Chamada via webhook de gateway ou processos de liquidação assíncrona
-- ------------------------------------------------------------------------------
create or replace function public.confirmar_pagamento(p_codigo text default null, p_gateway_id text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_agora timestamptz;
begin
  if (confirmar_pagamento.p_codigo is null or length(trim(confirmar_pagamento.p_codigo)) = 0)
     and (confirmar_pagamento.p_gateway_id is null or length(trim(confirmar_pagamento.p_gateway_id)) = 0) then
    raise exception using errcode = 'P0001', message = 'Informe o código do pedido ou o identificador do gateway.';
  end if;

  -- 1. Localização do pedido
  if confirmar_pagamento.p_gateway_id is not null and length(trim(confirmar_pagamento.p_gateway_id)) > 0 then
    select p.*
    into v_pedido
    from public.pagamentos pag
    join public.pedidos p on p.id = pag.pedido_id
    where pag.gateway_id = trim(confirmar_pagamento.p_gateway_id)
    for update of p;
  elsif confirmar_pagamento.p_codigo is not null and length(trim(confirmar_pagamento.p_codigo)) > 0 then
    select p.*
    into v_pedido
    from public.pedidos p
    where upper(trim(p.codigo)) = upper(trim(confirmar_pagamento.p_codigo))
    for update;
  end if;

  if v_pedido.id is null then
    raise exception using errcode = 'P0001', message = 'Pedido não encontrado.';
  end if;

  -- 2. Idempotência se o pedido já estiver pago
  if v_pedido.status = 'PAGO' then
    return jsonb_build_object(
      'ok', true,
      'codigo', v_pedido.codigo,
      'status', 'PAGO',
      'aviso', 'Pagamento já havia sido confirmado anteriormente.'
    );
  end if;

  -- 3. Validação de cancelamento/expiração prévia
  if v_pedido.status in ('CANCELADO', 'EXPIRADO', 'REEMBOLSADO') then
    raise exception using errcode = 'P0001',
      message = 'Não é possível confirmar pagamento para pedido com status ' || v_pedido.status::text || '.';
  end if;

  -- 4. Confirmação atômica
  v_agora := now();

  update public.pedidos
  set status = 'PAGO',
      expira_em = null,
      updated_at = v_agora
  where pedidos.id = v_pedido.id;

  update public.passagens
  set status = 'EMITIDA',
      updated_at = v_agora
  where passagens.pedido_id = v_pedido.id
    and passagens.status = 'RESERVADA';

  update public.pagamentos
  set status = 'APROVADO',
      pago_em = v_agora,
      updated_at = v_agora
  where pagamentos.pedido_id = v_pedido.id
    and pagamentos.status in ('PENDENTE', 'APROVADO');

  return jsonb_build_object(
    'ok', true,
    'codigo', v_pedido.codigo,
    'status', 'PAGO',
    'pago_em', v_agora
  );
end;
$$;

-- ------------------------------------------------------------------------------
-- 10. Grants de Execução Explícitos
-- ------------------------------------------------------------------------------
grant execute on function public.criar_pedido_balcao(jsonb) to authenticated, service_role;
grant execute on function public.cancelar_pedido(text, text) to authenticated, service_role;
grant execute on function public.validar_embarque(text) to authenticated, service_role;
grant execute on function public.alterar_status_viagem(uuid, public.status_viagem) to authenticated, service_role;
grant execute on function public.alternar_vendas_viagem(uuid, boolean) to authenticated, service_role;
grant execute on function public.criar_encomenda(jsonb) to authenticated, service_role;
grant execute on function public.avancar_encomenda(text, text) to authenticated, service_role;
grant execute on function public.resumo_financeiro(timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.confirmar_pagamento(text, text) to authenticated, service_role;
