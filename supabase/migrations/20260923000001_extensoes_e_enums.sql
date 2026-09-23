-- ==============================================================================
-- Migração 1: Extensões, Schemas, Funções de Infraestrutura, Sequências e Enums
-- NavStar - Banco de Dados PostgreSQL / Supabase
-- ==============================================================================

-- 1. Extensões
create extension if not exists btree_gist;
create extension if not exists pg_cron;

-- 2. Schema privado para regras de negócio e infraestrutura não expostas via PostgREST
create schema if not exists private;

-- 3. Função de trigger para atualização automática de updated_at
create or replace function private.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 4. Sequência para códigos legíveis de encomendas (ex.: EN-10001)
create sequence if not exists public.encomenda_codigo_seq
  as bigint
  start with 10000
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;

-- 5. Tipos Enumerados (Enums)
create type public.papel_usuario as enum (
  'ADMIN',
  'GERENTE',
  'VENDEDOR',
  'CONFERENTE'
);

create type public.status_embarcacao as enum (
  'ATIVA',
  'MANUTENCAO',
  'INATIVA'
);

create type public.tipo_assento as enum (
  'POLTRONA',
  'POLTRONA_JANELA',
  'ESPECIAL'
);

create type public.status_viagem as enum (
  'PROGRAMADA',
  'EMBARQUE',
  'EM_CURSO',
  'CONCLUIDA',
  'CANCELADA'
);

create type public.canal_venda as enum (
  'SITE',
  'BALCAO',
  'AGENCIA',
  'WHATSAPP'
);

create type public.status_pedido as enum (
  'AGUARDANDO_PAGAMENTO',
  'PAGO',
  'CANCELADO',
  'EXPIRADO',
  'REEMBOLSADO'
);

create type public.tipo_passageiro as enum (
  'INTEIRA',
  'CRIANCA',
  'COLO',
  'IDOSO',
  'ESTUDANTE',
  'PCD'
);

create type public.status_passagem as enum (
  'RESERVADA',
  'EMITIDA',
  'EMBARCADA',
  'CANCELADA',
  'NAO_COMPARECEU'
);

create type public.metodo_pagamento as enum (
  'PIX',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
  'DINHEIRO'
);

create type public.status_pagamento as enum (
  'PENDENTE',
  'APROVADO',
  'RECUSADO',
  'ESTORNADO'
);

create type public.status_encomenda as enum (
  'RECEBIDA',
  'EMBARCADA',
  'EM_TRANSITO',
  'DISPONIVEL_RETIRADA',
  'ENTREGUE',
  'DEVOLVIDA'
);

create type public.pagador_frete as enum (
  'REMETENTE',
  'DESTINATARIO'
);
