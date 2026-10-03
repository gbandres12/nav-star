import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { localDayKey, manausDate } from "../format";
import { bancoAgencia } from "../agencia/banco";
import type { Resultado } from "../types";

export type StatusAgenciaParceira = "PENDENTE" | "APROVADA" | "SUSPENSA" | "RECUSADA";
export type AgenciaParceira = {
  id: string;
  nome: string;
  documento?: string;
  responsavel: string;
  email: string;
  telefone: string;
  status: StatusAgenciaParceira;
  motivoStatus?: string;
  aprovadoEm?: string;
  ultimoLogin?: string;
  criadaEm: string;
};

export type DecisaoAgencia = "APROVAR" | "RECUSAR" | "SUSPENDER";

/** Para cada decisão: o status de destino e de quais status ela pode partir */
const TRANSICOES: Record<DecisaoAgencia, { para: StatusAgenciaParceira; de: StatusAgenciaParceira[] }> = {
  APROVAR: { para: "APROVADA", de: ["PENDENTE", "SUSPENSA", "RECUSADA"] },
  RECUSAR: { para: "RECUSADA", de: ["PENDENTE"] },
  SUSPENDER: { para: "SUSPENSA", de: ["APROVADA"] },
};

async function banco() {
  return (await createClient()) as unknown as SupabaseClient;
}

/** Empresa do operador logado */
export async function empresaDoOperador(operadorId: string) {
  const { data } = await (await banco()).from("perfis").select("empresa_id").eq("id", operadorId).maybeSingle();
  return (data?.empresa_id as string | undefined) ?? null;
}

