-- ==============================================================================
-- Testes de RLS (Row Level Security) - NavStar
-- Arquivo: supabase/tests/rls.test.sql
-- Conforme etapa B9 e matriz B3 do backend-plan.md
-- ==============================================================================

begin;

-- Garante que a extensão pgTAP esteja disponível na transação de teste
create extension if not exists pgtap;

-- Plano de execução com 30 testes granulares cobrindo a matriz RLS
select plan(30);

-- ==============================================================================
-- 1. Fixture de Dados de Teste
-- ==============================================================================

-- 1.1 Usuários de Autenticação (auth.users)
insert into auth.users (id, email, aud, role) values
  ('a0000000-0000-0000-0000-000000000001', 'admin_a@teste.com', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000002', 'vendedor_a1@teste.com', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000003', 'vendedor_a2@teste.com', 'authenticated', 'authenticated'),
  ('a0000000-0000-0000-0000-000000000004', 'conferente_a@teste.com', 'authenticated', 'authenticated'),
  ('b0000000-0000-0000-0000-000000000001', 'admin_b@teste.com', 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- 1.2 Empresas (Empresa A e Empresa B para teste multitenant)
insert into public.empresas (id, razao_social, nome_fantasia, cnpj, email, telefone) values
  ('e1111111-1111-1111-1111-111111111111', 'Empresa A Ltda', 'Navegação A', '00.000.001/0001-01', 'contato@a.com', '92999990001'),
  ('e2222222-2222-2222-2222-222222222222', 'Empresa B Ltda', 'Navegação B', '00.000.002/0001-02', 'contato@b.com', '92999990002')
on conflict (id) do nothing;

-- 1.3 Cidades e Portos
insert into public.cidades (id, nome, uf, sigla, slug) values
  ('c1111111-1111-1111-1111-111111111111', 'Cidade Teste 1', 'AM', 'CT1', 'cidade-teste-1'),
  ('c2222222-2222-2222-2222-222222222222', 'Cidade Teste 2', 'AM', 'CT2', 'cidade-teste-2')
on conflict (id) do nothing;

insert into public.portos (id, cidade_id, nome) values
  ('f1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Porto Teste 1'),
  ('f2222222-2222-2222-2222-222222222222', 'c2222222-2222-2222-2222-222222222222', 'Porto Teste 2')
on conflict (id) do nothing;

-- 1.4 Agências (A1 e A2 da Empresa A; B1 da Empresa B)
insert into public.agencias (id, empresa_id, cidade_id, nome) values
  ('a1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', 'Agencia A1'),
  ('a2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Agencia A2'),
  ('a3333333-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 'c1111111-1111-1111-1111-111111111111', 'Agencia B1')
on conflict (id) do nothing;

-- 1.5 Perfis dos Funcionários
insert into public.perfis (id, empresa_id, agencia_id, nome, papel, ativo) values
  ('a0000000-0000-0000-0000-000000000001', 'e1111111-1111-1111-1111-111111111111', null, 'Admin A', 'ADMIN', true),
  ('a0000000-0000-0000-0000-000000000002', 'e1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Vendedor A1', 'VENDEDOR', true),
  ('a0000000-0000-0000-0000-000000000003', 'e1111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', 'Vendedor A2', 'VENDEDOR', true),
  ('a0000000-0000-0000-0000-000000000004', 'e1111111-1111-1111-1111-111111111111', null, 'Conferente A', 'CONFERENTE', true),
  ('b0000000-0000-0000-0000-000000000001', 'e2222222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'Admin B', 'ADMIN', true)
on conflict (id) do nothing;

-- 1.6 Embarcações e Assentos
insert into public.embarcacoes (id, empresa_id, nome, capacidade_passageiros, colunas_mapa) values
  ('b1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Barco A', 50, 4),
  ('b2222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'Barco B', 50, 4)
on conflict (id) do nothing;

insert into public.assentos (id, embarcacao_id, codigo, fileira, coluna) values
  ('01111111-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', '01', 1, 1),
  ('02222222-2222-2222-2222-222222222222', 'b2222222-2222-2222-2222-222222222222', '01', 1, 1)
on conflict (id) do nothing;

-- 1.7 Linhas e Viagens
insert into public.linhas (id, empresa_id, nome, ativa) values
  ('00000001-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'Linha A Ativa', true),
  ('00000002-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'Linha A Inativa', false),
  ('00000003-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 'Linha B Ativa', true)
on conflict (id) do nothing;

insert into public.viagens (id, empresa_id, linha_id, embarcacao_id, partida, status) values
  ('00000011-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', '00000001-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', now() + interval '1 day', 'PROGRAMADA'),
  ('00000012-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', '00000001-1111-1111-1111-111111111111', 'b1111111-1111-1111-1111-111111111111', now() + interval '2 days', 'CANCELADA'),
  ('00000013-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', '00000003-3333-3333-3333-333333333333', 'b2222222-2222-2222-2222-222222222222', now() + interval '1 day', 'PROGRAMADA')
on conflict (id) do nothing;

-- 1.8 Clientes
insert into public.clientes (id, nome, cpf, telefone) values
  ('cc111111-1111-1111-1111-111111111111', 'Cliente Teste RLS', '12345678900', '92999990000')
on conflict (id) do nothing;

-- 1.9 Pedidos
insert into public.pedidos (id, empresa_id, codigo, numero, canal, status, comprador_nome, comprador_telefone, vendedor_id, agencia_id, subtotal, total) values
  ('d1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'PED-A1', 'NUM-A1', 'BALCAO', 'PAGO', 'Cliente 1', '92999991111', 'a0000000-0000-0000-0000-000000000002', 'a1111111-1111-1111-1111-111111111111', 100, 100),
  ('d2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'PED-A2', 'NUM-A2', 'BALCAO', 'PAGO', 'Cliente 2', '92999992222', 'a0000000-0000-0000-0000-000000000003', 'a2222222-2222-2222-2222-222222222222', 100, 100),
  ('d3333333-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 'PED-B1', 'NUM-B1', 'BALCAO', 'PAGO', 'Cliente 3', '92999993333', 'b0000000-0000-0000-0000-000000000001', 'a3333333-3333-3333-3333-333333333333', 100, 100)
on conflict (id) do nothing;

-- 1.10 Passagens
insert into public.passagens (id, empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem, nome, documento, valor, status, qr_token) values
  ('00000021-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', '00000011-1111-1111-1111-111111111111', '01111111-1111-1111-1111-111111111111', 0, 1, 'Passageiro 1', '12345678901', 100, 'EMITIDA', 'QR-A1'),
  ('00000022-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', '00000011-1111-1111-1111-111111111111', '01111111-1111-1111-1111-111111111111', 1, 2, 'Passageiro 2', '12345678902', 100, 'EMITIDA', 'QR-A2'),
  ('00000023-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 'd3333333-3333-3333-3333-333333333333', '00000013-3333-3333-3333-333333333333', '02222222-2222-2222-2222-222222222222', 0, 1, 'Passageiro 3', '12345678903', 100, 'EMITIDA', 'QR-B1')
on conflict (id) do nothing;

-- 1.11 Pagamentos
insert into public.pagamentos (id, empresa_id, pedido_id, metodo, status, valor) values
  ('ee000001-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'd1111111-1111-1111-1111-111111111111', 'PIX', 'APROVADO', 100.00),
  ('ee000002-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222', 'PIX', 'APROVADO', 100.00),
  ('ee000003-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 'd3333333-3333-3333-3333-333333333333', 'PIX', 'APROVADO', 100.00)
on conflict (id) do nothing;

-- 1.12 Encomendas
insert into public.encomendas (id, empresa_id, codigo, origem_cidade_id, destino_cidade_id, remetente_nome, remetente_doc, remetente_tel, destinatario_nome, destinatario_tel, descricao, peso_kg, frete) values
  ('ee111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'EN-TESTE-A', 'c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Remetente A', '111', '92999990001', 'Destinatario A', '92999990002', 'Carga A', 5.0, 50.00),
  ('ee222222-2222-2222-2222-222222222222', 'e2222222-2222-2222-2222-222222222222', 'EN-TESTE-B', 'c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222', 'Remetente B', '222', '92999990003', 'Destinatario B', '92999990004', 'Carga B', 10.0, 90.00)
on conflict (id) do nothing;

-- 1.13 Sessões de Caixa
insert into public.caixa_sessoes (id, usuario_id, valor_abertura) values
  ('cc000001-1111-1111-1111-111111111111', 'a0000000-0000-0000-0000-000000000002', 100.00),
  ('cc000002-2222-2222-2222-222222222222', 'a0000000-0000-0000-0000-000000000003', 150.00)
on conflict (id) do nothing;

-- ==============================================================================
-- 2. Testes de Acesso do Visitante Anônimo (anon)
-- ==============================================================================
set local role anon;

select is(
  (select count(*)::int from public.cidades where id in ('c1111111-1111-1111-1111-111111111111', 'c2222222-2222-2222-2222-222222222222')),
  2,
  'anon lê cidades públicas'
);

select is(
  (select count(*)::int from public.linhas where id = '00000001-1111-1111-1111-111111111111'),
  1,
  'anon lê linhas ativas'
);

select is(
  (select count(*)::int from public.linhas where id = '00000002-2222-2222-2222-222222222222'),
  0,
  'anon NÃO lê linhas inativas'
);

select is(
  (select count(*)::int from public.empresa_publica where id = 'e1111111-1111-1111-1111-111111111111'),
  1,
  'anon lê view empresa_publica'
);

select is(
  (select count(*)::int from public.passagens where id in ('00000021-1111-1111-1111-111111111111', '00000022-2222-2222-2222-222222222222')),
  0,
  'anon NÃO lê passagens'
);

select is(
  (select count(*)::int from public.pedidos where id in ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222')),
  0,
  'anon NÃO lê pedidos'
);

select is(
  (select count(*)::int from public.clientes where id = 'cc111111-1111-1111-1111-111111111111'),
  0,
  'anon NÃO lê clientes'
);

select is(
  (select count(*)::int from public.pagamentos where id in ('ee000001-1111-1111-1111-111111111111', 'ee000002-2222-2222-2222-222222222222')),
  0,
  'anon NÃO lê pagamentos'
);

select is(
  (select count(*)::int from public.encomendas where id = 'ee111111-1111-1111-1111-111111111111'),
  0,
  'anon NÃO lê encomendas'
);

select is(
  (select count(*)::int from public.viagens where id = '00000011-1111-1111-1111-111111111111'),
  1,
  'anon lê viagens programadas'
);

select is(
  (select count(*)::int from public.viagens where id = '00000012-2222-2222-2222-222222222222'),
  0,
  'anon NÃO lê viagens canceladas'
);

-- ==============================================================================
-- 3. Testes do VENDEDOR Autenticado (Vendedor A1 da Agência A1)
-- ==============================================================================
reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select is(
  (select count(*)::int from public.pedidos where id = 'd1111111-1111-1111-1111-111111111111'),
  1,
  'VENDEDOR lê pedidos vendidos diretamente por ele'
);

select is(
  (select count(*)::int from public.pedidos where id = 'd1111111-1111-1111-1111-111111111111' and agencia_id = 'a1111111-1111-1111-1111-111111111111'),
  1,
  'VENDEDOR lê pedidos vinculados à sua agência'
);

select is(
  (select count(*)::int from public.pedidos where id = 'd2222222-2222-2222-2222-222222222222'),
  0,
  'VENDEDOR NÃO lê pedidos de outro vendedor de outra agência'
);

select is(
  (select count(*)::int from public.passagens where id = '00000021-1111-1111-1111-111111111111'),
  1,
  'VENDEDOR lê passagens dos seus pedidos / agência'
);

select is(
  (select count(*)::int from public.passagens where id = '00000022-2222-2222-2222-222222222222'),
  0,
  'VENDEDOR NÃO lê passagens de pedidos de outros vendedores'
);

select is(
  (select count(*)::int from public.caixa_sessoes where id = 'cc000001-1111-1111-1111-111111111111'),
  1,
  'VENDEDOR lê sua própria sessão de caixa'
);

select is(
  (select count(*)::int from public.caixa_sessoes where id = 'cc000002-2222-2222-2222-222222222222'),
  0,
  'VENDEDOR NÃO lê sessões de caixa de outro operador'
);

select is(
  (select count(*)::int from public.perfis where id = 'a0000000-0000-0000-0000-000000000002'),
  1,
  'VENDEDOR lê seu próprio perfil'
);

select is(
  (select count(*)::int from public.perfis where id = 'a0000000-0000-0000-0000-000000000003'),
  0,
  'VENDEDOR NÃO lê perfis de outros funcionários'
);

-- ==============================================================================
-- 4. Testes do CONFERENTE Autenticado (Conferente A da Empresa A)
-- ==============================================================================
reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000004", "role": "authenticated"}';

select is(
  (select count(*)::int from public.pedidos where id in ('d1111111-1111-1111-1111-111111111111', 'd2222222-2222-2222-2222-222222222222')),
  0,
  'CONFERENTE NÃO lê pedidos'
);

select is(
  (select count(*)::int from public.passagens where empresa_id = 'e1111111-1111-1111-1111-111111111111'),
  2,
  'CONFERENTE lê todas as passagens de sua empresa (manifesto)'
);

select is(
  (select count(*)::int from public.passagens where empresa_id = 'e2222222-2222-2222-2222-222222222222'),
  0,
  'CONFERENTE NÃO lê passagens de outra empresa'
);

-- ==============================================================================
-- 5. Testes de Isolamento Multitenant (Empresa A vs Empresa B)
-- ==============================================================================
reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "a0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.pedidos where empresa_id = 'e1111111-1111-1111-1111-111111111111'),
  2,
  'Multitenancy: ADMIN da Empresa A lê todos os pedidos da sua empresa'
);

select is(
  (select count(*)::int from public.pedidos where empresa_id = 'e2222222-2222-2222-2222-222222222222'),
  0,
  'Multitenancy: ADMIN da Empresa A NÃO lê pedidos da Empresa B'
);

select is(
  (select count(*)::int from public.passagens where empresa_id = 'e2222222-2222-2222-2222-222222222222'),
  0,
  'Multitenancy: ADMIN da Empresa A NÃO lê passagens da Empresa B'
);

select is(
  (select count(*)::int from public.viagens where empresa_id = 'e2222222-2222-2222-2222-222222222222'),
  0,
  'Multitenancy: ADMIN da Empresa A NÃO lê viagens da Empresa B'
);

select is(
  (select count(*)::int from public.encomendas where empresa_id = 'e2222222-2222-2222-2222-222222222222'),
  0,
  'Multitenancy: ADMIN da Empresa A NÃO lê encomendas da Empresa B'
);

reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "b0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select is(
  (select count(*)::int from public.pedidos where empresa_id = 'e2222222-2222-2222-2222-222222222222'),
  1,
  'Multitenancy: ADMIN da Empresa B lê pedidos da Empresa B'
);

select is(
  (select count(*)::int from public.pedidos where empresa_id = 'e1111111-1111-1111-1111-111111111111'),
  0,
  'Multitenancy: ADMIN da Empresa B NÃO lê pedidos da Empresa A'
);

-- ==============================================================================
-- Finalização e Rollback para Manter Banco Íntegro
-- ==============================================================================
select * from finish();
rollback;
