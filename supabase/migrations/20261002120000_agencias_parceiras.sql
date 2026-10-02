-- ==============================================================================
-- Agências parceiras (portal de venda de passagens) — Etapa 1: banco
--
-- Convive com public.agencias (modelo antigo: comissão + vendedor com login em perfis).
-- A agência parceira NÃO é usuário do sistema: tem credencial própria, só acessada pelo servidor
-- (service role). Reaproveita linhas, paradas_linha, viagens, passagens e pedidos, de modo que a
-- lotação, o embarque por QR e o bilhete existentes valem também para estas vendas.
--
-- Tudo aqui é aditivo: nenhuma tabela existente é alterada.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Tipos
-- ------------------------------------------------------------------------------
create type public.status_agencia_parceira as enum ('PENDENTE', 'APROVADA', 'SUSPENSA', 'RECUSADA');
create type public.status_bilhete_agencia as enum ('EMITIDO', 'CANCELADO', 'TRANSFERIDO');

create sequence if not exists public.bilhete_agencia_seq as bigint start with 1 increment by 1 cache 1;

-- ------------------------------------------------------------------------------
-- 2. Tabelas
-- ------------------------------------------------------------------------------
create table public.agencias_parceiras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  nome text not null check (length(trim(nome)) >= 2),
  documento text,                       -- CNPJ ou CPF
  responsavel text not null,
  email text not null,
  telefone text not null,
  senha_hash text not null,             -- scrypt, gerado pelo servidor; nunca legível pelo painel
  status public.status_agencia_parceira not null default 'PENDENTE',
  motivo_status text,
  aprovado_em timestamptz,
  aprovado_por uuid references public.perfis(id) on delete set null,
  tentativas_falhas integer not null default 0 check (tentativas_falhas >= 0),
  bloqueado_ate timestamptz,
  ultimo_login timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index agencias_parceiras_email_key on public.agencias_parceiras (empresa_id, lower(email));
create index idx_agencias_parceiras_status on public.agencias_parceiras (empresa_id, status);
create index idx_agencias_parceiras_aprovado_por on public.agencias_parceiras (aprovado_por);

