-- ==============================================================================
-- Roteiro de teste — agências parceiras (etapa 4: repasse, transferência, sincronia)
--
-- ORDEM: 1º rode TODAS as migrations (20261002120000 a 20261002150000); depois rode este roteiro.
-- Rode tudo de uma vez no SQL Editor do Supabase (papel postgres). Tudo fica dentro de BEGIN/ROLLBACK:
-- nada é gravado. Qualquer falha de teste aborta o roteiro com SQLSTATE XX999 e a mensagem "TESTE FALHOU".
-- (Não usa pgTAP, então não entra no `supabase test db`.)
--
-- Cenário: linha A → B → C, lancha sem poltrona numerada com capacidade 5, tarifas A→B 50, B→C 50, A→C 100.
-- Piso da categoria INTEIRA = 80% da tabela. Taxa de embarque no porto A = 5.
-- ==============================================================================
begin;

-- Fixtures ----------------------------------------------------------------------
insert into public.empresas (id, razao_social, nome_fantasia, cnpj, email, telefone)
values ('e0e0e0e0-0000-0000-0000-000000000001', 'Empresa Teste Agencias', 'Teste Ag', '99.999.999/0001-99', 'ag@teste.com', '92999990000');

insert into public.cidades (id, nome, uf, sigla, slug) values
  ('c1c1c1c1-0000-0000-0000-00000000000a', 'Cidade A Teste', 'AM', 'AAA', 'cidade-a-ag-teste'),
  ('c1c1c1c1-0000-0000-0000-00000000000b', 'Cidade B Teste', 'AM', 'BBB', 'cidade-b-ag-teste'),
  ('c1c1c1c1-0000-0000-0000-00000000000c', 'Cidade C Teste', 'AM', 'CCC', 'cidade-c-ag-teste');

insert into public.portos (id, cidade_id, nome, taxa_embarque) values
  ('d1d1d1d1-0000-0000-0000-00000000000a', 'c1c1c1c1-0000-0000-0000-00000000000a', 'Porto A', 5.00),
  ('d1d1d1d1-0000-0000-0000-00000000000b', 'c1c1c1c1-0000-0000-0000-00000000000b', 'Porto B', 0.00),
  ('d1d1d1d1-0000-0000-0000-00000000000c', 'c1c1c1c1-0000-0000-0000-00000000000c', 'Porto C', 0.00);

insert into public.embarcacoes (id, empresa_id, nome, capacidade_passageiros, colunas_mapa, assento_livre)
values ('b1b1b1b1-0000-0000-0000-000000000001', 'e0e0e0e0-0000-0000-0000-000000000001', 'Lancha Teste', 5, 4, true);

insert into public.linhas (id, empresa_id, nome) values ('a1a1a1a1-0000-0000-0000-000000000001', 'e0e0e0e0-0000-0000-0000-000000000001', 'A-B-C Teste');

insert into public.paradas_linha (id, linha_id, porto_id, ordem, minutos_desde_origem) values
  ('f1f1f1f1-0000-0000-0000-00000000000a', 'a1a1a1a1-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-00000000000a', 0, 0),
  ('f1f1f1f1-0000-0000-0000-00000000000b', 'a1a1a1a1-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-00000000000b', 1, 60),
  ('f1f1f1f1-0000-0000-0000-00000000000c', 'a1a1a1a1-0000-0000-0000-000000000001', 'd1d1d1d1-0000-0000-0000-00000000000c', 2, 120);

insert into public.tarifas_trecho (linha_id, origem_parada_id, destino_parada_id, valor) values
  ('a1a1a1a1-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-00000000000a', 'f1f1f1f1-0000-0000-0000-00000000000b', 50),
  ('a1a1a1a1-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-00000000000b', 'f1f1f1f1-0000-0000-0000-00000000000c', 50),
  ('a1a1a1a1-0000-0000-0000-000000000001', 'f1f1f1f1-0000-0000-0000-00000000000a', 'f1f1f1f1-0000-0000-0000-00000000000c', 100);

insert into public.viagens (id, empresa_id, linha_id, embarcacao_id, partida)
values ('e1e1e1e1-0000-0000-0000-000000000001', 'e0e0e0e0-0000-0000-0000-000000000001', 'a1a1a1a1-0000-0000-0000-000000000001',
        'b1b1b1b1-0000-0000-0000-000000000001', now() + interval '2 days');

insert into public.viagem_pisos (viagem_id, tipo, piso_percentual) values ('e1e1e1e1-0000-0000-0000-000000000001', 'INTEIRA', 80);

insert into public.agencias_parceiras (id, empresa_id, nome, responsavel, email, telefone, senha_hash, status) values
  ('a9a9a9a9-0000-0000-0000-000000000001', 'e0e0e0e0-0000-0000-0000-000000000001', 'Agencia Aprovada', 'Resp 1', 'aprovada@teste.com', '1', 'x', 'APROVADA'),
  ('a9a9a9a9-0000-0000-0000-000000000002', 'e0e0e0e0-0000-0000-0000-000000000001', 'Agencia Pendente', 'Resp 2', 'pendente@teste.com', '2', 'x', 'PENDENTE');

