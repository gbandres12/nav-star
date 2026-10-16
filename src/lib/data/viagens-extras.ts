import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import type { Resultado, StatusViagem } from "../types";

export type TipoViagemExtra = "EXTRA" | "FRETAMENTO";

export type ViagemExtra = {
  id: string;
  tipo: TipoViagemExtra;
  origem: string;
  destino: string;
  embarcacaoId: string;
  embarcacaoNome: string;
  saidaIda: string;
  saidaVolta?: string;
  status: StatusViagem;
  clienteNome?: string;
  clienteContato?: string;
  valorTotal: number;
  valorRecebido: number;
  passageiros?: number;
  observacao?: string;
  motivoCancelamento?: string;
};

export type DadosViagemExtra = Omit<ViagemExtra, "id" | "embarcacaoNome" | "motivoCancelamento"> & { id?: string; motivoCancelamento?: string };

const COLUNAS =
  "id, tipo, origem, destino, embarcacao_id, saida_ida, saida_volta, status, cliente_nome, cliente_contato, valor_total, valor_recebido, passageiros, observacao, motivo_cancelamento, embarcacao:embarcacoes(nome)";

type Linha = {
  id: string; tipo: TipoViagemExtra; origem: string; destino: string; embarcacao_id: string; saida_ida: string; saida_volta: string | null;
  status: StatusViagem; cliente_nome: string | null; cliente_contato: string | null; valor_total: number; valor_recebido: number;
  passageiros: number | null; observacao: string | null; motivo_cancelamento: string | null; embarcacao: { nome: string } | null;
};

const mapa = (r: Linha): ViagemExtra => ({
  id: r.id, tipo: r.tipo, origem: r.origem, destino: r.destino, embarcacaoId: r.embarcacao_id, embarcacaoNome: r.embarcacao?.nome ?? "—",
  saidaIda: r.saida_ida, saidaVolta: r.saida_volta ?? undefined, status: r.status,
  clienteNome: r.cliente_nome ?? undefined, clienteContato: r.cliente_contato ?? undefined,
  valorTotal: Number(r.valor_total), valorRecebido: Number(r.valor_recebido), passageiros: r.passageiros ?? undefined,
  observacao: r.observacao ?? undefined, motivoCancelamento: r.motivo_cancelamento ?? undefined,
});

async function banco() {
  return (await createClient()) as unknown as SupabaseClient;
}

async function empresaDe(supabase: SupabaseClient) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("perfis").select("empresa_id").eq("id", auth.user.id).maybeSingle();
  return { empresaId: (data?.empresa_id as string | undefined) ?? null, usuarioId: auth.user.id };
}

/** Viagens extras com ida dentro do período (RLS: só ADMIN/GERENTE da empresa) */
export async function listarViagensExtras(inicio: Date, fim: Date): Promise<ViagemExtra[]> {
  const { data, error } = await (await banco())
    .from("viagens_extras")
    .select(COLUNAS)
    .gte("saida_ida", inicio.toISOString())
    .lt("saida_ida", fim.toISOString())
    .order("saida_ida", { ascending: false });
  if (error) throw new Error(`[viagens_extras] ${error.message}`);
  return ((data ?? []) as unknown as Linha[]).map(mapa);
}

export async function viagemExtra(id: string): Promise<ViagemExtra | null> {
  const { data } = await (await banco()).from("viagens_extras").select(COLUNAS).eq("id", id).maybeSingle();
  return data ? mapa(data as unknown as Linha) : null;
}

/**
 * Outras viagens em que a mesma embarcação já está no período (extras e viagens regulares).
 * Para viagem sem volta, considera 12 h de ocupação; para regular, o tempo até a última parada da linha.
 */
export async function conflitosDaEmbarcacao(embarcacaoId: string, ida: Date, volta: Date | undefined, ignorarId?: string): Promise<string[]> {
  const supabase = await banco();
  const inicio = ida.getTime();
  const fim = volta ? volta.getTime() : inicio + 12 * 3600_000;
  const cruza = (a: number, b: number) => a < fim && b > inicio;
  const fmt = (t: number) => new Date(t).toLocaleString("pt-BR", { timeZone: "America/Manaus", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const avisos: string[] = [];

  const { data: extras } = await supabase
    .from("viagens_extras")
    .select("id, destino, saida_ida, saida_volta")
    .eq("embarcacao_id", embarcacaoId)
    .neq("status", "CANCELADA");
  for (const e of (extras ?? []) as { id: string; destino: string; saida_ida: string; saida_volta: string | null }[]) {
    if (e.id === ignorarId) continue;
    const a = new Date(e.saida_ida).getTime();
    const b = e.saida_volta ? new Date(e.saida_volta).getTime() : a + 12 * 3600_000;
    if (cruza(a, b)) avisos.push(`viagem extra para ${e.destino} (${fmt(a)} a ${fmt(b)})`);
  }

  const { data: regulares } = await supabase
    .from("viagens")
    .select("partida, linha:linhas(nome, paradas:paradas_linha(minutos_desde_origem))")
    .eq("embarcacao_id", embarcacaoId)
    .neq("status", "CANCELADA")
    .gte("partida", new Date(inicio - 72 * 3600_000).toISOString())
    .lt("partida", new Date(fim).toISOString());
  for (const v of (regulares ?? []) as unknown as { partida: string; linha: { nome: string; paradas: { minutos_desde_origem: number }[] } }[]) {
    const a = new Date(v.partida).getTime();
    const b = a + Math.max(0, ...v.linha.paradas.map((p) => p.minutos_desde_origem)) * 60_000;
    if (cruza(a, b)) avisos.push(`viagem regular ${v.linha.nome} (${fmt(a)} a ${fmt(b)})`);
  }
  return avisos;
}

export async function salvarViagemExtra(d: DadosViagemExtra): Promise<Resultado<{ id: string }>> {
  const supabase = await banco();
  const ctx = await empresaDe(supabase);
  if (!ctx?.empresaId) return { ok: false, erro: "Seu usuário não está ligado a uma empresa." };

  const campos = {
    tipo: d.tipo,
    origem: d.origem.trim(),
    destino: d.destino.trim(),
    embarcacao_id: d.embarcacaoId,
    saida_ida: d.saidaIda,
    saida_volta: d.saidaVolta ?? null,
    status: d.status,
    cliente_nome: d.clienteNome?.trim() || null,
    cliente_contato: d.clienteContato?.trim() || null,
    valor_total: d.valorTotal,
    valor_recebido: d.valorRecebido,
    passageiros: d.passageiros ?? null,
    observacao: d.observacao?.trim() || null,
    motivo_cancelamento: d.status === "CANCELADA" ? d.motivoCancelamento?.trim() || null : null,
  };

  if (d.id) {
    const { data, error } = await supabase.from("viagens_extras").update(campos).eq("id", d.id).select("id");
    if (error) return { ok: false, erro: error.message };
    if (!data?.length) return { ok: false, erro: "Viagem não encontrada ou sem permissão para alterar." };
    return { ok: true, id: d.id };
  }
  const { data, error } = await supabase
    .from("viagens_extras")
    .insert({ ...campos, empresa_id: ctx.empresaId, criado_por: ctx.usuarioId })
    .select("id")
    .single();
  if (error) return { ok: false, erro: error.code === "42501" ? "Só administrador e gerente cadastram viagens extras." : error.message };
  return { ok: true, id: data.id as string };
}