-- Piso por viagem e categoria, em % do preço de tabela do trecho (preço de tabela = tarifas_trecho
-- com acréscimo de festival e desconto da categoria, o mesmo do site). Sem linha = piso de 100% (sem desconto).
create table public.viagem_pisos (
  viagem_id uuid not null references public.viagens(id) on delete cascade,
  tipo public.tipo_passageiro not null,
  piso_percentual numeric(5,2) not null check (piso_percentual >= 0 and piso_percentual <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (viagem_id, tipo)
);

-- Cadastro de passageiros para marketing. Único por documento dentro da empresa.
create table public.passageiros (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  documento text not null,              -- normalizado: maiúsculas, só letras e números
  documento_original text not null,
  nome text not null,
  telefone text,
  email text,
  nascimento date not null,
  endereco text,
  aceita_marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint passageiros_contato check (telefone is not null or email is not null),
  constraint passageiros_empresa_documento_key unique (empresa_id, documento)
);

create table public.bilhetes_agencia (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas(id) on delete cascade,
  agencia_id uuid not null references public.agencias_parceiras(id) on delete restrict,
  passagem_id uuid not null unique references public.passagens(id) on delete restrict,
  pedido_id uuid not null references public.pedidos(id) on delete restrict,
  passageiro_id uuid not null references public.passageiros(id) on delete restrict,
  numero text not null unique,
  codigo_validacao text not null unique,   -- = passagens.qr_token (o embarque por QR existente já o aceita)
  valor_tabela numeric(10,2) not null check (valor_tabela >= 0),
  valor_piso numeric(10,2) not null check (valor_piso >= 0),
  valor_cobrado numeric(10,2) not null check (valor_cobrado >= valor_piso),
  taxa_embarque numeric(10,2) not null default 0 check (taxa_embarque >= 0),
  valor_repasse numeric(10,2) not null check (valor_repasse >= 0),   -- piso + taxa de embarque
  repasse_pago boolean not null default false,
  repasse_pago_em timestamptz,
  status public.status_bilhete_agencia not null default 'EMITIDO',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bilhetes_agencia_empresa on public.bilhetes_agencia (empresa_id);
create index idx_bilhetes_agencia_agencia on public.bilhetes_agencia (agencia_id, created_at desc);
create index idx_bilhetes_agencia_pedido on public.bilhetes_agencia (pedido_id);
create index idx_bilhetes_agencia_passageiro on public.bilhetes_agencia (passageiro_id);

create table public.bilhete_agencia_historico (
  id uuid primary key default gen_random_uuid(),
  bilhete_id uuid not null references public.bilhetes_agencia(id) on delete cascade,
  evento text not null,
  status_anterior public.status_bilhete_agencia,
  status_novo public.status_bilhete_agencia,
  detalhe jsonb,
  agencia_id uuid references public.agencias_parceiras(id) on delete set null,
  usuario_id uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now()
);
create index idx_bilhete_historico_bilhete on public.bilhete_agencia_historico (bilhete_id, created_at);
create index idx_bilhete_historico_agencia on public.bilhete_agencia_historico (agencia_id);
create index idx_bilhete_historico_usuario on public.bilhete_agencia_historico (usuario_id);

create trigger set_updated_at before update on public.agencias_parceiras for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.viagem_pisos for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.passageiros for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.bilhetes_agencia for each row execute function private.set_updated_at();

-- ------------------------------------------------------------------------------
-- 3. RLS: só leitura para a equipe interna (ADMIN/GERENTE da mesma empresa).
--    Não há policy para anon. Toda escrita e todo acesso do portal passam pelo servidor (service role, que ignora RLS).
-- ------------------------------------------------------------------------------
alter table public.agencias_parceiras enable row level security;
alter table public.viagem_pisos enable row level security;
alter table public.passageiros enable row level security;
alter table public.bilhetes_agencia enable row level security;
alter table public.bilhete_agencia_historico enable row level security;

revoke all on public.agencias_parceiras, public.viagem_pisos, public.passageiros,
              public.bilhetes_agencia, public.bilhete_agencia_historico from anon, authenticated;

-- senha_hash fica de fora: o painel nunca consegue lê-lo
grant select (id, empresa_id, nome, documento, responsavel, email, telefone, status, motivo_status,
              aprovado_em, aprovado_por, tentativas_falhas, bloqueado_ate, ultimo_login, created_at, updated_at)
  on public.agencias_parceiras to authenticated;
grant select on public.viagem_pisos, public.passageiros, public.bilhetes_agencia, public.bilhete_agencia_historico to authenticated;

create policy agencias_parceiras_select on public.agencias_parceiras for select to authenticated
  using (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN', 'GERENTE'));

create policy viagem_pisos_select on public.viagem_pisos for select to authenticated
  using (private.tem_papel('ADMIN', 'GERENTE')
         and exists (select 1 from public.viagens v where v.id = viagem_id and v.empresa_id = (select private.empresa_atual())));

create policy passageiros_select on public.passageiros for select to authenticated
  using (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN', 'GERENTE'));

create policy bilhetes_agencia_select on public.bilhetes_agencia for select to authenticated
  using (empresa_id = (select private.empresa_atual()) and private.tem_papel('ADMIN', 'GERENTE'));

create policy bilhete_historico_select on public.bilhete_agencia_historico for select to authenticated
  using (private.tem_papel('ADMIN', 'GERENTE')
         and exists (select 1 from public.bilhetes_agencia b where b.id = bilhete_id and b.empresa_id = (select private.empresa_atual())));

-- ------------------------------------------------------------------------------
-- 4. Auxiliares (schema private, sem acesso direto)
-- ------------------------------------------------------------------------------

-- Maior ocupação entre os trechos percorridos. Mesma regra de private.criar_pedido:
-- toda passagem ativa conta 1 em cada trecho (inclusive criança de colo).
create or replace function private.max_ocupacao_trecho(p_viagem_id uuid, p_origem integer, p_destino integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(max(t.n), 0)::integer
  from (
    select count(pas.id) as n
    from generate_series(p_origem, p_destino - 1) as s(ordem)
    left join public.passagens pas
      on pas.viagem_id = p_viagem_id
     and pas.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
     and pas.trecho @> s.ordem
    group by s.ordem
  ) t;
$$;

-- Preço de tabela de uma categoria no trecho (igual ao do site, sem convênio nem cômodo).
create or replace function private.preco_tabela(p_viagem_id uuid, p_origem integer, p_destino integer, p_tipo public.tipo_passageiro)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_linha uuid;
  v_base numeric(10,2);
  v_festival numeric(5,2);
  v_desc numeric(5,2);
begin
  select linha_id into v_linha from public.viagens where id = p_viagem_id;

  select t.valor into v_base
  from public.tarifas_trecho t
  join public.paradas_linha po on po.id = t.origem_parada_id and po.ordem = p_origem
  join public.paradas_linha pd on pd.id = t.destino_parada_id and pd.ordem = p_destino
  where t.linha_id = v_linha;

  if v_base is null then
    return null;
  end if;

  select f.acrescimo_percentual into v_festival
  from public.festival_viagens fv
  join public.festivais f on f.id = fv.festival_id
  where fv.viagem_id = p_viagem_id and f.publicado
  limit 1;
  if v_festival is not null then
    v_base := round(v_base * (1 + v_festival / 100), 2);
  end if;

  select coalesce(d.percentual, 0) into v_desc from public.descontos_tipo_passageiro d where d.tipo = p_tipo;

  return round(v_base * (1 - coalesce(v_desc, 0) / 100), 2);
end;
$$;

create or replace function private.piso_agencia(p_viagem_id uuid, p_tipo public.tipo_passageiro, p_tabela numeric)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(p_tabela * coalesce(
    (select vp.piso_percentual from public.viagem_pisos vp where vp.viagem_id = p_viagem_id and vp.tipo = p_tipo),
    100) / 100, 2);
$$;

create or replace function private.taxa_embarque_agencia(p_viagem_id uuid, p_origem integer, p_destino integer, p_tipo public.tipo_passageiro)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_linha uuid;
  v_taxa numeric(10,2);
  v_isento boolean;
begin
  if p_tipo = 'COLO' then
    return 0;
  end if;

  select coalesce(d.isento_taxa, false) into v_isento from public.descontos_tipo_passageiro d where d.tipo = p_tipo;
  if coalesce(v_isento, false) then
    return 0;
  end if;

  select linha_id into v_linha from public.viagens where id = p_viagem_id;

  select t.valor into v_taxa
  from public.taxas_embarque_trecho t
  where t.linha_id = v_linha and t.origem_ordem = p_origem and t.destino_ordem = p_destino and t.ativa;
  if found then
    return v_taxa;
  end if;

  select coalesce(po.taxa_embarque, 0) into v_taxa
  from public.paradas_linha pl
  join public.portos po on po.id = pl.porto_id
  where pl.linha_id = v_linha and pl.ordem = p_origem;

  return coalesce(v_taxa, 0);
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Funções do portal (só service role)
-- ------------------------------------------------------------------------------

-- Lotação por trecho (pares de paradas consecutivas) de uma viagem.
create or replace function public.lotacao_por_trecho(p_viagem_id uuid)
returns table (
  ordem_origem integer,
  ordem_destino integer,
  porto_origem text,
  porto_destino text,
  capacidade integer,
  ocupados integer,
  livres integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (
    select vi.linha_id, e.capacidade_passageiros as cap
    from public.viagens vi
    join public.embarcacoes e on e.id = vi.embarcacao_id
    where vi.id = p_viagem_id
  ),
  par as (
    select pl.ordem,
           lead(pl.ordem) over (order by pl.ordem) as prox,
           po.nome as nome,
           lead(po.nome) over (order by pl.ordem) as prox_nome
    from public.paradas_linha pl
    join v on v.linha_id = pl.linha_id
    join public.portos po on po.id = pl.porto_id
  )
  select par.ordem, par.prox, par.nome, par.prox_nome, v.cap,
         coalesce(o.n, 0)::integer,
         greatest(v.cap - coalesce(o.n, 0), 0)::integer
  from par
  cross join v
  left join lateral (
    select count(*) as n
    from public.passagens pas
    where pas.viagem_id = p_viagem_id
      and pas.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
      and pas.trecho @> par.ordem
  ) o on true
  where par.prox is not null
  order by par.ordem;
$$;

-- Preços de um trecho por categoria: tabela, piso e taxa de embarque.
create or replace function public.precos_agencia_trecho(p_viagem_id uuid, p_origem_ordem integer, p_destino_ordem integer)
returns table (tipo public.tipo_passageiro, valor_tabela numeric, valor_piso numeric, taxa_embarque numeric)
language sql
stable
security definer
set search_path = ''
as $$
  select x.t, x.tabela, private.piso_agencia(p_viagem_id, x.t, x.tabela),
         private.taxa_embarque_agencia(p_viagem_id, p_origem_ordem, p_destino_ordem, x.t)
  from (
    select t, private.preco_tabela(p_viagem_id, p_origem_ordem, p_destino_ordem, t) as tabela
    from unnest(enum_range(null::public.tipo_passageiro)) as t
  ) x
  where x.tabela is not null;
$$;

-- Venda atômica. A linha da viagem é travada (FOR UPDATE) — o mesmo lock de private.criar_pedido —,
-- então duas agências, ou uma agência e o site/balcão, nunca vendem a última vaga juntos.
--
-- p_dados: { viagem_id, origem_ordem, destino_ordem, tipo, valor_cobrado,
--            passageiro: { nome, documento, telefone, email, nascimento (AAAA-MM-DD), endereco, aceita_marketing } }
create or replace function public.vender_passagem_agencia(p_agencia_id uuid, p_dados jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_ag record;
  v_viagem record;
  v_emb record;
  v_pj jsonb := coalesce(p_dados->'passageiro', '{}'::jsonb);
  v_viagem_id uuid;
  v_origem integer;
  v_destino integer;
  v_tipo public.tipo_passageiro;
  v_cobrado numeric(10,2);
  v_nome text;
  v_doc_original text;
  v_doc text;
  v_tel text;
  v_email text;
  v_nasc date;
  v_endereco text;
  v_marketing boolean;
  v_origem_parada record;
  v_destino_parada_id uuid;
  v_sigla varchar(3);
  v_tabela numeric(10,2);
  v_piso numeric(10,2);
  v_taxa numeric(10,2);
  v_repasse numeric(10,2);
  v_assento_id uuid;
  v_passageiro_id uuid;
  v_pedido_id uuid := gen_random_uuid();
  v_passagem_id uuid := gen_random_uuid();
  v_bilhete_id uuid := gen_random_uuid();
  v_codigo text;
  v_numero text;
  v_qr text;
  v_numero_bilhete text;
begin
  -- Entrada
  v_viagem_id := nullif(p_dados->>'viagem_id', '')::uuid;
  v_origem := (p_dados->>'origem_ordem')::integer;
  v_destino := (p_dados->>'destino_ordem')::integer;
  if v_viagem_id is null or v_origem is null or v_destino is null then
    raise exception using errcode = 'P0001', message = 'Viagem, embarque e desembarque são obrigatórios.';
  end if;
  if v_origem >= v_destino then
    raise exception using errcode = 'P0001', message = 'Trecho inválido: o embarque deve ser anterior ao desembarque.';
  end if;

  begin
    v_tipo := upper(trim(p_dados->>'tipo'))::public.tipo_passageiro;
  exception when others then
    raise exception using errcode = 'P0001', message = 'Categoria de passageiro inválida.';
  end;

  begin
    v_cobrado := round((p_dados->>'valor_cobrado')::numeric, 2);
  exception when others then
    v_cobrado := null;
  end;
  if v_cobrado is null or v_cobrado < 0 then
    raise exception using errcode = 'P0001', message = 'Informe o valor cobrado.';
  end if;

  v_nome := trim(coalesce(v_pj->>'nome', ''));
  v_doc_original := trim(coalesce(v_pj->>'documento', ''));
  v_doc := upper(regexp_replace(v_doc_original, '[^0-9A-Za-z]', '', 'g'));
  v_tel := nullif(trim(coalesce(v_pj->>'telefone', '')), '');
  v_email := nullif(lower(trim(coalesce(v_pj->>'email', ''))), '');
  v_endereco := nullif(trim(coalesce(v_pj->>'endereco', '')), '');
  v_marketing := coalesce((v_pj->>'aceita_marketing')::boolean, false);

  if length(v_nome) < 2 then
    raise exception using errcode = 'P0001', message = 'Nome do passageiro é obrigatório.';
  end if;
  if length(v_doc) < 3 then
    raise exception using errcode = 'P0001', message = 'Documento do passageiro é obrigatório.';
  end if;
  if v_tel is null and v_email is null then
    raise exception using errcode = 'P0001', message = 'Informe telefone ou e-mail do passageiro.';
  end if;
  if v_email is not null and position('@' in v_email) < 2 then
    raise exception using errcode = 'P0001', message = 'E-mail do passageiro inválido.';
  end if;
  begin
    v_nasc := (v_pj->>'nascimento')::date;
  exception when others then
    v_nasc := null;
  end;
  if v_nasc is null or v_nasc > current_date or v_nasc < date '1900-01-01' then
    raise exception using errcode = 'P0001', message = 'Data de nascimento do passageiro inválida.';
  end if;

  -- Trava a viagem até o fim da transação
  select v.id, v.empresa_id, v.linha_id, v.embarcacao_id, v.partida, v.status, v.vendas_abertas
  into v_viagem
  from public.viagens v
  where v.id = v_viagem_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Viagem não encontrada.';
  end if;

  -- Agência aprovada e da mesma empresa da viagem
  select a.id, a.empresa_id, a.status into v_ag from public.agencias_parceiras a where a.id = p_agencia_id;
  if not found or v_ag.status <> 'APROVADA' then
    raise exception using errcode = 'P0001', message = 'Agência sem autorização para vender.';
  end if;
  if v_ag.empresa_id <> v_viagem.empresa_id then
    raise exception using errcode = 'P0001', message = 'Viagem não encontrada.';
  end if;

  if v_viagem.status not in ('PROGRAMADA', 'EMBARQUE') or not v_viagem.vendas_abertas then
    raise exception using errcode = 'P0001', message = 'Viagem fechada para vendas.';
  end if;

  -- Paradas válidas; a venda vale até o barco sair da parada de embarque
  select pl.id, pl.porto_id, pl.minutos_desde_origem into v_origem_parada
  from public.paradas_linha pl where pl.linha_id = v_viagem.linha_id and pl.ordem = v_origem;
  select pl.id into v_destino_parada_id
  from public.paradas_linha pl where pl.linha_id = v_viagem.linha_id and pl.ordem = v_destino;
  if v_origem_parada.id is null or v_destino_parada_id is null then
    raise exception using errcode = 'P0001', message = 'Trecho não encontrado na linha da viagem.';
  end if;
  if v_viagem.partida + v_origem_parada.minutos_desde_origem * interval '1 minute' <= now() then
    raise exception using errcode = 'P0001', message = 'A embarcação já saiu da parada de embarque deste trecho.';
  end if;

  -- Preço de tabela, piso e taxa
  v_tabela := private.preco_tabela(v_viagem_id, v_origem, v_destino, v_tipo);
  if v_tabela is null then
    raise exception using errcode = 'P0001', message = 'Tarifa não cadastrada para o trecho selecionado.';
  end if;
  v_piso := private.piso_agencia(v_viagem_id, v_tipo, v_tabela);
  if v_cobrado < v_piso then
    raise exception using errcode = 'P0001',
      message = format('Valor abaixo do mínimo permitido (R$ %s).', to_char(v_piso, 'FM999G990D00'));
  end if;
  v_taxa := private.taxa_embarque_agencia(v_viagem_id, v_origem, v_destino, v_tipo);
  v_repasse := v_piso + v_taxa;

  -- Lotação: o trecho mais cheio entre embarque e desembarque precisa ter vaga
  select e.capacidade_passageiros, e.assento_livre into v_emb from public.embarcacoes e where e.id = v_viagem.embarcacao_id;
  if private.max_ocupacao_trecho(v_viagem_id, v_origem, v_destino) + 1 > v_emb.capacidade_passageiros then
    raise exception using errcode = 'P0001', message = 'Sem vagas neste trecho.';
  end if;

  -- Embarcação com poltronas: escolhe a primeira livre no trecho (a agência não escolhe lugar). Colo não ocupa poltrona.
  if v_tipo <> 'COLO' and not v_emb.assento_livre then
    select a.id into v_assento_id
    from public.assentos a
    left join public.comodos c on c.id = a.comodo_id and c.ativo
    where a.embarcacao_id = v_viagem.embarcacao_id
      and a.ativo
      and not exists (
        select 1 from public.passagens pas
        where pas.viagem_id = v_viagem_id
          and pas.assento_id = a.id
          and pas.status in ('RESERVADA', 'EMITIDA', 'EMBARCADA')
          and pas.trecho && int4range(v_origem, v_destino)
      )
    order by coalesce(c.acrescimo, 0), a.fileira, a.coluna
    limit 1;
    if v_assento_id is null then
      raise exception using errcode = 'P0001', message = 'Sem vagas neste trecho.';
    end if;
  end if;

  -- Passageiro: um cadastro por documento
  insert into public.passageiros (empresa_id, documento, documento_original, nome, telefone, email, nascimento, endereco, aceita_marketing)
  values (v_viagem.empresa_id, v_doc, v_doc_original, v_nome, v_tel, v_email, v_nasc, v_endereco, v_marketing)
  on conflict (empresa_id, documento) do update
    set nome = excluded.nome,
        telefone = coalesce(excluded.telefone, passageiros.telefone),
        email = coalesce(excluded.email, passageiros.email),
        nascimento = excluded.nascimento,
        endereco = coalesce(excluded.endereco, passageiros.endereco),
        aceita_marketing = excluded.aceita_marketing,
        updated_at = now()
  returning id into v_passageiro_id;

  -- Pedido (canal AGENCIA). O total do pedido é o que a empresa tem a receber (piso + taxa);
  -- a diferença até o valor cobrado é a margem da agência, gravada em comissao_agencia.
  select c.sigla into v_sigla
  from public.portos po join public.cidades c on c.id = po.cidade_id
  where po.id = v_origem_parada.porto_id;

  v_codigo := private.gerar_codigo('ST', 6);
  while exists (select 1 from public.pedidos where codigo = v_codigo) loop
    v_codigo := private.gerar_codigo('ST', 6);
  end loop;
  v_numero := coalesce(v_sigla, 'NAV') || '-' || to_char(now(), 'YYYY') || '-' ||
              lpad(nextval('public.pedido_numero_seq'::regclass)::text, 4, '0');
  while exists (select 1 from public.pedidos where numero = v_numero) loop
    v_numero := coalesce(v_sigla, 'NAV') || '-' || to_char(now(), 'YYYY') || '-' ||
                lpad(nextval('public.pedido_numero_seq'::regclass)::text, 4, '0');
  end loop;

  v_qr := private.gerar_codigo('QR', 12);
  while exists (select 1 from public.passagens where qr_token = v_qr) loop
    v_qr := private.gerar_codigo('QR', 12);
  end loop;

  insert into public.pedidos (
    id, empresa_id, codigo, numero, canal, status, comprador_nome, comprador_email, comprador_telefone,
    subtotal, taxas, desconto, total, comissao_agencia, expira_em
  ) values (
    v_pedido_id, v_viagem.empresa_id, v_codigo, v_numero, 'AGENCIA', 'PAGO', v_nome, v_email, coalesce(v_tel, v_email),
    v_piso, v_taxa, 0, v_piso + v_taxa, v_cobrado - v_piso, null
  );

  begin
    insert into public.passagens (
      id, empresa_id, pedido_id, viagem_id, assento_id, origem_ordem, destino_ordem,
      nome, documento, nascimento, telefone, tipo, valor, taxa_embarque, status, qr_token
    ) values (
      v_passagem_id, v_viagem.empresa_id, v_pedido_id, v_viagem_id, v_assento_id, v_origem, v_destino,
      v_nome, v_doc_original, v_nasc::timestamptz, v_tel, v_tipo, v_cobrado, v_taxa, 'EMITIDA', v_qr
    );
  exception when exclusion_violation then
    raise exception using errcode = 'P0001', message = 'Sem vagas neste trecho.';
  end;

  v_numero_bilhete := 'AG-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.bilhete_agencia_seq'::regclass)::text, 6, '0');

  insert into public.bilhetes_agencia (
    id, empresa_id, agencia_id, passagem_id, pedido_id, passageiro_id, numero, codigo_validacao,
    valor_tabela, valor_piso, valor_cobrado, taxa_embarque, valor_repasse
  ) values (
    v_bilhete_id, v_viagem.empresa_id, p_agencia_id, v_passagem_id, v_pedido_id, v_passageiro_id, v_numero_bilhete, v_qr,
    v_tabela, v_piso, v_cobrado, v_taxa, v_repasse
  );

  insert into public.bilhete_agencia_historico (bilhete_id, evento, status_novo, agencia_id, detalhe)
  values (v_bilhete_id, 'EMISSAO', 'EMITIDO', p_agencia_id,
          jsonb_build_object('valor_cobrado', v_cobrado, 'valor_piso', v_piso, 'valor_repasse', v_repasse));

  return jsonb_build_object(
    'bilhete_id', v_bilhete_id,
    'numero', v_numero_bilhete,
    'codigo_validacao', v_qr,
    'passagem_id', v_passagem_id,
    'pedido_codigo', v_codigo,
    'valor_cobrado', v_cobrado,
    'valor_piso', v_piso,
    'taxa_embarque', v_taxa,
    'valor_repasse', v_repasse
  );
end;
$function$;

-- Cancelamento pela agência: devolve a vaga (a passagem sai da contagem de lotação).
create or replace function public.cancelar_bilhete_agencia(p_agencia_id uuid, p_bilhete_id uuid, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_b record;
  v_ag_status public.status_agencia_parceira;
  v_pas record;
begin
  select a.status into v_ag_status from public.agencias_parceiras a where a.id = p_agencia_id;
  if v_ag_status is distinct from 'APROVADA' then
    raise exception using errcode = 'P0001', message = 'Agência sem autorização para esta operação.';
  end if;

  select b.id, b.agencia_id, b.passagem_id, b.pedido_id, b.status, b.repasse_pago
  into v_b
  from public.bilhetes_agencia b
  where b.id = p_bilhete_id and b.agencia_id = p_agencia_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'Bilhete não encontrado.';
  end if;
  if v_b.status <> 'EMITIDO' then
    raise exception using errcode = 'P0001', message = 'Este bilhete não pode mais ser cancelado.';
  end if;
  if v_b.repasse_pago then
    raise exception using errcode = 'P0001', message = 'O repasse deste bilhete já foi baixado. Fale com a empresa.';
  end if;

  select pas.status, v.partida, pl.minutos_desde_origem
  into v_pas
  from public.passagens pas
  join public.viagens v on v.id = pas.viagem_id
  join public.paradas_linha pl on pl.linha_id = v.linha_id and pl.ordem = pas.origem_ordem
  where pas.id = v_b.passagem_id
  for update of pas;

  if v_pas.status <> 'EMITIDA' then
    raise exception using errcode = 'P0001', message = 'Este bilhete não pode mais ser cancelado.';
  end if;
  if v_pas.partida + v_pas.minutos_desde_origem * interval '1 minute' <= now() then
    raise exception using errcode = 'P0001', message = 'A embarcação já saiu da parada de embarque; não é mais possível cancelar.';
  end if;

  update public.passagens set status = 'CANCELADA' where id = v_b.passagem_id;
  update public.pedidos set status = 'CANCELADO' where id = v_b.pedido_id;
  update public.bilhetes_agencia set status = 'CANCELADO' where id = v_b.id;

  insert into public.bilhete_agencia_historico (bilhete_id, evento, status_anterior, status_novo, agencia_id, detalhe)
  values (v_b.id, 'CANCELAMENTO', 'EMITIDO', 'CANCELADO', p_agencia_id, jsonb_build_object('motivo', nullif(trim(p_motivo), '')));

  return jsonb_build_object('bilhete_id', v_b.id, 'status', 'CANCELADO');
end;
$function$;

-- ------------------------------------------------------------------------------
-- 6. Permissões: nada para anon/authenticated; só o servidor (service role) executa
-- ------------------------------------------------------------------------------
revoke execute on function
  private.max_ocupacao_trecho(uuid, integer, integer),
  private.preco_tabela(uuid, integer, integer, public.tipo_passageiro),
  private.piso_agencia(uuid, public.tipo_passageiro, numeric),
  private.taxa_embarque_agencia(uuid, integer, integer, public.tipo_passageiro),
  public.lotacao_por_trecho(uuid),
  public.precos_agencia_trecho(uuid, integer, integer),
  public.vender_passagem_agencia(uuid, jsonb),
  public.cancelar_bilhete_agencia(uuid, uuid, text)
from public, anon, authenticated;

grant execute on function
  public.lotacao_por_trecho(uuid),
  public.precos_agencia_trecho(uuid, integer, integer),
  public.vender_passagem_agencia(uuid, jsonb),
  public.cancelar_bilhete_agencia(uuid, uuid, text)
to service_role;
