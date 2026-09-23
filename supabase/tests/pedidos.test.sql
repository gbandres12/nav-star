-- ==============================================================================
-- Testes Funcionais, Concorrência e Regras de Negócio - NavStar
-- Arquivo: supabase/tests/pedidos.test.sql
-- Conforme etapa B9 do backend-plan.md
-- ==============================================================================

begin;

-- Garante que a extensão pgTAP esteja disponível na transação de teste
create extension if not exists pgtap;

-- Plano de execução com 21 testes cobrindo todas as regras da etapa B9
select plan(21);

-- ==============================================================================
-- 1. Fixture de Dados de Teste
-- ==============================================================================

-- 1.1 Usuários de Autenticação (auth.users)
insert into auth.users (id, email, aud, role) values
  ('c0000000-0000-0000-0000-000000000001', 'admin_pedidos@teste.com', 'authenticated', 'authenticated'),
  ('c0000000-0000-0000-0000-000000000002', 'conferente_pedidos@teste.com', 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- 1.2 Empresas
insert into public.empresas (id, razao_social, nome_fantasia, cnpj, email, telefone, minutos_reserva_site) values
  ('e3333333-3333-3333-3333-333333333333', 'Navegação Solimões', 'Solimões Star', '00.000.003/0001-03', 'solimoes@teste.com', '92999990003', 30),
  ('e4444444-4444-4444-4444-444444444444', 'Navegação Job', 'Job Star', '00.000.004/0001-04', 'job@teste.com', '92999990004', 30)
on conflict (id) do nothing;

-- 1.3 Perfis
insert into public.perfis (id, empresa_id, nome, papel, ativo) values
  ('c0000000-0000-0000-0000-000000000001', 'e3333333-3333-3333-3333-333333333333', 'Admin Pedidos', 'ADMIN', true),
  ('c0000000-0000-0000-0000-000000000002', 'e3333333-3333-3333-3333-333333333333', 'Conferente Pedidos', 'CONFERENTE', true)
on conflict (id) do nothing;

-- 1.4 Cidades e Portos (Manaus, Parintins, Santarém)
insert into public.cidades (id, nome, uf, sigla, slug) values
  ('cc000000-0000-0000-0000-000000000001', 'Manaus Teste', 'AM', 'MAO', 'manaus-ped-test'),
  ('cc000000-0000-0000-0000-000000000002', 'Parintins Teste', 'AM', 'PIN', 'parintins-ped-test'),
  ('cc000000-0000-0000-0000-000000000003', 'Santarém Teste', 'PA', 'STM', 'santarem-ped-test')
on conflict (id) do nothing;

insert into public.portos (id, cidade_id, nome, taxa_embarque) values
  ('ff000000-0000-0000-0000-000000000001', 'cc000000-0000-0000-0000-000000000001', 'Porto Manaus', 10.00),
  ('ff000000-0000-0000-0000-000000000002', 'cc000000-0000-0000-0000-000000000002', 'Porto Parintins', 5.00),
  ('ff000000-0000-0000-0000-000000000003', 'cc000000-0000-0000-0000-000000000003', 'Porto Santarém', 8.00)
on conflict (id) do nothing;

-- 1.5 Embarcações e Assentos
insert into public.embarcacoes (id, empresa_id, nome, capacidade_passageiros, colunas_mapa) values
  ('bb000000-0000-0000-0000-000000000001', 'e3333333-3333-3333-3333-333333333333', 'Expresso Estrela', 80, 4),
  ('bb444444-4444-4444-4444-444444444444', 'e4444444-4444-4444-4444-444444444444', 'Barco Job', 100, 4)
on conflict (id) do nothing;

insert into public.assentos (id, embarcacao_id, codigo, fileira, coluna) values
  ('aa000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', 'P01', 1, 1),
  ('aa000000-0000-0000-0000-000000000002', 'bb000000-0000-0000-0000-000000000001', 'P02', 1, 2),
  ('aa000000-0000-0000-0000-000000000003', 'bb000000-0000-0000-0000-000000000001', 'P03', 1, 3),
  ('aa000000-0000-0000-0000-000000000004', 'bb000000-0000-0000-0000-000000000001', 'P04', 1, 4),
  ('aa000000-0000-0000-0000-000000000005', 'bb000000-0000-0000-0000-000000000001', 'P05', 1, 5),
  ('aa000000-0000-0000-0000-000000000006', 'bb000000-0000-0000-0000-000000000001', 'P06', 1, 6)
on conflict (id) do nothing;

-- 1.6 Linhas, Paradas e Tarifas
insert into public.linhas (id, empresa_id, nome, ativa) values
  ('11000000-0000-0000-0000-000000000001', 'e3333333-3333-3333-3333-333333333333', 'Manaus x Santarem', true),
  ('ee444444-4444-4444-4444-444444444444', 'e4444444-4444-4444-4444-444444444444', 'Linha Job', true)
on conflict (id) do nothing;

-- Paradas da linha: 0 = Manaus, 1 = Parintins, 2 = Santarém
insert into public.paradas_linha (id, linha_id, porto_id, ordem, minutos_desde_origem) values
  ('22000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', 'ff000000-0000-0000-0000-000000000001', 0, 0),
  ('22000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', 'ff000000-0000-0000-0000-000000000002', 1, 120),
  ('22000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', 'ff000000-0000-0000-0000-000000000003', 2, 240)
on conflict (id) do nothing;

-- Tarifas: Manaus->Parintins = 150.00 | Parintins->Santarém = 100.00 | Manaus->Santarém = 220.00
insert into public.tarifas_trecho (id, linha_id, origem_parada_id, destino_parada_id, valor) values
  ('33000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000002', 150.00),
  ('33000000-0000-0000-0000-000000000002', '11000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000002', '22000000-0000-0000-0000-000000000003', 100.00),
  ('33000000-0000-0000-0000-000000000003', '11000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000001', '22000000-0000-0000-0000-000000000003', 220.00)
on conflict (id) do nothing;

-- 1.7 Viagens (Futura e Passada/Em curso)
insert into public.viagens (id, empresa_id, linha_id, embarcacao_id, partida, status, vendas_abertas) values
  ('44000000-0000-0000-0000-000000000001', 'e3333333-3333-3333-3333-333333333333', '11000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', now() + interval '2 days', 'PROGRAMADA', true),
  ('44000000-0000-0000-0000-000000000002', 'e3333333-3333-3333-3333-333333333333', '11000000-0000-0000-0000-000000000001', 'bb000000-0000-0000-0000-000000000001', now() - interval '2 hours', 'EM_CURSO', false)
on conflict (id) do nothing;

-- 1.8 Pedidos Base
insert into public.pedidos (id, empresa_id, codigo, numero, canal, status, comprador_nome, comprador_telefone, subtotal, total) values
  ('55000000-0000-0000-0000-000000000001', 'e3333333-3333-3333-3333-333333333333', 'PED-EXCL-1', 'N-EXCL-1', 'SITE', 'PAGO', 'Comprador 1', '92999990001', 150.00, 160.00),
  ('55000000-0000-0000-0000-000000000002', 'e3333333-3333-3333-3333-333333333333', 'PED-EXCL-2', 'N-EXCL-2', 'SITE', 'AGUARDANDO_PAGAMENTO', 'Comprador 2', '92999990002', 150.00, 160.00),
  ('55000000-0000-0000-0000-000000000010', 'e3333333-3333-3333-3333-333333333333', 'PED-EMB-1', 'N-EMB-1', 'SITE', 'PAGO', 'Comprador Emb', '92999990010', 150.00, 160.00),
  ('55000000-0000-0000-0000-000000000012', 'e3333333-3333-3333-3333-333333333333', 'PED-PARTIU', 'N-PARTIU', 'SITE', 'PAGO', 'Comprador Partiu', '92999990012', 150.00, 160.00),
  ('55000000-0000-0000-0000-000000000013', 'e3333333-3333-3333-3333-333333333333', 'PED-CANC-OK', 'N-CANC-OK', 'SITE', 'AGUARDANDO_PAGAMENTO', 'Comprador Canc Ok', '92999990013', 150.00, 160.00)
on conflict (id) do nothing;

-- ==============================================================================
-- 2. Testes de Assentos e Exclusão GiST (int4range + btree_gist)
-- ==============================================================================

-- Inserção da primeira passagem: Manaus (0) -> Parintins (1) na poltrona P01
insert into public.passagens (id, empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem, nome, documento, valor, status, qr_token) values
  ('66000000-0000-0000-0000-000000000001', 'e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 0, 1, 'Passageiro Trecho 0-1', '12345678900', 150.00, 'EMITIDA', 'QR-T1');

-- Tentativa de segunda passagem no mesmo trecho e mesma poltrona deve falhar com exclusion_violation (23P01)
select throws_ok(
  $$ insert into public.passagens (empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem, nome, documento, valor, status, qr_token)
     values ('e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 0, 1, 'Passageiro Conflito', '98765432100', 150.00, 'RESERVADA', 'QR-CONFLICT'); $$,
  '23P01',
  NULL,
  'Exclusão GiST: duas passagens Manaus->Parintins (0->1) na mesma poltrona falham com exclusion_violation'
);

-- Passagem no trecho contíguo subsequente: Parintins (1) -> Santarém (2) na mesma poltrona P01 passa sem conflito
select lives_ok(
  $$ insert into public.passagens (empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem, nome, documento, valor, status, qr_token)
     values ('e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000001', 1, 2, 'Passageiro Trecho 1-2', '55566677788', 100.00, 'EMITIDA', 'QR-T2'); $$,
  'Exclusão GiST: Manaus->Parintins (0->1) e Parintins->Santarém (1->2) na mesma poltrona passam'
);

-- ==============================================================================
-- 3. Testes de Reserva Expirada (private.expirar_pedidos)
-- ==============================================================================

-- Pedido vencido (expira_em no passado) com reserva na poltrona P02
insert into public.pedidos (id, empresa_id, codigo, numero, canal, status, comprador_nome, comprador_telefone, subtotal, total, expira_em) values
  ('55000000-0000-0000-0000-000000000003', 'e3333333-3333-3333-3333-333333333333', 'PED-EXPIRAR', 'N-EXPIRAR', 'SITE', 'AGUARDANDO_PAGAMENTO', 'Comprador Expirar', '92999990003', 150.00, 160.00, now() - interval '10 minutes')
on conflict (id) do nothing;

insert into public.passagens (id, empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem, nome, documento, valor, status, qr_token) values
  ('66000000-0000-0000-0000-000000000003', 'e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000003', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 0, 1, 'Passageiro Expirar', '33344455566', 150.00, 'RESERVADA', 'QR-EXPIRAR')
on conflict (id) do nothing;

-- Execução da expiração periódica
select ok(private.expirar_pedidos() >= 1, 'private.expirar_pedidos() executa com sucesso');

select is(
  (select status from public.pedidos where id = '55000000-0000-0000-0000-000000000003'),
  'EXPIRADO'::public.status_pedido,
  'Reserva expirada: pedido vencido foi alterado para EXPIRADO'
);

select is(
  (select status from public.passagens where id = '66000000-0000-0000-0000-000000000003'),
  'CANCELADA'::public.status_passagem,
  'Reserva expirada: passagem do pedido vencido foi alterada para CANCELADA'
);

-- Assento liberado: nova reserva na mesma poltrona P02 tem sucesso imediato
select lives_ok(
  $$ insert into public.passagens (empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem, nome, documento, valor, status, qr_token)
     values ('e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000001', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000002', 0, 1, 'Novo Passageiro Assento Liberado', '99988877766', 150.00, 'RESERVADA', 'QR-LIBERADO'); $$,
  'Reserva expirada: assento foi liberado na exclusion constraint e nova reserva tem sucesso'
);

-- ==============================================================================
-- 4. Testes de Preço Seguro (criar_pedido_site)
-- ==============================================================================

-- Cliente envia payload adulterado tentando pagar R$ 1,00
select lives_ok(
  $$
  select public.criar_pedido_site(jsonb_build_object(
    'viagem_id', '44000000-0000-0000-0000-000000000001',
    'origem_ordem', 0,
    'destino_ordem', 1,
    'comprador', jsonb_build_object(
      'nome', 'Comprador Preço Seguro',
      'email', 'preco@teste.com',
      'telefone', '92999990000'
    ),
    'metodo', 'PIX',
    'subtotal', 1.00,
    'total', 1.00,
    'passageiros', jsonb_build_array(
      jsonb_build_object(
        'nome', 'Passageiro Adulto',
        'documento', '00011122233',
        'tipo', 'INTEIRA',
        'assento_id', 'aa000000-0000-0000-0000-000000000003',
        'valor', 0.01
      ),
      jsonb_build_object(
        'nome', 'Passageiro Crianca',
        'documento', '00011122244',
        'tipo', 'CRIANCA',
        'assento_id', 'aa000000-0000-0000-0000-000000000004',
        'valor', 0.01
      )
    )
  ));
  $$,
  'Preço seguro: criar_pedido_site executa com sucesso ignorando valores enviados no payload'
);

select is(
  (select subtotal from public.pedidos where comprador_nome = 'Comprador Preço Seguro' order by created_at desc limit 1),
  225.00,
  'Preço seguro: subtotal calculado no banco (150.00 inteira + 75.00 crianca = 225.00), ignorando payload de 1.00'
);

select is(
  (select total from public.pedidos where comprador_nome = 'Comprador Preço Seguro' order by created_at desc limit 1),
  245.00,
  'Preço seguro: total calculado soma subtotal (225.00) + taxas (2 x 10.00 = 20.00) = 245.00'
);

select is(
  (select valor from public.passagens where nome = 'Passageiro Crianca' order by created_at desc limit 1),
  75.00,
  'Preço seguro: passagem de CRIANCA calculada com 50% de desconto sobre tarifa oficial (75.00)'
);

-- ==============================================================================
-- 5. Testes de Validação de Embarque (validar_embarque)
-- ==============================================================================

insert into public.passagens (id, empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem, nome, documento, valor, status, qr_token) values
  ('66000000-0000-0000-0000-000000000010', 'e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000010', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000005', 0, 1, 'Passageiro Emitida', '111', 150.00, 'EMITIDA', 'QR-PAGO-EMBARQUE'),
  ('66000000-0000-0000-0000-000000000011', 'e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000002', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000005', 1, 2, 'Passageiro Reservada', '222', 100.00, 'RESERVADA', 'QR-PENDENTE-EMBARQUE'),
  ('66000000-0000-0000-0000-000000000012', 'e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000012', '44000000-0000-0000-0000-000000000002', 'aa000000-0000-0000-0000-000000000001', 0, 1, 'Passageiro Partiu', '333', 150.00, 'EMITIDA', 'QR-PARTIU'),
  ('66000000-0000-0000-0000-000000000013', 'e3333333-3333-3333-3333-333333333333', '55000000-0000-0000-0000-000000000013', '44000000-0000-0000-0000-000000000001', 'aa000000-0000-0000-0000-000000000006', 0, 1, 'Passageiro Canc Ok', '444', 150.00, 'RESERVADA', 'QR-CANC-OK')
on conflict (id) do nothing;

-- Autenticado como CONFERENTE
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "c0000000-0000-0000-0000-000000000002", "role": "authenticated"}';

select throws_ok(
  $$ select public.validar_embarque('QR-PENDENTE-EMBARQUE'); $$,
  'P0001',
  'Bilhete com pagamento pendente. Embarque não permitido.',
  'Embarque: recusa bilhete não pago (status RESERVADA)'
);

select lives_ok(
  $$ select public.validar_embarque('QR-PAGO-EMBARQUE'); $$,
  'Embarque: validação de bilhete EMITIDA tem sucesso'
);

select is(
  (select status from public.passagens where qr_token = 'QR-PAGO-EMBARQUE'),
  'EMBARCADA'::public.status_passagem,
  'Embarque: status da passagem foi atualizado para EMBARCADA'
);

select throws_like(
  $$ select public.validar_embarque('QR-PAGO-EMBARQUE'); $$,
  '%Bilhete já utilizado%',
  'Embarque: recusa bilhete já utilizado (status EMBARCADA)'
);

-- ==============================================================================
-- 6. Testes de Cancelamento (cancelar_pedido)
-- ==============================================================================

-- Autenticado como ADMIN
reset role;
set local role authenticated;
set local "request.jwt.claims" = '{"sub": "c0000000-0000-0000-0000-000000000001", "role": "authenticated"}';

select throws_ok(
  $$ select public.cancelar_pedido('PED-EMB-1', 'Teste cancelamento'); $$,
  'P0001',
  'Não é possível cancelar pedido com passagem já embarcada.',
  'Cancelamento: recusa cancelamento se houver passagem já embarcada'
);

select throws_ok(
  $$ select public.cancelar_pedido('PED-PARTIU', 'Teste cancelamento'); $$,
  'P0001',
  'A embarcação já partiu; não é possível cancelar o pedido.',
  'Cancelamento: recusa cancelamento de pedido cuja viagem já partiu'
);

select lives_ok(
  $$ select public.cancelar_pedido('PED-CANC-OK', 'Cancelamento pelo cliente'); $$,
  'Cancelamento: cancela com sucesso pedido válido não embarcado'
);

select is(
  (select status from public.pedidos where codigo = 'PED-CANC-OK'),
  'CANCELADO'::public.status_pedido,
  'Cancelamento: status do pedido vira CANCELADO'
);

-- ==============================================================================
-- 7. Testes de Jobs (private.gerar_viagens - Idempotência)
-- ==============================================================================

reset role;

insert into public.horarios_linha (id, linha_id, embarcacao_id, dia_semana, hora_saida, ativo)
values (
  'cc444444-4444-4444-4444-444444444444',
  'ee444444-4444-4444-4444-444444444444',
  'bb444444-4444-4444-4444-444444444444',
  extract(dow from (now() at time zone 'America/Manaus'))::int,
  '23:59:00',
  true
)
on conflict (id) do nothing;

select is(
  (select private.gerar_viagens(1) >= 1),
  true,
  'Jobs: gerar_viagens(1) cria viagens na primeira execução'
);

select is(
  (select private.gerar_viagens(1)),
  0,
  'Jobs: gerar_viagens(1) é idempotente e retorna 0 viagens na segunda execução'
);

select is(
  (select count(*)::int from public.viagens where linha_id = 'ee444444-4444-4444-4444-444444444444'),
  1,
  'Jobs: contagem total de viagens da linha permanece exatamente 1 sem duplicatas'
);

-- ==============================================================================
-- Finalização e Rollback para Manter Banco Íntegro
-- ==============================================================================
select * from finish();
rollback;
