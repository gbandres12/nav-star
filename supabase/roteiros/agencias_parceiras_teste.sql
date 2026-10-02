-- ==============================================================================
-- Roteiro de teste — agências parceiras (etapa 1)
--
-- ORDEM: 1º rode a migration 20261002120000_agencias_parceiras.sql; depois rode este roteiro.
-- Rode tudo de uma vez no SQL Editor do Supabase (papel postgres). Tudo fica dentro de BEGIN/ROLLBACK:
-- nada é gravado. Qualquer falha de teste aborta o roteiro com SQLSTATE XX999 e a mensagem "TESTE FALHOU".
-- (Não usa pgTAP, então não entra no `supabase test db`.)
--
-- Cenário: linha A → B → C, lancha sem poltrona numerada com capacidade 2, tarifas A→B 50, B→C 50, A→C 100.
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
values ('b1b1b1b1-0000-0000-0000-000000000001', 'e0e0e0e0-0000-0000-0000-000000000001', 'Lancha Teste', 2, 4, true);

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

-- 1. Venda: A→B por 60 (piso 40 = 80% de 50; taxa 5) ---------------------------------------
do $$
declare r jsonb; b record; p record;
begin
  r := public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 1, 60, '111.111.111-11', 'Maria'));
  select * into b from public.bilhetes_agencia where id = (r->>'bilhete_id')::uuid;
  select * into p from public.passagens where id = b.passagem_id;
  if b.status <> 'EMITIDO' or b.valor_piso <> 40 or b.valor_cobrado <> 60 or b.valor_repasse <> 45 or b.taxa_embarque <> 5
     or p.status <> 'EMITIDA' or p.valor <> 60 or b.codigo_validacao <> p.qr_token
     or (select canal from public.pedidos where id = b.pedido_id) <> 'AGENCIA' then
    raise exception 'TESTE FALHOU: venda gravou dados errados: %', r using errcode = 'XX999';
  end if;
  raise notice 'OK 1 - venda emitida (bilhete %, repasse %)', b.numero, b.valor_repasse;
end $$;

-- 2. Preço abaixo do piso é recusado (39,99 < 40) e o piso exato é aceito ----------------------
do $$
begin
  begin
    perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 1, 39.99, '222.222.222-22'));
    raise exception 'TESTE FALHOU: aceitou valor abaixo do piso' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
    if sqlerrm not like '%abaixo do mínimo%' then
      raise exception 'TESTE FALHOU: erro inesperado: %', sqlerrm using errcode = 'XX999';
    end if;
  end;
  raise notice 'OK 2a - abaixo do piso recusado';
end $$;

-- 3. Agência pendente não vende ------------------------------------------------------------
do $$
begin
  begin
    perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000002', pg_temp.payload(0, 1, 60, '333.333.333-33'));
    raise exception 'TESTE FALHOU: agência pendente conseguiu vender' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
    if sqlerrm not like '%sem autorização%' then
      raise exception 'TESTE FALHOU: erro inesperado: %', sqlerrm using errcode = 'XX999';
    end if;
  end;
  raise notice 'OK 3 - agência pendente recusada';
end $$;

-- 4. Trecho lotado: segunda vaga A→B (capacidade 2), depois a terceira falha ----------------------
do $$
begin
  perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 1, 40, '444.444.444-44', 'João'));
  begin
    perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 1, 60, '555.555.555-55'));
    raise exception 'TESTE FALHOU: vendeu além da capacidade no trecho A-B' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
    if sqlerrm not like '%Sem vagas%' then
      raise exception 'TESTE FALHOU: erro inesperado: %', sqlerrm using errcode = 'XX999';
    end if;
  end;
  -- venda que atravessa o trecho lotado (A→C) também falha
  begin
    perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 2, 100, '555.555.555-55'));
    raise exception 'TESTE FALHOU: A→C passou por trecho lotado' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
  end;
  raise notice 'OK 4 - trecho lotado recusa A→B e A→C';
end $$;

-- 5. Trecho vizinho (B→C) ainda tem vaga; a lotação por trecho reflete isso --------------------------
do $$
declare ab record; bc record;
begin
  perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(1, 2, 50, '666.666.666-66'));
  select * into ab from public.lotacao_por_trecho('e1e1e1e1-0000-0000-0000-000000000001') where ordem_origem = 0;
  select * into bc from public.lotacao_por_trecho('e1e1e1e1-0000-0000-0000-000000000001') where ordem_origem = 1;
  if ab.ocupados <> 2 or ab.livres <> 0 or bc.ocupados <> 1 or bc.livres <> 1 then
    raise exception 'TESTE FALHOU: lotação A-B=%/% B-C=%/%', ab.ocupados, ab.livres, bc.ocupados, bc.livres using errcode = 'XX999';
  end if;
  raise notice 'OK 5 - B→C vendido com A→B lotado; lotação A-B 2/2, B-C 1/2';
end $$;

