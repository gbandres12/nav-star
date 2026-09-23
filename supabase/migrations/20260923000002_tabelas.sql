-- ==============================================================================
-- Migração 2: Tabelas, Constraints, Triggers e Índices do NavStar
-- NavStar - Banco de Dados PostgreSQL / Supabase
-- ==============================================================================

-- 1. Empresas
create table public.empresas (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text not null,
  cnpj text not null unique,
  inscricao_estadual text,
  email text not null,
  telefone text not null,
  whatsapp text,
  logo_url text,
  minutos_reserva_site integer not null default 30 check (minutos_reserva_site > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. Cidades
create table public.cidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  uf char(2) not null,
  sigla varchar(3) not null,
  slug text not null unique,
  codigo_ibge text unique,
  timezone text not null default 'America/Manaus',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cidades_nome_uf_key unique (nome, uf)
);

-- 3. Portos
create table public.portos (
  id uuid primary key default gen_random_uuid(),
  cidade_id uuid not null references public.cidades(id) on delete restrict,
  nome text not null,
  endereco text,
  taxa_embarque numeric(10,2) not null default 0.00 check (taxa_embarque >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. Agências
create table public.agencias (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  cidade_id uuid not null references public.cidades(id) on delete restrict,
  nome text not null,
  cnpj text,
  comissao_percentual numeric(5,2) not null default 0.00 check (comissao_percentual >= 0 and comissao_percentual <= 100),
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. Perfis (Extensão 1:1 com auth.users do Supabase)
create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  agencia_id uuid references public.agencias(id) on delete set null,
  nome text not null,
  papel public.papel_usuario not null,
  ativo boolean not null default true,
  ultimo_acesso timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 6. Embarcações
create table public.embarcacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  tipo text not null default 'LANCHA',
  inscricao_capitania text,
  capacidade_passageiros integer not null check (capacidade_passageiros > 0),
  capacidade_carga_kg integer check (capacidade_carga_kg is null or capacidade_carga_kg >= 0),
  colunas_mapa integer not null check (colunas_mapa > 0),
  status public.status_embarcacao not null default 'ATIVA',
  foto_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 7. Assentos
create table public.assentos (
  id uuid primary key default gen_random_uuid(),
  embarcacao_id uuid not null references public.embarcacoes(id) on delete cascade,
  codigo text not null,
  fileira integer not null check (fileira >= 0),
  coluna integer not null check (coluna >= 0),
  tipo public.tipo_assento not null default 'POLTRONA',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint assentos_embarcacao_codigo_key unique (embarcacao_id, codigo)
);

-- 8. Linhas
create table public.linhas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null,
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 9. Linhas permitidas por perfil (restrição para operadores de balcão/vendedores)
create table public.perfis_linhas (
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  linha_id uuid not null references public.linhas(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, linha_id)
);

-- 10. Paradas da Linha
create table public.paradas_linha (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.linhas(id) on delete cascade,
  porto_id uuid not null references public.portos(id) on delete restrict,
  ordem integer not null check (ordem >= 0),
  minutos_desde_origem integer not null check (minutos_desde_origem >= 0),
  created_at timestamptz not null default now(),
  constraint paradas_linha_linha_ordem_key unique (linha_id, ordem)
);

-- 11. Tarifas por Trecho
create table public.tarifas_trecho (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.linhas(id) on delete cascade,
  origem_parada_id uuid not null references public.paradas_linha(id) on delete cascade,
  destino_parada_id uuid not null references public.paradas_linha(id) on delete cascade,
  valor numeric(10,2) not null check (valor >= 0),
  valor_encomenda_kg numeric(10,2) check (valor_encomenda_kg is null or valor_encomenda_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tarifas_trecho_origem_destino_key unique (origem_parada_id, destino_parada_id)
);

-- 12. Horários Programados da Linha
create table public.horarios_linha (
  id uuid primary key default gen_random_uuid(),
  linha_id uuid not null references public.linhas(id) on delete cascade,
  embarcacao_id uuid not null references public.embarcacoes(id) on delete restrict,
  dia_semana integer not null check (dia_semana between 0 and 6),
  hora_saida time not null,
  ativo boolean not null default true,
  vigencia_inicio timestamptz,
  vigencia_fim timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 13. Viagens
create table public.viagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  linha_id uuid not null references public.linhas(id) on delete restrict,
  embarcacao_id uuid not null references public.embarcacoes(id) on delete restrict,
  partida timestamptz not null,
  status public.status_viagem not null default 'PROGRAMADA',
  comandante text,
  vendas_abertas boolean not null default true,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viagens_linha_partida_key unique (linha_id, partida)
);

-- 14. Clientes (Passageiros cadastrados; opcional na compra como visitante)
create table public.clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cpf text unique,
  email text unique,
  telefone text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 15. Sessões de Caixa (Operação de balcão)
create table public.caixa_sessoes (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfis(id) on delete restrict,
  aberto_em timestamptz not null default now(),
  fechado_em timestamptz,
  valor_abertura numeric(10,2) not null check (valor_abertura >= 0),
  valor_fechamento numeric(10,2) check (valor_fechamento is null or valor_fechamento >= 0),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 16. Pedidos
create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null unique,
  numero text not null unique,
  cliente_id uuid references public.clientes(id) on delete set null,
  canal public.canal_venda not null,
  status public.status_pedido not null default 'AGUARDANDO_PAGAMENTO',
  comprador_nome text not null,
  comprador_email text,
  comprador_telefone text not null,
  vendedor_id uuid references public.perfis(id) on delete set null,
  agencia_id uuid references public.agencias(id) on delete set null,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  taxas numeric(10,2) not null default 0.00 check (taxas >= 0),
  desconto numeric(10,2) not null default 0.00 check (desconto >= 0),
  total numeric(10,2) not null check (total >= 0),
  comissao_agencia numeric(10,2) not null default 0.00 check (comissao_agencia >= 0),
  expira_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 17. Tabela de Descontos por Tipo de Passageiro
create table public.descontos_tipo_passageiro (
  tipo public.tipo_passageiro primary key,
  percentual numeric(5,2) not null check (percentual >= 0 and percentual <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Carga inicial dos descontos oficiais
insert into public.descontos_tipo_passageiro (tipo, percentual) values
  ('INTEIRA', 0.00),
  ('CRIANCA', 50.00),
  ('COLO', 100.00),
  ('IDOSO', 50.00),
  ('ESTUDANTE', 50.00),
  ('PCD', 50.00)
on conflict (tipo) do update set percentual = excluded.percentual;

-- 18. Passagens
create table public.passagens (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  viagem_id uuid not null references public.viagens(id) on delete restrict,
  assento_id uuid references public.assentos(id) on delete restrict,
  origem_ordem integer not null check (origem_ordem >= 0),
  destino_ordem integer not null check (destino_ordem >= 0),
  trecho int4range generated always as (int4range(origem_ordem, destino_ordem)) stored,
  nome text not null,
  documento text not null,
  nascimento timestamptz,
  telefone text,
  tipo public.tipo_passageiro not null default 'INTEIRA',
  valor numeric(10,2) not null check (valor >= 0),
  taxa_embarque numeric(10,2) not null default 0.00 check (taxa_embarque >= 0),
  status public.status_passagem not null default 'RESERVADA',
  qr_token text not null unique,
  bpe_chave text unique,
  bpe_protocolo text,
  embarcado_em timestamptz,
  validado_por_id uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passagens_ordem_valida check (origem_ordem < destino_ordem),
  constraint passagens_assento_colo check (
    (tipo = 'COLO' and assento_id is null) or
    (tipo <> 'COLO' and assento_id is not null)
  )
);

-- Constraint de exclusão para garantir que não haja sobreposição de trechos no mesmo assento
alter table public.passagens
  add constraint passagens_sem_sobreposicao
  exclude using gist (
    viagem_id  with =,
    assento_id with =,
    trecho     with &&
  ) where (status in ('RESERVADA', 'EMITIDA', 'EMBARCADA'));

-- 19. Pagamentos
create table public.pagamentos (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  metodo public.metodo_pagamento not null,
  status public.status_pagamento not null default 'PENDENTE',
  valor numeric(10,2) not null check (valor >= 0),
  parcelas integer not null default 1 check (parcelas >= 1),
  gateway text,
  gateway_id text unique,
  pix_copia_cola text,
  pago_em timestamptz,
  caixa_id uuid references public.caixa_sessoes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 20. Encomendas
create table public.encomendas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  codigo text not null unique default ('EN-' || nextval('public.encomenda_codigo_seq'::regclass)),
  viagem_id uuid references public.viagens(id) on delete set null,
  origem_cidade_id uuid not null references public.cidades(id) on delete restrict,
  destino_cidade_id uuid not null references public.cidades(id) on delete restrict,
  remetente_nome text not null,
  remetente_doc text not null,
  remetente_tel text not null,
  destinatario_nome text not null,
  destinatario_doc text,
  destinatario_tel text not null,
  descricao text not null,
  volumes integer not null default 1 check (volumes > 0),
  peso_kg numeric(10,2) not null check (peso_kg >= 0),
  valor_declarado numeric(10,2) check (valor_declarado is null or valor_declarado >= 0),
  frete numeric(10,2) not null check (frete >= 0),
  pagador public.pagador_frete not null default 'REMETENTE',
  frete_pago boolean not null default false,
  status public.status_encomenda not null default 'RECEBIDA',
  entregue_a text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 21. Eventos da Encomenda (Histórico de Rastreio)
create table public.encomenda_eventos (
  id uuid primary key default gen_random_uuid(),
  encomenda_id uuid not null references public.encomendas(id) on delete cascade,
  status public.status_encomenda not null,
  descricao text,
  usuario_id uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ==============================================================================
-- Triggers de updated_at
-- ==============================================================================

create trigger set_updated_at before update on public.empresas
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.cidades
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.portos
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.agencias
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.perfis
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.embarcacoes
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.assentos
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.linhas
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.tarifas_trecho
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.horarios_linha
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.viagens
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.clientes
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.caixa_sessoes
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.pedidos
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.descontos_tipo_passageiro
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.passagens
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.pagamentos
  for each row execute function private.set_updated_at();

create trigger set_updated_at before update on public.encomendas
  for each row execute function private.set_updated_at();

-- ==============================================================================
-- Índices para Chaves Estrangeiras, RLS e Filtros Frequentes
-- ==============================================================================

-- Portos
create index idx_portos_cidade_id on public.portos(cidade_id);

-- Agências
create index idx_agencias_empresa_id on public.agencias(empresa_id);
create index idx_agencias_cidade_id on public.agencias(cidade_id);

-- Perfis
create index idx_perfis_empresa_id on public.perfis(empresa_id);
create index idx_perfis_agencia_id on public.perfis(agencia_id);

-- Perfis Linhas
create index idx_perfis_linhas_linha_id on public.perfis_linhas(linha_id);

-- Embarcações
create index idx_embarcacoes_empresa_id on public.embarcacoes(empresa_id);

-- Assentos
create index idx_assentos_embarcacao_id on public.assentos(embarcacao_id);

-- Linhas
create index idx_linhas_empresa_id on public.linhas(empresa_id);

-- Paradas da Linha
create index idx_paradas_linha_linha_id on public.paradas_linha(linha_id);
create index idx_paradas_linha_porto_id on public.paradas_linha(porto_id);

-- Tarifas por Trecho
create index idx_tarifas_trecho_linha_id on public.tarifas_trecho(linha_id);
create index idx_tarifas_trecho_origem_parada_id on public.tarifas_trecho(origem_parada_id);
create index idx_tarifas_trecho_destino_parada_id on public.tarifas_trecho(destino_parada_id);

-- Horários da Linha
create index idx_horarios_linha_linha_id on public.horarios_linha(linha_id);
create index idx_horarios_linha_embarcacao_id on public.horarios_linha(embarcacao_id);

-- Viagens
create index idx_viagens_empresa_id on public.viagens(empresa_id);
create index idx_viagens_linha_id on public.viagens(linha_id);
create index idx_viagens_embarcacao_id on public.viagens(embarcacao_id);
create index idx_viagens_partida on public.viagens(partida);
create index idx_viagens_status on public.viagens(status);

-- Caixa Sessões
create index idx_caixa_sessoes_usuario_id on public.caixa_sessoes(usuario_id);

-- Pedidos
create index idx_pedidos_empresa_id on public.pedidos(empresa_id);
create index idx_pedidos_cliente_id on public.pedidos(cliente_id);
create index idx_pedidos_vendedor_id on public.pedidos(vendedor_id);
create index idx_pedidos_agencia_id on public.pedidos(agencia_id);
create index idx_pedidos_status on public.pedidos(status);
create index idx_pedidos_created_at on public.pedidos(created_at);
create index idx_pedidos_expira_em on public.pedidos(expira_em);

-- Passagens
create index idx_passagens_empresa_id on public.passagens(empresa_id);
create index idx_passagens_pedido_id on public.passagens(pedido_id);
create index idx_passagens_viagem_id on public.passagens(viagem_id);
create index idx_passagens_assento_id on public.passagens(assento_id);
create index idx_passagens_documento on public.passagens(documento);
create index idx_passagens_validado_por_id on public.passagens(validado_por_id);
create index idx_passagens_status on public.passagens(status);

-- Pagamentos
create index idx_pagamentos_empresa_id on public.pagamentos(empresa_id);
create index idx_pagamentos_pedido_id on public.pagamentos(pedido_id);
create index idx_pagamentos_caixa_id on public.pagamentos(caixa_id);
create index idx_pagamentos_status on public.pagamentos(status);

-- Encomendas
create index idx_encomendas_empresa_id on public.encomendas(empresa_id);
create index idx_encomendas_viagem_id on public.encomendas(viagem_id);
create index idx_encomendas_origem_cidade_id on public.encomendas(origem_cidade_id);
create index idx_encomendas_destino_cidade_id on public.encomendas(destino_cidade_id);
create index idx_encomendas_status on public.encomendas(status);

-- Encomenda Eventos
create index idx_encomenda_eventos_encomenda_id on public.encomenda_eventos(encomenda_id);
create index idx_encomenda_eventos_usuario_id on public.encomenda_eventos(usuario_id);