-- Helper de teste: monta o payload de venda ------------------------------------------
create function pg_temp.payload(p_origem int, p_destino int, p_cobrado numeric, p_doc text, p_nome text default 'Passageiro')
returns jsonb language sql as $$
  select jsonb_build_object(
    'viagem_id', 'e1e1e1e1-0000-0000-0000-000000000001', 'origem_ordem', p_origem, 'destino_ordem', p_destino,
    'tipo', 'INTEIRA', 'valor_cobrado', p_cobrado,
    'passageiro', jsonb_build_object('nome', p_nome, 'documento', p_doc, 'telefone', '92988887777',
                                     'nascimento', '1990-05-10', 'aceita_marketing', true));
$$;

-- Três vendas A→B: Maria (60), João (50), Ana (70) --------------------------------------------
create temp table t_b (nome text primary key, id uuid, passagem uuid);
do $$
declare r jsonb; n text; v numeric; d text;
begin
  for n, v, d in select * from (values ('Maria', 60, '111.111.111-11'), ('Joao', 50, '222.222.222-22'), ('Ana', 70, '333.333.333-33')) as x(a, b, c) loop
    r := public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 1, v, d, n));
    insert into t_b select n, (r->>'bilhete_id')::uuid, (r->>'passagem_id')::uuid;
  end loop;
end $$;

-- 1. Transferência: troca o titular, mantém QR, status TRANSFERIDO, histórico completo ---------------
do $$
declare b record; p record; qr_antes text; qr_depois text; h int;
begin
  select qr_token into qr_antes from public.passagens where id = (select passagem from t_b where nome = 'Maria');
  perform public.transferir_bilhete_agencia('e0e0e0e0-0000-0000-0000-000000000001', null, (select id from t_b where nome = 'Maria'),
    jsonb_build_object('nome', 'Carlos Novo', 'documento', '999.999.999-99', 'telefone', '92911112222', 'nascimento', '1985-01-01', 'aceita_marketing', false),
    'vendeu a passagem');
  select * into b from public.bilhetes_agencia where id = (select id from t_b where nome = 'Maria');
  select * into p from public.passagens where id = b.passagem_id;
  qr_depois := p.qr_token;
  select count(*) into h from public.bilhete_agencia_historico where bilhete_id = b.id and evento = 'TRANSFERENCIA';
  if b.status <> 'TRANSFERIDO' or p.nome <> 'Carlos Novo' or p.documento <> '999.999.999-99' or qr_antes <> qr_depois or h <> 1
     or (select documento from public.passageiros where id = b.passageiro_id) <> '99999999999' then
    raise exception 'TESTE FALHOU: transferência (status %, nome %, qr igual %, historico %)', b.status, p.nome, qr_antes = qr_depois, h using errcode = 'XX999';
  end if;
  raise notice 'OK 1 - bilhete transferido, QR mantido, histórico registrado';
end $$;

-- 2. Transferir para o mesmo documento é recusado ---------------------------------------------------
do $$
begin
  begin
    perform public.transferir_bilhete_agencia('e0e0e0e0-0000-0000-0000-000000000001', null, (select id from t_b where nome = 'Maria'),
      jsonb_build_object('nome', 'Outro Nome', 'documento', '999.999.999-99', 'telefone', '1', 'nascimento', '1985-01-01'), null);
    raise exception 'TESTE FALHOU: aceitou transferir para o mesmo documento' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
    if sqlerrm not like '%mesmo documento%' then raise exception 'TESTE FALHOU: erro inesperado: %', sqlerrm using errcode = 'XX999'; end if;
  end;
  raise notice 'OK 2 - mesmo documento recusado';
end $$;

-- 3. A agência não cancela bilhete transferido -------------------------------------------------------
do $$
begin
  begin
    perform public.cancelar_bilhete_agencia('a9a9a9a9-0000-0000-0000-000000000001', (select id from t_b where nome = 'Maria'), 'tentativa');
    raise exception 'TESTE FALHOU: agência cancelou bilhete transferido' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
  end;
  raise notice 'OK 3 - agência não cancela bilhete transferido';
end $$;

-- 4. Baixa do repasse: marca pago, ignora o que já estava pago, e desfaz ------------------------------
do $$
declare r jsonb; r2 jsonb; pagos int;
begin
  -- Maria (transferida) e Joao: repasse = piso (80% de 50 = 40) + taxa 5 = 45 cada
  r := public.marcar_repasse_agencia('e0e0e0e0-0000-0000-0000-000000000001', null,
         array[(select id from t_b where nome = 'Maria'), (select id from t_b where nome = 'Joao')], true, 'teste');
  if (r->>'quantidade')::int <> 2 or (r->>'total')::numeric <> 90 then
    raise exception 'TESTE FALHOU: baixa retornou %', r using errcode = 'XX999';
  end if;
  r2 := public.marcar_repasse_agencia('e0e0e0e0-0000-0000-0000-000000000001', null, array[(select id from t_b where nome = 'Joao')], true, null);
  if (r2->>'quantidade')::int <> 0 then
    raise exception 'TESTE FALHOU: baixou duas vezes o mesmo bilhete' using errcode = 'XX999';
  end if;
  select count(*) into pagos from public.bilhetes_agencia where repasse_pago and repasse_pago_em is not null;
  if pagos <> 2 then raise exception 'TESTE FALHOU: % bilhetes pagos (esperado 2)', pagos using errcode = 'XX999'; end if;
  r := public.marcar_repasse_agencia('e0e0e0e0-0000-0000-0000-000000000001', null, array[(select id from t_b where nome = 'Joao')], false, null);
  if (r->>'quantidade')::int <> 1 or (select repasse_pago from public.bilhetes_agencia where id = (select id from t_b where nome = 'Joao')) then
    raise exception 'TESTE FALHOU: desfazer baixa' using errcode = 'XX999';
  end if;
  raise notice 'OK 4 - baixa, idempotência e desfazer';