-- 6. Cancelamento devolve a vaga ----------------------------------------------------------------
do $$
declare v_b uuid; lot record;
begin
  select id into v_b from public.bilhetes_agencia
   where valor_cobrado = 60 and status = 'EMITIDO' limit 1;  -- bilhete da Maria (teste 1)
  perform public.cancelar_bilhete_agencia('a9a9a9a9-0000-0000-0000-000000000001', v_b, 'teste');
  select * into lot from public.lotacao_por_trecho('e1e1e1e1-0000-0000-0000-000000000001') where ordem_origem = 0;
  if lot.ocupados <> 1 or lot.livres <> 1 then
    raise exception 'TESTE FALHOU: vaga não voltou após cancelar (ocupados=%)', lot.ocupados using errcode = 'XX999';
  end if;
  if (select status from public.bilhetes_agencia where id = v_b) <> 'CANCELADO'
     or (select p.status from public.passagens p join public.bilhetes_agencia b on b.passagem_id = p.id where b.id = v_b) <> 'CANCELADA' then
    raise exception 'TESTE FALHOU: status do bilhete/passagem após cancelar' using errcode = 'XX999';
  end if;
  -- cancelar de novo é recusado
  begin
    perform public.cancelar_bilhete_agencia('a9a9a9a9-0000-0000-0000-000000000001', v_b, 'de novo');
    raise exception 'TESTE FALHOU: cancelou duas vezes' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
  end;
  -- e a vaga devolvida pode ser vendida de novo
  perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 1, 50, '777.777.777-77'));
  raise notice 'OK 6 - cancelamento devolveu a vaga e ela foi revendida';
end $$;

-- 7. Passageiro único por documento (Maria vendeu e cancelou; compra de novo com o mesmo CPF formatado diferente)
do $$
declare n int;
begin
  perform public.cancelar_bilhete_agencia('a9a9a9a9-0000-0000-0000-000000000001',
    (select id from public.bilhetes_agencia where status = 'EMITIDO' and valor_cobrado = 50 and taxa_embarque = 5 limit 1), 'liberar vaga');
  perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(0, 1, 60, '11111111111', 'Maria Atualizada'));
  select count(*) into n from public.passageiros where empresa_id = 'e0e0e0e0-0000-0000-0000-000000000001' and documento = '11111111111';
  if n <> 1 then
    raise exception 'TESTE FALHOU: % cadastros para o mesmo documento', n using errcode = 'XX999';
  end if;
  if (select count(*) from public.bilhetes_agencia b join public.passageiros p on p.id = b.passageiro_id where p.documento = '11111111111') <> 2 then
    raise exception 'TESTE FALHOU: os dois bilhetes deveriam apontar para o mesmo passageiro' using errcode = 'XX999';
  end if;
  raise notice 'OK 7 - passageiro único por documento (2 bilhetes, 1 cadastro)';
end $$;

-- 8. Agência suspensa depois de aprovada deixa de vender e de cancelar ---------------------------
do $$
begin
  update public.agencias_parceiras set status = 'SUSPENSA' where id = 'a9a9a9a9-0000-0000-0000-000000000001';
  begin
    perform public.vender_passagem_agencia('a9a9a9a9-0000-0000-0000-000000000001', pg_temp.payload(1, 2, 50, '888.888.888-88'));
    raise exception 'TESTE FALHOU: agência suspensa vendeu' using errcode = 'XX999';
  exception when others then
    if sqlstate = 'XX999' then raise; end if;
  end;
  raise notice 'OK 8 - agência suspensa recusada';
end $$;

-- 9. Preços do trecho (tabela, piso e taxa) ------------------------------------------------------
do $$
declare r record;
begin
  select * into r from public.precos_agencia_trecho('e1e1e1e1-0000-0000-0000-000000000001', 0, 1) where tipo = 'INTEIRA';
  if r.valor_tabela <> 50 or r.valor_piso <> 40 or r.taxa_embarque <> 5 then
    raise exception 'TESTE FALHOU: preços % / % / %', r.valor_tabela, r.valor_piso, r.taxa_embarque using errcode = 'XX999';
  end if;
  raise notice 'OK 9 - tabela 50, piso 40, taxa 5';
end $$;

-- 10. Segurança: anon/authenticated não executam as funções nem leem senha_hash --------------------
do $$
begin
  if has_function_privilege('anon', 'public.vender_passagem_agencia(uuid, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.vender_passagem_agencia(uuid, jsonb)', 'execute')
     or has_function_privilege('authenticated', 'public.cancelar_bilhete_agencia(uuid, uuid, text)', 'execute')
     or has_function_privilege('anon', 'public.lotacao_por_trecho(uuid)', 'execute') then
    raise exception 'TESTE FALHOU: função do portal executável por anon/authenticated' using errcode = 'XX999';
  end if;
  if has_column_privilege('authenticated', 'public.agencias_parceiras', 'senha_hash', 'select')
     or has_table_privilege('anon', 'public.agencias_parceiras', 'select')
     or has_table_privilege('anon', 'public.bilhetes_agencia', 'select') then
    raise exception 'TESTE FALHOU: acesso indevido às tabelas das agências' using errcode = 'XX999';
  end if;
  raise notice 'OK 10 - permissões fechadas';
end $$;

rollback;