/** Lista pela sessão do operador: a RLS só libera ADMIN/GERENTE da própria empresa, e a coluna senha_hash nem é selecionável */
export async function listarAgenciasParceiras(): Promise<AgenciaParceira[]> {
  const { data, error } = await (await banco())
    .from("agencias_parceiras")
    .select("id, nome, documento, responsavel, email, telefone, status, motivo_status, aprovado_em, ultimo_login, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`[agencias_parceiras] ${error.message}`);
  return (data ?? []).map((a) => ({
    id: a.id,
    nome: a.nome,
    documento: a.documento ?? undefined,
    responsavel: a.responsavel,
    email: a.email,
    telefone: a.telefone,
    status: a.status,
    motivoStatus: a.motivo_status ?? undefined,
    aprovadoEm: a.aprovado_em ?? undefined,
    ultimoLogin: a.ultimo_login ?? undefined,
    criadaEm: a.created_at,
  }));
}

/** Grava a decisão com service role; só muda se a agência ainda estiver no status de origem (evita decisão em cima de decisão) */
export async function decidirAgenciaParceira(
  agenciaId: string,
  decisao: DecisaoAgencia,
  operadorId: string,
  empresaId: string,
  motivo?: string,
): Promise<Resultado> {
  const t = TRANSICOES[decisao];
  if (!t) return { ok: false, erro: "Decisão inválida." };
  const { data, error } = await bancoAgencia()
    .from("agencias_parceiras")
    .update({
      status: t.para,
      motivo_status: motivo?.trim() || null,
      aprovado_em: t.para === "APROVADA" ? new Date().toISOString() : null,
      aprovado_por: t.para === "APROVADA" ? operadorId : null,
      tentativas_falhas: 0,
      bloqueado_ate: null,
    })
    .eq("id", agenciaId)
    .eq("empresa_id", empresaId)
    .in("status", t.de)
    .select("id");
  if (error) return { ok: false, erro: error.message };
  if (!data?.length) return { ok: false, erro: "Esta agência mudou de situação. Atualize a página." };
  return { ok: true };
}

// ─── Pisos e vendas por viagem ────────────────────────────────────────────

/** Categorias que aparecem no cadastro de pisos (criança de colo não paga tarifa, então não tem piso) */
export const CATEGORIAS_PISO = ["INTEIRA", "CRIANCA", "IDOSO", "ESTUDANTE", "PCD"] as const;

/** Piso (% da tabela) por categoria; categoria sem registro vale 100% */
export async function pisosDaViagem(viagemId: string): Promise<Record<string, number>> {
  const { data } = await (await banco()).from("viagem_pisos").select("tipo, piso_percentual").eq("viagem_id", viagemId);
  return Object.fromEntries((data ?? []).map((r) => [r.tipo as string, Number(r.piso_percentual)]));
}

/** Grava os pisos da viagem e, se pedido, das demais viagens futuras da mesma linha (escrita só pelo servidor) */
export async function salvarPisos(viagemId: string, pisos: Record<string, number>, aplicarFuturas: boolean): Promise<Resultado<{ viagens: number }>> {
  for (const [tipo, pct] of Object.entries(pisos)) {
    if (!(CATEGORIAS_PISO as readonly string[]).includes(tipo) || !(pct >= 0 && pct <= 100)) return { ok: false, erro: "O piso deve ficar entre 0% e 100%." };
  }
  const leitura = await banco(); // RLS: só enxerga viagens da empresa do operador
  const { data: v } = await leitura.from("viagens").select("id, linha_id").eq("id", viagemId).maybeSingle();
  if (!v) return { ok: false, erro: "Viagem não encontrada." };

  let ids = [viagemId];
  if (aplicarFuturas) {
    const { data } = await leitura
      .from("viagens")
      .select("id")
      .eq("linha_id", v.linha_id)
      .in("status", ["PROGRAMADA", "EMBARQUE"])
      .gt("partida", new Date().toISOString());
    ids = [...new Set([viagemId, ...(data ?? []).map((x) => x.id as string)])];
  }

  const linhas = ids.flatMap((id) => Object.entries(pisos).map(([tipo, pct]) => ({ viagem_id: id, tipo, piso_percentual: pct })));
  const { error } = await bancoAgencia().from("viagem_pisos").upsert(linhas, { onConflict: "viagem_id,tipo" });
  if (error) return { ok: false, erro: error.message };
  return { ok: true, viagens: ids.length };
}

export type VendaAgencia = {
  numero: string;
  agencia: string;
  passageiro: string;
  origemOrdem: number;
  destinoOrdem: number;
  valorCobrado: number;
  valorRepasse: number;
  status: string;
  pedidoCodigo?: string;
};

/** "A agência X vendeu": bilhetes de agências numa viagem (via sessão do operador, com RLS) */
export async function vendasDeAgenciasNaViagem(viagemId: string): Promise<VendaAgencia[]> {
  const { data } = await (await banco())
    .from("bilhetes_agencia")
    .select("numero, status, valor_cobrado, valor_repasse, agencia:agencias_parceiras(nome), passageiro:passageiros(nome), passagem:passagens!inner(viagem_id, origem_ordem, destino_ordem), pedido:pedidos(codigo)")
    .eq("passagem.viagem_id", viagemId)
    .order("created_at");
  type Linha = {
    numero: string; status: string; valor_cobrado: number; valor_repasse: number;
    agencia: { nome: string }; passageiro: { nome: string }; passagem: { origem_ordem: number; destino_ordem: number }; pedido: { codigo: string } | null;
  };
  return ((data ?? []) as unknown as Linha[]).map((b) => ({
    numero: b.numero,
    agencia: b.agencia.nome,
    passageiro: b.passageiro.nome,
    origemOrdem: b.passagem.origem_ordem,
    destinoOrdem: b.passagem.destino_ordem,
    valorCobrado: Number(b.valor_cobrado),
    valorRepasse: Number(b.valor_repasse),
    status: b.status,
    pedidoCodigo: b.pedido?.codigo,
  }));
}

/** Nome da agência parceira que vendeu o pedido, se foi o caso */
export async function agenciaDoPedido(pedidoId: string): Promise<string | undefined> {
  const { data } = await (await banco()).from("bilhetes_agencia").select("agencia:agencias_parceiras(nome)").eq("pedido_id", pedidoId).limit(1).maybeSingle();
  return (data as unknown as { agencia?: { nome: string } } | null)?.agencia?.nome;
}

// ─── Painel por agência, repasse e transferência (etapa 4) ────────────────

export type ResumoAgencia = {
  agenciaId: string;
  bilhetesPeriodo: number;
  vendidoPeriodo: number;
  repassePeriodo: number;
  margemPeriodo: number;
  aReceber: number;
  aReceberQtd: number;
  aDevolver: number;
};

/** Totais por agência (a RPC confere papel ADMIN/GERENTE e a empresa do operador) */
export async function resumoAgencias(inicio: Date, fim: Date): Promise<Map<string, ResumoAgencia>> {
  const { data, error } = await (await banco()).rpc("resumo_agencias_parceiras", { p_inicio: inicio.toISOString(), p_fim: fim.toISOString() });
  if (error) throw new Error(`[resumo_agencias_parceiras] ${error.message}`);
  type L = { agencia_id: string; bilhetes_periodo: number; vendido_periodo: number; repasse_periodo: number; margem_periodo: number; a_receber: number; a_receber_qtd: number; a_devolver: number };
  return new Map(
    ((data ?? []) as L[]).map((r) => [
      r.agencia_id,
      {
        agenciaId: r.agencia_id,
        bilhetesPeriodo: r.bilhetes_periodo,
        vendidoPeriodo: Number(r.vendido_periodo),
        repassePeriodo: Number(r.repasse_periodo),
        margemPeriodo: Number(r.margem_periodo),
        aReceber: Number(r.a_receber),
        aReceberQtd: r.a_receber_qtd,
        aDevolver: Number(r.a_devolver),
      },
    ]),
  );
}

export async function agenciaParceiraPorId(id: string): Promise<AgenciaParceira | undefined> {
  return (await listarAgenciasParceiras()).find((a) => a.id === id);
}

export type BilheteInterno = {
  id: string;
  numero: string;
  status: "EMITIDO" | "CANCELADO" | "TRANSFERIDO";
  criadoEm: string;
  passageiro: string;
  documento: string;
  linha: string;
  origem: string;
  destino: string;
  embarque: string;
  valorCobrado: number;
  valorRepasse: number;
  repassePago: boolean;
  repassePagoEm?: string;
  pedidoCodigo?: string;
};

type LinhaBilheteInterno = {
  id: string; numero: string; status: BilheteInterno["status"]; created_at: string; valor_cobrado: number; taxa_embarque: number;
  valor_repasse: number; repasse_pago: boolean; repasse_pago_em: string | null;
  passageiro: { nome: string; documento_original: string };
  pedido: { codigo: string } | null;
  passagem: {
    origem_ordem: number; destino_ordem: number;
    viagem: { partida: string; linha: { nome: string; paradas: { ordem: number; minutos_desde_origem: number; porto: { cidade: { nome: string } } }[] } };
  };
};

const SELECT_INTERNO =
  "id, numero, status, created_at, valor_cobrado, taxa_embarque, valor_repasse, repasse_pago, repasse_pago_em, passageiro:passageiros(nome, documento_original), pedido:pedidos(codigo), passagem:passagens(origem_ordem, destino_ordem, viagem:viagens(partida, linha:linhas(nome, paradas:paradas_linha(ordem, minutos_desde_origem, porto:portos(cidade:cidades(nome))))))";

function mapBilheteInterno(r: LinhaBilheteInterno): BilheteInterno {
  const par = (o: number) => r.passagem.viagem.linha.paradas.find((p) => p.ordem === o);
  const origem = par(r.passagem.origem_ordem);
  return {
    id: r.id,
    numero: r.numero,
    status: r.status,
    criadoEm: r.created_at,
    passageiro: r.passageiro.nome,
    documento: r.passageiro.documento_original,
    linha: r.passagem.viagem.linha.nome,
    origem: origem?.porto.cidade.nome ?? "—",
    destino: par(r.passagem.destino_ordem)?.porto.cidade.nome ?? "—",
    embarque: new Date(new Date(r.passagem.viagem.partida).getTime() + (origem?.minutos_desde_origem ?? 0) * 60_000).toISOString(),
    valorCobrado: Number(r.valor_cobrado) + Number(r.taxa_embarque),
    valorRepasse: Number(r.valor_repasse),
    repassePago: r.repasse_pago,
    repassePagoEm: r.repasse_pago_em ?? undefined,
    pedidoCodigo: r.pedido?.codigo,
  };
}

/** Bilhetes de uma agência pelo estado do repasse. "a_receber" = válidos sem baixa; "baixados" = últimos 100 com baixa. */
export async function bilhetesDaAgenciaInterno(agenciaId: string, quais: "a_receber" | "baixados"): Promise<BilheteInterno[]> {
  let q = (await banco()).from("bilhetes_agencia").select(SELECT_INTERNO).eq("agencia_id", agenciaId);
  q = quais === "a_receber"
    ? q.in("status", ["EMITIDO", "TRANSFERIDO"]).eq("repasse_pago", false).order("created_at").limit(500)
    : q.eq("repasse_pago", true).order("repasse_pago_em", { ascending: false }).limit(100);
  const { data, error } = await q;
  if (error) throw new Error(`[bilhetes agência] ${error.message}`);
  return ((data ?? []) as unknown as LinhaBilheteInterno[]).map(mapBilheteInterno);
}

export type OcupacaoViagem = {
  viagemId: string;
  linha: string;
  partida: string;
  capacidade: number;
  trechos: { origem: string; destino: string; daAgencia: number; total: number }[];
};

/** Nas próximas viagens em que a agência vendeu: quantos lugares ela ocupa em cada trecho, frente à lotação total */
export async function ocupacaoDaAgencia(agenciaId: string): Promise<OcupacaoViagem[]> {
  const leitura = await banco();
  const { data } = await leitura
    .from("bilhetes_agencia")
    .select("passagem:passagens!inner(viagem_id, origem_ordem, destino_ordem, viagem:viagens!inner(partida)), status")
    .eq("agencia_id", agenciaId)
    .in("status", ["EMITIDO", "TRANSFERIDO"])
    .gt("passagem.viagem.partida", new Date(Date.now() - 24 * 3600_000).toISOString());
  type L = { passagem: { viagem_id: string; origem_ordem: number; destino_ordem: number } };
  const vendas = (data ?? []) as unknown as L[];
  const ids = [...new Set(vendas.map((v) => v.passagem.viagem_id))].slice(0, 30);
  if (!ids.length) return [];

  const { data: viagens } = await leitura
    .from("viagens")
    .select("id, partida, linha:linhas(nome, paradas:paradas_linha(ordem, porto:portos(cidade:cidades(nome))))")
    .in("id", ids)
    .order("partida");
  type V = { id: string; partida: string; linha: { nome: string; paradas: { ordem: number; porto: { cidade: { nome: string } } }[] } };
  const servidor = bancoAgencia();

  return Promise.all(
    ((viagens ?? []) as unknown as V[]).map(async (v) => {
      const { data: lot } = await servidor.rpc("lotacao_por_trecho", { p_viagem_id: v.id });
      const nome = (o: number) => v.linha.paradas.find((p) => p.ordem === o)?.porto.cidade.nome ?? "—";
      const minhas = vendas.filter((x) => x.passagem.viagem_id === v.id).map((x) => x.passagem);
      const trechos = ((lot ?? []) as { ordem_origem: number; ordem_destino: number; ocupados: number; capacidade: number }[]).map((t) => ({
        origem: nome(t.ordem_origem),
        destino: nome(t.ordem_destino),
        daAgencia: minhas.filter((m) => m.origem_ordem <= t.ordem_origem && m.destino_ordem > t.ordem_origem).length,
        total: t.ocupados,
        capacidade: t.capacidade,
      }));
      return { viagemId: v.id, linha: v.linha.nome, partida: v.partida, capacidade: trechos[0]?.capacidade ?? 0, trechos };
    }),
  );
}

export async function marcarRepasse(empresaId: string, operadorId: string, ids: string[], pago: boolean): Promise<Resultado<{ quantidade: number; total: number }>> {
  const { data, error } = await bancoAgencia().rpc("marcar_repasse_agencia", { p_empresa_id: empresaId, p_usuario_id: operadorId, p_bilhete_ids: ids, p_pago: pago, p_observacao: null });
  if (error) return { ok: false, erro: error.code === "P0001" ? error.message : "Não foi possível registrar agora." };
  const r = data as { quantidade: number; total: number };
  return { ok: true, quantidade: r.quantidade, total: Number(r.total) };
}

export async function transferirBilhete(empresaId: string, operadorId: string, bilheteId: string, passageiro: Record<string, unknown>, motivo: string): Promise<Resultado> {
  const { error } = await bancoAgencia().rpc("transferir_bilhete_agencia", { p_empresa_id: empresaId, p_usuario_id: operadorId, p_bilhete_id: bilheteId, p_passageiro: passageiro, p_motivo: motivo || null });
  if (error) return { ok: false, erro: error.code === "P0001" ? error.message : "Não foi possível transferir agora." };
  return { ok: true };
}

// ─── Painel ao vivo ───────────────────────────────────────────────────────

export type PainelAoVivo = {
  atualizadoEm: string;
  agencias: Record<StatusAgenciaParceira, number>;
  hoje: { bilhetes: number; vendido: number };
  mes: { bilhetes: number; vendido: number; margem: number; nome: string };
  aReceber: number;
  aReceberQtd: number;
  aDevolver: number;
  pendentes: { id: string; nome: string; criadaEm: string }[];
  ranking: { id: string; nome: string; bilhetes: number; vendido: number }[];
  ultimas: { id: string; numero: string; agencia: string; passageiro: string; origem: string; destino: string; valor: number; status: string; criadoEm: string; recente: boolean }[];
  viagensCheias: { id: string; linha: string; partida: string; pct: number; livres: number; trecho: string }[];
};

const soma = (rs: Iterable<ResumoAgencia>, f: (r: ResumoAgencia) => number) => [...rs].reduce((t, r) => t + f(r), 0);

/** Fotografia do momento para o painel das agências. Quem chama precisa já ter conferido que o operador é ADMIN. */
export async function painelAoVivo(): Promise<PainelAoVivo> {
  const agora = new Date();
  const [ano, mes, dia] = localDayKey(agora).split("-").map(Number);
  const inicioHoje = manausDate(ano, mes - 1, dia);
  const fimHoje = new Date(inicioHoje.getTime() + 86_400_000);
  const inicioMes = manausDate(ano, mes - 1, 1);
  const fimMes = manausDate(ano, mes, 1);

  const leitura = await banco();
  const [resumoHoje, resumoMes, listaAgencias, { data: bruto }, { data: viagens }] = await Promise.all([
    resumoAgencias(inicioHoje, fimHoje),
    resumoAgencias(inicioMes, fimMes),
    listarAgenciasParceiras(),
    leitura.from("bilhetes_agencia").select(`${SELECT_INTERNO}, agencia:agencias_parceiras(nome)`).order("created_at", { ascending: false }).limit(12),
    leitura
      .from("viagens")
      .select("id, partida, linha:linhas(nome, paradas:paradas_linha(ordem, porto:portos(cidade:cidades(nome))))")
      .in("status", ["PROGRAMADA", "EMBARQUE"])
      .gt("partida", agora.toISOString())
      .lt("partida", new Date(agora.getTime() + 7 * 86_400_000).toISOString())
      .order("partida")
      .limit(20),
  ]);

  const nomes = new Map(listaAgencias.map((a) => [a.id, a.nome]));
  const contagem: Record<StatusAgenciaParceira, number> = { PENDENTE: 0, APROVADA: 0, SUSPENSA: 0, RECUSADA: 0 };
  for (const a of listaAgencias) contagem[a.status]++;

  const ultimas = ((bruto ?? []) as unknown as (LinhaBilheteInterno & { agencia: { nome: string } })[]).map((r) => {
    const b = mapBilheteInterno(r);
    return {
      id: b.id, numero: b.numero, agencia: r.agencia.nome, passageiro: b.passageiro, origem: b.origem, destino: b.destino,
      valor: b.valorCobrado, status: b.status, criadoEm: b.criadoEm, recente: agora.getTime() - new Date(b.criadoEm).getTime() < 120_000,
    };
  });

  type V = { id: string; partida: string; linha: { nome: string; paradas: { ordem: number; porto: { cidade: { nome: string } } }[] } };
  const servidor = bancoAgencia();
  const cheias = (
    await Promise.all(
      ((viagens ?? []) as unknown as V[]).map(async (v) => {
        const { data: lot } = await servidor.rpc("lotacao_por_trecho", { p_viagem_id: v.id });
        const trechos = (lot ?? []) as { ordem_origem: number; ordem_destino: number; ocupados: number; capacidade: number; livres: number }[];
        const pior = trechos.reduce<(typeof trechos)[number] | undefined>((m, t) => (!m || t.ocupados > m.ocupados ? t : m), undefined);
        if (!pior || !pior.capacidade) return null;
        const nome = (o: number) => v.linha.paradas.find((p) => p.ordem === o)?.porto.cidade.nome ?? "—";
        return { id: v.id, linha: v.linha.nome, partida: v.partida, pct: Math.round((pior.ocupados / pior.capacidade) * 100), livres: pior.livres, trecho: `${nome(pior.ordem_origem)} → ${nome(pior.ordem_destino)}` };
      }),
    )
  )
    .filter((x): x is NonNullable<typeof x> => !!x && x.pct >= 80)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);

  return {
    atualizadoEm: agora.toISOString(),
    agencias: contagem,
    hoje: { bilhetes: soma(resumoHoje.values(), (r) => r.bilhetesPeriodo), vendido: soma(resumoHoje.values(), (r) => r.vendidoPeriodo) },
    mes: {
      bilhetes: soma(resumoMes.values(), (r) => r.bilhetesPeriodo),
      vendido: soma(resumoMes.values(), (r) => r.vendidoPeriodo),
      margem: soma(resumoMes.values(), (r) => r.margemPeriodo),
      nome: periodoNome(ano, mes),
    },
    aReceber: soma(resumoMes.values(), (r) => r.aReceber),
    aReceberQtd: soma(resumoMes.values(), (r) => r.aReceberQtd),
    aDevolver: soma(resumoMes.values(), (r) => r.aDevolver),
    pendentes: listaAgencias.filter((a) => a.status === "PENDENTE").slice(0, 6).map((a) => ({ id: a.id, nome: a.nome, criadaEm: a.criadaEm })),
    ranking: [...resumoMes.values()]
      .filter((r) => r.bilhetesPeriodo > 0)
      .sort((a, b) => b.vendidoPeriodo - a.vendidoPeriodo)
      .slice(0, 5)
      .map((r) => ({ id: r.agenciaId, nome: nomes.get(r.agenciaId) ?? "—", bilhetes: r.bilhetesPeriodo, vendido: r.vendidoPeriodo })),
    ultimas,
    viagensCheias: cheias,
  };
}

const MESES_NOME = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const periodoNome = (ano: number, mes: number) => `${MESES_NOME[mes - 1]} ${ano}`;