end $$;

-- 5. Agência não cancela bilhete com repasse já baixado (Maria, transferida, já é recusada; testa Joao após nova baixa)
do $$
begin
  perform public.marcar_repasse_agencia('e0e0e0e0-0000-0000-0000-000000000001', null, array[(select id from t_b where nome = 'Joao')], true, null);
  begin
    perform public.cancelar_bilhete_agencia('a9a9a9a9-0000-0000-0000-000000000001', (select id from t_b where nome = 'Joao'), 'tentativa');
    raise exception 'TESTE FALHOU: cancelou bilhete com repasse baixado' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
    if sqlerrm not like '%repasse%' then raise exception 'TESTE FALHOU: erro inesperado: %', sqlerrm using errcode = 'XX999'; end if;
  end;
  raise notice 'OK 5 - repasse baixado trava o cancelamento pela agência';
end $$;

-- 6. Cancelamento pelo sistema interno (passagem) cancela o bilhete via gatilho, devolve a vaga, e baixa em cancelado é ignorada
do $$
declare lot record; h int; r jsonb;
begin
  -- Ana (EMITIDO, sem baixa): a empresa cancela a passagem direto
  update public.passagens set status = 'CANCELADA' where id = (select passagem from t_b where nome = 'Ana');
  if (select status from public.bilhetes_agencia where id = (select id from t_b where nome = 'Ana')) <> 'CANCELADO' then
    raise exception 'TESTE FALHOU: gatilho não cancelou o bilhete' using errcode = 'XX999';
  end if;
  select count(*) into h from public.bilhete_agencia_historico where bilhete_id = (select id from t_b where nome = 'Ana') and evento = 'CANCELAMENTO_INTERNO';
  if h <> 1 then raise exception 'TESTE FALHOU: histórico do cancelamento interno (%)', h using errcode = 'XX999'; end if;
  select * into lot from public.lotacao_por_trecho('e1e1e1e1-0000-0000-0000-000000000001') where ordem_origem = 0;
  if lot.ocupados <> 2 then raise exception 'TESTE FALHOU: vaga não voltou (ocupados %)', lot.ocupados using errcode = 'XX999'; end if;
  r := public.marcar_repasse_agencia('e0e0e0e0-0000-0000-0000-000000000001', null, array[(select id from t_b where nome = 'Ana')], true, null);
  if (r->>'quantidade')::int <> 0 then raise exception 'TESTE FALHOU: deu baixa em bilhete cancelado' using errcode = 'XX999'; end if;
  raise notice 'OK 6 - cancelamento interno sincroniza bilhete e devolve vaga; baixa em cancelado ignorada';
end $$;

-- 7. Cancelamento interno de bilhete TRANSFERIDO também sincroniza ---------------------------------------
do $$
begin
  update public.passagens set status = 'CANCELADA' where id = (select passagem from t_b where nome = 'Maria');
  if (select status from public.bilhetes_agencia where id = (select id from t_b where nome = 'Maria')) <> 'CANCELADO' then
    raise exception 'TESTE FALHOU: bilhete transferido não foi cancelado pelo gatilho' using errcode = 'XX999';
  end if;
  raise notice 'OK 7 - bilhete transferido cancelado pelo gatilho';
end $$;

-- 8. Permissões das funções novas -------------------------------------------------------------------------
do $$
begin
  if has_function_privilege('anon', 'public.marcar_repasse_agencia(uuid, uuid, uuid[], boolean, text)', 'execute')
     or has_function_privilege('authenticated', 'public.marcar_repasse_agencia(uuid, uuid, uuid[], boolean, text)', 'execute')
     or has_function_privilege('authenticated', 'public.transferir_bilhete_agencia(uuid, uuid, uuid, jsonb, text)', 'execute')
     or has_function_privilege('anon', 'public.resumo_agencias_parceiras(timestamptz, timestamptz)', 'execute')
     or not has_function_privilege('authenticated', 'public.resumo_agencias_parceiras(timestamptz, timestamptz)', 'execute') then
    raise exception 'TESTE FALHOU: permissões das funções da etapa 4' using errcode = 'XX999';
  end if;
  raise notice 'OK 8 - permissões';
end $$;

rollback;
